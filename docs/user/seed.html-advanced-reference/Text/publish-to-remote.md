# The publish-to-remote plugin

App Settings has a **Plugins** group with a single plugin: **publish-to-remote**, switched on there. This chapter is what it does.

## Validation

The plugin's broadly useful feature has little to do with remotes. With it enabled, a **Validate** action runs **EPUBCheck** — the EPUB standard's official conformance checker — over your packaged book and shows the result in a modal: the errors and warnings it found, or a clean pass.

![A packaged EPUB row in the plugin pane, with Upload, Download, Validate and Delete buttons.](../Images/screenshot-publish-validation.png){.figure}

![The same row after validating: a "1 error" badge and a Report button have replaced Validate.](../Images/screenshot-validation-errors.png){.figure}

Many issues belong to a particular chapter. Where one does, the report links straight to it, and that chapter's preview header gains an **EpubCheck** button listing just its issues — so you can work through a chapter against its own errors instead of scanning the whole report.

![The Validation Report modal: status Invalid, one error (RSC-007) linking to OEBPS/Text/chapter01.xhtml line 15 — a referenced image missing from the EPUB.](../Images/screenshot-validation-report.png){.figure}

![The chapter's preview header with an EpubCheck tab (badge: 1) listing that chapter's single error above the live preview.](../Images/screenshot-validation-chapter-report.png){.figure}

This is the validation the earlier chapters pointed forward to: package the book, validate it, and fix anything it flags before you hand it on.

Beside validation sits **Read**: every packaged EPUB — in the core Publish list, in the plugin's local files, and on the remote's files — has a Read action that opens the book in a new tab running **READ.html**, a lightweight EPUB reader vendored with the app. It's the quickest look at the artefact itself: the packaged book as a reading system presents it, not the editor's preview. Books with interactive features (audio clips, for example) ask once per book before their scripts run — the same question your readers will see — and then the features work. For a remote file the reader fetches the object's public URL directly, so the remote must allow cross-origin reads (CORS) — realistic for an S3/R2 bucket you control, effectively out of reach for Google Drive, Dropbox, and most WebDAV hosts; local files need no such setup. Like the plugin, Read needs the app served over HTTP — the reader isn't part of the single-file build.

## Remotes

The plugin uploads a packaged EPUB straight to a remote you've configured — an S3 or R2 bucket, WebDAV, Google Drive, or Dropbox. Credentials are entered at runtime and kept per-remote in the browser's private storage; nothing is baked into the build, and you bring your own.

Of the four, the one worth setting up is an **S3-compatible bucket**. Cloudflare's **R2** has a free tier with no egress fees, as do several other S3-compatible providers; create a bucket, give it a custom domain and a public URL, and each book gets a stable address rather than a file you re-send each time.

The other three are weaker. With **Google Drive** or **Dropbox** it's usually simpler to download the EPUB and drop it into a synced folder yourself; **WebDAV** works only where the server is configured to allow cross-origin (CORS) uploads. If you're going to configure a remote at all, make it an S3 or R2 bucket.

## Publishing

With a remote configured, the plugin's pane lists your packaged EPUBs and the files already on the remote; publishing uploads a book, and you can delete remote files from the same place. When you're serving books from a real host — the S3/R2 case — it can also keep an **OPDS catalogue** beside them: a small feed an OPDS-aware reading app can browse and subscribe to, rather than opening one file at a time.

OPDS is to publications what RSS is to podcasts — an open feed a reading app can browse and subscribe to, with no store in between. It has the potential to anchor a whole ecosystem of digital publications; it isn't there yet, but support is real and growing — the same catalogue opens in a desktop reader like **Thorium**, on iOS and Android in **Cantook**, and in SEED.html's own catalogue browser.

![The Essential Samples catalogue in Thorium on macOS — four book covers (Sample Magazine, Music Notation, Novel, Tech Manual) in the Catalogs view.](../Images/screenshot-thorium-macos-opds.png){.figure}

![The same catalogue in Cantook on iOS — the four sample-book covers in a phone layout.](../Images/screenshot-cantook-ios-opds.jpeg){.figure}

![SEED.html's Import from Catalog dialog browsing the same catalogue by URL, listing the same sample books.](../Images/screenshot-seed.html-opds.png){.figure}
