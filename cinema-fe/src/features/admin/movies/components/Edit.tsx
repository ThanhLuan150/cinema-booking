import { useMemo, useState } from 'react';
import { Formik, Field, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { toFormikValidate } from '@/lib/formikZod';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useCategories } from '@/features/movies/hooks/useCategories';
import { useMovieDetail } from '@/features/movies/hooks/useMovieDetail';
import { useMovieCategoriesByMovieId } from '../hooks/useMovieCategoriesByMovieId';
import { useUpdateMovie } from '../hooks/useUpdateMovie';
import { closeEditModal } from '../store/adminMoviesSlice';
import { buildMovieSchema } from '../schemas/movie.schema';
import type { CastMemberDraft, MovieFormValues } from '../types/adminMovie.types';
import { ROUTES } from '@/constants/routes';

interface EditMovieFormValues extends MovieFormValues {
  categoryIds: number[];
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
  director: '',
  directorAvatar: '',
  cast: [],
  categoryIds: [],
});

function Edit() {
  const { t } = useTranslation('admin');
  const dispatch = useAppDispatch();
  const id = useAppSelector((state) => state.adminMovies.activeMovieId);
  const { data: cats = [] } = useCategories();
  const { data: movie } = useMovieDetail(id ?? undefined);
  const { data: movieCategoryIds } = useMovieCategoriesByMovieId(id ?? undefined);
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
        director: movie.director ?? '',
        directorAvatar: movie.directorAvatar ?? '',
        cast:
          movie.cast?.map((member) => ({
            name: member.name,
            role: member.role ?? '',
            avatar: member.avatar ?? '',
            isLead: member.isLead ?? false,
          })) ?? [],
        categoryIds: movieCategoryIds ?? [],
      }
    : emptyValues();

  const handleSubmit = async (values: EditMovieFormValues) => {
    if (!id) return;
    const { categoryIds, ...form } = values;
    try {
      await updateMovieMutation.mutateAsync({ id, values: form, categoryIds, avatarFile, trailerFile });
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

          const updateCastRow = (index: number, field: keyof CastMemberDraft, value: string) => {
            const cast = formik.values.cast.map((member, i) => (i === index ? { ...member, [field]: value } : member));
            formik.setFieldValue('cast', cast);
          };

          const addCastRow = () => {
            formik.setFieldValue('cast', [...formik.values.cast, { name: '', role: '', avatar: '', isLead: false }]);
          };

          const toggleCastLead = (index: number) => {
            const cast = formik.values.cast.map((member, i) =>
              i === index ? { ...member, isLead: !member.isLead } : member,
            );
            formik.setFieldValue('cast', cast);
          };

          const removeCastRow = (index: number) => {
            formik.setFieldValue(
              'cast',
              formik.values.cast.filter((_, i) => i !== index),
            );
          };

          const toggleCategory = (categoryId: number) => {
            const current = formik.values.categoryIds;
            formik.setFieldValue(
              'categoryIds',
              current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId],
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
                className="mt-3"
                error={getError('avatar')}
              />
              <Input
                label={t('movies.edit.fields.uploadNewAvatar')}
                type="file"
                name="up_avatar"
                className="mt-3"
                onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
              />
              <Field
                as={Input}
                label={t('movies.edit.fields.premiereDate')}
                type="date"
                name="premiere_date"
                id="premiere_date"
                className="mt-3"
                error={getError('premiere_date')}
              />
              <Field
                as={Input}
                label={t('movies.edit.fields.country')}
                type="text"
                name="country"
                id="country"
                className="mt-3"
                error={getError('country')}
              />
              <Field
                as={Textarea}
                label={t('movies.edit.fields.description')}
                rows={6}
                cols={50}
                name="description"
                id="description"
                className="mt-3"
                error={getError('description')}
              />
              <Input
                label={t('movies.edit.fields.trailer')}
                type="text"
                name="trailer"
                id="trailer"
                disabled
                value={formik.values.trailer}
                className="mt-3"
                error={getError('trailer')}
              />
              <Input
                label={t('movies.edit.fields.uploadNewTrailer')}
                type="file"
                name="up_trailer"
                accept="image/*,video/*"
                className="mt-3"
                onChange={(e) => setTrailerFile(e.target.files?.[0] ?? null)}
              />
              <Field
                as={Input}
                label={t('movies.edit.fields.producer')}
                type="text"
                name="producer"
                id="producer"
                className="mt-3"
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
              <Field
                as={Input}
                label={t('movies.edit.fields.director')}
                type="text"
                name="director"
                id="director"
                className="mt-5"
                error={getError('director')}
              />
              <Field
                as={Input}
                label={t('movies.edit.fields.directorAvatar')}
                type="text"
                name="directorAvatar"
                id="directorAvatar"
                className="mt-2 border-l-2 border-border pl-3"
                error={getError('directorAvatar')}
              />

              <label className="mb-1 mt-5 block text-sm font-medium">{t('movies.edit.cast.label')}</label>
              <div className="flex flex-col gap-4">
                {formik.values.cast.map((member, index) => (
                  <div key={index} className="flex flex-col gap-2 rounded-md border border-txt/10 p-3">
                    <Input
                      label={t('movies.edit.cast.name')}
                      type="text"
                      value={member.name}
                      onChange={(e) => updateCastRow(index, 'name', e.target.value)}
                      error={getError(`cast.${index}.name`)}
                    />
                    <Input
                      label={t('movies.edit.cast.role')}
                      type="text"
                      value={member.role}
                      onChange={(e) => updateCastRow(index, 'role', e.target.value)}
                    />
                    <Input
                      label={t('movies.edit.cast.avatarUrl')}
                      type="text"
                      value={member.avatar}
                      onChange={(e) => updateCastRow(index, 'avatar', e.target.value)}
                      error={getError(`cast.${index}.avatar`)}
                    />
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={member.isLead} onChange={() => toggleCastLead(index)} />
                      <span>{t('movies.edit.cast.isLead')}</span>
                    </label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeCastRow(index)} className="self-end">
                      {t('movies.edit.cast.remove')}
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="secondary" size="sm" onClick={addCastRow} className="self-start">
                  {t('movies.edit.cast.add')}
                </Button>
              </div>

              <label htmlFor="name" className="mb-1 mt-3 block text-sm font-medium">
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
