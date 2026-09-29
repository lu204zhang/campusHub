import { Router, type Router as ExpressRouter } from 'express';

import { listResources } from '../controllers/resource.controller';

const resourceRouter: ExpressRouter = Router();

resourceRouter.get('/', listResources);

export { resourceRouter };
