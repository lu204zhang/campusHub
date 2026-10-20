import { ResourceModel, type ResourceDocument } from '../models/Resource.model';
import type { Resource, ResourceType } from '../types/resource';

function toResource(document: ResourceDocument): Resource {
  return {
    id: document._id.toString(),
    tenantId: document.tenantId,
    name: document.name,
    type: document.type,
    location: document.location,
    isAvailable: document.isAvailable,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

interface ListResourcesFilter {
  type?: ResourceType;
  isAvailable?: boolean;
}

async function listResources(tenantId: string, filter: ListResourcesFilter): Promise<Resource[]> {
  const query: { tenantId: string; type?: ResourceType; isAvailable?: boolean } = { tenantId };
  if (filter.type !== undefined) {
    query.type = filter.type;
  }
  if (filter.isAvailable !== undefined) {
    query.isAvailable = filter.isAvailable;
  }

  const documents = await ResourceModel.find(query).sort({ name: 1 });
  return documents.map(toResource);
}

export { listResources, type ListResourcesFilter };
