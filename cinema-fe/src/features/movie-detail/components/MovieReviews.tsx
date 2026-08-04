import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { CommentItem } from '@/components/reviews/CommentItem';
import { StarRatingInput } from '@/components/reviews/StarRatingInput';
import type { ReactionType } from '@/components/reviews/reactions';
import { toast } from '@/features/notifications/toast';
import { useIsAuthenticated, useCurrentAccountId } from '@/features/auth/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/apiError';
import { MAX_RATING } from '@/constants/rating';
import { ROUTES } from '@/constants/routes';
import { useMovieReviews } from '../hooks/useMovieReviews';
import { usePostMovieReview } from '../hooks/usePostMovieReview';
import { usePostMovieReply } from '../hooks/usePostMovieReply';
import { useReactToReview } from '../hooks/useReactToReview';
import { useUpdateReview } from '../hooks/useUpdateReview';
import { useDeleteReview } from '../hooks/useDeleteReview';
import { useReportReview } from '../hooks/useReportReview';

const PAGE_SIZE = 5;

interface ReviewFormValues {
  reviewRating: number;
  reviewComment: string;
}

const MovieReviews = () => {
  const { t } = useTranslation('movieDetail');
  const { id } = useParams<{ id: string }>();
  const isLoggedIn = useIsAuthenticated();
  const currentUserId = useCurrentAccountId();
  const { data, isLoading } = useMovieReviews(id);
  const postReviewMutation = usePostMovieReview();
  const postReplyMutation = usePostMovieReply();
  const reactMutation = useReactToReview(id);
  const updateMutation = useUpdateReview(id);
  const deleteMutation = useDeleteReview(id);
  const reportMutation = useReportReview(id);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => setVisibleCount(PAGE_SIZE), [id]);

  const reviews = data?.reviews ?? [];
  const average = data?.average ?? 0;
  const count = data?.count ?? 0;

  const requireLogin = () => {
    toast.error(t('reviews.loginRequired'));
    window.location.href = ROUTES.login;
  };

  const handleSubmit = async (
    values: ReviewFormValues,
    { resetForm }: FormikHelpers<ReviewFormValues>,
  ) => {
    if (!isLoggedIn) {
      requireLogin();
      return;
    }
    try {
      await postReviewMutation.mutateAsync({
        movie_id: Number(id),
        rating: values.reviewRating,
        comment: values.reviewComment,
      });
      toast.success(t('reviews.submitSuccess'));
      resetForm();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('reviews.submitError'));
    }
  };

  const handleReact = (reviewId: number, type: ReactionType) => {
    if (!isLoggedIn) {
      requireLogin();
      return;
    }
    reactMutation.mutate({ reviewId, type });
  };

  const handleReply = async (parentId: number, comment: string) => {
    if (!isLoggedIn) {
      requireLogin();
      return;
    }
    try {
      await postReplyMutation.mutateAsync({ movie_id: Number(id), parent_id: parentId, comment });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('reviews.replySubmitError'));
    }
  };

  const handleEdit = async (reviewId: number, payload: { rating?: number; comment: string }) => {
    try {
      await updateMutation.mutateAsync({ reviewId, payload });
      toast.success(t('reviews.editSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('reviews.editError'));
    }
  };

  const handleDelete = async (reviewId: number) => {
    try {
      await deleteMutation.mutateAsync(reviewId);
      toast.success(t('reviews.deleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('reviews.deleteError'));
    }
  };

  const handleReport = async (reviewId: number, reason: string) => {
    if (!isLoggedIn) {
      requireLogin();
      return;
    }
    try {
      await reportMutation.mutateAsync({ reviewId, reason });
      toast.success(t('reviews.reportSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('reviews.reportError'));
    }
  };

  return (
    <div className="w-full">
      <h2 className="mb-2 flex flex-wrap items-center gap-3 text-xl font-bold uppercase tracking-wide text-white">
        <span className="h-6 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        {t('reviews.title')}{' '}
        {count > 0 && (
          <span className="text-base font-normal text-txt/60">
            ({t('reviews.ratingSummary', { average, count })})
          </span>
        )}
      </h2>

      <Formik<ReviewFormValues>
        initialValues={{ reviewRating: MAX_RATING, reviewComment: '' }}
        onSubmit={handleSubmit}
      >
        {(formik) => (
          <Form className="mt-5 rounded-xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span className="text-sm text-txt/70">{t('reviews.ratingLabel')}</span>
              <StarRatingInput
                value={formik.values.reviewRating}
                onChange={(value) => formik.setFieldValue('reviewRating', value)}
              />
            </div>
            <Field
              as="textarea"
              name="reviewComment"
              placeholder={t('reviews.commentPlaceholder')}
              className="mt-3 w-full rounded-lg border border-border-strong bg-surface-soft px-3 py-2.5 text-txt placeholder:text-txt/35 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              rows={3}
              onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === 'Enter' && !e.shiftKey && !postReviewMutation.isPending) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button
              type="submit"
              disabled={postReviewMutation.isPending}
              className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-card transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {t('reviews.submit')}
            </button>
          </Form>
        )}
      </Formik>

      <div className="mt-8 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState title={t('reviews.emptyState')} />
        ) : null}
        {!isLoading &&
          reviews
            .slice(0, visibleCount)
            .map((r) => (
              <CommentItem
                key={r.id}
                id={r.id}
                author={r.author}
                createdAt={r.createdAt}
                comment={r.comment}
                rating={r.rating}
                reactions={r.reactions}
                replies={r.replies}
                reportedByMe={r.reportedByMe}
                currentUserId={currentUserId}
                onReact={(type) => handleReact(r.id, type)}
                onReplyReact={(replyId, type) => handleReact(replyId, type)}
                onReply={(comment) => handleReply(r.id, comment)}
                onEdit={(payload) => handleEdit(r.id, payload)}
                onDelete={() => handleDelete(r.id)}
                onReport={(reason) => handleReport(r.id, reason)}
                onReplyEdit={(replyId, payload) => handleEdit(replyId, payload)}
                onReplyDelete={(replyId) => handleDelete(replyId)}
                onReplyReport={(replyId, reason) => handleReport(replyId, reason)}
                t={t}
              />
            ))}
        {!isLoading && reviews.length > visibleCount && (
          <button
            type="button"
            onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
            className="self-center rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-txt/70 transition-colors hover:border-accent hover:text-accent"
          >
            {t('reviews.loadMore')}
          </button>
        )}
      </div>
    </div>
  );
};

export default MovieReviews;
