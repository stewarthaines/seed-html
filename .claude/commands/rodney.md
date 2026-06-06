---
name: rodney
description: Browser automation via rodney (Chrome CDP). Use to open URLs, scrape content, interact with pages.
argument-hint: <url | subcommand>
---

`rodney` is available via `uvx rodney`. It controls a headless Chrome instance via CDP.

## Lifecycle

```bash
uvx rodney start          # launch headless Chrome (downloads Chromium on first run)
uvx rodney start --show   # visible window
uvx rodney stop           # shut down
uvx rodney status         # check if running
```

## Common workflows

**Load a page and read its text:**
```bash
uvx rodney start
uvx rodney open <url>
uvx rodney waitload
uvx rodney title
uvx rodney text body
```

**Take a screenshot:**
```bash
uvx rodney open <url> && uvx rodney waitload && uvx rodney screenshot /tmp/page.png
```

**Extract specific content:**
```bash
uvx rodney text h1
uvx rodney html main
uvx rodney attr a[href] href
```

**Interact:**
```bash
uvx rodney click 'button.submit'
uvx rodney input '#search' 'query text'
uvx rodney wait '.results'
```

## Notes

- Session state persists between commands (same browser instance)
- Auto-detects local vs global session from `.rodney/state.json`
- Chromium is cached at `~/.cache/rod/browser/` after first download
- Use `uvx rodney waitidle` after interactions that trigger network requests
