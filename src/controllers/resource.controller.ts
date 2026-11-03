import { asyncHandler } from '../middleware/asyncHandler';
import {
  listResources as listResourcesForTenant,
  type ListResourcesFilter,
} from '../services/resource.service';
import type { ErrorResponse } from '../types/reservation';
import type { Resource, ResourceType } from '../types/resource';

const RESOURCE_TYPES: readonly ResourceType[] = ['ROOM', 'EQUIPMENT', 'LAB'];

function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
}

const listResources = asyncHandler<Record<string, never>, Resource[] | ErrorResponse>(
  async (request, response) => {
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

    const resources = await listResourcesForTenant(request.tenantId, filter);
    response.status(200).json(resources);
  },
);

export { listResources };
