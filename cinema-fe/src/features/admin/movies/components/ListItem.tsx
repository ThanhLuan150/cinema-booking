import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getMoviePosterUrl, getTrailerKind } from '@/utils';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useAppDispatch } from '@/hooks/redux';
import type { Movie } from '@/types/entities';
import { ROLES } from '@/constants/roles';
import { openEditModal, openScheduleModal } from '../store/adminMoviesSlice';
import Delete from './Delete';

const TrailerPreview = ({ trailer }: { trailer: string }) => {
  const kind = getTrailerKind(trailer);
  if (!kind) return <span className="text-txt/40">-</span>;

  if (kind === 'image') {
    return (
      <a href={trailer} target="_blank" rel="noreferrer" className="block w-fit">
        <img src={trailer} alt="Trailer" className="h-[70px] w-[110px] rounded-md object-cover shadow-card" />
      </a>
    );
  }

  const iconName = kind === 'youtube' ? 'logo-youtube' : 'play-circle-outline';
  return (
    <a
      href={trailer}
      target="_blank"
      rel="noreferrer"
      className="inline-flex text-accent transition-colors hover:text-accent-hover"
    >
      <ion-icon name={iconName} style={{ fontSize: '2rem' }} />
    </a>
  );
};

const ListItem = ({ movie }: { movie: Movie }) => {
  const dispatch = useAppDispatch();
  const isAdmin = useAuthRole() === ROLES.admin;
  return (
    <tr>
      <td>{movie.id}</td>
      <td>
        <img
          src={getMoviePosterUrl(movie.avatar)}
          alt={movie.name}
          className="h-[70px] w-[110px] rounded-md object-cover shadow-card"
        />
      </td>
      <td className="font-medium text-white">{movie.name}</td>
      <td>{movie.premiere_date}</td>
      <td>{movie.country}</td>
      <td className="max-w-[150px] truncate">{movie.description}</td>
      <td>
        <TrailerPreview trailer={movie.trailer} />
      </td>
      <td>
        <div className="flex max-w-[140px] flex-wrap gap-1">
          {(movie.categories || []).map((cat) => (
            <Badge key={cat.id} variant="accent">
              {cat.name}
            </Badge>
          ))}
        </div>
      </td>
      <td>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-gold hover:bg-gold/10 hover:text-gold"
            onClick={() => dispatch(openEditModal(movie.id))}
          >
            <ion-icon name="pencil-outline" style={{ fontSize: '1.15rem' }} id={movie.id} />
          </Button>

          <Delete delete={movie.id} />

          {isAdmin && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
              onClick={() => dispatch(openScheduleModal(movie.id))}
            >
              <ion-icon name="add-circle-outline" style={{ fontSize: '1.15rem' }} id={movie.id} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
};
export default ListItem;
