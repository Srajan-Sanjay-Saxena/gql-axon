import { AppError } from "../app.error.base.js";

export class ValidationError extends AppError {
  constructor(rawZodError: any) {
    super('Invalid input provided', 'BAD_USER_INPUT', 400, true, rawZodError);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, rawError?: any) {
    super(message, 'BAD_REQUEST', 400, true, rawError);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, rawError?: any) {
    super(message, 'NOT_FOUND', 404, true, rawError);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'This resource already exists.', rawError?: any) {
    super(message, 'CONFLICT', 409, true, rawError);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string, rawError?: any) {
    super(message, 'INTERNAL_SERVER_ERROR', 500, false, rawError);
  }
}