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
const THEME_KEY = 'editme_theme_preference';
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

// A project must exist to reach the workspace views. Reuse one if present (e.g. restored
// after a theme reload), otherwise create a minimal one.
async function ensureWorkspace(page) {
  const metadataNav = page.getByRole('button', { name: 'Metadata', exact: true }).first();
  if (await metadataNav.isVisible().catch(() => false)) return true;
  await clickNav(page, 'Projects');
  await page
    .getByRole('button', { name: /create a new/i })
    .first()
    .click();
  await metadataNav.waitFor({ state: 'visible', timeout: 20000 });
  return true;
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

  // Views reachable without a workspace. (Publish is disabled until an EPUB is packaged,
  // so it's skipped here — clickNav reports it.)
  for (const name of ['Projects', 'About', 'Publish', 'Settings']) {
    if (await visit(name)) await scan(name);
  }

  let workspaceReady = false;
  try {
    workspaceReady = await ensureWorkspace(page);
  } catch (e) {
    console.warn(`\nWARN [${theme}]: could not ensure a project: ${e.message}`);
  }

  if (workspaceReady) {
    for (const name of ['Metadata', 'Manifest', 'Navigation']) {
      if (await visit(name)) await scan(name);
    }
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
    .getByRole('button', { name: 'Projects', exact: true })
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
    .getByRole('button', { name: 'Projects', exact: true })
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
