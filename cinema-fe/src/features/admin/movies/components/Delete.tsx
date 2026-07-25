import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { useDeleteMovie } from '../hooks/useDeleteMovie';

interface DeleteProps {
  delete: number;
}

function Delete(props: DeleteProps) {
  const { t } = useTranslation('admin');
  const deleteMovieMutation = useDeleteMovie();

  const deleteMovies = async (id: number) => {
    if (await confirmDialog(t('movies.delete.confirm', { id }))) {
      try {
        await deleteMovieMutation.mutateAsync(id);
        toast.success(t('movies.delete.toastSuccess'));
      } catch (error) {
        console.log(error);
        toast.error(t('movies.delete.toastError'));
      }
    }
  };

  return (
    <b>
      <Button
        data-tag="allowRowEvents"
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          deleteMovies(props.delete);
        }}
      >
        <ion-icon name="trash-outline" style={{ color: '#E00813', fontSize: '1.3rem', marginLeft: '0.2rem' }} />
      </Button>
    </b>
  );
}
export default Delete;
