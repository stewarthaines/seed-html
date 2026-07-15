/**
 * SEED audio-clips reading-system script.
 *
 * Plays the audio clips marked up as
 *   <span class="clip" data-src="Audio/a.mp3" data-begin="0:00:05.00" data-end="0:00:15.00">label</span>
 * (produced from the :clip directive by the Djot / MarkdownIt text transforms).
 *
 * Click — or Enter/Space, once the script has promoted the span to a button —
 * toggles playback of the clip's [begin, end) range; starting one clip stops any
 * other.
 *
 * Design (profiled on real reading systems with audio support):
 *
 * - ONE audio element for the whole page, however many clips it defines.
 *   Reading systems multiply media pipelines and preload buffers per <audio>
 *   element; a single shared element keeps the page cheap. Clips from another
 *   source file swap the element's src (costing a re-buffer on alternation —
 *   the right trade against element multiplication).
 *
 * - The element must be STATIC markup, not script-created: the chapter's
 *   transformClipProgress.js writes it into the XHTML at authoring time,
 *   because reading systems don't reliably grant dynamically created media
 *   elements a pipeline (iOS Books refuses to play them). This player adopts
 *   the FIRST audio element in the document — which also lets an author
 *   inline their own <audio controls> and keep its visible controls. If the
 *   document carries no audio element, clips stay inert (plain styled text).
 *
 * - play() is called SYNCHRONOUSLY inside the tap handler, with the seek
 *   (currentTime = begin) issued immediately before it. Reading systems
 *   consume the user-gesture token within the gesture's own call stack —
 *   a play() deferred to a later media event ('seeked', 'loadedmetadata')
 *   is not gesture-blessed and Books rejects it, which presents as "seeking
 *   doesn't work". Setting currentTime before metadata is safe: the spec
 *   makes it the default playback start position.
 *
 * - Recovery stays event-driven, never timers: when the tap had to swap the
 *   element's src, 'loadedmetadata' seeks to begin and 'seeked' resumes a
 *   paused element; the clip end is enforced on 'timeupdate' — a position on
 *   the media timeline, not a wall-clock timer.
 *
 * - Encode clip audio at a CONSTANT bit rate (CBR). VBR mp3 seeking is
 *   unreliable in the iOS Books app; CBR mp3 (e.g. via Audacity) keeps files
 *   small and seeks accurately. Books reports only 'maybe' support for
 *   audio/mpeg and audio/mp4 — mp3 and m4a — and both behave with CBR.
 *
 * data-src is the OPF-relative href and chapters live one level below the OPF
 * (Text/), so it resolves via '../' — except when it already carries a scheme:
 * the authoring preview rewrites data-src to a blob: URL, which passes through.
 *
 * Progressive enhancement: without JavaScript the span is plain styled text
 * (clip.css keys its play affordance on the role attribute this script adds).
 * Kept to conservative, widely-supported JS for reading-system compatibility.
 */
(function () {
  'use strict';

  // 'h:mm:ss.dd' (or plain seconds) → seconds.
  function toSeconds(value) {
    if (!value) return 0;
    return value.split(':').reduce(function (total, part) {
      return total * 60 + (parseFloat(part) || 0);
    }, 0);
  }

  // OPF-relative href → '../…' (chapters live in Text/); any URL that already
  // carries a scheme (blob: in the preview, http(s): remote) passes through.
  function resolveSrc(src) {
    return /^[a-z][a-z0-9+.-]*:/i.test(src) ? src : '../' + src;
  }

  var audio = null; // THE page's one shared audio element (static markup)
  var active = null; // { span, begin, end } for the clip now playing
  var seekPlayPending = false; // play() is owed once the begin-seek completes

  function ensureAudio() {
    if (audio) return audio;
    // Adopt the document's audio element (transformClipProgress.js guarantees
    // one when the chapter has clips; an author-inlined <audio controls>
    // takes precedence and keeps its controls). Never create one here —
    // script-created media elements don't play in iOS Books.
    audio = document.querySelector('audio');
    if (!audio) return null;

    // New source ready → position at the active clip's begin ('seeked' follows).
    audio.addEventListener('loadedmetadata', function () {
      if (active) audio.currentTime = active.begin;
    });

    // Seek complete → the pipeline is positioned; NOW play.
    audio.addEventListener('seeked', function () {
      if (active && seekPlayPending && audio.paused) {
        seekPlayPending = false;
        var playing = audio.play();
        if (playing && playing.catch) playing.catch(stop);
      }
    });

    // The clip end is a position on the media timeline, not a wall-clock timer.
    audio.addEventListener('timeupdate', function () {
      if (active && audio.currentTime >= active.end) stop();
    });
    audio.addEventListener('ended', stop);
    audio.addEventListener('error', stop);

    // Courtesy to any other audio the page carries (e.g. authored <audio>
    // elements): starting a clip silences them so only one thing plays.
    audio.addEventListener('play', function () {
      var others = document.querySelectorAll('audio');
      for (var i = 0; i < others.length; i++) {
        if (others[i] !== audio) others[i].pause();
      }
    });

    return audio;
  }

  function stop() {
    seekPlayPending = false;
    if (audio) audio.pause();
    if (!active) return;
    active.span.classList.remove('clip-playing');
    active.span.style.removeProperty('--clip-duration');
    active = null;
  }

  function play(span) {
    var el = ensureAudio();
    if (!el) return; // no static audio element — clips stay inert
    var src = resolveSrc(span.getAttribute('data-src'));
    var begin = toSeconds(span.getAttribute('data-begin'));
    var end = toSeconds(span.getAttribute('data-end'));
    var rate = parseFloat(span.getAttribute('data-rate')) || 1;

    active = { span: span, begin: begin, end: end };
    el.playbackRate = rate;

    // Publish the clip's wall-clock duration for the progress indicators
    // (transformClipProgress.js / clip.css) — the player itself has no idea
    // how progress is drawn; CSS animations keyed on .clip-playing pick the
    // duration up from this custom property.
    var duration = (end - begin) / rate;
    if (isFinite(duration) && duration > 0) {
      span.style.setProperty('--clip-duration', duration + 's');
    }
    span.classList.add('clip-playing');

    if (el.getAttribute('src') !== src) {
      // Different file: swap src inside the gesture; loadedmetadata seeks to
      // begin and 'seeked' plays (the recovery net). Kept as the one deferred
      // path — playing immediately would blip audio from position 0.
      seekPlayPending = true;
      el.setAttribute('src', src);
    } else {
      // Same file (the common case — the static element already carries it):
      // seek AND play synchronously in the tap, the field-proven pattern for
      // reading systems. Before metadata, currentTime sets the default
      // playback start position, so this is safe on a cold element too.
      seekPlayPending = false;
      el.currentTime = begin;
      var playing = el.play();
      if (playing && playing.catch) playing.catch(stop);
    }
  }

  function toggle(span) {
    var wasPlaying = active && active.span === span;
    stop();
    if (!wasPlaying) play(span);
  }

  function init() {
    var clips = document.querySelectorAll('span.clip[data-src]');
    for (var i = 0; i < clips.length; i++) {
      (function (span) {
        span.setAttribute('role', 'button');
        span.setAttribute('tabindex', '0');
        span.addEventListener('click', function () {
          toggle(span);
        });
        span.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault();
            toggle(span);
          }
        });
      })(clips[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
