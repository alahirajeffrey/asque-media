import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PrismaService } from 'src/prisma.service';
import { Logger } from 'winston';
import { OrderItemsDto } from './dto/create-order-item.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { EmailNotificationService } from 'src/email-notification/email-notification.service';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { ShipOrderDto } from './dto/order-shipped.dto';
import { ChangeOrderStatusDto } from './dto/change-status.dto';

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

      if (artwork.quantity === 0) {
        await this.prisma.artWork.update({
          where: { id: orderItem.artworkId },
          data: { quantity: newArtworkQuantity, purchaseStatus: 'InStock' },
        });
      }

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
   * calculate total cost of order and check out
   * @param orderId: id of order
   * @param dto: checkout dto
   */
  async checkout(orderId: string) {
    try {
      const order = await this.prisma.order.findFirst({
        where: { id: orderId },
      });
      if (!order) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      // const shippingCost = (25 * Number(order.totalPrice)) / 100;

      // const topshipApiKey = this.config.get('TOPSHIP_API_KEY');

      // const shippingResponse = await axios.get(
      //   `https://api-topship.com/api/get-shipment-rate?shipmentDetail={
      //     senderDetails: {
      //       cityName: Lagos
      //       countryCode: NG
      //     },
      //     senderDetails: {
      //       cityName: ${order.city}
      //       countryCode: NG
      //     },
      //     totalWeight: 2
      //   }`,
      //   {
      //     headers: {
      //       Authorization: `Bearer ${topshipApiKey}`,
      //     },
      //   },
      // );

      // const shippingCost: number = shippingResponse[0].cost;

      const checkOutDetails = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          shippingCost: 0,
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

      // pay for shipment
      await axios.post(
        'https://api-topship.com/api/pay-from-wallet',
        {
          detail: { shipmentId: dto.shipmentId },
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.get('TOPSHIP_API_KEY')}`,
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

  async trackShipment(trackingId: string) {
    try {
      const response = await axios.get(
        `https://topship-staging.africa/api/track-shipment?trackingId=${trackingId}`,
      );

      const responseData = response.data;

      return {
        statusCode: HttpStatus.OK,
        data: {
          id: responseData.id,
          status: responseData.status,
          message: responseData.message,
          location: responseData.itemLocation,
          estimatedDeliveryDate: responseData.estimatedDeliveryDate,
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

  async getShipmentDetails(shipmentId: string) {
    try {
      const response = await axios.get(
        `https://topship-staging.africa/api/get-shipment/${shipmentId}`,
      );

      const responseData = response.data;

      return {
        statusCode: HttpStatus.OK,
        data: {
          shipmentStatus: responseData.shipmentStatus,
          label: responseData.label,
          trackingUrl: responseData.trackingUrl,
          shipmentRoute: responseData.shipmentRoute,
          senderDetails: responseData.senderDetail,
          recieverDetails: responseData.recieverDetails,
          estimatedDeliveryDate: responseData.estimatedDeliveryDate,
          items: responseData.items,
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

  async addOrderItems(profileId: string, dto: OrderItemsDto) {
    try {
      // create order
      const order = await this.prisma.order.create({
        data: {
          profileId: profileId,
          deliveryAddress: dto.address,
          zip: dto.zip,
          city: dto.city,
          country: dto.country,
          referrerCode: dto.referrerCOde,
        },
      });
      let currentOrderTotal = 0;

      await Promise.all(
        dto.orderItems.map(async (orderItem) => {
          let currentItemOrderTotal = 0;

          // get artwork and price of current order item
          const artwork = await this.prisma.artWork.findFirst({
            where: { id: orderItem.artworkId },
          });

          if (!artwork) {
            throw new HttpException(
              `Artwork with ${artwork.id} not found`,
              HttpStatus.NOT_FOUND,
            );
          }

          // check to see quantity ordered does not exceed available quantity
          if (artwork.quantity < orderItem.quantity) {
            throw new HttpException(
              `There are only ${artwork.quantity} available in the store.`,
              HttpStatus.BAD_REQUEST,
            );
          }
          currentItemOrderTotal = orderItem.quantity * Number(artwork.price);

          // create item order
          await this.prisma.order_Item.create({
            data: {
              orderId: order.id,
              quantity: orderItem.quantity,
              artworkId: orderItem.artworkId,
              price: currentItemOrderTotal,
            },
          });

          // update current total price
          currentOrderTotal += currentItemOrderTotal;
        }),
      );

      const updatedOrder = await this.prisma.order.update({
        where: { id: order.id },
        data: { totalPrice: currentOrderTotal },
        include: { orderItem: true },
      });

      return {
        statusCode: HttpStatus.CREATED,
        data: updatedOrder,
      };
    } catch (error) {
      this.logger.error(error);
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteOrder(orderId: string, profileId: string) {
    try {
      const order = await this.prisma.order.findFirst({
        where: { id: orderId },
      });
      if (!order) {
        throw new HttpException('Order does not exist', HttpStatus.NOT_FOUND);
      }

      if (order.profileId !== profileId) {
        throw new HttpException(
          'You cannot delete an order you did not make',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // delete order items
      await this.prisma.order_Item.deleteMany({
        where: { order: { id: orderId } },
      });

      // delete order
      await this.prisma.order.delete({ where: { id: orderId } });

      return {
        statusCode: HttpStatus.OK,
        message: 'Order and order items deleted',
      };
    } catch (error) {
      this.logger.error(error);
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async changeOrderStatus(orderId: string, dto: ChangeOrderStatusDto) {
    try {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: dto.status },
      });

      return {
        statusCode: HttpStatus.OK,
        message: `Order status changed to ${dto.status}`,
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
