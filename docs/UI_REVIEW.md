# UI Review – Acc Tools FE

Cập nhật: 2026-11-04. Mục đích: tra cứu nhanh hiện trạng giao diện, việc đã làm và việc còn lại.

## 1. Tổng quan kiến trúc style

- Không dùng Tailwind trong thực tế (đã cài nhưng page dùng CSS Modules trong `src/styles/*.module.css`).
- Mỗi page tự định nghĩa bảng màu riêng → **thiếu đồng nhất**:
  | Page | File CSS | Nền / tông màu |
  |---|---|---|
  | Login (`/`) | `Login.module.css` | Gradient xanh navy + teal (token `--finance-*`) |
  | Menu | `menu.module.css` | Gradient xanh navy + teal |
  | Transcoding | `transcoding.module.css` | Trước: xám phẳng `#f4f6fb`, xanh Tailwind `#3b82f6` |
  | Tax lookup | `taxLookup.module.css` | Như trên |
  | File compare | `fileCompare.module.css` | Gradient vàng/xanh dương, nút `#0f6bff` |
  | Invoice | `invoice.module.css` (1826 dòng) | Xám phẳng `#f4f6fb`, nhiều style riêng |
- `globals.css` trước đây rất sơ sài (nền trắng, font Arial, không token).

## 2. Vấn đề phát hiện

1. Bảng màu/nút/card không thống nhất giữa các trang (ba tông xanh khác nhau).
2. Font Arial, không có hierarchy chữ rõ ràng.
3. Menu: card chỉ có icon + tên, `div` có `onClick` (không truy cập được bằng bàn phím).
4. Transcoding / Tax lookup: nền phẳng, card trắng đơn điệu, tiêu đề nhỏ.
5. `module.module.css` trông như file cũ/không dùng (kiểm tra trước khi xoá).
6. Invoice 2499 dòng TSX + 1826 dòng CSS: khó bảo trì, nên tách component.
7. Chưa có dark mode, chưa có `prefers-reduced-motion` (đã bổ sung ở globals).

## 3. Đã thực hiện (2026-11-04)

- `src/app/globals.css`: token màu thương hiệu, font `Inter/Segoe UI`, antialiasing, `box-sizing` toàn cục, focus ring, scrollbar mảnh, tôn trọng reduced-motion.
- `src/styles/menu.module.css` + `src/app/menu/page.tsx`: nền lưới mờ, badge, tiêu đề gradient, card có thanh màu + mô tả + mũi tên "Mở chức năng", mỗi chức năng một tông màu (blue/teal/amber/purple), đổi `div` → `button` (a11y), nút đăng xuất dạng pill.
- `transcoding.module.css`, `taxLookup.module.css`: nền gradient giống menu, card có thanh gradient trên đầu, bóng đổ sâu hơn, tiêu đề lớn/đậm hơn.

### Đợt 2: đăng nhập + icon
- Thêm `src/components/Icons.tsx` (SVG stroke, dùng `currentColor`): Compare, Invoice, Convert, Search, Upload, FileCheck, Arrow, Close, User, Lock, Logout, Logo. Thay toàn bộ emoji (📊🧾🔄🔍📂) và ký tự `←` `✕` ở menu, transcoding, tax-lookup.
- Login (`app/page.tsx`, `Login.module.css`): thanh gradient trên card, badge thương hiệu, icon User/Lock trong ô nhập (đổi màu khi focus), `label htmlFor`, input/nút cao 44px, dòng chân trang.
- Chưa thay icon trong `file/page.tsx` và `invoice/page.tsx` (còn nút text/emoji nếu có).

### Đợt 3 (Giáng sinh)
- Bỏ chữ "Tools Kế Toán" ở badge menu, badge/footer login (còn `metadata.title` trong `layout.tsx` làm tiêu đề tab).
- Con gấu → ông già Noel thuần CSS (class `santa*` trong `Login.module.css`): mũ đỏ + bông, râu trắng, găng tay che mắt khi nhập mật khẩu. Sau Giáng sinh có thể đổi lại bằng git.
- Form login: bỏ giới hạn 320px (rộng hết card), hover/focus input rõ hơn.

### Đợt 4: trang Invoice
- Đăng nhập HĐĐT: gấu → ông già Noel (`santa*`), icon User/Lock trong ô nhập, nền/nút đồng bộ menu.
- Dashboard: nền gradient, sidebar/panel bo 16-18px + thanh gradient, nút menu active dạng gradient, nút đăng xuất kiểu outline đỏ, nút lọc/xuất/đối soát có hover đổ màu, bảng có zebra + hover + header gradient.
- Icon: Menu, Logout, ArrowLeft, Chevron (thu gọn bảng) thay ký tự `>`.
- Toàn bộ style mới nằm ở cuối `invoice.module.css` (khối "Modern theme") – ghi đè, dễ gỡ.
- KHÔNG đụng: `InvoiceViewer.tsx`, các rule `.inv*`, `.signBox`, `.invoiceTable`... (popup xem/in hoá đơn) và kích thước các modal.
- Lint có sẵn lỗi `no-explicit-any` ở `invoice/page.tsx:690`, `InvoiceViewer.tsx` (không phải do đợt này).

### Đợt 5: so khớp file + gom code
- `fileCompare.module.css`: khối "Modern theme" ở cuối (nền, card + thanh gradient, nút, select, bảng); icon Plus/Upload/Swap/Trash/Export/ArrowLeft.
- Gom ông già Noel thành 1 chỗ: `components/Santa.tsx` + `styles/santa.module.css` (dùng ở login và invoice). Hết Giáng sinh chỉ cần sửa/xoá 2 file này + 2 chỗ gọi `<Santa />`.
- Kiến trúc CSS giữ nguyên (1 module/trang). Màu thương hiệu lặp lại dạng hex (#1d4f86, #15365f, #21a58a); nếu muốn đổi theme 1 lần thì thay dần bằng `var(--brand-*)` trong `globals.css`.

### Đợt 6: Light / Dark mode (thử nghiệm)
- `components/ThemeToggle.tsx` (+ `ThemeToggle.module.css`): nút mặt trời/mặt trăng ngay dưới badge "Đã kết nối", lưu lựa chọn ở `localStorage["theme"]`; script nhỏ trong `<head>` (layout.tsx) set trước khi paint để không nháy.
- Cách làm: `html[data-theme="dark"]` dùng `filter: invert(1) hue-rotate(180deg)` (trong `globals.css`), đảo ngược lại cho `img`, `video` và phần tử có thuộc tính `data-keep-light` (ông già Noel, tờ hoá đơn `InvoiceViewer`). Khi in tắt filter.
- Ưu: không phải sửa hàng nghìn dòng CSS hex. Nhược: là "xấp xỉ" – màu nhấn (xanh, đỏ) lệch nhẹ, bóng đổ thành sáng. Nếu muốn dark mode chuẩn: chuyển hex sang biến `var(--...)` rồi định nghĩa 2 bộ giá trị.

## 4. Việc còn lại (đề xuất, theo ưu tiên)

1. (Đã xong) invoice / fileCompare đã đồng bộ.
2. Gom token (màu, radius, shadow) vào `globals.css` và thay các hex lặp lại bằng `var(--...)`.
3. Tạo component dùng chung: `PageHeader` (nút Quay lại + tiêu đề), `Button`, `Card` để bỏ trùng lặp CSS giữa các page.
4. Bảng (`DynamicTable`): sticky header, zebra row, hover row.
5. Trạng thái trống/lỗi/loading đồng nhất (skeleton thay vì chỉ spinner).
6. Cân nhắc dark mode qua `prefers-color-scheme`.
7. Xoá file CSS không dùng (`module.module.css`?) sau khi grep xác nhận.

## 5. Ghi chú cho lần review sau

- Đổi `lang="en"` → `lang="vi"` trong `src/app/layout.tsx` (nội dung tiếng Việt).
- Khi sửa CSS Module, tên class dùng trong TSX phải khớp; `cardTop` đã bị bỏ khỏi menu.
