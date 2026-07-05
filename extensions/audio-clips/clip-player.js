/**
 * SEED audio-clips reading-system script.
 *
 * Plays the audio clips marked up as
 *   <span class="clip" data-src="Audio/a.mp3" data-begin="0:00:05.00" data-end="0:00:15.00">label</span>
 * (produced from the :clip directive by the Djot / MarkdownIt text transforms).
 *
 * Click — or Enter/Space, once the script has promoted the span to a button —
 * toggles playback of the clip's [begin, end) range; starting one clip stops any
 * other. data-src is the OPF-relative href and chapters live one level below the
 * OPF (Text/), so it resolves via '../'. One shared <audio> per source file.
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

  var players = {}; // data-src → shared HTMLAudioElement
  var active = null; // { span, audio, end } for the clip now playing

  function stop() {
    if (!active) return;
    active.audio.pause();
    active.span.classList.remove('clip-playing');
    active = null;
  }

  function play(span) {
    var src = span.getAttribute('data-src');
    var audio = players[src];
    if (!audio) {
      audio = new Audio('../' + src);
      audio.preload = 'auto';
      audio.addEventListener('timeupdate', function () {
        if (active && active.audio === audio && audio.currentTime >= active.end) stop();
      });
      audio.addEventListener('ended', stop);
      players[src] = audio;
    }
    audio.currentTime = toSeconds(span.getAttribute('data-begin'));
    audio.playbackRate = parseFloat(span.getAttribute('data-rate')) || 1;
    active = { span: span, audio: audio, end: toSeconds(span.getAttribute('data-end')) };
    span.classList.add('clip-playing');
    var playing = audio.play();
    if (playing && playing.catch) playing.catch(stop);
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
