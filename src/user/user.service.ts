import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getDashboardData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        balance: true,
        investments: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password, ...safeUser } = user;
    return safeUser;
  }

  async submitDeposit(userId: string, screenshotUrl: string) {
    return this.prisma.depositRequest.create({
      data: {
        userId,
        screenshotUrl,
        status: 'PENDING'
      }
    });
  }

  async invest(userId: string, planId: string, amount: number) {
    return this.prisma.$transaction(async (prisma) => {
      const balance = await prisma.balance.findUnique({ where: { userId } });
      if (!balance || Number(balance.mainBalance) < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      const plan = await prisma.investmentPlan.findUnique({ where: { id: planId } });
      if (!plan || amount < Number(plan.minDeposit) || amount > Number(plan.maxDeposit)) {
        throw new BadRequestException('Invalid plan or amount out of bounds');
      }

      await prisma.balance.update({
        where: { userId },
        data: {
          mainBalance: { decrement: amount },
          version: { increment: 1 }
        }
      });

      const investment = await prisma.investment.create({
        data: {
          userId,
          planId,
          amount,
          nextPayoutDate: new Date(Date.now() + plan.maturityHours * 60 * 60 * 1000)
        }
      });

      await prisma.transaction.create({
        data: {
          userId,
          type: 'INVESTMENT',
          amount,
          description: `Invested in ${plan.name}`
        }
      });

      return investment;
    });
  }

  async transferInterestToMain(userId: string, amount: number) {
    return this.prisma.$transaction(async (prisma) => {
      const balance = await prisma.balance.findUnique({ where: { userId } });
      if (!balance || Number(balance.interestBalance) < amount) {
        throw new BadRequestException('Insufficient interest balance');
      }

      await prisma.balance.update({
        where: { userId },
        data: {
          interestBalance: { decrement: amount },
          mainBalance: { increment: amount },
          version: { increment: 1 }
        }
      });
      return { success: true };
    });
  }

  async withdraw(userId: string, amount: number, btcAddress: string) {
    return this.prisma.$transaction(async (prisma) => {
      const balance = await prisma.balance.findUnique({ where: { userId } });
      if (!balance || Number(balance.mainBalance) < amount) {
        throw new BadRequestException('Insufficient main balance');
      }

      await prisma.balance.update({
        where: { userId },
        data: {
          mainBalance: { decrement: amount },
          version: { increment: 1 }
        }
      });

      const request = await prisma.withdrawalRequest.create({
        data: {
          userId,
          amount,
          btcAddress,
          status: 'PENDING'
        }
      });

      return request;
    });
  }
}

