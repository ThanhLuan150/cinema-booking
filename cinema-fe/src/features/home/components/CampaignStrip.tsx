import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { SectionHeading } from '@/components/common/SectionHeading';
import { getPublicCampaigns } from '@/features/owner/campaigns/api/campaign.api';
import type { PublicCampaign } from '@/types/entities';

// Ticket 37 — the customer-facing face of Marketing Campaigns. It reads GET /api/campaigns/public,
// which the campaign service has already filtered to campaigns that are on air right now
// ("Campaign hết hạn không được hiển thị" is enforced server-side), and renders their HOME_STRIP
// banners. The section hides itself entirely when nothing is running.

function bannerHref(link: string): string | null {
  const trimmed = link.trim();
  if (!trimmed) return null;
  return trimmed;
}

function CampaignBannerCard({ campaign }: { campaign: PublicCampaign }) {
  const banner = campaign.banners[0];
  if (!banner) return null;
  const href = bannerHref(banner.link_url);
  const isExternal = href ? /^https?:\/\//i.test(href) : false;

  const inner = (
    <div className="group relative h-44 w-full overflow-hidden rounded-xl border border-border">
      <img
        src={banner.image_url}
        alt={banner.title}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-main/90 via-main/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="text-base font-semibold text-white drop-shadow">{banner.title}</h3>
        {banner.subtitle && <p className="mt-1 line-clamp-1 text-sm text-white/80">{banner.subtitle}</p>}
      </div>
    </div>
  );

  if (!href) return inner;
  return isExternal ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="no-underline">
      {inner}
    </a>
  ) : (
    <Link to={href} className="no-underline">
      {inner}
    </Link>
  );
}

const CampaignStrip = () => {
  const { t } = useTranslation('home');
  const { data } = useQuery({
    queryKey: ['publicCampaigns', 'HOME_STRIP'],
    queryFn: () => getPublicCampaigns({ placement: 'HOME_STRIP' }),
    staleTime: 60_000,
  });

  const campaigns = (data ?? []).filter((c) => c.banners.length > 0);
  if (campaigns.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10">
      <SectionHeading title={t('campaignStrip.title')} />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c) => (
          <CampaignBannerCard key={c.id} campaign={c} />
        ))}
      </div>
    </section>
  );
};

export default CampaignStrip;
