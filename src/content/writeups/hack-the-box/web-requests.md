---
title: "Web Requests"
description: "Học cách hoạt động của HTTP: methods, headers, status codes, cookies, POST/GET, và CRUD API thông qua cURL và Browser DevTools."
platform: "Hack The Box"
category: "Academy"
difficulty: "Easy"
publishedAt: 2026-09-24
tags: ["web", "http", "curl", "api", "crud", "headers", "cookies", "rest-api"]
language: "vi"
translationKey: "hack-the-box/web-requests"
draft: false
featured: false
---

> Write-up này được thực hiện trong môi trường lab có kiểm soát. Chỉ áp dụng các kỹ thuật bên dưới trên hệ thống mà bạn được phép kiểm thử.

## Tổng quan

Module **Web Requests** trên HTB Academy cung cấp nền tảng về cách HTTP hoạt động — từ cấu trúc request/response, các loại HTTP method, status code, header, cookie, cho đến việc tương tác trực tiếp với REST API bằng cURL.

Đây là kiến thức bắt buộc cho bất kỳ ai học web security, vì mọi cuộc tấn công web đều đi qua HTTP.

---

## HTTP Headers

HTTP headers là metadata đi kèm theo mỗi request và response. Có 5 loại:

| Loại | Hướng | Mục đích |
|------|-------|----------|
| General | Cả hai | Mô tả message |
| Entity | Cả hai | Mô tả body/content |
| Request | Client → Server | Thông tin về client |
| Response | Server → Client | Thông tin về server |
| Security | Server → Client | Chính sách bảo mật |

### Headers quan trọng trong security

**`Host`** — Xác định virtual host. Dễ bị giả mạo để thực hiện password reset poisoning hoặc cache poisoning.

**`Cookie`** — Mang session identifier. Nếu bị đánh cắp → attacker đăng nhập được mà không cần password.

**`Authorization`** — Gửi credentials. Basic Auth chỉ dùng base64 (không encrypt) → dễ decode:

```bash
echo "Y2FybG9zOnBhc3N3b3Jk" | base64 -d
# → carlos:password
```

**`Content-Security-Policy`** — Ngăn XSS bằng cách giới hạn nguồn load script. Nếu cấu hình sai (`unsafe-inline`) → vô tác dụng.

**`Strict-Transport-Security`** — Bắt buộc HTTPS, ngăn SSL stripping attack.

**`Server`** — Tiết lộ phần mềm + version → attacker tra CVE:

```
Server: Apache/2.2.14 (Win32)  →  CVE-2010-0425 (RCE)
```

### Xem headers bằng cURL

```bash
# Chỉ xem response headers (HEAD request)
curl -I https://target.com

# Headers + body
curl -i https://target.com

# Xem mọi thứ (verbose)
curl -v https://target.com

# Set custom User-Agent
curl -A "Mozilla/5.0" https://target.com

# Set header thủ công
curl -H "X-Forwarded-For: 127.0.0.1" https://target.com
```

---

## HTTP Methods

| Method | CRUD | Mô tả | Nguy hiểm nếu |
|--------|------|-------|--------------|
| GET | Read | Lấy data, params trên URL | Params nhạy cảm bị log |
| POST | Create | Gửi data trong body | Thiếu validation |
| PUT | Update | Thay thế toàn bộ record | Không auth → upload shell |
| PATCH | Update | Sửa một phần record | Không filter field |
| DELETE | Delete | Xóa record | Không auth → DoS |
| HEAD | - | Chỉ lấy headers | - |
| OPTIONS | - | Hỏi server hỗ trợ gì | Leak allowed methods |

### GET vs POST

```
GET  → Data trên URL:  /search?q=london&token=secret  ← Bị log, bị leak qua Referer
POST → Data trong body: (ẩn khỏi URL, nhưng Burp vẫn đọc được)
```

POST không phải là "bảo mật hơn" — chỉ là ẩn khỏi URL.

---

## HTTP Status Codes

| Class | Ý nghĩa | Quan trọng với attacker |
|-------|---------|------------------------|
| 1xx | Informational | Ít gặp |
| 2xx | Success | `200` = OK, `201` = Created |
| 3xx | Redirect | `302` = test open redirect |
| 4xx | Client error | `403` vs `404` leak path existence |
| 5xx | Server error | `500` khi inject → có thể có SQLi |

### 403 vs 404 — Điểm khác biệt quan trọng

```
/admin → 403 Forbidden   = Path TỒN TẠI, không có quyền
/admin → 404 Not Found   = Path KHÔNG TỒN TẠI

Best practice: Trả 404 thay vì 403 để ẩn existence của resource.
```

### 500 là signal tấn công

```bash
?id=1     → 200 OK        (bình thường)
?id=1'    → 500 Error     ← SQL error → có thể có SQLi!
```

---

## POST Requests & Cookies

### Login bằng cURL

```bash
# Login cơ bản
curl -X POST -d 'username=admin&password=admin' http://SERVER:PORT/ -i

# Follow redirect sau login
curl -X POST -d 'username=admin&password=admin' http://SERVER:PORT/ -L

# Lưu cookie vào file
curl -X POST -d 'username=admin&password=admin' http://SERVER:PORT/ -c cookies.txt
```

### Dùng session cookie

Sau khi login thành công, server trả về:

```http
Set-Cookie: PHPSESSID=c1nsa6op7vtk7kdis7bcnbadf1; path=/; HttpOnly
```

Dùng cookie này để bypass login:

```bash
# Dùng trực tiếp
curl -b 'PHPSESSID=c1nsa6op7vtk7kdis7bcnbadf1' http://SERVER:PORT/

# Dùng từ file
curl -b cookies.txt http://SERVER:PORT/
```

Đây là nền tảng của **Session Hijacking** — nếu steal được cookie → vào được account mà không cần password.

### Cookie flags bảo mật

| Flag | Chống gì |
|------|---------|
| `HttpOnly` | XSS không đọc được cookie qua JS |
| `Secure` | Chỉ gửi qua HTTPS |
| `SameSite=Strict` | Chống CSRF |

### POST với JSON

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -b 'PHPSESSID=c1nsa6op7vtk7kdis7bcnbadf1' \
  -d '{"search":"london"}' \
  http://SERVER:PORT/search.php
```

`Content-Type: application/json` là bắt buộc — thiếu header này server sẽ parse body sai.

---

## CRUD API

API dạng REST thường map HTTP method với database operation:

| HTTP Method | DB Operation | SQL |
|-------------|-------------|-----|
| GET | Read | SELECT |
| POST | Create | INSERT |
| PUT | Update | UPDATE |
| DELETE | Delete | DELETE |

### Cấu trúc URL

```
/api.php/{table}/{row}

/api.php/city/london   → bảng city, row london
/api.php/city/         → bảng city, tất cả rows
```

### Read — GET

```bash
# Đọc 1 record
curl -s http://SERVER:PORT/api.php/city/london | jq

# Đọc tất cả
curl -s http://SERVER:PORT/api.php/city/ | jq
```

### Create — POST

```bash
curl -X POST http://SERVER:PORT/api.php/city/ \
  -H 'Content-Type: application/json' \
  -d '{"city_name":"HTB_City","country_name":"HTB"}'
```

### Update — PUT

```bash
# Phải chỉ rõ row cần sửa trong URL
curl -X PUT http://SERVER:PORT/api.php/city/london \
  -H 'Content-Type: application/json' \
  -d '{"city_name":"New_City","country_name":"HTB"}'
```

### Delete — DELETE

```bash
curl -X DELETE http://SERVER:PORT/api.php/city/New_City
```

### Verify sau mỗi thao tác

```bash
# Confirm xóa → phải trả []
curl -s http://SERVER:PORT/api.php/city/New_City | jq
# → []
```

---

## API Enumeration — Tìm endpoint khi không biết

Khi nhận được target URL chưa rõ API:

```bash
# 1. Đọc JS source — tìm endpoint hardcoded
curl -s http://TARGET/ | grep -oE "api\.php/[a-zA-Z0-9_/]+"

# 2. Check swagger / docs
curl -s http://TARGET/swagger.json
curl -s http://TARGET/api/docs
curl -s http://TARGET/robots.txt

# 3. Fuzz table name (khi biết có api.php)
ffuf -u http://TARGET/api.php/FUZZ/ \
  -w /usr/share/seclists/Discovery/Web-Content/raft-small-words-lowercase.txt \
  -fr "Incorrect table name"

# 4. OPTIONS — server tự khai method nào được phép
curl -X OPTIONS http://TARGET/api.php/city/ -i
```

---

## WAF Detection

```bash
# Tool tự động
wafw00f https://target.com

# Manual — gửi payload, xem response
curl -i "https://target.com/?q=<script>alert(1)</script>"
# WAF: 403 Forbidden / "Access Denied"

# Check headers đặc trưng
curl -I https://target.com
# CF-RAY: ...       → Cloudflare
# X-Sucuri-ID: ...  → Sucuri
# X-CDN: Imperva    → Imperva
```

---

## Kết luận

Module này cung cấp nền tảng để:

- Hiểu cách HTTP hoạt động ở mức low-level
- Tái tạo bất kỳ request nào bằng cURL thay vì phụ thuộc vào browser
- Phân tích headers để tìm misconfiguration
- Tương tác trực tiếp với REST API (không cần UI)
- Phát hiện WAF và điểm yếu trong authentication flow

Đây là kỹ năng cốt lõi cho web pentesting, bug bounty, và CTF.
