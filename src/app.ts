import express, { type ErrorRequestHandler, type Express } from 'express';

import { healthRouter } from './routes/health.routes';

const app: Express = express();
const port: number = Number(process.env.PORT ?? 3000);

app.use(express.json());
app.use('/api/v1/health', healthRouter);

const handleUnexpectedError: ErrorRequestHandler = (_error, _request, response, _next): void => {
  response.status(500).json({
    error: 'Internal server error',
  });
};

app.use(handleUnexpectedError);

app.listen(port, (): void => {
  console.log(`CampusHub API listening on port ${port}`);
});
