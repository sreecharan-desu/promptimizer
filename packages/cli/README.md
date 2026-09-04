# promptimizer-cli

Gemini-style interactive routing CLI for Promptimizer. Multi-host fleets: add and remove providers; the router picks across the merged model set.

```bash
npm install -g ./packages/cli
# or after publish: npm install -g promptimizer-cli@latest
promptimizer
```

Requires **≥ 0.1.23** for `/hosts`, `/connect`, `/disconnect`.

```text
  Promptimizer  v0.1.23
  ● Baseten (16) · NVIDIA NIM (74) · 90 models
  2 hosts merged · router picks across all
› /hosts
  ✓ Baseten      16 models
  ✓ NVIDIA NIM   74 models
```

## Commands

| Command | What it does |
| --- | --- |
| `promptimizer` | Interactive multi-turn session |
| `promptimizer login --key pmz_live_…` | Save API key |
| `promptimizer logout` / REPL `/logout` | Remove `~/.promptimizer/config.json` |
| `promptimizer connect baseten --key $BASETEN_API_KEY` | **Add** a host (keeps existing) |
| `promptimizer connect nvidia --key $NVIDIA_API_KEY` | Add another host |
| `promptimizer disconnect nvidia` | **Remove** a host |
| `promptimizer hosts` | List connected hosts |
| `promptimizer models` | List merged fleet (tier · host · id) |
| `promptimizer chat "…"` | One-shot completion |
| `promptimizer savings` | Account ledger |

Aliases: `add` → connect, `remove` / `rm` → disconnect.

### REPL slash commands

`/hosts` · `/models` · `/connect <host> --key …` · `/disconnect <host>` · `/savings` · `/clear` · `/logout` · `/quit`

Defaults to the hosted gateway. Override with `--url` or `PROMPTIMIZER_URL`.
