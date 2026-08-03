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
import { useCreateMovie } from '../hooks/useCreateMovie';
import { closeAddModal } from '../store/adminMoviesSlice';
import { buildMovieSchema } from '../schemas/movie.schema';
import type { CastMemberDraft, MovieFormValues } from '../types/adminMovie.types';

interface AddMovieFormValues extends MovieFormValues {
  categoryIds: number[];
}

const emptyValues = (): AddMovieFormValues => ({
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

const Add = () => {
  const { t } = useTranslation('admin');
  const dispatch = useAppDispatch();
  const { data: cats = [] } = useCategories();
  const createMovieMutation = useCreateMovie();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const trailerInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [trailerFile, setTrailerFile] = useState<File | null>(null);
  const movieSchema = useMemo(() => buildMovieSchema(t), [t]);

  const handleCloseAdd = () => dispatch(closeAddModal());

  const handleSubmit = async (values: AddMovieFormValues) => {
    const { categoryIds, ...form } = values;
    try {
      await createMovieMutation.mutateAsync({ ...form, categoryIds, avatarFile, trailerFile });
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      if (trailerInputRef.current) trailerInputRef.current.value = '';
      setAvatarFile(null);
      setTrailerFile(null);
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
              <Field
                as={Input}
                label={t('movies.add.fields.producerAvatar')}
                type="text"
                name="producerAvatar"
                id="producerAvatar"
                className="mt-2 border-l-2 border-border pl-3"
                error={getError('producerAvatar')}
              />
              <Field
                as={Input}
                label={t('movies.add.fields.director')}
                type="text"
                name="director"
                id="director"
                className="mt-5"
                error={getError('director')}
              />
              <Field
                as={Input}
                label={t('movies.add.fields.directorAvatar')}
                type="text"
                name="directorAvatar"
                id="directorAvatar"
                className="mt-2 border-l-2 border-border pl-3"
                error={getError('directorAvatar')}
              />

              <label className="mb-1 mt-5 block text-sm font-medium">{t('movies.add.cast.label')}</label>
              <div className="flex flex-col gap-4">
                {formik.values.cast.map((member, index) => (
                  <div key={index} className="flex flex-col gap-2 rounded-md border border-txt/10 p-3">
                    <Input
                      label={t('movies.add.cast.name')}
                      type="text"
                      value={member.name}
                      onChange={(e) => updateCastRow(index, 'name', e.target.value)}
                      error={getError(`cast.${index}.name`)}
                    />
                    <Input
                      label={t('movies.add.cast.role')}
                      type="text"
                      value={member.role}
                      onChange={(e) => updateCastRow(index, 'role', e.target.value)}
                    />
                    <Input
                      label={t('movies.add.cast.avatarUrl')}
                      type="text"
                      value={member.avatar}
                      onChange={(e) => updateCastRow(index, 'avatar', e.target.value)}
                      error={getError(`cast.${index}.avatar`)}
                    />
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={member.isLead} onChange={() => toggleCastLead(index)} />
                      <span>{t('movies.add.cast.isLead')}</span>
                    </label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeCastRow(index)} className="self-end">
                      {t('movies.add.cast.remove')}
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="secondary" size="sm" onClick={addCastRow} className="self-start">
                  {t('movies.add.cast.add')}
                </Button>
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
