import { Schema, model, Types, type HydratedDocument, type Model } from 'mongoose';

type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

interface IReservation {
  tenantId: string;
  resourceId: Types.ObjectId;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
  createdAt: Date;
  updatedAt: Date;
}

type ReservationDocument = HydratedDocument<IReservation>;

const reservationSchema = new Schema<IReservation>(
  {
    tenantId: { type: String, required: true },
    resourceId: { type: Schema.Types.ObjectId, ref: 'Resource', required: true },
    userId: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'CONFIRMED', 'CANCELLED'],
      default: 'PENDING',
    },
  },
  { timestamps: true },
);

reservationSchema.index({ tenantId: 1, resourceId: 1, startTime: 1, endTime: 1 });
reservationSchema.index({ tenantId: 1, userId: 1 });

const ReservationModel: Model<IReservation> = model<IReservation>('Reservation', reservationSchema);

export {
  ReservationModel,
  reservationSchema,
  type IReservation,
  type ReservationDocument,
  type ReservationStatus,
};
