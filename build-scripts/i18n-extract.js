#!/usr/bin/env node

/**
 * Extract translatable strings from Svelte files using proper gettext workflow
 */

import gettextExtractor from 'gettext-extractor';
import gettextParser from 'gettext-parser';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const { GettextExtractor, JsExtractors } = gettextExtractor;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const locales = ['en', 'de', 'ka', 'ar', 'he', 'zh-Hant', 'ja'];

/** Day-only stamp (YYYY-MM-DD) for .po headers — avoids per-build timestamp churn. */
const dayStamp = () => new Date().toISOString().slice(0, 10);

/**
 * Stable fingerprint of a translations object's msgids + references.
 * Used to detect whether the extracted catalog actually changed so we can
 * preserve dates when running extract with no source changes.
 */
function msgidFingerprint(translations) {
  return Object.entries(translations[''] || {})
    .filter(([k]) => k !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}\t${v.comments?.reference ?? ''}`)
    .join('\n');
}

/**
 * Create a .po data structure from .pot template for a specific locale
 */
function initializePoFromPot(potData, locale) {
  const poData = {
    headers: {
      ...potData.headers,
      Language: locale,
      'PO-Revision-Date': dayStamp(),
      'Last-Translator': '',
      'Language-Team': '',
    },
    translations: {
      '': {
        '': potData.translations[''][''],
      },
    },
  };

  // Copy all messages from .pot with empty translations
  for (const [msgid, entry] of Object.entries(potData.translations[''])) {
    if (msgid !== '') {
      poData.translations[''][msgid] = {
        ...entry,
        msgstr: [''], // Empty translation
      };
    }
  }

  return poData;
}

/**
 * Merge existing .po file with updated .pot template
 */
function mergePoWithPot(existingPo, potData, locale) {
  const now = dayStamp();

  // Preserve existing translations
  const existingTranslations = new Map();
  for (const [msgid, entry] of Object.entries(existingPo.translations[''] || {})) {
    if (msgid !== '' && entry.msgstr && entry.msgstr[0]) {
      existingTranslations.set(msgid, entry.msgstr[0]);
    }
  }

  // Only bump PO-Revision-Date when the set of msgids actually changed
  // (strings added or removed). A no-content run should leave the date alone.
  const newMsgids = new Set(Object.keys(potData.translations['']).filter(k => k !== ''));
  const existingMsgids = new Set(
    Object.keys(existingPo.translations[''] || {}).filter(k => k !== '')
  );
  const msgidsChanged =
    newMsgids.size !== existingMsgids.size || [...newMsgids].some(k => !existingMsgids.has(k));

  // Create merged data structure
  const mergedPo = {
    headers: {
      ...potData.headers,
      Language: locale,
      'PO-Revision-Date': msgidsChanged ? now : existingPo.headers['PO-Revision-Date'] || now,
      'Last-Translator': existingPo.headers['Last-Translator'] || '',
      'Language-Team': existingPo.headers['Language-Team'] || '',
    },
    translations: {
      '': {
        '': potData.translations[''][''],
      },
    },
  };

  // Merge translations from .pot with existing translations
  for (const [msgid, entry] of Object.entries(potData.translations[''])) {
    if (msgid !== '') {
      mergedPo.translations[''][msgid] = {
        ...entry,
        msgstr: [existingTranslations.get(msgid) || ''],
      };
    }
  }

  return mergedPo;
}

async function extractStrings() {
  console.log('🔍 Extracting translatable strings...');

  const extractor = new GettextExtractor();

  // Store translator comments separately since gettext-extractor doesn't preserve custom fields
  const extractedCommentsMap = new Map(); // text -> comment

  // Find all Svelte and TypeScript files, excluding test files
  // Scan the app and in-repo plugin source into the one shared catalog, so
  // plugins need no catalog/pipeline of their own (skip plugin deps + builds).
  const ignore = [
    '**/*.test.*',
    '**/test/**',
    '**/__tests__/**',
    '**/node_modules/**',
    '**/dist/**',
  ];
  const svelteFiles = await glob(['src/**/*.svelte', 'plugins/*/src/**/*.svelte'], {
    cwd: projectRoot,
    ignore,
  });
  const tsFiles = await glob(['src/**/*.ts', 'plugins/*/src/**/*.ts'], {
    cwd: projectRoot,
    ignore,
  });

  console.log(
    `📁 Found ${svelteFiles.length} Svelte files and ${tsFiles.length} TypeScript files to scan`
  );

  // Configure extraction options
  const extractorOptions = {
    arguments: {
      text: 0,
      context: 1,
    },
  };

  // Configure extraction options for this.translate(locale, 'key') pattern
  const classMethodExtractorOptions = {
    arguments: {
      text: 1, // key is the second argument
      context: 0, // locale is the first argument (used as context)
    },
  };

  // Extract from TypeScript files using JavaScript parser
  const jsParser = extractor.createJsParser([
    JsExtractors.callExpression('t', extractorOptions),
    JsExtractors.callExpression('$t', extractorOptions),
    JsExtractors.callExpression('_', extractorOptions),
    JsExtractors.callExpression('translate', extractorOptions),
    // Add support for this.translate(locale, 'key') patterns
    JsExtractors.callExpression('this.translate', classMethodExtractorOptions),
  ]);

  for (const file of tsFiles) {
    const fullPath = join(projectRoot, file);
    jsParser.parseFile(fullPath);
  }

  // Extract from Svelte files using custom regex approach
  for (const file of svelteFiles) {
    const fullPath = join(projectRoot, file);
    const content = readFileSync(fullPath, 'utf8');

    // Parse translator comments from both HTML and JavaScript comments
    const extractTranslatorComments = content => {
      const comments = new Map(); // line number -> comment text

      // HTML-style comments: <!-- i18n: comment -->
      const htmlCommentPattern = /<!--\s*i18n:\s*(.+?)\s*-->/gi;

      // JavaScript-style comments: // i18n: comment or /* i18n: comment */
      const jsLineCommentPattern = /\/\/\s*i18n:\s*(.+?)$/gim;
      const jsBlockCommentPattern = /\/\*\s*i18n:\s*(.+?)\s*\*\//gi;

      // Extract HTML comments
      let match;
      while ((match = htmlCommentPattern.exec(content)) !== null) {
        const commentText = match[1].trim();
        const lineNumber = content.substring(0, match.index).split('\n').length;
        comments.set(lineNumber, commentText);
      }

      // Extract JavaScript line comments
      while ((match = jsLineCommentPattern.exec(content)) !== null) {
        const commentText = match[1].trim();
        const lineNumber = content.substring(0, match.index).split('\n').length;
        comments.set(lineNumber, commentText);
      }

      // Extract JavaScript block comments
      while ((match = jsBlockCommentPattern.exec(content)) !== null) {
        const commentText = match[1].trim();
        const lineNumber = content.substring(0, match.index).split('\n').length;
        comments.set(lineNumber, commentText);
      }

      return comments;
    };

    const translatorComments = extractTranslatorComments(content);

    // Find the closest translator comment for a given line
    const findClosestComment = lineNumber => {
      // Look for comments within 3 lines before the translation
      for (let i = lineNumber - 1; i >= Math.max(1, lineNumber - 3); i--) {
        if (translatorComments.has(i)) {
          return translatorComments.get(i);
        }
      }
      return null;
    };

    // Use regex to find translation patterns in Svelte templates
    const patterns = [
      // Match {$t('text')} patterns (template expressions)
      /\{\s*\$t\s*\(\s*(["'])((?:\\.|(?!\1).)*?)\1\s*\)/g,
      // Match {t('text')} patterns (template expressions)
      /\{\s*t\s*\(\s*(["'])((?:\\.|(?!\1).)*?)\1\s*\)/g,
      // Match $t('text') patterns in attributes (but not import statements)
      /(?:=\s*|\{\s*)\$t\s*\(\s*(["'])((?:\\.|(?!\1).)*?)\1\s*\)/g,
      // Match t('text') patterns in attributes (but not import statements)
      /(?:=\s*|\{\s*)t\s*\(\s*(["'])((?:\\.|(?!\1).)*?)\1\s*\)/g,
      // Match {_('text')} patterns
      /\{\s*_\s*\(\s*(["'])((?:\\.|(?!\1).)*?)\1\s*\)/g,
      // Match {translate('text')} patterns
      /\{\s*translate\s*\(\s*(["'])((?:\\.|(?!\1).)*?)\1\s*\)/g,
      // Match $t('text') patterns in JavaScript contexts (not in imports or strings)
      /(?<!import\s+.*)\$t\s*\(\s*(["'])((?:\\.|(?!\1).)*?)\1\s*\)/g,
      // Match t('text') patterns in JavaScript contexts (not in imports or strings)
      /(?<!import\s+.*)\bt\s*\(\s*(["'])((?:\\.|(?!\1).)*?)\1\s*\)/g,
    ];

    // Function to filter out non-translatable strings
    const isTranslatable = text => {
      // Skip empty strings
      if (!text || text.trim() === '') return false;

      // Skip package names and module paths
      if (text.includes('@') && text.includes('/')) return false;
      if (text.startsWith('@')) return false;

      // Skip file extensions and paths
      if (
        text.includes('.') &&
        (text.endsWith('.js') ||
          text.endsWith('.ts') ||
          text.endsWith('.json') ||
          text.endsWith('.css'))
      )
        return false;

      // Skip single characters that aren't words
      if (text.length === 1 && !/[a-zA-Z]/.test(text)) return false;

      // Skip URLs and paths
      if (
        text.startsWith('http') ||
        text.startsWith('//') ||
        text.startsWith('./') ||
        text.startsWith('../')
      )
        return false;

      // Skip technical strings
      if (text.includes('\\n') && text.trim() === '\\n') return false;
      if (text === '/' || text === '.' || text === '..') return false;

      // Skip HTML tag names
      if (
        /^[a-z]+$/.test(text) &&
        text.length <= 5 &&
        [
          'div',
          'span',
          'p',
          'a',
          'img',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'ul',
          'ol',
          'li',
          'table',
          'tr',
          'td',
          'th',
          'form',
          'input',
          'label',
          'button',
          'select',
          'option',
          'textarea',
        ].includes(text)
      )
        return false;

      return true;
    };

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const text = match[2]; // The captured text content

        // Filter out non-translatable strings
        if (isTranslatable(text)) {
          // Add the message to the extractor with proper reference format
          const lineNumber = content.substring(0, match.index).split('\n').length;
          const translatorComment = findClosestComment(lineNumber);

          const messageData = {
            text: text,
            references: [`${file}:${lineNumber}`],
          };

          // Store translator comment separately
          if (translatorComment) {
            extractedCommentsMap.set(text, translatorComment);
          }

          extractor.addMessage(messageData);
        }
      }
    });
  }

  console.log(
    `✅ Processed ${tsFiles.length} TypeScript files and ${svelteFiles.length} Svelte files`
  );

  const allMessages = extractor.getMessages();
  console.log(`📝 Extracted ${allMessages.length} translatable strings`);
  if (extractedCommentsMap.size > 0) {
    console.log(`💬 Found ${extractedCommentsMap.size} translator comments`);
  }

  // Post-process references: make paths relative, drop line numbers, dedupe and
  // sort. File-only, stable references avoid the churn that line-number shifts
  // (and repeated uses within one file) would otherwise produce on every build.
  for (const message of allMessages) {
    if (!message.references) continue;
    const files = message.references.map(ref => {
      const rel = ref.startsWith(projectRoot)
        ? ref.substring(projectRoot.length + 1) // +1 to remove leading slash
        : ref;
      return rel.replace(/(:\d+)+$/, ''); // drop trailing :line (and :col if any)
    });
    message.references = [...new Set(files)].sort();
  }

  // Create .pot data structure using gettext-parser format
  const now = dayStamp();
  const potData = {
    headers: {
      'MIME-Version': '1.0',
      'Content-Type': 'text/plain; charset=UTF-8',
      'Content-Transfer-Encoding': '8bit',
      'Project-Id-Version': 'EDITME EPUB Editor',
      'Report-Msgid-Bugs-To': '',
      'POT-Creation-Date': now,
      'PO-Revision-Date': now,
      Language: '',
      'Language-Team': '',
      'Last-Translator': '',
      'Plural-Forms': 'nplurals=2; plural=(n != 1);',
    },
    translations: {
      '': {
        '': {
          msgid: '',
          msgstr: [''],
        },
      },
    },
  };

  // Add all extracted messages to .pot data
  for (const message of allMessages) {
    const messageEntry = {
      msgid: message.text,
      msgstr: [''],
      comments: {
        reference: message.references.join('\n'),
      },
    };

    // Add extracted comments (translator comments) if present
    const extractedComment = extractedCommentsMap.get(message.text);
    if (extractedComment) {
      messageEntry.comments.extracted = extractedComment;
    }

    potData.translations[''][message.text] = messageEntry;
  }

  // Preserve POT-Creation-Date when catalog content is unchanged. Compare the
  // msgid+reference fingerprint against the existing .pot so a no-content run
  // leaves the date alone (and avoids a spurious diff in locales/).
  const potPath = join(projectRoot, 'locales', 'messages.pot');
  if (existsSync(potPath)) {
    const existingPot = gettextParser.po.parse(readFileSync(potPath));
    if (msgidFingerprint(existingPot.translations) === msgidFingerprint(potData.translations)) {
      const preserved = existingPot.headers['POT-Creation-Date'];
      if (preserved) {
        potData.headers['POT-Creation-Date'] = preserved;
        potData.headers['PO-Revision-Date'] = preserved;
      }
    }
  }

  const potContent = gettextParser.po.compile(potData);
  writeFileSync(potPath, potContent);
  console.log(`📝 Generated ${potPath}`);

  // Update .po files using proper gettext workflow
  for (const locale of locales) {
    const poPath = join(projectRoot, 'locales', `${locale}.po`);

    try {
      console.log(`💾 Updating ${locale}.po...`);

      let updatedPo;
      if (existsSync(poPath)) {
        // Read existing .po file using gettext-parser
        const existingContent = readFileSync(poPath);
        const existingPo = gettextParser.po.parse(existingContent);

        // Merge with .pot template
        updatedPo = mergePoWithPot(existingPo, potData, locale);

        // Count preserved translations
        const preservedCount = Object.values(updatedPo.translations['']).filter(
          entry => entry.msgid && entry.msgstr && entry.msgstr[0]
        ).length;
        console.log(`📚 Preserved ${preservedCount} existing translations for ${locale}`);
      } else {
        // Initialize new .po from .pot template
        updatedPo = initializePoFromPot(potData, locale);
        console.log(`🆕 Initialized new ${locale}.po from template`);
      }

      // Write updated .po file using gettext-parser
      const updatedContent = gettextParser.po.compile(updatedPo);
      writeFileSync(poPath, updatedContent);
    } catch (error) {
      console.error(`❌ Error updating ${locale}.po:`, error.message);
      process.exit(1);
    }
  }

  console.log(`✅ Generated messages.pot template`);
  console.log(`📝 Updated ${locales.length} .po files using proper gettext workflow`);
}

// Run extraction
extractStrings().catch(error => {
  console.error('❌ Extraction failed:', error);
  process.exit(1);
});
