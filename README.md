# tameruict.github.io

Website write-up CTF cá nhân, xây bằng Astro và tự động deploy lên GitHub Pages.

## Chạy trên máy

```bash
npm install
npm run dev
```

Mở địa chỉ Astro in ra trong terminal, thường là `http://localhost:4321`.

## Tạo write-up mới

```bash
npm run new -- "Hack The Box" "Tên challenge" Easy Web
```

Thứ tự tham số:

1. Nền tảng hoặc giải đấu.
2. Tên challenge.
3. Độ khó: `Easy`, `Medium`, `Hard`, `Insane`.
4. Category, ví dụ `Web`, `Pwn`, `Crypto`, `Forensics`.

File mới được tạo trong `src/content/writeups/` với `draft: true`. Hoàn thiện bài rồi đổi thành `draft: false`.

## Cấu trúc metadata

```yaml
---
title: "Tên challenge"
description: "Mô tả ngắn dưới 180 ký tự"
platform: "Hack The Box"
category: "Web"
difficulty: "Medium"
publishedAt: 2026-07-29
updatedAt: 2026-07-30
tags: ["sqli", "python"]
draft: false
featured: true
---
```

## Đăng bài

```bash
git add .
git commit -m "writeup: ten challenge"
git push
```

Workflow trong `.github/workflows/deploy.yml` sẽ build và deploy tự động.

Trên GitHub, vào `Settings > Pages`, chọn `GitHub Actions` tại mục Source trong lần cấu hình đầu tiên.

## Lưu ý trước khi public

- Kiểm tra điều lệ của giải hoặc lab.
- Xóa flag nếu chưa được phép công bố.
- Không commit VPN config, token, cookie hoặc credential.
- Rút gọn output dài nhưng giữ đủ bằng chứng để tái hiện.
