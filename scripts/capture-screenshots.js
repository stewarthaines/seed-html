import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Automated Screenshot Capture for Storybook Stories
 *
 * This script captures screenshots of all configured Storybook stories.
 *
 * To add new stories:
 * 1. Add story configuration to the `stories` array below
 * 2. Use the story ID format: category-story-name--variant-name
 * 3. Find story IDs by visiting the story in Storybook and checking the URL
 *
 * For backend feature demos with play functions:
 * - Use longer timeout (8000ms) to allow interactions to complete
 * - The play function will run automatically before screenshot
 *
 * Usage: npm run screenshots
 */

const screenshotsDir = path.resolve(process.cwd(), '__screenshots__');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const stories = [
  {
    name: 'button-primary',
    url: 'http://localhost:6006/iframe.html?args=&id=example-button--primary&viewMode=story',
  },
  {
    name: 'button-secondary',
    url: 'http://localhost:6006/iframe.html?args=&id=example-button--secondary&viewMode=story',
  },
  {
    name: 'button-large',
    url: 'http://localhost:6006/iframe.html?args=&id=example-button--large&viewMode=story',
  },
  {
    name: 'button-small',
    url: 'http://localhost:6006/iframe.html?args=&id=example-button--small&viewMode=story',
  },
  {
    name: 'header-logged-in',
    url: 'http://localhost:6006/iframe.html?args=&id=example-header--logged-in&viewMode=story',
  },
  {
    name: 'header-logged-out',
    url: 'http://localhost:6006/iframe.html?args=&id=example-header--logged-out&viewMode=story',
  },
  {
    name: 'page-logged-in',
    url: 'http://localhost:6006/iframe.html?args=&id=example-page--logged-in&viewMode=story',
  },
  {
    name: 'page-logged-out',
    url: 'http://localhost:6006/iframe.html?args=&id=example-page--logged-out&viewMode=story',
  },
  {
    name: 'storage-demo-interactive',
    url: 'http://localhost:6006/iframe.html?args=&id=backend-storage-api--interactive-demo&viewMode=story',
  },
  {
    name: 'storage-demo-with-data',
    url: 'http://localhost:6006/iframe.html?args=&id=backend-storage-api--demo-with-sample-data&viewMode=story',
  },
  {
    name: 'epub-unpacker-interactive',
    url: 'http://localhost:6006/iframe.html?args=&id=backend-epub-unpacker--interactive-demo&viewMode=story',
  },
  {
    name: 'epub-unpacker-with-data',
    url: 'http://localhost:6006/iframe.html?args=&id=backend-epub-unpacker--demo-with-sample-data&viewMode=story',
  },
  {
    name: 'epub-unpacker-error-scenarios',
    url: 'http://localhost:6006/iframe.html?args=&id=backend-epub-unpacker--error-scenarios&viewMode=story',
  },
  {
    name: 'epub-packager-basic-demo',
    url: 'http://localhost:6006/iframe.html?args=&id=backend-epub-packager--basic-demo&viewMode=story',
  },
  {
    name: 'epub-packager-without-progress',
    url: 'http://localhost:6006/iframe.html?args=&id=backend-epub-packager--without-progress&viewMode=story',
  },
  {
    name: 'epub-packager-progress-only',
    url: 'http://localhost:6006/iframe.html?args=&id=backend-epub-packager--progress-only&viewMode=story',
  },
];

async function captureScreenshots() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ screen: { width: 1200, height: 800 } });

  console.log('📸 Capturing screenshots...');

  for (const story of stories) {
    try {
      console.log(`Capturing ${story.name}...`);
      await page.goto(story.url);

      // For backend feature demos, wait longer for interactions to complete
      if (story.name.includes('storage-demo') || story.name.includes('epub-')) {
        await page.waitForTimeout(8000); // Wait for play function to complete
      } else {
        await page.waitForTimeout(1000); // Standard wait for other stories
      }

      const screenshotPath = path.join(screenshotsDir, `${story.name}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
      });

      console.log(`✅ Saved ${story.name}.png`);
    } catch (error) {
      console.error(`❌ Failed to capture ${story.name}:`, error);
    }
  }

  await browser.close();
  console.log('🎉 Screenshot capture complete!');
}

captureScreenshots().catch(console.error);
