interface Resource {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export { type Resource };
