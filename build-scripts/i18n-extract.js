#!/usr/bin/env node

/**
 * Extract translatable strings from Svelte files using gettext-extractor
 */

import { GettextExtractor, JsExtractors } from 'gettext-extractor';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const locales = ['en', 'de', 'ka', 'ar', 'he', 'zh-Hant', 'ja'];

async function extractStrings() {
  console.log('🔍 Extracting translatable strings...');

  const extractor = new GettextExtractor();

  // Find all Svelte and TypeScript files
  const svelteFiles = await glob('src/**/*.svelte', { cwd: projectRoot });
  const tsFiles = await glob('src/**/*.ts', { cwd: projectRoot });
  const allFiles = [...svelteFiles, ...tsFiles];

  console.log(`📁 Found ${allFiles.length} files to scan`);

  // Extract from each file
  for (const file of allFiles) {
    const fullPath = join(projectRoot, file);
    
    extractor
      .createJsParser([
        // Basic translation calls: t('text')
        JsExtractors.callExpression('t', {
          arguments: {
            text: 0,
            context: 1
          }
        }),
        // Alternative underscore syntax: _('text') 
        JsExtractors.callExpression('_', {
          arguments: {
            text: 0,
            context: 1
          }
        })
      ])
      .parseFile(fullPath);
  }

  // Create/update .po files for each locale
  for (const locale of locales) {
    const poPath = join(projectRoot, 'locales', `${locale}.po`);
    
    try {
      console.log(`💾 Updating ${locale}.po...`);
      
      extractor.savePotFile(poPath, {
        headers: {
          'Language': locale,
          'MIME-Version': '1.0',
          'Content-Type': 'text/plain; charset=UTF-8',
          'Content-Transfer-Encoding': '8bit',
          'Project-Id-Version': 'EDITME EPUB Editor',
          'Report-Msgid-Bugs-To': '',
          'POT-Creation-Date': new Date().toISOString(),
          'PO-Revision-Date': new Date().toISOString(),
          'Last-Translator': '',
          'Language-Team': '',
          'Plural-Forms': 'nplurals=2; plural=(n != 1);'
        }
      });
      
    } catch (error) {
      console.error(`❌ Error creating ${locale}.po:`, error.message);
      process.exit(1);
    }
  }

  const messageCount = extractor.getMessages().length;
  console.log(`✅ Extracted ${messageCount} translatable strings`);
  console.log(`📝 Updated ${locales.length} .po files`);
}

// Run extraction
extractStrings().catch(error => {
  console.error('❌ Extraction failed:', error);
  process.exit(1);
});