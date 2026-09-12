import type { Actor } from '@/types/entities';
import Delete from './Delete';

interface ListItemProps {
  actor: Actor;
}

const ListItem = ({ actor }: ListItemProps) => (
  <tr>
    <td>{actor.id}</td>
    <td>{actor.full_name}</td>
    <td>{actor.nationality}</td>
    <td>
      <Delete id={actor.id} />
    </td>
  </tr>
);
export default ListItem;
