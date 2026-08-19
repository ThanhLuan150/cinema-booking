require('dotenv').config();

const connectDB = require('../config/db');
const Actor = require('../models/Actor');
const Director = require('../models/Director');
const nextId = require('../utils/nextId');

// avatar_url is left blank on purpose — these are real public figures, and we don't want to
// hotlink to photos we don't control the rights to. Upload a real photo per person via the
// admin Actor/Director "Add" form (file upload) once seeded.
const ACTORS = [
  { full_name: 'Tom Cruise', dob: '1962-07-03', nationality: 'USA', bio: 'Ngôi sao hành động với loạt phim Mission: Impossible.' },
  { full_name: 'Leonardo DiCaprio', dob: '1974-11-11', nationality: 'USA', bio: 'Đoạt giải Oscar Nam diễn viên chính xuất sắc nhất với The Revenant.' },
  { full_name: 'Robert Downey Jr.', dob: '1965-04-04', nationality: 'USA', bio: 'Nổi tiếng với vai Iron Man trong vũ trụ điện ảnh Marvel.' },
  { full_name: 'Scarlett Johansson', dob: '1984-11-22', nationality: 'USA', bio: 'Một trong những nữ diễn viên có doanh thu phòng vé cao nhất mọi thời đại.' },
  { full_name: 'Zendaya', dob: '1996-09-01', nationality: 'USA', bio: 'Ngôi sao trẻ nổi bật với Dune và Euphoria.' },
  { full_name: 'Timothée Chalamet', dob: '1995-12-27', nationality: 'USA', bio: 'Được đề cử Oscar khi còn rất trẻ, nổi bật với Dune và Call Me by Your Name.' },
  { full_name: 'Margot Robbie', dob: '1990-07-02', nationality: 'Australia', bio: 'Ghi dấu ấn với vai Barbie và Harley Quinn.' },
  { full_name: 'Dwayne Johnson', dob: '1972-05-02', nationality: 'USA', bio: "Ngôi sao hành động kiêm nhà sản xuất, biệt danh 'The Rock'." },
  { full_name: 'Tom Holland', dob: '1996-06-01', nationality: 'UK', bio: 'Được biết đến rộng rãi qua vai Spider-Man.' },
  { full_name: 'Florence Pugh', dob: '1996-01-03', nationality: 'UK', bio: 'Nữ diễn viên trẻ được đánh giá cao qua Midsommar và Oppenheimer.' },
  { full_name: 'Ryan Gosling', dob: '1980-11-12', nationality: 'Canada', bio: 'Nổi bật với La La Land và Barbie.' },
  { full_name: 'Emma Stone', dob: '1988-11-06', nationality: 'USA', bio: 'Hai lần đoạt giải Oscar Nữ diễn viên chính xuất sắc nhất.' },
  { full_name: 'Cillian Murphy', dob: '1976-05-25', nationality: 'Ireland', bio: 'Đoạt giải Oscar với vai chính trong Oppenheimer.' },
  { full_name: 'Song Kang-ho', dob: '1967-01-17', nationality: 'South Korea', bio: 'Diễn viên gạo cội Hàn Quốc, nổi tiếng với Parasite.' },
  { full_name: 'Trấn Thành', dob: null, nationality: 'Vietnam', bio: 'Nghệ sĩ đa năng, diễn viên kiêm đạo diễn với nhiều phim ăn khách như Bố Già, Mai.' },
  { full_name: 'Thu Trang', dob: null, nationality: 'Vietnam', bio: 'Diễn viên hài kiêm nhà sản xuất phim Việt được yêu thích.' },
  { full_name: 'Kaity Nguyễn', dob: null, nationality: 'Vietnam', bio: 'Gương mặt trẻ nổi bật của điện ảnh Việt Nam đương đại.' },
  { full_name: 'Thái Hòa', dob: null, nationality: 'Vietnam', bio: 'Diễn viên gạo cội, ghi dấu ấn qua Bố Già, Em Chưa 18, Long Ruồi.' },
  { full_name: 'Trường Giang', dob: null, nationality: 'Vietnam', bio: 'Diễn viên hài nổi tiếng, góp mặt trong nhiều phim điện ảnh ăn khách.' },
  { full_name: 'Tuấn Trần', dob: null, nationality: 'Vietnam', bio: 'Diễn viên trẻ nổi bật qua Bố Già, Nhà Bà Nữ, Đất Rừng Phương Nam.' },
  { full_name: 'Ninh Dương Lan Ngọc', dob: null, nationality: 'Vietnam', bio: 'Diễn viên nổi tiếng với Hai Phượng, Cánh Đồng Bất Tận.' },
  { full_name: 'Ngô Thanh Vân', dob: null, nationality: 'Vietnam', bio: 'Diễn viên kiêm nhà sản xuất, nổi bật với Hai Phượng, Cô Ba Sài Gòn.' },
  { full_name: 'Kiều Minh Tuấn', dob: null, nationality: 'Vietnam', bio: 'Diễn viên quen thuộc của điện ảnh Việt qua Em Là Bà Nội Của Anh, Chị Chị Em Em.' },
  { full_name: 'Việt Hương', dob: null, nationality: 'Vietnam', bio: 'Diễn viên hài kỳ cựu, được yêu mến qua nhiều phim điện ảnh và hài kịch.' },
  { full_name: 'Mạc Văn Khoa', dob: null, nationality: 'Vietnam', bio: 'Diễn viên hài quen mặt trong nhiều phim chiếu rạp doanh thu cao.' },
  { full_name: 'Thanh Hằng', dob: null, nationality: 'Vietnam', bio: 'Diễn viên kiêm siêu mẫu, góp mặt trong Tấm Cám: Chuyện Chưa Kể, Chị Chị Em Em.' },
  { full_name: 'Nhã Phương', dob: null, nationality: 'Vietnam', bio: 'Diễn viên nổi tiếng qua nhiều phim điện ảnh và truyền hình Việt.' },
  { full_name: 'Isaac', dob: null, nationality: 'Vietnam', bio: 'Ca sĩ kiêm diễn viên, tham gia Chị Chị Em Em, Người Bất Tử.' },
  { full_name: 'Hồng Đào', dob: null, nationality: 'Vietnam', bio: 'Diễn viên gạo cội, ghi dấu ấn qua Taxi, Em Tên Gì và nhiều phim khác.' },
];

const DIRECTORS = [
  { full_name: 'Christopher Nolan', dob: '1970-07-30', nationality: 'UK', bio: 'Đạo diễn Inception, Interstellar, Oppenheimer.' },
  { full_name: 'Denis Villeneuve', dob: '1967-10-03', nationality: 'Canada', bio: 'Đạo diễn loạt phim Dune và Blade Runner 2049.' },
  { full_name: 'Greta Gerwig', dob: '1983-08-04', nationality: 'USA', bio: 'Đạo diễn bộ phim Barbie đạt doanh thu kỷ lục.' },
  { full_name: 'Bong Joon-ho', dob: '1969-09-14', nationality: 'South Korea', bio: 'Đạo diễn phim Parasite, đoạt giải Oscar Phim hay nhất.' },
  { full_name: 'Quentin Tarantino', dob: '1963-03-27', nationality: 'USA', bio: 'Đạo diễn nổi tiếng với phong cách kể chuyện độc đáo qua Pulp Fiction, Kill Bill.' },
  { full_name: 'Steven Spielberg', dob: '1946-12-18', nationality: 'USA', bio: 'Một trong những đạo diễn có ảnh hưởng lớn nhất lịch sử điện ảnh.' },
  { full_name: 'James Cameron', dob: '1954-08-16', nationality: 'Canada', bio: 'Đạo diễn Titanic và loạt phim Avatar.' },
  { full_name: 'Ryan Coogler', dob: '1986-05-23', nationality: 'USA', bio: 'Đạo diễn loạt phim Black Panther và Creed.' },
  { full_name: 'Trấn Thành', dob: null, nationality: 'Vietnam', bio: 'Đạo diễn các phim ăn khách phòng vé Việt: Bố Già, Nhà Bà Nữ, Mai.' },
  { full_name: 'Lý Hải', dob: null, nationality: 'Vietnam', bio: 'Đạo diễn loạt phim Lật Mặt ăn khách tại phòng vé Việt.' },
  { full_name: 'Victor Vũ', dob: null, nationality: 'Vietnam', bio: 'Đạo diễn Việt kiều với các phim nổi bật như Mắt Biếc, Tôi Thấy Hoa Vàng Trên Cỏ Xanh.' },
  { full_name: 'Charlie Nguyễn', dob: null, nationality: 'Vietnam', bio: 'Đạo diễn Việt kiều với Dòng Máu Anh Hùng, Em Chưa 18, Fanti.' },
  { full_name: 'Nguyễn Quang Dũng', dob: null, nationality: 'Vietnam', bio: 'Đạo diễn Tiệc Trăng Máu, Mỹ Nhân Kế, Chàng Trai Năm Ấy.' },
  { full_name: 'Vũ Ngọc Đãng', dob: null, nationality: 'Vietnam', bio: 'Đạo diễn Bỗng Dưng Muốn Khóc, Chàng Vợ Của Em.' },
  { full_name: 'Nhất Trung', dob: null, nationality: 'Vietnam', bio: 'Đạo diễn nhiều phim điện ảnh thương mại ăn khách tại Việt Nam.' },
  { full_name: 'Phan Gia Nhật Linh', dob: null, nationality: 'Vietnam', bio: 'Đạo diễn Em Là Bà Nội Của Anh, đồng đạo diễn Bố Già.' },
  { full_name: 'Ngô Thanh Vân', dob: null, nationality: 'Vietnam', bio: 'Đạo diễn kiêm nhà sản xuất Cô Ba Sài Gòn, Trạng Tí Phiêu Lưu Ký.' },
  { full_name: 'Đinh Tuấn Vũ', dob: null, nationality: 'Vietnam', bio: 'Đạo diễn trẻ của điện ảnh Việt Nam đương đại.' },
];

async function run() {
  await connectDB();

  let actorCount = 0;
  for (const a of ACTORS) {
    const exists = await Actor.findOne({ full_name: a.full_name });
    if (exists) continue;
    const id = await nextId('actor');
    await Actor.create({
      id,
      full_name: a.full_name,
      avatar_url: '',
      bio: a.bio,
      dob: a.dob,
      nationality: a.nationality,
    });
    console.log(`Created actor: ${a.full_name} (id=${id})`);
    actorCount++;
  }

  let directorCount = 0;
  for (const d of DIRECTORS) {
    const exists = await Director.findOne({ full_name: d.full_name });
    if (exists) continue;
    const id = await nextId('director');
    await Director.create({
      id,
      full_name: d.full_name,
      avatar_url: '',
      bio: d.bio,
      dob: d.dob,
      nationality: d.nationality,
    });
    console.log(`Created director: ${d.full_name} (id=${id})`);
    directorCount++;
  }

  console.log(`Seed complete. ${actorCount} actor(s), ${directorCount} director(s) created.`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
