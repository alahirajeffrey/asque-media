import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma.service';
import { Logger } from 'winston';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import axios from 'axios';
import { ApiResponse } from 'src/types/response.type';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Request } from 'express';
import { EmailNotificationService } from 'src/email-notification/email-notification.service';

@Injectable()
export class PaymentService {
  private paystackApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: EmailNotificationService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.paystackApiKey = this.config.get<string>('PAYSTACK_API_KEY');
  }

  /**
   * process payment for an order
   * @param dto : process payment dto
   * @returns : status code with authorization url
   */
  async processPayment(
    dto: ProcessPaymentDto,
    profileId: string,
  ): Promise<ApiResponse> {
    try {
      const profile = await this.prisma.profile.findFirst({
        where: { id: profileId },
      });

      const order = await this.prisma.order.findFirst({
        where: { id: dto.orderId },
        include: { orderItem: true },
      });

      if (dto.amount < Number(order.shippingCost) + Number(order.totalPrice)) {
        throw new HttpException(
          'You did not input the correct amount',
          HttpStatus.BAD_REQUEST,
        );
      }

      // create transaction with paystack
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          email: profile.userEmail,
          amount: dto.amount * 100,
          currency: 'NGN', // Nigerian Naira
        },
        {
          headers: {
            Authorization: `Bearer ${this.paystackApiKey}`,
          },
        },
      );

      // get response details
      const responseData = response.data.data;

      // save transaction details to database
      await this.prisma.payment.create({
        data: {
          transactionReference: responseData.reference,
          payeeEmail: profile.userEmail,
          amount: dto.amount,
          orderId: dto.orderId,
        },
      });

      // reduce available artwork quantity
      await Promise.all(
        order.orderItem.map(async (orderItem) => {
          const artwork = await this.prisma.artWork.findFirst({
            where: { id: orderItem.artworkId },
          });

          const artworkQuantityLeft = artwork.quantity - orderItem.quantity;

          await this.prisma.artWork.update({
            where: { id: artwork.id },
            data: { quantity: artworkQuantityLeft },
          });
        }),
      );

      // calculate referral amount and fund referrer if referrer code is present
      if (order.referrerCode !== null) {
        // get details of referrer
        const referrer = await this.prisma.referral.findFirst({
          where: { code: order.referrerCode },
          include: { user: { select: { profile: true } } },
        });

        if (!referrer) {
          return {
            statusCode: HttpStatus.OK,
            data: {
              redirectUrl: responseData.authorization_url,
              reference: responseData.reference,
            },
          };
        }

        // calculate referral amount
        const referralAmount =
          (Number(this.config.get('REFERRAL_PERCENTAGE')) *
            Number(order.totalPrice)) /
          100;

        await this.prisma.referral.update({
          where: { id: referrer.id },
          data: { balance: referralAmount },
        });

        return {
          statusCode: HttpStatus.OK,
          data: {
            redirectUrl: responseData.authorization_url,
            reference: responseData.reference,
          },
        };
      }

      return {
        statusCode: HttpStatus.OK,
        data: {
          redirectUrl: responseData.authorization_url,
          reference: responseData.reference,
        },
      };
    } catch (error) {
      this.logger.error(error);
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * verify the status of a payment
   * @param reference : transaction reference
   * @returns :status code and message
   */
  async verifyPaymentViaPaystack(reference: string) {
    try {
      // make request to paystack
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackApiKey}`,
          },
        },
      );

      // get response status
      return {
        statusCode: HttpStatus.OK,
        data: response.data.data,
      };
    } catch (error) {
      this.logger.error(error);
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * transfer funds
   * @param recipientAccountNumber
   * @param recipientBankCode
   * @param amount
   * @param reason
   */
  async transferMoney(
    recipientAccountNumber: string,
    recipientBankCode: string,
    amount: number,
    reason: string,
    recipientName: string,
    recipientEmail: string,
  ) {
    try {
      // create transaction with paystack
      const response = await axios.post(
        'https://api.paystack.co/transfer',
        {
          source: 'balance',
          reason: reason,
          amount: amount,
          recipient: {
            type: 'nuban',
            name: recipientName,
            account_number: recipientAccountNumber,
            bank_code: recipientBankCode,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.paystackApiKey}`,
          },
        },
      );

      // get response status
      const status = response.data.event;

      // get response details
      const responseData = response.data.data;

      switch (status) {
        case 'transfer.success':
          const transferDetails = await this.prisma.transfer.create({
            data: {
              amount: amount,
              transactionId: responseData.id,
              payeeEmail: recipientEmail,
              accountName: responseData.recipient.details.account_name,
              bankName: responseData.recipient.details.bank_name,
              bankCode: recipientBankCode,
              type: responseData.recipient.type,
              reference: responseData.reference,
            },
          });

          return {
            statusCode: HttpStatus.OK,
            message: 'Payment successful',
            data: transferDetails,
          };
        case 'transfer.reversed':
          return {
            statusCode: HttpStatus.OK,
            message: { message: 'Transfer reversed' },
          };
        case 'transfer.failed':
          return {
            statusCode: HttpStatus.OK,
            message: { message: 'Payment failed' },
          };
      }
    } catch (error) {
      this.logger.error(error);
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getBanks() {
    try {
      // create transaction with paystack
      const response = await axios.get(
        `https://api.paystack.co/bank`,
        // ?perPage=${dto.pageSize}

        {
          headers: {
            Authorization: `Bearer ${this.paystackApiKey}`,
          },
        },
      );

      if ((response.data.data.status = true)) {
        const returnedBankData = response.data.data;

        const cleanedBankData = [];

        returnedBankData.forEach((bank) => {
          cleanedBankData.push({ bankName: bank.name, bankCode: bank.code });
        });

        return {
          statusCode: HttpStatus.OK,
          data: cleanedBankData,
        };
      }
    } catch (error) {
      this.logger.error(error);
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * confirm payment status
   * @param req : request object
   * @returns : status code and message
   */
  async verifyPaymentViaWebhook(req: Request) {
    try {
      // Retrieve the request's body
      const { event, data } = req.body;
      // Do something with event
      if (event === 'charge.success') {
        // update payment and order status if payment is successful
        const payment = await this.prisma.payment.update({
          where: { transactionReference: data.reference },
          data: { paymentStatus: 'COMPLETED' },
        });

        await this.prisma.order.update({
          where: { id: payment.orderId },
          data: { status: 'PAID' },
          include: { profile: true, orderItem: true },
        });

        // notify admin of order payment
        await this.emailService.notifyAdminOfCompletePayment(payment.orderId);

        // // create shipment draft with topship
        // const topshipResponse = await axios.post(
        //   'https://api-topship.com/api/save-shipment',
        //   {
        //     shipment: [
        //       {
        //         items: [
        //           {
        //             category: 'Others',
        //             description: `artwork shipment to ${order.profile.name}`,
        //             weight: 2,
        //             quantity: order.orderItem.length,
        //             value: order.totalPrice,
        //           },
        //         ],
        //       },
        //       {
        //         senderDetail: {
        //           name: 'Asque',
        //           email: this.config.get('USER_EMAIL'),
        //           country: 'NG',
        //           state: 'Lagos',
        //           city: 'Lagos',
        //         },
        //         receiverDetail: {
        //           name: order.profile.name,
        //           email: order.profile.userEmail,
        //           country: order.country,
        //           city: order.city,
        //           countryCode: '234',
        //           addressLine1: order.deliveryAddress,
        //           phoneNumber: order.profile.mobileNumber,
        //         },
        //       },
        //     ],
        //   },
        //   {
        //     headers: {
        //       Authorization: `Bearer ${this.config.get('TOPSHIP_API_KEY')}`,
        //     },
        //   },
        // );

        // // save shipment details
        // const shipment = await this.prisma.shipment.create({
        //   data: {
        //     trackingId: topshipResponse.data.trackingId,
        //     cost: topshipResponse.data.totalCharge,
        //     order: {
        //       connect: { id: order.id },
        //     },
        //   },
        // });

        return {
          statusCode: HttpStatus.OK,
          // data: shipment,
          message: 'Payment successful',
        };
      }
    } catch (error) {
      this.logger.error(error);
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
