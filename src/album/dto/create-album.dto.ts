import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

class AlbumChildrenDto {
  @IsString()
  @IsOptional()
  @ApiProperty()
  subTitle: string;

  @IsNotEmpty()
  @ApiProperty()
  category: string[];

  @IsNotEmpty()
  @ApiProperty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @ApiProperty()
  albumImageUris: string[];
}

export class CreateAlbumDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  title: string;

  @IsNotEmpty()
  @ApiProperty({ type: [AlbumChildrenDto] })
  albumChildren: AlbumChildrenDto[];
}
