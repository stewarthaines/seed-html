import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Regenerate the manuals' screenshots from Storybook stories.
 *
 * scripts/manual-shots.json maps each image path (inside a manual's Images/
 * directory) to the story that produces the state, the element to clip to,
 * and the app mode the shot documents. Stories live under
 * src/stories/manual-shots/ and end on the exact state to photograph.
 *
 * Images are written in place — review the resulting docs diff like any
 * other change. Fixed viewport and deviceScaleFactor keep re-runs
 * pixel-comparable and retina-sharp.
 *
 * Usage: npm run storybook   (in another terminal)
 *        npm run manual-shots [-- <substring filter on image path>]
 */

const SB_URL = process.env.SB_URL ?? 'http://localhost:6006';
const manifestPath = path.resolve(process.cwd(), 'scripts/manual-shots.json');
const filter = process.argv[2];

async function captureManualShots() {
  const { shots } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const entries = Object.entries(shots).filter(([out]) => !filter || out.includes(filter));
  if (entries.length === 0) {
    console.log(filter ? `No shots match "${filter}".` : 'No shots in the manifest.');
    return;
  }

  const browser = await chromium.launch();

  console.log(`📸 Regenerating ${entries.length} manual shot(s) from ${SB_URL}...`);
  let failures = 0;

  for (const [out, shot] of entries) {
    // A fresh context per shot: clean localStorage keeps each recipe's app-mode
    // loader deterministic (no leakage from a prior shot), and avoids the
    // slowdown of an accumulated context tipping heavy recipes over the wait.
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    try {
      console.log(`Capturing ${out} (${shot.mode} mode)...`);
      await page.goto(`${SB_URL}/iframe.html?id=${shot.story}&viewMode=story`);
      await page.waitForLoadState('networkidle');
      // The story's play() drives to the end state; wait for the clip target
      // and give the final render a beat to settle (fonts, focus rings).
      const target = page.locator(shot.clip).first();
      await target.waitFor({ state: 'visible', timeout: 90000 });
      await page.waitForTimeout(1000);

      fs.mkdirSync(path.dirname(out), { recursive: true });
      await target.screenshot({ path: out });
      console.log(`✅ Wrote ${out}`);
    } catch (error) {
      failures += 1;
      console.error(`❌ Failed ${out}:`, error.message);
    } finally {
      await context.close();
    }
  }

  await browser.close();
  if (failures > 0) {
    console.error(`${failures} shot(s) failed — images not updated for those entries.`);
    process.exit(1);
  }
  console.log('🎉 Manual shots regenerated. Review the docs diff before committing.');
}

captureManualShots().catch(error => {
  console.error(error);
  process.exit(1);
});
