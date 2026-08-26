import { ValidationError } from 'class-validator';

export type ValidationFieldError = {
  field: string;
  message: string;
};

export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): ValidationFieldError[] {
  const details: ValidationFieldError[] = [];

  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        if (typeof message === 'string' && message.length > 0) {
          details.push({ field, message });
        }
      }
    }

    if (error.children?.length) {
      details.push(...flattenValidationErrors(error.children, field));
    }
  }

  return details;
}
