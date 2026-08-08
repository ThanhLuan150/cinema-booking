import { useTranslation } from 'react-i18next';
import { toast } from '@/features/notifications/toast';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { useFavoriteCinemas } from '../hooks/useFavoriteCinemas';
import { useFavoriteCinemaMutation } from '../hooks/useFavoriteCinemaMutation';
import { useUnfavoriteCinemaMutation } from '../hooks/useUnfavoriteCinemaMutation';
import { ROUTES } from '@/constants/routes';

export interface FavoriteCinemaButtonProps {
  branchId: number;
}

export function FavoriteCinemaButton({ branchId }: FavoriteCinemaButtonProps) {
  const { t } = useTranslation('movies');
  const isLoggedIn = useIsAuthenticated();

  const { data: favoriteCinemas = [] } = useFavoriteCinemas();
  const isFavorite = favoriteCinemas.some((cinema) => cinema.id === branchId);
  const favoriteMutation = useFavoriteCinemaMutation();
  const unfavoriteMutation = useUnfavoriteCinemaMutation();

  const onClick = () => {
    if (!isLoggedIn) {
      toast.error(t('favoriteCinemaButton.loginRequired'));
      window.location.href = ROUTES.login;
      return;
    }
    if (isFavorite) {
      unfavoriteMutation.mutate(branchId, { onError: (error) => console.error(error) });
    } else {
      favoriteMutation.mutate(branchId, { onError: (error) => console.error(error) });
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={isFavorite ? t('favoriteCinemaButton.removeFavorite') : t('favoriteCinemaButton.addFavorite')}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-surface-soft text-txt/70 transition-colors hover:border-accent hover:text-accent"
    >
      <i className={isFavorite ? 'fa-solid fa-heart text-accent' : 'fa-regular fa-heart'} />
    </button>
  );
}
