import { z } from 'zod';
import type { TFunction } from 'i18next';

export const buildForgotPasswordSchema = (t: TFunction) =>
  z.object({
    email: z
      .string()
      .min(1, t('auth:forgotPassword.validation.emailRequired'))
      .email(t('auth:forgotPassword.validation.emailInvalid')),
  });

export type ForgotPasswordFormValues = z.infer<ReturnType<typeof buildForgotPasswordSchema>>;
