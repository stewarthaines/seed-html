/**
 * EPUB Packaging - Feature 03
 * 
 * Creates valid EPUB ZIP files from workspace content using the custom ZIP library
 * with EPUB-compliant structure and download functionality.
 */

import { ZipWriter, downloadBlob } from '../zip/index.js';
import { FileStorageAPI } from '../storage/index.js';

export interface EPUBMetadata {
	title: string;
	author?: string;
	language: string;
	identifier: string;
	publisher?: string;
	date?: string;
}

export interface WorkspaceFile {
	path: string;
	content: ArrayBuffer;
	size: number;
	mimeType?: string;
}

export interface CompressionSettings {
	method: 0x00 | 0x08; // Store or Deflate
	reason: string;
}

export interface PackageProgress {
	phase: 'reading' | 'compressing' | 'writing' | 'complete';
	currentFile?: string;
	processedFiles: number;
	totalFiles: number;
	currentBytes: number;
	totalBytes: number;
}

export interface PackageOptions {
	compressionLevel?: 'fast' | 'balanced' | 'maximum';
	includeEditmeFiles?: boolean;
	validateStructure?: boolean;
	progressCallback?: (progress: PackageProgress) => void;
}

export interface PackageResult {
	success: boolean;
	blob?: Blob;
	filename?: string;
	error?: string;
	totalSize?: number;
	compressedSize?: number;
	fileCount?: number;
	processingTime?: number;
}

export class EPUBPackager {
	private fileStorage: FileStorageAPI;

	constructor() {
		this.fileStorage = new FileStorageAPI();
	}

	async packageEPUB(workspaceId: string, options: PackageOptions = {}): Promise<PackageResult> {
		const startTime = Date.now();
		
		try {
			// Ensure storage is initialized
			if (!this.fileStorage.isInitialized()) {
				await this.fileStorage.init();
			}

			// 1. Read all workspace files using File Storage API
			const files = await this.readWorkspaceFiles(workspaceId);
			
			if (files.length === 0) {
				return { success: false, error: 'Workspace is empty' };
			}

			// 2. Extract metadata from content.opf
			const metadata = await this.extractMetadata(files);
			
			// 3. Create ZIP writer with EPUB-compliant structure
			const zipWriter = new ZipWriter();
			
			const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
			let currentBytes = 0;

			// 4. Add files with optimized compression
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				const compression = this.optimizeCompression(file.path, file.content);
				
				await zipWriter.addFile(file.path, file.content, {
					compressionMethod: compression.method,
					lastModified: new Date()
				});
				
				currentBytes += file.size;
				
				options.progressCallback?.({
					phase: 'compressing',
					currentFile: file.path,
					processedFiles: i + 1,
					totalFiles: files.length,
					currentBytes,
					totalBytes
				});
			}
			
			// 5. Build final ZIP blob
			options.progressCallback?.({
				phase: 'writing',
				processedFiles: files.length,
				totalFiles: files.length,
				currentBytes: totalBytes,
				totalBytes
			});

			const blob = await zipWriter.buildBlob();
			const filename = this.generateFilename(metadata);
			
			options.progressCallback?.({
				phase: 'complete',
				processedFiles: files.length,
				totalFiles: files.length,
				currentBytes: totalBytes,
				totalBytes
			});
			
			return {
				success: true,
				blob,
				filename,
				totalSize: totalBytes,
				compressedSize: blob.size,
				fileCount: files.length,
				processingTime: Date.now() - startTime
			};
		} catch (error) {
			return { 
				success: false, 
				error: error instanceof Error ? error.message : 'Unknown error',
				processingTime: Date.now() - startTime
			};
		}
	}

	async readWorkspaceFiles(workspaceId: string): Promise<WorkspaceFile[]> {
		const filePaths = await this.fileStorage.listFiles(workspaceId);
		const files: WorkspaceFile[] = [];

		for (const path of filePaths) {
			try {
				const content = await this.fileStorage.readFile(workspaceId, path);
				files.push({
					path,
					content,
					size: content.byteLength,
					mimeType: this.getMimeType(path)
				});
			} catch (error) {
				// Skip files that can't be read but don't fail the entire operation
				// eslint-disable-next-line no-console
				console.warn(`Failed to read file ${path}:`, error);
			}
		}

		return files;
	}

	private async extractMetadata(files: WorkspaceFile[]): Promise<EPUBMetadata> {
		// 1. Find and read container.xml to get the rootfile path
		const containerFile = files.find(f => f.path === 'META-INF/container.xml');
		if (!containerFile) {
			throw new Error('Missing META-INF/container.xml file - invalid EPUB structure');
		}

		const decoder = new TextDecoder();
		const containerContent = decoder.decode(containerFile.content);
		const rootfilePath = this.parseRootfilePath(containerContent);

		// 2. Find and read the OPF file
		const opfFile = files.find(f => f.path === rootfilePath);
		if (!opfFile) {
			throw new Error(`Missing OPF file at path: ${rootfilePath}`);
		}

		const opfContent = decoder.decode(opfFile.content);
		return this.parseOPFMetadata(opfContent);
	}

	private parseRootfilePath(containerContent: string): string {
		const rootfileMatch = containerContent.match(/<rootfile[^>]+full-path\s*=\s*["']([^"']+)["'][^>]*>/i);
		if (!rootfileMatch) {
			throw new Error('Could not find rootfile path in container.xml');
		}
		return rootfileMatch[1];
	}

	private parseOPFMetadata(opfContent: string): EPUBMetadata {
		// Extract required metadata fields
		const titleMatch = opfContent.match(/<dc:title[^>]*>(.*?)<\/dc:title>/i);
		const languageMatch = opfContent.match(/<dc:language[^>]*>(.*?)<\/dc:language>/i);
		const identifierMatch = opfContent.match(/<dc:identifier[^>]*>(.*?)<\/dc:identifier>/i);

		// Check for required fields
		if (!titleMatch) {
			throw new Error('Missing required dc:title in OPF metadata');
		}
		if (!languageMatch) {
			throw new Error('Missing required dc:language in OPF metadata');
		}
		if (!identifierMatch) {
			throw new Error('Missing required dc:identifier in OPF metadata');
		}

		// Extract optional fields
		const authorMatch = opfContent.match(/<dc:creator[^>]*>(.*?)<\/dc:creator>/i);
		const publisherMatch = opfContent.match(/<dc:publisher[^>]*>(.*?)<\/dc:publisher>/i);
		const dateMatch = opfContent.match(/<dc:date[^>]*>(.*?)<\/dc:date>/i);

		return {
			title: titleMatch[1].trim(),
			author: authorMatch?.[1]?.trim(),
			language: languageMatch[1].trim(),
			identifier: identifierMatch[1].trim(),
			publisher: publisherMatch?.[1]?.trim(),
			date: dateMatch?.[1]?.trim()
		};
	}

	optimizeCompression(fileName: string, _data: ArrayBuffer): CompressionSettings {
		// mimetype file must be uncompressed and first (handled by ZipWriter)
		if (fileName === 'mimetype') {
			return { method: 0x00, reason: 'EPUB compliance requirement' };
		}

		const ext = fileName.split('.').pop()?.toLowerCase();
		
		// Already compressed formats - store only
		if (['jpg', 'jpeg', 'png', 'gif', 'mp3', 'mp4', 'webp', 'zip'].includes(ext || '')) {
			return { method: 0x00, reason: 'Already compressed format' };
		}
		
		// Text-based formats - compress
		if (['html', 'xhtml', 'xml', 'css', 'js', 'txt', 'opf', 'ncx'].includes(ext || '')) {
			return { method: 0x08, reason: 'Text-based content compresses well' };
		}
		
		// Default to compression for unknown types
		return { method: 0x08, reason: 'Default compression' };
	}

	private getMimeType(fileName: string): string {
		const ext = fileName.split('.').pop()?.toLowerCase();
		
		const mimeTypes: Record<string, string> = {
			'html': 'text/html',
			'xhtml': 'application/xhtml+xml',
			'xml': 'application/xml',
			'css': 'text/css',
			'js': 'application/javascript',
			'txt': 'text/plain',
			'opf': 'application/oebps-package+xml',
			'ncx': 'application/x-dtbncx+xml',
			'jpg': 'image/jpeg',
			'jpeg': 'image/jpeg',
			'png': 'image/png',
			'gif': 'image/gif',
			'webp': 'image/webp',
			'mp3': 'audio/mpeg',
			'mp4': 'video/mp4',
			'epub': 'application/epub+zip'
		};

		return mimeTypes[ext || ''] || 'application/octet-stream';
	}

	generateFilename(metadata: EPUBMetadata): string {
		const title = this.sanitizeFilename(metadata.title || 'Untitled');
		const author = metadata.author ? this.sanitizeFilename(metadata.author) : null;
		const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
		
		const parts = [title];
		if (author) parts.push(author);
		parts.push(timestamp);
		
		return `${parts.join(' - ')}.epub`;
	}

	private sanitizeFilename(name: string): string {
		return name
			.replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
			.replace(/\s+/g, ' ')         // Normalize whitespace
			.trim()
			.substring(0, 50);            // Limit length
	}

	downloadEPUB(blob: Blob, filename: string): void {
		// Uses ZIP library's download utility
		downloadBlob(blob, filename);
	}
}