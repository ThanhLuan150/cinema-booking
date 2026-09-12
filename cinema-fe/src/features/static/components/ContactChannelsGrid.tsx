import { useTranslation } from 'react-i18next';
import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { CONTACT_CHANNELS } from '../constants';

export function ContactChannelsGrid() {
  const { t } = useTranslation('pages');

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {CONTACT_CHANNELS.map((channel) => {
        const value = t(`contact.channels.${channel.key}.value`);
        return (
          <Card key={channel.key} hoverable>
            <CardBody className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <i className={channel.icon} aria-hidden="true" />
              </span>
              <div>
                <CardTitle className="text-base">{t(`contact.channels.${channel.key}.label`)}</CardTitle>
                {'href' in channel ? (
                  <a
                    href={channel.href(value)}
                    className="mt-1 inline-block text-sm text-txt/70 no-underline transition-colors hover:text-accent"
                  >
                    {value}
                  </a>
                ) : (
                  <p className="mt-1 text-sm leading-relaxed text-txt/70">{value}</p>
                )}
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
