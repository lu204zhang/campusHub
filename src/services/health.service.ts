interface HealthStatus {
  status: 'ok';
  timestamp: string;
}

function getHealthStatus(): HealthStatus {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
}

export { getHealthStatus, type HealthStatus };
