const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const file = path.join(projectRoot, 'app', '(tabs)', 'index.tsx');

if (!fs.existsSync(file)) throw new Error(`Browser source not found: ${file}`);

let source = fs.readFileSync(file, 'utf8');
const marker = 'data-miniwave-runtime-performance-v1';
if (source.includes(marker)) {
  console.log('Runtime performance v1 already applied.');
  process.exit(0);
}

const anchor = "const IN_PAGE_VIDEO_SCRIPT = `";
if (!source.includes(anchor)) {
  throw new Error('In-page script anchor not found; refusing partial performance patch.');
}

const patch = `\n// ${marker}\n(() => {\n  let scheduled = false;\n  let lastScan = 0;\n  const MIN_SCAN_MS = 350;\n  const scan = () => {\n    const now = Date.now();\n    if (now - lastScan < MIN_SCAN_MS) return;\n    lastScan = now;\n    document.querySelectorAll('video,audio').forEach((media) => {\n      if (!(media instanceof HTMLMediaElement)) return;\n      media.setAttribute('playsinline', '');\n      media.setAttribute('webkit-playsinline', '');\n    });\n  };\n  const schedule = () => {\n    if (scheduled) return;\n    scheduled = true;\n    requestAnimationFrame(() => {\n      scheduled = false;\n      scan();\n    });\n  };\n  scan();\n  const observer = new MutationObserver(schedule);\n  observer.observe(document.documentElement, { childList: true, subtree: true });\n  setTimeout(() => observer.disconnect(), 15000);\n})();\n`;

source = source.replace(anchor, anchor + patch);
fs.writeFileSync(file, source);
console.log('Applied lightweight runtime performance protection.');
