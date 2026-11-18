import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CategoriesAdminController, CategoriesPublicController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [AuditModule],
  controllers: [CategoriesPublicController, CategoriesAdminController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
