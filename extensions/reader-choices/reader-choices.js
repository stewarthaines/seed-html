/**
 * SEED.html reader-choices reading-system script.
 *
 * transformReaderChoices.js builds the page in its default state: variants
 * that don't match a choice's default carry rc-off, and each control shows
 * the default as plain text with its buttons hidden. This script, where the
 * reading system runs it, applies the reader's stored choices and reveals the
 * buttons. Without it — scripts refused, or print — the page stays as built.
 *
 * The page's <body> carries data-rc-book (the book's identifier) and
 * data-rc-choices ({ name: { values: [ids], default } }). Choices are stored
 * in localStorage under 'seed-reader-choices:' + the identifier, as one JSON
 * object for the book, so two books in one reading app never share a setting.
 * A stored value the page's declaration doesn't offer shows the default and
 * is left in the store; a choice saves only its own key.
 *
 * A scope (.rc-scope, e.g. a recipe that labels its own servings) owns the
 * choices in its data-rc-scope: controls and variants inside it follow the
 * scope's value, not the book's, and it is stored on its own under
 * <book key>|<data-rc-key> (chapter + heading id). A scope the reader hasn't
 * touched starts from the book's value; one without a key lasts as long as
 * the page.
 *
 * A choice with mode 'cover' blanks the variants it doesn't match (class
 * rc-covered, focusable) instead of removing them; a tap, Enter or Space
 * reveals one, and any change of choice covers them all again. Covered text
 * stays in the accessibility tree: a listener hears the whole passage.
 *
 * localStorage may be missing or throw (private modes, some reading systems):
 * the choice then lasts as long as the page.
 *
 * Kept to conservative, widely supported JS for reading-system compatibility.
 */
(function () {
  'use strict';

  var PREFIX = 'seed-reader-choices:';

  function parse(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  function readStore(key) {
    try {
      var value = parse(window.localStorage.getItem(key));
      return value && typeof value === 'object' ? value : {};
    } catch (e) {
      return {};
    }
  }

  function writeStore(key, name, value) {
    try {
      var stored = readStore(key);
      stored[name] = value;
      window.localStorage.setItem(key, JSON.stringify(stored));
    } catch (e) {
      /* no storage: the choice lasts as long as the page */
    }
  }

  // 'measure:metric serves:1x,2x' → [{ name, values }]
  function parseWhen(text) {
    var conditions = [];
    var tokens = (text || '').split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
      var colon = tokens[i].indexOf(':');
      if (colon > 0) {
        conditions.push({
          name: tokens[i].slice(0, colon),
          values: tokens[i].slice(colon + 1).split(','),
        });
      }
    }
    return conditions;
  }

  function contains(list, item) {
    for (var i = 0; i < list.length; i++) if (list[i] === item) return true;
    return false;
  }

  function init() {
    var body = document.body;
    if (!body) return;
    var declaration = parse(body.getAttribute('data-rc-choices'));
    if (!declaration || typeof declaration !== 'object') return;
    var bookKey = PREFIX + (body.getAttribute('data-rc-book') || '');

    function valid(name, value) {
      return !!declaration[name] && contains(declaration[name].values || [], value);
    }

    // A store holds the current value of the choices it owns: the book's
    // (every choice) and one per scope, a block that owns some choices
    // itself. A scope without data-rc-key keeps its choices for the page only.
    var book = { key: bookKey, owns: null, state: {}, el: null };
    var stores = [book];
    var scopeEls = document.querySelectorAll('.rc-scope[data-rc-scope]');
    for (var s = 0; s < scopeEls.length; s++) {
      var scopeKey = scopeEls[s].getAttribute('data-rc-key');
      var scope = {
        key: scopeKey ? bookKey + '|' + scopeKey : null,
        owns: scopeEls[s].getAttribute('data-rc-scope').split(/\s+/),
        state: {},
        el: scopeEls[s],
      };
      scopeEls[s].rcStore = scope;
      stores.push(scope);
    }

    // The store that owns a choice where an element sits: its nearest
    // enclosing scope that owns the choice, else the book.
    function storeFor(el, name) {
      for (var node = el; node && node !== document; node = node.parentNode) {
        if (node.rcStore && contains(node.rcStore.owns, name)) return node.rcStore;
      }
      return book;
    }

    function load() {
      var name;
      var stored = readStore(bookKey);
      for (name in declaration) {
        if (!Object.prototype.hasOwnProperty.call(declaration, name)) continue;
        book.state[name] = valid(name, stored[name]) ? stored[name] : declaration[name]['default'];
      }
      // A scope the reader hasn't touched starts from the book's value.
      for (var i = 1; i < stores.length; i++) {
        var own = stores[i].key ? readStore(stores[i].key) : {};
        for (var j = 0; j < stores[i].owns.length; j++) {
          name = stores[i].owns[j];
          if (valid(name, own[name])) stores[i].state[name] = own[name];
          else if (!(name in stores[i].state)) stores[i].state[name] = book.state[name];
        }
      }
    }

    var variants = [];
    var found = document.querySelectorAll('[data-rc-when]');
    for (var v = 0; v < found.length; v++) {
      var conditions = parseWhen(found[v].getAttribute('data-rc-when'));
      for (var c = 0; c < conditions.length; c++) {
        conditions[c].store = storeFor(found[v], conditions[c].name);
        var spec = declaration[conditions[c].name];
        conditions[c].cover = !!spec && spec.mode === 'cover';
      }
      variants.push({ el: found[v], conditions: conditions });
    }

    var buttons = [];
    var foundButtons = document.querySelectorAll('.rc-choose .rc-option');
    for (var b = 0; b < foundButtons.length; b++) {
      var control = foundButtons[b].parentNode.parentNode;
      var of = control.getAttribute('data-rc-of');
      buttons.push({ el: foundButtons[b], name: of, store: storeFor(control, of) });
      foundButtons[b].rcButton = buttons[buttons.length - 1];
    }

    function setCovered(el, covered) {
      if (covered) {
        el.classList.add('rc-covered');
        if (!el.hasAttribute('tabindex')) {
          el.setAttribute('tabindex', '0');
          el.rcTabindex = true;
        }
      } else {
        el.classList.remove('rc-covered');
        if (el.rcTabindex) {
          el.removeAttribute('tabindex');
          el.rcTabindex = false;
        }
      }
    }

    function coveredFrom(node) {
      for (; node && node !== document; node = node.parentNode) {
        if (node.classList && node.classList.contains('rc-covered')) return node;
      }
      return null;
    }

    function apply() {
      // A remove-mode miss takes the variant off the page; otherwise a
      // cover-mode miss blanks it until tapped. Every apply covers afresh, so
      // changing a choice hides whatever the reader had revealed.
      for (var i = 0; i < variants.length; i++) {
        var removed = false;
        var covered = false;
        var list = variants[i].conditions;
        for (var k = 0; k < list.length; k++) {
          if (contains(list[k].values, list[k].store.state[list[k].name])) continue;
          if (list[k].cover) covered = true;
          else removed = true;
        }
        if (removed) variants[i].el.classList.add('rc-off');
        else variants[i].el.classList.remove('rc-off');
        setCovered(variants[i].el, covered && !removed);
      }
      for (var n = 0; n < buttons.length; n++) {
        var pressed = buttons[n].store.state[buttons[n].name] === buttons[n].el.getAttribute('data-rc-value');
        buttons[n].el.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      }
    }

    // Reveal the buttons in place of the plain-text default.
    var controls = document.querySelectorAll('.rc-choose');
    for (var r = 0; r < controls.length; r++) {
      var group = controls[r].querySelector('.rc-buttons');
      var text = controls[r].querySelector('.rc-static');
      if (group) group.removeAttribute('hidden');
      if (text) text.setAttribute('hidden', '');
    }

    document.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== document && !target.rcButton) target = target.parentNode;
      if (!target || target === document) {
        // A tap on covered text reveals it (and doesn't follow a link in it).
        var hidden = coveredFrom(event.target);
        if (hidden) {
          event.preventDefault();
          setCovered(hidden, false);
        }
        return;
      }
      var button = target.rcButton;
      var value = target.getAttribute('data-rc-value');
      if (!valid(button.name, value)) return;
      event.preventDefault();
      button.store.state[button.name] = value;
      if (button.store.key) writeStore(button.store.key, button.name, value);
      apply();
    });

    document.addEventListener('keydown', function (event) {
      var key = event.key;
      if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return;
      var target = event.target;
      if (!target || !target.classList || !target.classList.contains('rc-covered')) return;
      event.preventDefault();
      setCovered(target, false);
    });

    // Another page of the same book open beside this one (a spread).
    window.addEventListener('storage', function (event) {
      if (event.key === null || event.key.indexOf(bookKey) !== 0) return;
      load();
      apply();
    });

    load();
    apply();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
