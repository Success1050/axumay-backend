import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('deposits')
  async getPendingDeposits() {
    return this.adminService.getPendingDeposits();
  }

  @Post('fund-user')
  async fundUser(@Body() body: { email: string; amount: number }) {
    return this.adminService.fundUser(body.email, body.amount);
  }

  @Get('investments')
  async getActiveInvestments() {
    return this.adminService.getActiveInvestments();
  }

  @Post('compound')
  async compoundInterest(@Body() body: { investmentId: string; amount: number; isMaturity: boolean }) {
    return this.adminService.compoundInterest(body.investmentId, body.amount, body.isMaturity);
  }

  @Get('withdrawals')
  async getPendingWithdrawals() {
    return this.adminService.getPendingWithdrawals();
  }

  @Post('process-withdrawal')
  async processWithdrawal(@Body() body: { withdrawalId: string; action: 'APPROVE' | 'REJECT' }) {
    return this.adminService.processWithdrawal(body.withdrawalId, body.action);
  }
}

