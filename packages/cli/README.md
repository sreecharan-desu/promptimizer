# promptimizer-cli

Gemini-style interactive routing CLI for Promptimizer.

```bash
npm install -g promptimizer-cli@latest
promptimizer
```

Requires **≥ 0.1.22** for REPL `/logout`. If `/help` does not list `/logout`, upgrade the global binary.

```text
  Promptimizer  v0.1.22
  Type a prompt, or /help  /models  /savings  /clear  /logout  /quit
› What is 17 * 24?
✦
408
  ↳ model · economy · bootstrap_heuristic · saved $0.0001 · miss
```

## Commands

| Command | What it does |
| --- | --- |
| `promptimizer` | Interactive multi-turn session |
| `promptimizer login --key pmz_live_…` | Save API key |
| `promptimizer logout` / REPL `/logout` | Remove `~/.promptimizer/config.json` |
| `promptimizer connect baseten --key $BASETEN_API_KEY` | Attach provider |
| `promptimizer chat "…"` | One-shot completion |
| `promptimizer models` | List fleet |
| `promptimizer savings` | Account ledger |

Defaults to the hosted gateway. Override with `--url` or `PROMPTIMIZER_URL`.
