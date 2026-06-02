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

/**
 * Create a .po data structure from .pot template for a specific locale
 */
function initializePoFromPot(potData, locale) {
  const poData = {
    headers: {
      ...potData.headers,
      Language: locale,
      'PO-Revision-Date': new Date().toISOString(),
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
  const now = new Date().toISOString();

  // Preserve existing translations
  const existingTranslations = new Map();
  for (const [msgid, entry] of Object.entries(existingPo.translations[''] || {})) {
    if (msgid !== '' && entry.msgstr && entry.msgstr[0]) {
      existingTranslations.set(msgid, entry.msgstr[0]);
    }
  }

  // Create merged data structure
  const mergedPo = {
    headers: {
      ...potData.headers,
      Language: locale,
      'PO-Revision-Date':
        existingTranslations.size > 0 ? now : existingPo.headers['PO-Revision-Date'] || now,
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
  const svelteFiles = await glob('src/**/*.svelte', {
    cwd: projectRoot,
    ignore: ['**/*.test.*', '**/test/**', '**/__tests__/**'],
  });
  const tsFiles = await glob('src/**/*.ts', {
    cwd: projectRoot,
    ignore: ['**/*.test.*', '**/test/**', '**/__tests__/**'],
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

  // Post-process messages to convert absolute paths to relative paths
  for (const message of allMessages) {
    if (message.references) {
      message.references = message.references.map(ref => {
        // Convert absolute path to relative path
        if (ref.startsWith(projectRoot)) {
          return ref.substring(projectRoot.length + 1); // +1 to remove leading slash
        }
        return ref;
      });
    }
  }

  // Create .pot data structure using gettext-parser format
  const now = new Date().toISOString();
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

  // Generate .pot file
  const potPath = join(projectRoot, 'locales', 'messages.pot');
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
