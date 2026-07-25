import { z } from 'zod';
import type { TFunction } from 'i18next';

export const buildLoginSchema = (t: TFunction) =>
  z.object({
    email: z.string().min(1, t('auth:login.validation.emailRequired')).email(t('auth:login.validation.emailInvalid')),
    password: z.string().min(1, t('auth:login.validation.passwordRequired')),
  });

export type LoginFormValues = z.infer<ReturnType<typeof buildLoginSchema>>;
