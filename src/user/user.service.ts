import { Injectable, NotFoundException } from '@nestjs/common';
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

    // Omit sensitive data like password
    const { password, ...safeUser } = user;
    return safeUser;
  }
}
