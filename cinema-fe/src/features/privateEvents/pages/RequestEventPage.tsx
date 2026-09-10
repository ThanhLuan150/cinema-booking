import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { DateInput } from '@/components/ui/DateInput';
import { TimeInput } from '@/components/ui/TimeInput';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { ROUTES } from '@/constants/routes';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useQuery } from '@tanstack/react-query';
import { getBranchRooms, getRentalBranches } from '../api/privateEvents.api';
import { useEventPackages, useRequestPrivateEvent } from '../hooks/usePrivateEvents';

// 'YYYY-MM-DD' + 'HH:mm' (local wall clock) -> ISO instant, matching how the backend rebuilds
// a showtime's local time for conflict detection.
function toInstant(date: string, time: string): string | null {
  if (!date || !time) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mi] = time.split(':').map(Number);
  const dt = new Date(y, m - 1, d, hh, mi, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function RequestEventPage() {
  const { t } = useTranslation('privateEvents');
  const navigate = useNavigate();

  const [branchId, setBranchId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [packageId, setPackageId] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [title, setTitle] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['rentalBranches'],
    queryFn: getRentalBranches,
  });
  const { data: rooms = [] } = useQuery({
    queryKey: ['branchRooms', branchId],
    queryFn: () => getBranchRooms(branchId),
    enabled: Boolean(branchId),
  });
  const { data: packagesPage } = useEventPackages('ACTIVE');
  const packages = packagesPage?.data ?? [];

  const request = useRequestPrivateEvent();

  const selectedPackage = packages.find((p) => String(p.id) === packageId);
  const selectedRoom = rooms.find((r) => String(r.id) === roomId);

  const startAt = useMemo(() => toInstant(date, startTime), [date, startTime]);
  const endAt = useMemo(() => toInstant(date, endTime), [date, endTime]);

  const validationError = useMemo(() => {
    if (!branchId || !roomId || !date || !startTime || !endTime || !packageId || !guestCount) {
      return t('request.errors.incomplete');
    }
    if (!startAt || !endAt || new Date(endAt) <= new Date(startAt)) {
      return t('request.errors.timeOrder');
    }
    if (new Date(startAt).getTime() <= Date.now()) {
      return t('request.errors.past');
    }
    const guests = Number(guestCount);
    if (!Number.isInteger(guests) || guests < 1) return t('request.errors.guests');
    if (selectedPackage && selectedPackage.max_guests > 0 && guests > selectedPackage.max_guests) {
      return t('request.errors.packageCap', { max: selectedPackage.max_guests });
    }
    if (selectedRoom && selectedRoom.capacity > 0 && guests > selectedRoom.capacity) {
      return t('request.errors.roomCap', { max: selectedRoom.capacity });
    }
    return null;
  }, [
    branchId, roomId, date, startTime, endTime, packageId, guestCount,
    startAt, endAt, selectedPackage, selectedRoom, t,
  ]);

  const submit = async () => {
    if (validationError || !startAt || !endAt) return;
    try {
      const created = await request.mutateAsync({
        branch_id: Number(branchId),
        room_id: Number(roomId),
        package_id: Number(packageId),
        start_at: startAt,
        end_at: endAt,
        guest_count: Number(guestCount),
        title: title.trim(),
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        contact_email: contactEmail.trim(),
        notes: notes.trim(),
      });
      toast.success(t('request.submitted', { id: created.id }));
      navigate(ROUTES.myPrivateEvents);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const roomOptions = rooms.map((r) => ({
    label: r.status === 'ACTIVE' ? `${r.name} (${r.type})` : `${r.name} — ${t(`roomStatus.${r.status}`)}`,
    value: String(r.id),
    disabled: r.status !== 'ACTIVE',
  }));

  return (
    <AccountLayout title={t('request.pageTitle')}>
      <p className="mb-6 max-w-2xl text-sm text-txt/70">{t('request.intro')}</p>

      {branchesLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid max-w-3xl gap-5 rounded-2xl border border-border bg-surface p-6 shadow-card">
          <div className="grid gap-5 sm:grid-cols-2">
            <Select
              label={t('request.branch')}
              value={branchId}
              placeholder={t('request.branchPlaceholder')}
              options={branches.map((b) => ({ label: b.name, value: String(b.id) }))}
              onChange={(e) => {
                setBranchId(e.target.value);
                setRoomId('');
              }}
            />
            <Select
              label={t('request.room')}
              value={roomId}
              placeholder={branchId ? t('request.roomPlaceholder') : t('request.pickBranchFirst')}
              options={roomOptions}
              disabled={!branchId}
              onChange={(e) => setRoomId(e.target.value)}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <DateInput label={t('request.date')} value={date} onChange={(e) => setDate(e.target.value)} />
            <TimeInput label={t('request.startTime')} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            <TimeInput label={t('request.endTime')} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Select
              label={t('request.package')}
              value={packageId}
              placeholder={t('request.packagePlaceholder')}
              options={packages.map((p) => ({
                label: `${p.name} — ${p.base_price.toLocaleString()}đ`,
                value: String(p.id),
              }))}
              onChange={(e) => setPackageId(e.target.value)}
            />
            <Input
              id="pe-guests"
              type="number"
              min={1}
              label={t('request.guestCount')}
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
            />
          </div>

          {selectedPackage && (
            <div className="rounded-lg border border-border bg-surface-soft p-3 text-sm text-txt/75">
              <p className="font-medium text-white">{selectedPackage.name}</p>
              {selectedPackage.description && <p className="mt-1">{selectedPackage.description}</p>}
              <p className="mt-1 text-xs text-txt/55">
                {t('request.packageMeta', {
                  price: selectedPackage.base_price.toLocaleString(),
                  guests: selectedPackage.max_guests > 0 ? selectedPackage.max_guests : t('request.noCap'),
                })}
              </p>
            </div>
          )}

          <Input id="pe-title" label={t('request.title')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid gap-5 sm:grid-cols-3">
            <Input id="pe-cname" label={t('request.contactName')} value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <Input id="pe-cphone" label={t('request.contactPhone')} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            <Input id="pe-cemail" label={t('request.contactEmail')} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <Textarea id="pe-notes" label={t('request.notes')} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />

          {validationError && <Alert variant="warning">{validationError}</Alert>}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="danger"
              loading={request.isPending}
              disabled={Boolean(validationError)}
              onClick={submit}
            >
              {t('request.submit')}
            </Button>
          </div>
        </div>
      )}
    </AccountLayout>
  );
}

export default RequestEventPage;
