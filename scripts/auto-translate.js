#!/usr/bin/env node

/**
 * Auto-translate English strings to other locales using free MyMemory API
 * Creates demonstration translations for Storybook locale switching
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Free MyMemory translation API (no API key required, 1000 requests/day)
async function translateText(text, targetLang) {
  try {
    // Clean text for URL encoding
    const cleanText = text.trim();
    if (!cleanText) return text;

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=en|${targetLang}`;

    console.log(`    Translating: "${cleanText}" -> ${targetLang}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translated = data.responseData.translatedText;
      console.log(`    ✅ Result: "${translated}"`);
      return translated;
    } else {
      throw new Error(
        `API returned status ${data.responseStatus}: ${data.responseDetails || 'Unknown error'}`
      );
    }
  } catch (error) {
    console.warn(`    ⚠️ Translation failed: ${error.message}`);
    // Fallback: return original text with language indicator
    return `[${targetLang.toUpperCase()}] ${text}`;
  }
}

// Language mappings for MyMemory API
const LANGUAGE_MAPPINGS = {
  de: 'de', // German
  ar: 'ar', // Arabic
  he: 'he', // Hebrew
  ja: 'ja', // Japanese
  ka: 'ka', // Georgian (may fallback to prefix)
  'zh-Hant': 'zh-TW', // Traditional Chinese (Taiwan)
};

// Language display names
const LANGUAGE_NAMES = {
  de: 'German (Deutsch)',
  ar: 'Arabic (العربية)',
  he: 'Hebrew (עברית)',
  ja: 'Japanese (日本語)',
  ka: 'Georgian (ქართული)',
  'zh-Hant': 'Traditional Chinese (繁體中文)',
};

async function loadEnglishTranslations() {
  const enPath = path.join(__dirname, '../src/lib/i18n/locales/en.json');
  const content = await fs.readFile(enPath, 'utf-8');
  return JSON.parse(content);
}

async function translateLocale(locale, englishTranslations) {
  const langCode = LANGUAGE_MAPPINGS[locale];
  const langName = LANGUAGE_NAMES[locale];

  console.log(`\n🌍 Translating to ${langName} (${locale})...`);

  const translated = {};
  const keys = Object.keys(englishTranslations);
  const total = keys.length;

  for (let i = 0; i < total; i++) {
    const key = keys[i];
    const englishText = englishTranslations[key];

    console.log(`  [${i + 1}/${total}]`);

    // Translate the text
    translated[key] = await translateText(englishText, langCode);

    // Rate limiting: pause every 3 requests to be respectful to free API
    if ((i + 1) % 3 === 0 && i < total - 1) {
      console.log(`    💤 Pausing 2 seconds for rate limiting...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return translated;
}

async function saveTranslations(locale, translations) {
  const filePath = path.join(__dirname, `../src/lib/i18n/locales/${locale}.json`);
  const formatted = JSON.stringify(translations, null, 2);
  await fs.writeFile(filePath, formatted, 'utf-8');

  const count = Object.keys(translations).length;
  console.log(`✅ Saved ${locale}.json (${count} translations)`);
}

async function main() {
  console.log('🚀 Starting automatic translation for Storybook demonstration');
  console.log('📡 Using MyMemory free translation API (no API key required)');
  console.log('⏱️  This will take ~2-3 minutes with rate limiting\n');

  try {
    // Load English source
    const englishTranslations = await loadEnglishTranslations();
    const stringCount = Object.keys(englishTranslations).length;
    console.log(`📝 Found ${stringCount} English strings to translate`);

    // Sample of what we're translating
    const sampleKeys = Object.keys(englishTranslations).slice(0, 3);
    console.log('📋 Sample strings:');
    sampleKeys.forEach(key => {
      console.log(`   "${key}": "${englishTranslations[key]}"`);
    });

    // Translate each locale
    const locales = Object.keys(LANGUAGE_MAPPINGS);
    const results = [];

    for (const locale of locales) {
      try {
        const translations = await translateLocale(locale, englishTranslations);
        await saveTranslations(locale, translations);

        // Count successful translations vs fallbacks
        const successful = Object.values(translations).filter(
          text => !text.startsWith('[') || !text.includes('] ')
        ).length;

        results.push({
          locale,
          total: Object.keys(translations).length,
          successful,
          fallbacks: Object.keys(translations).length - successful,
        });
      } catch (error) {
        console.error(`❌ Failed to translate ${locale}:`, error.message);
        results.push({ locale, error: error.message });
      }
    }

    // Summary
    console.log('\n🎉 Translation Summary:');
    results.forEach(result => {
      if (result.error) {
        console.log(`   ${result.locale}: ❌ Failed - ${result.error}`);
      } else {
        console.log(
          `   ${result.locale}: ✅ ${result.successful} translated, ${result.fallbacks} fallbacks`
        );
      }
    });

    console.log('\n📦 Next steps:');
    console.log('   1. Rebuild translations: npm run i18n:build');
    console.log('   2. Test in Storybook: npm run storybook');
    console.log('   3. Use the 🌍 locale switcher in the Storybook toolbar!');
  } catch (error) {
    console.error('💥 Translation process failed:', error);
    console.error('🔧 Try running again or check your internet connection');
    process.exit(1);
  }
}

main();
