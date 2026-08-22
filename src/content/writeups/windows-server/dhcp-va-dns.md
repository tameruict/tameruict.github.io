---
title: "DHCP và DNS"
description: "Cấu hình DHCP trên Windows Server trong mạng NAT của VMware, kiểm thử client Lubuntu và tìm hiểu forward/reverse lookup zone."
platform: "Windows Server"
category: "Networking"
difficulty: "Easy"
publishedAt: 2026-08-22
tags: ["dhcp", "dns", "windows-server", "vmware", "lubuntu", "forward-lookup", "reverse-lookup"]
language: "vi"
translationKey: "windows-server/dhcp-va-dns"
draft: false
featured: false
cover: "/images/dhcp-va-dns/dhcp-dns-01.png"
---

> Write-up này ghi lại một lab mạng nội bộ dùng VMware, Windows Server và Lubuntu. Các địa chỉ IP bên dưới chỉ là thông số của lab; hãy thay đổi chúng khi triển khai trong môi trường khác.

## Mục tiêu và mô hình lab

Mục tiêu của bài là để Windows Server làm DHCP server, cấp phát cấu hình mạng cho máy Lubuntu, sau đó kiểm tra kết nối đến Windows Server, NAT gateway và Internet. Phần cuối giải thích cách tổ chức DNS bằng **forward lookup zone** và **reverse lookup zone**.

VMware được cấu hình thêm **VMnet2** ở chế độ **NAT**. Tắt tùy chọn **Use local DHCP service to distribute IP address to VMs** để VMware không chạy DHCP song song với Windows Server.

![VMnet2 sử dụng NAT và tắt DHCP cục bộ của VMware](/images/dhcp-va-dns/dhcp-dns-01.png)

Sơ đồ địa chỉ dùng trong bài:

| Thành phần | Địa chỉ / vai trò |
| --- | --- |
| VMnet2 | `192.168.21.0/24` |
| VMware NAT gateway | `192.168.21.2` |
| Windows Server | `192.168.21.3`, IP tĩnh |
| Lubuntu | Nhận DHCP, ví dụ `192.168.21.6` |
| DNS ưu tiên cho client | `192.168.21.3` |
| DNS dự phòng | `8.8.8.8` |

NAT gateway là địa chỉ do VMware cung cấp, còn Windows Server phải dùng IP tĩnh để client luôn biết nơi gửi DHCP relay-independent traffic và truy vấn DNS. Nếu vẫn bật DHCP cục bộ của VMware, client có thể nhận lease từ sai DHCP server và kết quả sẽ không ổn định.

![Kiểm tra địa chỉ của VMnet2 trong VMware](/images/dhcp-va-dns/dhcp-dns-02.png)

![NAT gateway của VMnet2 là 192.168.21.2](/images/dhcp-va-dns/dhcp-dns-03.png)

## Cấu hình IP tĩnh cho Windows Server

Mở thuộc tính IPv4 của card mạng trên Windows Server và đặt:

- IP address: `192.168.21.3`
- Subnet mask: `255.255.255.0`
- Default gateway: `192.168.21.2`
- Preferred DNS server trong bước kiểm tra Internet ban đầu: `8.8.8.8`

![Windows Server dùng IP tĩnh 192.168.21.3 và gateway 192.168.21.2](/images/dhcp-va-dns/dhcp-dns-04.png)

Kiểm tra từ Command Prompt:

```text
ipconfig
ping 8.8.8.8
```

Ảnh chụp cho thấy Windows Server có IP `192.168.21.3` và ping đến `8.8.8.8` thành công. Đây là bước tách lỗi định tuyến/NAT khỏi lỗi DHCP.

## Cài DHCP Server và DNS Server

Trong **Server Manager**, chọn **Add Roles and Features**, đến mục **Server Roles**, rồi đánh dấu **DHCP Server** và **DNS Server**. Hoàn tất wizard với các tùy chọn mặc định phù hợp với lab.

![Chọn DHCP Server và DNS Server trong Add Roles and Features Wizard](/images/dhcp-va-dns/dhcp-dns-05.png)

Sau khi cài xong, mở **Tools > DHCP** trong Server Manager.

![Mở công cụ DHCP từ menu Tools](/images/dhcp-va-dns/dhcp-dns-06.png)

## Tạo DHCP scope

Trong DHCP console, mở **IPv4**, chọn **New Scope**, đặt tên `DHCP - WinServer`.

![Đặt tên scope là DHCP - WinServer](/images/dhcp-va-dns/dhcp-dns-07.png)

### Dải cấp phát và exclusion

Đặt dải cấp phát là `192.168.21.2` đến `192.168.21.254`, subnet mask `/24` (`255.255.255.0`). Sau đó loại trừ `192.168.21.2` đến `192.168.21.3` để DHCP không cấp nhầm địa chỉ của NAT gateway và Windows Server.

![Đặt dải IP 192.168.21.2 đến 192.168.21.254](/images/dhcp-va-dns/dhcp-dns-08.png)

![Loại trừ 192.168.21.2 đến 192.168.21.3 khỏi address pool](/images/dhcp-va-dns/dhcp-dns-09.png)

### Scope Options

Khai báo các option quan trọng:

1. **003 Router**: `192.168.21.2` để client biết default gateway.
2. **006 DNS Servers**: `192.168.21.3`, sau đó có thể thêm `8.8.8.8` làm DNS dự phòng.
3. **004 WINS/NBNS Servers** chỉ dùng khi lab thật sự có WINS server; không nên thêm địa chỉ giả.

![Khai báo default gateway 192.168.21.2 ở Router option](/images/dhcp-va-dns/dhcp-dns-10.png)

![Khai báo DNS server 192.168.21.3 và 8.8.8.8](/images/dhcp-va-dns/dhcp-dns-11.png)

![Màn hình WINS/NBNS trong DHCP scope](/images/dhcp-va-dns/dhcp-dns-12.png)

Option **003 Router** là phần quan trọng vì nó tự động truyền default gateway tới client mỗi khi client xin lease. Sau khi activate scope, client mới kết nối vào VMnet2 sẽ nhận IP trong dải đã cấu hình.

![Scope Options hiển thị Router và DNS Servers](/images/dhcp-va-dns/dhcp-dns-13.png)

## Cấu hình và kiểm thử Lubuntu

Kết nối card mạng của máy Lubuntu vào cùng VMnet2. Ở phần thông tin kết nối, client nhận `192.168.21.6/24`, default route `192.168.21.2`, DNS ưu tiên `192.168.21.3` và DNS phụ `8.8.8.8`.

![Lubuntu nhận địa chỉ 192.168.21.6 qua DHCP](/images/dhcp-va-dns/dhcp-dns-14.png)

Chạy các lệnh sau từ Lubuntu:

```bash
ip addr
ping 192.168.21.3
ping 192.168.21.2
ping 8.8.8.8
ping google.com
nslookup google.com
nslookup google.com 192.168.21.3
nslookup 192.168.21.3 192.168.21.3
```

Kết quả mong đợi:

- Client nhận lease từ Windows Server và ping được `192.168.21.2`.
- Ping `8.8.8.8` thành công chứng minh NAT gateway chuyển tiếp được traffic ra Internet.
- Ping `google.com` thành công khi DNS đang hoạt động.
- `nslookup google.com 192.168.21.3` ép truy vấn đi thẳng tới DNS server trong lab, tránh nhầm với local stub resolver.
- `nslookup 192.168.21.3 192.168.21.3` dùng để kiểm tra PTR sau khi đã tạo reverse lookup zone.

![Ping từ Lubuntu đến Windows Server trước khi mở ICMP](/images/dhcp-va-dns/dhcp-dns-15.png)

Trong lần kiểm thử đầu, ping đến `192.168.21.3` bị mất gói dù cấu hình IP đã đúng. Nguyên nhân là Windows Firewall chưa cho phép ICMP inbound, không phải DHCP cấp sai địa chỉ.

## Cho phép ICMP trên Windows Firewall

Mở **Windows Defender Firewall with Advanced Security > Inbound Rules**, tìm rule **File and Printer Sharing (Echo Request - ICMPv4-In)** và chọn **Enable Rule** cho profile phù hợp với lab.

![Bật rule File and Printer Sharing (Echo Request - ICMPv4-In)](/images/dhcp-va-dns/dhcp-dns-16.png)

Kiểm thử lại sau khi bật rule:

![Lubuntu ping được Windows Server sau khi mở ICMP](/images/dhcp-va-dns/dhcp-dns-17.png)

![Lubuntu ping được google.com sau khi cấu hình DNS](/images/dhcp-va-dns/dhcp-dns-18.png)

Ảnh chụp cho thấy Lubuntu ping được cả `192.168.21.3`, `192.168.21.2` và `8.8.8.8`. Windows Server cũng ping được tên miền Internet.

![Windows Server ping google.com thành công](/images/dhcp-va-dns/dhcp-dns-19.png)

## Tìm hiểu Forward Lookup Zone

**Forward lookup zone** ánh xạ tên DNS sang địa chỉ IP. Bản ghi thường gặp là:

- **A**: hostname sang IPv4, ví dụ `winserver.lab.test -> 192.168.21.3`.
- **AAAA**: hostname sang IPv6.
- **CNAME**: bí danh trỏ tới một hostname khác.
- **MX**: máy chủ nhận email cho một domain.

Trong lab này, forward zone có thể được tạo như sau:

1. Mở **Tools > DNS** trong Server Manager.
2. Nhấp phải **Forward Lookup Zones > New Zone**.
3. Chọn **Primary zone**. Nếu Windows Server đồng thời là domain controller, có thể chọn lưu zone trong Active Directory; lab độc lập có thể dùng file-based primary zone.
4. Đặt tên zone, ví dụ `lab.test`.
5. Chọn chính sách dynamic update phù hợp. Với lab đơn giản, có thể chọn không cho dynamic update và tạo record thủ công.
6. Trong `lab.test`, tạo **New Host (A or AAAA)** với name `winserver` và IP `192.168.21.3`.

![DNS Server role được cài cùng DHCP Server](/images/dhcp-va-dns/dhcp-dns-05.png)

Khi đó truy vấn `winserver.lab.test` sẽ đi theo hướng **tên -> IP**. Theo tài liệu Microsoft, A/AAAA record được quản lý bên trong forward lookup zone; zone có thể được tạo bằng DNS Manager hoặc PowerShell ([Manage DNS zones](https://learn.microsoft.com/en-us/windows-server/networking/dns/manage-dns-zones), [Manage DNS resource records](https://learn.microsoft.com/en-us/windows-server/networking/dns/manage-resource-records)).

## Tìm hiểu Reverse Lookup Zone

**Reverse lookup zone** thực hiện chiều ngược lại: ánh xạ địa chỉ IP về hostname bằng bản ghi **PTR**. Với IPv4, Windows DNS sử dụng miền đặc biệt `in-addr.arpa` và đảo thứ tự các octet của network ID.

Với mạng `192.168.21.0/24`, tên reverse zone là:

```text
21.168.192.in-addr.arpa
```

Tạo zone bằng DNS Manager:

1. Nhấp phải **Reverse Lookup Zones > New Zone**.
2. Chọn **Primary zone** và **IPv4 Reverse Lookup Zone**.
3. Nhập **Network ID** là `192.168.21`.
4. Tạo PTR cho host `3`, trỏ tới `winserver.lab.test`. Kết quả tương đương `3.21.168.192.in-addr.arpa -> winserver.lab.test`.
5. Kiểm tra bằng `nslookup 192.168.21.3 192.168.21.3`.

Reverse zone không bắt buộc để DNS phân giải tên thông thường, nhưng hữu ích cho log, kiểm tra danh tính máy và các ứng dụng cần xác minh hostname từ IP. Microsoft cũng lưu ý rằng reverse lookup/PTR là phần tùy chọn của DNS, không phải mọi mạng đều cần triển khai ([DNS reverse lookups in Windows Server](https://learn.microsoft.com/en-us/windows-server/networking/dns/reverse-lookup)).

![Client Lubuntu có thể kiểm tra DNS sau khi nhận cấu hình từ DHCP](/images/dhcp-va-dns/dhcp-dns-20.png)

## Phân biệt nhanh hai loại zone

| Loại zone | Chiều phân giải | Bản ghi chính | Ví dụ kiểm tra |
| --- | --- | --- | --- |
| Forward lookup zone | Tên -> IP | A, AAAA, CNAME, MX | `nslookup winserver.lab.test 192.168.21.3` |
| Reverse lookup zone | IP -> Tên | PTR | `nslookup 192.168.21.3 192.168.21.3` |

## Checklist khắc phục lỗi

- Nếu client nhận gateway không phải `192.168.21.2`, kiểm tra lại DHCP local của VMware đã tắt chưa.
- Nếu Windows Server không ra Internet, kiểm tra IP tĩnh, subnet mask và NAT gateway.
- Nếu client có IP nhưng không ping được server, kiểm tra Windows Firewall và rule ICMP inbound.
- Nếu ping IP được nhưng ping tên miền thất bại, kiểm tra DHCP option **006**, DNS service, forwarder và thử `nslookup google.com 192.168.21.3`.
- Nếu forward lookup được nhưng reverse lookup thất bại, kiểm tra đã tạo `21.168.192.in-addr.arpa` và PTR record chưa.

## Kết luận

Lab đã tách rõ ba lớp: VMware NAT cung cấp gateway, Windows Server cấp DHCP và làm DNS server, còn Lubuntu là DHCP client. Việc tắt DHCP của VMware, giữ IP tĩnh cho server, dành riêng gateway/server bằng exclusion và khai báo đúng option 003/006 giúp cấu hình ổn định. Forward lookup phục vụ truy vấn tên sang IP; reverse lookup bổ sung chiều IP sang tên bằng PTR.
