import type { Request, Response, NextFunction } from "express";
import type { ErrorResponse } from "./types.js";

export class ApiError extends Error {
  status: number;
  errorCode: string;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    errorCode: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export function badRequest(message: string, details?: Record<string, unknown>): ApiError {
  return new ApiError(400, "bad_request", message, details);
}

export function notFound(message: string, details?: Record<string, unknown>): ApiError {
  return new ApiError(404, "not_found", message, details);
}

export function errorHandler(err: unknown, _req: Request, res: Response<ErrorResponse>, _next: NextFunction): void {
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      console.error("ApiError", {
        status: err.status,
        error: err.errorCode,
        message: err.message,
        details: err.details,
      });
    }

    res.status(err.status).json({
      error: err.errorCode,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: "internal_error",
    message: "unexpected server error",
  });
}
