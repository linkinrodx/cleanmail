# CleanMail

[![Electrobun](https://img.shields.io/badge/Electrobun-desktop-5C2D91?logo=bun&logoColor=white&style=flat-square)](https://github.com/blackboardsh/electrobun)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org)
[![TanStack](https://img.shields.io/badge/TanStack-Query%20%7C%20Router%20%7C%20Table-FF4154?logo=reactquery&logoColor=white&style=flat-square)](https://tanstack.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)](https://tailwindcss.com)
[![Biome](https://img.shields.io/badge/Biome-60A5FA?logo=biome&logoColor=white&style=flat-square)](https://biomejs.dev)

**Simple app to clean your mailboxes easily.**

CleanMail is a local-first desktop app that connects to any IMAP mail server and helps you bulk-triage and clean up your inboxes — without any cloud, subscription, or privacy trade-off.

> **National Day of Clean** — observed every year on **March 19**, this is the perfect occasion to finally tackle that inbox with 12,000 unread emails.

---

![App Overview](.github/assets/overview.png)

---

## Features

- **IMAP account support** — connect to any mail server; credentials stored securely in the OS keychain
- **Mailbox sidebar** — pinned important folders (Inbox, Sent, Drafts, Trash, Spam…) with live unread counts
- **Read emails** — full HTML rendering in a sandboxed iframe, with plain-text fallback
- **Delete emails** — smart delete moves to Trash first, or permanently removes if already there
- **Drag & drop** — drag an email onto any sidebar mailbox to move it instantly
- **Action system** — every move or delete auto-records a reusable rule: *"always move all emails from this sender to that folder"*
- **Bulk apply** — run an action to move or delete every matching email from a sender in one shot

---

## Getting Started

```bash
# Install dependencies
bun install

# Run in development (HMR + app)
bun run start
```

> Requires [Bun](https://bun.sh).

On first launch, click the settings icon in the top bar to enter your IMAP credentials.

---
