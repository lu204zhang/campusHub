import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

type ResourceType = 'ROOM' | 'EQUIPMENT' | 'LAB';

interface IResource {
  tenantId: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type ResourceDocument = HydratedDocument<IResource>;

const resourceSchema = new Schema<IResource>(
  {
    tenantId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ['ROOM', 'EQUIPMENT', 'LAB'] },
    location: { type: String, required: true, trim: true },
    isAvailable: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

resourceSchema.index({ tenantId: 1, type: 1 });

const ResourceModel: Model<IResource> = model<IResource>('Resource', resourceSchema);

export { ResourceModel, resourceSchema, type IResource, type ResourceDocument, type ResourceType };
