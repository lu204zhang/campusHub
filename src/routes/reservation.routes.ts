import { Router, type Router as ExpressRouter } from 'express';

import { createReservation, listReservationsByUser } from '../controllers/reservation.controller';

const reservationRouter: ExpressRouter = Router();

reservationRouter.post('/', createReservation);
reservationRouter.get('/user/:userId', listReservationsByUser);

export { reservationRouter };
