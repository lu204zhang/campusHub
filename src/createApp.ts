import express, { type Express } from 'express';

import { errorHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health.routes';
import { reservationRouter } from './routes/reservation.routes';
import { resourceRouter } from './routes/resource.routes';

function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/reservations', reservationRouter);
  app.use('/api/v1/resources', resourceRouter);

  app.use(errorHandler);

  return app;
}

export { createApp };
