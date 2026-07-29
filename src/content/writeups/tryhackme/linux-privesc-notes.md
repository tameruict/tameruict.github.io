---
title: "Linux Privilege Escalation Notes"
description: "Khung ghi chú cho quá trình kiểm tra quyền sudo, SUID, cron, capability và credential trên máy Linux."
platform: "TryHackMe"
category: "Privilege Escalation"
difficulty: "Medium"
publishedAt: 2026-07-24
tags: ["linux", "privesc", "enumeration"]
draft: false
---

> Nội dung này là template kỹ thuật, không phải lời khẳng định về một room cụ thể.

## Thông tin hệ thống

```bash
id
uname -a
cat /etc/os-release
sudo -l
```

## Các điểm cần kiểm tra

### SUID

```bash
find / -perm -4000 -type f 2>/dev/null
```

### Linux capabilities

```bash
getcap -r / 2>/dev/null
```

### Cron và service

Tìm file hoặc script được user hiện tại ghi vào nhưng lại được một tài khoản có quyền cao hơn thực thi.

## Cách trình bày bằng chứng

Mỗi phát hiện nên có:

1. Command tái hiện.
2. Output đã rút gọn.
3. Giải thích vì sao quyền hiện tại có thể tác động.
4. Cách khắc phục hoặc bài học phòng thủ.

## Bài học

Một đường dẫn khai thác ngắn chưa chắc là đường dẫn tốt nhất để giải thích. Chọn các bước giúp người đọc hiểu trust boundary bị phá vỡ ở đâu.
