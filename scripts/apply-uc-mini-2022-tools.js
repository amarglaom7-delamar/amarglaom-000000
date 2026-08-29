const fs = require('fs');
const path = require('path');
const projectRoot = path.resolve(__dirname, '..');
const file = path.join(projectRoot, 'app', '(tabs)', 'index.tsx');
if (!fs.existsSync(file)) throw new Error(`Browser file not found: ${file}`);
let source = fs.readFileSync(file, 'utf8');
const marker = 'data-ucmini-2022-tools';
if (source.includes('data-ucmini-download-button-v1')) { console.log('UC Mini download button already applied.'); process.exit(0); }
if (!source.includes(marker)) throw new Error('UC Mini tools marker not found; refusing partial modification.');
const anchor = "        var fullscreenButton = controlButton('Fullscreen', '⛶');";
const replacement = `        var fullscreenButton = controlButton('Fullscreen', '⛶');
        var downloadButton = controlButton('Download video', '⬇'); downloadButton.style.fontSize='14px'; downloadButton.setAttribute('data-ucmini-download-button-v1','true');`;
if (!source.includes(anchor)) throw new Error('Player control anchor not found.');
source = source.replace(anchor, replacement);
const listenerAnchor = "        fullscreenButton.addEventListener('click', function() {";
const listener = `        downloadButton.addEventListener('click', function(){
          try {
            var url = mediaUrl(mediaElement);
            if (!url) { send('download',{available:false,reason:'no-media-url',page:location.href}); showControls(); return; }
            send('download',{available:true,url:url,title:(document.title||'video').slice(0,120),page:location.href,mime:mediaElement.currentSrc ? '' : (mediaElement.getAttribute('type')||'')});
            downloadButton.textContent='✓';
            setTimeout(function(){downloadButton.textContent='⬇';},1200);
          } catch(e) { send('download',{available:false,reason:'error',page:location.href}); }
          showControls();
        },true);
        fullscreenButton.addEventListener('click', function() {`;
if (!source.includes(listenerAnchor)) throw new Error('Fullscreen listener anchor not found.');
source = source.replace(listenerAnchor, listener);
fs.writeFileSync(file, source);
console.log('Added UC Mini-style in-player download action and media URL handoff.');
