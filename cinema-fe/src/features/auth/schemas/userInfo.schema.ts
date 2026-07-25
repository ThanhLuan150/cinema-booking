import { z } from 'zod';
import type { TFunction } from 'i18next';

export const buildUserInfoSchema = (t: TFunction) =>
  z.object({
    name: z.string().regex(/^[\p{L}\s]*$/u, t('auth:userInfo.validation.nameInvalid')),
    phone: z.string().regex(/^[0-9]{10}$/, t('auth:userInfo.validation.phoneInvalid')),
  });

export type UserInfoFormValues = z.infer<ReturnType<typeof buildUserInfoSchema>>;
