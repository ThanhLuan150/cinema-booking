import { z } from 'zod';
import type { TFunction } from 'i18next';

export const buildCinemaInfoSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(1, t('auth:cinemaInfo.validation.nameRequired')),
    address: z.string().min(1, t('auth:cinemaInfo.validation.addressRequired')),
    city: z.string().min(1, t('auth:cinemaInfo.validation.cityRequired')),
  });

export type CinemaInfoFormValues = z.infer<ReturnType<typeof buildCinemaInfoSchema>>;
