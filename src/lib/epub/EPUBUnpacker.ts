/**
 * EPUB Unpacking Implementation
 * 
 * Extracts EPUB ZIP files using the custom ZIP library that leverages 
 * the Compression Streams API for efficient, memory-safe processing.
 */

import { Zip } from '../zip/index.js';
import { FileStorageAPI } from '../storage/index.js';
import { OPFUtils } from './opf-utils.js';

export interface UnpackResult {
	success: boolean;
	workspaceId?: string;
	error?: string;
	extractedFiles?: string[];
	totalSize?: number;
	processedFiles?: number;
}

export interface ValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
	detectedVersion?: string; // EPUB 2.0 or 3.0
	rootfilePath?: string;
	packageDirectory?: string;
}

export interface ExtractionResult {
	success: boolean;
	extractedFiles: string[];
	totalBytes: number;
	skippedFiles: string[];
	errors: string[];
}

export class EPUBUnpacker {
	private fileStorage: FileStorageAPI;

	constructor() {
		this.fileStorage = new FileStorageAPI();
	}

	/**
	 * Main entry point for unpacking EPUB files
	 */
	async unpackEPUB(file: File, workspaceId: string): Promise<UnpackResult> {
		try {
			// Ensure storage is initialized
			if (!this.fileStorage.isInitialized()) {
				await this.fileStorage.init();
			}

			// 1. Read EPUB file as ArrayBuffer
			const arrayBuffer = await file.arrayBuffer();
			
			// 2. Parse ZIP file using custom ZIP library
			const zip = new Zip(arrayBuffer);
			
			// 3. Validate EPUB structure
			const validation = await this.validateEPUBStructure(zip);
			if (!validation.isValid) {
				return { 
					success: false, 
					error: `Invalid EPUB structure: ${validation.errors.join(', ')}` 
				};
			}
			
			// 4. Extract files to workspace using File Storage API
			const extraction = await this.extractToWorkspace(zip, workspaceId);
			
			return {
				success: extraction.success,
				workspaceId,
				extractedFiles: extraction.extractedFiles,
				totalSize: extraction.totalBytes,
				processedFiles: extraction.extractedFiles.length,
				error: extraction.errors.length > 0 ? extraction.errors.join('; ') : undefined
			};
		} catch (err) {
			return { 
				success: false, 
				error: err instanceof Error ? err.message : 'Unknown error occurred' 
			};
		}
	}

	/**
	 * Validates EPUB structure according to EPUB specification
	 */
	async validateEPUBStructure(zip: Zip): Promise<ValidationResult> {
		const errors: string[] = [];
		const warnings: string[] = [];
		let detectedVersion: string | undefined;
		let rootfilePath: string | undefined;
		let packageDirectory: string | undefined;

		// Check for required files
		const fileNames = zip.entries.map(entry => entry.fileName);
		
		// 1. Must contain mimetype file
		if (!fileNames.includes('mimetype')) {
			errors.push('Missing required mimetype file');
		} else {
			// Validate mimetype content
			try {
				const mimetypeEntry = zip.entries.find(entry => entry.fileName === 'mimetype');
				if (mimetypeEntry) {
					const blob = await mimetypeEntry.extract();
					const content = await blob.text();
					if (content.trim() !== 'application/epub+zip') {
						errors.push(`Invalid mimetype content: "${content.trim()}" (expected "application/epub+zip")`);
					}
				}
			} catch {
				errors.push('Failed to read mimetype file content');
			}
		}

		// 2. Must contain META-INF/container.xml
		if (!fileNames.includes('META-INF/container.xml')) {
			errors.push('Missing required META-INF/container.xml file');
		} else {
			// Parse container.xml to find rootfile
			try {
				const containerEntry = zip.entries.find(entry => entry.fileName === 'META-INF/container.xml');
				if (containerEntry) {
					const blob = await containerEntry.extract();
					const containerXml = await blob.text();
					
					// Validate container.xml structure first
					const xmlValidation = OPFUtils.validateXML(containerXml);
					if (!xmlValidation.isValid) {
						errors.push(`Invalid XML in container.xml: ${xmlValidation.error}`);
					} else {
						const rootfileInfo = OPFUtils.parseContainerXml(containerXml);
						if (rootfileInfo.error) {
							errors.push(rootfileInfo.error);
						} else if (rootfileInfo.rootfilePath) {
							rootfilePath = rootfileInfo.rootfilePath;
							
							// Extract package directory from rootfile path
							const pathParts = rootfilePath.split('/');
							if (pathParts.length > 1) {
								packageDirectory = pathParts.slice(0, -1).join('/');
							}
							
							// Check if the rootfile actually exists in the ZIP
							if (!fileNames.includes(rootfilePath)) {
								errors.push(`Rootfile specified in container.xml not found: ${rootfilePath}`);
							}
						}
					}
				}
			} catch {
				errors.push('Failed to parse META-INF/container.xml');
			}
		}

		// 3. Basic ZIP structure validation
		if (zip.entries.length === 0) {
			errors.push('Empty ZIP file');
		}

		// 4. Check for suspicious or invalid file paths
		for (const fileName of fileNames) {
			if (fileName.includes('..')) {
				errors.push(`Invalid file path with directory traversal: ${fileName}`);
			}
			if (fileName.startsWith('/')) {
				warnings.push(`Absolute path found: ${fileName}`);
			}
		}

		// 5. Try to detect EPUB version from rootfile and validate OPF XML
		if (rootfilePath && fileNames.includes(rootfilePath)) {
			try {
				const opfEntry = zip.entries.find(entry => entry.fileName === rootfilePath);
				if (opfEntry) {
					const blob = await opfEntry.extract();
					const opfContent = await blob.text();
					
					// Validate OPF XML structure
					const xmlValidation = OPFUtils.validateXML(opfContent);
					if (!xmlValidation.isValid) {
						errors.push(`Invalid XML in OPF file (${rootfilePath}): ${xmlValidation.error}`);
					} else {
						detectedVersion = OPFUtils.detectEPUBVersion(opfContent);
						if (!detectedVersion) {
							warnings.push('Could not detect EPUB version from OPF file');
						}
					}
				}
			} catch {
				errors.push(`Failed to read or parse OPF file: ${rootfilePath}`);
			}
		}

		// 6. Additional validation warnings
		if (packageDirectory) {
			const packageFiles = fileNames.filter(name => name.startsWith(packageDirectory + '/'));
			if (packageFiles.length === 0) {
				warnings.push(`No files found in package directory: ${packageDirectory}/`);
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
			detectedVersion,
			rootfilePath,
			packageDirectory
		};
	}


	/**
	 * Extracts all ZIP entries to the specified workspace
	 */
	async extractToWorkspace(zip: Zip, workspaceId: string): Promise<ExtractionResult> {
		const extractedFiles: string[] = [];
		const skippedFiles: string[] = [];
		const errors: string[] = [];
		let totalBytes = 0;

		try {
			// Ensure workspace exists
			await this.fileStorage.createWorkspace(workspaceId);
		} catch (err) {
			// Workspace might already exist, which is fine
			if (err instanceof Error && !err.message.includes('already exists')) {
				errors.push(`Failed to create workspace: ${err.message}`);
				return {
					success: false,
					extractedFiles,
					totalBytes,
					skippedFiles,
					errors
				};
			}
		}

		for (const entry of zip.entries) {
			try {
				// Skip directory entries (they have no content)
				if (entry.fileName.endsWith('/')) {
					continue;
				}

				// Extract file using ZIP library's built-in decompression
				const blob = await entry.extract();
				const arrayBuffer = await blob.arrayBuffer();
				
				// Store in File Storage API workspace
				await this.fileStorage.writeFile(workspaceId, entry.fileName, arrayBuffer);
				
				extractedFiles.push(entry.fileName);
				totalBytes += arrayBuffer.byteLength;
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Unknown error';
				errors.push(`Failed to extract ${entry.fileName}: ${errorMessage}`);
				skippedFiles.push(entry.fileName);
			}
		}

		return {
			success: errors.length === 0,
			extractedFiles,
			totalBytes,
			skippedFiles,
			errors
		};
	}

	/**
	 * Get detailed information about an EPUB file without extracting it
	 */
	async analyzeEPUB(file: File): Promise<{
		isValid: boolean;
		fileCount: number;
		totalSize: number;
		validation: ValidationResult;
		fileList: string[];
	}> {
		try {
			const arrayBuffer = await file.arrayBuffer();
			const zip = new Zip(arrayBuffer);
			
			const validation = await this.validateEPUBStructure(zip);
			const fileList = zip.entries
				.map(entry => entry.fileName)
				.filter(name => !name.endsWith('/'))
				.sort();

			const totalSize = zip.entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0);

			return {
				isValid: validation.isValid,
				fileCount: fileList.length,
				totalSize,
				validation,
				fileList
			};
		} catch (err) {
			return {
				isValid: false,
				fileCount: 0,
				totalSize: 0,
				validation: {
					isValid: false,
					errors: [err instanceof Error ? err.message : 'Failed to analyze EPUB'],
					warnings: []
				},
				fileList: []
			};
		}
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		this.fileStorage.destroy();
	}
}