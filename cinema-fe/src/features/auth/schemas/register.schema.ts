import { z } from 'zod';
import type { TFunction } from 'i18next';

export const buildRegisterSchema = (t: TFunction) =>
  z
    .object({
      email: z
        .string()
        .min(1, t('auth:register.validation.emailRequired'))
        .email(t('auth:register.validation.emailInvalid')),
      password: z
        .string()
        .min(8, t('auth:register.validation.passwordMin'))
        .regex(/[!@#$%^&*(),.?":{}|<>]/, t('auth:register.validation.passwordMin')),
      c_password: z.string().min(1, t('auth:register.validation.confirmPasswordRequired')),
    })
    .refine((data) => data.password === data.c_password, {
      message: t('auth:register.validation.passwordMismatch'),
      path: ['c_password'],
    });

export type RegisterFormValues = z.infer<ReturnType<typeof buildRegisterSchema>>;
