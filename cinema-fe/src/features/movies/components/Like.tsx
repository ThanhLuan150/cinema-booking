import { useTranslation } from 'react-i18next';
import { toast } from '@/features/notifications/toast';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { useLikeStatus } from '../hooks/useLikeStatus';
import { useLikeMutation } from '../hooks/useLikeMutation';
import { useUnlikeMutation } from '../hooks/useUnlikeMutation';
import { useMyLikedMovies } from '../hooks/useMyLikedMovies';
import { ROUTES } from '@/constants/routes';

export interface LikeProps {
  movieId: string | number;
}

const Like = ({ movieId }: LikeProps) => {
  const { t } = useTranslation('movies');
  const isLoggedIn = useIsAuthenticated();

  const { data: num = 0 } = useLikeStatus(movieId);
  const { data: likedMovies = [] } = useMyLikedMovies();
  const isLike = likedMovies.some((movie) => String(movie.id) === String(movieId));
  const likeMutation = useLikeMutation();
  const unlikeMutation = useUnlikeMutation();

  const onLikeClick = () => {
    if (!isLoggedIn) {
      toast.error(t('like.loginRequired'));
      window.location.href = ROUTES.login;
      return;
    }
    if (isLike) {
      unlikeMutation.mutate(
        { movie_id: movieId },
        {
          onError: (error) => {
            toast.error(t('like.unlikeError'));
            console.error(t('like.unlikeErrorLog'), error);
          },
        },
      );
    } else {
      likeMutation.mutate(
        { movie_id: movieId },
        {
          onError: (error) => {
            toast.error(t('like.likeError'));
            console.error(t('like.likeErrorLog'), error);
          },
        },
      );
    }
  };

  return (
    <button
      type="button"
      onClick={onLikeClick}
      className={
        isLike
          ? 'flex h-8 w-[5.5rem] items-center justify-center gap-1 rounded-md bg-white text-xs font-medium text-accent'
          : 'flex h-8 w-[5.5rem] items-center justify-center gap-1 rounded-md bg-accent text-xs font-medium text-white hover:bg-accent/90'
      }
    >
      <i className="fa fa-thumbs-up" /> {num}
    </button>
  );
};

export default Like;
