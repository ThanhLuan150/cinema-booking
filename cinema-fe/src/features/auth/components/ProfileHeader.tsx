import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { getApiErrorMessage } from '@/lib/apiError';
import { toast } from '@/features/notifications/toast';
import { updateProfile } from '../api/auth.api';
import type { CurrentUser } from '../types/auth.types';
import { MAX_AVATAR_BYTES } from '@/constants/upload';

export function ProfileHeader({ user }: { user: CurrentUser }) {
  const { t } = useTranslation('auth');
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => avatarInputRef.current?.click();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(t('profile.avatarTooLarge'));
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setUploading(true);
      try {
        await updateProfile({ avatar: dataUrl });
        await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        toast.success(t('profile.avatarUpdateSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full rounded-2xl border border-border bg-surface p-8 text-white shadow-card">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={handleAvatarClick}
            className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-border-strong bg-accent-gradient"
            title={t('profile.changeAvatar')}
          >
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name || user.email}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-3xl font-semibold text-white">
                {(user.name || user.email || '?').charAt(0).toUpperCase()}
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? (
                <Spinner size="sm" className="text-white" />
              ) : (
                t('profile.changeAvatarShort')
              )}
            </span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div className="text-left">
            <p className="text-xl font-semibold">{user.name || t('profile.unnamed')}</p>
            <p className="text-sm text-txt/70">{user.email}</p>
          </div>
        </div>

        <div className="hidden h-16 w-px shrink-0 bg-border lg:block" />

        <div className="flex flex-wrap gap-x-12 gap-y-4 text-left">
          <div>
            <span className="block text-xs font-medium uppercase tracking-wide text-txt/50">
              {t('profile.fullNameLabel')}
            </span>
            <span className="mt-0.5 block font-medium text-white">{user.name || '—'}</span>
          </div>
          <div>
            <span className="block text-xs font-medium uppercase tracking-wide text-txt/50">
              {t('profile.emailLabel')}
            </span>
            <span className="mt-0.5 block font-medium text-white">{user.email}</span>
          </div>
          <div>
            <span className="block text-xs font-medium uppercase tracking-wide text-txt/50">
              {t('profile.phoneLabel')}
            </span>
            <span className="mt-0.5 block font-medium text-white">{user.phone || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
