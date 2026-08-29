const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'app', '(tabs)', 'index.tsx');

let source = fs.readFileSync(target, 'utf8');
let changed = false;

function replaceOnce(needle, replacement, label) {
  if (source.includes(replacement)) return;
  if (!source.includes(needle)) {
    throw new Error(`UC Mini enhancement patch: marker not found: ${label}`);
  }
  source = source.replace(needle, replacement);
  changed = true;
  console.log(`[ucmini] ${label}`);
}

// Keep private tabs isolated and enable the WebView cache for normal tabs.
replaceOnce(
  '        javaScriptEnabled\n        domStorageEnabled\n',
  '        javaScriptEnabled\n        domStorageEnabled\n        incognito={tab.private}\n        cacheEnabled={!tab.private}\n',
  'private-tab isolation + WebView cache',
);

// Add double-tap seek, similar to the lightweight gesture behavior users expect
// from classic mobile video browsers. A single tap continues to show controls.
replaceOnce(
  "        mediaElement.addEventListener('click', showControls, true);\n        mediaElement.addEventListener('touchstart', showControls, {passive:true});\n",
  "        var lastTapAt = 0;\n        var lastTapX = 0;\n        function handleVideoTap(event) {\n          var now = Date.now();\n          var touch = event.changedTouches && event.changedTouches[0];\n          var x = touch ? touch.clientX : 0;\n          var rect = mediaElement.getBoundingClientRect();\n          if (now - lastTapAt < 280 && Math.abs(x - lastTapX) < 90 && mediaElement.duration > 0 && isFinite(mediaElement.duration)) {\n            var seekBy = x < rect.left + rect.width / 2 ? -10 : 10;\n            mediaElement.currentTime = Math.max(0, Math.min(mediaElement.duration, mediaElement.currentTime + seekBy));\n            showControls();\n            lastTapAt = 0;\n            return;\n          }\n          lastTapAt = now;\n          lastTapX = x;\n          showControls();\n        }\n        mediaElement.addEventListener('click', showControls, true);\n        mediaElement.addEventListener('touchend', handleVideoTap, {passive:true});\n",
  'double-tap seek gestures',
);

// Restore the last position for the current page/video without writing on every
// frame. sessionStorage is scoped to the WebView page and is intentionally used
// instead of persistent storage to keep writes cheap.
replaceOnce(
  "        mediaElement.style.maxWidth = '100%';\n\n        var progress = document.createElement('div');\n",
  "        mediaElement.style.maxWidth = '100%';\n\n        var positionKey = 'miniwave-video-position:' + location.origin + ':' + (mediaUrl(mediaElement) || 'video');\n        var restoredPosition = false;\n        function restoreVideoPosition() {\n          if (restoredPosition) return;\n          restoredPosition = true;\n          try {\n            var saved = Number(sessionStorage.getItem(positionKey));\n            if (saved > 0 && isFinite(saved) && mediaElement.duration > saved) mediaElement.currentTime = saved;\n          } catch (e) {}\n        }\n        var lastSavedPosition = 0;\n        function saveVideoPosition() {\n          var current = Math.floor(mediaElement.currentTime || 0);\n          if (current === lastSavedPosition || current % 3 !== 0) return;\n          lastSavedPosition = current;\n          try { sessionStorage.setItem(positionKey, String(current)); } catch (e) {}\n        }\n\n        var progress = document.createElement('div');\n",
  'video position restore',
);

replaceOnce(
  "        ['timeupdate', 'loadedmetadata', 'loadeddata', 'durationchange', 'progress', 'canplay', 'emptied'].forEach(function(eventName) {\n          mediaElement.addEventListener(eventName, updateProgress, true);\n        });\n",
  "        ['timeupdate', 'loadedmetadata', 'loadeddata', 'durationchange', 'progress', 'canplay', 'emptied'].forEach(function(eventName) {\n          mediaElement.addEventListener(eventName, updateProgress, true);\n        });\n        mediaElement.addEventListener('loadedmetadata', restoreVideoPosition, true);\n        mediaElement.addEventListener('timeupdate', saveVideoPosition, true);\n        mediaElement.addEventListener('pause', saveVideoPosition, true);\n        mediaElement.addEventListener('ended', function() { try { sessionStorage.removeItem(positionKey); } catch (e) {} }, true);\n",
  'video position persistence hooks',
);

// Avoid an always-running interval. Media events and the MutationObserver already
// trigger discovery; one delayed scan catches late-created players without keeping
// a permanent timer alive.
replaceOnce(
  '      setInterval(media, 3500);\n',
  '      if (document.visibilityState !== \'hidden\') setTimeout(media, 3500);\n',
  'visibility-aware media rescan',
);

if (changed) {
  fs.writeFileSync(target, source);
  console.log('[ucmini] enhancements applied');
} else {
  console.log('[ucmini] no changes needed');
}
