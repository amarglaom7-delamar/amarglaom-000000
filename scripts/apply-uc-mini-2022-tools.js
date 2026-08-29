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

const before = "      var dataSaver = ${settings.dataSaver ? 'true' : 'false'};";
const after = `      var dataSaver = \${settings.dataSaver ? 'true' : 'false'};
      var ucMiniTools = true; // ${marker}
      var ucGestureStartX = null;
      var ucGestureStartY = null;
      var ucGestureStartTime = 0;
      function subtitleTracks(mediaElement) {
        try { return Array.prototype.slice.call(mediaElement.querySelectorAll('track')).filter(function(t) { return t.kind === 'subtitles' || t.kind === 'captions'; }).map(function(t,i) { return {index:i,label:t.label||t.srclang||('CC '+(i+1)),lang:t.srclang||'',track:t}; }); } catch(e) { return []; }
      }
      function setSubtitleTrack(mediaElement, wantedIndex) {
        subtitleTracks(mediaElement).forEach(function(item,index) { try { item.track.track.mode = index === wantedIndex ? 'showing' : 'hidden'; } catch(e) {} });
      }
      function cyclePlaybackRate(mediaElement, button) {
        var rates=[0.5,0.75,1,1.25,1.5,2], current=rates.indexOf(mediaElement.playbackRate), next=rates[(current<0?2:current+1)%rates.length];
        mediaElement.playbackRate=next; button.textContent=next+'x'; showControls();
      }
      function seekBy(mediaElement, seconds) { if (!isFinite(mediaElement.duration)) return; mediaElement.currentTime=Math.max(0,Math.min(mediaElement.duration,mediaElement.currentTime+seconds)); showControls(); }
      function persistVideoPosition(mediaElement) { try { if (mediaElement.src && isFinite(mediaElement.currentTime) && mediaElement.currentTime > 2) localStorage.setItem('miniwave-video-pos:'+location.href, String(mediaElement.currentTime)); } catch(e) {} }
      function restoreVideoPosition(mediaElement) { try { var key='miniwave-video-pos:'+location.href, value=parseFloat(localStorage.getItem(key)||''); if (isFinite(value) && value > 2 && value < (mediaElement.duration||Infinity)-2) mediaElement.currentTime=value; } catch(e) {} }`;
if (!source.includes(before)) throw new Error('UC Mini patch anchor not found; refusing partial modification.');
source = source.replace(before, after);

const controlAnchor = "        var fullscreenButton = controlButton('Fullscreen', '⛶');";
const controlReplacement = `        var fullscreenButton = controlButton('Fullscreen', '⛶');
        var subtitleButton = controlButton('Subtitles', 'CC'); subtitleButton.style.fontSize='11px';
        var speedButton = controlButton('Playback speed', '1x'); speedButton.style.fontSize='11px';
        var rewindButton = controlButton('Rewind 10 seconds', '↶10'); rewindButton.style.fontSize='10px';
        var forwardButton = controlButton('Forward 10 seconds', '10↷'); forwardButton.style.fontSize='10px';`;
if (!source.includes(controlAnchor)) throw new Error('Control anchor not found; refusing partial modification.');
source = source.replace(controlAnchor, controlReplacement);

const listenerAnchor = "        fullscreenButton.addEventListener('click', function() {";
const listenerInsert = `        rewindButton.addEventListener('click', function() { seekBy(mediaElement,-10); }, true);
        forwardButton.addEventListener('click', function() { seekBy(mediaElement,10); }, true);
        subtitleButton.addEventListener('click', function() {
          var tracks=subtitleTracks(mediaElement);
          if(!tracks.length){ send('subtitle',{available:false,url:location.href,title:document.title}); showControls(); return; }
          var labels=tracks.map(function(item,i){return (i+1)+': '+item.label;}).join('\\n');
          var selected=window.prompt('CC\\n'+labels+'\\n0: hide'); if(selected===null)return;
          var number=parseInt(selected,10);
          if(number===0) tracks.forEach(function(item){try{item.track.track.mode='hidden';}catch(e){}});
          else if(number>=1&&number<=tracks.length){setSubtitleTrack(mediaElement,number-1);send('subtitle',{available:true,label:tracks[number-1].label,lang:tracks[number-1].lang});}
          showControls();
        },true);
        speedButton.addEventListener('click', function(){cyclePlaybackRate(mediaElement,speedButton);},true);
        fullscreenButton.addEventListener('click', function() {`;
if (!source.includes(listenerAnchor)) throw new Error('Fullscreen listener anchor not found; refusing partial modification.');
source = source.replace(listenerAnchor, listenerInsert);

const mediaEventAnchor = "        mediaElement.addEventListener('touchstart', showControls, {passive:true});";
const gestureInsert = `        mediaElement.addEventListener('touchstart', function(event){
          showControls(); var t=event.touches&&event.touches[0]; if(t){ucGestureStartX=t.clientX;ucGestureStartY=t.clientY;ucGestureStartTime=Date.now();}
        },{passive:true});
        mediaElement.addEventListener('touchend', function(event){
          var t=event.changedTouches&&event.changedTouches[0]; if(!t||ucGestureStartX===null)return;
          var dx=t.clientX-ucGestureStartX,dy=t.clientY-ucGestureStartY,dt=Date.now()-ucGestureStartTime;
          ucGestureStartX=null;ucGestureStartY=null;
          if(Math.abs(dx)<70||Math.abs(dx)<Math.abs(dy)*1.25)return;
          seekBy(mediaElement,dx>0?-10:10);
        },{passive:true});
        mediaElement.addEventListener('dblclick',function(event){
          var r=mediaElement.getBoundingClientRect(); if(!r.width)return;
          seekBy(mediaElement,event.clientX<r.left+r.width/2?-10:10);
        },true);
        mediaElement.addEventListener('timeupdate',function(){persistVideoPosition(mediaElement);},{passive:true});
        mediaElement.addEventListener('loadedmetadata',function(){restoreVideoPosition(mediaElement);},{passive:true});`;
if (!source.includes(mediaEventAnchor)) throw new Error('Media touch anchor not found; refusing partial modification.');
source = source.replace(mediaEventAnchor, gestureInsert);

const oldMediaStart = "          if (mediaElement.paused || mediaElement.ended) return;\n          var url = mediaUrl(mediaElement);";
if (source.includes(oldMediaStart)) source = source.replace(oldMediaStart, "          var url = mediaUrl(mediaElement);");

const sendMediaAnchor = "        send('media', {sources:unique});";
const sendMediaReplacement = `        send('media', {sources:unique});
        videos.forEach(function(v){var tracks=subtitleTracks(v);if(tracks.length)send('subtitleTracks',{available:true,tracks:tracks.map(function(item){return {label:item.label,lang:item.lang};})});});`;
if (!source.includes(sendMediaAnchor)) throw new Error('Media message anchor not found; refusing partial modification.');
source = source.replace(sendMediaAnchor, sendMediaReplacement);

fs.writeFileSync(file, source);
console.log('Expanded UC Mini-style video tools: seek gestures, double-tap seek, speed, subtitles, position restore, and media detection.');
