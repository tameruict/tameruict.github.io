---
title: "Starting Point: Meow"
description: "Ghi chú nhập môn về enumeration, dịch vụ Telnet và cách giữ bằng chứng trong quá trình làm lab."
platform: "Hack The Box"
category: "Linux"
difficulty: "Easy"
publishedAt: 2026-07-29
tags: ["enumeration", "telnet", "linux"]
draft: false
featured: true
---

> Đây là bài mẫu để anh kiểm tra giao diện. Hãy thay nội dung bằng quá trình giải của anh trước khi public chính thức.

## Tóm tắt

Mục tiêu của bài là xây dựng một quy trình enumeration ngắn, có thể lặp lại và dễ kiểm chứng. Mọi kết luận đều đi kèm command hoặc output liên quan.

## Enumeration

Bắt đầu bằng một lượt quét cổng cơ bản:

```bash
nmap -sC -sV -oN scans/initial.nmap 10.10.10.10
```

Khi thấy một dịch vụ lạ, ưu tiên trả lời ba câu hỏi:

1. Dịch vụ nào đang lắng nghe?
2. Phiên bản có được lộ ra không?
3. Cơ chế xác thực có cho phép truy cập mặc định hoặc ẩn danh không?

## Ghi chú khai thác

Lưu command đã chạy vào cùng thư mục với write-up. Với script dài, đặt file trong `public/files/` rồi thêm đường dẫn tải xuống thay vì dán toàn bộ vào bài.

```text
scans/
  initial.nmap
  full-tcp.nmap
notes.md
```

## Bài học

- Không bỏ qua các giao thức cũ chỉ vì chúng trông đơn giản.
- Ghi lại output ngay khi phát hiện manh mối.
- Không public flag, VPN config, token hoặc địa chỉ lab còn hiệu lực.
