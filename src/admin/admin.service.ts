import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPendingDeposits() {
    return this.prisma.depositRequest.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async fundUser(email: string, amount: number) {
    return this.prisma.$transaction(async (prisma) => {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) throw new NotFoundException('User not found');

      const balance = await prisma.balance.findUnique({ where: { userId: user.id } });
      if (!balance) throw new NotFoundException('Balance not found');

      await prisma.balance.update({
        where: { userId: user.id },
        data: {
          mainBalance: { increment: amount },
          totalDeposit: { increment: amount },
          version: { increment: 1 }
        }
      });

      await prisma.transaction.create({
        data: {
          userId: user.id,
          type: 'DEPOSIT',
          amount,
          description: 'Admin Manual Funding',
          status: 'COMPLETED'
        }
      });

      return { message: 'Funded successfully' };
    });
  }

  async getActiveInvestments() {
    return this.prisma.investment.findMany({
      where: { status: 'ACTIVE' },
      include: { user: { select: { email: true } }, plan: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async compoundInterest(investmentId: string, interestAmount: number, isMaturity: boolean) {
    return this.prisma.$transaction(async (prisma) => {
      const investment = await prisma.investment.findUnique({ where: { id: investmentId }, include: { plan: true } });
      if (!investment) throw new NotFoundException('Investment not found');
      if (investment.status !== 'ACTIVE') throw new BadRequestException('Investment not active');

      // Add interest to interestBalance
      await prisma.balance.update({
        where: { userId: investment.userId },
        data: {
          interestBalance: { increment: interestAmount },
          totalEarn: { increment: interestAmount },
          version: { increment: 1 }
        }
      });

      // If maturity, return capital to mainBalance and close
      if (isMaturity) {
        if (investment.plan.capitalReturn) {
          await prisma.balance.update({
            where: { userId: investment.userId },
            data: {
              mainBalance: { increment: Number(investment.amount) },
              version: { increment: 1 }
            }
          });
        }
        await prisma.investment.update({
          where: { id: investmentId },
          data: { status: 'COMPLETED' }
        });
      } else {
        // Update next payout date
        await prisma.investment.update({
          where: { id: investmentId },
          data: { nextPayoutDate: new Date(Date.now() + investment.plan.maturityHours * 60 * 60 * 1000) }
        });
      }

      return { message: 'Compounded successfully' };
    });
  }

  async getPendingWithdrawals() {
    return this.prisma.withdrawalRequest.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'asc' }
    });
  }

  async processWithdrawal(withdrawalId: string, action: 'APPROVE' | 'REJECT') {
    return this.prisma.$transaction(async (prisma) => {
      const req = await prisma.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
      if (!req || req.status !== 'PENDING') throw new BadRequestException('Invalid request');

      if (action === 'REJECT') {
        // Refund main balance
        await prisma.balance.update({
          where: { userId: req.userId },
          data: { mainBalance: { increment: Number(req.amount) }, version: { increment: 1 } }
        });
        await prisma.withdrawalRequest.update({ where: { id: withdrawalId }, data: { status: 'REJECTED' } });
      } else {
        await prisma.withdrawalRequest.update({ where: { id: withdrawalId }, data: { status: 'SENT' } });
        await prisma.transaction.create({
          data: {
            userId: req.userId,
            type: 'WITHDRAWAL',
            amount: req.amount,
            description: `Withdrawal sent to ${req.btcAddress}`
          }
        });
      }

      return { message: `Withdrawal ${action}D` };
    });
  }

  async getStats() {
    const totalUsers = await this.prisma.user.count();
    const allUsers = await this.prisma.user.findMany({
      select: { createdAt: true }
    });
    return {
      totalUsers,
      userCreationDates: allUsers.map(u => u.createdAt)
    };
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        createdAt: true,
        isAdmin: true,
        balance: { select: { mainBalance: true, totalDeposit: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.isAdmin) throw new BadRequestException('Cannot delete an admin user');

    // Balance, investments, transactions are Cascade deleted if configured. 
    // Wait, the schema has `onDelete: Cascade` for Balance, but maybe not for others?
    // Let's manually delete child records to be safe.
    await this.prisma.$transaction(async (prisma) => {
      await prisma.investment.deleteMany({ where: { userId } });
      await prisma.transaction.deleteMany({ where: { userId } });
      await prisma.depositRequest.deleteMany({ where: { userId } });
      await prisma.withdrawalRequest.deleteMany({ where: { userId } });
      
      const balance = await prisma.balance.findUnique({ where: { userId } });
      if (balance) await prisma.balance.delete({ where: { userId } });

      await prisma.user.delete({ where: { id: userId } });
    });

    return { message: 'User deleted successfully' };
  }
}

