---
title: "CriticalOps"
description: "Khai thác SQL Injection và lạm dụng quyền sudo để leo thang đặc quyền lên root."
platform: "Hack The Box"
category: "Linux"
difficulty: "Medium"
publishedAt: 2026-08-06
tags: ["web", "sqli", "sql-injection", "linux", "sudo", "privesc"]
language: "vi"
translationKey: "hack-the-box/critical-ops"
draft: true
featured: false
---

> Write-up này được thực hiện trong môi trường lab có kiểm soát. Chỉ áp dụng các kỹ thuật bên dưới trên hệ thống mà bạn được phép kiểm thử.

## Tổng quan

[Mô tả ngắn về challenge, mục tiêu chính và kỹ thuật sử dụng]

## Quét dịch vụ

```bash
# Quét port và dịch vụ
nmap -sS -sC -sV [target-ip]
```

[Mô tả kết quả quét và các dịch vụ phát hiện]

## Phân tích ứng dụng web

[Phân tích chức năng web application, các endpoint, input points]

## Phát hiện SQL Injection

[Các bước test và xác nhận lỗ hổng SQL Injection]

```bash
# Test payload cơ bản
' OR 1=1--
```

## Khai thác SQL Injection

[Chi tiết quá trình khai thác SQLi để dump database, lấy credentials]

```bash
# sqlmap hoặc manual exploitation
```

## Initial Access

[Các bước để có shell ban đầu trên hệ thống]

## Leo thang đặc quyền

[Phân tích và khai thác sudo misconfiguration hoặc SUID binary]

```bash
# Liệt kê sudo privileges
sudo -l
```

## Flag

```text
HTB{...}
```

## Phòng thủ

- Sử dụng prepared statements/parameterized queries
- Input validation và sanitization
- Principle of least privilege cho sudo
- Regular security audits
- WAF với rules chống SQL Injection

## Bài học

- Điều gì đã hiệu quả?
- Hướng nào đã thất bại?
- Có thể phòng thủ như thế nào?
