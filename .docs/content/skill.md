---
title: Skill
---

Skills are an agent’s knowledge base 🧠.

As far as I know, **Skills** are really just a collection of Markdown files with **front matter**(or other plaintext).

In most cases, when Skills are downloaded remotely, the process is simply to `clone` the repository and extract the `skills` folder.

The way **ClawLess** handles the internal logic of Skills is:

1. Clone the Skills into `@vercel/blob`
2. Parse the front matter
3. Store all Skills metadata in KV to inject them into the `system prompt`
