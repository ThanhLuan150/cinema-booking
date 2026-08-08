import { useState, useEffect, useRef } from 'react';
import { Formik, Form } from 'formik';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthCard } from '@/components/common/AuthCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getApiErrorMessage } from '@/lib/apiError';
import { useVerifyCode } from '../hooks/useVerifyCode';
import { useResendCode } from '../hooks/useResendCode';
import { toast } from '@/features/notifications/toast';
import { ROUTES } from '@/constants/routes';

interface VerifyCodeFormValues {
  code: string[];
}

const VerifyCode = () => {
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const verifyCodeMutation = useVerifyCode();
  const resendCodeMutation = useResendCode();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const emailParam = searchParams.get('email');
    setEmail(emailParam ?? '');
  }, [location.search]);

  const handleResend = async () => {
    try {
      const resendResponse = await resendCodeMutation.mutateAsync(email);

      if (resendResponse) {
        if (resendResponse.status === 200) {
          toast.success(t('verifyCode.resendSuccess'));
        } else {
          setErrorMessage(t('verifyCode.codeIncorrect'));
        }
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(getApiErrorMessage(error, t));
    }
  };

  const handleSubmit = async (values: VerifyCodeFormValues) => {
    try {
      const response = await verifyCodeMutation.mutateAsync({
        email,
        otp: values.code.join(''),
      });

      if (response.status === 200) {
        toast.success(t('verifyCode.verifySuccess'));
        navigate(`${ROUTES.userInfo}?email=${encodeURIComponent(email)}`);
      } else {
        setErrorMessage(t('verifyCode.codeIncorrect'));
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(getApiErrorMessage(error, t));
    }
  };

  return (
    <AuthCard title={t('verifyCode.title')} subtitle={t('verifyCode.subtitle', { email })}>
      <Formik<VerifyCodeFormValues> initialValues={{ code: ['', '', '', '', '', ''] }} onSubmit={handleSubmit}>
        {(formik) => {
          const handleCodeChange = (index: number, value: string) => {
            const newCode = [...formik.values.code];
            newCode[index] = value;
            formik.setFieldValue('code', newCode);

            if (value !== '' && index < 5) {
              inputRefs.current[index + 1]?.focus();
            }
          };

          return (
            <Form className="text-center">
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {[...Array(6)].map((_, index) => (
                  <Input
                    key={index}
                    type="number"
                    className="h-14 w-12 px-0 text-center text-xl [caret-color:transparent] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="0"
                    min="0"
                    max="9"
                    required
                    value={formik.values.code[index]}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    ref={(input) => {
                      inputRefs.current[index] = input;
                    }}
                  />
                ))}
              </div>

              {errorMessage && <p className="mt-4 text-sm text-red-400">{errorMessage}</p>}

              <Button
                type="button"
                variant="ghost"
                onClick={handleResend}
                loading={resendCodeMutation.isPending}
                className="mt-6"
              >
                {t('verifyCode.resend')}
              </Button>
              <div className="mt-4">
                <Button type="submit" loading={verifyCodeMutation.isPending} className="w-1/2">
                  {t('verifyCode.verify')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </AuthCard>
  );
};

export default VerifyCode;
