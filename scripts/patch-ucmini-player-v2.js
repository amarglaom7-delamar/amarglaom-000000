const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'app', '(tabs)', 'index.tsx');
let source = fs.readFileSync(target, 'utf8');

if (source.includes('data-miniwave-v2-controls')) {
  console.log('[ucmini-v2] already applied');
  process.exit(0);
}

const marker = `        var fullscreenButton = controlButton('Fullscreen', '⛶');`;
if (!source.includes(marker)) {
  throw new Error('[ucmini-v2] video control marker not found; refusing partial patch');
}

source = source.replace(marker, `${marker}\n        var muteButton = controlButton('Mute', '🔊');\n        var speedButton = controlButton('Speed', '1x');\n        controls.setAttribute('data-miniwave-v2-controls', '1');`);

const eventMarker = `        fullscreenButton.addEventListener('click', function() {\n`;
if (!source.includes(eventMarker)) {
  throw new Error('[ucmini-v2] fullscreen handler marker not found; refusing partial patch');
}

const handlers = `        muteButton.addEventListener('click', function() {\n          mediaElement.muted = !mediaElement.muted;\n          muteButton.textContent = mediaElement.muted ? '🔇' : '🔊';\n          showControls();\n        }, true);\n        speedButton.addEventListener('click', function() {\n          var rates = [1, 1.25, 1.5, 2, 0.75];\n          var current = mediaElement.playbackRate || 1;\n          var index = rates.indexOf(current);\n          var next = rates[(index + 1) % rates.length];\n          mediaElement.playbackRate = next;\n          speedButton.textContent = String(next).replace('.0', '') + 'x';\n          showControls();\n        }, true);\n`;
source = source.replace(eventMarker, `${handlers}\n${eventMarker}`);

const tapMarker = `        mediaElement.addEventListener('touchstart', showControls, {passive:true});`;
if (!source.includes(tapMarker)) {
  throw new Error('[ucmini-v2] touch marker not found; refusing partial patch');
}

const tapCode = `        var lastTap = 0;\n        var lastTapX = 0;\n        mediaElement.addEventListener('touchend', function(event) {\n          var now = Date.now();\n          var touch = event.changedTouches && event.changedTouches[0];\n          var x = touch ? touch.clientX : 0;\n          if (now - lastTap < 280 && Math.abs(x - lastTapX) < 100 && mediaElement.duration > 0 && isFinite(mediaElement.duration)) {\n            var delta = x < mediaElement.getBoundingClientRect().left + mediaElement.getBoundingClientRect().width / 2 ? -10 : 10;\n            mediaElement.currentTime = Math.max(0, Math.min(mediaElement.duration, mediaElement.currentTime + delta));\n          }\n          lastTap = now;\n          lastTapX = x;\n          showControls();\n        }, {passive:true});`;
source = source.replace(tapMarker, `${tapMarker}\n${tapCode}`);

fs.writeFileSync(target, source);
console.log('[ucmini-v2] mute, playback speed and double-tap seek controls added');
