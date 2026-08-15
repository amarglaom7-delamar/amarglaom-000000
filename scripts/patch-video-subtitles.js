const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const file = path.join(projectRoot, 'app', '(tabs)', 'index.tsx');

if (!fs.existsSync(file)) throw new Error(`Video browser file not found: ${file}`);

let source = fs.readFileSync(file, 'utf8');
if (source.includes('data-miniwave-subtitles')) {
  console.log('Video subtitle controls already applied.');
  process.exit(0);
}

const anchor = `        var fullscreenButton = controlButton('Fullscreen', '⛶');`;
const replacement = `${anchor}
        var subtitleButton = controlButton('Subtitles', 'CC');
        subtitleButton.style.fontSize = '11px';
        subtitleButton.style.fontWeight = '700';
        subtitleButton.setAttribute('data-miniwave-subtitles', '1');

        var subtitlePanel = document.createElement('div');
        subtitlePanel.style.cssText = [
          'position:absolute',
          'left:8px',
          'right:8px',
          'bottom:96px',
          'max-height:150px',
          'overflow:auto',
          'padding:8px',
          'box-sizing:border-box',
          'border-radius:12px',
          'background:rgba(0,0,0,.92)',
          'color:#fff',
          'z-index:40',
          'display:none',
          'font:12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'
        ].join(';');
        shell.appendChild(subtitlePanel);

        function subtitleTracks() {
          return Array.prototype.slice.call(document.querySelectorAll('video track[kind="subtitles"], video track[kind="captions"], video track[src]'))
            .filter(function(track) { return !!track.src || !!track.getAttribute('src'); })
            .map(function(track, index) {
              return {
                index: index,
                label: track.label || track.srclang || ('Subtitle ' + (index + 1)),
                lang: track.srclang || '',
                track: track
              };
            });
        }

        function closeSubtitlePanel() {
          subtitlePanel.style.display = 'none';
        }

        function selectSubtitle(item) {
          var tracks = subtitleTracks();
          tracks.forEach(function(candidate) {
            try { candidate.track.mode = candidate.track === item.track ? 'showing' : 'disabled'; } catch(e) {}
          });
          subtitleButton.style.opacity = '1';
          closeSubtitlePanel();
          showControls();
        }

        function showSubtitlePanel() {
          var tracks = subtitleTracks();
          subtitlePanel.innerHTML = '';
          if (!tracks.length) {
            var empty = document.createElement('div');
            empty.textContent = 'لا توجد ترجمة متاحة لهذا الفيديو';
            empty.style.cssText = 'padding:8px;color:#fff;text-align:center;';
            subtitlePanel.appendChild(empty);
            subtitlePanel.style.display = 'block';
            return;
          }
          tracks.forEach(function(item) {
            var button = document.createElement('button');
            button.type = 'button';
            button.textContent = item.label + (item.lang ? ' (' + item.lang + ')' : '');
            button.style.cssText = 'display:block;width:100%;padding:9px 10px;margin:2px 0;border:0;border-radius:8px;background:rgba(255,255,255,.10);color:#fff;text-align:left;font:12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;';
            button.addEventListener('click', function(event) {
              event.preventDefault();
              event.stopPropagation();
              selectSubtitle(item);
            }, true);
            subtitlePanel.appendChild(button);
          });
          subtitlePanel.style.display = 'block';
        }

        subtitleButton.addEventListener('click', function(event) {
          event.preventDefault();
          event.stopPropagation();
          showControls();
          if (subtitlePanel.style.display === 'block') closeSubtitlePanel();
          else showSubtitlePanel();
        }, true);`;

if (!source.includes(anchor)) throw new Error('Subtitle insertion point was not found; refusing a partial patch.');
source = source.replace(anchor, replacement);

const mediaAnchor = `        var videos = Array.prototype.slice.call(document.querySelectorAll('video, audio'));`;
const mediaReplacement = `        var videos = Array.prototype.slice.call(document.querySelectorAll('video, audio'));
        videos.forEach(function(mediaElement) {
          var tracks = mediaElement.querySelectorAll ? mediaElement.querySelectorAll('track[kind="subtitles"], track[kind="captions"], track[src]') : [];
          if (tracks.length) {
            for (var ti = 0; ti < tracks.length; ti += 1) {
              try { tracks[ti].mode = 'hidden'; } catch(e) {}
            }
          }
        });`;
if (!source.includes(mediaAnchor)) throw new Error('Media discovery insertion point was not found; refusing a partial patch.');
source = source.replace(mediaAnchor, mediaReplacement);

fs.writeFileSync(file, source);
console.log('Applied in-video subtitle selection to app/(tabs)/index.tsx');
