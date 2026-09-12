import type { Director } from '@/types/entities';
import Delete from './Delete';

interface ListItemProps {
  director: Director;
}

const ListItem = ({ director }: ListItemProps) => (
  <tr>
    <td>{director.id}</td>
    <td>{director.full_name}</td>
    <td>{director.nationality}</td>
    <td>
      <Delete id={director.id} />
    </td>
  </tr>
);
export default ListItem;
