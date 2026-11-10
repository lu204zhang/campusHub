import type { Express } from 'express';

import { connectToDatabase } from './config/database';
import { getPort } from './config/env';
import { createApp } from './createApp';

const app: Express = createApp();
const port: number = getPort();

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
