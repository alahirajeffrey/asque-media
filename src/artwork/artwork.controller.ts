import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ArtworkService } from './artwork.service';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { CreateArtworkDto } from './dto/create-artwork.dto';
import { UpdateArtworkDto } from './dto/update-artwork.dto';
import { PaginationDto } from 'src/category/dto/pagination.dto';

@ApiTags('artwork-endpoints')
@Controller('artwork')
export class ArtworkController {
  constructor(private readonly artWorkService: ArtworkService) {}

  @UseGuards(JwtGuard)
  @ApiSecurity('JWT-auth')
  @Get('own')
  @ApiOperation({ summary: 'Get all artwork produced by a user' })
  getAllArtworkByUser(@Query() dto: PaginationDto, @Req() req) {
    return this.artWorkService.getAllArtworkByUser(req.user.profileId, dto);
  }

  @Get('newest')
  @ApiOperation({ summary: 'Get ten newest artwork ' })
  getNewestArtwork() {
    return this.artWorkService.getNewestArtwork();
  }

  @Get('oldest')
  @ApiOperation({ summary: 'Get ten oldest artwork ' })
  getOldestArtwork() {
    return this.artWorkService.getOldestArtwork();
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all artwork ' })
  getAllArtwork(@Query() dto: PaginationDto) {
    return this.artWorkService.getAllArtwork(dto);
  }

  @Get(':artworkId')
  @ApiOperation({ summary: 'Get a single artwork by id' })
  getSingleArtWorkById(@Param('artworkId') artworkId: string) {
    return this.artWorkService.getSingleArtWorkById(artworkId);
  }

  @UseGuards(JwtGuard)
  @ApiSecurity('JWT-auth')
  @Post('')
  @ApiOperation({ summary: 'Create an artwork' })
  createArtwork(@Body() dto: CreateArtworkDto, @Req() req) {
    return this.artWorkService.createArtwork(dto, req.user.profileId);
  }

  @UseGuards(JwtGuard)
  @ApiSecurity('JWT-auth')
  @Patch(':artworkId')
  @ApiOperation({ summary: 'Update artwork details' })
  updateArtWork(
    @Param('artworkId') artworkId: string,
    @Body() dto: UpdateArtworkDto,
    @Req() req,
  ) {
    return this.artWorkService.updateArtWork(
      artworkId,
      req.user.profileId,
      dto,
    );
  }

  @Get('category/:categoryName')
  @ApiOperation({ summary: 'Get all artwork by category name' })
  getAllArtworkInACategory(
    @Query() dto: PaginationDto,
    @Param('categoryName') categoryName: string,
  ) {
    return this.artWorkService.getAllArtworkInACategory(categoryName, dto);
  }

  @UseGuards(JwtGuard)
  @ApiSecurity('JWT-auth')
  @Delete(':artworkId')
  @ApiOperation({ summary: 'Delete an artwork' })
  deleteArtwork(@Param('artworkId') artworkId: string, @Req() req) {
    return this.artWorkService.deleteArtwork(req.user.profileId, artworkId);
  }
}
