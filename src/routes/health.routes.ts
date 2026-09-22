import { Router, type Router as ExpressRouter } from 'express';

import { getHealth } from '../controllers/health.controller';

const healthRouter: ExpressRouter = Router();

healthRouter.get('/', getHealth);

export { healthRouter };
