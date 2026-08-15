const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const file = path.join(projectRoot, 'app', '(tabs)', 'index.tsx');

if (!fs.existsSync(file)) throw new Error(`Browser file not found: ${file}`);
let source = fs.readFileSync(file, 'utf8');

const marker = 'data-ucmini-2022-tools';
if (source.includes(marker)) {
  console.log('UC Mini 2022 tools already applied.');
  process.exit(0);
}

// Keep this patch deliberately self-contained: it enhances the existing WebView
// without replacing the browser architecture or introducing native dependencies.
const before = "      var dataSaver = ${settings.dataSaver ? 'true' : 'false'};";
const after = `      var dataSaver = \${settings.dataSaver ? 'true' : 'false'};
      var ucMiniTools = true; // ${marker}
      var ucGestureStartX = null;
      var ucGestureStartY = null;
      function subtitleTracks(mediaElement) {
        try {
          return Array.prototype.slice.call(mediaElement.querySelectorAll('track')).filter(function(track) {
            return track.kind === 'subtitles' || track.kind === 'captions';
          }).map(function(track, index) {
            return { index:index, label:track.label || track.srclang || ('CC ' + (index + 1)), lang:track.srclang || '', track:track };
          });
        } catch(e) { return []; }
      }
      function setSubtitleTrack(mediaElement, wantedIndex) {
        var tracks = subtitleTracks(mediaElement);
        tracks.forEach(function(item, index) {
          try { item.track.track.mode = (index === wantedIndex ? 'showing' : 'hidden'); } catch(e) {}
        });
      }
      function cyclePlaybackRate(mediaElement, button) {
        var rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
        var current = rates.indexOf(mediaElement.playbackRate);
        var next = rates[(current < 0 ? 2 : current + 1) % rates.length];
        mediaElement.playbackRate = next;
        button.textContent = next + 'x';
        showControls();
      }`;

if (!source.includes(before)) throw new Error('UC Mini patch anchor not found; refusing partial modification.');
source = source.replace(before, after);

const controlAnchor = "        var fullscreenButton = controlButton('Fullscreen', '⛶');";
const controlReplacement = `        var fullscreenButton = controlButton('Fullscreen', '⛶');
        var subtitleButton = controlButton('Subtitles', 'CC');
        subtitleButton.style.fontSize = '11px';
        var speedButton = controlButton('Playback speed', '1x');
        speedButton.style.fontSize = '11px';`;
if (!source.includes(controlAnchor)) throw new Error('Control anchor not found; refusing partial modification.');
source = source.replace(controlAnchor, controlReplacement);

const listenerAnchor = "        fullscreenButton.addEventListener('click', function() {";
const listenerInsert = `        subtitleButton.addEventListener('click', function() {
          var tracks = subtitleTracks(mediaElement);
          if (!tracks.length) {
            send('subtitle', {available:false, url:location.href, title:document.title});
            showControls();
            return;
          }
          var labels = tracks.map(function(item) { return item.label; }).join(' | ');
          var selected = window.prompt('CC: ' + labels + '\\nEnter number (1-' + tracks.length + ') or 0 to hide');
          if (selected === null) return;
          var number = parseInt(selected, 10);
          if (number === 0) {
            tracks.forEach(function(item) { try { item.track.track.mode = 'hidden'; } catch(e) {} });
          } else if (number >= 1 && number <= tracks.length) {
            setSubtitleTrack(mediaElement, number - 1);
            send('subtitle', {available:true, label:tracks[number - 1].label, lang:tracks[number - 1].lang});
          }
          showControls();
        }, true);
        speedButton.addEventListener('click', function() { cyclePlaybackRate(mediaElement, speedButton); }, true);

        fullscreenButton.addEventListener('click', function() {`;
if (!source.includes(listenerAnchor)) throw new Error('Fullscreen listener anchor not found; refusing partial modification.');
source = source.replace(listenerAnchor, listenerInsert);

const mediaEventAnchor = "        mediaElement.addEventListener('touchstart', showControls, {passive:true});";
const gestureInsert = `        mediaElement.addEventListener('touchstart', function(event) {
          showControls();
          var touch = event.touches && event.touches[0];
          if (touch) { ucGestureStartX = touch.clientX; ucGestureStartY = touch.clientY; }
        }, {passive:true});
        mediaElement.addEventListener('touchend', function(event) {
          var touch = event.changedTouches && event.changedTouches[0];
          if (!touch || ucGestureStartX === null) return;
          var dx = touch.clientX - ucGestureStartX;
          var dy = touch.clientY - ucGestureStartY;
          ucGestureStartX = null; ucGestureStartY = null;
          if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
          if (dx > 0) { mediaElement.currentTime = Math.max(0, mediaElement.currentTime - 10); }
          else { mediaElement.currentTime = Math.min(mediaElement.duration || mediaElement.currentTime + 10, mediaElement.currentTime + 10); }
          showControls();
        }, {passive:true});`;
if (!source.includes(mediaEventAnchor)) throw new Error('Media touch anchor not found; refusing partial modification.');
source = source.replace(mediaEventAnchor, gestureInsert);

// Detect all video sources, including inactive <video> elements, while retaining
// the existing DRM-safe behavior: m3u8/DRM are not downloaded by this layer.
const oldMediaStart = "          if (mediaElement.paused || mediaElement.ended) return;\n          var url = mediaUrl(mediaElement);";
const newMediaStart = "          var url = mediaUrl(mediaElement);";
if (source.includes(oldMediaStart)) source = source.replace(oldMediaStart, newMediaStart);

// Notify native code about subtitle availability without interfering with page playback.
const sendMediaAnchor = "        send('media', {sources:unique});";
const sendMediaReplacement = `        send('media', {sources:unique});
        var playing = videos.filter(function(v) { return !v.paused && !v.ended; });
        playing.forEach(function(v) {
          var tracks = subtitleTracks(v);
          send('subtitleTracks', {available:tracks.length > 0, tracks:tracks.map(function(item) { return {label:item.label, lang:item.lang}; })});
        });`;
if (!source.includes(sendMediaAnchor)) throw new Error('Media message anchor not found; refusing partial modification.');
source = source.replace(sendMediaAnchor, sendMediaReplacement);

fs.writeFileSync(file, source);
console.log('Applied UC Mini 2022-inspired video tools: CC discovery, playback speed, swipe seek, and broader media detection.');
