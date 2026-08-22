# UI Guide — Chi tiết giao diện & thao tác theo từng vai trò (Role)

Tài liệu này mô tả **chi tiết từng màn hình** của `cinema-fe`: layout dùng, cột bảng, trường form, validate, nút bấm, trạng thái/badge, và **quyền (permission code)** gác từng nút — lấy trực tiếp từ code hiện tại (`src/features/**`, `src/components/**`). Xem [`README.md`](README.md) để biết luồng nghiệp vụ tổng thể; tài liệu này chỉ nói về UI.

> Quy ước đọc bảng: cột **"Cần quyền"** ghi permission code thực (vd. `employee.create`) — nút/menu chỉ hiện khi `usePermissions().hasPermission(code)` trả về true; **"—"** nghĩa là không gác quyền (public hoặc chỉ cần đăng nhập).

---

## 0. Design system & thành phần dùng chung

| Thành phần | File | Ghi chú |
|---|---|---|
| `Button` | `components/ui/Button.tsx` | Biến thể `danger` (đỏ accent, dùng cho hành động chính/nổi bật kiểu "Thêm", "Xác nhận"), `secondary`, `ghost` (icon-only trong bảng); có prop `loading` tự hiện spinner + disable |
| `Modal` | `components/ui/Modal.tsx` | Popup giữa màn hình, có `title`, đóng bằng nút X hoặc click nền; toàn bộ form Thêm/Sửa trong back-office đều nằm trong Modal, không có trang riêng |
| `DataTable` | `components/ui/DataTable.tsx` | Bảng chuẩn cho mọi danh sách quản trị: nhận `headers: string[]`, children là `<tr>` |
| `Pagination` | `components/ui/Pagination.tsx` | Điều hướng trang, dùng cùng `DEFAULT_PAGE_SIZE` cho hầu hết danh sách |
| `Badge` | `components/ui/Badge.tsx` | Nhãn trạng thái màu: `success` (xanh), `warning` (vàng), `default` (xám) |
| `Select` / `Input` / `Textarea` | `components/ui/*` | Field chuẩn, dùng với Formik qua `<Field as={Input} .../>` |
| `EmptyState` | `components/feedback/EmptyState.tsx` | Hiện khi danh sách rỗng (icon + tiêu đề + mô tả) |
| `confirmDialog()` | `features/notifications/confirm.ts` | Hộp thoại xác nhận trước hành động phá hủy (Khóa, Xóa, Hủy, Reset mật khẩu…) — trả `Promise<boolean>`, hành động **không chạy** nếu người dùng bấm Hủy |
| `toast` | `features/notifications/toast.ts` | Thông báo góc màn hình sau mỗi thao tác (success/error), dùng `getApiErrorMessage()` để dịch lỗi backend |

Mọi form Thêm/Sửa dùng **Formik**, lỗi validate chỉ hiện **sau khi bấm Submit lần đầu** (`formik.submitCount > 0`) — gõ sai trước đó không bị chê ngay.

---

## 1. Ba layout & điều hướng

### 1.1 Public (`Header` + `Footer`)
Header cố định, trong suốt khi ở top, đổ bóng khi cuộn (`isScrolled`). Cấu trúc trái → phải:
`Logo` · `[Đặt vé ngay]` (nút đỏ nổi, ẩn trên mobile ở vị trí này) · … · `Trang chủ` · `Phim ▾` (mega-menu hover, ẩn khi rời chuột) · `Rạp ▾` (dropdown hover) · `[Đặt vé ngay]` (bản mobile) · 🌐 ngôn ngữ · vùng tài khoản.

Vùng tài khoản:
- Chưa đăng nhập → nút viền "Đăng nhập" → `/Login`.
- Đã đăng nhập → avatar + tên → dropdown: *Xem hồ sơ*, *Vé của tôi*, *Đổi mật khẩu*, (**nếu role ∈ Super Admin/Branch Admin**) *Quản lý* → `/Show`, *Đăng xuất* (gọi API logout, clear Redux + React-Query cache, toast, điều hướng `/`).

Dưới `md`: toàn bộ menu gập vào panel full-height trượt từ trên xuống (hamburger ⇄ X), body khóa scroll khi mở.

### 1.2 AccountLayout — khu vực tài khoản cá nhân (Customer)
Header/Footer công khai bọc ngoài + layout 2 cột: **sidebar trái sticky** (avatar, tên, email + 3 mục *Hồ sơ / Vé của tôi / Đổi mật khẩu*) và **nội dung phải**. Tiêu đề trang có thanh màu accent bên trái (`<span class="h-6 w-1.5 bg-accent">`).

### 1.3 AdminLayout — back-office (Super Admin / Branch Admin / Employee)
```
┌──────────────┬─────────────────────────────────────────────┐
│ Logo          │                          🌐  [avatar ▾ Tên] │
│               ├───────────────────────────────────────────── │
│ 📊 Dashboard  │  Quản lý › <breadcrumb>      Xin chào, <tên> │
│ ...menu...    ├───────────────────────────────────────────── │
│ (theo role)   │                                               │
│               │              <nội dung trang>                │
└──────────────┴─────────────────────────────────────────────┘
```
- Sidebar 64 (16rem) cột trái, item active có viền trái màu accent + nền mờ.
- Dropdown avatar ở topbar chỉ có **Đăng xuất** (khác Header công khai — không có "Xem hồ sơ" ở đây).
- Không có Footer.

---

## 2. UI công khai & Customer — chi tiết từng trang

### 2.1 Trang chủ `/`
`home/pages/HomePage.tsx` ghép 4 khối:
1. **`BannerSlider`** — slider poster phim nổi bật, auto-play, click → `/Detail/:id`.
2. **`QuickBooking`** — form nhanh: chọn phim → chọn rạp → chọn suất → nút "Đặt vé" nhảy thẳng vào luồng đặt vé.
3. **`MovieTabsSection`** — tab "Đang chiếu" / "Sắp chiếu", lưới poster (component `MovieGridCard`), mỗi thẻ có nút ❤️ thích nhanh (yêu cầu đăng nhập).
4. **`TopCinemasSection`** — carousel rạp nổi bật (xếp hạng theo lượt đặt vé + rating trung bình các phim đã chiếu), thẻ `CinemaCard`.

### 2.2 Chi tiết phim `/Detail/:id`
`movie-detail/pages/MovieDetailPage.tsx`:
- `BannerDetail` — poster lớn, tên phim, thể loại (chip), thời lượng, ngày khởi chiếu, quốc gia, nút ❤️ Thích (đếm số lượt thích realtime), nút "Đặt vé ngay".
- `MovieBackdrop` — ảnh nền mờ phía sau banner.
- Trailer video (`video-react`).
- Mô tả phim, đạo diễn/diễn viên (avatar + tên, click xem thêm).
- `MovieShowtimes` — danh sách suất chiếu **nhóm theo rạp** rồi theo ngày/giờ; click một suất → thẳng vào `/BookSeat` (bỏ qua bước chọn lại nếu đã ở đây).
- `NowShowingSidebar` — danh sách phim đang chiếu khác (gợi ý).
- `MovieReviews` — khối đánh giá:
  - Trung bình sao + tổng số đánh giá.
  - Form viết đánh giá (`StarRatingInput` 1–5 sao + textarea) — **chỉ hiện nếu đã đăng nhập**; gửi lại (submit lần 2) sẽ **cập nhật** đánh giá cũ thay vì tạo mới.
  - Mỗi đánh giá (`CommentItem`): avatar, tên, sao, nội dung, thời gian, nút **Trả lời** (tạo reply lồng), `ReactionBar` (👍/❤️ toggle, đếm số), nút **Báo cáo** (chọn lý do) cho bài của người khác, nút **Sửa/Xóa** chỉ hiện trên bài của chính mình.

### 2.3 Chi tiết rạp `/Cinema/:id`
`cinema-detail/pages/CinemaDetailPage.tsx`: `CinemaBannerDetail` (tên, địa chỉ, badge trạng thái, nút ♡ Yêu thích rạp), `CinemaMoviesSection` (phim đang chiếu tại rạp này), `CinemaReviews` (đánh giá riêng cho rạp, cùng cơ chế react/reply/report như đánh giá phim).

### 2.4 Danh sách `/Playing`, `/Upcoming`, `/Cinemas`
Lưới thẻ có phân trang, `Upcoming` không cho bấm đặt vé (chưa mở bán).

### 2.5 Luồng đặt vé (4 bước — `BookingSteps` thanh tiến trình trên cùng mọi trang)

**Bước 1 — `/BookTicket/:id`**
- Chưa đăng nhập → toast lỗi + redirect `/Login` ngay khi vào trang (không cho xem).
- Tab ngang các **ngày có suất chiếu** (định dạng "Th 2 · 12/08").
- Chip giờ chiếu cho ngày đã chọn; giờ đã qua trong ngày hôm nay tự động ẩn (`getAvailableTimes`).
- Nút "Đặt vé" disable tới khi chọn đủ ngày + giờ.

**Bước 2 — `/BookSeat`**
- **Sơ đồ ghế**: hàng theo chữ cái, ghế đánh số, màu theo loại (Standard/VIP/Couple), ghế đã bán mờ + không click được, ghế đang chọn viền trắng + phóng to nhẹ. Hover hiện tooltip loại ghế. Giá mỗi ghế (`price`) do backend trả về trong `GET /bookseat/:scheduleId`, tính bởi Pricing Rule engine (branch, room type, seat type, thể loại phim, ngày trong tuần/weekend/holiday, khung giờ chiếu, membership level) — Frontend không tự tính giá.
- **Panel bên phải**:
  - Danh sách **combo** (ảnh, tên, giá, nút +/− số lượng).
  - Ô **mã voucher** — nút "Áp dụng" gọi validate realtime (`POST /voucher/validate`); đúng → hiện số tiền giảm màu accent; sai → lỗi đỏ dưới ô.
  - Tổng tiền hiển thị = tổng giá ghế (từ backend) + combo − giảm giá voucher. Khi thanh toán, backend tính lại toàn bộ (giá ghế + combo + voucher) từ dữ liệu server-side và bỏ qua mọi `totalPrice`/`discountAmount` mà client gửi lên.
  - Nút "Thanh toán" → mở **Modal MoMo**: hiện QR/nút chuyển sang MoMo; sau khi quay lại app tự gọi xác nhận (`/MomoPayment/confirm`).
- Chưa chọn ghế nào → nút Thanh toán disable, toast nhắc "Chọn ghế trước".

**Bước 3/4 — `/PaymentResult`**
- Trang kết quả: icon ✅/❌, thông tin vé, nút "Xem vé của tôi" → `/MyBookings`, hoặc "Về trang chủ".

### 2.6 `/MyBookings` (trong AccountLayout)
- Lưới thẻ 2 cột (responsive 1 cột mobile), mỗi thẻ:
  - Poster phim, tên phim, **badge trạng thái** (màu theo `INVOICE_STATUS_META`: đã đặt/đã thanh toán/đã hủy/đã hoàn tiền…).
  - Ngày giờ chiếu, ghế + loại ghế, mã vé, số tiền giảm (nếu có voucher), tổng tiền.
  - **Mã QR** (`QRCodeSVG`) bên cạnh 2 nút: **In vé** (`window.print()`, CSS `@media print` ẩn header/footer) và **Hủy** — nút Hủy chỉ hiện khi hóa đơn còn ở trạng thái "đã đặt" (server sẽ tự chặn nếu suất chiếu còn dưới 2 giờ, kèm `confirmDialog` xác nhận trước khi gửi).
- Rỗng → `EmptyState` icon vé.

### 2.7 Xác thực (Auth)
| Trang | Route | Trường | Ghi chú |
|---|---|---|---|
| Đăng ký | `/Register` | Email, Mật khẩu, Nhập lại mật khẩu | Check email tồn tại trước khi tạo (`checkEmailMutation`); tạo xong tự chuyển `/verifycode?email=` |
| Xác thực OTP | `/verifycode` | 6 ô số riêng lẻ (auto-focus ô kế) | Nút "Gửi lại mã" (đếm ngược), lỗi hiện dưới form |
| Hoàn tất hồ sơ | `/UserInfo` | Tên, SĐT, … | Tra theo email trong query string |
| Đăng nhập | `/Login` | Email, Mật khẩu | |
| Quên mật khẩu | `/ForgotPassword` → `/ResetPassword` | Email → (OTP, mật khẩu mới, nhập lại) | |
| Đổi mật khẩu | `/ChangePassword` | Mật khẩu hiện tại, mật khẩu mới, nhập lại | Yêu cầu đăng nhập |
| Hồ sơ | `/Profile` | Tên, SĐT, avatar (upload) | |

---

## 3. Super Admin — chi tiết từng trang quản trị

Tất cả nằm trong `AdminLayout`, không giới hạn theo rạp.

### 3.1 `/AdminDashboard`
6 thẻ số liệu (lưới 2/3/6 cột responsive): **Tổng doanh thu**, **Tổng người dùng**, **Tổng chủ rạp (owner)**, **Tổng số rạp**, **Tổng vé đã bán**, **Tổng giao dịch**. Bên dưới: `BarChart` (Recharts) doanh thu theo ngày — cột màu đỏ accent (`#C1121F`), nền tooltip tối; rỗng → `EmptyState`.

### 3.2 `/ShowUser` — Quản lý người dùng
| Cột bảng | Nội dung |
|---|---|
| ID, Tên, SĐT, Email | |
| Role | **`<Select>` đổi role trực tiếp trong bảng** (Admin/User/Theater — không có Employee trong danh sách đổi nhanh này) |
| Trạng thái | Badge Active/Inactive + badge vàng "Chờ duyệt" nếu là owner (`role === owner`) chưa được duyệt (`!approved`) |
| Hành động | Nút **Duyệt** (chỉ owner chưa duyệt) · icon 🗑 **Xóa** (link trang xác nhận riêng `/Delete/:id`) · icon 🔓/🔒 **Khóa/Mở khóa** (link `/BlockUser/:id`, `/UnBlockUser/:id`) |

Có phân trang (`DEFAULT_PAGE_SIZE`).

### 3.3 `/Show` — Quản lý phim
Modal **Thêm phim** (`Add.tsx`) — form nhiều trường nhất trong hệ thống:
- Tên phim, **Poster** (upload file ảnh), Ngày khởi chiếu (date), Quốc gia, Mô tả (textarea), **Trailer** (upload file ảnh/video), Nhà sản xuất + avatar nhà sản xuất.
- **Đạo diễn**: chọn nhiều bằng checkbox từ danh mục chung.
- **Diễn viên**: checkbox chọn diễn viên → khi tick, hiện thêm 2 field phụ **Vai diễn (character name)** và checkbox **Vai chính (is_lead)** cho từng diễn viên đã chọn.
- **Thể loại**: checkbox chọn nhiều.
- Validate bằng Zod schema (`buildMovieSchema`), lỗi hiện dưới từng nhóm checkbox nếu chưa chọn gì.
- Sửa/Xóa dùng component riêng `Edit.tsx` / `Delete.tsx`, danh sách render qua `ListItem.tsx`.

### 3.4 `/ShowSchedule` — Lịch chiếu toàn hệ thống
- 2 bộ lọc `<Select>` đầu trang: **Rạp**, **Phòng** (Phòng tự lọc theo Rạp đã chọn).
- Nút **Thêm suất chiếu** mở form (`schedules/components/Add.tsx`): chọn phim, phòng, ngày, giờ bắt đầu/kết thúc, giá.
- Bảng: ID, Phim, Rạp, Phòng, Giờ bắt đầu, Giờ kết thúc, Ngày, Giá, **Badge trạng thái** (Active/Cancelled), nút **Hủy suất chiếu** (`confirmDialog` trước khi gọi API, chỉ hiện nếu chưa bị hủy).
- *(Trang này dùng chung cho cả Super Admin và Branch Admin — quyền tạo/hủy suất chiếu do `canManageShowtimes = role ∈ {admin, owner}` quyết định trên UI, server enforce lại bằng `schedule.create`/`schedule.cancel` + branch scope.)*

### 3.5 `/AdminCinemas` — Quản lý rạp toàn hệ thống
- Nút đỏ nổi bật **"Thêm quản trị viên rạp"** mở Modal **tạo Branch Admin + Rạp cùng lúc** — 7 trường: Email, Mật khẩu, Tên, SĐT, **Tên rạp** (bắt buộc), Địa chỉ, Thành phố. Validate: email/mật khẩu (≥6 ký tự)/tên rạp bắt buộc.
- Bảng: ID, Avatar chủ rạp, Tên rạp, ID chủ sở hữu, Địa chỉ + Thành phố, **Badge trạng thái** (Pending/Active/Blocked — màu theo `CINEMA_STATUS_META`), 3 nút hành động text-link: **Duyệt** (ẩn nếu đã approved), **Khóa** (ẩn nếu đã blocked, có `confirmDialog`), **Xóa** (luôn hiện, có `confirmDialog`).
- **Realtime**: khi có sự kiện "rạp mới chờ duyệt" từ socket (`cinemaPendingVersion`), danh sách tự invalidate & refetch — admin thấy rạp mới ngay không cần F5.

### 3.6 `/AdminActors`, `/AdminDirectors`
Giống nhau về cấu trúc: bảng (ID, Tên đầy đủ, Quốc tịch, Hành động **Xóa**) + Modal Thêm gồm: Tên đầy đủ*, Avatar URL, Quốc tịch, Ngày sinh (date), Tiểu sử (textarea). Không có chức năng Sửa trên UI hiện tại (chỉ Thêm/Xóa).

### 3.7 `/AdminTransactions` — Giao dịch toàn hệ thống
Bảng: ID, Mã hóa đơn, Email khách, Phim, Ghế, Tổng tiền, **Badge trạng thái** (theo `INVOICE_STATUS_META`), nút **Hoàn tiền** (chỉ hiện khi hóa đơn ở trạng thái "đã đặt/booked"; `confirmDialog` trước khi gọi — hoàn tiền sẽ mở lại ghế cho người khác đặt).

### 3.8 `/AdminReviews` — Kiểm duyệt đánh giá
Bảng: ID, Đối tượng (tên phim, hoặc "Rạp: <tên>" nếu là đánh giá rạp), Số sao (★★★★☆ dạng text lặp ký tự), Nội dung (rút gọn 1 dòng), Trạng thái (Ẩn/Hiển thị + badge đỏ 🚩 kèm số lượt report nếu có), nút **Ẩn** (chỉ hiện nếu đang hiển thị, không cần confirm) và **Xóa** (luôn hiện, có `confirmDialog`).

---

## 4. Branch Admin ("Owner") — chi tiết từng trang

Cùng `AdminLayout`, dữ liệu **luôn lọc theo rạp mình sở hữu** — server chặn thật (`requireBranchOwnership`), UI chỉ hiển thị đúng phần được phép.

### 4.1 `/OwnerDashboard`
- `<Select>` lọc theo từng rạp cụ thể hoặc "Tất cả rạp của tôi" (`allMyCinemas`).
- 4 thẻ số liệu: **Doanh thu**, **Vé đã bán**, **Tỉ lệ lấp đầy (%)**, **Số suất chiếu**.
- `BarChart` doanh thu theo ngày (giống Admin Dashboard nhưng chỉ tính rạp của họ).
- **Realtime**: khi có booking mới ở rạp mình (`ownerBookingVersion`), dashboard tự refetch số liệu.

### 4.2 `/OwnerCinemas`
Bảng đơn giản: ID, Tên, Địa chỉ, Thành phố, Badge trạng thái, nút **"Quản lý phòng"** → `/OwnerCinemas/:branchId/Rooms`. (Không có nút Sửa/Xóa rạp ở đây — Branch Admin chỉnh sửa thông tin liên hệ/hoạt động rạp qua API riêng, chưa có form UI tương ứng trong danh sách này.)

### 4.3 `/OwnerCinemas/:branchId/Rooms` — Phòng chiếu & Sơ đồ ghế
- `<Select>` chọn rạp (auto-chọn rạp đầu tiên nếu chưa có param).
- Nút **Thêm phòng** (disable nếu chưa chọn rạp) → Modal 1 trường: Tên phòng*.
- Bảng phòng: ID, Tên, hành động **"Sơ đồ ghế"** (mở Modal riêng) và **Xóa** (`confirmDialog`).
- **Modal Sơ đồ ghế** (`SeatMapModal`) — 2 phần:
  1. Form **sinh sơ đồ ghế** (4 trường trên 1 hàng): **Danh sách hàng** (nhập kiểu `A,B,C,D,E`), **Số ghế/hàng** (number), **Hàng VIP** (vd. `A`), **Hàng Couple** (vd. để trống). Bấm "Sinh sơ đồ" → `confirmDialog` cảnh báo **sẽ tạo lại toàn bộ ghế** (ghi đè sơ đồ cũ) → gọi API generate.
  2. Bên dưới: **lưới ghế trực quan** — mỗi ghế là 1 nút màu theo loại (VIP/Couple/Standard), ghế đã khóa hiện xám + gạch ngang chữ. **Click 1 ghế = toggle khóa/mở khóa ngay lập tức** (không cần modal phụ) — dùng để tạm ẩn ghế hỏng khỏi sơ đồ bán vé.

### 4.4 `/OwnerCombos`
Nút **Thêm combo** → Modal: **Rạp*** (Select), Tên món*, Mô tả*, Giá* (number, phải > 0). Bảng: ID, Rạp, Tên, Giá (đ), Badge Active/Inactive, nút **Kích hoạt/Ngừng bán** (toggle 1 click, không confirm) + **Xóa** (`confirmDialog`).

### 4.5 `/OwnerVouchers`
Nút **Thêm voucher** → Modal: **Rạp***, **Mã voucher***, **Loại giảm giá** (Select: % hoặc Số tiền cố định), **Giá trị giảm*** (validate: nếu % phải 1–100, nếu tiền cố định phải >0), **Đơn tối thiểu*** (≥0). Bảng: ID, Rạp, Mã, Giảm giá (hiện `%` hoặc `đ` tùy loại), **Đã dùng** (vd. `12/50` nếu có giới hạn lượt), Badge Active/Inactive, nút Kích hoạt/Ngừng + Xóa.

### 4.6 `/OwnerBookings` — Tra cứu vé
Ô nhập mã vé (tự viết HOA) + nút **Tìm kiếm**. Kết quả hiện thẻ thông tin: Mã vé, Phim, Rạp, Suất chiếu (ngày · giờ), Ghế (kèm loại ghế), Trạng thái, Tổng tiền. Không tìm thấy → thông báo đỏ dưới form.

### 4.7 `/OwnerEmployees`
- `<Select>` chọn rạp (nếu sở hữu nhiều rạp).
- Nút **Thêm nhân viên** (chỉ hiện nếu có quyền `employee.create`) → Modal 6 trường: **Rạp*** (Select), **Email*** , **Mật khẩu*** (≥6 ký tự), Tên, SĐT, **Chức danh (Position)*** (Select — danh sách 8 vị trí từ `usePositions()`: Ticket Staff, Cashier, Combo Staff, Ticket Checker, Customer Service, Security, Cleaning Staff, Maintenance Staff).
- Bảng: ID, **Mã nhân viên** (employee_code tự sinh), Tên, Email, **Chức danh**, Badge trạng thái, hành động:
  - Đang hoạt động → nút **Vô hiệu hóa** (`employee.delete`, có confirm) — *đây là "xóa mềm", không xóa hẳn record*.
  - Đã vô hiệu hóa → nút **Kích hoạt lại** (`employee.update`, không confirm).
  - Luôn có nút **Reset mật khẩu** (`employee.update`, có confirm — hệ thống gửi mật khẩu mới qua email nhân viên).

---

## 5. Employee — chi tiết từng trang

Sidebar rút gọn tối đa; nút bấm ẩn/hiện theo permission thật (không phải role cứng) — xem bảng năng lực theo Position ở [`README.md`](README.md#65-employee--on-site-staff-employeedashboard).

### 5.1 `/EmployeeDashboard`
- 2 nút nhanh trên cùng: **"Bán vé"** (nếu có `booking.create`) và **"Check-in"** (nếu có `ticket.checkin`).
- Bảng suất chiếu **hôm nay** tại rạp mình: Phim, Phòng, Giờ (bắt đầu–kết thúc), Giá, cột Hành động có nút "Bán vé" theo từng dòng (điều hướng sang Counter Sale kèm `?scheduleId=`) — chỉ hiện nếu có quyền bán vé.
- Không có suất chiếu hôm nay → `EmptyState`.

### 5.2 `/EmployeeCounterSale` — Bán vé tại quầy
Luồng 3 bước trên 1 trang (không có bước "thanh toán online" — đây là bán trực tiếp):
1. **Chọn suất chiếu** (`<Select>`, nhãn "Tên phim — ngày giờ") → chọn xong hiện lưới ghế của suất đó.
2. **Chọn ghế**: nút vuông theo mã ghế, màu theo loại, ghế đã bán mờ+disable, ghế chọn có viền accent — có thể chọn nhiều ghế cùng lúc (đặt hộ nhiều vé 1 lần).
3. **Tìm khách hàng**: ô nhập email + nút "Tìm khách hàng" — tra theo tài khoản đã đăng ký (`findAccountByEmail`); tìm thấy hiện chữ xanh xác nhận, không thấy → toast lỗi. Bắt buộc phải có `customerAccountId` mới bán được (vé phải gắn với 1 tài khoản khách hàng có sẵn, nhân viên **không** tạo tài khoản mới tại quầy).
4. Tổng tiền tính tự động theo ghế đã chọn × hệ số loại ghế × giá vé của suất.
5. Nút **"Xác nhận bán vé"** disable tới khi đủ: đã chọn suất + ít nhất 1 ghế + đã xác định khách hàng. Bán xong tự reset form (ghế, email) để bán vé tiếp theo.

### 5.3 `/EmployeeCheckIn` — Check-in tại cửa
- Ô nhập **mã vé** (tự viết HOA khi gõ) + nút **Tra cứu**.
- Không tìm thấy → dòng chữ đỏ "Không tìm thấy".
- Tìm thấy → thẻ thông tin: Tên phim, Tên rạp, Ngày giờ chiếu, Mã ghế, và **Badge trạng thái**: *Đã check-in* (xanh) / *Đã thanh toán* (mặc định) / *Chưa thanh toán* (mặc định).
- Nút **"Xác nhận Check-in"** — **disable nếu đã check-in rồi HOẶC chưa thanh toán** (không cho check-in vé chưa trả tiền). Sau khi check-in thành công, tự tra cứu lại để cập nhật badge ngay trên màn hình.

---

## 6. Bảng tổng hợp nút bấm theo quyền (permission code)

Tổng hợp nhanh những nút/hành động **quan trọng nhất** và permission gác chúng — hữu ích khi cần biết "tại sao nút này không hiện":

| Hành động UI | Trang | Permission gác |
|---|---|---|
| Thêm/Sửa/Xóa phim | `/Show` | `movie.create` / `movie.update` / `movie.delete` |
| Thêm suất chiếu / Hủy suất chiếu | `/ShowSchedule` | `schedule.create` / `schedule.cancel` |
| Duyệt / Khóa / Xóa rạp | `/AdminCinemas` | `branch.activate` / `branch.disable` / `branch.delete` |
| Tạo Branch Admin | `/AdminCinemas` | `branchAdmin.create` |
| Sửa thông tin rạp | `/OwnerCinemas` | `branch.update` (branch-scoped) |
| Tạo/Sửa/Xóa phòng, sinh sơ đồ ghế | `Rooms` | `room.create`/`room.update`/`room.delete`, `seat.create`/`seat.update` |
| Thêm/Sửa/Xóa combo | `OwnerCombos` | `combo.create`/`combo.update`/`combo.delete` |
| Thêm/Sửa/Xóa voucher | `OwnerVouchers` | `voucher.create`/`voucher.update`/`voucher.delete` |
| Thêm/Vô hiệu hóa/Reset mật khẩu nhân viên | `OwnerEmployees` | `employee.create` / `employee.delete` / `employee.update` |
| Bán vé tại quầy | `EmployeeCounterSale` | `booking.create` + `payment.create` |
| Check-in vé | `EmployeeCheckIn` | `ticket.checkin` |
| Hoàn tiền giao dịch | `AdminTransactions` | `booking.admin` |
| Ẩn/Xóa đánh giá | `AdminReviews` | `review.moderate` |
| Đổi role / Duyệt / Khóa / Xóa user | `ShowUser` | `user.update` / `user.approve` / `user.block` / `user.delete` |

---

## 7. Ghi chú thiết kế & hành vi chung

- **Không có trang 403 riêng** — nếu vào nhầm route theo role, `RequireRole` chỉ toast "Access denied" và redirect về `/`; nút/menu bị ẩn trước đó nên trường hợp này hiếm khi xảy ra qua UI, chỉ xảy ra khi gõ thẳng URL.
- **Xác nhận trước khi phá hủy**: mọi hành động khóa/xóa/hủy/reset đều qua `confirmDialog()` — trừ "Kích hoạt/Ngừng bán" (toggle 2 chiều, không phá hủy) và "Ẩn đánh giá"/"Duyệt" (hành động thuận, không cần xác nhận).
- **Toast luôn đi kèm mỗi thao tác ghi** (thành công màu xanh, lỗi màu đỏ dịch từ mã lỗi backend qua `getApiErrorMessage`).
- **Không rời trang khi submit lỗi** — Formik giữ nguyên dữ liệu đã nhập, chỉ hiện lỗi dưới field liên quan.
- **Đơn vị tiền**: luôn hiển thị `toLocaleString()` kèm hậu tố "đ" (không có dấu thập phân).
- **Đa ngôn ngữ**: mọi label/placeholder/lỗi trong tài liệu này lấy từ khóa i18next tương ứng trong `src/locales/{ngôn ngữ}/{admin,owner,employee,booking,auth,...}.json` — đổi ngôn ngữ ở Header/AdminLayout áp dụng ngay cho toàn bộ UI kể trên.
