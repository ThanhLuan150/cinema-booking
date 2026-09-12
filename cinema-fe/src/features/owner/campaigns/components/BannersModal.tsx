import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Campaign, CampaignBanner, CampaignBannerPlacement } from '@/types/entities';
import { useCampaign } from '../hooks/useCampaigns';
import { useCreateCampaignBanner, useDeleteCampaignBanner, useUpdateCampaignBanner } from '../hooks/useCampaignMutations';
import { BANNER_PLACEMENTS, emptyBannerForm } from '../constants';
import type { BannerForm } from '../types/campaigns.types';

interface BannersModalProps {
  campaign: Campaign;
  canManage: boolean;
  onClose: () => void;
}

export function BannersModal({ campaign, canManage, onClose }: BannersModalProps) {
  const { t } = useTranslation('owner');
  const { data: detail } = useCampaign(campaign.id);
  const banners = detail?.banners ?? [];

  const createBanner = useCreateCampaignBanner();
  const updateBanner = useUpdateCampaignBanner();
  const deleteBanner = useDeleteCampaignBanner();

  const [form, setForm] = useState<BannerForm>(emptyBannerForm);
  const [editing, setEditing] = useState<CampaignBanner | null>(null);

  const reset = () => {
    setForm(emptyBannerForm);
    setEditing(null);
  };

  const startEdit = (b: CampaignBanner) => {
    setEditing(b);
    setForm({
      title: b.title,
      subtitle: b.subtitle,
      image_url: b.image_url,
      link_url: b.link_url,
      placement: b.placement,
      sort_order: String(b.sort_order),
      status: b.status,
    });
  };

  const submit = async () => {
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        image_url: form.image_url.trim(),
        link_url: form.link_url.trim(),
        placement: form.placement,
        sort_order: Number(form.sort_order) || 0,
        status: form.status,
      };
      if (editing) {
        await updateBanner.mutateAsync({ bannerId: editing.id, ...payload });
        toast.success(t('campaigns.bannerUpdateSuccess'));
      } else {
        await createBanner.mutateAsync({ campaignId: campaign.id, ...payload });
        toast.success(t('campaigns.bannerCreateSuccess'));
      }
      reset();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const handleDelete = async (b: CampaignBanner) => {
    if (!(await confirmDialog(t('campaigns.bannerDeleteConfirm')))) return;
    try {
      await deleteBanner.mutateAsync(b.id);
      toast.success(t('campaigns.bannerDeleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const formValid = form.title.trim() && form.image_url.trim();

  return (
    <Modal open onClose={onClose} title={t('campaigns.bannersTitle', { name: campaign.name })} className="max-w-3xl">
      {banners.length === 0 ? (
        <p className="text-sm text-txt/60">{t('campaigns.noBanners')}</p>
      ) : (
        <DataTable
          headers={[
            t('campaigns.bannerHeaders.title'),
            t('campaigns.bannerHeaders.placement'),
            t('campaigns.bannerHeaders.order'),
            t('campaigns.bannerHeaders.status'),
            t('campaigns.bannerHeaders.actions'),
          ]}
        >
          {banners.map((b) => (
            <tr key={b.id}>
              <td className="flex items-center gap-2">
                {b.image_url && <img src={b.image_url} alt="" className="h-8 w-14 rounded object-cover" />}
                {b.title}
              </td>
              <td>{t(`campaigns.placement.${b.placement}`)}</td>
              <td>{b.sort_order}</td>
              <td>
                <Badge variant={b.status === 'ACTIVE' ? 'success' : 'default'}>
                  {t(`campaigns.bannerStatus.${b.status}`)}
                </Badge>
              </td>
              <td className="flex flex-wrap gap-3">
                {canManage && (
                  <>
                    <button
                      type="button"
                      className="text-sm font-medium text-accent hover:text-accent-hover"
                      onClick={() => startEdit(b)}
                    >
                      {t('campaigns.edit')}
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-red-500 hover:text-red-400"
                      onClick={() => handleDelete(b)}
                    >
                      {t('campaigns.delete')}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      {canManage && (
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-surface p-4">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-txt/60">
            {editing ? t('campaigns.editBanner') : t('campaigns.addBanner')}
          </h4>
          <Input
            id="banner-title"
            label={t('campaigns.bannerTitleLabel')}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Input
            id="banner-subtitle"
            label={t('campaigns.bannerSubtitleLabel')}
            value={form.subtitle}
            onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
          />
          <Input
            id="banner-image"
            label={t('campaigns.bannerImageLabel')}
            value={form.image_url}
            onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
          />
          <Input
            id="banner-link"
            label={t('campaigns.bannerLinkLabel')}
            value={form.link_url}
            onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              label={t('campaigns.bannerPlacementLabel')}
              value={form.placement}
              options={BANNER_PLACEMENTS.map((p) => ({ label: t(`campaigns.placement.${p}`), value: p }))}
              onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value as CampaignBannerPlacement }))}
            />
            <Input
              id="banner-order"
              type="number"
              label={t('campaigns.bannerOrderLabel')}
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
            />
            <Select
              label={t('campaigns.bannerStatusFieldLabel')}
              value={form.status}
              options={['ACTIVE', 'INACTIVE'].map((s) => ({ label: t(`campaigns.bannerStatus.${s}`), value: s }))}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            {editing && (
              <Button type="button" variant="secondary" onClick={reset}>
                {t('campaigns.cancel')}
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              loading={createBanner.isPending || updateBanner.isPending}
              disabled={!formValid}
              onClick={submit}
            >
              {t('campaigns.save')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
