# ClawLess Docs

This folder contains a standalone Next.js documentation app for GitHub Pages.

## Usage

```bash
cd .docs
bun install
bun dev && open http://localhost:3000/clawless
bun run build
```

## Content

- Markdown source lives in `content/`
- File names map to routes
- Frontmatter drives the page title, description, and sidebar order

```markdown
---
title: 
description: 
order: 
---
```