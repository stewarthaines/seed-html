# SEED.html — Simple EPUB Editor

Run the full [SEED.html](https://github.com/stewarthaines/seed-html) EPUB editor locally with one command:

```
npx @stewarthaines/seed-html
```

That starts a local server (default `http://localhost:8417/`) and opens your browser. Everything runs in the browser — your projects are stored by the browser itself (OPFS), nothing is uploaded anywhere, and after the first visit the app works offline as a PWA.

This is the same app as the hosted version, including the full extensions catalog (Markdown, Djot, Textile, AsciiDoc, syntax highlighting, KaTeX, ABC music notation, Mermaid diagrams, audio clips, …) and the plugins. The single-file `SEED.html` download remains the lightest option; this package adds the catalogs and the http-only preview devices that `file://` can't provide.

## Options

```
npx @stewarthaines/seed-html --port 9000   # pick a port (default 8417, walks up if taken)
npx @stewarthaines/seed-html --no-open     # don't launch the browser
```

Projects live in browser storage **per address**, so use a consistent port if you return often. Pin a version with `@stewarthaines/seed-html@<version>`; plain `npx` may reuse a cached copy — use `@latest` to update.

## Agent bridge (optional)

For agent-assisted authoring, the package also carries the SEED agent bridge — an MCP server (stdio) that relays read-only tool calls to the app session where you clicked **Allow agent assistance**:

```
claude mcp add seed-bridge -- npx -y @stewarthaines/seed-html bridge
```

## License

MIT. Bundled third-party libraries keep their own licenses (see the extension license files inside the app).
