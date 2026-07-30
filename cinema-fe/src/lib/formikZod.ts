import type { ZodTypeAny } from 'zod';
import type { FormikErrors } from 'formik';

export const toFormikValidate = <T extends object>(schema: ZodTypeAny) => {
  return (values: T): FormikErrors<T> => {
    const result = schema.safeParse(values);
    if (result.success) return {};

    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      if (path && !errors[path]) {
        errors[path] = issue.message;
      }
    }
    return errors as FormikErrors<T>;
  };
};
