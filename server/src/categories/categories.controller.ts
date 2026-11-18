import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser, JwtUser, Roles } from '../common/decorators';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

/** 用户端：只读启用分类 */
@Controller('categories')
export class CategoriesPublicController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.list(true);
  }
}

/** 管理端：全量增删改查 */
@Controller('admin/categories')
@Roles('admin')
export class CategoriesAdminController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@Query('all') _all?: string) {
    return this.categories.list(false);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateCategoryDto, @Ip() ip: string) {
    return this.categories.create(user, dto, ip);
  }

  @Put(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
    @Ip() ip: string,
  ) {
    return this.categories.update(user, id, dto, ip);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number, @Ip() ip: string) {
    return this.categories.remove(user, id, ip);
  }
}
