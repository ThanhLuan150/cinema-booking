import { Button } from '@/components/ui/Button';
import { getMoviePosterUrl } from '@/utils';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useAppDispatch } from '@/hooks/redux';
import type { Movie } from '@/types/entities';
import { ROLES } from '@/constants/roles';
import { openEditModal, openScheduleModal } from '../store/adminMoviesSlice';
import Delete from './Delete';

const ListItem = ({ movie }: { movie: Movie }) => {
  const dispatch = useAppDispatch();
  const isAdmin = useAuthRole() === ROLES.admin;
  return (
    <tr>
      <td>{movie.id}</td>
      <td>
        <img src={getMoviePosterUrl(movie.avatar)} alt={movie.name} style={{ width: '110px', height: '70px' }} />
      </td>
      <td>{movie.name}</td>
      <td>{movie.premiere_date}</td>
      <td>{movie.country}</td>
      <td className="max-w-[150px] truncate">{movie.description}</td>
      <td className="max-w-[150px] truncate">{movie.trailer}</td>
      <td>
        {(movie.categories || []).map((cat) => (
          <p key={cat.id}>{cat.name}</p>
        ))}
      </td>
      <td>
        <Button type="button" variant="ghost" size="sm" onClick={() => dispatch(openEditModal(movie.id))}>
          <ion-icon name="pencil-outline" style={{ color: '#FFC107', fontSize: '1.3rem' }} id={movie.id} />
        </Button>

        <Delete delete={movie.id} />

        {isAdmin && (
          <Button type="button" variant="ghost" size="sm" onClick={() => dispatch(openScheduleModal(movie.id))}>
            <ion-icon
              name="add-circle-outline"
              style={{ color: '#16FF00', fontSize: '1.3rem', marginLeft: '0.2rem' }}
              id={movie.id}
            />
          </Button>
        )}
      </td>
    </tr>
  );
};
export default ListItem;
