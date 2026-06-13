import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    timestamp: string;
    requestId: string;
  };
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function successResponse<T>(
  data: T,
  meta?: Omit<PaginationMeta, 'totalPages'>
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      ...meta,
      timestamp: new Date().toISOString(),
      requestId: (global as any).__requestId || uuidv4(),
    },
  };
}

export function errorResponse(
  code: string,
  message: string,
  details?: any
): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: (global as any).__requestId || uuidv4(),
    },
  };
}

export function paginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta
): ApiResponse<T[]> {
  return {
    success: true,
    data,
    meta: {
      ...pagination,
      timestamp: new Date().toISOString(),
      requestId: (global as any).__requestId || uuidv4(),
    },
  };
}

export function sendSuccess(
  res: Response,
  data: any,
  statusCode: number = 200,
  meta?: any
) {
  res.status(statusCode).json(successResponse(data, meta));
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 500,
  details?: any
) {
  res.status(statusCode).json(errorResponse(code, message, details));
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: any) => Promise<any>
) {
  return (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
