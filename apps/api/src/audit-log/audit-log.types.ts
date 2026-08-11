import type { Prisma } from '@prisma/client';

export interface AuditLogRecordInput {
  tenantId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  payload?: Prisma.InputJsonValue | null;
  correlationId?: string;
}

export class AuditLogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditLogValidationError';
  }
}
