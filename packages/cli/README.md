# promptimizer-cli

Gemini-style interactive routing CLI for Promptimizer.

```bash
npm install -g promptimizer-cli
promptimizer
```

```text
     ██████╗ ███╗   ███╗███████╗
     …
  Promptimizer  v0.1.17
  Type a prompt, or /help  /models  /savings  /clear  /quit
› What is 17 * 24?
✦
408
  ↳ thinkingmachines/inkling-small · economy · saved $0.0001
```

## Commands

| Command | What it does |
| --- | --- |
| `promptimizer` | Interactive multi-turn session |
| `promptimizer login --key pmz_live_…` | Save API key |
| `promptimizer connect baseten --key $BASETEN_API_KEY` | Attach provider |
| `promptimizer chat "…"` | One-shot completion |
| `promptimizer models` | List fleet |
| `promptimizer savings` | Account ledger |

Defaults to the hosted gateway. Override with `--url` or `PROMPTIMIZER_URL`.
