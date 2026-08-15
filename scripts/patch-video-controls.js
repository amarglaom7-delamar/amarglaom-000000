const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const file = path.join(projectRoot, 'app', '(tabs)', 'index.tsx');

if (!fs.existsSync(file)) throw new Error(`Video browser file not found: ${file}`);

let source = fs.readFileSync(file, 'utf8');
if (source.includes('data-miniwave-overlay-controls')) {
  console.log('Video overlay controls already applied.');
  process.exit(0);
}

const replacements = [
  [
`          'position:relative',\n          'display:inline-block',\n          'vertical-align:top',\n          'max-width:100%',\n          'background:#000',\n          'line-height:0',`,
`          'position:relative',\n          'display:inline-block',\n          'vertical-align:top',\n          'max-width:100%',\n          'background:#000',\n          'line-height:0',\n          'overflow:hidden',\n          'isolation:isolate',`,
  ],
  [
`        progress.style.cssText = [\n          'height:3px',\n          'width:100%',\n          'background:rgba(255,255,255,.28)',\n          'cursor:pointer',\n          'opacity:0',\n          'transition:opacity .18s ease'\n        ].join(';');`,
`        progress.style.cssText = [\n          'position:absolute',\n          'left:4%',\n          'bottom:82px',\n          'height:4px',\n          'width:92%',\n          'background:rgba(255,255,255,.30)',\n          'border-radius:4px',\n          'cursor:pointer',\n          'opacity:0',\n          'z-index:20',\n          'transition:opacity .18s ease'\n        ].join(';');`,
  ],
  [
`        controls.style.cssText = [\n          'display:flex',\n          'align-items:center',\n          'gap:5px',\n          'width:100%',\n          'min-height:38px',\n          'padding:4px 6px',\n          'box-sizing:border-box',\n          'background:#000',\n          'color:#fff',\n          'direction:ltr',\n          'opacity:0',\n          'max-height:0',\n          'overflow:hidden',\n          'pointer-events:none',\n          'transition:opacity .18s ease,max-height .18s ease',\n          'font:12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'\n        ].join(';');`,
`        controls.setAttribute('data-miniwave-overlay-controls', '1');\n        controls.style.cssText = [\n          'position:absolute',\n          'left:3%',\n          'bottom:12px',\n          'width:94%',\n          'min-height:72px',\n          'padding:9px 12px 8px',\n          'box-sizing:border-box',\n          'display:flex',\n          'flex-wrap:wrap',\n          'align-items:center',\n          'justify-content:space-between',\n          'gap:2px',\n          'border-radius:18px',\n          'background:rgba(0,0,0,.84)',\n          'box-shadow:0 6px 22px rgba(0,0,0,.32)',\n          'color:#fff',\n          'direction:ltr',\n          'opacity:0',\n          'max-height:0',\n          'overflow:hidden',\n          'pointer-events:none',\n          'z-index:30',\n          'transition:opacity .18s ease,max-height .18s ease,transform .18s ease',\n          'font:12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'\n        ].join(';');`,
  ],
  [
`        time.style.cssText = 'flex:1;min-width:54px;color:#fff;font-size:10px;line-height:24px;white-space:nowrap;text-align:left;';`,
`        time.style.cssText = 'flex:1 0 100%;width:100%;min-width:0;color:#fff;font-size:11px;line-height:22px;white-space:nowrap;text-align:left;padding:0 2px;';`,
  ],
  [
`            'width:27px',\n            'height:27px',`,
`            'width:38px',\n            'height:34px',`,
  ],
  [
`        var shareButton = controlButton('Share', '↗');\n        var favoriteButton = controlButton('Favorite', '☆');\n        var downloadButton = controlButton('Download', '↓');\n        var backButton = controlButton('Back', '‹');\n        var fullscreenButton = controlButton('Fullscreen', '⛶');`,
`        var backButton = controlButton('Back', '‹');\n        var shareButton = controlButton('Share', '↗');\n        var favoriteButton = controlButton('Favorite', '☆');\n        var downloadButton = controlButton('Download', '↓');\n        var fullscreenButton = controlButton('Fullscreen', '⛶');`,
  ],
  [
`          controls.style.maxHeight = visible ? '42px' : '0';`,
`          controls.style.maxHeight = visible ? '96px' : '0';`,
  ],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error('Expected video-control source block was not found; refusing a partial patch.');
  source = source.replace(before, after);
}

source = source.replace(
`        function setControlsVisible(visible) {\n          controls.style.opacity = visible ? '1' : '0';\n          controls.style.maxHeight = visible ? '96px' : '0';\n          controls.style.pointerEvents = visible ? 'auto' : 'none';\n          progress.style.opacity = visible ? '1' : '0';\n        }`,
`        function setControlsVisible(visible) {\n          controls.style.opacity = visible ? '1' : '0';\n          controls.style.maxHeight = visible ? '96px' : '0';\n          controls.style.pointerEvents = visible ? 'auto' : 'none';\n          progress.style.opacity = visible ? '1' : '0';\n        }`
);

fs.writeFileSync(file, source);
console.log('Applied centered overlay video controls to app/(tabs)/index.tsx');
