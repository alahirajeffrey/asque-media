import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async searchArtwork(title: string) {
    try {
      const artworks = await this.prisma.artWork.findMany({
        where: { title: { contains: title, mode: 'insensitive' } },
      });

      return {
        statusCode: HttpStatus.OK,
        data: artworks,
      };
    } catch (error) {
      this.logger.error(error);
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async searchAlbum(title: string) {
    try {
      const albums = await this.prisma.album.findMany({
        where: { title: { contains: title, mode: 'insensitive' } },
        include: { albumChildren: { select: { albumImageUris: true } } },
      });

      const albumsWithImage = [];

      for (const album of albums) {
        const updatedAlbum = {
          album,
          albumImageUri: album.albumChildren[0].albumImageUris[0],
        };

        delete updatedAlbum.album.albumChildren;

        albumsWithImage.push(updatedAlbum);
      }
      return {
        statusCode: HttpStatus.OK,
        data: albumsWithImage,
      };
    } catch (error) {
      this.logger.error(error);
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async searchStory(title: string) {
    try {
      return {
        statusCode: HttpStatus.OK,
        data: await this.prisma.story.findMany({
          where: { title: { contains: title, mode: 'insensitive' } },
        }),
      };
    } catch (error) {
      this.logger.error(error);
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async searchAdvert(title: string) {
    try {
      const adverts = await this.prisma.advert.findMany({
        where: { title: { contains: title, mode: 'insensitive' } },
      });

      return {
        statusCode: HttpStatus.OK,
        data: adverts,
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
