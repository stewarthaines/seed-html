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
    var key = PREFIX + (body.getAttribute('data-rc-book') || '');
    var state = {};

    function load() {
      var stored = readStore(key);
      for (var name in declaration) {
        if (!Object.prototype.hasOwnProperty.call(declaration, name)) continue;
        var choice = declaration[name];
        var value = stored[name];
        state[name] = contains(choice.values || [], value) ? value : choice['default'];
      }
    }

    var variants = [];
    var found = document.querySelectorAll('[data-rc-when]');
    for (var v = 0; v < found.length; v++) {
      variants.push({ el: found[v], conditions: parseWhen(found[v].getAttribute('data-rc-when')) });
    }

    function apply() {
      for (var i = 0; i < variants.length; i++) {
        var shows = true;
        var conditions = variants[i].conditions;
        for (var c = 0; c < conditions.length; c++) {
          if (!contains(conditions[c].values, state[conditions[c].name])) shows = false;
        }
        if (shows) variants[i].el.classList.remove('rc-off');
        else variants[i].el.classList.add('rc-off');
      }
      var buttons = document.querySelectorAll('.rc-choose .rc-option');
      for (var b = 0; b < buttons.length; b++) {
        var control = buttons[b].parentNode.parentNode;
        var name = control.getAttribute('data-rc-of');
        var pressed = state[name] === buttons[b].getAttribute('data-rc-value');
        buttons[b].setAttribute('aria-pressed', pressed ? 'true' : 'false');
      }
    }

    // Reveal the buttons in place of the plain-text default.
    var controls = document.querySelectorAll('.rc-choose');
    for (var k = 0; k < controls.length; k++) {
      var group = controls[k].querySelector('.rc-buttons');
      var text = controls[k].querySelector('.rc-static');
      if (group) group.removeAttribute('hidden');
      if (text) text.setAttribute('hidden', '');
    }

    document.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== document && !(target.classList && target.classList.contains('rc-option'))) {
        target = target.parentNode;
      }
      if (!target || target === document) return;
      var control = target.parentNode && target.parentNode.parentNode;
      var name = control && control.getAttribute('data-rc-of');
      var value = target.getAttribute('data-rc-value');
      if (!name || !declaration[name] || !contains(declaration[name].values, value)) return;
      event.preventDefault();
      state[name] = value;
      writeStore(key, name, value);
      apply();
    });

    // Another page of the same book open beside this one (a spread).
    window.addEventListener('storage', function (event) {
      if (event.key !== key) return;
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
