import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '~/common/decorators/response.decorators';
import { JwtAuthGuard } from '~/modules/auth/guards/jwt-auth.guard';
import { RequireModule } from '~/modules/plans/decorators/require-module.decorator';
import { PLAN_MODULES } from '~/modules/plans/plans.catalog';
import { RequirePermissions } from '~/modules/rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '~/modules/rbac/guards/permissions.guard';
import { PERMISSIONS } from '~/modules/rbac/permissions.catalog';
import {
  AddCopiesDto,
  CreateBookDto,
  FilterBooksDto,
  FilterIssuesDto,
  IssueDto,
} from './library.dto';
import { LibraryService } from './library.service';

/** The library catalogue, issue and return, and late fines. */
@ApiTags('Tenant / Library')
@ApiBearerAuth('tenant-jwt')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant identifier',
})
@Controller('library')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule(PLAN_MODULES.LIBRARY)
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('books')
  @RequirePermissions(PERMISSIONS.LIBRARY_READ)
  @ResponseMessage('Books')
  books(@Query() q: FilterBooksDto) {
    return this.library.listBooks(q.q);
  }

  @Post('books')
  @RequirePermissions(PERMISSIONS.LIBRARY_MANAGE)
  @ResponseMessage('Book added')
  addBook(@Body() dto: CreateBookDto) {
    return this.library.addBook(dto);
  }

  @Post('books/:id/copies')
  @RequirePermissions(PERMISSIONS.LIBRARY_MANAGE)
  @ResponseMessage('Copies added')
  addCopies(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddCopiesDto) {
    return this.library.addCopies(id, dto.count);
  }

  @Get('issues')
  @RequirePermissions(PERMISSIONS.LIBRARY_READ)
  @ResponseMessage('Loans')
  issues(@Query() q: FilterIssuesDto) {
    return this.library.listIssues(q.status);
  }

  @Post('issues')
  @RequirePermissions(PERMISSIONS.LIBRARY_MANAGE)
  @ResponseMessage('Book issued')
  issue(@Body() dto: IssueDto) {
    return this.library.issue(dto);
  }

  /** A late return's fine is billed to the student's fees. */
  @Post('issues/:id/return')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.LIBRARY_MANAGE)
  @ResponseMessage('Book returned')
  returnBook(@Param('id', ParseUUIDPipe) id: string) {
    return this.library.return(id);
  }
}
