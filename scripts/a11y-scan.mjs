/**
 * Full-app accessibility scan.
 *
 * Drives the running app with Playwright and runs axe-core on each view, in both the
 * light and dark themes, reporting whole-page issues (landmarks, focus order, contrast,
 * cross-component) that the Storybook component-level a11y addon can't see. The app is a
 * stateful SPA with no URL routes, so we navigate by clicking the sidebar (and create a
 * project to reach the workspace-dependent views) rather than page.goto(route).
 *
 * Usage:
 *   npm run dev                 # in another terminal (or set A11Y_URL)
 *   npm run test:a11y           # report only (exit 0)
 *   npm run test:a11y -- --fail-on=serious   # exit 1 on serious/critical violations
 *
 * Env: A11Y_URL (default http://localhost:5173)
 */
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const URL = process.env.A11Y_URL || 'http://localhost:5173';
const THEME_KEY = 'seedhtml_theme_preference';
const failOnArg = process.argv.find(a => a.startsWith('--fail-on='));
const failOn = failOnArg ? failOnArg.split('=')[1] : null;
const IMPACT_ORDER = ['minor', 'moderate', 'serious', 'critical'];
const rank = impact => IMPACT_ORDER.indexOf(impact ?? 'minor');

async function scanView(page, label) {
  // Exclude iframes: the spine preview holds the author's EPUB content (it has its own
  // in-preview axe) and the publish view embeds the plugin (a separate app). We only
  // want the app's own chrome here.
  const { violations } = await new AxeBuilder({ page }).exclude('iframe').analyze();
  return { label, violations };
}

async function clickNav(page, name) {
  const button = page.getByRole('button', { name, exact: true }).first();
  if (!(await button.isEnabled())) throw new Error('nav item disabled');
  await button.click();
  // SPA view swap: no navigation event to await — wait for content, then let styles
  // (incl. theme-dependent colours) settle before axe samples them.
  await page
    .locator('.main-content')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => undefined);
  await page.waitForTimeout(800);
}

// A book must be open to reach the in-book views (the top bar with the Write tab).
// Reuse the open one if present (e.g. restored after a theme reload); otherwise open
// the first book on the shelf, or create a minimal one.
async function ensureWorkspace(page) {
  // Surface what the app says while a book is being created.
  const onConsole = m => {
    if (m.type() === 'error') console.warn(`\nAPP ${m.text().slice(0, 200)}`);
  };
  const onPageError = e => console.warn(`\nAPP pageerror ${String(e).slice(0, 200)}`);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  try {
    return await ensureWorkspaceInner(page);
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }
}

async function ensureWorkspaceInner(page) {
  const writeTab = page.locator('[data-testid="nav-write"]').first();
  if (await writeTab.isVisible().catch(() => false)) return true;
  // Back to the shelf (the hook exists on both the brand bar and the top bar).
  await page.locator('[data-testid="nav-workspace"]').first().click();
  // Let the shelf finish loading before clicking: its rows shift the Start row
  // while they arrive, and a click computed too early lands on a neighbour.
  await page
    .locator('.books-view')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => undefined);
  await page.waitForTimeout(1500);
  // A cover on the shelf, not the Start row's "Open an EPUB…" (which only opens
  // a native file chooser, and matched a name-based lookup on an empty shelf).
  const firstBook = page.locator('.books-grid .book-open').first();
  if (await firstBook.isVisible().catch(() => false)) {
    await firstBook.click();
  } else {
    // Activate by keyboard: immune to the row reflowing under a pointer click.
    const newBook = page.locator('[data-testid="create-project"]').first();
    await newBook.focus();
    await page.keyboard.press('Enter');
    // The new-book dialog: accept its defaults.
    const create = page
      .getByRole('dialog')
      .getByRole('button', { name: /create/i })
      .first();
    if (await create.isVisible({ timeout: 5000 }).catch(() => false)) {
      await create.click();
    } else {
      console.warn(`\nWARN: the New book dialog did not open`);
    }
  }
  // Creating a book copies its starter files; allow for a slow first run.
  await writeTab.waitFor({ state: 'visible', timeout: 45000 });
  return true;
}

// Seed a throwaway extension so the per-extension rows (ExtensionItem) get scanned —
// they're data-dependent and otherwise never render. Requires advanced mode (which also
// reveals the full project settings). Idempotent: skips if one already exists (it
// persists in OPFS across the light/dark passes).
async function ensureDemoExtension(page) {
  await clickNav(page, 'Settings');
  // The sheet shows one section at a time: Advanced mode lives under You ›
  // Advanced mode, the extension import under This book › Format (which
  // only lists once advanced mode is on).
  await page.locator('[data-testid="settings-section-advanced"]').first().click();
  const advanced = page.getByRole('checkbox', { name: /Advanced mode/i }).first();
  if ((await advanced.count()) && !(await advanced.isChecked())) {
    await advanced.check();
    await page.waitForTimeout(400);
  }
  await page.locator('[data-testid="settings-section-format"]').first().click();
  await page.waitForTimeout(400);
  if ((await page.locator('.extension-item').count()) === 0) {
    await page.setInputFiles('#extension-file', {
      name: 'a11y-demo.js',
      mimeType: 'text/javascript',
      buffer: Buffer.from('// demo extension for the accessibility scan\n'),
    });
    await page
      .locator('.extension-item')
      .first()
      .waitFor({ timeout: 10000 })
      .catch(() => undefined);
  }
}

async function scanAllViews(page, theme) {
  const reports = [];
  const scan = async name => {
    try {
      const r = await scanView(page, name);
      reports.push({ ...r, theme });
    } catch (e) {
      console.warn(`\nWARN [${theme}]: could not scan "${name}": ${e.message}`);
    }
  };
  const visit = async name => {
    try {
      await clickNav(page, name);
    } catch (e) {
      console.warn(`\nWARN [${theme}]: skipped "${name}": ${e.message}`);
      return false;
    }
    return true;
  };

  // Outside a book: the Books shelf (the landing screen) and About. Reach Books
  // by its hook — the brand button's visible name is the app name.
  await page.locator('[data-testid="nav-workspace"]').first().click();
  await page.waitForTimeout(800);
  await scan('Books');
  if (await visit('About SEED.html')) {
    await scan('About');
    // About is a dialog over the shelf; Escape closes it.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  let workspaceReady = false;
  try {
    workspaceReady = await ensureWorkspace(page);
  } catch (e) {
    console.warn(`\nWARN [${theme}]: could not ensure a book: ${e.message}`);
    // What the page looked like when the book could not be opened or created.
    await page
      .screenshot({ path: `.playwright-mcp/a11y-no-book-${theme}.png` })
      .catch(() => undefined);
  }

  if (workspaceReady) {
    // Inside a book: Settings (a sheet over the view; Escape closes it), Share,
    // then the Book tab's sections.
    if (await visit('Settings')) {
      await scan('Settings');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    if (await visit('Share')) await scan('Share');
    if (await visit('Book')) {
      // Navigation is reached from Contents in advanced mode, not a section.
      for (const name of ['Contents', 'Details', 'Files']) {
        if (await visit(name)) await scan(name);
      }
    }
    await visit('Write');
    // Spine editor: reached by selecting a chapter (best-effort).
    try {
      const firstChapter = page.locator('.spine-item').first();
      if (await firstChapter.count()) {
        await firstChapter.locator('.spine-select, button').first().click();
        await page.waitForTimeout(700);
        await scan('Spine (chapter editor)');
      } else {
        console.warn(`\nWARN [${theme}]: no chapter to open the Spine editor — skipped.`);
      }
    } catch (e) {
      console.warn(`\nWARN [${theme}]: could not open the Spine editor: ${e.message}`);
    }

    // Re-scan Settings with advanced mode on and an extension installed, so the
    // per-extension rows (ExtensionItem) — which only render when extensions exist —
    // get checked in both themes.
    try {
      await ensureDemoExtension(page);
      await scan('Settings (advanced + extension)');
    } catch (e) {
      console.warn(`\nWARN [${theme}]: could not seed/scan extensions: ${e.message}`);
    }
    // Leave the sheet closed: its backdrop would block the next pass's clicks.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  return reports;
}

function printViolations({ label, theme, violations }) {
  if (violations.length === 0) {
    console.log(`\n✓ ${label} [${theme}] — no violations`);
    return;
  }
  console.log(
    `\n✗ ${label} [${theme}] — ${violations.length} violation${violations.length === 1 ? '' : 's'}`
  );
  for (const v of violations.slice().sort((a, b) => rank(b.impact) - rank(a.impact))) {
    const target = v.nodes[0]?.target?.join(' ') ?? '';
    console.log(
      `   [${(v.impact ?? 'n/a').toUpperCase()}] ${v.id} — ${v.help}` +
        ` (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'}: ${target})`
    );
    if (v.id === 'color-contrast') {
      const d = v.nodes[0]?.any?.find(c => c.data)?.data;
      if (d)
        console.log(
          `        fg ${d.fgColor} on bg ${d.bgColor} = ${d.contrastRatio}:1 (need ${d.expectedContrastRatio})`
        );
    }
    console.log(`        ${v.helpUrl}`);
  }
}

async function setTheme(page, theme) {
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [THEME_KEY, theme]);
  await page.reload({ waitUntil: 'networkidle' });
  await page
    .locator('[data-testid="nav-workspace"]')
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => undefined);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(URL, { waitUntil: 'networkidle' });
  } catch (e) {
    console.error(`\nCould not load ${URL} — is the dev server running? (${e.message})`);
    await browser.close();
    process.exit(2);
  }
  await page
    .locator('[data-testid="nav-workspace"]')
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => undefined);

  const reports = [];
  await setTheme(page, 'light');
  reports.push(...(await scanAllViews(page, 'light')));
  await setTheme(page, 'dark');
  reports.push(...(await scanAllViews(page, 'dark')));

  await browser.close();

  console.log('\n──────── Accessibility scan (light + dark) ────────');
  reports.forEach(printViolations);

  const all = reports.flatMap(r => r.violations);
  const byImpact = {};
  for (const v of all) byImpact[v.impact ?? 'n/a'] = (byImpact[v.impact ?? 'n/a'] ?? 0) + 1;
  const summary = IMPACT_ORDER.slice()
    .reverse()
    .filter(i => byImpact[i])
    .map(i => `${byImpact[i]} ${i}`)
    .join(', ');
  console.log(
    `\n──────── Summary: ${all.length} violation${all.length === 1 ? '' : 's'} across ` +
      `${reports.length} view-scans${summary ? ` (${summary})` : ''} ────────`
  );

  if (failOn) {
    const threshold = rank(failOn);
    const failing = all.filter(v => rank(v.impact) >= threshold);
    if (failing.length) {
      console.error(`\nFAIL: ${failing.length} violation(s) at or above "${failOn}".`);
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
