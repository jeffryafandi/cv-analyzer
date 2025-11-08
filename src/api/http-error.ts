/**
 * HTTP Error utility for standardizing error responses
 */

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Helper functions to create HTTP errors with standard status codes
 */
export const httpErrors = {
  badRequest: (message: string, details?: unknown) =>
    new HttpError(400, message, details),
  unauthorized: (message: string = "Unauthorized", details?: unknown) =>
    new HttpError(401, message, details),
  forbidden: (message: string = "Forbidden", details?: unknown) =>
    new HttpError(403, message, details),
  notFound: (message: string, details?: unknown) =>
    new HttpError(404, message, details),
  conflict: (message: string, details?: unknown) =>
    new HttpError(409, message, details),
  unprocessableEntity: (message: string, details?: unknown) =>
    new HttpError(422, message, details),
  internalServerError: (
    message: string = "Internal server error",
    details?: unknown
  ) => new HttpError(500, message, details),
};
