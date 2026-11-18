/*
 * PuzzleScript games in a book page (the puzzlescript extension).
 *
 * The page carries the game as written: transformPuzzleScript.js turns a
 * puzzlescript code block into div.puzzlescript, holding the source in a hidden
 * pre.puzzlescript-source and a still of the first level for reading systems
 * that run no scripts. This file, which every page loads, starts the game on
 * the page that has one and does nothing on the others.
 *
 * The engine (Misc/puzzlescript/engine.txt) is the PuzzleScript player as one
 * script, shipped as text and run from here because it cannot sit in the page
 * head like an ordinary book script: it looks for its canvas the moment it
 * runs, listens to every key on the page, and compiles a game's rules into code
 * that refers to its own top-level names, so it must run once, unwrapped, on a
 * page with a game and after that page has loaded.
 *
 * One game per page: the player finds its canvas, title and buttons by id.
 */
(function () {
  'use strict';

  var ENGINE = '../Misc/puzzlescript/engine.txt';

  // The player builds its buttons and menu from HTML strings (unclosed inputs,
  // bare `checked`, SVG icons without a namespace), which an XHTML page refuses
  // or reads as XHTML. On a game page in an XHTML document, innerHTML parses as
  // HTML, as it would on the web page the player was written for.
  function htmlInnerHTML() {
    if (document.contentType === 'text/html') return;
    var native = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (!native || !native.set) return;
    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: true,
      enumerable: native.enumerable,
      get: native.get,
      set: function (markup) {
        var target = this.localName === 'template' && this.content ? this.content : this;
        var body = new DOMParser().parseFromString(
          '<!doctype html><body>' + markup, 'text/html').body;
        while (target.firstChild) target.removeChild(target.firstChild);
        Array.prototype.forEach.call(body.childNodes, function (node) {
          target.appendChild(document.importNode(node, true));
        });
      },
    });
  }

  function runEngine(code) {
    htmlInnerHTML();
    var script = document.createElement('script');
    script.textContent = code;
    document.head.appendChild(script);
  }

  function start() {
    var game = document.querySelector('.puzzlescript');
    if (!game || game.getAttribute('data-started')) return;
    var source = game.querySelector('.puzzlescript-source');
    if (!source) return;
    game.setAttribute('data-started', 'true');
    var loaded = typeof compile === 'function'
      ? Promise.resolve()
      : fetch(ENGINE).then(function (response) { return response.text(); }).then(runEngine);
    loaded.then(function () {
      game.classList.add('puzzlescript-live', 'player-shell');
      // On a fixed-layout page the game takes what is left below the text.
      if (game.classList.contains('puzzlescript-page')) {
        var top = game.getBoundingClientRect().top + window.scrollY;
        game.style.blockSize = Math.max(240, window.innerHeight - top) + 'px';
      }
      // The player sizes its canvas to the box, which is laid out only now.
      compile(['restart'], source.textContent);
      if (typeof canvasResize === 'function') canvasResize();
    }).catch(function (error) {
      game.removeAttribute('data-started');
      if (window.console) console.warn('PuzzleScript could not start:', error);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
