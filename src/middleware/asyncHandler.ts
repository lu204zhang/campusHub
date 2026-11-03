import type { NextFunction, Request, RequestHandler, Response } from 'express';

function asyncHandler<
  Params = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, string>,
>(
  handler: (
    request: Request<Params, ResBody, ReqBody, ReqQuery>,
    response: Response<ResBody>,
    next: NextFunction,
  ) => Promise<void>,
): RequestHandler<Params, ResBody, ReqBody, ReqQuery> {
  return (request, response, next) => {
    handler(request, response, next).catch(next);
  };
}

export { asyncHandler };
