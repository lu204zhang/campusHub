import type { NextFunction, Request, Response } from 'express';

import {
  listResources as listResourcesForTenant,
  type ListResourcesFilter,
} from '../services/resource.service';
import type { ErrorResponse } from '../types/reservation';
import type { Resource, ResourceType } from '../types/resource';

const TENANT_HEADER = 'x-tenant-id';
const RESOURCE_TYPES: readonly ResourceType[] = ['ROOM', 'EQUIPMENT', 'LAB'];

function getTenantId(request: Request): string | undefined {
  const header = request.headers[TENANT_HEADER];
  return typeof header === 'string' && header.length > 0 ? header : undefined;
}

function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
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
  let type: ResourceType | undefined;
  if (rawType !== undefined) {
    if (typeof rawType !== 'string' || rawType.length === 0) {
      response.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'type must be a non-empty string when provided.',
      });
      return;
    }

    if (!isResourceType(rawType)) {
      response.status(400).json({
        code: 'VALIDATION_ERROR',
        message: `type must be one of ${RESOURCE_TYPES.join(', ')}.`,
      });
      return;
    }

    type = rawType;
  }

  const rawIsAvailable: unknown = request.query.isAvailable;
  let isAvailable: boolean | undefined;
  if (rawIsAvailable !== undefined) {
    if (rawIsAvailable !== 'true' && rawIsAvailable !== 'false') {
      response.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'isAvailable must be either "true" or "false" when provided.',
      });
      return;
    }

    isAvailable = rawIsAvailable === 'true';
  }

  const filter: ListResourcesFilter = {};
  if (type !== undefined) {
    filter.type = type;
  }
  if (isAvailable !== undefined) {
    filter.isAvailable = isAvailable;
  }

  try {
    const resources = await listResourcesForTenant(tenantId, filter);
    response.status(200).json(resources);
  } catch (error) {
    next(error);
  }
}

export { listResources };
