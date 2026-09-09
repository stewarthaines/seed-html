# Prompt: build a sample family-history book in SEED.html

A self-contained prompt for an agent with the Playwright MCP browser tools. It builds a small invented family book on a running SEED.html, installs the Family History extension from the catalog, and proves the result from the rendered preview. Written for a cheaper model: the selectors, waits and known traps are given, so nothing has to be rediscovered. Verified against readitinabook.com on 2026-09-09 (seven chapters in about forty seconds of page time).

Fill in the four inputs and hand the rest over verbatim.

````markdown
# Build a sample family-history book in SEED.html

## Inputs

- SITE: https://readitinabook.com/ (a running SEED.html; localhost:5173 also works)
- TITLE: Sample Family History
- FAMILY: invent one — grandparents, their two children with one spouse each, two grandchildren. Use fictional names. Never use real people.
- PACKAGE: no (yes = click "Package EPUB" at the end; the file lands in .playwright-mcp/)

## Tools

Use the Playwright MCP browser tools only (browser_navigate, browser_evaluate, browser_wait_for). Do all page interaction inside browser_evaluate functions; do not use browser_click or browser_type. Set input values with the native setter and dispatch `input` and `change` events:

    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)

(HTMLTextAreaElement.prototype for textareas.)

## Steps

1. Navigate to SITE, wait 4 s.
2. Click the "Projects" button, then the button with data-testid="create-project" (text "Create New"). In the dialog set the Title input to TITLE and click "Create". Wait 4 s. Confirm localStorage.seedhtml_app_workspace_id is set.
3. Click the "Settings" nav button. If a button "Advanced mode" exists, click it (the extension catalog is hidden in Basic mode). Find the catalog card whose text contains "Family History" (choose the deepest element containing both that text and a button "Add to project") and click that button. Wait 6 s. Verify via OPFS that SOURCE/extensions/family-history/person.schema.json exists: navigator.storage.getDirectory() → workspaces/<workspace id>/SOURCE/extensions/family-history/
4. Click the sidebar spine item [data-testid="spine-item-chapter01"], wait 1.5 s.
5. For each chapter in order, one evaluate call per chapter:
   - First chapter: rename chapter01. Others: click the previous chapter's spine item, wait 0.6 s, click the button whose aria-label is "Append Item" (it has no text), wait 1.2 s, find the new spine item id by diffing [data-testid^="spine-item-"] before and after.
   - Rename: click button[aria-label="Edit <id>"], wait 0.5 s, set #edit-spine-id to the new id, click the button with text "Save", wait 1.2 s, confirm the new id is in the spine list.
   - Fill: click [data-testid="spine-item-<newid>"], wait 1 s, set input[aria-label="Chapter title"], confirm an option of select[aria-label="Select file for pane 1"] contains "<newid>.txt", set textarea[aria-label="Pane 1 content"] to the source, wait 1.8 s (autosave).
6. Click every chapter once more in order (1.5 s each) so each stored render sees the others' records.
7. Click "Metadata", set the input whose aria-label is "Language tag" to en-GB (autosaves; no Save button). This makes dates day-first.
8. Verify: open the first chapter; in the preview iframe (the iframe whose contentDocument has a .family element) read .family-findings li — it must be empty — and .family, .tree, .lifeline-row text. Open the index chapter and read its h3 list. Report these.
9. If PACKAGE is yes, click "Package EPUB" and report the filename.

## Chapter sources (Djot)

Chapter ids are lowercase snake_case of the person's name; the last chapter is `people`. A person chapter is:

```
---
display: Full Name
birth: 1828-03-12          # EDTF or a bare year: 1902, 1830~, 1859?, 187X, 1866/1868
birthplace: Town
death: 1869-11-02
deathplace: Town
parents: [id, id]          # omit for the grandparents
partner: other_id          # scalar form, with married/married_place beside it
married: 1852-06-01
married_place: "St Peter Mancroft, Norwich"   # QUOTE any value containing a comma
others:                    # relatives without a chapter, same keys
  some_id:
    display: Name
    birth: 1854
    parents: [id, id]
---

# Full Name

:family:

One or two sentences of invented biography.

:tree:{depth=2}

## Lifelines

:lifeline:{as=Short}
:lifeline:{of=other_id as=Short}
```

Show the list form of partner on one grandparent who remarried:

```
partner:
  - { id: first_id, married: 1852-06-01, married_place: "Town, County" }
  - { id: second_id, married: 1874 }
```

and put the second spouse in that chapter's `others:`. Give one grandchild a path tree to the step-grandparent: `:tree:{to=second_id via=grandparent_id}`.

The `people` chapter is:

```
# Index of people

Everyone in the records, by surname.

:family-index:
```

## Rules

- Only keys allowed: display, nickname, birth, death, birthplace, deathplace, parents, partner, married, married_place, others. Anything else is a finding in the panel.
- Every id used in parents or partner must be a chapter id or an `others:` key.
- A finding shown in .family-findings means a record is wrong; fix the source and re-verify before reporting.
- Report what rendered, and the workspace id. Do not claim success without step 8's output.
````

## Notes for whoever runs it

- The book is created in the private storage of the browser the agent drives. To use it elsewhere, set PACKAGE to yes and import the EPUB.
- The two traps that cost time on the first run are already in the prompt: the catalog is hidden until Advanced mode is on, and an unquoted comma inside a YAML flow mapping splits the record, which the validator reports as a bad `partner`.
- The extension's own documentation is the header of `extensions/family-history/transformFamily.js`; the record keys are in `extensions/family-history/person.schema.json`.
