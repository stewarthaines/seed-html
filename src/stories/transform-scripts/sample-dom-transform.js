function transformDOM(document) {
  // Add CSS classes and structure
  const body = document.body || document.querySelector('div');
  if (body) {
    body.className = 'chapter-content';

    // Add chapter class to h1 elements
    const h1Elements = body.querySelectorAll('h1');
    h1Elements.forEach(h1 => {
      h1.className = 'chapter-title';
    });

    // Add section class to h2 elements
    const h2Elements = body.querySelectorAll('h2');
    h2Elements.forEach(h2 => {
      h2.className = 'section-title';
    });

    // Add content class to paragraphs
    const paragraphs = body.querySelectorAll('p');
    paragraphs.forEach(p => {
      p.className = 'content-text';
    });
  }

  return document;
}
