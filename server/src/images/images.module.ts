import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ImagesAdminController, ImagesUserController } from './images.controller';
import { ImagesService } from './images.service';

@Module({
  imports: [AuditModule],
  controllers: [ImagesUserController, ImagesAdminController],
  providers: [ImagesService],
})
export class ImagesModule {}
