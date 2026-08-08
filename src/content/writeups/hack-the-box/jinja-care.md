---
title: "Jinja Care"
description: "Khai thác SSTI trong ứng dụng Jinja2 để đọc file flag trên máy chủ."
platform: "Hack The Box"
category: "Web"
difficulty: "Easy"
publishedAt: 2026-08-08
tags: ["web", "ssti", "jinja2", "flask", "python", "file-read"]
language: "vi"
translationKey: "hack-the-box/jinja-care"
draft: false
featured: false
cover: "/images/jinja-care/jinja-care-02.png"
---

> Write-up này được thực hiện trong môi trường lab có kiểm soát. Chỉ áp dụng các kỹ thuật bên dưới trên hệ thống mà bạn được phép kiểm thử.

## Tổng quan

JinjaCare là một ứng dụng quản lý thông tin cá nhân. Trường **Full Name** cho phép nhập dữ liệu tùy ý và hiển thị lại khi lưu hồ sơ. Mục tiêu là kiểm tra cách ứng dụng xử lý input đó và đọc flag từ máy chủ.

Lỗ hổng chính là **Server-Side Template Injection (SSTI)** trong Jinja2. Input của người dùng được đưa vào quá trình render template thay vì chỉ được xem như dữ liệu văn bản.

## Phân tích chức năng

Trong trang **Personal Info**, thử nhập một biểu thức template đơn giản vào trường **Full Name** rồi lưu thay đổi:

![Payload SSTI được nhập vào trường Full Name](https://tameruict.github.io/images/jinja-care/jinja-care-01.png)

```text
{{7*7}}
```

Nếu giá trị hiển thị trở thành `49`, biểu thức đã được thực thi ở phía server. Đây là dấu hiệu input đang được xử lý bởi template engine, không chỉ được escape để hiển thị.

## Giải pháp

### 1. Xác nhận SSTI

Jinja2 sử dụng cặp dấu `{{ ... }}` cho biểu thức. Sau khi payload tính toán trả về kết quả, có thể thử truy cập các object Python có sẵn trong context để tìm đường tới module hệ thống.

### 2. Đọc flag bằng SSTI

Trong challenge này, payload đọc file được dùng trong trường **Full Name** là:

```text
{{__import__('os').popen('cat /flag.txt').read()}}
```

Sau khi lưu hồ sơ, nội dung lệnh được render trực tiếp vào trang. Kết quả thu được là flag:

![Flag hiển thị trên chứng chỉ JinjaCare](https://tameruict.github.io/images/jinja-care/jinja-care-02.png)

```text
HTB{V3ry_e4sy_sst1_r1ght?}
```

Payload trên chỉ phù hợp với context của challenge. Trong các ứng dụng Jinja2 khác, `__import__` có thể không được expose; khi đó cần phân tích context và sandbox cụ thể thay vì giả định mọi payload đều hoạt động.

## Phân tích nguyên nhân

Lỗi không nằm ở việc thiếu kiểm tra ký tự đơn lẻ, mà ở việc ứng dụng coi dữ liệu người dùng như một phần của template. Khi template engine được phép đánh giá expression, attacker có thể đi từ phép tính đơn giản tới truy cập object, gọi hàm và đọc file tùy theo context.

## Phòng thủ

- Không ghép input của người dùng vào template source. Truyền input qua biến và render bằng context an toàn.
- Escape output theo đúng ngữ cảnh HTML; không dùng việc blacklist một vài chuỗi SSTI làm biện pháp chính.
- Dùng sandbox của Jinja2 khi phải render template động, đồng thời giới hạn object và callable được phép truy cập.
- Chạy ứng dụng với tài khoản ít quyền, giới hạn quyền đọc các file chứa secret và flag.
- Thêm kiểm thử bảo mật cho các input point có khả năng đi qua template engine; theo dõi các pattern như `{{`, `${` và các chuỗi truy cập object bất thường.

## Bài học

SSTI có thể bắt đầu bằng một phép tính rất đơn giản nhưng nhanh chóng trở thành arbitrary code execution hoặc file read. Khi thấy input được render lại, cần kiểm tra template engine trước khi thử các hướng khai thác khác.
