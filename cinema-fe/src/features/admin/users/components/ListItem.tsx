import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ROLES } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';
import type { User } from '@/types/entities';
import { ROLE_KEY } from '../constants';

export interface ListItemProps {
  user: User;
  canViewCrm: boolean;
  onViewCrm: (user: User) => void;
  onApprove: (userId: number) => void;
  approvePending: boolean;
}

export const ListItem = ({ user, canViewCrm, onViewCrm, onApprove, approvePending }: ListItemProps) => {
  const { t } = useTranslation('admin');

  return (
    <tr>
      <td>{user.id}</td>
      <td>{user.name}</td>
      <td>{user.phone}</td>
      <td>{user.email}</td>
      <td>
        <Badge variant="default">{t(`users.list.roles.${ROLE_KEY[user.role] ?? 'user'}`)}</Badge>
      </td>
      <td>
        <div className="flex flex-wrap items-center gap-1.5">
          {user.status ? (
            <Badge variant="success">{t('users.list.statusActive')}</Badge>
          ) : (
            <Badge variant="default">{t('users.list.statusInactive')}</Badge>
          )}
          {user.role === ROLES.owner && !user.approved && (
            <Badge variant="warning">{t('users.list.pendingApproval')}</Badge>
          )}
        </div>
      </td>
      <td>
        <div className="flex items-center gap-1">
          {canViewCrm && user.role === ROLES.customer && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-accent hover:bg-accent/10 hover:text-accent-hover"
              title={t('users.list.viewCrm', { defaultValue: 'View activity' })}
              onClick={() => onViewCrm(user)}
            >
              <ion-icon name="stats-chart-outline" style={{ fontSize: '1.1rem' }} />
            </Button>
          )}
          {user.role === ROLES.owner && !user.approved && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={approvePending}
              onClick={() => onApprove(user.id)}
              className="text-accent hover:text-accent-hover"
            >
              {t('users.list.approveButton')}
            </Button>
          )}
          <Link to={ROUTES.deleteUser(user.id)} title={t('users.list.deleteButton', { defaultValue: 'Delete' })}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-500 hover:bg-red-500/10 hover:text-red-400"
            >
              <ion-icon name="trash-outline" style={{ fontSize: '1.1rem' }} />
            </Button>
          </Link>
          {user.status ? (
            <Link to={ROUTES.blockUser(user.id)} title={t('users.list.blockButton', { defaultValue: 'Block' })}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
              >
                <ion-icon name="lock-open-outline" style={{ fontSize: '1.1rem' }} />
              </Button>
            </Link>
          ) : (
            <Link to={ROUTES.unblockUser(user.id)} title={t('users.list.unblockButton', { defaultValue: 'Unblock' })}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-txt/70 hover:bg-white/10 hover:text-txt"
              >
                <ion-icon name="lock-closed-outline" style={{ fontSize: '1.1rem' }} />
              </Button>
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
};
