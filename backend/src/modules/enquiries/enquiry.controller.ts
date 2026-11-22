import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import {
  CreateEnquiryDto,
  FilterEnquiryDto,
  UpdateEnquiryDto,
} from './dto/enquiry.dto';
import { EnquiryService } from './enquiry.service';

/** Admission enquiries (the admissions desk). */
@ApiTags('Tenant / Enquiries')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('enquiries')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EnquiryController {
  constructor(private readonly enquiries: EnquiryService) {}

  /** Newest first, with how many are at each stage. */
  @Get()
  @RequirePermissions(PERMISSIONS.ENQUIRIES_READ)
  @ResponseMessage('Enquiries')
  list(@Query() filter: FilterEnquiryDto) {
    return this.enquiries.list(filter);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ENQUIRIES_MANAGE)
  @ResponseMessage('Enquiry added')
  create(@Body() dto: CreateEnquiryDto) {
    return this.enquiries.create(dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ENQUIRIES_READ)
  @ResponseMessage('Enquiry')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.enquiries.findById(id);
  }

  /** Follow-up, stage change, or linking the admitted student. */
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ENQUIRIES_MANAGE)
  @ResponseMessage('Enquiry updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnquiryDto,
  ) {
    return this.enquiries.update(id, dto);
  }
}
