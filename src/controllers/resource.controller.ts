import type { NextFunction, Request, Response } from 'express';

import { listResources as listResourcesForTenant } from '../services/resource.service';
import type { ErrorResponse } from '../types/reservation';
import type { Resource } from '../types/resource';

const TENANT_HEADER = 'x-tenant-id';

function getTenantId(request: Request): string | undefined {
  const header = request.headers[TENANT_HEADER];
  return typeof header === 'string' && header.length > 0 ? header : undefined;
}

type ListResourcesRequest = Request<Record<string, never>, Resource[] | ErrorResponse>;
type ListResourcesResponse = Response<Resource[] | ErrorResponse>;

async function listResources(
  request: ListResourcesRequest,
  response: ListResourcesResponse,
  next: NextFunction,
): Promise<void> {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    response
      .status(400)
      .json({ code: 'TENANT_ID_REQUIRED', message: 'X-Tenant-Id header is required.' });
    return;
  }

  const rawType: unknown = request.query.type;
  let type: string | undefined;
  if (rawType !== undefined) {
    if (typeof rawType !== 'string' || rawType.length === 0) {
      response.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'type must be a non-empty string when provided.',
      });
      return;
    }
    type = rawType;
  }

  try {
    const resources = await listResourcesForTenant(tenantId, type);
    response.status(200).json(resources);
  } catch (error) {
    next(error);
  }
}

export { listResources };
