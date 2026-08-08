import { useMemo, useState } from 'react';
import { Formik, Field, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { toFormikValidate } from '@/lib/formikZod';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useCategories } from '@/features/movies/hooks/useCategories';
import { useMovieDetail } from '@/features/movies/hooks/useMovieDetail';
import { useDirectorsCatalog } from '@/features/admin/directors/hooks/useDirectors';
import { useActorsCatalog } from '@/features/admin/actors/hooks/useActors';
import { useMovieCategoriesByMovieId } from '../hooks/useMovieCategoriesByMovieId';
import { useMovieDirectorsByMovieId } from '../hooks/useMovieDirectorsByMovieId';
import { useMovieActorsByMovieId } from '../hooks/useMovieActorsByMovieId';
import { useUpdateMovie } from '../hooks/useUpdateMovie';
import { closeEditModal } from '../store/adminMoviesSlice';
import { buildMovieSchema } from '../schemas/movie.schema';
import type { MovieActorDraft, MovieFormValues } from '../types/adminMovie.types';
import { ROUTES } from '@/constants/routes';

interface EditMovieFormValues extends MovieFormValues {
  categoryIds: number[];
  directorIds: number[];
  actors: MovieActorDraft[];
}

const emptyValues = (): EditMovieFormValues => ({
  name: '',
  avatar: '',
  premiere_date: '',
  description: '',
  country: '',
  trailer: '',
  producer: '',
  producerAvatar: '',
  status: 'ACTIVE',
  categoryIds: [],
  directorIds: [],
  actors: [],
});

function Edit() {
  const { t } = useTranslation('admin');
  const dispatch = useAppDispatch();
  const id = useAppSelector((state) => state.adminMovies.activeMovieId);
  const { data: cats = [] } = useCategories();
  const { data: directorsPage } = useDirectorsCatalog();
  const directors = directorsPage?.data ?? [];
  const { data: actorsPage } = useActorsCatalog();
  const actorsCatalog = actorsPage?.data ?? [];
  const { data: movie } = useMovieDetail(id ?? undefined);
  const { data: movieCategoryIds } = useMovieCategoriesByMovieId(id ?? undefined);
  const { data: movieDirectorLinks } = useMovieDirectorsByMovieId(id ?? undefined);
  const { data: movieActorLinks } = useMovieActorsByMovieId(id ?? undefined);
  const updateMovieMutation = useUpdateMovie();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [trailerFile, setTrailerFile] = useState<File | null>(null);
  const movieSchema = useMemo(() => buildMovieSchema(t), [t]);

  const handleCloseEdit = () => dispatch(closeEditModal());

  const initialValues: EditMovieFormValues = movie
    ? {
        name: movie.name,
        avatar: movie.avatar,
        premiere_date: movie.premiere_date,
        description: movie.description,
        country: movie.country,
        trailer: movie.trailer,
        producer: movie.producer ?? '',
        producerAvatar: movie.producerAvatar ?? '',
        status: movie.status ?? 'ACTIVE',
        categoryIds: movieCategoryIds ?? [],
        directorIds: movieDirectorLinks?.map((link) => link.director_id) ?? [],
        actors:
          movieActorLinks?.map((link) => ({
            actor_id: link.actor_id,
            character_name: link.character_name,
            is_lead: link.is_lead,
          })) ?? [],
      }
    : emptyValues();

  const handleSubmit = async (values: EditMovieFormValues) => {
    if (!id) return;
    const { categoryIds, directorIds, actors, ...form } = values;
    try {
      await updateMovieMutation.mutateAsync({ id, values: form, categoryIds, directorIds, actors, avatarFile, trailerFile });
      toast.success(t('movies.edit.toastSuccess'));
      handleCloseEdit();
      setTimeout(() => {
        window.location.href = ROUTES.adminMovies;
      }, 100);
    } catch (error) {
      console.log('Error adding product: ', error);
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <Modal open onClose={handleCloseEdit} title={t('movies.edit.title')}>
      <Formik<EditMovieFormValues>
        enableReinitialize
        initialValues={initialValues}
        validate={toFormikValidate<EditMovieFormValues>(movieSchema)}
        onSubmit={handleSubmit}
      >
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          const getError = (key: string) => (showErrors ? (formik.errors as Record<string, string>)[key] : undefined);

          const toggleCategory = (categoryId: number) => {
            const current = formik.values.categoryIds;
            formik.setFieldValue(
              'categoryIds',
              current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId],
            );
          };

          const toggleDirector = (directorId: number) => {
            const current = formik.values.directorIds;
            formik.setFieldValue(
              'directorIds',
              current.includes(directorId) ? current.filter((id) => id !== directorId) : [...current, directorId],
            );
          };

          const toggleActor = (actorId: number) => {
            const current = formik.values.actors;
            const exists = current.some((a) => a.actor_id === actorId);
            formik.setFieldValue(
              'actors',
              exists
                ? current.filter((a) => a.actor_id !== actorId)
                : [...current, { actor_id: actorId, character_name: '', is_lead: false }],
            );
          };

          const updateActorField = (actorId: number, field: 'character_name' | 'is_lead', value: string | boolean) => {
            formik.setFieldValue(
              'actors',
              formik.values.actors.map((a) => (a.actor_id === actorId ? { ...a, [field]: value } : a)),
            );
          };

          return (
            <Form method="post" encType="multipart/form-data">
              <Field
                as={Input}
                label={t('movies.edit.fields.name')}
                type="text"
                name="name"
                id="name"
                error={getError('name')}
              />
              <Input
                label={t('movies.edit.fields.avatar')}
                type="text"
                id="avatar"
                name="avatar"
                disabled
                value={formik.values.avatar}
                className="mt-4"
                error={getError('avatar')}
              />
              <Input
                label={t('movies.edit.fields.uploadNewAvatar')}
                type="file"
                name="up_avatar"
                className="mt-4"
                onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
              />
              <Field
                as={Input}
                label={t('movies.edit.fields.premiereDate')}
                type="date"
                name="premiere_date"
                id="premiere_date"
                className="mt-4"
                error={getError('premiere_date')}
              />
              <Field
                as={Input}
                label={t('movies.edit.fields.country')}
                type="text"
                name="country"
                id="country"
                className="mt-4"
                error={getError('country')}
              />
              <Field
                as={Textarea}
                label={t('movies.edit.fields.description')}
                rows={6}
                cols={50}
                name="description"
                id="description"
                className="mt-4"
                error={getError('description')}
              />
              <Input
                label={t('movies.edit.fields.trailer')}
                type="text"
                name="trailer"
                id="trailer"
                disabled
                value={formik.values.trailer}
                className="mt-4"
                error={getError('trailer')}
              />
              <Input
                label={t('movies.edit.fields.uploadNewTrailer')}
                type="file"
                name="up_trailer"
                accept="image/*,video/*"
                className="mt-4"
                onChange={(e) => setTrailerFile(e.target.files?.[0] ?? null)}
              />
              <Field
                as={Input}
                label={t('movies.edit.fields.producer')}
                type="text"
                name="producer"
                id="producer"
                className="mt-4"
                error={getError('producer')}
              />
              <Field
                as={Input}
                label={t('movies.edit.fields.producerAvatar')}
                type="text"
                name="producerAvatar"
                id="producerAvatar"
                className="mt-2 border-l-2 border-border pl-3"
                error={getError('producerAvatar')}
              />
              <Select
                label={t('movies.edit.fields.status')}
                name="status"
                id="status"
                className="mt-4"
                value={formik.values.status}
                onChange={(e) => formik.setFieldValue('status', e.target.value)}
                options={[
                  { label: t('movies.status.active'), value: 'ACTIVE' },
                  { label: t('movies.status.inactive'), value: 'INACTIVE' },
                ]}
              />

              <label className="mb-1 mt-5 block text-sm font-medium">{t('movies.edit.directors.label')}</label>
              <div className="flex flex-wrap gap-4">
                {directors.map((director) => (
                  <label key={director.id} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={formik.values.directorIds.includes(director.id)}
                      onChange={() => toggleDirector(director.id)}
                    />
                    <span>{director.full_name}</span>
                  </label>
                ))}
              </div>
              {getError('directorIds') && (
                <span className="mt-1 flex items-center gap-1 text-sm text-red-600">
                  <i className="fa-solid fa-circle-exclamation text-xs" />
                  {getError('directorIds')}
                </span>
              )}

              <label className="mb-1 mt-5 block text-sm font-medium">{t('movies.edit.cast.label')}</label>
              <div className="flex flex-col gap-2">
                {actorsCatalog.map((actor) => {
                  const selected = formik.values.actors.find((a) => a.actor_id === actor.id);
                  return (
                    <div key={actor.id} className="rounded-md border border-txt/10 p-3">
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={!!selected} onChange={() => toggleActor(actor.id)} />
                        <span>{actor.full_name}</span>
                      </label>
                      {selected && (
                        <div className="mt-2 flex flex-wrap items-center gap-3 pl-6">
                          <Input
                            label={t('movies.edit.cast.role')}
                            id={`actor-character-${actor.id}`}
                            type="text"
                            value={selected.character_name}
                            onChange={(e) => updateActorField(actor.id, 'character_name', e.target.value)}
                          />
                          <label className="flex items-center gap-1.5 text-sm">
                            <input
                              type="checkbox"
                              checked={selected.is_lead}
                              onChange={(e) => updateActorField(actor.id, 'is_lead', e.target.checked)}
                            />
                            <span>{t('movies.edit.cast.isLead')}</span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <label htmlFor="name" className="mb-1 mt-5 block text-sm font-medium">
                {t('movies.edit.category')}
              </label>
              <div className="flex flex-wrap gap-4">
                {cats.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      name="category"
                      id={String(cat.id)}
                      value={cat.name}
                      onChange={() => toggleCategory(cat.id)}
                      checked={formik.values.categoryIds.includes(cat.id)}
                    />
                    <span>{cat.name}</span>
                  </label>
                ))}
              </div>
              {getError('categoryIds') && (
                <span className="mt-1 flex items-center gap-1 text-sm text-red-600">
                  <i className="fa-solid fa-circle-exclamation text-xs" />
                  {getError('categoryIds')}
                </span>
              )}
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={updateMovieMutation.isPending}>
                  {t('movies.edit.submit')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
}
export default Edit;
