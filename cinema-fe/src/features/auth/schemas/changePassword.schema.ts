import { z } from 'zod';
import type { TFunction } from 'i18next';

export const buildChangePasswordSchema = (t: TFunction) =>
  z
    .object({
      currentPassword: z.string().min(1, t('auth:changePassword.validation.currentPasswordRequired')),
      newPassword: z
        .string()
        .min(8, t('auth:changePassword.validation.passwordMin'))
        .regex(/[!@#$%^&*(),.?":{}|<>]/, t('auth:changePassword.validation.passwordMin')),
      c_password: z.string().min(1, t('auth:changePassword.validation.confirmPasswordRequired')),
    })
    .refine((data) => data.newPassword === data.c_password, {
      message: t('auth:changePassword.validation.passwordMismatch'),
      path: ['c_password'],
    });

export type ChangePasswordFormValues = z.infer<ReturnType<typeof buildChangePasswordSchema>>;
