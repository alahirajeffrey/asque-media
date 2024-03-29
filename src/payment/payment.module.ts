import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';
import { EmailNotificationService } from 'src/email-notification/email-notification.service';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, PrismaService, EmailNotificationService],
  imports: [JwtModule.register({})],
})
export class PaymentModule {}
