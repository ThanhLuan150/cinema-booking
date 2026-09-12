import { Formik, Field, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface LookupFormProps {
  isPending: boolean;
  onSubmit: (values: { code: string }) => void;
}

export function LookupForm({ isPending, onSubmit }: LookupFormProps) {
  const { t } = useTranslation('owner');

  const validateLookup = (values: { code: string }) => {
    const errors: { code?: string } = {};
    if (!values.code.trim()) errors.code = t('bookingsLookup.validation.codeRequired');
    return errors;
  };

  return (
    <Formik initialValues={{ code: '' }} validate={validateLookup} onSubmit={onSubmit}>
      {(formik) => (
        <Form className="flex max-w-md gap-2">
          <Field
            as={Input}
            name="code"
            placeholder={t('bookingsLookup.codePlaceholder')}
            className="flex-1"
            error={formik.submitCount > 0 ? formik.errors.code : undefined}
          />
          <Button type="submit" variant="danger" loading={isPending}>
            {t('bookingsLookup.searchButton')}
          </Button>
        </Form>
      )}
    </Formik>
  );
}
