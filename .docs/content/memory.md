---
title: Memory
---

Compared to OpenClaw, the memory design here is **much simpler**.

Memory is divided into three types, They are stored in a `Neon` database. 

- **Built-in Memory**
- **Session Memory**
- **Long-term Memory**

### Built-in Memory
Built-in memory uses a **fixed set of keys** and is **injected directly into the System Prompt**.

- It is editable.
- It is **not deletable**.

### Session Memory
Session memory is **stored whenever the conversation is compressed**, preventing important information from being lost during long tasks.

- It is written automatically **by the compaction flow**.
- It is **read-only**.
- It is **not deletable**.

### Long-term Memory
Long-term memory is **retrieved by the Agent through a tool call**.

- It stores user preferences.
- It can be created, updated, searched, and deleted.

When retrieving memory, the system performs a **hybrid search**:

- **RAG (0.7)** 🔎  
- **Keyword search (0.3)** 🏷️

If embeddings are unavailable, retrieval falls back to **keyword search only**.
