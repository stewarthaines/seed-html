function transformText(plainText, context) {
  // Simple markdown-like transformation
  let lines = plainText.split('\n');
  let html = '';

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('# ')) {
      html += '<h1>' + line.substring(2) + '</h1>';
    } else if (line.startsWith('## ')) {
      html += '<h2>' + line.substring(3) + '</h2>';
    } else if (line.length > 0) {
      // Simple bold and italic replacement
      line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
      html += '<p>' + line + '</p>';
    }
  }

  return html;
}
