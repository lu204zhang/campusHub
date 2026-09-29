import express, { type ErrorRequestHandler, type Express } from 'express';

import { healthRouter } from './routes/health.routes';
import { reservationRouter } from './routes/reservation.routes';
import { resourceRouter } from './routes/resource.routes';

const app: Express = express();
const port: number = Number(process.env.PORT ?? 3000);

app.use(express.json());
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/reservations', reservationRouter);
app.use('/api/v1/resources', resourceRouter);

const handleUnexpectedError: ErrorRequestHandler = (_error, _request, response, _next): void => {
  response.status(500).json({
    error: 'Internal server error',
  });
};

app.use(handleUnexpectedError);

app.listen(port, (): void => {
  console.log(`CampusHub API listening on port ${port}`);
});
