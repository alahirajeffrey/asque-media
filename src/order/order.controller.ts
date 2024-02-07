import {
  Controller,
  Param,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { ShipOrderDto } from './dto/order-shipped.dto';
import { JwtGuard } from 'src/auth/guards/jwt.guard';

@ApiTags('order-endpoints')
@UseGuards(JwtGuard)
@ApiSecurity('JWT-auth')
@Controller('orders')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Get(':orderId')
  @ApiOperation({ summary: 'Get details of an order' })
  getOrderDetails(@Param('orderId') orderId: string) {
    return this.orderService.getOrderDetails(orderId);
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Get a list of orders and order items made by a user',
  })
  getUserOrders(@Req() req) {
    return this.orderService.getUserOrders(req.user.profileId);
  }

  // needs refactoring
  @Patch('cancel/:orderId/')
  @ApiOperation({ summary: 'Cancel an order' })
  cancelOrder(@Param('orderId') orderId: string, @Req() req) {
    return this.orderService.cancelOrder(orderId, req.user.profileId);
  }

  @Post()
  @ApiOperation({ summary: 'Create an order' })
  createOrder(@Req() req) {
    return this.orderService.createOrder(req.user.profileId);
  }

  @Post('order-item')
  @ApiOperation({ summary: 'add selected artwork and quantity to an order' })
  addOrderItemToOrder(@Body() dto: CreateOrderItemDto) {
    return this.orderService.addOrderItemToOrder(dto);
  }

  @Patch('remove-order-item/:orderItemId')
  @ApiOperation({ summary: 'removed selected artwork from an order' })
  removeOrderItemFromOrder(
    @Param('orderItemId') orderItemId: string,
    @Req() req,
  ) {
    return this.orderService.removeOrderItemFromOrder(
      req.user.profileId,
      orderItemId,
    );
  }

  @Patch('checkout/:orderId')
  @ApiOperation({ summary: 'checkout order' })
  checkout(@Body() dto: CheckOutDto, @Param('orderId') orderId: string) {
    return this.orderService.checkout(orderId, dto);
  }

  @Post('ship')
  @ApiOperation({ summary: 'Ship a user order' })
  shipOrder(@Body() dto: ShipOrderDto, @Req() req) {
    return this.orderService.shipOrder(req.user.userId, dto);
  }
}
