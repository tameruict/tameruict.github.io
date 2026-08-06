---
title: "Jinja Care"
description: "Khai thác SSTI (Server-Side Template Injection) trong Flask/Jinja2 để RCE và leo thang đặc quyền."
platform: "Hack The Box"
category: "Web"
difficulty: "Easy"
publishedAt: 2026-08-06
tags: ["web", "ssti", "jinja2", "flask", "python", "rce", "template-injection"]
language: "vi"
translationKey: "hack-the-box/jinja-care"
draft: true
featured: false
---

> Write-up này được thực hiện trong môi trường lab có kiểm soát. Chỉ áp dụng các kỹ thuật bên dưới trên hệ thống mà bạn được phép kiểm thử.

## Tổng quan

[Mô tả ngắn về challenge, mục tiêu chính và kỹ thuật sử dụng]

## Recon

```bash
# Quét port và dịch vụ
nmap -sS -sC -sV [target-ip]
```

[Mô tả kết quả quét và các dịch vụ phát hiện]

## Phân tích ứng dụng

[Phân tích chức năng web application, các endpoint, input points]

## Phát hiện SSTI

[Các bước test và xác nhận lỗ hổng SSTI trong Jinja2]

```python
# Test payload cơ bản
{{7*7}}
{{config}}
```

## Khai thác

[Chi tiết quá trình khai thác SSTI để đạt RCE]

```python
# Payload khai thác
```

## Leo thang đặc quyền

[Các bước leo thang từ www-data/user lên root nếu có]

## Flag

```text
HTB{...}
```

## Phòng thủ

- Input validation và sanitization
- Tránh render user input trực tiếp vào template
- Sử dụng sandboxing cho template engine
- WAF rules để detect SSTI patterns

## Bài học

- Điều gì đã hiệu quả?
- Hướng nào đã thất bại?
- Có thể phòng thủ như thế nào?
