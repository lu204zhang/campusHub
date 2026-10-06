type ResourceType = 'ROOM' | 'EQUIPMENT' | 'LAB';

interface Resource {
  id: string;
  tenantId: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export { type Resource, type ResourceType };
