import { useMemo, useRef, useState } from 'react';
import { Formik, Field, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/features/notifications/toast';
import { toFormikValidate } from '@/lib/formikZod';
import { useAppDispatch } from '@/hooks/redux';
import { useCategories } from '@/features/movies/hooks/useCategories';
import { useDirectorsCatalog } from '@/features/admin/directors/hooks/useDirectors';
import { useActorsCatalog } from '@/features/admin/actors/hooks/useActors';
import { useCreateMovie } from '../hooks/useCreateMovie';
import { closeAddModal } from '../store/adminMoviesSlice';
import { buildMovieSchema } from '../schemas/movie.schema';
import type { MovieActorDraft, MovieFormValues } from '../types/adminMovie.types';

interface AddMovieFormValues extends MovieFormValues {
  categoryIds: number[];
  directorIds: number[];
  actors: MovieActorDraft[];
}

const emptyValues = (): AddMovieFormValues => ({
  name: '',
  avatar: '',
  duration: '',
  premiere_date: '',
  description: '',
  country: '',
  trailer: '',
  producer: '',
  producerAvatar: '',
  categoryIds: [],
  directorIds: [],
  actors: [],
});

const Add = () => {
  const { t } = useTranslation('admin');
  const dispatch = useAppDispatch();
  const { data: cats = [] } = useCategories();
  const { data: directorsPage } = useDirectorsCatalog();
  const directors = directorsPage?.data ?? [];
  const { data: actorsPage } = useActorsCatalog();
  const actorsCatalog = actorsPage?.data ?? [];
  const createMovieMutation = useCreateMovie();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const trailerInputRef = useRef<HTMLInputElement>(null);
  const producerAvatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [trailerFile, setTrailerFile] = useState<File | null>(null);
  const [producerAvatarFile, setProducerAvatarFile] = useState<File | null>(null);
  const movieSchema = useMemo(() => buildMovieSchema(t), [t]);

  const handleCloseAdd = () => dispatch(closeAddModal());

  const handleSubmit = async (values: AddMovieFormValues) => {
    const { categoryIds, directorIds, actors, ...form } = values;
    try {
      await createMovieMutation.mutateAsync({
        ...form,
        categoryIds,
        directorIds,
        actors,
        avatarFile,
        trailerFile,
        producerAvatarFile,
      });
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      if (trailerInputRef.current) trailerInputRef.current.value = '';
      if (producerAvatarInputRef.current) producerAvatarInputRef.current.value = '';
      setAvatarFile(null);
      setTrailerFile(null);
      setProducerAvatarFile(null);
      toast.success(t('movies.add.toastSuccess'));
      handleCloseAdd();
    } catch (error) {
      console.log(error);
      toast.error(t('movies.add.toastError'));
    }
  };

  return (
    <Modal open onClose={handleCloseAdd} title={t('movies.add.title')}>
      <Formik<AddMovieFormValues>
        initialValues={emptyValues()}
        validate={toFormikValidate<AddMovieFormValues>(movieSchema)}
        onSubmit={handleSubmit}
      >
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          const getError = (key: string) => (showErrors ? (formik.errors as Record<string, string>)[key] : undefined);

          const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0] ?? null;
            setAvatarFile(file);
            formik.setFieldValue('avatar', file ? file.name : '');
          };

          const handleTrailerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0] ?? null;
            setTrailerFile(file);
            formik.setFieldValue('trailer', file ? file.name : '');
          };

          const handleProducerAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0] ?? null;
            setProducerAvatarFile(file);
            formik.setFieldValue('producerAvatar', file ? file.name : '');
          };

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
            <Form encType="multipart/form-data">
              <Field
                as={Input}
                label={t('movies.add.fields.name')}
                type="text"
                name="name"
                id="name"
                error={getError('name')}
              />
              <Input
                label={t('movies.add.fields.avatar')}
                type="file"
                name="avatar"
                id="avatar"
                ref={avatarInputRef}
                onChange={handleAvatarChange}
                className="mt-4"
                error={getError('avatar')}
              />
              <Field
                as={Input}
                label={t('movies.add.fields.duration')}
                type="number"
                name="duration"
                id="duration"
                className="mt-4"
                error={getError('duration')}
              />
              <Field
                as={Input}
                label={t('movies.add.fields.premiereDate')}
                type="date"
                name="premiere_date"
                id="premiere_date"
                className="mt-4"
                error={getError('premiere_date')}
              />
              <Field
                as={Input}
                label={t('movies.add.fields.country')}
                type="text"
                name="country"
                id="country"
                className="mt-4"
                error={getError('country')}
              />
              <Field
                as={Textarea}
                label={t('movies.add.fields.description')}
                name="description"
                id="description"
                className="mt-4"
                error={getError('description')}
              />
              <Input
                label={t('movies.add.fields.trailer')}
                type="file"
                name="trailer"
                accept="image/*,video/*"
                ref={trailerInputRef}
                onChange={handleTrailerChange}
                className="mt-4"
                error={getError('trailer')}
              />
              <Field
                as={Input}
                label={t('movies.add.fields.producer')}
                type="text"
                name="producer"
                id="producer"
                className="mt-4"
                error={getError('producer')}
              />
              <Input
                label={t('movies.add.fields.producerAvatar')}
                type="file"
                name="producerAvatar"
                accept="image/*"
                ref={producerAvatarInputRef}
                onChange={handleProducerAvatarChange}
                className="mt-2 border-l-2 border-border pl-3"
                error={getError('producerAvatar')}
              />

              <label className="mb-1 mt-5 block text-sm font-medium">{t('movies.add.directors.label')}</label>
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

              <label className="mb-1 mt-5 block text-sm font-medium">{t('movies.add.cast.label')}</label>
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
                            label={t('movies.add.cast.role')}
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
                            <span>{t('movies.add.cast.isLead')}</span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <label htmlFor="name" className="mb-1 mt-5 block text-sm font-medium">
                {t('movies.add.category')}
              </label>
              <div className="flex flex-wrap gap-4">
                {cats.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      name={cat.name}
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
                <Button type="submit" variant="danger" loading={createMovieMutation.isPending}>
                  {t('movies.add.submit')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
};
export default Add;
