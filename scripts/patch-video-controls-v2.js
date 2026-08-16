const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const file = path.join(projectRoot, 'app', '(tabs)', 'index.tsx');

if (!fs.existsSync(file)) throw new Error(`Video browser file not found: ${file}`);

let source = fs.readFileSync(file, 'utf8');
if (source.includes('data-miniwave-overlay-controls-v2')) {
  console.log('Video overlay controls v2 already applied.');
  process.exit(0);
}

const marker = "        controls.setAttribute('data-miniwave-overlay-controls', '1');";
if (!source.includes(marker)) throw new Error('Base overlay controls patch is missing; refusing a partial patch.');

const markerReplacement = `${marker}\n        controls.setAttribute('data-miniwave-overlay-controls-v2', '1');`;
source = source.replace(marker, markerReplacement);

const shellStyles = `          'position:relative',\n          'display:inline-block',\n          'vertical-align:top',\n          'max-width:100%',\n          'background:#000',\n          'line-height:0',`;
const shellStylesReplacement = `          'position:relative',\n          'display:inline-block',\n          'vertical-align:top',\n          'max-width:100%',\n          'background:#000',\n          'line-height:0',\n          'overflow:hidden',\n          'isolation:isolate',`;
if (source.includes(shellStyles)) source = source.replace(shellStyles, shellStylesReplacement);

const overlayZ = "          'z-index:30',";
if (!source.includes(overlayZ)) throw new Error('Overlay z-index anchor not found; refusing a partial patch.');
source = source.replace(overlayZ, "          'z-index:999999',\n          'transform:translateZ(0)',\n          '-webkit-transform:translateZ(0)',");

const progressZ = "          'z-index:20',";
if (!source.includes(progressZ)) throw new Error('Progress z-index anchor not found; refusing a partial patch.');
source = source.replace(progressZ, "          'z-index:999998',\n          'transform:translateZ(0)',");

const maxHeight = "          controls.style.maxHeight = visible ? '96px' : '0';";
if (!source.includes(maxHeight)) throw new Error('Controls visibility anchor not found; refusing a partial patch.');
source = source.replace(maxHeight, `${maxHeight}\n          controls.style.visibility = visible ? 'visible' : 'hidden';`);

const appendAnchor = `        shell.appendChild(progress);\n        shell.appendChild(controls);`;
const appendReplacement = `${appendAnchor}\n        shell.addEventListener('click', showControls, true);\n        shell.addEventListener('touchend', showControls, {passive:true});\n        shell.addEventListener('pointerup', showControls, true);`;
if (!source.includes(appendAnchor)) throw new Error('Video shell insertion point was not found; refusing a partial patch.');
source = source.replace(appendAnchor, appendReplacement);

const mediaEvents = `        mediaElement.addEventListener('click', showControls, true);\n        mediaElement.addEventListener('touchstart', showControls, {passive:true});`;
const mediaEventsReplacement = `${mediaEvents}\n        mediaElement.addEventListener('touchend', showControls, {passive:true});\n        mediaElement.addEventListener('pointerup', showControls, true);`;
if (!source.includes(mediaEvents)) throw new Error('Video touch handler anchor was not found; refusing a partial patch.');
source = source.replace(mediaEvents, mediaEventsReplacement);

const downloadOpacity = "          downloadButton.style.opacity = usableMediaUrl(mediaUrl(mediaElement)) ? '.95' : '.35';";
if (source.includes(downloadOpacity)) {
  source = source.replace(downloadOpacity, "          downloadButton.style.opacity = usableMediaUrl(mediaUrl(mediaElement)) ? '1' : '.65';");
}

const sourceDetection = `          if (mediaElement.paused || mediaElement.ended) return;\n          var url = mediaUrl(mediaElement);`;
if (source.includes(sourceDetection)) {
  source = source.replace(sourceDetection, `          var url = mediaUrl(mediaElement);`);
}

fs.writeFileSync(file, source);
console.log('Applied hardened in-video overlay controls and touch handling.');
