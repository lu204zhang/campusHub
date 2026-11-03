import express, { type Express } from 'express';

import { connectToDatabase } from './config/database';
import { getPort } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health.routes';
import { reservationRouter } from './routes/reservation.routes';
import { resourceRouter } from './routes/resource.routes';

const app: Express = express();
const port: number = getPort();

app.use(express.json());
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/reservations', reservationRouter);
app.use('/api/v1/resources', resourceRouter);

app.use(errorHandler);

connectToDatabase()
  .then((): void => {
    app.listen(port, (): void => {
      console.log(`CampusHub API listening on port ${port}`);
    });
  })
  .catch((error: unknown): void => {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  });
