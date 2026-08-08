# Thiết kế hệ thống quản lý chuỗi rạp chiếu phim (Cinema Chain Management System)

> Ghi chú bối cảnh: backend hiện tại (`cinema-be`) đang dùng **Node.js + Express + MongoDB/Mongoose**, mô hình 1 rạp - nhiều "Cinema" gắn với `owner_id`, role dạng số (0=admin,1=user,2=theater staff). Tài liệu này thiết kế lại theo mô hình **Company → Branch** đa chi nhánh với RBAC đầy đủ, dùng schema **quan hệ (SQL)** vì mục 9 yêu cầu Laravel/MySQL. Phần 9 có so sánh với stack hiện tại và lộ trình chuyển đổi.

---

## 1. Kiến trúc hệ thống

### 1.1. Mô hình tổng thể

```
COMPANY (Cinema Chain HQ)
 │
 ├── SUPER ADMIN (quản trị toàn hệ thống)
 │
 ├── DANH MỤC DÙNG CHUNG (do Super Admin quản lý, áp dụng cho mọi chi nhánh)
 │     ├── Movies ──N:N── Genres
 │     │        ├──N:N── Actors
 │     │        └──N:N── Directors
 │     ├── Combo templates (đồ ăn/nước)
 │     └── Promotions cấp công ty (toàn hệ thống)
 │
 └── BRANCH 1..N (chi nhánh - đơn vị vận hành độc lập)
       │
       ├── BRANCH ADMIN (chỉ quản lý chi nhánh của mình)
       ├── EMPLOYEES (N)  — thu ngân, soát vé...
       │
       ├── ROOMS (N)                     [Phòng chiếu]
       │     └── SEATS (N)               [Ghế: Standard/VIP/Couple...]
       │
       ├── SHOWTIMES (N)                 [Suất chiếu = Movie × Room × giờ × giá]
       │     └── BOOKINGS (N)            [Đặt vé — do Customer hoặc Employee tạo]
       │            ├── BOOKING_SEATS (N)
       │            ├── TICKETS (N)      [1 vé / 1 ghế, dùng để check-in]
       │            ├── BOOKING_COMBOS (N)
       │            └── PAYMENT (1)
       │
       └── PROMOTIONS riêng của chi nhánh (tùy chọn, cộng thêm ngoài KM công ty)

CUSTOMERS — tài khoản dùng chung toàn hệ thống, có thể đặt vé ở BẤT KỲ chi nhánh nào
```

### 1.2. Quan hệ giữa các thành phần

| Quan hệ | Loại | Ghi chú |
|---|---|---|
| Company – Branch | 1–N | 1 công ty có nhiều chi nhánh |
| Branch – Branch Admin (User) | 1–1 (nghiệp vụ) | Mỗi chi nhánh có đúng 1 admin phụ trách chính (có thể mở rộng N nếu cần) |
| Branch – Employee | 1–N | Nhân viên thuộc 1 chi nhánh duy nhất |
| Branch – Room | 1–N | |
| Room – Seat | 1–N | |
| Room – Showtime | 1–N | Suất chiếu gắn với 1 phòng cụ thể |
| Movie – Showtime | 1–N | 1 phim có nhiều suất chiếu ở nhiều chi nhánh |
| Movie – Genre | N–N | qua `movie_genres` |
| Movie – Actor | N–N | qua `movie_actors` |
| Movie – Director | N–N | qua `movie_directors` |
| Showtime – Booking | 1–N | |
| Booking – Seat | N–N | qua `booking_seats` (ghế của phòng, theo suất chiếu) |
| Booking – Ticket | 1–N | 1 vé/ghế đã đặt |
| Booking – Payment | 1–1 | |
| Booking – Combo | N–N | qua `booking_combos` |
| Booking – Promotion | N–N (thường dùng 1) | qua `booking_promotions` |
| User (Customer) – Booking | 1–N | |
| Company/Branch – Promotion | 1–N | KM có thể scope = company hoặc branch |

### 1.3. Nguyên tắc kiến trúc

- **Multi-tenant theo chi nhánh (row-level scoping)**: mọi bảng nghiệp vụ vận hành (room, seat, showtime, booking, employee, promotion...) đều có `branch_id`. Mọi query của Branch Admin/Employee **bắt buộc filter theo `branch_id` được gán**, Super Admin không bị filter.
- **Danh mục dùng chung** (movie, genre, actor, director, combo template) sống ở cấp Company, các chi nhánh chỉ "chọn" để lên lịch chiếu / bán, không tạo trùng lặp.
- **Tách rời Catalog và Operation**: Movie (catalog) tách khỏi Showtime (vận hành theo chi nhánh) để 1 phim chiếu đồng thời ở nhiều rạp với giá/phòng khác nhau.
- **Idempotent booking + seat locking**: giữ ghế tạm thời (TTL, ví dụ Redis) khi khách đang thanh toán, tránh double-booking.

---

## 2. Phân quyền người dùng (Role & Permission)

### 2.1. Mô hình RBAC

`users.role_id → roles`, `roles ←N:N→ permissions` qua `role_permissions`. 4 role gốc: `SUPER_ADMIN`, `BRANCH_ADMIN`, `EMPLOYEE`, `CUSTOMER`. Ngoài ra `users.branch_id` (nullable) xác định phạm vi dữ liệu cho Branch Admin/Employee.

### 2.2. Ma trận quyền theo chức năng

| Chức năng | Super Admin | Branch Admin | Employee | Customer |
|---|---|---|---|---|
| Quản lý công ty / cấu hình hệ thống | ✅ Toàn quyền | ❌ | ❌ | ❌ |
| Tạo/sửa/khóa Chi nhánh | ✅ | ❌ (chỉ xem & sửa thông tin cơ bản chi nhánh mình) | ❌ | ❌ |
| Tạo/gán Branch Admin | ✅ | ❌ | ❌ | ❌ |
| Quản lý Employee | ✅ (toàn hệ thống) | ✅ (chỉ chi nhánh mình) | ❌ | ❌ |
| Quản lý Phim/Thể loại/Diễn viên/Đạo diễn (danh mục chung) | ✅ CRUD | 👁️ chỉ xem, đề xuất | ❌ | 👁️ xem công khai |
| Quản lý Phòng chiếu & Ghế | ✅ (mọi chi nhánh) | ✅ (chi nhánh mình) | ❌ | ❌ |
| Quản lý Suất chiếu | ✅ (mọi chi nhánh) | ✅ (chi nhánh mình) | 👁️ xem | 👁️ xem để đặt |
| Đặt vé / Bán vé tại quầy | ✅ | ✅ | ✅ (bán tại quầy) | ✅ (tự đặt) |
| Check-in vé | ✅ | ✅ | ✅ | ❌ |
| Hoàn vé / Hủy vé | ✅ (mọi nơi) | ✅ (chi nhánh mình, theo chính sách) | ⚠️ giới hạn (cần duyệt) | ✅ (yêu cầu hoàn, theo chính sách) |
| Combo đồ ăn (tạo template) | ✅ | ❌ (chỉ bật/tắt, chỉnh giá theo chi nhánh) | ❌ | 👁️ xem, mua kèm vé |
| Khuyến mãi cấp công ty | ✅ | 👁️ xem | ❌ | 👁️ xem/áp dụng |
| Khuyến mãi riêng chi nhánh | ✅ | ✅ (chi nhánh mình) | ❌ | 👁️ xem/áp dụng |
| Thanh toán / đối soát | ✅ (toàn hệ thống) | ✅ (chi nhánh mình) | ✅ (ghi nhận thanh toán tại quầy) | ✅ (thanh toán đơn của mình) |
| Báo cáo doanh thu | ✅ (toàn hệ thống + so sánh chi nhánh) | ✅ (chỉ chi nhánh mình) | ❌ | ❌ |
| Dashboard | ✅ Dashboard tổng | ✅ Dashboard chi nhánh | ❌ (tối đa: xem lịch làm việc/suất chiếu) | ❌ |
| Quản lý tài khoản Customer | ✅ (khóa/mở toàn hệ thống) | 👁️ xem KH đã đặt tại chi nhánh mình | ❌ | ✅ (chỉ hồ sơ chính mình) |
| Review/đánh giá phim | 🛠️ kiểm duyệt/xóa | 🛠️ kiểm duyệt trong chi nhánh (vé đã xem) | ❌ | ✅ (viết, sửa, xóa review của mình) |

**Phạm vi dữ liệu (data scope):**
- **Super Admin**: không giới hạn `branch_id`, xem chéo toàn bộ chi nhánh, so sánh, export toàn hệ thống.
- **Branch Admin**: mọi API tự động filter `branch_id = user.branch_id`; không thể đọc/ghi dữ liệu chi nhánh khác kể cả khi biết ID (kiểm tra ở middleware/ownership).
- **Employee**: filter theo `branch_id` giống Branch Admin, nhưng chỉ được thao tác nghiệp vụ hàng ngày (bán vé, check-in, ghi nhận thanh toán), không được sửa cấu hình (phòng, giá, suất chiếu, KM).
- **Customer**: chỉ truy cập dữ liệu gắn với `user_id` của chính mình (booking, ticket, payment, review); dữ liệu công khai (phim, suất chiếu, giá) đọc tự do.

---

## 3. Thiết kế các module chức năng

Mỗi module trình bày: Mục đích → Chức năng → Trường dữ liệu chính → CRUD → Quan hệ.

### 3.1. Quản lý chi nhánh (Branch)
- **Mục đích**: quản lý danh sách rạp/chi nhánh thuộc công ty.
- **Chức năng**: tạo chi nhánh, gán Branch Admin, cấu hình giờ hoạt động, khóa/mở hoạt động, xem tổng quan phòng chiếu/nhân viên.
- **Trường dữ liệu**: `name, address, city, phone, email, opening_hours, status, manager_id`.
- **CRUD**: Create/Update/Delete (soft-delete) — chỉ Super Admin; Read — Super Admin (all), Branch Admin (own).
- **Quan hệ**: 1–N Room, 1–N Employee, 1–N Showtime, 1–N Promotion (scope branch).

### 3.2. Quản lý người dùng (User)
- **Mục đích**: quản lý tài khoản đăng nhập cho mọi vai trò.
- **Chức năng**: đăng ký/đăng nhập, xác thực OTP/email, đổi mật khẩu, khóa/mở tài khoản, gán role & branch.
- **Trường dữ liệu**: `email, password_hash, full_name, phone, avatar, role_id, branch_id (nullable), status, verified_at`.
- **CRUD**: Super Admin toàn quyền; Branch Admin chỉ tạo Employee cho chi nhánh mình; Customer tự đăng ký & tự sửa hồ sơ.
- **Quan hệ**: N–1 Role, N–1 Branch (nullable với Customer/Super Admin), 1–N Booking (nếu là Customer).

### 3.3. Quản lý nhân viên (Employee)
- **Mục đích**: hồ sơ nghiệp vụ mở rộng của User có role Employee/Branch Admin.
- **Chức năng**: chấm công (tùy chọn), phân ca, gán vị trí (thu ngân/soát vé), theo dõi hiệu suất bán vé.
- **Trường dữ liệu**: `user_id, branch_id, position, hire_date, shift, status`.
- **CRUD**: Branch Admin CRUD trong chi nhánh mình; Super Admin CRUD toàn hệ thống.
- **Quan hệ**: 1–1 User, N–1 Branch.

### 3.4. Quản lý phòng chiếu (Room)
- **Mục đích**: định nghĩa các phòng chiếu vật lý của 1 chi nhánh.
- **Chức năng**: tạo sơ đồ phòng, loại phòng (2D/3D/IMAX/4DX), sức chứa, trạng thái bảo trì.
- **Trường dữ liệu**: `branch_id, name, room_type, total_seats, status`.
- **CRUD**: Branch Admin (chi nhánh mình), Super Admin (mọi nơi).
- **Quan hệ**: 1–N Seat, 1–N Showtime, N–1 Branch.

### 3.5. Quản lý ghế (Seat)
- **Mục đích**: sơ đồ ghế chi tiết trong từng phòng, làm cơ sở đặt vé.
- **Chức năng**: tạo lưới ghế (hàng/cột), loại ghế (Standard/VIP/Couple), khóa ghế hỏng.
- **Trường dữ liệu**: `room_id, row, column, seat_code, seat_type_id, status`.
- **CRUD**: Branch Admin/Super Admin.
- **Quan hệ**: N–1 Room, N–1 SeatType, 1–N BookingSeat (qua các suất chiếu khác nhau theo thời gian).

### 3.6. Quản lý phim (Movie)
- **Mục đích**: danh mục phim dùng chung toàn hệ thống.
- **Chức năng**: thêm phim, upload poster/trailer, mô tả, thời lượng, ngôn ngữ, phân loại độ tuổi (rating), ngày khởi chiếu, trạng thái (sắp chiếu/đang chiếu/ngừng chiếu).
- **Trường dữ liệu**: `title, description, duration_minutes, language, subtitle, rating, poster_url, trailer_url, release_date, status`.
- **CRUD**: Super Admin (chính); Branch Admin chỉ đọc để lên lịch.
- **Quan hệ**: N–N Genre, N–N Actor, N–N Director, 1–N Showtime, 1–N Review.

### 3.7. Quản lý thể loại (Genre)
- **Mục đích**: phân loại phim (Hành động, Tình cảm, Kinh dị...).
- **Chức năng**: CRUD danh mục thể loại, gán cho phim.
- **Trường dữ liệu**: `name, slug, description`.
- **CRUD**: Super Admin.
- **Quan hệ**: N–N Movie qua `movie_genres`.

### 3.8. Quản lý diễn viên (Actor)
- **Mục đích**: hồ sơ diễn viên gắn với phim.
- **Trường dữ liệu**: `full_name, avatar, bio, dob, nationality`.
- **CRUD**: Super Admin.
- **Quan hệ**: N–N Movie qua `movie_actors` (có thể thêm `role_name` = tên nhân vật đóng).

### 3.9. Quản lý đạo diễn (Director)
- **Mục đích**: hồ sơ đạo diễn gắn với phim.
- **Trường dữ liệu**: `full_name, avatar, bio, dob, nationality`.
- **CRUD**: Super Admin.
- **Quan hệ**: N–N Movie qua `movie_directors`.

### 3.10. Quản lý suất chiếu (Showtime)
- **Mục đích**: lịch chiếu cụ thể = Phim × Phòng × Thời gian × Giá.
- **Chức năng**: tạo lịch chiếu, kiểm tra trùng khung giờ trong cùng phòng, đặt giá theo khung giờ (giờ vàng/cuối tuần), đóng bán khi hết ghế/gần giờ chiếu.
- **Trường dữ liệu**: `movie_id, room_id, branch_id, start_time, end_time, base_price, status`.
- **CRUD**: Branch Admin (chi nhánh mình), Super Admin (mọi nơi).
- **Quan hệ**: N–1 Movie, N–1 Room, N–1 Branch, 1–N Booking.

### 3.11. Quản lý vé (Ticket)
- **Mục đích**: đại diện 1 chỗ ngồi đã bán trong 1 suất chiếu, dùng để check-in.
- **Chức năng**: sinh mã vé/QR code, đổi trạng thái (đã đặt/đã check-in/đã hủy), soát vé tại cửa.
- **Trường dữ liệu**: `booking_id, showtime_id, seat_id, ticket_code, price, status, checked_in_at`.
- **CRUD**: hệ thống tự sinh khi Booking thành công; Employee/Branch Admin cập nhật trạng thái check-in.
- **Quan hệ**: N–1 Booking, N–1 Showtime, N–1 Seat.

### 3.12. Quản lý đặt vé (Booking)
- **Mục đích**: đơn đặt vé (có thể gồm nhiều ghế + combo).
- **Chức năng**: giữ ghế tạm (hold), xác nhận thanh toán, áp mã khuyến mãi, hủy/hoàn vé theo chính sách.
- **Trường dữ liệu**: `user_id (nullable nếu bán tại quầy), branch_id, showtime_id, created_by (employee nếu bán quầy), total_amount, discount_amount, final_amount, status (pending/held/paid/cancelled/refunded), booked_at`.
- **CRUD**: Customer tạo cho chính mình; Employee tạo hộ (bán tại quầy); Branch Admin/Super Admin xem & xử lý hoàn/hủy.
- **Quan hệ**: N–1 User, N–1 Showtime, 1–N BookingSeat, 1–N Ticket, 1–N BookingCombo, 1–1 Payment, N–N Promotion.

### 3.13. Quản lý combo đồ ăn (Combo)
- **Mục đích**: sản phẩm bắp nước bán kèm vé.
- **Chức năng**: tạo combo (tên, mô tả, ảnh, giá gốc), Branch Admin bật/tắt & override giá theo chi nhánh (tồn kho đơn giản nếu cần).
- **Trường dữ liệu**: `name, description, image_url, base_price, status` (+ bảng `branch_combos` override `price, is_active` theo chi nhánh nếu cần).
- **CRUD**: Super Admin tạo template; Branch Admin cấu hình theo chi nhánh.
- **Quan hệ**: N–N Booking qua `booking_combos`.

### 3.14. Quản lý khuyến mãi (Promotion)
- **Mục đích**: mã giảm giá / ưu đãi theo % hoặc số tiền cố định.
- **Chức năng**: tạo mã, điều kiện áp dụng (ngày hiệu lực, số lượt dùng, giá trị đơn tối thiểu), scope = company hoặc branch.
- **Trường dữ liệu**: `code, name, discount_type (percent/fixed), discount_value, scope (company/branch), branch_id (nullable), start_date, end_date, usage_limit, used_count, status`.
- **CRUD**: Super Admin (scope=company); Branch Admin (scope=branch, chi nhánh mình).
- **Quan hệ**: N–N Booking qua `booking_promotions`.

### 3.15. Quản lý thanh toán (Payment)
- **Mục đích**: ghi nhận giao dịch thanh toán cho booking.
- **Chức năng**: tích hợp cổng thanh toán (VNPay/Momo/thẻ), thanh toán tiền mặt tại quầy, webhook xác nhận, đối soát.
- **Trường dữ liệu**: `booking_id, method (cash/momo/vnpay/card), amount, transaction_code, status (pending/success/failed/refunded), paid_at`.
- **CRUD**: hệ thống tạo khi Booking xác nhận; cập nhật qua webhook/Employee (tiền mặt).
- **Quan hệ**: 1–1 Booking.

### 3.16. Quản lý doanh thu (Revenue)
- **Mục đích**: tổng hợp doanh thu theo nhiều chiều để phục vụ báo cáo/dashboard.
- **Chức năng**: tính doanh thu vé + combo, theo ngày/tháng/năm, theo chi nhánh, theo phim; có thể cache vào bảng snapshot để tăng tốc dashboard.
- **Trường dữ liệu (bảng snapshot tuỳ chọn `revenue_reports`)**: `branch_id (nullable=all), report_date, ticket_revenue, combo_revenue, total_revenue, tickets_sold, bookings_count`.
- **CRUD**: sinh tự động (cron/job), Read-only cho Admin.
- **Quan hệ**: tổng hợp từ Booking/Payment/Ticket theo Branch & Movie.

### 3.17. Dashboard & báo cáo thống kê
- **Mục đích**: trực quan hoá số liệu vận hành/kinh doanh.
- **Chức năng**: biểu đồ doanh thu, top phim, top chi nhánh, tỷ lệ lấp đầy, top khách hàng — chi tiết ở Mục 8.
- **Quan hệ**: đọc tổng hợp từ Booking, Payment, Ticket, Showtime, Movie, Branch, User.

---

## 4. Thiết kế cơ sở dữ liệu (Database Design)

Quy ước: PK `id BIGINT UNSIGNED AUTO_INCREMENT`, timestamp `created_at/updated_at`, xoá mềm `deleted_at` (nullable) cho các bảng cấu hình quan trọng.

### 4.1. `companies`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| name | VARCHAR(150) | NOT NULL |
| tax_code | VARCHAR(50) | |
| hotline | VARCHAR(20) | |
| email | VARCHAR(150) | |
| logo_url | VARCHAR(255) | |
| status | TINYINT | default 1 |
| created_at/updated_at | DATETIME | |

### 4.2. `branches`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| company_id | BIGINT UNSIGNED | FK → companies.id |
| name | VARCHAR(150) | NOT NULL |
| address | VARCHAR(255) | |
| city | VARCHAR(100) | |
| phone | VARCHAR(20) | |
| opening_hours | VARCHAR(100) | |
| manager_id | BIGINT UNSIGNED | FK → users.id (nullable, Branch Admin) |
| status | TINYINT | 0=pending,1=active,2=locked |
| created_at/updated_at | DATETIME | |

### 4.3. `roles`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| code | VARCHAR(30) | UNIQUE — SUPER_ADMIN/BRANCH_ADMIN/EMPLOYEE/CUSTOMER |
| name | VARCHAR(50) | |

### 4.4. `permissions`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| code | VARCHAR(60) | UNIQUE — vd `movie.create`, `booking.refund` |
| module | VARCHAR(40) | vd `movie`, `booking` |
| description | VARCHAR(150) | |

### 4.5. `role_permissions`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| role_id | BIGINT UNSIGNED | PK, FK → roles.id |
| permission_id | BIGINT UNSIGNED | PK, FK → permissions.id |

### 4.6. `users`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| role_id | BIGINT UNSIGNED | FK → roles.id |
| branch_id | BIGINT UNSIGNED | FK → branches.id (NULL nếu Super Admin/Customer) |
| email | VARCHAR(150) | UNIQUE |
| password_hash | VARCHAR(255) | |
| full_name | VARCHAR(150) | |
| phone | VARCHAR(20) | |
| avatar_url | VARCHAR(255) | |
| status | TINYINT | 1=active,0=locked |
| verified_at | DATETIME | nullable |
| created_at/updated_at | DATETIME | |

### 4.7. `employees`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| user_id | BIGINT UNSIGNED | FK → users.id, UNIQUE |
| branch_id | BIGINT UNSIGNED | FK → branches.id |
| position | VARCHAR(50) | thu ngân/soát vé/... |
| hire_date | DATE | |
| status | TINYINT | |

### 4.8. `genres`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| name | VARCHAR(80) | UNIQUE |
| slug | VARCHAR(80) | UNIQUE |

### 4.9. `movies`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| title | VARCHAR(200) | NOT NULL |
| description | TEXT | |
| duration_minutes | INT | |
| language | VARCHAR(50) | |
| subtitle | VARCHAR(50) | nullable |
| rating | VARCHAR(10) | P/K/T13/T16/T18 |
| poster_url | VARCHAR(255) | |
| trailer_url | VARCHAR(255) | |
| release_date | DATE | |
| status | TINYINT | 0=upcoming,1=showing,2=ended |
| created_at/updated_at | DATETIME | |

### 4.10. `actors`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| full_name | VARCHAR(150) | |
| avatar_url | VARCHAR(255) | |
| bio | TEXT | |
| dob | DATE | nullable |
| nationality | VARCHAR(80) | nullable |

### 4.11. `directors`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| full_name | VARCHAR(150) | |
| avatar_url | VARCHAR(255) | |
| bio | TEXT | |
| dob | DATE | nullable |
| nationality | VARCHAR(80) | nullable |

### 4.12. Bảng liên kết N–N của Movie
- **`movie_genres`**: `movie_id FK, genre_id FK` (PK ghép)
- **`movie_actors`**: `movie_id FK, actor_id FK, character_name VARCHAR(100)` (PK ghép `movie_id+actor_id`)
- **`movie_directors`**: `movie_id FK, director_id FK` (PK ghép)

### 4.13. `rooms`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| branch_id | BIGINT UNSIGNED | FK → branches.id |
| name | VARCHAR(50) | vd "Room 1" |
| room_type | VARCHAR(20) | 2D/3D/IMAX/4DX |
| total_seats | INT | |
| status | TINYINT | 1=active,0=maintenance |

### 4.14. `seat_types`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| name | VARCHAR(30) | Standard/VIP/Couple |
| price_multiplier | DECIMAL(4,2) | vd 1.00 / 1.30 / 1.80 |

### 4.15. `seats`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| room_id | BIGINT UNSIGNED | FK → rooms.id |
| seat_type_id | BIGINT UNSIGNED | FK → seat_types.id |
| row_label | VARCHAR(5) | vd "A" |
| column_number | INT | |
| seat_code | VARCHAR(10) | vd "A01" |
| status | TINYINT | 1=active,0=disabled |
| UNIQUE(room_id, seat_code) | | |

### 4.16. `showtimes`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| movie_id | BIGINT UNSIGNED | FK → movies.id |
| room_id | BIGINT UNSIGNED | FK → rooms.id |
| branch_id | BIGINT UNSIGNED | FK → branches.id (denormalize để filter nhanh) |
| start_time | DATETIME | |
| end_time | DATETIME | |
| base_price | DECIMAL(10,2) | |
| status | TINYINT | 0=scheduled,1=open,2=closed,3=cancelled |
| UNIQUE(room_id, start_time) | | tránh trùng lịch |

### 4.17. `bookings`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| booking_code | VARCHAR(20) | UNIQUE |
| user_id | BIGINT UNSIGNED | FK → users.id, nullable (khách vãng lai tại quầy) |
| showtime_id | BIGINT UNSIGNED | FK → showtimes.id |
| branch_id | BIGINT UNSIGNED | FK → branches.id |
| created_by | BIGINT UNSIGNED | FK → users.id (employee nếu bán tại quầy), nullable |
| total_amount | DECIMAL(12,2) | tổng vé + combo trước giảm |
| discount_amount | DECIMAL(12,2) | default 0 |
| final_amount | DECIMAL(12,2) | |
| status | TINYINT | 0=pending,1=held,2=paid,3=cancelled,4=refunded |
| booked_at | DATETIME | |

### 4.18. `booking_seats`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| booking_id | BIGINT UNSIGNED | FK → bookings.id |
| showtime_id | BIGINT UNSIGNED | FK → showtimes.id (chống trùng ghế cùng suất) |
| seat_id | BIGINT UNSIGNED | FK → seats.id |
| price | DECIMAL(10,2) | giá áp dụng cho ghế này |
| UNIQUE(showtime_id, seat_id) | | đảm bảo 1 ghế/suất chỉ bán 1 lần |

### 4.19. `tickets`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| booking_id | BIGINT UNSIGNED | FK → bookings.id |
| showtime_id | BIGINT UNSIGNED | FK → showtimes.id |
| seat_id | BIGINT UNSIGNED | FK → seats.id |
| ticket_code | VARCHAR(30) | UNIQUE, dùng làm QR |
| price | DECIMAL(10,2) | |
| status | TINYINT | 0=issued,1=checked_in,2=cancelled |
| checked_in_at | DATETIME | nullable |
| checked_in_by | BIGINT UNSIGNED | FK → users.id (employee), nullable |

### 4.20. `payments`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| booking_id | BIGINT UNSIGNED | FK → bookings.id, UNIQUE |
| method | VARCHAR(20) | cash/momo/vnpay/card |
| amount | DECIMAL(12,2) | |
| transaction_code | VARCHAR(100) | nullable |
| status | TINYINT | 0=pending,1=success,2=failed,3=refunded |
| paid_at | DATETIME | nullable |

### 4.21. `combos`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| name | VARCHAR(100) | |
| description | VARCHAR(255) | |
| image_url | VARCHAR(255) | |
| base_price | DECIMAL(10,2) | |
| status | TINYINT | |

### 4.22. `booking_combos`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| booking_id | BIGINT UNSIGNED | FK → bookings.id |
| combo_id | BIGINT UNSIGNED | FK → combos.id |
| quantity | INT | |
| price | DECIMAL(10,2) | giá tại thời điểm mua |

### 4.23. `promotions`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| code | VARCHAR(30) | UNIQUE |
| name | VARCHAR(150) | |
| discount_type | VARCHAR(10) | percent/fixed |
| discount_value | DECIMAL(10,2) | |
| scope | VARCHAR(10) | company/branch |
| branch_id | BIGINT UNSIGNED | FK → branches.id, nullable (bắt buộc nếu scope=branch) |
| start_date/end_date | DATETIME | |
| usage_limit | INT | nullable |
| used_count | INT | default 0 |
| status | TINYINT | |

### 4.24. `booking_promotions`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| booking_id | BIGINT UNSIGNED | PK, FK → bookings.id |
| promotion_id | BIGINT UNSIGNED | PK, FK → promotions.id |
| discount_applied | DECIMAL(10,2) | |

### 4.25. `reviews`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| movie_id | BIGINT UNSIGNED | FK → movies.id |
| user_id | BIGINT UNSIGNED | FK → users.id |
| rating | TINYINT | 1–5 |
| comment | TEXT | |
| status | TINYINT | 0=hidden,1=visible |
| created_at | DATETIME | |

### 4.26. `revenue_reports` (snapshot phục vụ Dashboard)
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| branch_id | BIGINT UNSIGNED | FK → branches.id, nullable = toàn hệ thống |
| report_date | DATE | |
| ticket_revenue | DECIMAL(14,2) | |
| combo_revenue | DECIMAL(14,2) | |
| total_revenue | DECIMAL(14,2) | |
| tickets_sold | INT | |
| bookings_count | INT | |
| UNIQUE(branch_id, report_date) | | |

### 4.27. `audit_logs` (tuỳ chọn, khuyến nghị cho hệ thống nhiều role)
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | BIGINT UNSIGNED | PK |
| user_id | BIGINT UNSIGNED | FK → users.id |
| action | VARCHAR(100) | vd `booking.refund` |
| target_type/target_id | VARCHAR(50)/BIGINT | |
| meta | JSON | |
| created_at | DATETIME | |

---

## 5. ERD

```
companies ──1:N── branches ──1:N── rooms ──1:N── seats
                     │                 │
                     │                 └──1:N── showtimes ──N:1── movies
                     │                                │
                     1:N                               1:N
                     │                                │
                 employees                         bookings ──N:1── users(customer)
                     │                                │  │  │
                  1:1 user                             │  │  └──1:1── payments
                                                        │  └──1:N── booking_seats ──N:1── seats
                                                        └──1:N── tickets

movies ──N:N── genres        (movie_genres)
movies ──N:N── actors        (movie_actors)
movies ──N:N── directors     (movie_directors)
bookings ──N:N── combos      (booking_combos)
bookings ──N:N── promotions  (booking_promotions)
movies ──1:N── reviews ──N:1── users

roles ──N:N── permissions    (role_permissions)
users ──N:1── roles
users ──N:1── branches (nullable)
```

**Giải thích các loại quan hệ:**
- **1–1**: `bookings ↔ payments` (1 đơn hàng có đúng 1 giao dịch thanh toán tổng); `users ↔ employees` (1 tài khoản nhân viên có đúng 1 hồ sơ employee).
- **1–N**: `branches → rooms`, `rooms → seats`, `movies → showtimes`, `showtimes → bookings`, `bookings → tickets`, `movies → reviews`. Đây là dạng phổ biến nhất, thể hiện quan hệ "sở hữu"/"cha-con" theo cấp bậc Company → Branch → Room → Showtime.
- **N–N**: `movies ↔ genres/actors/directors` (1 phim nhiều thể loại/diễn viên, 1 diễn viên đóng nhiều phim), `bookings ↔ combos`, `bookings ↔ promotions`, `roles ↔ permissions`. Đều được hiện thực bằng bảng trung gian có thêm cột dữ liệu ngữ cảnh (`quantity`, `price`, `character_name`, `discount_applied`...).

---

## 6. Use Case theo vai trò

**Super Admin**
- Quản lý công ty, tạo/khóa chi nhánh, gán Branch Admin
- CRUD danh mục dùng chung: phim, thể loại, diễn viên, đạo diễn, combo template
- Tạo khuyến mãi toàn hệ thống
- Xem dashboard tổng, so sánh doanh thu giữa các chi nhánh, export báo cáo
- Quản lý role/permission, khóa/mở bất kỳ tài khoản nào
- Duyệt yêu cầu hoàn vé vượt hạn mức chi nhánh

**Branch Admin**
- Cấu hình phòng chiếu, sơ đồ ghế của chi nhánh
- Lên lịch suất chiếu từ danh mục phim có sẵn, đặt giá theo khung giờ
- Tuyển/khóa tài khoản Employee của chi nhánh
- Tạo khuyến mãi riêng chi nhánh, cấu hình combo theo chi nhánh
- Xử lý hoàn/hủy vé theo chính sách, xem dashboard chi nhánh
- Đối soát doanh thu, thanh toán tại quầy của chi nhánh

**Employee**
- Bán vé tại quầy (chọn suất chiếu, ghế, combo, thanh toán tiền mặt/POS)
- Soát vé/check-in bằng mã QR tại cửa phòng chiếu
- Xem lịch suất chiếu trong ca làm việc
- Ghi nhận yêu cầu hoàn vé để Branch Admin duyệt

**Customer**
- Đăng ký/đăng nhập, quản lý hồ sơ cá nhân
- Tìm kiếm phim, xem lịch chiếu theo chi nhánh/khu vực
- Đặt vé online (chọn ghế, combo, áp mã khuyến mãi), thanh toán online
- Xem lịch sử đặt vé, vé điện tử (QR), yêu cầu hoàn vé
- Viết đánh giá/review phim đã xem

---

## 7. Quy trình nghiệp vụ

**7.1. Quản lý chi nhánh**
1. Super Admin tạo `branch` (thông tin cơ bản, trạng thái `pending`).
2. Super Admin tạo tài khoản Branch Admin, gán `branch_id`.
3. Branch Admin đăng nhập, hoàn thiện cấu hình phòng chiếu/ghế.
4. Super Admin duyệt → `status = active`, chi nhánh xuất hiện trên FE để khách chọn.

**7.2. Thêm phim**
1. Super Admin nhập thông tin phim (poster, trailer, mô tả, thời lượng, rating).
2. Gán thể loại (N–N), diễn viên/đạo diễn (tạo mới nếu chưa có trong danh mục).
3. Đặt `status = upcoming`; khi đến ngày khởi chiếu hệ thống/Cron chuyển `status = showing`.

**7.3. Tạo phòng chiếu**
1. Branch Admin tạo `room` (tên, loại phòng, sức chứa dự kiến).
2. Tạo sơ đồ ghế: hàng × cột, gán `seat_type` cho từng ghế/khu vực (VIP giữa, Standard 2 bên...).
3. Hệ thống validate `total_seats` khớp số ghế đã tạo.

**7.4. Tạo suất chiếu**
1. Branch Admin chọn `movie`, `room`, `start_time`.
2. Hệ thống tự tính `end_time = start_time + duration + buffer dọn phòng`.
3. Validate không trùng khung giờ với suất khác cùng `room_id` (constraint UNIQUE + kiểm tra overlap).
4. Đặt `base_price`; giá ghế cuối cùng = `base_price × seat_type.price_multiplier`.
5. `status = scheduled` → mở bán (`open`) theo thời điểm cấu hình trước giờ chiếu.

**7.5. Đặt vé (Booking)**
1. Customer chọn suất chiếu → hệ thống trả sơ đồ ghế còn trống (loại trừ ghế đã có trong `booking_seats` hoặc đang bị "hold").
2. Chọn ghế → hệ thống **hold ghế tạm thời** (TTL ~10 phút, ví dụ lưu ở Redis hoặc bảng `bookings.status=held`).
3. Chọn combo (tuỳ chọn), nhập mã khuyến mãi → hệ thống validate & tính `discount_amount`.
4. Tạo `booking` (status=pending) + `booking_seats` + `booking_combos`.
5. Chuyển sang bước thanh toán.

**7.6. Thanh toán**
1. Hệ thống tạo `payment` (status=pending) gắn với `booking`.
2. Nếu online: redirect cổng thanh toán (VNPay/Momo) → nhận webhook callback.
3. Nếu tại quầy: Employee xác nhận thu tiền mặt, cập nhật `payment.status=success` trực tiếp.
4. Khi `payment.status=success`: cập nhật `booking.status=paid`, sinh `tickets` (1 vé/ghế) kèm `ticket_code`/QR, gửi email/thông báo vé điện tử.
5. Nếu thanh toán thất bại hoặc hết hạn hold: nhả ghế (`booking.status=cancelled`), xoá `booking_seats` hoặc đánh dấu huỷ.

**7.7. Check-in vé**
1. Khách xuất trình QR tại cửa phòng chiếu.
2. Employee quét mã → hệ thống tìm `ticket` theo `ticket_code`, kiểm tra `status=issued` và đúng suất chiếu/thời gian.
3. Cập nhật `status=checked_in`, `checked_in_at`, `checked_in_by`.
4. Vé đã check-in không thể check-in lần 2 (chặn gian lận chia sẻ vé).

**7.8. Hoàn vé**
1. Customer/Employee gửi yêu cầu hoàn cho `booking` (trước giờ chiếu theo chính sách, vd ≥2 giờ).
2. Hệ thống kiểm tra điều kiện (thời gian, trạng thái vé chưa check-in).
3. Branch Admin (hoặc Super Admin nếu vượt hạn mức) duyệt.
4. Cập nhật `booking.status=refunded`, `tickets.status=cancelled`, nhả ghế về trạng thái trống cho suất đó, tạo giao dịch hoàn tiền ở `payments` (status=refunded) hoặc bảng `refunds` riêng nếu cần theo dõi chi tiết hơn.

**7.9. Báo cáo doanh thu**
1. Cron job (hàng ngày) tổng hợp từ `bookings`/`payments`/`tickets` theo `branch_id` + `report_date` → ghi vào `revenue_reports`.
2. Dashboard đọc từ `revenue_reports` (nhanh) thay vì tính real-time trên bảng giao dịch lớn.
3. Super Admin có thể query real-time xuyên chi nhánh khi cần đối soát chi tiết.

---

## 8. Thiết kế Dashboard

### 8.1. Super Admin Dashboard (toàn hệ thống)
- **KPI cards**: Tổng doanh thu (hôm nay/tháng/năm), tổng vé bán, tổng số chi nhánh hoạt động, tổng khách hàng mới.
- **Biểu đồ doanh thu**: line/area chart theo ngày/tháng/năm, có filter khoảng thời gian & so sánh cùng kỳ.
- **Vé bán theo ngày/tháng/năm**: bar chart số lượng vé.
- **Top phim**: bar chart/table top 10 phim theo doanh thu hoặc số vé.
- **Top chi nhánh**: bar chart/table xếp hạng chi nhánh theo doanh thu, tỷ lệ tăng trưởng.
- **Tỷ lệ lấp đầy phòng chiếu**: heatmap theo chi nhánh × khung giờ, hoặc gauge trung bình toàn hệ thống.
- **Top khách hàng**: bảng khách hàng chi tiêu nhiều nhất (loyalty).
- **Doanh thu theo phim**: pie/donut chart tỷ trọng doanh thu theo phim đang chiếu.
- **Bản đồ chi nhánh** (tuỳ chọn): hiển thị vị trí & trạng thái hoạt động từng chi nhánh.

### 8.2. Branch Admin Dashboard (theo chi nhánh)
- **KPI cards**: Doanh thu hôm nay/tháng, vé bán hôm nay, tỷ lệ lấp đầy trung bình, số suất chiếu hôm nay.
- **Biểu đồ doanh thu chi nhánh** theo ngày/tháng.
- **Vé bán theo suất chiếu trong ngày** (bar chart theo giờ chiếu).
- **Top phim tại chi nhánh** (theo doanh thu/vé).
- **Tỷ lệ lấp đầy theo phòng chiếu** của chi nhánh (bar/heatmap theo `room`).
- **Top khách hàng thân thiết của chi nhánh**.
- **Doanh thu combo vs vé** (so sánh tỷ trọng).
- **Lịch suất chiếu sắp tới** + trạng thái bán vé (còn nhiều ghế/sắp hết/hết vé).

---

## 9. Công nghệ đề xuất

### 9.1. Kiến trúc tổng thể

```
[ ReactJS SPA ] ── REST API (JWT Bearer) ──> [ Laravel API ] ──> [ MySQL ]
      │                                            │
      │                                            ├── Redis (cache, seat-hold, queue)
      │                                            ├── Queue Worker (email, sinh báo cáo doanh thu)
      │                                            └── Storage/Cloudinary (poster, avatar)
      │
      └── Realtime (tuỳ chọn): WebSocket/Pusher để cập nhật sơ đồ ghế real-time khi nhiều người cùng đặt
```

- **Frontend**: ReactJS (đã có sẵn ở `cinema-fe`, giữ nguyên kiến trúc feature-based hiện tại).
- **Backend**: Laravel (PHP) triển khai theo layer **Controller → Service → Repository** (tương đồng pattern `controllers/repositories/routes` đang có ở `cinema-be`, chỉ đổi ngôn ngữ/ORM).
- **Database**: MySQL, dùng Eloquent migrations để quản lý schema ở Mục 4.
- **Auth**: Laravel Sanctum (hoặc Passport) phát hành JWT; middleware kiểm tra `role` + `branch_id` cho từng route.
- **RBAC**: gói `spatie/laravel-permission` ánh xạ trực tiếp `roles/permissions/role_permissions` ở Mục 4.
- **Seat locking khi đặt vé**: Redis (`SETNX` + TTL) để giữ ghế tạm, tránh 2 khách chọn trùng ghế.
- **Queue**: Laravel Queue (Redis/database driver) cho gửi email vé điện tử, sinh `revenue_reports` theo cron (`Laravel Scheduler`).
- **Thanh toán**: tích hợp VNPay/Momo qua webhook, verify chữ ký trước khi cập nhật `payments`.
- **API**: REST chuẩn, versioning `/api/v1/...`, response envelope thống nhất, phân trang cursor/offset cho danh sách lớn (phim, booking).

### 9.2. Lưu ý quan trọng — khác biệt với stack hiện tại

Repo hiện tại (`cinema-be`) đang chạy **Node.js + Express + Mongoose (MongoDB)**, dữ liệu phi quan hệ, dùng `Counter.js` tự sinh `id` số nguyên thay vì ObjectId. Việc chuyển sang **Laravel + MySQL** như đề xuất ở trên là một **rewrite backend hoàn toàn**, không phải nâng cấp dần. Trước khi commit theo hướng này, cân nhắc:

| Tiêu chí | Giữ Node.js + MongoDB, mở rộng theo mô hình Company/Branch | Chuyển hẳn sang Laravel + MySQL |
|---|---|---|
| Chi phí | Thấp hơn — tái cấu trúc model/route hiện có, thêm `branch_id`, `Role/Permission` collection | Cao — viết lại toàn bộ API, migrate dữ liệu, retest toàn hệ thống |
| Phù hợp dữ liệu quan hệ chặt (FK, JOIN nhiều bảng cho báo cáo) | Cần tự quản lý tính toàn vẹn (transaction, ref check) ở tầng service | MySQL + FK constraint xử lý tự nhiên, mạnh cho báo cáo/aggregate phức tạp |
| Đội ngũ hiện tại | Đã quen Express/Mongoose (thấy rõ qua test coverage hiện có) | Cần năng lực PHP/Laravel |
| Thời gian ra mắt | Nhanh hơn | Chậm hơn, rủi ro dự án cao hơn |

Nếu mục tiêu là **tài liệu kiến trúc chuẩn/tham khảo lâu dài** hoặc công ty chủ động muốn chuẩn hoá về Laravel/MySQL, giữ đề xuất Mục 9.1. Nếu ưu tiên **triển khai nhanh trên nền code sẵn có**, nên giữ Node/Express/Mongo và áp dụng đúng mô hình dữ liệu ở Mục 4 dưới dạng **schema Mongoose tương đương** (embed hoặc reference `branch_id` trong từng collection, dùng `mongoose-transactions`/session cho các thao tác cần tính toàn vẹn như đặt vé). Đây là quyết định nên thống nhất trước khi bắt đầu implement.
