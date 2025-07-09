#!/usr/bin/env node

/**
 * Populate .po files with demo translations for Storybook demonstration
 * This script reads .po files and adds msgstr translations to demonstrate locale switching
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Demo translations with clear visual indicators
const DEMO_TRANSLATIONS = {
  de: text => `🇩🇪 ${text}`, // German with flag
  ar: text => `🇸🇦 ${text}`, // Arabic with flag
  he: text => `🇮🇱 ${text}`, // Hebrew with flag
  ja: text => `🇯🇵 ${text}`, // Japanese with flag
  ka: text => `🇬🇪 ${text}`, // Georgian with flag
  'zh-Hant': text => `🇹🇼 ${text}`, // Traditional Chinese with flag
};

async function readPoFile(locale) {
  const poPath = path.join(__dirname, `../locales/${locale}.po`);
  const content = await fs.readFile(poPath, 'utf-8');
  return content;
}

async function writePoFile(locale, content) {
  const poPath = path.join(__dirname, `../locales/${locale}.po`);
  await fs.writeFile(poPath, content, 'utf-8');
}

function addTranslationsToPoContent(content, locale, translator) {
  // Split into lines and process each msgid/msgstr pair
  const lines = content.split('\n');
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    result.push(line);

    // If this line contains msgid with actual content (not empty)
    if (line.startsWith('msgid "') && line !== 'msgid ""') {
      // Extract the English text from msgid "text"
      const match = line.match(/^msgid "(.+)"$/);
      if (match) {
        const englishText = match[1];

        // Look ahead to find the corresponding msgstr line
        if (i + 1 < lines.length && lines[i + 1].startsWith('msgstr ""')) {
          // Replace empty msgstr with translation
          const translation = translator(englishText);
          result[result.length] = `msgstr "${translation}"`;
          i++; // Skip the original msgstr line
        }
      }
    }
  }

  return result.join('\n');
}

async function populateLocaleTranslations(locale) {
  console.log(`📝 Processing ${locale} translations...`);

  const translator = DEMO_TRANSLATIONS[locale];
  if (!translator) {
    console.log(`⚠️  No translator defined for ${locale}, skipping`);
    return;
  }

  try {
    // Read current .po file
    const content = await readPoFile(locale);

    // Add translations
    const translatedContent = addTranslationsToPoContent(content, locale, translator);

    // Write back to .po file
    await writePoFile(locale, translatedContent);

    console.log(`✅ Updated ${locale}.po with demo translations`);
  } catch (error) {
    console.error(`❌ Failed to process ${locale}:`, error.message);
  }
}

async function main() {
  console.log('🚀 Creating demo translations for Storybook demonstration...');
  console.log('📋 This populates .po files with flag-prefixed translations');

  const locales = Object.keys(DEMO_TRANSLATIONS);

  for (const locale of locales) {
    await populateLocaleTranslations(locale);
  }

  console.log('\n🎉 Demo translations created in .po files!');
  console.log('\n📦 Next steps:');
  console.log('   1. Convert .po to .json: npm run i18n:convert');
  console.log('   2. Compress translations: npm run i18n:compress');
  console.log('   3. Test in Storybook: npm run storybook');
  console.log('   4. Use the 🌍 locale switcher in Storybook toolbar!');
}

main().catch(console.error);
