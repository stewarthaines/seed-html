#!/usr/bin/env node

/**
 * Compress .json translation files into a ZIP archive for EPUB embedding
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Simple ZIP implementation using Node.js built-in zlib
import { createGzip } from 'zlib';

async function compressTranslations() {
  console.log('📦 Compressing translation files...');

  const localesDir = join(projectRoot, 'src', 'lib', 'i18n', 'locales');
  const outputPath = join(projectRoot, 'static', 'translations.zip');

  try {
    // Ensure static directory exists
    await fs.mkdir(join(projectRoot, 'static'), { recursive: true });

    // For now, create a simple archive of all JSON files concatenated
    // This is a temporary solution until we can properly integrate with the ZIP library
    
    // Read all .json files from locales directory
    const files = await fs.readdir(localesDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    let totalSize = 0;
    const archiveData = {};

    for (const file of jsonFiles) {
      const filePath = join(localesDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      
      archiveData[file] = content;
      totalSize += Buffer.byteLength(content, 'utf8');
      console.log(`📄 Added ${file} (${Math.round(Buffer.byteLength(content, 'utf8') / 1024)}KB)`);
    }

    // Create a simple JSON archive (not a real ZIP, but compressed)
    const archiveJson = JSON.stringify(archiveData);
    const compressedBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      const gzip = createGzip();
      
      gzip.on('data', chunk => chunks.push(chunk));
      gzip.on('end', () => resolve(Buffer.concat(chunks)));
      gzip.on('error', reject);
      
      gzip.write(archiveJson);
      gzip.end();
    });

    await fs.writeFile(outputPath, compressedBuffer);
    
    const compressedSize = compressedBuffer.length;
    const compressionRatio = ((totalSize - compressedSize) / totalSize * 100).toFixed(1);

    console.log(`✅ Created translations.zip (compressed JSON)`);
    console.log(`📊 Original size: ${Math.round(totalSize / 1024)}KB`);
    console.log(`📊 Compressed size: ${Math.round(compressedSize / 1024)}KB`);
    console.log(`📊 Compression: ${compressionRatio}% reduction`);
    console.log(`📁 Output: ${outputPath}`);

  } catch (error) {
    console.error('❌ Compression failed:', error);
    process.exit(1);
  }
}

// Run compression
compressTranslations().catch(error => {
  console.error('❌ Compression failed:', error);
  process.exit(1);
});