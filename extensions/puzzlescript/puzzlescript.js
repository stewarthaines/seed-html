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
  var HOLD_MS = 250;

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

  // A page that finds the engine already loaded is a new document in the same
  // window: SEED.html's preview opens each chapter in the window it already
  // has, which keeps every script's names but drops the page's elements and
  // event listeners. (A reading system loads each page afresh, and
  // re-running the engine there would redeclare its names.) So redo what the
  // engine's files did for their page when they first ran: find the canvas
  // (graphics.js), listen for input (inputoutput.js; removing first keeps
  // this from doubling up if the listeners did survive) and build the
  // player's controls (mobile.js).
  function reattachEngine() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    var inputs = [
      [document, 'touchstart', onMouseDown], [document, 'touchmove', mouseMove],
      [document, 'touchend', onMouseUp], [document, 'mousedown', onMouseDown],
      [document, 'mouseup', onMouseUp], [document, 'keydown', onKeyDown],
      [document, 'keyup', onKeyUp], [window, 'focus', onMyFocus], [window, 'blur', onMyBlur],
    ];
    inputs.forEach(function (entry) {
      entry[0].removeEventListener(entry[1], entry[2], false);
      entry[0].addEventListener(entry[1], entry[2], false);
    });
    Mobile._instance = null;
    Mobile.setupPlayerControls();
    Mobile.enable();
  }

  // The page height a fixed-layout page declares (its viewport meta), which
  // holds even on a page Books has loaded but not yet laid out; else the window.
  function pageHeight() {
    var meta = document.querySelector('meta[name="viewport"]');
    var match = meta && /height\s*=\s*(\d+)/.exec(meta.getAttribute('content') || '');
    return match ? Number(match[1]) : window.innerHeight;
  }

  // On a fixed-layout page the game takes what is left below the text. Sizes
  // taken before Books lays a page out can be wrong, so this runs again on
  // pageshow, resize and the first touch, and the player refits its canvas.
  function fit(game) {
    if (game.classList.contains('puzzlescript-page')) {
      var top = game.getBoundingClientRect().top + window.scrollY;
      game.style.blockSize = Math.max(240, pageHeight() - top) + 'px';
    }
    if (game.classList.contains('puzzlescript-live') && typeof canvasResize === 'function') {
      canvasResize();
    }
  }

  // Touches on the game are the game's. Apple Books turns a fixed-layout page
  // on a swipe, zooms on a double tap or a pinch, and shows or hides its own
  // controls on a tap, unless the touch events themselves are cancelled; the
  // player cancels only pointer events, which Books ignores for this. The
  // player acts on pointer events and its own window-level touch listeners,
  // which still run. The game menu is left alone: its controls act on click,
  // which a cancelled touch would never send. See process/APPLE_BOOKS_BEHAVIOUR.md.
  function claimTouches(game) {
    function claim(event) {
      if (event.target.closest && event.target.closest('.player-menu')) return;
      if (event.cancelable) event.preventDefault();
    }
    ['touchstart', 'touchmove', 'touchend'].forEach(function (type) {
      // Capture: the player's toolbar and buttons stop touchstart bubbling.
      game.addEventListener(type, claim, { passive: false, capture: true });
    });
  }

  function start() {
    var game = document.querySelector('.puzzlescript');
    if (!game || game.getAttribute('data-started')) return;
    var source = game.querySelector('.puzzlescript-source');
    if (!source) return;
    game.setAttribute('data-started', 'true');
    fit(game);
    claimTouches(game);
    var refit = function () { fit(game); };
    window.addEventListener('pageshow', refit);
    window.addEventListener('resize', refit);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', refit);
    game.addEventListener('pointerdown', refit, { once: true, capture: true });

    // Books photographs a page for its thumbnail once the page's own work is
    // done; holding the still for a moment first makes the thumbnail the first
    // level rather than the player's black title screen.
    var hold = new Promise(function (resolve) { setTimeout(resolve, HOLD_MS); });
    var loaded = hold.then(function () {
      if (typeof compile === 'function') return reattachEngine();
      return fetch(ENGINE).then(function (response) { return response.text(); }).then(runEngine);
    });
    loaded.then(function () {
      game.classList.add('puzzlescript-live', 'player-shell');
      fit(game);
      // The player sizes its canvas to the box, which is laid out only now.
      compile(['restart'], source.textContent);
      fit(game);
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
