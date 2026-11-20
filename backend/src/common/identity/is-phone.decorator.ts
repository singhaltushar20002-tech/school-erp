import { registerDecorator, ValidationOptions } from 'class-validator';
import { normalizePhone } from './identifier';

/** A phone number `normalizePhone` accepts (Indian or BD local, or E.164). */
export function IsPhone(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isPhone',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a valid phone number (e.g. 9876543210 or +919876543210)`,
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && normalizePhone(value) !== null,
      },
    });
}
