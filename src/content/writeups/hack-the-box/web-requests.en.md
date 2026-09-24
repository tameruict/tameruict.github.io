---
title: "Web Requests"
description: "Understanding HTTP fundamentals: methods, headers, status codes, cookies, POST/GET, and CRUD API interaction via cURL and Browser DevTools."
platform: "Hack The Box"
category: "Academy"
difficulty: "Easy"
publishedAt: 2026-09-24
tags: ["web", "http", "curl", "api", "crud", "headers", "cookies", "rest-api"]
language: "en"
translationKey: "hack-the-box/web-requests"
draft: false
featured: false
---

> This write-up was performed in a controlled lab environment. Only apply these techniques on systems you are authorized to test.

## Overview

The **Web Requests** module on HTB Academy covers HTTP fundamentals — from request/response structure, HTTP methods, status codes, and headers to directly interacting with REST APIs using cURL.

This is foundational knowledge for anyone learning web security, since every web attack flows through HTTP.

---

## HTTP Headers

HTTP headers carry metadata alongside each request and response. There are 5 categories:

| Category | Direction | Purpose |
|----------|-----------|---------|
| General | Both | Describe the message |
| Entity | Both | Describe body/content |
| Request | Client → Server | Client information |
| Response | Server → Client | Server information |
| Security | Server → Client | Security policies |

### Security-critical headers

**`Host`** — Identifies virtual host. Can be forged for password reset poisoning or cache poisoning.

**`Cookie`** — Carries session identifier. If stolen → attacker logs in without credentials.

**`Authorization`** — Sends credentials. Basic Auth only uses base64 (not encryption) → trivially decoded:

```bash
echo "Y2FybG9zOnBhc3N3b3Jk" | base64 -d
# → carlos:password
```

**`Content-Security-Policy`** — Prevents XSS by whitelisting script sources. Misconfigured (`unsafe-inline`) → useless.

**`Strict-Transport-Security`** — Enforces HTTPS, prevents SSL stripping.

**`Server`** — Discloses software + version → attacker looks up CVEs:

```
Server: Apache/2.2.14 (Win32)  →  CVE-2010-0425 (RCE)
```

### Viewing headers with cURL

```bash
# Response headers only (HEAD request)
curl -I https://target.com

# Headers + body
curl -i https://target.com

# Full verbose (everything)
curl -v https://target.com

# Set User-Agent
curl -A "Mozilla/5.0" https://target.com

# Set arbitrary header
curl -H "X-Forwarded-For: 127.0.0.1" https://target.com
```

---

## HTTP Methods

| Method | CRUD | Description | Dangerous when |
|--------|------|-------------|----------------|
| GET | Read | Fetch data, params in URL | Sensitive params get logged |
| POST | Create | Send data in body | Missing input validation |
| PUT | Update | Replace entire record | No auth → upload webshell |
| PATCH | Update | Partial record update | No field whitelist |
| DELETE | Delete | Remove record | No auth → DoS |
| HEAD | - | Headers only | - |
| OPTIONS | - | Query allowed methods | Leaks allowed methods |

### GET vs POST

```
GET  → Data in URL:  /search?q=london&token=secret  ← Logged, leaks via Referer
POST → Data in body: (hidden from URL, but Burp still reads it)
```

POST is not "more secure" — it only hides data from the URL.

---

## HTTP Status Codes

| Class | Meaning | Attacker significance |
|-------|---------|----------------------|
| 1xx | Informational | Rarely seen |
| 2xx | Success | `200` = OK, `201` = Created |
| 3xx | Redirect | `302` = test for open redirect |
| 4xx | Client error | `403` vs `404` leaks path existence |
| 5xx | Server error | `500` on injection → possible SQLi |

### 403 vs 404 — Critical difference

```
/admin → 403 Forbidden  = Path EXISTS, no permission
/admin → 404 Not Found  = Path DOES NOT EXIST

Best practice: Return 404 instead of 403 to hide resource existence.
```

### 500 as an attack signal

```bash
?id=1     → 200 OK      (normal)
?id=1'    → 500 Error   ← SQL error → possible SQLi!
```

---

## POST Requests & Cookies

### Login with cURL

```bash
# Basic login
curl -X POST -d 'username=admin&password=admin' http://SERVER:PORT/ -i

# Follow redirect after login
curl -X POST -d 'username=admin&password=admin' http://SERVER:PORT/ -L

# Save cookie to file
curl -X POST -d 'username=admin&password=admin' http://SERVER:PORT/ -c cookies.txt
```

### Using session cookies

After successful login, server returns:

```http
Set-Cookie: PHPSESSID=c1nsa6op7vtk7kdis7bcnbadf1; path=/; HttpOnly
```

Use this cookie to bypass login:

```bash
# Use directly
curl -b 'PHPSESSID=c1nsa6op7vtk7kdis7bcnbadf1' http://SERVER:PORT/

# Use from file
curl -b cookies.txt http://SERVER:PORT/
```

This is the foundation of **Session Hijacking** — stealing a cookie grants account access without credentials.

### Cookie security flags

| Flag | Protects against |
|------|-----------------|
| `HttpOnly` | JS cannot read cookie (XSS cookie theft) |
| `Secure` | Only sent over HTTPS |
| `SameSite=Strict` | CSRF protection |

### POST with JSON

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -b 'PHPSESSID=c1nsa6op7vtk7kdis7bcnbadf1' \
  -d '{"search":"london"}' \
  http://SERVER:PORT/search.php
```

`Content-Type: application/json` is required — without it the server will misparse the body.

---

## CRUD API

REST APIs typically map HTTP methods to database operations:

| HTTP Method | DB Operation | SQL |
|-------------|-------------|-----|
| GET | Read | SELECT |
| POST | Create | INSERT |
| PUT | Update | UPDATE |
| DELETE | Delete | DELETE |

### URL structure

```
/api.php/{table}/{row}

/api.php/city/london   → table: city, row: london
/api.php/city/         → table: city, all rows
```

### Read — GET

```bash
# Read one record
curl -s http://SERVER:PORT/api.php/city/london | jq

# Read all
curl -s http://SERVER:PORT/api.php/city/ | jq
```

### Create — POST

```bash
curl -X POST http://SERVER:PORT/api.php/city/ \
  -H 'Content-Type: application/json' \
  -d '{"city_name":"HTB_City","country_name":"HTB"}'
```

### Update — PUT

```bash
# Must specify the row to update in the URL
curl -X PUT http://SERVER:PORT/api.php/city/london \
  -H 'Content-Type: application/json' \
  -d '{"city_name":"New_City","country_name":"HTB"}'
```

### Delete — DELETE

```bash
curl -X DELETE http://SERVER:PORT/api.php/city/New_City
```

### Verify after each operation

```bash
# Confirm deletion → should return []
curl -s http://SERVER:PORT/api.php/city/New_City | jq
# → []
```

---

## API Enumeration — Finding unknown endpoints

When given a target URL with no visible API:

```bash
# 1. Read JS source — find hardcoded endpoints
curl -s http://TARGET/ | grep -oE "api\.php/[a-zA-Z0-9_/]+"

# 2. Check swagger / docs
curl -s http://TARGET/swagger.json
curl -s http://TARGET/api/docs
curl -s http://TARGET/robots.txt

# 3. Fuzz table name (when api.php is known)
ffuf -u http://TARGET/api.php/FUZZ/ \
  -w /usr/share/seclists/Discovery/Web-Content/raft-small-words-lowercase.txt \
  -fr "Incorrect table name"

# 4. OPTIONS — ask server what methods are allowed
curl -X OPTIONS http://TARGET/api.php/city/ -i
```

---

## WAF Detection

```bash
# Automated tool
wafw00f https://target.com

# Manual — send payload, check response
curl -i "https://target.com/?q=<script>alert(1)</script>"
# WAF: 403 Forbidden / "Access Denied"

# Check characteristic response headers
curl -I https://target.com
# CF-RAY: ...       → Cloudflare
# X-Sucuri-ID: ...  → Sucuri
# X-CDN: Imperva    → Imperva
```

---

## Conclusion

This module provides the foundation to:

- Understand how HTTP works at a low level
- Reconstruct any request with cURL instead of relying on a browser
- Analyze headers to spot misconfigurations
- Interact directly with REST APIs without needing a UI
- Detect WAFs and identify weaknesses in authentication flows

These are core skills for web pentesting, bug bounty hunting, and CTF challenges.
