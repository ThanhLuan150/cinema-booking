import BannerDetail from './BannerDetail';
import MovieShowtimes from './MovieShowtimes';
import NowShowingSidebar from './NowShowingSidebar';
import MovieReviews from './MovieReviews';

export default function MovieDetailContent() {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 pb-16 md:px-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <main className="flex min-w-0 flex-col gap-12">
        <BannerDetail />
        <MovieShowtimes />
        <MovieReviews />
      </main>
      <aside className="min-w-0 lg:pt-4">
        <NowShowingSidebar />
      </aside>
    </div>
  );
}
