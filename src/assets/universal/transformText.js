/**
 * Convert simple markdown to well-formed XHTML
 * @param {string} markdown - Markdown text
 * @returns {string} Valid XHTML output
 */
function transformText(markdown) {
  // Split content into blocks (separated by double newlines)
  const blocks = markdown.split(/\n\s*\n/).filter(block => block.trim());
  const htmlBlocks = [];

  for (const block of blocks) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;

    // Check if block is a header
    const headerMatch = trimmedBlock.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = processInlineFormatting(headerMatch[2]);
      htmlBlocks.push(`<h${level}>${text}</h${level}>`);
    } else {
      // Process as paragraph content
      let paragraphContent = processInlineFormatting(trimmedBlock);
      // Convert single newlines to <br/> within paragraphs
      paragraphContent = paragraphContent.replace(/\n/g, '<br />');
      htmlBlocks.push(`<p>${paragraphContent}</p>`);
    }
  }

  return htmlBlocks.join('\n');
}

/**
 * Process inline formatting (bold, italic) within text
 * @param {string} text - Text to process
 * @returns {string} Text with inline HTML tags
 */
function processInlineFormatting(text) {
  let result = text;

  // Bold and italic (process bold first to handle overlap correctly)
  result = result.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*(.*?)\*/g, '<em>$1</em>');

  return result;
}
