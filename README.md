# SOC2-HITRUST

You can run this as it is hosted in Github without having to clone the repo locally by leveraging `npx` like this:

```bash
export var REPO=DailyFeats/slfus-client-onboard
export var ACCESS_TOKEN=ghp_...

# Optional
export var START_AT=2023-10-01T00:00:00Z
export var END_AT=2024-09-30T23:59:59Z

npx reyronald/SOC2-HITRUST exec
```

If you want to run it locally, clone the repo and do:

```bash
node index.mjs
```

To create a Github Acccess token, go to https://github.com/settings/tokens
