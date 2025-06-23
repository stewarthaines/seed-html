/**
 * Mock workspace data for EPUB Packaging demo
 */

export interface MockFile {
	path: string;
	content: string;
	mimeType: string;
}

export interface MockWorkspace {
	id: string;
	name: string;
	files: MockFile[];
}

export const BASIC_EPUB_WORKSPACE: MockWorkspace = {
	id: 'demo-workspace',
	name: 'Basic EPUB Demo',
	files: [
		{
			path: 'mimetype',
			content: 'application/epub+zip',
			mimeType: 'application/epub+zip'
		},
		{
			path: 'META-INF/container.xml',
			content: `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
	<rootfiles>
		<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
	</rootfiles>
</container>`,
			mimeType: 'application/xml'
		},
		{
			path: 'OEBPS/content.opf',
			content: `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
	<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
		<dc:title>Demo EPUB Book</dc:title>
		<dc:creator>Storybook Demo</dc:creator>
		<dc:language>en</dc:language>
		<dc:identifier id="uid">demo-epub-2024</dc:identifier>
		<dc:publisher>EDITME Demo</dc:publisher>
		<dc:date>2024-01-01</dc:date>
	</metadata>
	<manifest>
		<item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
		<item id="styles" href="styles.css" media-type="text/css"/>
	</manifest>
	<spine>
		<itemref idref="chapter1"/>
	</spine>
</package>`,
			mimeType: 'application/oebps-package+xml'
		},
		{
			path: 'OEBPS/chapter1.xhtml',
			content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<title>Chapter 1</title>
	<link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
	<h1>Chapter 1: Introduction</h1>
	<p>This is a sample chapter for the EPUB packaging demo. It demonstrates how plain text content can be transformed into a valid EPUB structure.</p>
	<p>The EPUB Packaging feature takes workspace files like this and creates a compliant ZIP archive that can be read by any EPUB reader.</p>
	<h2>Key Features</h2>
	<ul>
		<li>EPUB-compliant ZIP structure</li>
		<li>Metadata extraction from OPF files</li>
		<li>Compression optimization by file type</li>
		<li>Progress tracking during packaging</li>
		<li>Direct download functionality</li>
	</ul>
</body>
</html>`,
			mimeType: 'application/xhtml+xml'
		},
		{
			path: 'OEBPS/styles.css',
			content: `body {
	font-family: Georgia, serif;
	line-height: 1.6;
	margin: 2em;
	color: #333;
}

h1 {
	color: #2c3e50;
	border-bottom: 2px solid #3498db;
	padding-bottom: 0.5em;
}

h2 {
	color: #34495e;
	margin-top: 2em;
}

p {
	margin-bottom: 1em;
	text-align: justify;
}

ul {
	margin-left: 2em;
}

li {
	margin-bottom: 0.5em;
}`,
			mimeType: 'text/css'
		}
	]
};

/**
 * Mock FileStorageAPI for demo purposes
 */
export class MockFileStorageAPI {
	private workspace: MockWorkspace;

	constructor(workspace: MockWorkspace) {
		this.workspace = workspace;
	}

	async init(): Promise<void> {
		// Mock initialization
	}

	isInitialized(): boolean {
		return true;
	}

	async listFiles(_workspaceId: string): Promise<string[]> {
		return this.workspace.files.map(f => f.path);
	}

	async readFile(_workspaceId: string, path: string): Promise<ArrayBuffer> {
		const file = this.workspace.files.find(f => f.path === path);
		if (!file) {
			throw new Error(`File not found: ${path}`);
		}
		
		const encoder = new TextEncoder();
		return encoder.encode(file.content).buffer;
	}

	getBackendType() {
		return 'mock';
	}
}