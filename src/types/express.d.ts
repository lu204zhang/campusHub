import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireTenantId before any route handler that depends on it runs. */
      tenantId: string;
    }
  }
}

export {};
