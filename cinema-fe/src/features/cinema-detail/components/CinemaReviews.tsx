import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/feedback/EmptyState';
import { toast } from '@/features/notifications/toast';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/apiError';
import { MAX_RATING } from '@/constants/rating';
import { ROUTES } from '@/constants/routes';
import { useCinemaReviews } from '../hooks/useCinemaReviews';
import { usePostCinemaReview } from '../hooks/usePostCinemaReview';

interface ReviewFormValues {
  reviewRating: number;
  reviewComment: string;
}

const CinemaReviews = () => {
  const { t } = useTranslation('cinemaDetail');
  const { id } = useParams<{ id: string }>();
  const isLoggedIn = useIsAuthenticated();
  const { data, isLoading } = useCinemaReviews(id);
  const postReviewMutation = usePostCinemaReview();

  const reviews = data?.reviews ?? [];
  const average = data?.average ?? 0;
  const count = data?.count ?? 0;

  const handleSubmit = async (values: ReviewFormValues, { resetForm }: FormikHelpers<ReviewFormValues>) => {
    if (!isLoggedIn) {
      toast.error(t('reviews.loginRequired'));
      window.location.href = ROUTES.login;
      return;
    }
    try {
      await postReviewMutation.mutateAsync({ cinema_id: Number(id), rating: values.reviewRating, comment: values.reviewComment });
      toast.success(t('reviews.submitSuccess'));
      resetForm();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('reviews.submitError'));
    }
  };

  return (
    <div className="mx-auto w-4/5 py-8">
      <h5 className="mb-2 text-2xl text-white">
        {t('reviews.title')}{' '}
        {count > 0 && <span className="text-base text-txt/70">({t('reviews.ratingSummary', { average, count })})</span>}
      </h5>

      <Formik<ReviewFormValues> initialValues={{ reviewRating: MAX_RATING, reviewComment: '' }} onSubmit={handleSubmit}>
        {(formik) => (
          <Form className="mt-4 rounded-lg bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-txt/70" htmlFor="rating">
                {t('reviews.ratingLabel')}
              </label>
              <Select
                id="rating"
                name="reviewRating"
                value={formik.values.reviewRating}
                onChange={(e) => formik.setFieldValue('reviewRating', Number(e.target.value))}
                options={Array.from({ length: MAX_RATING }, (_, i) => MAX_RATING - i).map((r) => ({
                  value: r,
                  label: t('reviews.starOption', { count: r }),
                }))}
                className="bg-white"
              />
            </div>
            <Field
              as="textarea"
              name="reviewComment"
              placeholder={t('reviews.commentPlaceholder')}
              className="mt-3 w-full rounded-md border border-txt/30 bg-white px-3 py-2 text-main"
              rows={3}
            />
            <button
              type="submit"
              disabled={postReviewMutation.isPending}
              className="mt-3 rounded bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {t('reviews.submit')}
            </button>
          </Form>
        )}
      </Formik>

      <div className="mt-6 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState title={t('reviews.emptyState')} />
        ) : null}
        {!isLoading &&
          reviews.map((r) => (
            <div key={r.id} className="rounded-lg bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-accent">
                  {'★'.repeat(r.rating)}
                  {'☆'.repeat(MAX_RATING - r.rating)}
                </span>
                <span className="text-xs text-txt/50">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              {r.comment && <p className="mt-2 text-sm text-txt/80">{r.comment}</p>}
            </div>
          ))}
      </div>
    </div>
  );
};

export default CinemaReviews;
