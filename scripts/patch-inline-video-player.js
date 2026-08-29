const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const file = path.join(projectRoot, 'app', '(tabs)', 'index.tsx');

if (!fs.existsSync(file)) throw new Error(`Video browser file not found: ${file}`);

let source = fs.readFileSync(file, 'utf8');
if (source.includes('data-miniwave-inline-player-v1')) {
  console.log('Inline video player v1 already applied.');
  process.exit(0);
}

const readyMarker = "        mediaElement.dataset.miniwaveControlsReady = '1';";
if (!source.includes(readyMarker)) throw new Error('Video control initialization anchor not found; refusing a partial patch.');
source = source.replace(
  readyMarker,
  `${readyMarker}\n        mediaElement.setAttribute('data-miniwave-inline-player-v1', '1');\n        mediaElement.setAttribute('playsinline', '');\n        mediaElement.setAttribute('webkit-playsinline', '');`
);

const shellAnchor = "        shell.setAttribute('data-miniwave-video-shell', '1');";
if (!source.includes(shellAnchor)) throw new Error('Video shell anchor not found; refusing a partial patch.');
source = source.replace(
  shellAnchor,
  `${shellAnchor}\n        shell.setAttribute('data-miniwave-inline-player-v1', '1');`
);

const shellStylesAnchor = "          'background:#000',\n          'line-height:0',";
if (!source.includes(shellStylesAnchor)) throw new Error('Video shell style anchor not found; refusing a partial patch.');
source = source.replace(
  shellStylesAnchor,
  "          'background:#000',\n          'line-height:0',\n          'position:relative',\n          'overflow:hidden',\n          'isolation:isolate',"
);

const controlStylesAnchor = "          'pointer-events:none',\n          'z-index:30',";
if (!source.includes(controlStylesAnchor)) throw new Error('Inline control style anchor not found; refusing a partial patch.');
source = source.replace(
  controlStylesAnchor,
  "          'pointer-events:none',\n          'z-index:2147483646',\n          'transform:translateZ(0)',"
);

const progressStylesAnchor = "          'opacity:0',\n          'z-index:20',";
if (!source.includes(progressStylesAnchor)) throw new Error('Progress style anchor not found; refusing a partial patch.');
source = source.replace(
  progressStylesAnchor,
  "          'opacity:0',\n          'z-index:2147483645',\n          'transform:translateZ(0)',"
);

const appendAnchor = "        shell.appendChild(progress);\n        shell.appendChild(controls);";
if (!source.includes(appendAnchor)) throw new Error('Inline controls insertion anchor not found; refusing a partial patch.');
source = source.replace(
  appendAnchor,
  `${appendAnchor}\n        shell.addEventListener('click', showControls, true);\n        shell.addEventListener('touchend', showControls, { passive: true });`
);

const nativeControlAnchor = "        mediaElement.style.maxWidth = '100%';";
if (!source.includes(nativeControlAnchor)) throw new Error('Video sizing anchor not found; refusing a partial patch.');
source = source.replace(
  nativeControlAnchor,
  `${nativeControlAnchor}\n        mediaElement.setAttribute('playsinline', '');\n        mediaElement.setAttribute('webkit-playsinline', '');`
);

fs.writeFileSync(file, source);
console.log('Applied same-page inline video player behavior.');
