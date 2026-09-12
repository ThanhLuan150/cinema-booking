import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { CinemaGridSection } from '../components/CinemaGridSection';

const Cinemas = () => {
  const { t } = useTranslation('movies');

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-20">
        <Breadcrumb items={[{ label: t('cinemas.breadcrumb') }]} />
        <CinemaGridSection />
      </div>
      <Footer />
    </div>
  );
};

export default Cinemas;
