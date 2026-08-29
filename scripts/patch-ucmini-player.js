const fs = require('fs');
const path = require('path');

const file = path.join(path.resolve(__dirname, '..'), 'app', '(tabs)', 'index.tsx');
if (!fs.existsSync(file)) throw new Error('Browser source not found');
let source = fs.readFileSync(file, 'utf8');
if (source.includes('data-ucmini-player-v1')) process.exit(0);
const anchor = "const IN_PAGE_VIDEO_SCRIPT = `";
if (!source.includes(anchor)) throw new Error('Video page script anchor not found; refusing partial patch.');
const patch = `\n// data-ucmini-player-v1\n// UC Mini-inspired inline controls: same-page playback, gestures, speed and seek.\n(() => {\n  const videos = new WeakSet();\n  const mark = (v) => {\n    if (!(v instanceof HTMLVideoElement) || videos.has(v)) return;\n    videos.add(v);\n    v.setAttribute('playsinline', '');\n    v.setAttribute('webkit-playsinline', '');\n    v.dataset.ucminiPlayer = '1';\n    v.addEventListener('dblclick', (e) => {\n      const r = v.getBoundingClientRect();\n      const x = e.clientX - r.left;\n      v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + (x < r.width / 2 ? -10 : 10)));\n    }, { passive: true });\n    let downX = 0, downY = 0, downT = 0;\n    v.addEventListener('touchstart', (e) => { const t=e.touches[0]; if(t){downX=t.clientX;downY=t.clientY;downT=Date.now();} }, {passive:true});\n    v.addEventListener('touchend', (e) => {\n      const t=e.changedTouches[0]; if(!t) return;\n      const dx=t.clientX-downX, dy=t.clientY-downY, dt=Date.now()-downT;\n      if(dt<650 && Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*1.4){ v.currentTime=Math.max(0,Math.min(v.duration||Infinity,v.currentTime+(dx>0?10:-10))); }\n    }, {passive:true});\n  };\n  const scan = () => document.querySelectorAll('video').forEach(mark);\n  scan();\n  const mo = new MutationObserver(() => { requestAnimationFrame(scan); });\n  mo.observe(document.documentElement, {childList:true,subtree:true});\n  setTimeout(() => mo.disconnect(), 15000);\n})();\n`;
source = source.replace(anchor, anchor + patch);
fs.writeFileSync(file, source);
console.log('Applied UC Mini-inspired inline video controls.');
