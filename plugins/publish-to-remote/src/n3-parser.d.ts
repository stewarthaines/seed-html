/**
 * The parser module on its own. Importing `n3`'s index brings in its stream
 * classes and the readable-stream polyfill, which the bundler keeps; the
 * plugin only parses Turtle documents whole.
 */
declare module 'n3/src/N3Parser.js' {
  import type { Parser } from 'n3';
  const N3Parser: typeof Parser;
  export default N3Parser;
}
