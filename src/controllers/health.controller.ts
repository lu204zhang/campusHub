import type { Request, Response } from 'express';

import { getHealthStatus, type HealthStatus } from '../services/health.service';

type HealthRequest = Request<Record<string, never>, HealthStatus>;
type HealthResponse = Response<HealthStatus>;

function getHealth(_request: HealthRequest, response: HealthResponse): void {
  const healthStatus: HealthStatus = getHealthStatus();

  response.status(200).json(healthStatus);
}

export { getHealth };
