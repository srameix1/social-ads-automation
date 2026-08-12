import { createError } from '../middleware/errorHandler';

const DEFAULT_MAX_LENGTH = 1000;

/**
 * Validates an optional free-text field: if present, must be a string within
 * maxLength. Throws a 400 AppError otherwise (caught by the controller's
 * existing try/catch -> next(err) -> errorHandler). Returns the value
 * unchanged so it can replace the raw destructured field inline.
 */
export function validateTextField(
  value: unknown,
  fieldName: string,
  maxLength: number = DEFAULT_MAX_LENGTH,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw createError(`El campo ${fieldName} debe ser texto`, 400);
  }
  if (value.length > maxLength) {
    throw createError(`El campo ${fieldName} no puede superar los ${maxLength} caracteres`, 400);
  }
  return value;
}
