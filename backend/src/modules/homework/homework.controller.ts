import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiHeader,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { UPLOAD_THROTTLE } from '~/common/throttling/throttle.constants';
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import {
  FileUpload,
  requireFile,
} from '~/modules/files/file-upload.interceptor';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import {
  PERMISSIONS,
  type PermissionKey,
} from '~/modules/rbac/permissions.catalog';
import {
  CreateHomeworkDto,
  FilterHomeworkDto,
  SetSubmissionsDto,
} from './dto/homework.dto';
import { HomeworkService } from './homework.service';

/** Homework and submissions; teachers see and set their own subjects'. */
@ApiTags('Tenant / Homework')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('homework')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HomeworkController {
  constructor(
    private readonly homework: HomeworkService,
    private readonly scope: AccessScope,
  ) {}

  private assigned(key: PermissionKey) {
    return this.scope.subjectAssignments(key);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.HOMEWORK_READ)
  @ResponseMessage('Homework')
  async list(@Query() filter: FilterHomeworkDto) {
    return this.homework.list(
      filter.sectionId,
      filter.from,
      await this.assigned(PERMISSIONS.HOMEWORK_READ),
    );
  }

  @Post()
  @RequirePermissions(PERMISSIONS.HOMEWORK_MANAGE)
  @ResponseMessage('Homework set')
  async create(@Body() dto: CreateHomeworkDto) {
    const scope = await this.assigned(PERMISSIONS.HOMEWORK_MANAGE);
    if (
      scope !== null &&
      !scope.some(
        (a) =>
          a.sectionId === dto.sectionId &&
          a.classSubjectId === dto.classSubjectId,
      )
    ) {
      // Not their subject in that section: as if it didn't exist.
      throw new NotFoundException('Subject not found');
    }
    return this.homework.create(dto);
  }

  /** Multipart `file`; pass its id in `attachmentFileIds`. */
  @Post('attachments')
  @RequirePermissions(PERMISSIONS.HOMEWORK_MANAGE)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(FileUpload('attachment'))
  @ApiConsumes('multipart/form-data')
  @ResponseMessage('Attachment uploaded')
  upload(@UploadedFile() file?: Express.Multer.File) {
    return this.homework.uploadAttachment(requireFile(file));
  }

  /** The sections and subjects the caller may set homework for. */
  @Get('options')
  @RequirePermissions(PERMISSIONS.HOMEWORK_MANAGE)
  @ResponseMessage('Homework options')
  async options() {
    return this.homework.options(
      await this.assigned(PERMISSIONS.HOMEWORK_MANAGE),
    );
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.HOMEWORK_READ)
  @ResponseMessage('Homework')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.homework.detail(
      id,
      await this.assigned(PERMISSIONS.HOMEWORK_READ),
    );
  }

  @Put(':id/submissions')
  @RequirePermissions(PERMISSIONS.HOMEWORK_MANAGE)
  @ResponseMessage('Submissions saved')
  async submissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSubmissionsDto,
  ) {
    return this.homework.setSubmissions(
      id,
      dto.enrollmentIds,
      await this.assigned(PERMISSIONS.HOMEWORK_MANAGE),
    );
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.HOMEWORK_MANAGE)
  @ResponseMessage('Homework removed')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.homework.remove(
      id,
      await this.assigned(PERMISSIONS.HOMEWORK_MANAGE),
    );
  }
}
