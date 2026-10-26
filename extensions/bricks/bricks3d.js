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
// The transform loads this file too, and calls setupStage with a `still`
// option to draw that image: the step finished, as a reader first sees it,
// into an OffscreenCanvas at twice the page size.
window.addEventListener('load', function () {
  if (!window.THREE || !window.THREE.LDrawLoader) return;
  var libraries = {};
  Array.prototype.forEach.call(document.querySelectorAll('.bricks'), function (stage) {
    var hrefs = Array.prototype.map.call(stage.querySelectorAll('.bricks-library[data-src]'), function (span) {
      return span.getAttribute('data-src');
    });
    if (!hrefs.length) return;
    Promise.all(hrefs.map(function (href) {
      // Reading systems report book files with status 0, so the status is not checked.
      libraries[href] = libraries[href] || fetch(href).then(function (r) { return r.text(); }).then(readLibrary);
      return libraries[href];
    })).then(function (found) { setupStage(stage, mergeLibraries(found)); });
  });
});

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
  var PAGE_W = 320, PAGE_H = 460;
  var STUD = 20, PLATE = 8;             // LDraw units
  var TAG = 10000;                      // LDU between parts while parsing, to tell them apart
  // Drawing scale, kept from page04's isometric drawing (25 px per stud there).
  var K = 25 / (STUD * Math.sqrt(2 / 3));
  // The classic instruction view, measured from a 1970s sheet and a 2019 booklet:
  // the camera looks down at TILT degrees above the horizontal, from AROUND
  // degrees round from the x axis towards y, so edges along y lie flatter than
  // edges along x. (True isometric would be 35.26 and 45.)
  var TILT = 34, AROUND = 35;
  var e = TILT * Math.PI / 180, a = AROUND * Math.PI / 180;
  var VIEW = new T.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a));
  var PICTURE = [160, 245];             // where the finished assembly's centre lands
  var FRAMES = 392, LAND = 330;         // the Lottie pages' timeline, per moving part
  var THUMB_W = 110, THUMB_LEFT = 55.2, THUMB_RIGHT = 264.2, THUMB_Y = 404.9;
  var FILL = 0.6, DROP = 3.2;           // the main scene's light: fill and shadow-casting
  var CALLOUT = { x: 60, y: 22, h: 86, max: 246, k: 9.5 / (STUD * Math.sqrt(2 / 3)) };

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
    s.cellW = Math.min(s.groups.length === 1 ? 136 : 80, CALLOUT.max / s.groups.length);
  });
  var current = steps[0];

  var html = '<div class="bricks-step-number" aria-hidden="true"></div>';
  steps.forEach(function (s, n) {
    html += '<div class="bricks-callout" aria-hidden="true"' + (n ? ' hidden=""' : '') +
      ' style="width:' + s.cellW * s.groups.length + 'px">';
    s.groups.forEach(function (g, i) {
      html += '<span class="bricks-count" style="left:' + (i * s.cellW + 8) + 'px">' + g.count + 'x</span>';
    });
    html += '</div>';
  });
  if (movers.length || spin) {
    // The handle, after the arrows of 1970s building instructions: a pale yellow
    // panel with a solid-headed arrow pointing the way to drag, curved on a
    // turning page as the sheets' turn-the-model arrow is.
    html += '<svg class="bricks-thumb" viewBox="-55 -55 110 110" aria-hidden="true">' +
      '<rect class="bricks-thumb-panel" x="-51" y="-51" width="102" height="102"/>' +
      (spin ?
        '<path class="bricks-thumb-shaft" d="M 36 -3 A 34 22 0 0 1 -20 3" fill="none"/>' +
        '<polygon class="bricks-thumb-head" points="-38,-11 -13,-4 -25,12"/>' :
        '<line class="bricks-thumb-shaft" x1="-36" y1="0" x2="18" y2="0"/>' +
        '<polygon class="bricks-thumb-head" points="38,0 14,-9 14,9"/>') +
      '</svg>';
  }
  var number = null, callouts = [], thumb = null;
  var opening = true;

  // Without WebGL 2 the renderer throws, and the page keeps its still.
  var canvas = still ? new OffscreenCanvas(PAGE_W * 2, PAGE_H * 2) : document.createElement('canvas');
  var renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!still });
  } catch (error) {
    if (still) still.done(null);
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
      g.camera = isoCamera(k, cellW / 2, cellW / 2, CALLOUT.h / 2 - 4, CALLOUT.h / 2 + 4, box.getCenter(new T.Vector3()));
    }); });

    if (still) {
      show(movers.length ? 1 : 0);
      still.done(compose(), stage.getAttribute('data-alt') || describe());
      renderer.dispose();
      return;
    }

    // The first frame is drawn before anything is added, so a page that
    // fails to draw shows only its still.
    show(movers.length ? 1 : 0);
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
    var out = new OffscreenCanvas(PAGE_W * 2, PAGE_H * 2);
    var c = out.getContext('2d');
    c.scale(2, 2);
    var font = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    c.fillStyle = '#1f2433';
    c.font = 'bold 46px ' + font;
    c.textBaseline = 'top';
    c.fillText((current && current.label) || step || '', 14, 16);
    if (current && current.groups.length) {
      var w = current.cellW * current.groups.length;
      c.beginPath();
      c.roundRect(CALLOUT.x + 0.75, CALLOUT.y + 0.75, w - 1.5, CALLOUT.h - 1.5, 5.25);
      c.fillStyle = '#f5faff';
      c.fill();
      c.lineWidth = 1.5;
      c.strokeStyle = '#7399cc';
      c.stroke();
      c.fillStyle = '#1f2433';
      c.font = 'bold 13px ' + font;
      c.textBaseline = 'bottom';
      current.groups.forEach(function (g, i) {
        c.fillText(g.count + 'x', CALLOUT.x + 1.5 + i * current.cellW + 8, CALLOUT.y + CALLOUT.h - 1.5 - 6);
      });
    }
    c.drawImage(canvas, 0, 0, PAGE_W, PAGE_H);
    return out;
  }

  function render() {
    if (!camera) return;
    var s = still ? 2 : (window.devicePixelRatio || 1) * ((window.visualViewport && window.visualViewport.scale) || 1);
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
  // 210 px of travel runs the whole step, to the right on a build step (the
  // Lottie pages go left, into a page turn) and to the left on a turning page.
  // On release the step stays where it is, and the next drag carries on.
  var startX = 0, startProgress = 0;
  stage.addEventListener('pointerdown', function (event) {
    if (event.pageY <= 380) return;
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
    if (touch && touch.pageY > 380) {
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
