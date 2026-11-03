import { Router, type Router as ExpressRouter } from 'express';

import { listResources } from '../controllers/resource.controller';
import { requireTenantId } from '../middleware/requireTenantId';

const resourceRouter: ExpressRouter = Router();

resourceRouter.use(requireTenantId);

resourceRouter.get('/', listResources);

export { resourceRouter };
