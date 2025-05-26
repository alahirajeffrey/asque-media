import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { AlbumService } from './album.service';
import { PaginationDto } from 'src/category/dto/pagination.dto';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';

@ApiTags('album-endpoints')
@Controller('album')
export class AlbumController {
  constructor(private readonly albumService: AlbumService) {}

  @UseGuards(JwtGuard)
  @ApiSecurity('JWT-auth')
  @Get('own')
  @ApiOperation({ summary: 'Get all albums created by a profile' })
  getAllAlbumsByProfileId(@Req() req, @Query() dto: PaginationDto) {
    return this.albumService.getAllAlbumsByProfileId(req.user.profileId, dto);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all albums ' })
  getAllAlbums(@Query() dto: PaginationDto) {
    return this.albumService.getAllAlbums(dto);
  }

  @Get('newest')
  @ApiOperation({ summary: 'Get ten newest albums ' })
  getNewestArtwork() {
    return this.albumService.getNewestAlbums();
  }

  @Get(':albumId')
  @ApiOperation({ summary: 'Get an album by album id' })
  getAlbumDetailsById(@Param('albumId') albumId: string) {
    return this.albumService.getAlbumDetailsById(albumId);
  }

  @UseGuards(JwtGuard)
  @ApiSecurity('JWT-auth')
  @Delete(':albumId')
  @ApiOperation({ summary: 'Delete an album' })
  deleteAlbum(@Param('albumId') albumId: string, @Req() req) {
    return this.albumService.deleteAlbum(albumId, req.user.profileId);
  }

  @UseGuards(JwtGuard)
  @ApiSecurity('JWT-auth')
  @Post()
  @ApiOperation({ summary: 'Create an album for an artwork' })
  createAlbum(@Body() dto: CreateAlbumDto, @Req() req) {
    return this.albumService.createAlbum(dto, req.user.profileId);
  }

  @Get('stock/all')
  @ApiOperation({ summary: 'Get all stock images' })
  getAllStockImages() {
    return this.albumService.getAllStockImages();
  }

  @UseGuards(JwtGuard)
  @ApiSecurity('JWT-auth')
  @Patch('update/:albumId')
  @ApiOperation({ summary: 'Update album details ' })
  deleteAlbumImage(
    @Param('albumId') albumId: string,
    @Req() req,
    @Body() dto: UpdateAlbumDto,
  ) {
    return this.albumService.updateAlbum(dto, req.user.profileId, albumId);
  }

  // @Get('category/:categoryName')
  // @ApiOperation({ summary: 'Get all albums by category name' })
  // getAllAlbumsInACategory(
  //   @Query() dto: PaginationDto,
  //   @Param('categoryName') categoryName: string,
  // ) {
  //   return this.albumService.getAllAlbumsInACategory(categoryName, dto);
  // }
}
