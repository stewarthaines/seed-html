#!/usr/bin/env node

/**
 * Compress .json translation files into a ZIP bundle using fflate
 *
 * Uses fflate library for ZIP creation because:
 * - Cross-platform compatible (Node.js and browser)
 * - Designed for browser DecompressionStream compatibility
 * - High performance with small footprint (8kB)
 * - Better control over deflate compression settings
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { zip, strToU8 } from 'fflate';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function compressTranslations() {
  console.log('📦 Creating ZIP-based translation bundle with fflate...');

  const localesDir = join(projectRoot, 'src', 'lib', 'i18n', 'locales');
  const outputPath = join(projectRoot, 'static', 'i18n-bundle.zip');

  try {
    // Ensure static directory exists
    await fs.mkdir(join(projectRoot, 'static'), { recursive: true });

    // Read all .json files from locales directory
    const files = await fs.readdir(localesDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    if (jsonFiles.length === 0) {
      throw new Error('No JSON translation files found in locales directory');
    }

    console.log(`📄 Found ${jsonFiles.length} translation files:`, jsonFiles);

    // Prepare files for fflate
    const zipFiles = {};
    let totalOriginalSize = 0;

    for (const file of jsonFiles) {
      const filePath = join(localesDir, file);
      const content = await fs.readFile(filePath, 'utf8');

      // Validate JSON before adding
      try {
        JSON.parse(content);
        console.log(
          `✅ ${file}: Valid JSON, ${Math.round(Buffer.byteLength(content, 'utf8') / 1024)}KB`
        );
      } catch (parseError) {
        throw new Error(`Invalid JSON in ${file}: ${parseError.message}`);
      }

      // Convert string to Uint8Array for fflate
      zipFiles[file] = strToU8(content);
      totalOriginalSize += Buffer.byteLength(content, 'utf8');
      console.log(`📦 Prepared ${file} for ZIP`);
    }

    // Create ZIP using fflate with deflate compression
    console.log('🔄 Compressing files with fflate...');

    const zipData = await new Promise((resolve, reject) => {
      zip(zipFiles, { level: 6 }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

    // Write ZIP file
    await fs.writeFile(outputPath, zipData);

    const compressedSize = zipData.length;
    const compressionRatio = (
      ((totalOriginalSize - compressedSize) / totalOriginalSize) *
      100
    ).toFixed(1);

    console.log(`✅ Created i18n-bundle.zip with fflate`);
    console.log(`📊 Original size: ${Math.round(totalOriginalSize / 1024)}KB`);
    console.log(`📊 Compressed size: ${Math.round(compressedSize / 1024)}KB`);
    console.log(`📊 Compression: ${compressionRatio}% reduction`);
    console.log(`📁 Output: ${outputPath}`);
  } catch (error) {
    console.error('❌ ZIP creation failed:', error);
    process.exit(1);
  }
}

// Run compression
compressTranslations().catch(error => {
  console.error('❌ Compression failed:', error);
  process.exit(1);
});
