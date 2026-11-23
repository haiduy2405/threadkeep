# Threadkeep Capture beta / Bản thử nghiệm

This is an unpacked Manifest V3 extension for Chromium browsers. It is not listed in an extension store, has not had an independent security audit, and has not yet been validated against signed-in ChatGPT and Claude accounts. DOM adapters are experimental: synthetic tests cannot establish compatibility with every live layout.

## Cài đặt trên Chrome / Edge / Cốc Cốc

1. Tải `threadkeep-extension-v0.3.0.zip` từ nút **Lưu từ AI** trên Threadkeep, rồi giải nén vào một thư mục riêng.
2. Mở trang quản lý tiện ích của trình duyệt (`chrome://extensions` trên Chrome, `edge://extensions` trên Edge; Cốc Cốc dùng trang quản lý tiện ích tương ứng).
3. Bật **Chế độ dành cho nhà phát triển / Developer mode**, chọn **Tải tiện ích đã giải nén / Load unpacked** và chọn thư mục chứa `manifest.json`.
4. Mở lại Threadkeep hoặc tải lại tab đang mở để nhận cầu nối extension.
5. Mở ChatGPT hoặc Claude, đăng nhập trực tiếp trên website của họ, mở một hội thoại rồi bấm biểu tượng Threadkeep Capture trên thanh công cụ.

### Lưu từng hội thoại

Đặt **nhãn tài khoản** (ví dụ Cá nhân, Công việc; dùng nhãn khác nhau cho từng tài khoản), bấm **Lưu hội thoại đang mở**. Extension lấy văn bản đã tải trên trang, mở Threadkeep và cho bạn kiểm tra trước khi bấm **Thêm vào kho hội thoại**.

### Chọn nhiều hoặc tất cả

Bấm **Tìm hội thoại để lưu**, cấp quyền cho đúng website AI nếu trình duyệt yêu cầu. Mở thanh lịch sử bên website AI trước nếu chưa tìm thấy liên kết. Đánh dấu từng hội thoại hoặc **Chọn tất cả đã tìm thấy**, rồi bấm **Lưu các hội thoại đã chọn**. Extension đọc lần lượt bằng một tab phụ, báo lỗi theo từng hội thoại, và chuyển phần thành công sang Threadkeep để bạn kiểm tra.

**“Tất cả đã tìm thấy” không chứng minh đã lấy đủ toàn bộ tài khoản.** Danh sách tải lười, phân trang, dự án riêng, hội thoại ẩn/lưu trữ, nhánh chưa mở hoặc bố cục mới có thể làm dữ liệu chưa đủ. Mỗi lượt tối đa 100 hội thoại và 8 MB; mỗi hội thoại tối đa 2 MB. Có thể dừng sau hội thoại đang xử lý. Chưa tải file ảnh/âm thanh/video hay các nhánh khác.

## Install (English)

Unzip the download, open your browser's extensions manager, enable Developer mode and use **Load unpacked** to select the folder containing `manifest.json`. Reload Threadkeep after installation. On a signed-in ChatGPT/Claude tab, click the extension toolbar action to open its capture manager.

Give the current account a unique label. Choose **Save current conversation**, or **Find conversations to save**, grant access only to that provider, then select individual conversations or **Select all discovered**. Review the resulting batch in Threadkeep and confirm **Add to library**. This is an experimental DOM text capture, not verified whole-account synchronization.

## Privacy and permissions

- `activeTab` and `scripting` read the tab you invoke the extension on.
- Optional provider-origin access is requested only for scanning/reading other conversation pages. No blanket browsing permission, cookie access, password access, network interception, provider API tokens or unofficial API calls are used.
- The extension bridge runs only on the configured hosted Threadkeep path and the explicit local development origin. It passes a pending batch through browser messaging to the app tab. It does not send conversation content in an HTTP request or URL.
- One pending batch is retained in extension-local storage until the app confirms it was committed. It is not removed when a preview is dismissed. Extension-local data and the web library are separate browser storage areas. Removing the extension may remove pending data.
- Account labels are user-supplied, not verified account identities. Avoid changing signed-in provider accounts during a batch.
- Captures are stored separately from full JSON-export records so a partial page capture cannot overwrite a richer full-export conversation. Older or shorter repeated captures are skipped. This conservative behavior may also skip a legitimate shortened edit; inspect the originals when unsure.
- No remote archive/delete or automatic background capture is included.

## Development

Run `npm run package:extension` from the repository root to copy the shared translation/validation modules and rebuild the dependency-free ZIP. Synthetic Node tests cover source validation, quotas, merging, backups and message boundaries. The local DOM fixture runner is available only with `THREADKEEP_TEST=1` on the development server; it is not enabled in ordinary local serving.
