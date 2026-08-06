---
title: "Jinja Care"
description: "Exploiting SSTI (Server-Side Template Injection) in Flask/Jinja2 to achieve RCE and privilege escalation."
platform: "Hack The Box"
category: "Web"
difficulty: "Easy"
publishedAt: 2026-08-06
tags: ["web", "ssti", "jinja2", "flask", "python", "rce", "template-injection"]
language: "en"
translationKey: "hack-the-box/jinja-care"
draft: true
featured: false
---

> This write-up was conducted in a controlled lab environment. Only apply the techniques below on systems you are authorized to test.

## Overview

[Brief description of the challenge, main objectives and techniques used]

## Recon

```bash
# Port and service scanning
nmap -sS -sC -sV [target-ip]
```

[Describe scan results and discovered services]

## Application Analysis

[Analyze web application functionality, endpoints, and input points]

## SSTI Discovery

[Steps to test and confirm SSTI vulnerability in Jinja2]

```python
# Basic test payloads
{{7*7}}
{{config}}
```

## Exploitation

[Detailed process of exploiting SSTI to achieve RCE]

```python
# Exploit payload
```

## Privilege Escalation

[Steps to escalate from www-data/user to root if applicable]

## Flag

```text
HTB{...}
```

## Defense

- Input validation and sanitization
- Avoid rendering user input directly into templates
- Use sandboxing for template engines
- WAF rules to detect SSTI patterns

## Lessons Learned

- What worked effectively?
- Which approaches failed?
- How can this be defended against?
