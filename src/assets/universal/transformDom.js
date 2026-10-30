/**
 * Transform the chapter's DOM after the text transform has rendered it
 * @param {Document} htmlDocument - HTML document to transform
 * @param {string|undefined} idref - Spine item idref for context-aware transforms
 * @param {object} [ctx] - File-access context. May be omitted; when present:
 *   ctx.manifest, ctx.basePath, ctx.idref, ctx.language, ctx.spine (the OPF
 *   spine in reading order — { idref, linear }[]), and async methods
 *   readManifestText(href), readManifestDataURL(href), readSourceText(path),
 *   writeSourceText(path, text). A transform that uses these must be async.
 */
function transformDOM(htmlDocument, idref, ctx) {}
