window.onload = setupAudio;

function getSeconds(timeString) {
  var seconds = parseFloat(
    timeString
      .split(':')
      .reverse()
      .reduce((prev, curr, i) => prev + curr * Math.pow(60, i), 0)
  );
  return seconds;
}

function setupAudio() {
  [...document.querySelectorAll('audio')].forEach(a => {
    a.controls = false;
    a.begin_s = getSeconds(a.getAttribute('data-clip-begin'));
    a.end_s = getSeconds(a.getAttribute('data-clip-end'));
    a.pause();
    a.addEventListener('seeked', event => {
      if (event.target.currentTime == event.target.begin_s) {
        console.log('seeked', event.target.currentTime);
      }
    });
    a.addEventListener('timeupdate', event => {
      if (event.target.currentTime > event.target.end_s) {
        a.pause();
      }
    });
    a.addEventListener('pause', event => {
      var b = event.target.parentElement.querySelector('button');
      b.classList.remove('playing');
    });
    a.addEventListener('play', event => {
      var b = event.target.parentElement.querySelector('button');
      b.classList.add('playing');
    });
    var b = a.parentElement.querySelector('button');
    b.audio = a;
    if (b) {
      b.addEventListener('click', event => {
        event.target.audio.currentTime = event.target.audio.begin_s;
        toggleAudio(event.target.audio);
      });
    }
  });
}

function toggleAudio(el) {
  var paused = el.paused;
  pauseAll();
  if (paused) el.play();
}

function pauseAll() {
  [...document.querySelectorAll('audio')].forEach(a => {
    a.pause();
  });
}
