// Adapted from Chromium's built-in XML tree viewer:
//   https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/xml/DocumentXMLTreeViewer.js
//   (fetched from `main`, 2026-07-29)
//
// Copyright 2014 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file: https://chromium.googlesource.com/chromium/src/+/main/LICENSE
//
// Local modifications (SEED.html):
// - Converted to an ES module exporting render(xmlDoc, container); removed the
//   document-takeover entry points (prepareWebKitXMLViewer, sourceXMLLoaded,
//   window.onload hookup, the hidden source container, and the header banner).
// - Elements are created in the container's ownerDocument instead of the
//   viewer document; folding is scoped to the container (no ids assigned).
// - Dropped the XSLT header message branch of processProcessingInstruction.
// Styling lives in xml-tree-viewer.css (same directory), loaded by the app.

'use strict';

/** Document that render() creates output nodes in. */
let doc;

/**
 * Render an XML DOM as a collapsible tree into `container`.
 * Replaces any previous content of the container.
 *
 * @param {Document} xmlDoc parsed XML source (e.g. from DOMParser)
 * @param {Element} container host element in the app document
 */
export function render(xmlDoc, container) {
  doc = container.ownerDocument;
  const tree = createHTMLElement('div');
  tree.classList.add('pretty-print');
  for (var child = xmlDoc.firstChild; child; child = child.nextSibling)
    processNode(tree, child);
  container.replaceChildren(tree);
  initButtons(tree);
}

// Tree processing.

function processNode(parentElement, node)
{
  switch (node.nodeType) {
    case Node.PROCESSING_INSTRUCTION_NODE:
      processProcessingInstruction(parentElement, node);
      break;
    case Node.ELEMENT_NODE:
      processElement(parentElement, node);
      break;
    case Node.COMMENT_NODE:
      processComment(parentElement, node);
      break;
    case Node.TEXT_NODE:
      processText(parentElement, node);
      break;
    case Node.CDATA_SECTION_NODE:
      processCDATA(parentElement, node);
      break;
    default:
      // No-op for unsupported node types e.g. Node.DOCUMENT_FRAGMENT_NODE.
  }
}

function processElement(parentElement, node)
{
  if (!node.firstChild)
    processEmptyElement(parentElement, node);
  else {
    var child = node.firstChild;
    if (child.nodeType == Node.TEXT_NODE && !child.nextSibling)
      processShortTextOnlyElement(parentElement, node);
    else
      processComplexElement(parentElement, node);
  }
}

function processEmptyElement(parentElement, node)
{
  var line = createLine();
  line.appendChild(createTag(node, false, true));
  parentElement.appendChild(line);
}

function processShortTextOnlyElement(parentElement, node)
{
  var line = createLine();
  line.appendChild(createTag(node, false, false));
  for (var child = node.firstChild; child; child = child.nextSibling)
    line.appendChild(createText(child.nodeValue));
  line.appendChild(createTag(node, true, false));
  parentElement.appendChild(line);
}

function processComplexElement(parentElement, node)
{
  var folder = createFolder();
  folder.start.appendChild(createTag(node, false, false));

  for (var child = node.firstChild; child; child = child.nextSibling)
    processNode(folder.openedContent, child);

  folder.end.appendChild(createTag(node, true, false));

  parentElement.appendChild(folder);
}

function processComment(parentElement, node)
{
  var line = createLine();
  line.appendChild(createComment('<!-- ' + node.nodeValue + ' -->'));
  parentElement.appendChild(line);
}

function processCDATA(parentElement, node)
{
  var line = createLine();
  line.appendChild(createCDATA('<![CDATA[ ' + node.nodeValue + ' ]]>'));
  parentElement.appendChild(line);
}

function processProcessingInstruction(parentElement, node)
{
  var line = createLine();
  line.appendChild(
      createComment('<?' + node.nodeName + ' ' + node.nodeValue + '?>'));
  parentElement.appendChild(line);
}

function processText(parentElement, node)
{
  parentElement.appendChild(createText(node.nodeValue));
}

// Tree rendering.

function createHTMLElement(elementName)
{
  return doc.createElementNS('http://www.w3.org/1999/xhtml', elementName)
}

function createFolder()
{
  var folder = createHTMLElement('div');
  folder.classList.add('folder');

  folder.start = createLine();
  folder.start.appendChild(createFolderButton());
  folder.appendChild(folder.start);

  folder.openedContent = createHTMLElement('div');
  folder.openedContent.classList.add('opened');
  folder.appendChild(folder.openedContent);

  // Folded content.
  folder.foldedContent = createText('...');
  folder.foldedContent.classList.add('folded');
  folder.foldedContent.classList.add('hidden');
  folder.appendChild(folder.foldedContent);

  folder.end = createLine();
  folder.appendChild(folder.end);

  return folder;
}

function createFolderButton() {
  var button = createHTMLElement('span');
  button.classList.add('folder-button');
  button.classList.add('fold');
  return button;
}

function createComment(commentString)
{
  var comment = createHTMLElement('span');
  comment.classList.add('comment');
  comment.classList.add('html-comment');
  comment.textContent = commentString;
  return comment;
}

function createCDATA(cdataString)
{
  var cdata = createHTMLElement('span');
  cdata.classList.add('cdata');
  cdata.textContent = cdataString;
  return cdata;
}

function createText(value)
{
  var text = createHTMLElement('span');
  text.textContent = value;
  return text;
}

function createLine()
{
  var line = createHTMLElement('div');
  line.classList.add('line');
  return line;
}

function createTag(node, isClosing, isEmpty)
{
  var tag = createHTMLElement('span');
  tag.classList.add('html-tag');

  var stringBeforeAttrs = '<';
  if (isClosing)
    stringBeforeAttrs += '/';
  stringBeforeAttrs += node.nodeName;
  var textBeforeAttrs = doc.createTextNode(stringBeforeAttrs);
  tag.appendChild(textBeforeAttrs);

  if (!isClosing) {
    for (var i = 0; i < node.attributes.length; i++)
      tag.appendChild(createAttribute(node.attributes[i]));
  }

  var stringAfterAttrs = '';
  if (isEmpty)
    stringAfterAttrs += '/';
  stringAfterAttrs += '>';
  var textAfterAttrs = doc.createTextNode(stringAfterAttrs);
  tag.appendChild(textAfterAttrs);

  return tag;
}

function createAttribute(attributeNode)
{
  var attribute = createHTMLElement('span');
  attribute.classList.add('html-attribute');

  var attributeName = createHTMLElement('span');
  attributeName.classList.add('html-attribute-name');
  attributeName.textContent = attributeNode.name;

  var textBefore = doc.createTextNode(' ');
  var textBetween = doc.createTextNode('="');

  var attributeValue = createHTMLElement('span');
  attributeValue.classList.add('html-attribute-value');
  attributeValue.textContent = attributeNode.value;

  var textAfter = doc.createTextNode('"');

  attribute.appendChild(textBefore);
  attribute.appendChild(attributeName);
  attribute.appendChild(textBetween);
  attribute.appendChild(attributeValue);
  attribute.appendChild(textAfter);
  return attribute;
}

function directChildWithClass(element, className)
{
  for (var child = element.firstElementChild; child; child = child.nextElementSibling) {
    if (child.classList.contains(className))
      return child;
  }
  return null;
}

function toggleFunction(section) {
  return function() {
    var foldedContent = directChildWithClass(section, 'folded');
    var openedContent = directChildWithClass(section, 'opened');
    var startLine = directChildWithClass(section, 'line');
    var folderButton = startLine ? startLine.querySelector('.folder-button') : null;

    if (foldedContent) {
      if (foldedContent.className.includes('hidden'))
        foldedContent.className = 'folded';
      else
        foldedContent.className = 'folded hidden';
    }

    if (openedContent) {
      if (openedContent.className.includes('hidden'))
        openedContent.className = 'opened';
      else
        openedContent.className = 'opened hidden';
    }

    if (folderButton) {
      if (folderButton.className.includes('open'))
        folderButton.className = 'folder-button fold';
      else
        folderButton.className = 'folder-button open';
    }
  };
}

function initButtons(root)
{
  var sections = root.querySelectorAll('.folder');
  for (var i = 0; i < sections.length; i++) {
    var folderButton = sections[i].querySelector('.folder-button');
    folderButton.onclick = toggleFunction(sections[i]);
    folderButton.onmousedown = handleButtonMouseDown;
  }
}

function handleButtonMouseDown(e)
{
   // To prevent selection on double click
   e.preventDefault();
}
