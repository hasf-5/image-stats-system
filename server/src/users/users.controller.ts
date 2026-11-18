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
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateUserDto, ResetPwdDto, UpdateUserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@Controller('admin/users')
@Roles('admin')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: any) {
    return this.users.list(query);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateUserDto, @Ip() ip: string) {
    return this.users.create(user, dto, ip);
  }

  @Put(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Ip() ip: string,
  ) {
    return this.users.update(user, id, dto, ip);
  }

  @Post(':id/reset-pwd')
  resetPwd(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPwdDto,
    @Ip() ip: string,
  ) {
    return this.users.resetPwd(user, id, dto, ip);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Ip() ip: string,
  ) {
    return this.users.remove(user, id, ip);
  }
}
