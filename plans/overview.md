# EDITME.html overview

The app runs in all modern browsers (recent Safari, Chromium, Firefox and Edge) and doesn't need to support old browser versions. It can be served by a web server or from the local filesystem via a file: scheme url. All static resources need to be inlined (svg, js, css) by the build system (vite).

The app is written in TypeScript using Svelte to compile to javascript, so there are no third-party library dependencies in the core application. Extensibility is possible using javascript files that are loaded from the EPUB manifest as described later.

Browser APIs are used for local file storage and for packaging and unpacking EPUB files rather than additional javascript dependencies. OPFS is used where available, falling back to a custom IndexedDB-based solution otherwise.

## Accessibility

The app is designed for accessibility.

## Plain text transform

The app converts plain text into the xhtml files required by the EPUB Reading System. Each chapter (or page) xhtml has a corresponding plain text manifest item associated by its id. The plain text source is stored in the EPUB within the `SOURCE.zip` manifest item.

For example a chapter manifest item might be called `OEBPS/chapter1.xhtml` with an id of `chapter1` and its plain text source is stored in the workspace as `SOURCE/text/chapter1.txt` (bundled in SOURCE.zip during packaging).

The EPUB file also includes javascript used to transform the plain text to xhtml. This allows the EPUB author to decide what plain text formatting convention to use. Possible formats are markdown or asciidoc or your own. The choice of which javascript library to use is also open to the author based on their needs.

If the transform fails at any stage (plain text -> xhtml, xhtml dom transform) the user is notified by displaying an informative message in the relevant place (eg. in the preview iframe if the xhtml transform failed).

The textarea has a change event handler which triggers debounced render to preview so the user never has to explicitly save the plain text to see the preview update. If the transform to xhtml fails the preview and the chapter xhtml manifest item is not modified, so only valid items are saved to the workspace.

## File storage

Two browser-local file storage backends are provided;

1. OPFS
2. IndexedDB

The OPFS storage solution is more performant for the use-case of turning manifest items into content blob urls for the preview iframe. The IndexedDB is provided as a fallback based on feature detection for browsers (or given security constraints) that don't support OPFS File Handle .createWritable().

## Packaging and unpacking EPUB

The EPUB format is a zip file. The browser Decompression Streams API is used to perform unpacking of existing EPUB files, and packagining of workspace EPUB content uses the Compression Streams API.

When loading a malformed EPUB file the user should be notified but the app makes no attempt to recover, and the load operation fails.

If the storage quota is exceeded the loading fails with a message to the user. Storage availability and quota should be visible somewhere in the ui.

When an existing EPUB is loaded it gets unpacked into the available file storage and a `workspace` is created. The workspace ID is a unique identifier that is used as the toplevel folder name in the selected storage.

## UI Overview

The main UI consists of a collapsible left sidebar and then two panes which fill the remaining space. The left pane shows either a list of things (manifest items, metadata groups) or a textarea (spine item or nav item). The right pane shows the preview of the current chapter or nav item, or the metadata form subset, or the raw manifest item (text, image, audio player).

See screenshots in `./plans/screens/*.png`

The left/right panels are dynamically resizeable by dragging the border. This works with both mouse and touch events.

## EPUB manifest

The app implements an extension to the EPUB standard file structure that I'm calling 'Active EPUB'. It treats mimetype, META-INF/content.opf and OEBPS/ as usual but adds SOURCE.zip and EDITME.html files at the OEBPS level. SOURCE.zip contains all editor-specific files (plain text sources, transform scripts, extensions, settings) and is extracted to a SOURCE/ directory during editing. The EDITME.html app provides everything required for maintaining the content in the future.

A minimal Active EPUB file might contain these files;

```
mimetype
META-INF/content.opf
OEBPS/
OEBPS/chapter1.xhtml
OEBPS/chapter2.xhtml
OEBPS/styles/page.css
OEBPS/scripts/responsive.js
OEBPS/SOURCE.zip      # Contains all editor files
OEBPS/EDITME.html
```

**Note**: SOURCE.zip contains the editor workspace files:

- `SOURCE/text/chapter1.txt`, `SOURCE/text/chapter2.txt` (plain text sources)
- `SOURCE/scripts/transformText.js` (text transform script)
- `SOURCE/extensions/markdown-it/` (markdown library)
- `SOURCE/extensions/abcjs/` (music notation library)
- `SOURCE/settings.json` (editor configuration)

## Text editing

The app provides a textarea in an iframe for editing plain text that is then processed, via a javascript dynamic function call, into a chapter xhtml file. The plain text source file is stored in the EPUB manifest as described above. The xhtml file is also in the manifest and is a spine item. The association between plain text source and xhtml is one-to-one.

The content flow is like this;

textarea iframe content
-> transformText.js
-> transformDom.js
-> manifest spine item (as blob)
-> prepare for preview
-> preview iframe

### transformText API

The `transformText.js` will be run as a dynamic function in the textarea iframe's context.

```js
const codeStringWithArgs = await readFile(workspaceId, 'SOURCE/scripts/transformText.js');
const dynamicFunctionWithArgs = new Function('plainText', codeStringWithArgs);
const plainText = document.querySelector('textarea').value;
const transformedText = await dynamicFunctionWithArgs(plainText);
const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE xhtml>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter title</title>
</head>
<body>
${transformedText}
</body>
</html>`;
```

A minimal example of a transformText implementation that uses global MarkdownIt might look like this;

```js
return new Promise(resolve => {
    resolve(await transform());
})

async function transform() {
    const md = window.markdownit({xhtmlOut: true, breaks: true});
    const html = md.render(plainText);
    return html;
}
```

### transformDom API

The `transformDom.js` will be run as a dynamic function.

```js
// TODO
```

A minimal example of a dom transform might look like this;

```js
// TODO
```

## Spine item preview

The xhtml spine item is previewed in an iframe next to the source textarea. This is possible by substituting blob content urls for any static resources the xhtml references.

### Device selection

Either 'Responsive' which fills the pane, or multi-device with a dropdown for each of two previews. The devices are characterized by screen size, and provide a toggle to switch between landscape and portrait orientation.

The devices to support should include;

- iphone8
- iphone14
- ipadmini
- ipad
- ipadpro
- pixelphone

The Responsive size has a minimum width of 200px.

## Spine item list

Reorder. Rename. Delete. Append.

## Manifest view

Manifest items are listed in a table, with individual rows selectable. The content of the manifest item is displayed next to the list. The content preview should handle text (javascript, css, xhtml, plain text), image (png, svg, jpg), audio (mp3, wav) and video types.

There is a separate row in the table for the 'content.opf' file which is displayed as a text item.

Buttons for 'Add' and 'Create' a manifest item.

## Metadata view

Immediate mode editing based on form inputs. The content.opf gets updated on blur event from each input so there's no need for explicit 'save' action.

The metadata items are grouped by frequency of use. The left pane has the groups ('Basic', 'Advanced', 'Accessibility') and the right pane has the input fields.

Metadata items related to fixed layout and accessibility are provided as dropdown selections.

## Workspaces list

A dropdown at the top of the left sidebar lists available workspaces. It is populated by iterating over the toplevel workspace IDs and pulling book title and author from the stored content.opf for each known workspace.

## Package EPUB

The 'Package EPUB' button triggers the packaging of the current workspace as a valid EPUB, including mimetype uncompressed as the first item, content.opf and the rest of the files in the workspace. This package is then downloaded with the book title, author name and timestamp of packaging as the filename with a '.epub' extension.

## EPUB extension scripts

There are mechanisms to extend the functionality of the EDITME app in a couple of ways;

1. provide a script that transforms plain text to xhtml
2. provide a script that manipulates the xhtml dom fragment after it has been created, before it is written to the xhtml manifest item

## EPUB Reading System scripts

A static javascript asset can be added as a manifest item that is referenced by the chapter xhtml and therefore executed by the EPUB reading system. This is a separate category of script to those mentioned in the 'extension scripts' section.

## EPUB Reading System stylsheets

Similarly to reading system scripts, the addition of a stylesheet manifest item causes it to be included in each chapter's head element with a link tag.

## Audio clip editor

Clip Range feature for choosing begin and end timestamps, with option to playback the clip from begin to end, or just play the last 2 seconds of the clip.

## Light/dark mode

The ui can be switched between dark and light modes. The mode selection is persisted in localStorage. The initial mode defaults to the browser setting.

## CSS approach

The css for the app needs to be designed in such a way as to minimise the duplication of styles. This might be acheived by using classes on visually similar elements so that they inherit the same styles, and defining styles in a global or shared stylesheet.
