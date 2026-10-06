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

async function listResources(
  tenantId: string,
  type: ResourceType | undefined,
): Promise<Resource[]> {
  const filter: { tenantId: string; type?: ResourceType } = { tenantId };
  if (type !== undefined) {
    filter.type = type;
  }

  const documents = await ResourceModel.find(filter).sort({ name: 1 });
  return documents.map(toResource);
}

export { listResources };
