/**
 * The app's DOM-transform extensions, loaded for Node.
 *
 * Each extension in extensions/<id>/ runs in its own node:vm sandbox (its
 * transform is a global `transformDOM`, so two extensions can't share one):
 * the extension's scripts first, then its DOM transforms, exactly as the app
 * loads them into its transform iframe. A book lists the extensions its EPUB
 * project uses, so its web pages come out of the same code.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const EXTENSIONS_DIR = 'extensions';

function loadExtension(id) {
  const dir = path.join(EXTENSIONS_DIR, id);
  const manifest = JSON.parse(readFileSync(path.join(dir, 'extension.json'), 'utf8'));
  const transforms = manifest.domTransforms ?? [];
  if (manifest.textTransforms?.length > 0) {
    throw new Error(`${dir}: text transforms are not supported by the docs build`);
  }
  return transforms.map(file => {
    const sandbox = { console };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    for (const script of [...(manifest.scripts ?? []), file]) {
      const filename = path.join(dir, script);
      vm.runInContext(readFileSync(filename, 'utf8'), sandbox, { filename });
    }
    if (typeof sandbox.transformDOM !== 'function') {
      throw new Error(`${dir}/${file} defines no transformDOM`);
    }
    return sandbox.transformDOM;
  });
}

const loaded = new Map();

/**
 * The DOM transforms of the given extensions, in order, as one function that
 * transforms a chapter document in place.
 *
 * @param {string[]} ids - extension ids, as folder names under extensions/
 * @returns {(doc: Document, idref: string) => Promise<void>}
 */
export function domTransforms(ids) {
  const transforms = ids.flatMap(id => {
    if (!loaded.has(id)) loaded.set(id, loadExtension(id));
    return loaded.get(id);
  });
  return async (doc, idref) => {
    for (const transform of transforms) await transform(doc, idref);
  };
}
