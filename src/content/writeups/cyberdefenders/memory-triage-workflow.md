---
title: "Memory Triage Workflow"
description: "Quy trình phân tích nhanh memory image, ưu tiên process tree, network artifacts và dấu hiệu persistence."
platform: "CyberDefenders"
category: "Forensics"
difficulty: "Hard"
publishedAt: 2026-07-20
tags: ["forensics", "memory", "volatility"]
draft: false
---

> Đây là bài mẫu để thể hiện cấp độ Hard và nhóm Forensics trên giao diện.

## Chuẩn bị bằng chứng

Luôn tính hash trước khi phân tích:

```bash
sha256sum memory.raw
```

Làm việc trên bản sao và giữ nguyên file gốc.

## Triage

Ưu tiên xây dựng timeline thay vì chạy mọi plugin:

```bash
python vol.py -f memory.raw windows.info
python vol.py -f memory.raw windows.pslist
python vol.py -f memory.raw windows.pstree
python vol.py -f memory.raw windows.netscan
```

## Pivot

Từ process bất thường, pivot sang:

- Parent process và thời điểm khởi chạy.
- Command line.
- Kết nối mạng.
- DLL hoặc vùng nhớ khả nghi.
- File, registry key hoặc scheduled task liên quan.

## Bài học

Write-up forensics cần phân biệt artifact, suy luận và kết luận. Nếu chưa đủ bằng chứng, ghi rõ mức độ tin cậy thay vì khẳng định tuyệt đối.
