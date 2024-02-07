import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PrismaService } from 'src/prisma.service';
import { Logger } from 'winston';
import { ApiResponse } from 'src/types/response.type';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { CheckOutDto } from './dto/check-out.dto';
import { EmailNotificationService } from 'src/email-notification/email-notification.service';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { ShipOrderDto } from './dto/order-shipped.dto';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private emailService: EmailNotificationService,
    private config: ConfigService,
  ) {}

  /**
   * get order details
   * @param orderId : id of order
   * @returns : status code and order object
   */
  async getOrderDetails(orderId: string) {
    try {
      // check if order exists
      const order = await this.prisma.order.findFirst({
        where: { id: orderId },
        include: { orderItem: true, profile: true, shipment: true },
      });

      if (!order) {
        throw new HttpException('Order does not exist', HttpStatus.NOT_FOUND);
      }

      return { statusCode: HttpStatus.OK, data: order };
    } catch (error) {
      this.logger.error(error);
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * get all orders made by a user
   * @param orderId : id of order
   * @returns status code and list of orders
   */
  async getUserOrders(profileId: string) {
    try {
      const orders = await this.prisma.order.findMany({
        where: { profileId: profileId },
        include: { orderItem: true },
      });

      if (!orders) {
        throw new HttpException(
          'User has not made any orders before',
          HttpStatus.NOT_FOUND,
        );
      }

      return { statusCode: HttpStatus.OK, data: { orders } };
    } catch (error) {
      this.logger.error(error);
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * cancel an order
   * @param orderId : id of order
   * @param profileId : id of profile
   * @returns status code and message
   */
  async cancelOrder(orderId: string, profileId: string) {
    try {
      // check if order exists
      const orderExists = await this.prisma.order.findFirst({
        where: { id: orderId },
      });

      if (!orderExists) {
        throw new HttpException('Order does not exist', HttpStatus.NOT_FOUND);
      }

      // ensure only user who made an order can canel it
      if (orderExists.profileId !== profileId) {
        throw new HttpException(
          'You cannot cancel an order you did not make',
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (orderExists.status === 'SHIPPED') {
        throw new HttpException(
          'You cannot cancel an order that has already been shipped',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // cancel order
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELED' },
      });

      return {
        statusCode: HttpStatus.OK,
        message: { message: 'Order cancelled' },
      };
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * add selected artwork to an order and update available quantity in store
   * @param dto : create order item dto
   * @returns status code and order item object
   */
  async addOrderItemToOrder(dto: CreateOrderItemDto) {
    try {
      const artwork = await this.prisma.artWork.findFirst({
        where: { id: dto.artworkId },
      });

      // check to see quantity ordered does not exceed available quantity
      if (dto.quantity > artwork.quantity) {
        throw new HttpException(
          `There are only ${artwork.quantity} available in the store.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      // calculate price of artwork
      const totalPrice = Number(artwork.price) * dto.quantity;
      const totalPriceDecimal = new Decimal(totalPrice);

      // calculate new total price of order
      const order = await this.prisma.order.findFirst({
        where: { id: dto.orderId },
      });

      const previousTotalPrice = order.totalPrice;
      const newTotalPrice = Number(previousTotalPrice) + totalPrice;
      const newTotalPriceDecimal = new Decimal(newTotalPrice);

      const orderItem = await this.prisma.order_Item.create({
        data: {
          orderId: dto.orderId,
          artworkId: dto.artworkId,
          quantity: dto.quantity,
          price: totalPriceDecimal,
        },
      });

      // reduce available quantity after order item is created and added to user's order
      const previousQuantity = artwork.quantity;
      const currentQuantity = previousQuantity - dto.quantity;

      await this.prisma.artWork.update({
        where: { id: dto.artworkId },
        data: { quantity: currentQuantity },
      });

      // update order total price
      await this.prisma.order.update({
        where: { id: dto.orderId },
        data: { totalPrice: newTotalPriceDecimal },
      });

      return {
        statusCode: HttpStatus.CREATED,
        data: { orderItem },
      };
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * remove and order item from an order and update quantity available
   * @param profileId : profile id of customer
   * @param orderItemId : id of order item
   * @param orderId : id of order
   * @returns : status code and message
   */
  async removeOrderItemFromOrder(profileId: string, orderItemId: string) {
    try {
      const orderItem = await this.prisma.order_Item.findFirst({
        where: { id: orderItemId },
      });

      const order = await this.prisma.order.findFirst({
        where: { id: orderItem.orderId },
      });
      // ensure only owner of an order item can remove order items
      if (order.profileId !== profileId) {
        throw new HttpException(
          `You cannot remove items from an order that is not yours.`,
          HttpStatus.UNAUTHORIZED,
        );
      }

      const artwork = await this.prisma.artWork.findFirst({
        where: { id: orderItem.artworkId },
      });

      // remove item from order
      await this.prisma.order_Item.delete({ where: { id: orderItemId } });

      // update artwork quantity after removing from order
      const newArtworkQuantity = orderItem.quantity + artwork.quantity;

      await this.prisma.artWork.update({
        where: { id: orderItem.artworkId },
        data: { quantity: newArtworkQuantity },
      });

      // update total price of order after order itms item is removed
      const previousOrderTotalPrice = order.totalPrice;
      const newOrderTotalPrice =
        Number(previousOrderTotalPrice) - Number(orderItem.price);
      const newOrderTotalPriceDecimal = new Decimal(newOrderTotalPrice);

      await this.prisma.order.update({
        where: { id: order.id },
        data: { totalPrice: newOrderTotalPriceDecimal },
      });

      return {
        statusCode: HttpStatus.OK,
        message: 'Order item removed from order',
      };
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * create order for user
   * @param dto : create order dto containing customer profileId
   * @returns :status code and order object
   */
  async createOrder(profileId: string): Promise<ApiResponse> {
    try {
      // get the most recent order
      const orders = await this.prisma.order.findMany({
        where: { profileId: profileId },
        orderBy: { createdAt: 'desc' },
      });

      const mostRecentOrder = orders[0];

      // if most recent order is undefined create and return an order
      if (mostRecentOrder === undefined) {
        const order = await this.prisma.order.create({
          data: { profileId: profileId },
        });

        return {
          statusCode: HttpStatus.CREATED,
          data: { order },
        };
      }

      // return order to user if order is pending
      if (mostRecentOrder.status === 'PENDING') {
        return {
          statusCode: HttpStatus.OK,
          data: { mostRecentOrder },
        };
      }

      // create order
      const order = await this.prisma.order.create({
        data: { profileId: profileId },
      });

      return {
        statusCode: HttpStatus.CREATED,
        data: { order },
      };
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * calculate total cost of order and check out
   * @param orderId: id of order
   * @param dto: checkout dto
   */
  async checkout(orderId: string, dto: CheckOutDto) {
    try {
      const topshipApiKey = this.config.get('TOPSHIP_API_KEY');

      const shippingResponse = await axios.get(
        'https://api-topship.com/api/get-shipment-rate?shipmentDetail= {}',
        {
          headers: {
            Authorization: `Bearer ${topshipApiKey}`,
          },
        },
      );

      const shippingCost: number = shippingResponse[0].cost;

      const checkOutDetails = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          deliveryAddress: dto.deliveryAddress,
          city: dto.city,
          zip: dto.zip,
          country: dto.country,
          referrerCode: dto.referrerCode,
          shippingCost: shippingCost,
        },
      });

      return {
        statusCode: HttpStatus.OK,
        message: { checkOutDetails },
      };
    } catch (error) {
      this.logger.error(error);
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async shipOrder(userId: string, dto: ShipOrderDto) {
    try {
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
      });

      if (user.role !== 'ADMIN') {
        throw new HttpException(
          'Only admins can notify users of shipped orders',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const orderDetails = await this.prisma.order.findFirst({
        where: { id: dto.orderId },
        include: { shipment: true },
      });

      const topshipApiKey = this.config.get('TOPSHIP_API_KEY');

      // pay for shipment
      await axios.post(
        'https://api-topship.com/api/pay-from-wallet',
        {
          detail: { shipmentId: dto.shipmentId },
        },
        {
          headers: {
            Authorization: `Bearer ${topshipApiKey}`,
          },
        },
      );

      // update order status, shipment status and notify user of shipment
      await this.prisma.order
        .update({
          where: { id: dto.orderId },
          data: { status: 'SHIPPED' },
        })
        .then(async () => {
          await this.prisma.shipment
            .update({
              where: { id: orderDetails.shipment.id },
              data: { isPaid: true },
            })
            .then(async () => {
              await this.emailService.sendOrderShippedEmail(
                dto.payerEmail,
                dto.orderId,
                orderDetails.shipment.trackingId,
              );
            });
        });

      return {
        statusCode: HttpStatus.OK,
        message: 'Order shipped and shipment email sent',
      };
    } catch (error) {
      this.logger.error(error);
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
