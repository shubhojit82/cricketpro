import {
  BadRequestException,
  Injectable,
  NestMiddleware,
  NotFoundException,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TenantContextService } from './tenant-context.service';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async use(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const headerValue = req.headers['x-tenant-id'];

    if (!headerValue) {
      throw new BadRequestException(
        'Missing required header: X-Tenant-Id',
      );
    }

    const tenantId = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;

    if (
      typeof tenantId !== 'string' ||
      tenantId.trim().length === 0
    ) {
      throw new BadRequestException(
        'Invalid X-Tenant-Id header',
      );
    }

    const validationResult =
      await this.tenantService.validateTenant(
        tenantId.trim(),
      );

    if (
      !validationResult.isValid ||
      !validationResult.tenant
    ) {
      throw new NotFoundException(
        `Tenant not found: ${tenantId}`,
      );
    }

    this.tenantContext.setTenant(
      validationResult.tenant,
    );

    next();
  }
}
