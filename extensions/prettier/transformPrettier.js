/**
 * Reformat JavaScript code blocks with Prettier at three target widths. The
 * `prettier` + `prettierPlugins` globals are provided by the extension's libs
 * (prettier.js, babel.js, estree.js), loaded into the transform iframe.
 *
 * @param {Document} htmlDocument - HTML document to transform
 */
async function transformDOM(htmlDocument, idref) {
  // duplicate each code block and give them a content width property: narrow, wide, full
  await transformPrettier(htmlDocument, { narrow: 30, wide: 50, full: 80 });
}

async function transformPrettier(htmlDocument, widths) {
    // Assumes `prettier` + `prettierPlugins` globals are already loaded.
    const blocks = htmlDocument.querySelectorAll(
      'pre > code.language-js, pre > code.language-javascript'
    );

    for (const code of blocks) {
      const pre = code.parentElement;
      const source = code.textContent;                 // plain text, spans flattened
      const codeClass = code.getAttribute('class') || 'language-js';

      // Format the same source once per target width. A parse error fails them
      // all, so skip the whole block and leave the original untouched.
      let variants;
      try {
        variants = await Promise.all(
          Object.entries(widths).map(async ([name, printWidth]) => {
            const out = await prettier.format(source, {
              parser: 'babel',
              plugins: prettierPlugins,
              printWidth,
              tabWidth: 2,
              semi: true,
              singleQuote: false,
            });
            return { name, code: out.replace(/\n+$/, '') };
          })
        );
      } catch {
        continue;
      }

      // One <pre class="<name>"> per width, wrapped in a container.
      const container = htmlDocument.createElement('div');
      container.className = 'code-variants';
      for (const { name, code: formatted } of variants) {
        const p = htmlDocument.createElement('pre');
        p.className = name;                             // narrow | wide | full
        const c = htmlDocument.createElement('code');
        c.setAttribute('class', codeClass);            // keep language-js for highlighting
        c.textContent = formatted;
        p.appendChild(c);
        container.appendChild(p);
      }

      pre.replaceWith(container);
    }

    return htmlDocument;
  }