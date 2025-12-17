# Claude Memory Integration

This project supports [claude-mem](https://github.com/thedotmack/claude-mem) to provide persistent context across coding sessions.

## 1. Installation (One-time setup)

If you use the `claude` CLI tool, install the memory plugin:

```bash
# In your terminal (not inside claude)
npm install -g @anthropic-ai/claude-code
claude plugin marketplace add thedotmack/claude-mem
claude plugin install claude-mem
```

## 2. Seeding Memory (Project Setup)

To give Claude immediate knowledge of the entire architecture without reading every file manually:

1.  Run the seed generator:
    ```bash
    python scripts/generate_memory_seed.py
    ```
2.  This creates `docs/MEMORY_SEED.txt`.
3.  Open `claude` and run:
    ```text
    /read docs/MEMORY_SEED.txt
    Please analyze this project architecture seed. Identify the 3-stage council pipeline, the Supabase schema relationships, and the React frontend structure. Store this in your memory.
    ```

## 3. Best Practices

*   **Ask about history**: "What did we change in the council logic last time?"
*   **Refresh Memory**: If the schema changes significantly, re-run the seed script and feed it to Claude again.
