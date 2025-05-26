import { Controller, Get, Param } from '@nestjs/common';
import { SearchService } from './search.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('search-endpoints')
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get('album/:title')
  @ApiOperation({ summary: 'Search for album via title ' })
  searchAlbum(@Param('title') title: string) {
    return this.searchService.searchAlbum(title);
  }

  @Get('artwork/:title')
  @ApiOperation({ summary: 'Search for artworks via title ' })
  searchArtwork(@Param('title') title: string) {
    return this.searchService.searchArtwork(title);
  }

  @Get('story/:title')
  @ApiOperation({ summary: 'Search for stories via title ' })
  searchStory(@Param('title') title: string) {
    return this.searchService.searchStory(title);
  }

  @Get('advert/:title')
  @ApiOperation({ summary: 'Search for adverts via title ' })
  searchAdvert(@Param('title') title: string) {
    return this.searchService.searchAdvert(title);
  }
}
