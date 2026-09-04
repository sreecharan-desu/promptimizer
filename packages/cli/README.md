# promptimizer-cli

Login with a `pmz_live_` key, connect a provider, route prompts, and read savings.

```bash
npm install -g promptimizer-cli
# or
npx promptimizer-cli
```

```bash
promptimizer login --key pmz_live_…
promptimizer connect baseten --key "$BASETEN_API_KEY"
promptimizer chat "What is 17 * 24?"
promptimizer savings
```

Defaults to the hosted gateway. Override with `--url` or `PROMPTIMIZER_URL`.
