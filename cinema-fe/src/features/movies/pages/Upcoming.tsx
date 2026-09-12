import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { UpcomingContent } from '../components/UpcomingContent';

const Upcomingg = () => {
  const { t } = useTranslation('movies');

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-20">
        <Breadcrumb items={[{ label: t('upcoming.breadcrumbMovie') }, { label: t('upcoming.breadcrumbCurrent') }]} />
        <UpcomingContent />
      </div>
      <Footer />
    </div>
  );
};

export default Upcomingg;
