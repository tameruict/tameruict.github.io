---
title: "Jinja Care"
description: "Exploiting SSTI in a Jinja2 application to read the flag file from the server."
platform: "Hack The Box"
category: "Web"
difficulty: "Easy"
publishedAt: 2026-08-08
tags: ["web", "ssti", "jinja2", "flask", "python", "file-read"]
language: "en"
translationKey: "hack-the-box/jinja-care"
draft: false
featured: false
cover: "/images/jinja-care/jinja-care-02.png"
---

> This write-up was conducted in a controlled lab environment. Only apply the techniques below on systems you are authorized to test.

## Overview

JinjaCare is a personal information management application. The **Full Name** field accepts arbitrary input and displays it again after the profile is saved. The objective is to determine how that input is processed and read the flag from the server.

The main issue is **Server-Side Template Injection (SSTI)** in Jinja2. User input is passed through template rendering instead of being treated only as plain text.

## Application Analysis

In the **Personal Info** page, enter a simple template expression into the **Full Name** field and save the change:

![SSTI payload entered in the Full Name field](/images/jinja-care/jinja-care-01.png)

```text
{{7*7}}
```

If the rendered value becomes `49`, the expression was evaluated on the server. This confirms that the input is being processed by a template engine rather than merely escaped for display.

## Solution

### 1. Confirm SSTI

Jinja2 uses `{{ ... }}` for expressions. Once the arithmetic expression returns a result, the next step is to inspect the available Python objects and identify a path to system functionality.

### 2. Read the flag through SSTI

The file-reading payload used in the **Full Name** field for this challenge is:

```text
{{__import__('os').popen('cat /flag.txt').read()}}
```

After saving the profile, the command output is rendered directly on the page. The resulting flag is:

![Flag displayed on the JinjaCare certificate](/images/jinja-care/jinja-care-02.png)

```text
HTB{V3ry_e4sy_sst1_r1ght?}
```

The payload is specific to the challenge context. In other Jinja2 applications, `__import__` may not be exposed; analyze the available context and sandbox instead of assuming every payload will work.

## Root Cause

The problem is not just a missing character blacklist. The application treats user data as part of the template source. Once the template engine evaluates the expression, an attacker may reach objects, call functions, or read files depending on the available context.

## Defense

- Never concatenate user input into template source. Pass it as a variable in a safe rendering context.
- Escape output for the correct HTML context; do not rely on blacklisting a few SSTI strings as the primary control.
- Use Jinja2 sandboxing when dynamic templates are required, and restrict accessible objects and callables.
- Run the application with a low-privilege account and restrict access to files containing secrets or flags.
- Add security tests for inputs that pass through a template engine and monitor patterns such as `{{`, `${`, and unusual object traversal.

## Lessons Learned

SSTI may begin with a harmless-looking arithmetic expression but quickly become arbitrary code execution or file read. When input is rendered back to the user, identify the template engine before pursuing other attack paths.
