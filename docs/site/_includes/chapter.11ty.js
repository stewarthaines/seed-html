/**
 * Chapter page — spike layout, no theme. The book's own stylesheet styles the
 * content exactly as it does in the EPUB.
 */

const escape = text =>
  String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export default function ({ content, title, language }) {
  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} — SEED.html</title>
<link rel="stylesheet" href="../Styles/book.css">
<style>body { max-width: 42rem; margin-inline: auto; padding-inline: 1rem; font-family: system-ui, sans-serif; line-height: 1.5; }</style>
</head>
<body>
<main>
${content}
</main>
</body>
</html>
`;
}
