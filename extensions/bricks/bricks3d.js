// Bricks steps drawn by three.js (three-bricks.js), from the element the
// extension's transformBricks.js makes of a ```bricks block: <div
// class="bricks" data-step="1">, holding a span.bricks-library for each parts
// library the step uses (data-src) and one span.bricks-part per part line
// (data-is, data-color, data-at, data-turn, and data-from on the parts that
// move). The step is built as LDraw against those libraries, and dragging in the bottom strip moves
// the parts into place one after another, in source order. A moving part with
// its own data-step starts a new step on the same page; the step number and
// parts callout change as its move begins.
//
// Positions are author units measured from the part's corner: studs across
// (x to the lower right, y to the lower left), plates up (a brick is 3), at the
// corner of the footprint nearest the grid origin, at the part's base, after
// any turn. data-from is an offset from data-at in the same units.
//
// A turning page (data-spin="degrees") has no moving parts: dragging turns the
// finished model about the vertical through its centre.
//
// Every step draws at the same scale, so a part is the same size on every
// page; data-scale="0.5" draws a model too big for the page smaller.
//
// data-open="end" (or a step number) opens a build page with that step
// finished and the handle beside it, a working aid while a page is being
// built: each edit re-renders the page, and it opens at that step again.
//
// A parts page (data-inventory, with data-columns and data-rows) draws its
// spans as a grid instead: each part alone in a cell, with its number beneath.
//
// A part may also be a model another page builds, which the transform copies
// into the step as div.bricks-model holding its span.bricks-model-part
// elements. The model's parts are placed in its own grid by the same corner
// rule, and the model is then placed, moved, turned and counted as one piece.
//
// Colour: a part without data-color takes its section's (a model line's
// colour), else the step's. Inside a model, a part without one takes the
// colour of the line that places the model, else whatever colour is given
// above that line, else the model's main colour: LDraw's colour 16, as the
// library's spaceman does.
//
// The page shows nothing of the model until it has drawn a frame: the canvas,
// step number, parts callout and handle are added then, and the still image
// the transform drew into the step is hidden. A device that cannot draw
// (no WebGL 2) keeps the still, which carries its own step number and parts
// callout.
//
// A reading system that does not run this file shows the still and the
// book's line about it (p.bricks-pictures, from the `pictures:` key): the
// line is hidden as each page starts, before anything loads, so it never
// shows where the page works, and shown again when the page cannot draw.
//
// The transform loads this file too, and calls setupStage with a `still`
// option to draw that image: the step finished, as a reader first sees it,
// into an OffscreenCanvas at twice the page size.
//
// Pages start once the document is parsed and every script has run (this
// file comes before three-bricks.js), on DOMContentLoaded rather than load:
// the SEED.html preview writes each chapter into its frame, and Firefox does
// not always fire load for a written document. load stays as a second
// chance, and each page is set up once.
document.addEventListener('DOMContentLoaded', startBricks);
window.addEventListener('load', startBricks);
if (document.readyState === 'complete') startBricks();

function startBricks() {
  if (!window.THREE || !window.THREE.LDrawLoader) return;
  var libraries = {};
  Array.prototype.forEach.call(document.querySelectorAll('.bricks'), function (stage) {
    if (stage.bricksStarted) return;
    stage.bricksStarted = true;
    var hrefs = Array.prototype.map.call(stage.querySelectorAll('.bricks-library[data-src]'), function (span) {
      return span.getAttribute('data-src');
    });
    if (!hrefs.length) return;
    showPictures(stage, false);
    Promise.all(hrefs.map(function (href) {
      // Reading systems report book files with status 0, so the status is not checked.
      libraries[href] = libraries[href] || fetch(href).then(function (r) { return r.text(); }).then(readLibrary);
      return libraries[href];
    })).then(function (found) { setupStage(stage, mergeLibraries(found)); }, function (error) {
      showPictures(stage, true);
      console.warn('bricks3d: ' + error);
    });
  });
}

// The book's line about pictures, hidden or shown again.
function showPictures(stage, shown) {
  Array.prototype.forEach.call(stage.querySelectorAll('.bricks-pictures'), function (line) {
    line.style.display = shown ? '' : 'none';
  });
}

// A step's libraries as one: the colour table and inventory from the first
// that has colours, every part file, and the first definition of each part.
function mergeLibraries(found) {
  var merged = { main: '', files: '', colours: {}, codes: {}, names: {}, paths: {}, footprints: {} };
  found.forEach(function (library) {
    if (!merged.main && Object.keys(library.colours).length) merged.main = library.main;
    merged.files += library.files + '\n';
    ['colours', 'codes', 'names', 'paths', 'footprints'].forEach(function (key) {
      Object.keys(library[key]).forEach(function (k) {
        if (!(k in merged[key])) merged[key][k] = library[key][k];
      });
    });
  });
  return merged;
}

// Each parts library is a model packed by three.js's packLDrawModel.mjs: the
// LDraw colour table and an inventory model, then one `0 FILE` section per
// part, primitive and submodel. A step can use any part (parts/3001.dat) or
// submodel (models/spaceman.ldr) by its bare name. A submodel whose arms or
// gear reach past what it stands on declares its footprint in studs,
// `0 !FOOTPRINT 2 1`, with its origin at the footprint's centre and base.
function readLibrary(text) {
  var split = text.search(/^0 FILE /m);
  var main = split < 0 ? text : text.slice(0, split);
  var library = {
    // The inventory's own part lines are dropped; each step adds its own.
    main: main.split(/\r?\n/).filter(function (line) { return !/^1 /.test(line); }).join('\n'),
    files: split < 0 ? '' : text.slice(split),
    colours: {}, codes: {}, names: {}, paths: {}, footprints: {},
  };
  main.replace(/^0 !COLOUR\s+(\S+)\s+CODE\s+(\d+)/gm, function (m, name, code) {
    library.colours[name.toLowerCase()] = code;
    library.codes[code] = name.replace(/_/g, ' ');
  });
  library.files.split(/^(?=0 FILE )/m).forEach(function (section) {
    var head = /^0 FILE ((?:parts|models)\/([^\/\s]+)\.(?:dat|ldr))\s*\n0 (.*)/i.exec(section);
    if (!head) return;
    var part = head[2].toLowerCase();
    library.names[part] = head[3].replace(/\s+/g, ' ').trim();
    library.paths[part] = head[1];
    var footprint = /^0 !FOOTPRINT\s+(\d+)\s+(\d+)/m.exec(section);
    if (footprint) library.footprints[part] = [Number(footprint[1]), Number(footprint[2])];
  });
  return library;
}

// still: { done(canvas, description) } to draw the still image instead of
// setting up the page; done gets null when there is nothing to draw.
function setupStage(stage, library, still) {
  var T = window.THREE;
  // The page, from the book's fixed-layout viewport (the transform writes it
  // on the step). The layout was drawn for a 320 × 460 page and scales with
  // the page by U, fitting whichever of width and height is tighter.
  var PAGE_W = Number(stage.getAttribute('data-width')), PAGE_H = Number(stage.getAttribute('data-height'));
  if (!(PAGE_W > 0 && PAGE_H > 0)) {
    if (still) still.done(null);
    return;
  }
  var U = Math.min(PAGE_W / 320, PAGE_H / 460);
  // The still is drawn at twice the page size, up to 1600 px on its long side.
  var STILL = Math.min(2, 1600 / Math.max(PAGE_W, PAGE_H));
  // The live canvas draws at most this many pixels, however far the page is
  // enlarged.
  var MAX_PIXELS = 2048 * 2048;
  var STUD = 20, PLATE = 8;             // LDraw units
  var TAG = 10000;                      // LDU between parts while parsing, to tell them apart
  // Drawing scale, kept from page04's isometric drawing (25 px per stud there).
  var K = U * 25 / (STUD * Math.sqrt(2 / 3));
  // The classic instruction view, measured from a 1970s sheet and a 2019 booklet:
  // the camera looks down at TILT degrees above the horizontal, from AROUND
  // degrees round from the x axis towards y, so edges along y lie flatter than
  // edges along x. (True isometric would be 35.26 and 45.)
  var TILT = 34, AROUND = 35;
  var e = TILT * Math.PI / 180, a = AROUND * Math.PI / 180;
  var VIEW = new T.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a));
  var PICTURE = [PAGE_W / 2, PAGE_H * 245 / 460];   // where the finished assembly's centre lands
  var FRAMES = 392, LAND = 330;         // the Lottie pages' timeline, per moving part
  var THUMB_W = 110 * U, THUMB_LEFT = 55.2 * U, THUMB_RIGHT = PAGE_W - 55.8 * U, THUMB_Y = PAGE_H - 55.1 * U;
  var STRIP = PAGE_H - 80 * U;          // a drag starts below this line
  var FILL = 0.6, DROP = 3.2;           // the main scene's light: fill and shadow-casting
  var CALLOUT = { x: 60 * U, y: 22 * U, h: 86 * U, max: Math.min(246 * U, PAGE_W - 74 * U), k: U * 9.5 / (STUD * Math.sqrt(2 / 3)) };

  // A parts page (data-inventory) draws a grid of parts, not a step.
  if (stage.hasAttribute('data-inventory')) {
    inventory();
    return;
  }

  // The models this step uses, by name.
  var models = {};
  Array.prototype.forEach.call(stage.querySelectorAll('.bricks-model'), function (div) {
    models[(div.getAttribute('data-name') || '').toLowerCase()] = {
      colour: (div.getAttribute('data-color') || '').trim(), parts: div.querySelectorAll('.bricks-model-part'),
    };
  });

  // Read the parts; a part the step cannot draw is named in a visible note.
  // Each library part, at whatever depth inside models, is a leaf the loader
  // draws.
  var parts = [], notes = [], leaves = [];
  var stageColour = givenColour(stage, 'The step');
  Array.prototype.forEach.call(stage.querySelectorAll('.bricks-part'), function (span, n) {
    var set = span.parentNode;
    var inherited = (set && set.getAttribute && givenColour(set, 'A model')) || stageColour;
    var part = readPart(span, 'Part ' + (n + 1), inherited, []);
    if (part) parts.push(part);
  });

  // An LDraw colour code from a colour name or number, or undefined.
  function colourCode(colour) {
    return /^\d+$/.test(colour) && library.codes[colour] ? colour : library.colours[colour.toLowerCase()];
  }

  // The colour a step or paragraph gives its parts, or null; a bad one is a note.
  function givenColour(element, which) {
    var colour = (element.getAttribute('data-color') || '').trim();
    if (!colour) return null;
    if (!colourCode(colour)) {
      var note = which + ': ' + colour + ' is not an LDraw colour.';
      if (notes.indexOf(note) < 0) notes.push(note);
      return null;
    }
    return colourCode(colour);
  }

  function readPart(span, where, inherited, within) {
    var is = (span.getAttribute('data-is') || '').trim();
    var name = is.toLowerCase();
    var colour = (span.getAttribute('data-color') || '').trim();
    var own = colourCode(colour);
    var model = models[name];
    var code = own || inherited || (model && model.colour && colourCode(model.colour)) || null;
    var at = numbers(span.getAttribute('data-at'));
    var from = span.hasAttribute('data-from') ? numbers(span.getAttribute('data-from')) : null;
    var turn = Number(span.getAttribute('data-turn') || 0);
    var which = where + (is ? ' (' + is + ')' : '') + ': ';
    if (!model && !library.names[name]) notes.push(which + (is ? 'not in the parts libraries or the book\'s models.' : 'has no part.'));
    else if (colour && !own) notes.push(which + colour + ' is not an LDraw colour.');
    else if (!model && !code) notes.push(which + 'needs a colour.');
    else if (!at) notes.push(which + 'its position needs three numbers.');
    else if (from === undefined) notes.push(which + 'from needs three numbers.');
    else if (isNaN(turn)) notes.push(which + 'turn needs a number.');
    else if (within.indexOf(name) >= 0) notes.push(which + 'a model cannot contain itself.');
    else {
      var part = { is: is, code: code, at: at, from: from, turn: turn, label: span.getAttribute('data-step') };
      if (model) {
        part.children = [];
        Array.prototype.forEach.call(model.parts, function (child, n) {
          var inner = readPart(child, 'Model ' + is + ', part ' + (n + 1), code, within.concat(name));
          if (inner) part.children.push(inner);
        });
      } else {
        part.leaf = leaves.length;
        leaves.push(part);
      }
      return part;
    }
    return null;
  }
  var spin = stage.hasAttribute('data-spin') ? Number(stage.getAttribute('data-spin')) : 0;
  if (isNaN(spin)) {
    notes.push('spin needs a number.');
    spin = 0;
  } else if (spin && parts.some(function (part) { return part.from; })) {
    notes.push('A turning page has no moving parts.');
    spin = 0;
  }
  // A step is built dragging to the right, moving the instructions on; a
  // turning page turns dragging to the left, which brings the model's right
  // side round to the front rather than showing its back.
  var drag = spin ? -1 : 1;
  var thumbFrom = spin ? THUMB_RIGHT : THUMB_LEFT, thumbTo = spin ? THUMB_LEFT : THUMB_RIGHT;
  var scale = stage.hasAttribute('data-scale') ? Number(stage.getAttribute('data-scale')) : 1;
  if (!(scale > 0)) {
    notes.push('scale needs a number above 0.');
    scale = 1;
  }
  if (notes.length && !still) {
    var box = document.createElement('div');
    box.className = 'bricks-notes';
    notes.forEach(function (text) {
      var note = document.createElement('p');
      note.textContent = text;
      box.appendChild(note);
    });
    stage.appendChild(box);
  }
  if (!parts.length) {
    if (still) still.done(null);
    return;
  }

  // A page can run through several steps: a moving part with step= starts a
  // new one, and the parts after it belong to it until the next step=.
  var movers = parts.filter(function (part) { return part.from; });
  var step = stage.getAttribute('data-step');
  var steps = [];
  movers.forEach(function (part) {
    part.label = part.label || (steps.length ? steps[steps.length - 1].label : step);
    if (!steps.length || steps[steps.length - 1].label !== part.label) steps.push({ label: part.label, groups: [] });
    part.step = steps[steps.length - 1];
  });
  // Each step's parts callout: its moving parts by part and colour.
  steps.forEach(function (s) {
    movers.filter(function (part) { return part.step === s; }).forEach(function (part) {
      var group = s.groups.filter(function (g) { return g.is === part.is && g.code === part.code; })[0];
      if (group) group.count++;
      else s.groups.push({ is: part.is, code: part.code, count: 1, part: part });
    });
    s.cellW = Math.min((s.groups.length === 1 ? 136 : 80) * U, CALLOUT.max / s.groups.length);
  });
  var current = steps[0];
  // Where the page opens: data-open's step finished (the last of its parts
  // seated, the next not yet shown), else at the start.
  var openAt = null;
  var openStep = stage.getAttribute('data-open');
  if (openStep === 'end' && movers.length) openAt = 1;
  else if (openStep) {
    var last = -1;
    movers.forEach(function (part, i) { if (part.step.label === openStep) last = i; });
    if (last >= 0) openAt = Math.max(0, (last + 1) / movers.length - 1e-9);
  }

  var html = '<div class="bricks-step-number" aria-hidden="true"></div>';
  steps.forEach(function (s, n) {
    html += '<div class="bricks-callout" aria-hidden="true"' + (n ? ' hidden=""' : '') +
      ' style="width:' + s.cellW * s.groups.length + 'px">';
    s.groups.forEach(function (g, i) {
      html += '<span class="bricks-count" style="left:' + (i * s.cellW + 8 * U) + 'px">' + g.count + 'x</span>';
    });
    html += '</div>';
  });
  if (movers.length || spin) {
    // The handle, after the arrows of 1970s building instructions: a pale yellow
    // panel with a solid-headed arrow pointing the way to drag, curved on a
    // turning page as the sheets' turn-the-model arrow is. The namespace is
    // spelled out: in a page parsed as XHTML this markup is parsed as XML, and
    // an svg without it is an unknown XHTML element that draws nothing.
    html += '<svg xmlns="http://www.w3.org/2000/svg" class="bricks-thumb" viewBox="-55 -55 110 110" aria-hidden="true">' +
      '<rect class="bricks-thumb-panel" x="-51" y="-51" width="102" height="102"/>' +
      (spin ?
        '<path class="bricks-thumb-shaft" d="M 36 -3 A 34 22 0 0 1 -20 3" fill="none"/>' +
        '<polygon class="bricks-thumb-head" points="-38,-11 -13,-4 -25,12"/>' :
        '<line class="bricks-thumb-shaft" x1="-36" y1="0" x2="18" y2="0"/>' +
        '<polygon class="bricks-thumb-head" points="38,0 14,-9 14,9"/>') +
      '</svg>';
  }
  var number = null, callouts = [], thumb = null;
  var opening = true;   // until the opening's return to the start, or the first drag

  // Without WebGL 2 the renderer throws, and the page keeps its still and
  // shows the book's line about it.
  var canvas = still ? new OffscreenCanvas(Math.round(PAGE_W * STILL), Math.round(PAGE_H * STILL)) : document.createElement('canvas');
  var renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!still });
  } catch (error) {
    if (still) still.done(null);
    else showPictures(stage, true);
    console.warn('bricks3d: ' + error);
    return;
  }
  renderer.setScissorTest(true);
  var scene = new T.Scene();
  addLights(scene, FILL);
  var camera = null;

  // A light from straight above casts the moving part's shadow onto the parts
  // below, knobs included. Every part receives shadows; only the part being
  // placed casts one, which darkens and sharpens as it lands.
  renderer.shadowMap.enabled = true;
  var drop = new T.DirectionalLight(0xffffff, DROP);
  drop.castShadow = true;
  drop.shadow.mapSize.set(1024, 1024);
  drop.shadow.bias = -0.0005;
  scene.add(drop, drop.target);
  var casting = null;

  var progress = 0;
  var turntable = new T.Group();
  var ease = cubicBezier(0.5, 0, 1, 1);

  // Each leaf is placed at its own x while parsing, so it can be found again
  // whatever order the loader returns it in.
  var lines = leaves.map(function (leaf, i) {
    return '1 ' + leaf.code + ' ' + i * TAG + ' 0 0 1 0 0 0 1 0 0 0 1 ' + library.paths[leaf.is.toLowerCase()];
  });
  var loader = new T.LDrawLoader();
  loader.setConditionalLineMaterial(T.LDrawConditionalLineMaterial);
  loader.parse(library.main + '\n' + lines.join('\n') + '\n' + library.files, function (model) {
    var loaded = [];
    model.children.filter(function (c) { return c.isGroup; }).forEach(function (child) {
      loaded[Math.round(child.position.x / TAG)] = child;
      child.position.set(0, 0, 0);
    });

    // A part's object, turned by its turn=: the loaded part stood upright
    // (LDraw is −Y up), or a model's parts, each placed in the model's grid.
    function build(part) {
      var inner = new T.Group();
      if (part.children) {
        part.children.forEach(function (child) {
          if (build(child)) inner.add(child.object);
        });
      } else if (loaded[part.leaf]) {
        inner.rotation.x = Math.PI;
        inner.add(loaded[part.leaf]);
      } else {
        return null;
      }
      part.object = new T.Group();
      part.object.rotation.y = part.turn * Math.PI / 180;
      part.object.add(inner);
      // The anchor is the footprint's corner nearest the origin, at the base:
      // the declared footprint if there is one, else the bounding box.
      var target = new T.Vector3(part.at[0] * STUD, part.at[2] * PLATE, part.at[1] * STUD);
      var footprint = !part.children && library.footprints[part.is.toLowerCase()];
      if (footprint) {
        var c = Math.abs(Math.cos(part.object.rotation.y)), s = Math.abs(Math.sin(part.object.rotation.y));
        part.final = target.add(new T.Vector3(footprint[0] * c + footprint[1] * s, 0, footprint[0] * s + footprint[1] * c).multiplyScalar(STUD / 2));
      } else {
        part.object.updateMatrixWorld(true);
        part.final = target.sub(new T.Box3().setFromObject(part.object).min);
      }
      part.object.position.copy(part.final);
      return part.object;
    }

    parts.forEach(function (part) {
      if (!build(part)) return;
      scene.add(part.object);
      part.object.traverse(function (o) { if (o.isMesh) o.receiveShadow = true; });
      if (part.from) part.offset = new T.Vector3(part.from[0] * STUD, part.from[2] * PLATE, part.from[1] * STUD);
    });
    parts = parts.filter(function (part) { return part.object; });

    // Fixed scale, centred on the finished assembly.
    var all = new T.Box3();
    parts.forEach(function (part) {
      part.object.updateMatrixWorld(true);
      part.box = new T.Box3().setFromObject(part.object);
      all.union(part.box);
    });
    // A turning page turns the whole model about the vertical through its centre.
    if (spin) {
      var middle = all.getCenter(new T.Vector3());
      turntable.position.set(middle.x, 0, middle.z);
      parts.forEach(function (part) {
        part.object.position.x -= middle.x;
        part.object.position.z -= middle.z;
        turntable.add(part.object);
      });
      scene.add(turntable);
    }
    camera = isoCamera(K * scale, PICTURE[0], PAGE_W - PICTURE[0], PICTURE[1], PAGE_H - PICTURE[1], all.getCenter(new T.Vector3()));

    // The shadow light covers the finished assembly from above.
    var centre = all.getCenter(new T.Vector3()), size = all.getSize(new T.Vector3());
    var reach = Math.max(size.x, size.z) / 2 + STUD;
    drop.position.set(centre.x, all.max.y + 2000, centre.z);
    drop.target.position.copy(centre);
    var sc = drop.shadow.camera;
    sc.up.set(0, 0, 1);                 // it looks straight down, so its up must lie flat
    sc.left = sc.bottom = -reach;
    sc.right = sc.top = reach;
    sc.near = 1;
    sc.far = 4000 + size.y;
    sc.updateProjectionMatrix();

    // The parts callout shows one of each, alone, as small as it needs to be to fit.
    steps.forEach(function (s) { s.groups.forEach(function (g) {
      var cellW = s.cellW;
      g.scene = new T.Scene();
      addLights(g.scene, 1);
      var copy = g.part.object.clone();
      copy.position.set(0, 0, 0);
      g.scene.add(copy);
      copy.updateMatrixWorld(true);
      var box = new T.Box3().setFromObject(copy);
      var size = box.getSize(new T.Vector3());
      var k = Math.min(CALLOUT.k,
        0.8 * cellW / (size.x * Math.sin(a) + size.z * Math.cos(a)),
        0.6 * CALLOUT.h / (Math.sin(e) * (size.x * Math.cos(a) + size.z * Math.sin(a)) + size.y * Math.cos(e)));
      g.camera = isoCamera(k, cellW / 2, cellW / 2, CALLOUT.h / 2 - 4 * U, CALLOUT.h / 2 + 4 * U, box.getCenter(new T.Vector3()));
    }); });

    if (still) {
      show(movers.length ? 1 : 0);
      still.done(compose(), stage.getAttribute('data-alt') || describe());
      renderer.dispose();
      return;
    }

    // The first frame is drawn before anything is added, so a page that
    // fails to draw shows only its still. A page with data-open stays there.
    show(openAt !== null ? openAt : movers.length ? 1 : 0);
    if (openAt !== null) opening = false;
    // bricks.css sizes the step number, callout and handle in this unit.
    stage.style.setProperty('--bricks-u', U + 'px');
    canvas.className = 'bricks-canvas';
    stage.appendChild(canvas);
    stage.insertAdjacentHTML('beforeend', html);
    number = stage.querySelector('.bricks-step-number');
    callouts = stage.querySelectorAll('.bricks-callout');
    number.textContent = (current && current.label) || step || '';
    Array.prototype.forEach.call(callouts, function (callout, n) { callout.hidden = steps[n] !== current; });
    thumb = stage.querySelector('.bricks-thumb');
    if (thumb) {
      thumb.style.opacity = '0';
      placeThumb();
    }

    // The model replaces the still image, whose description it takes on;
    // the header's alt comes first.
    var img = stage.querySelector('img');
    stage.setAttribute('role', 'img');
    stage.setAttribute('aria-label', stage.getAttribute('data-alt') || img && img.getAttribute('alt') || describe());
    Array.prototype.forEach.call(stage.children, function (child) {
      if (child.querySelector && (child.localName === 'img' || child.querySelector('img'))) child.hidden = true;
    });
    // Apple Books photographs a page for its thumbnail soon after it has
    // drawn. So a step opens finished and without the handle, and after a
    // quarter of a second goes back to its start as the handle fades in; a
    // turning page just fades its handle in. (Tested on an iPad in Books 11.6.)
    setTimeout(function () {
      if (opening) show(0);            // unless the reader is already dragging
      opening = false;
      if (thumb) {
        thumb.style.transition = 'opacity 250ms ease-out';
        thumb.style.opacity = '';
      }
    }, 250);
  }, function (error) {
    if (still) still.done(null);
    console.warn('bricks3d: ' + error);
  });

  function describe() {
    function named(g) {
      var name = models[g.is.toLowerCase()] ? g.is : library.names[g.is.toLowerCase()];
      return g.count + ' ' + (g.code ? library.codes[g.code] + ' ' : '') + name;
    }
    if (spin) {
      var groups = [];
      parts.forEach(function (part) {
        var group = groups.filter(function (g) { return g.is === part.is && g.code === part.code; })[0];
        if (group) group.count++;
        else groups.push({ is: part.is, code: part.code, count: 1 });
      });
      return 'A model turning, built from ' + groups.map(named).join(', ') + '.';
    }
    return steps.map(function (s) {
      return (s.label ? 'Step ' + s.label + ': ' : '') + 'add ' + s.groups.map(named).join(', ') + '.';
    }).join(' ');
  }

  // Each moving part has an equal share of the thumb's travel, in source order:
  // it appears when its share begins, eases down and seats with a short hold.
  function show(p) {
    progress = p;
    var latest = null, moving = null, landed = 0;
    movers.forEach(function (part, i) {
      if (!part.object) return;
      var t = p * movers.length - i;
      var e = ease(Math.min(1, Math.max(0, t * FRAMES / LAND)));
      part.object.visible = t >= 0;
      part.object.position.copy(part.final).addScaledVector(part.offset, 1 - e);
      if (t >= 0) {
        latest = part.step;
        moving = part;
        landed = e;
      }
    });
    if (moving !== casting) {
      if (casting) castShadow(casting, false);
      if (moving) castShadow(moving, true);
      casting = moving;
    }
    // Dragging left brings the near side round to the left.
    if (spin) turntable.rotation.y = -p * spin * Math.PI / 180;
    drop.shadow.intensity = landed;
    drop.shadow.radius = 1 + 5 * (1 - landed);
    // The step number and parts callout follow the part being placed.
    if (latest && latest !== current) {
      current = latest;
      if (number) number.textContent = current.label || '';
      Array.prototype.forEach.call(callouts, function (callout, n) { callout.hidden = steps[n] !== current; });
    }
    placeThumb();
    render();
  }

  function placeThumb() {
    if (!thumb) return;
    thumb.style.left = (thumbFrom + (thumbTo - thumbFrom) * progress - THUMB_W / 2) + 'px';
    thumb.style.top = (THUMB_Y - THUMB_W / 2) + 'px';
  }

  // The still image: the drawing over the step number and parts callout, as
  // bricks.css places them (the canvas lies above both on the page).
  function compose() {
    var out = new OffscreenCanvas(canvas.width, canvas.height);
    var c = out.getContext('2d');
    c.scale(canvas.width / PAGE_W, canvas.height / PAGE_H);
    var font = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    // Text sits on the baseline CSS gives it: line-height 1 centres the font's
    // ascent and descent on a line box one em tall. (Canvas's 'top' and
    // 'bottom' anchor the em square instead, about 3px higher for the step
    // number in Helvetica.)
    c.textBaseline = 'alphabetic';
    function baseline(top, size) {
      var m = c.measureText('0');
      return top + (size - m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 + m.fontBoundingBoxAscent;
    }
    c.fillStyle = '#1f2433';
    c.font = 'bold ' + 46 * U + 'px ' + font;
    c.fillText((current && current.label) || step || '', 14 * U, baseline(16 * U, 46 * U));
    if (current && current.groups.length) {
      var w = current.cellW * current.groups.length, line = 1.5 * U;
      c.beginPath();
      // The callout as bricks.css draws it, square and yellow in the classic style.
      var classic = stage.getAttribute('data-style') === 'classic';
      c.roundRect(CALLOUT.x + line / 2, CALLOUT.y + line / 2, w - line, CALLOUT.h - line, classic ? 0 : 6 * U - line / 2);
      c.fillStyle = classic ? '#efe7a3' : '#f5faff';
      c.fill();
      c.lineWidth = line;
      c.strokeStyle = classic ? '#222' : '#7399cc';
      c.stroke();
      c.fillStyle = '#1f2433';
      c.font = 'bold ' + 13 * U + 'px ' + font;
      var countY = baseline(CALLOUT.y + CALLOUT.h - line - 6 * U - 13 * U, 13 * U);
      current.groups.forEach(function (g, i) {
        c.fillText(g.count + 'x', CALLOUT.x + line + i * current.cellW + 8 * U, countY);
      });
    }
    c.drawImage(canvas, 0, 0, PAGE_W, PAGE_H);
    return out;
  }

  function render() {
    if (!camera) return;
    var s = still ? STILL : Math.min(displayScale(), Math.sqrt(MAX_PIXELS / (PAGE_W * PAGE_H)));
    if (renderer.getPixelRatio() !== s) renderer.setPixelRatio(s);
    renderer.setSize(PAGE_W, PAGE_H, false);
    renderer.setViewport(0, 0, PAGE_W, PAGE_H);
    renderer.setScissor(0, 0, PAGE_W, PAGE_H);
    renderer.render(scene, camera);
    var y = PAGE_H - CALLOUT.y - CALLOUT.h;   // WebGL counts from the bottom
    if (current) current.groups.forEach(function (g, i) {
      var w = current.cellW;
      renderer.setViewport(CALLOUT.x + i * w, y, w, CALLOUT.h);
      renderer.setScissor(CALLOUT.x + i * w, y, w, CALLOUT.h);
      renderer.render(g.scene, g.camera);
    });
  }

  // Canvas pixels per page pixel, as the page is shown. A reading system that
  // zooms its web view to fit the page reports it in visualViewport.scale
  // (Apple Books); one that fits it with a CSS transform on the page's iframe
  // (READ.html, the SEED.html preview) gives the page no sign of it, and the
  // canvas would be magnified as a bitmap, so each frame around the page
  // that can be reached is measured. frameElement is null where the parent
  // is from another origin, which then counts as unscaled.
  function displayScale() {
    var k = 1, w = window;
    while (w.frameElement) {
      var frame = w.frameElement;
      if (frame.offsetWidth) k *= frame.getBoundingClientRect().width / frame.offsetWidth;
      w = w.parent;
    }
    return (window.devicePixelRatio || 1) * k * ((w.visualViewport && w.visualViewport.scale) || 1);
  }

  // A parts page: one cell per part, in the columns and rows the transform
  // chose, each with the part drawn alone and a label beneath: on the book's
  // list the part in its own colour (data-color) and how many (data-count),
  // on the library page in the page's colour with its number. Nothing moves;
  // the page draws once and again on resize.
  function inventory() {
    var columns = Math.max(1, Number(stage.getAttribute('data-columns')) || 1);
    var rows = Math.max(1, Number(stage.getAttribute('data-rows')) || 1);
    var margin = 12 * U, inset = 3 * U, label = 18 * U;
    var cellW = (PAGE_W - 2 * margin) / columns;
    var cellH = Math.min(84 * U, (PAGE_H - 2 * margin) / rows);
    var top = (PAGE_H - rows * cellH) / 2;
    var code = colourCode((stage.getAttribute('data-color') || '').trim()) || colourCode('Light_Bluish_Grey') || '71';
    var notes = [], cells = [];
    Array.prototype.forEach.call(stage.querySelectorAll('.bricks-part'), function (span) {
      var is = (span.getAttribute('data-is') || '').trim();
      if (!library.names[is.toLowerCase()]) {
        notes.push(is + ': not in the parts libraries.');
        return;
      }
      if (cells.length >= columns * rows) return;
      var n = cells.length, col = n % columns, row = Math.floor(n / columns);
      var count = span.getAttribute('data-count');
      cells.push({
        is: is, name: library.names[is.toLowerCase()],
        code: colourCode((span.getAttribute('data-color') || '').trim()) || code,
        // The book's list shows how many; the library page, the part's number.
        label: count ? count + 'x' : is, count: count,
        x: margin + col * cellW, y: top + row * cellH, w: cellW, h: cellH,
      });
    });
    if (notes.length && !still) {
      var box = document.createElement('div');
      box.className = 'bricks-notes';
      notes.forEach(function (text) {
        var note = document.createElement('p');
        note.textContent = text;
        box.appendChild(note);
      });
      stage.appendChild(box);
    }
    if (!cells.length) {
      if (still) still.done(null);
      return;
    }
    // The part is drawn in the cell's panel, above its number.
    cells.forEach(function (c) {
      c.dx = c.x + inset;
      c.dy = c.y + inset;
      c.dw = c.w - 2 * inset;
      c.dh = c.h - 2 * inset - label;
    });

    var canvas = still ? new OffscreenCanvas(Math.round(PAGE_W * STILL), Math.round(PAGE_H * STILL)) : document.createElement('canvas');
    var renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!still });
    } catch (error) {
      if (still) still.done(null);
      else showPictures(stage, true);
      console.warn('bricks3d: ' + error);
      return;
    }
    renderer.setScissorTest(true);
    // Clear to transparent, so the panels and numbers under the canvas show:
    // three.js starts with opaque black until a render sets the colour.
    renderer.setClearColor(0x000000, 0);
    var drawn = false;

    var lines = cells.map(function (c, i) {
      return '1 ' + c.code + ' ' + i * TAG + ' 0 0 1 0 0 0 1 0 0 0 1 ' + library.paths[c.is.toLowerCase()];
    });
    var loader = new T.LDrawLoader();
    loader.setConditionalLineMaterial(T.LDrawConditionalLineMaterial);
    loader.parse(library.main + '\n' + lines.join('\n') + '\n' + library.files, function (model) {
      model.children.filter(function (child) { return child.isGroup; }).forEach(function (child) {
        var c = cells[Math.round(child.position.x / TAG)];
        if (!c) return;
        child.position.set(0, 0, 0);
        // LDraw is −Y up; the part stands upright, alone, as small as it
        // needs to be to fit, and no larger than a step's parts callout draws it.
        var part = new T.Group();
        part.rotation.x = Math.PI;
        part.add(child);
        c.scene = new T.Scene();
        addLights(c.scene, 1);
        c.scene.add(part);
        part.updateMatrixWorld(true);
        var box = new T.Box3().setFromObject(part);
        var size = box.getSize(new T.Vector3());
        var k = Math.min(CALLOUT.k * 1.3,
          0.8 * c.dw / (size.x * Math.sin(a) + size.z * Math.cos(a)),
          0.8 * c.dh / (Math.sin(e) * (size.x * Math.cos(a) + size.z * Math.sin(a)) + size.y * Math.cos(e)));
        c.camera = isoCamera(k, c.dw / 2, c.dw / 2, c.dh / 2, c.dh / 2, box.getCenter(new T.Vector3()));
      });
      drawn = true;

      if (still) {
        draw();
        still.done(composeCells(), stage.getAttribute('data-alt') || describeCells());
        renderer.dispose();
        return;
      }
      stage.style.setProperty('--bricks-u', U + 'px');
      var html = '';
      cells.forEach(function (c) {
        html += '<div class="bricks-cell" aria-hidden="true" style="left:' + c.x + 'px;top:' + c.y + 'px;width:' + c.w + 'px;height:' + c.h + 'px">' +
          '<span class="bricks-cell-number">' + c.label + '</span></div>';
      });
      stage.insertAdjacentHTML('beforeend', html);
      canvas.className = 'bricks-canvas';
      stage.appendChild(canvas);
      stage.setAttribute('role', 'img');
      var img = stage.querySelector('img');
      stage.setAttribute('aria-label', stage.getAttribute('data-alt') || img && img.getAttribute('alt') || describeCells());
      Array.prototype.forEach.call(stage.children, function (child) {
        if (child.querySelector && (child.localName === 'img' || child.querySelector('img'))) child.hidden = true;
      });
      draw();
    }, function (error) {
      if (still) still.done(null);
      console.warn('bricks3d: ' + error);
    });

    function draw() {
      if (!drawn) return;
      var s = still ? STILL : Math.min(displayScale(), Math.sqrt(MAX_PIXELS / (PAGE_W * PAGE_H)));
      if (renderer.getPixelRatio() !== s) renderer.setPixelRatio(s);
      renderer.setSize(PAGE_W, PAGE_H, false);
      renderer.setViewport(0, 0, PAGE_W, PAGE_H);
      renderer.setScissor(0, 0, PAGE_W, PAGE_H);
      renderer.clear();
      cells.forEach(function (c) {
        if (!c.scene) return;
        var y = PAGE_H - c.dy - c.dh;   // WebGL counts from the bottom
        renderer.setViewport(c.dx, y, c.dw, c.dh);
        renderer.setScissor(c.dx, y, c.dw, c.dh);
        renderer.render(c.scene, c.camera);
      });
    }

    function describeCells() {
      return 'Parts: ' + cells.map(function (c) {
        return c.count ? c.count + ' ' + library.codes[c.code] + ' ' + c.name : c.is + ', ' + c.name;
      }).join('; ') + '.';
    }

    // The still: the panels and numbers as bricks.css draws them, under the parts.
    function composeCells() {
      var out = new OffscreenCanvas(canvas.width, canvas.height);
      var c = out.getContext('2d');
      c.scale(canvas.width / PAGE_W, canvas.height / PAGE_H);
      var classic = stage.getAttribute('data-style') === 'classic';
      var line = 1.5 * U;
      c.font = 'bold ' + 11 * U + 'px "Helvetica Neue", Helvetica, Arial, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      cells.forEach(function (cell) {
        c.beginPath();
        c.roundRect(cell.x + inset + line / 2, cell.y + inset + line / 2, cell.w - 2 * inset - line, cell.h - 2 * inset - line,
          classic ? 0 : 6 * U - line / 2);
        c.fillStyle = classic ? '#efe7a3' : '#f5faff';
        c.fill();
        c.lineWidth = line;
        c.strokeStyle = classic ? '#222' : '#7399cc';
        c.stroke();
        c.fillStyle = '#1f2433';
        c.fillText(cell.label, cell.x + cell.w / 2, cell.y + cell.h - inset - 7 * U);
      });
      c.drawImage(canvas, 0, 0, PAGE_W, PAGE_H);
      return out;
    }

    if (still) return;
    window.addEventListener('pageshow', draw);
    window.addEventListener('resize', draw);
  }

  // An orthographic camera looking along VIEW at `target`,
  // which lands `left` px from the left edge and `top` px from the top.
  function isoCamera(k, left, right, top, bottom, target) {
    var cam = new T.OrthographicCamera(-left / k, right / k, top / k, -bottom / k, 1, 8000);
    cam.position.copy(target).addScaledVector(VIEW, 3500);
    cam.lookAt(target);
    return cam;
  }

  function castShadow(part, on) {
    part.object.traverse(function (o) { if (o.isMesh) o.castShadow = on; });
  }

  function addLights(s, k) {
    s.add(new T.HemisphereLight(0xffffff, 0x8899aa, 3.2 * k));
    var sun = new T.DirectionalLight(0xffffff, 2.4 * k);
    sun.position.set(1, 3, 0.4);
    s.add(sun);
  }

  if (still) return;
  window.addEventListener('pageshow', render);
  window.addEventListener('resize', render);
  if (!movers.length && !spin) return;

  // Dragging in the bottom strip, as animation.js does for the Lottie pages:
  // the thumb's travel (210 px on a 320 px page) runs the whole step, to the right on a build step (the
  // Lottie pages go left, into a page turn) and to the left on a turning page.
  // On release the step stays where it is, and the next drag carries on.
  var startX = 0, startProgress = 0;
  stage.addEventListener('pointerdown', function (event) {
    if (event.pageY <= STRIP) return;
    event.preventDefault();
    startX = event.clientX;
    startProgress = opening ? 0 : progress;
    try { stage.setPointerCapture(event.pointerId); } catch (e) { /* pointer already gone */ }
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  });

  // On iOS a cancelled pointerdown does not stop the reading system's page
  // swipe; only cancelled touch events do, which is what animation.js relies on.
  var touching = false;
  stage.addEventListener('touchstart', function (event) {
    var touch = event.touches[0];
    if (touch && touch.pageY > STRIP) {
      touching = true;
      event.preventDefault();
    }
  }, { passive: false });
  stage.addEventListener('touchmove', function (event) {
    if (touching) event.preventDefault();
  }, { passive: false });
  stage.addEventListener('touchend', function () { touching = false; });
  stage.addEventListener('touchcancel', function () { touching = false; });

  function move(event) {
    event.preventDefault();
    opening = false;
    var p = startProgress + drag * (event.clientX - startX) / (PAGE_W - THUMB_W);
    show(Math.min(FRAMES, Math.max(0, Math.ceil(FRAMES * p))) / FRAMES);
  }

  function end() {
    stage.removeEventListener('pointermove', move);
    stage.removeEventListener('pointerup', end);
    stage.removeEventListener('pointercancel', end);
  }
}

// "x y z" → [x, y, z]; null when absent, undefined when malformed.
function numbers(text) {
  if (text === null) return null;
  var n = text.trim().split(/\s+/).map(Number);
  return n.length === 3 && n.every(isFinite) ? n : undefined;
}

// CSS cubic-bezier timing: returns y for a given x in 0–1.
function cubicBezier(x1, y1, x2, y2) {
  function at(a, b, s) { return 3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s; }
  return function (x) {
    var lo = 0, hi = 1, s = x;
    for (var i = 0; i < 30; i++) {
      s = (lo + hi) / 2;
      if (at(x1, x2, s) < x) lo = s; else hi = s;
    }
    return at(y1, y2, s);
  };
}
