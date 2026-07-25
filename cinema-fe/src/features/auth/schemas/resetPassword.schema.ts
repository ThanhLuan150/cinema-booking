import { z } from 'zod';
import type { TFunction } from 'i18next';

export const buildResetPasswordSchema = (t: TFunction) =>
  z
    .object({
      otp: z.string().min(1, t('auth:resetPassword.validation.otpRequired')),
      password: z
        .string()
        .min(8, t('auth:resetPassword.validation.passwordMin'))
        .regex(/[!@#$%^&*(),.?":{}|<>]/, t('auth:resetPassword.validation.passwordMin')),
      c_password: z.string().min(1, t('auth:resetPassword.validation.confirmPasswordRequired')),
    })
    .refine((data) => data.password === data.c_password, {
      message: t('auth:resetPassword.validation.passwordMismatch'),
      path: ['c_password'],
    });

export type ResetPasswordFormValues = z.infer<ReturnType<typeof buildResetPasswordSchema>>;
