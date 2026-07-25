import { useMemo, useState } from 'react';
import { Formik, Field, Form } from 'formik';
import { toFormikValidate } from '@/lib/formikZod';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/apiError';
import { useSaveCinemaInfo } from '../hooks/useSaveCinemaInfo';
import { buildCinemaInfoSchema, type CinemaInfoFormValues } from '../schemas/cinemaInfo.schema';
import { toast } from '@/features/notifications/toast';
import { ROUTES } from '@/constants/routes';

const CinemaInfo = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  const email = useMemo(() => new URLSearchParams(location.search).get('email'), [location.search]);
  const [errorMessage, setErrorMessage] = useState('');

  const cinemaInfoSchema = useMemo(() => buildCinemaInfoSchema(t), [t]);

  const saveCinemaInfoMutation = useSaveCinemaInfo();

  const handleSubmit = async (values: CinemaInfoFormValues) => {
    setErrorMessage('');
    if (!email) {
      setErrorMessage(t('userInfo.accountNotFound'));
      return;
    }
    try {
      await saveCinemaInfoMutation.mutateAsync({
        email,
        name: values.name,
        address: values.address,
        city: values.city,
      });

      toast.success(t('cinemaInfo.saveSuccess'));

      navigate(ROUTES.login);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, t));
    }
  };

  return (
    <div className="min-h-screen w-full bg-main px-4 pb-16 pt-24">
      <div className="mx-auto w-full max-w-lg">
        <Formik<CinemaInfoFormValues>
          initialValues={{ name: '', address: '', city: '' }}
          validate={toFormikValidate<CinemaInfoFormValues>(cinemaInfoSchema)}
          onSubmit={handleSubmit}
        >
          {(formik) => (
            <Form className="rounded-2xl bg-white p-8 text-center text-main">
              <h1 className="text-3xl font-bold">{t('cinemaInfo.title')}</h1>
              <p className="mt-2 text-sm text-main/70">{t('cinemaInfo.subtitle')}</p>

              <div className="mt-6 text-left">
                <Field
                  as={Input}
                  label={t('cinemaInfo.nameLabel')}
                  type="text"
                  id="cinema-name"
                  name="name"
                  placeholder={t('cinemaInfo.namePlaceholder')}
                  error={formik.touched.name ? formik.errors.name : undefined}
                />
              </div>
              <div className="mt-4 text-left">
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
              <div className="mt-4 text-left">
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

              <Button type="submit" loading={saveCinemaInfoMutation.isPending} className="mt-6 w-full">
                {t('cinemaInfo.submit')}
              </Button>
            </Form>
          )}
        </Formik>
        {errorMessage && <p className="mt-4 text-center text-sm text-red-400">{errorMessage}</p>}
      </div>
    </div>
  );
};

export default CinemaInfo;
