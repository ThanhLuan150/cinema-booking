import { z } from 'zod';
import type { TFunction } from 'i18next';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const URL_REGEX = /^https?:\/\/.+/i;

export const buildMovieSchema = (t: TFunction) =>
  z.object({
    name: z.string().trim().min(1, t('admin:movies.validation.nameRequired')),
    avatar: z.string().trim().min(1, t('admin:movies.validation.avatarRequired')),
    premiere_date: z
      .string()
      .min(1, t('admin:movies.validation.premiereDateRequired'))
      .regex(DATE_REGEX, t('admin:movies.validation.premiereDateInvalid')),
    description: z.string().trim().min(1, t('admin:movies.validation.descriptionRequired')),
    country: z.string().trim().min(1, t('admin:movies.validation.countryRequired')),
    trailer: z.string().trim().min(1, t('admin:movies.validation.trailerRequired')),
    producer: z.string().trim().min(1, t('admin:movies.validation.producerRequired')),
    director: z.string().trim().min(1, t('admin:movies.validation.directorRequired')),
    cast: z.array(
      z.object({
        name: z.string().trim().min(1, t('admin:movies.validation.castNameRequired')),
        role: z.string(),
        avatar: z.string().refine((value) => !value.trim() || URL_REGEX.test(value.trim()), {
          message: t('admin:movies.validation.castAvatarInvalid'),
        }),
      }),
    ),
    categoryIds: z.array(z.number()).min(1, t('admin:movies.validation.categoryRequired')),
  });

export type MovieSchemaValues = z.infer<ReturnType<typeof buildMovieSchema>>;
