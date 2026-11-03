import type { NextFunction, Request, Response } from 'express';

import type { ErrorResponse } from '../types/reservation';

const TENANT_HEADER = 'x-tenant-id';

function requireTenantId(
  request: Request,
  response: Response<ErrorResponse>,
  next: NextFunction,
): void {
  const header = request.headers[TENANT_HEADER];
  const tenantId = typeof header === 'string' && header.length > 0 ? header : undefined;

  if (!tenantId) {
    response
      .status(400)
      .json({ code: 'TENANT_ID_REQUIRED', message: 'X-Tenant-Id header is required.' });
    return;
  }

  request.tenantId = tenantId;
  next();
}

export { requireTenantId };
