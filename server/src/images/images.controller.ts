import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser, JwtUser, Roles } from '../common/decorators';
import { UploadImageDto, VoidImageDto } from './dto/image.dto';
import { ImagesService } from './images.service';

const MAX_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '20', 10);

/** 用户端 */
@Controller('images')
export class ImagesUserController {
  constructor(private readonly images: ImagesService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 9, {
      limits: { fileSize: MAX_MB * 1024 * 1024, files: 9 },
      fileFilter: (_req, file, cb) => {
        if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
          return cb(new BadRequestException('仅支持 JPG / PNG / WebP / GIF 图片'), false);
        }
        cb(null, true);
      },
    }),
  )
  upload(
    @CurrentUser() user: JwtUser,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadImageDto,
    @Ip() ip: string,
  ) {
    return this.images.upload(user, files, dto, ip);
  }

  @Get('mine')
  mine(@CurrentUser() user: JwtUser, @Query() query: any) {
    return this.images.mine(user, query);
  }

  @Post(':id/void')
  voidOwn(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VoidImageDto,
  ) {
    return this.images.voidOwn(user, id, dto);
  }
}

/** 管理端 */
@Controller('admin/images')
@Roles('admin')
export class ImagesAdminController {
  constructor(private readonly images: ImagesService) {}

  @Get()
  list(@Query() query: any) {
    return this.images.adminList(query);
  }

  @Post(':id/void')
  void(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VoidImageDto,
    @Ip() ip: string,
  ) {
    return this.images.adminVoid(user, id, dto, ip);
  }

  @Post(':id/restore')
  restore(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Ip() ip: string,
  ) {
    return this.images.restore(user, id, ip);
  }
}
