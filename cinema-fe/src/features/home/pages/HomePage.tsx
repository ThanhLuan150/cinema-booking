import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import HomeContent from '../components/HomeContent';

const HomePage = () => {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-main">
      <Header />
      <div className="flex-1 pt-20">
        <HomeContent />
      </div>
      <Footer />
    </div>
  );
};

export default HomePage;
