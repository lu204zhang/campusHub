import { Router, type Router as ExpressRouter } from 'express';

import {
  cancelReservation,
  createReservation,
  listReservationsByUser,
  updateReservationStatus,
} from '../controllers/reservation.controller';
import { requireTenantId } from '../middleware/requireTenantId';

const reservationRouter: ExpressRouter = Router();

reservationRouter.use(requireTenantId);

reservationRouter.post('/', createReservation);
reservationRouter.get('/user/:userId', listReservationsByUser);
reservationRouter.patch('/:id/cancel', cancelReservation);
reservationRouter.patch('/:id/status', updateReservationStatus);

export { reservationRouter };
