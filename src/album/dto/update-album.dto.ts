import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

class AlbumChildrenUpdateDto {
  @IsOptional()
  @IsString()
  @ApiProperty()
  id: string;

  @IsString()
  @IsOptional()
  @ApiProperty()
  subTitle: string;

  @IsOptional()
  @ApiProperty()
  category: string[];

  @IsOptional()
  @ApiProperty()
  @IsString()
  description: string;

  @IsOptional()
  @ApiProperty()
  albumImageUris: string[];
}

export class UpdateAlbumDto {
  @IsString()
  @IsOptional()
  @ApiProperty()
  title: string;

  @IsOptional()
  @ApiProperty({ type: [AlbumChildrenUpdateDto] })
  albumChildren: AlbumChildrenUpdateDto[];
}
