import { useMemo, useRef, useState } from 'react';
import { Formik, Field, Form } from 'formik';
import { toFormikValidate } from '@/lib/formikZod';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthCard } from '@/components/common/AuthCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { getApiErrorMessage } from '@/lib/apiError';
import { useSaveCinemaInfo } from '../hooks/useSaveCinemaInfo';
import { buildCinemaInfoFormData } from '../api/auth.api';
import { buildCinemaInfoSchema, type CinemaInfoFormValues } from '../schemas/cinemaInfo.schema';
import { toast } from '@/features/notifications/toast';
import { ROUTES } from '@/constants/routes';
import { MAX_AVATAR_BYTES } from '@/constants/upload';

const MAX_CINEMA_IMAGES = 5;

interface ImageDraft {
  file: File;
  preview: string;
}

const CinemaInfo = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  const email = useMemo(() => new URLSearchParams(location.search).get('email'), [location.search]);
  const [errorMessage, setErrorMessage] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [images, setImages] = useState<ImageDraft[]>([]);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  const cinemaInfoSchema = useMemo(() => buildCinemaInfoSchema(t), [t]);

  const saveCinemaInfoMutation = useSaveCinemaInfo();

  const handleAvatarClick = () => avatarInputRef.current?.click();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(t('profile.avatarTooLarge'));
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
    setAvatarFile(file);
  };

  const handleImagesClick = () => imagesInputRef.current?.click();

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;

    const room = MAX_CINEMA_IMAGES - images.length;
    if (room <= 0) {
      toast.error(t('cinemaInfo.tooManyImages', { max: MAX_CINEMA_IMAGES }));
      return;
    }

    files.slice(0, room).forEach((file) => {
      if (file.size > MAX_AVATAR_BYTES) {
        toast.error(t('profile.avatarTooLarge'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => [...prev, { file, preview: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (values: CinemaInfoFormValues) => {
    setErrorMessage('');
    if (!email) {
      setErrorMessage(t('userInfo.accountNotFound'));
      return;
    }
    try {
      const formData = buildCinemaInfoFormData(
        {
          email,
          name: values.name,
          phone: values.phone,
          address: values.address,
          city: values.city,
        },
        avatarFile,
        images.map((image) => image.file),
      );
      await saveCinemaInfoMutation.mutateAsync(formData);

      toast.success(t('cinemaInfo.saveSuccess'));

      navigate(ROUTES.login);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, t));
    }
  };

  return (
    <AuthCard title={t('cinemaInfo.title')} subtitle={t('cinemaInfo.subtitle')}>
      <Formik<CinemaInfoFormValues>
        initialValues={{ name: '', phone: '', address: '', city: '' }}
        validate={toFormikValidate<CinemaInfoFormValues>(cinemaInfoSchema)}
        onSubmit={handleSubmit}
      >
        {(formik) => (
          <Form>
            <div className="mb-4 flex justify-center">
              <button
                type="button"
                onClick={handleAvatarClick}
                className="group relative"
                title={t('cinemaInfo.changeAvatar')}
              >
                <Avatar src={avatarPreview} name={formik.values.name} size="lg" />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {t('profile.changeAvatarShort')}
                </span>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <Field
              as={Input}
              label={t('cinemaInfo.nameLabel')}
              type="text"
              id="cinema-name"
              name="name"
              placeholder={t('cinemaInfo.namePlaceholder')}
              error={formik.touched.name ? formik.errors.name : undefined}
            />
            <div className="mt-4">
              <Field
                as={Input}
                label={t('cinemaInfo.phoneLabel')}
                type="tel"
                id="cinema-phone"
                name="phone"
                placeholder={t('cinemaInfo.phonePlaceholder')}
                error={formik.touched.phone ? formik.errors.phone : undefined}
              />
            </div>
            <div className="mt-4">
              <Field
                as={Input}
                label={t('cinemaInfo.addressLabel')}
                type="text"
                id="cinema-address"
                name="address"
                placeholder={t('cinemaInfo.addressPlaceholder')}
                error={formik.touched.address ? formik.errors.address : undefined}
              />
            </div>
            <div className="mt-4">
              <Field
                as={Input}
                label={t('cinemaInfo.cityLabel')}
                type="text"
                id="cinema-city"
                name="city"
                placeholder={t('cinemaInfo.cityPlaceholder')}
                error={formik.touched.city ? formik.errors.city : undefined}
              />
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-txt/90">{t('cinemaInfo.imagesLabel')}</label>
              <div className="flex flex-wrap gap-3">
                {images.map((image, index) => (
                  <div key={index} className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border-strong">
                    <img src={image.preview} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label={t('cinemaInfo.removeImage')}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {images.length < MAX_CINEMA_IMAGES && (
                  <button
                    type="button"
                    onClick={handleImagesClick}
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border-strong text-txt/50 transition-colors hover:border-accent hover:text-accent"
                    title={t('cinemaInfo.addImage')}
                  >
                    +
                  </button>
                )}
              </div>
              <input
                ref={imagesInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImagesChange}
              />
            </div>

            <Button type="submit" loading={saveCinemaInfoMutation.isPending} className="mt-6 w-full">
              {t('cinemaInfo.submit')}
            </Button>
          </Form>
        )}
      </Formik>
    </AuthCard>
  );
};

export default CinemaInfo;
