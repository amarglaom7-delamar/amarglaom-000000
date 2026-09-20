const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const file = path.join(projectRoot, 'app', '(tabs)', 'index.tsx');

if (!fs.existsSync(file)) throw new Error(`Video browser file not found: ${file}`);

let source = fs.readFileSync(file, 'utf8');

// Keep HTML5 videos inside the website page. This patch is intentionally
// idempotent and never replaces the site's <video> with a native full-screen modal.
source = source.replace(
  /mediaElement\.addEventListener\('click', function\(\) \{ showControls\(\); openInternalPlayer\(\); \}, true\);/g,
  "mediaElement.addEventListener('click', function() { showControls(); }, true);"
);
source = source.replace(
  /mediaElement\.addEventListener\('touchstart', function\(\) \{ showControls\(\); openInternalPlayer\(\); \}, \{passive:true\}\);/g,
  "mediaElement.addEventListener('touchstart', function() { showControls(); }, {passive:true});"
);

// Mark videos as inline-capable on Android/WebView.
if (!source.includes("data-miniwave-inline-player-v2")) {
  const marker = "        mediaElement.dataset.miniwaveControlsReady = '1';";
  if (!source.includes(marker)) throw new Error('Video control initialization anchor not found; refusing a partial patch.');
  source = source.replace(
    marker,
    marker + "\n        mediaElement.setAttribute('data-miniwave-inline-player-v2', '1');\n        mediaElement.setAttribute('playsinline', '');\n        mediaElement.setAttribute('webkit-playsinline', '');"
  );
}

fs.writeFileSync(file, source);
console.log('Kept website videos inline and disabled external/internal player takeover.');
