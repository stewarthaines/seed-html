# Rename strategy: `editme*` → `seedhtml*` / `seed-html`

Retire the last of the former name. Today `grep -ri editme` hits **94 files**; the goal is zero (with one deliberate, documented exception — see Acceptance). Work happens on a feature branch (`rename/seed-html`), merged to `main` stage by stage; each stage is releasable on its own. **Push and deploy the current backlog first** so the rename isn't entangled with feature work.

## Naming decisions

| Old                                       | New                        | Where                     |
| ----------------------------------------- | -------------------------- | ------------------------- |
| `editme_*` localStorage keys              | `seedhtml_*`               | ~15 distinct keys         |
| `editme-locale` localStorage key          | `seedhtml-locale`          | i18n locale choice        |
| `editme-storage` IndexedDB name           | `seedhtml-storage`         | storage fallback backend  |
| `__SEEDHTML_I18N_BUNDLE__` window global  | `__SEEDHTML_I18N_BUNDLE__` | i18n bundle anchor        |
| `seedhtml-i18n-bundle` script id          | `seedhtml-i18n-bundle`     | vite injected head        |
| `editme-content-panes` PaneForge id       | `seedhtml-content-panes`   | pane split sizes          |
| `seedhtmlPlugin` package.json key         | `seedhtmlPlugin`           | plugin manifests          |
| `editme-svelte` package/repo              | `seed-html`                | package.json, Codeberg    |
| `editme.example.com` etc. in docs/samples | `seedhtml.example.com`     | publish-to-remote samples |

## Stage 1 — transient state keys (no migration, loss accepted)

All `editme_*` localStorage keys, `editme-locale`, and the PaneForge `editme-content-panes` id, renamed in app + plugin code and their tests. Per decision, **no migration**: users lose transient UI config once — theme, language choice, advanced mode (`editme_global_settings`), last-open project pointer (`editme_app_workspace_id`), nav state, pane sizes, remembered author name, generator last-values, editor font size, spine-preview collapse.

Files: `src/lib/stores/*`, `src/lib/state/persisted*` call sites, `navigation-store.ts`, `app-state-enhanced.svelte.ts`, `settings.service.ts`, `i18n/index.ts`, `LayoutManager.svelte`, component `persisted()` keys, `plugins/publish-to-remote` (`editme_validation_report`, `editme_opds_feeds`), matching tests.

**Flag**: losing `editme_global_settings` resets locale + advanced mode to defaults on first load after upgrade. Accepted as transient, but it is the most _visible_ loss — release note it.

## Stage 2 — persistent project data (MIGRATION REQUIRED)

**`editme-storage` (IndexedDB) holds entire projects** for browsers without OPFS `createWritable` (Safari lineage). Renaming without migration silently "loses" every project for those users. This is the one genuinely breaking change.

- New module `src/lib/storage/legacy-migration.ts`: on storage init, if `seedhtml-storage` is empty and `editme-storage` exists, copy all object stores across, verify counts, then leave the old DB intact for one release (delete in a later release). Unit-test with fake-indexeddb; e2e-verify by seeding the old DB name in a browser run.
- Locale catalog cache (workspace `locales/` area): keys/names are app-internal; hosted users re-fetch automatically, `file://` users re-pick their language once. No migration; release note it.

OPFS is origin-scoped and name-free — no risk there.

## Stage 3 — packaged-EPUB coupling (rename as one atomic commit)

`__SEEDHTML_I18N_BUNDLE__` appears in four places that MUST change together (self-consistent per build): `vite.config.ts` head injection, `src/lib/i18n/loader.ts` runtime read, `src/lib/epub/seed-html.ts` `BUNDLE_ASSIGNMENT_PATTERN` + injector, `scripts/smoke-build.js` artifact check (+ `seed-html.test.ts`).

- Already-published EPUBs are self-contained — unaffected.
- Re-editing an old EPUB in the new app is safe: packaging embeds the _new_ SEED.html, whose anchor matches the new injector.

Also in this stage: `seedhtmlPlugin` key in both plugin `package.json`s + `scripts/generate-plugin-manifest.js` (and check the dev-middleware side — the two-builders rule).

## Stage 4 — package and repo rename

1. `package.json` `name: seed-html` (+ regenerate lockfile), `repository`/homepage fields.
2. **Codeberg rename** `editme-svelte` → `seed-html` (repo Settings). Gitea/Forgejo keeps a redirect from the old path for both web and git, and webhooks/CI stay attached, so nothing breaks at the moment of rename. Order: land Stages 1–3 on `main` and deploy → rename on Codeberg → `git remote set-url origin git@codeberg.org:stewarthaines/seed-html.git` locally → one commit updating self-references (CHANGELOG compare links, README, DEPLOYMENT.md, `extensions/impressum/extension.json` url, badges).
3. Local checkout dir rename (`~/Projects/editme-svelte` → `~/Projects/seed-html`) is cosmetic; note it changes tooling paths (Claude memory/session dirs key off the path).
4. Wrangler is unaffected (project name `readitinabook`).

## Stage 5 — docs, samples, locales sweep + acceptance

- Docs: the stale `EDITME`/`EDITME.html` mentions across README, USER_GUIDE, OPDS.md, TESTING.md, etc. (the "full docs rebrand intentionally not done" debt) — now done. Rewrite CLAUDE.md's "EDITME is a former name / do NOT rename" section into its successor: names are `seedhtml*`, legacy data is handled by `legacy-migration.ts`, don't reintroduce the old name.
- Locales: regenerate `.po`/`.pot` via `i18n:extract` (purges dead `EDITME.html` msgids in the five scaffolded locales); keep reviewed de translations (extraction preserves).
- Samples/fixtures: content-test fixtures, sample content generators, `plugins/publish-to-remote` sample hosts.
- `public/paged.polyfill.js` is vendored but carries our patch comment mentioning editme — edit the comment only; note it in `patches/paged.polyfill.md`.
- `scripts/new-worktree.sh` example path.

**Acceptance**: `grep -ri editme . --exclude-dir={.git,node_modules,dist,.venv} --exclude=package-lock.json` returns hits ONLY in `src/lib/storage/legacy-migration.ts` (+ its test) — the migration must name the legacy DB it migrates. Recommendation: accept that single well-marked exception rather than obfuscating the string; add a `scripts/check-rename.mjs` guard to `validate` that enforces "no editme outside the legacy-migration allowlist" so the name can't creep back. (If literal zero is required, the legacy name can be assembled at runtime — works, but hides exactly the thing a future reader needs to find.) The migration module and its allowlist entry get deleted together in a future release once the migration window closes.

## Break-risk summary (checklist item)

| Change             | Who's affected                    | Outcome                                                                                    |
| ------------------ | --------------------------------- | ------------------------------------------------------------------------------------------ |
| IndexedDB rename   | Safari / non-OPFS users' projects | **Breaking → migrated by Stage 2**; old DB kept one release as backstop                    |
| localStorage keys  | everyone                          | transient UI config reset once (explicitly accepted); most visible: locale + advanced mode |
| Locale cache       | offline `file://` users           | re-pick language once; hosted users unaffected                                             |
| i18n bundle anchor | packaged EPUBs                    | none (self-contained old books; new app is self-consistent)                                |
| Repo rename        | clones, CI, links                 | Gitea redirects old paths; hooks survive; update remote URL at leisure                     |
| Package name       | npm workspaces/plugins            | internal only; lockfile regenerated                                                        |
