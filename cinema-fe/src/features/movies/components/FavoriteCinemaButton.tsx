import { useTranslation } from 'react-i18next';
import { toast } from '@/features/notifications/toast';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { useFavoriteCinemas } from '../hooks/useFavoriteCinemas';
import { useFavoriteCinemaMutation } from '../hooks/useFavoriteCinemaMutation';
import { useUnfavoriteCinemaMutation } from '../hooks/useUnfavoriteCinemaMutation';
import { ROUTES } from '@/constants/routes';

export interface FavoriteCinemaButtonProps {
  cinemaId: number;
}

export function FavoriteCinemaButton({ cinemaId }: FavoriteCinemaButtonProps) {
  const { t } = useTranslation('movies');
  const isLoggedIn = useIsAuthenticated();

  const { data: favoriteCinemas = [] } = useFavoriteCinemas();
  const isFavorite = favoriteCinemas.some((cinema) => cinema.id === cinemaId);
  const favoriteMutation = useFavoriteCinemaMutation();
  const unfavoriteMutation = useUnfavoriteCinemaMutation();

  const onClick = () => {
    if (!isLoggedIn) {
      toast.error(t('favoriteCinemaButton.loginRequired'));
      window.location.href = ROUTES.login;
      return;
    }
    if (isFavorite) {
      unfavoriteMutation.mutate(cinemaId, { onError: (error) => console.error(error) });
    } else {
      favoriteMutation.mutate(cinemaId, { onError: (error) => console.error(error) });
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={isFavorite ? t('favoriteCinemaButton.removeFavorite') : t('favoriteCinemaButton.addFavorite')}
      className="rounded-md border border-txt/30 bg-white px-3 py-2 text-main"
    >
      <i className={isFavorite ? 'fa-solid fa-heart text-red-600' : 'fa-regular fa-heart'} />
    </button>
  );
}
