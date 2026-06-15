import { Controller, Get, Post, Body, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { cloudinary } from '../cloudinary.config';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('dashboard')
  async getDashboard(@Request() req) {
    return this.userService.getDashboardData(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('deposit')
  @UseInterceptors(FileInterceptor('screenshot', {
    storage: new CloudinaryStorage({
      cloudinary: cloudinary,
      params: { folder: 'axumay_deposits' } as any,
    }),
  }))
  async deposit(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Screenshot is required');
    return this.userService.submitDeposit(req.user.userId, file.path);
  }

  @UseGuards(JwtAuthGuard)
  @Post('invest')
  async invest(@Request() req, @Body() body: { planId: string, amount: number }) {
    return this.userService.invest(req.user.userId, body.planId, body.amount);
  }

  @UseGuards(JwtAuthGuard)
  @Post('transfer-interest')
  async transferInterest(@Request() req, @Body() body: { amount: number }) {
    return this.userService.transferInterestToMain(req.user.userId, body.amount);
  }

  @UseGuards(JwtAuthGuard)
  @Post('withdraw')
  async withdraw(@Request() req, @Body() body: { amount: number, btcAddress: string }) {
    return this.userService.withdraw(req.user.userId, body.amount, body.btcAddress);
  }
}
