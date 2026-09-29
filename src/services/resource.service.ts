import type { Resource } from '../types/resource';

const resourcesByTenant = new Map<string, Resource[]>();

function seedTenantResources(tenantId: string): Resource[] {
  const now = new Date().toISOString();
  const seeded: Resource[] = [
    {
      id: 'room-101',
      tenantId,
      name: 'Room 101',
      type: 'room',
      description: 'General-purpose classroom, seats 40.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'projector-01',
      tenantId,
      name: 'Portable Projector',
      type: 'equipment',
      description: null,
      createdAt: now,
      updatedAt: now,
    },
  ];

  resourcesByTenant.set(tenantId, seeded);
  return seeded;
}

function getTenantResources(tenantId: string): Resource[] {
  return resourcesByTenant.get(tenantId) ?? seedTenantResources(tenantId);
}

async function listResources(tenantId: string, type: string | undefined): Promise<Resource[]> {
  const resources = getTenantResources(tenantId);
  if (type === undefined) {
    return resources;
  }

  return resources.filter((resource) => resource.type === type);
}

export { listResources };
