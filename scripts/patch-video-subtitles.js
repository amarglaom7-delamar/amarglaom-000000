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
        controls.appendChild(subtitleButton);

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

/* VOICE_TRANSLATION_PATCH */
if (!source.includes("data-miniwave-voice-translation")) {
  const importAnchor = "import { useColors } from '@/hooks/useColors';";
  if (!source.includes(importAnchor)) throw new Error('Audio translation import anchor not found.');
  source = source.replace(
    importAnchor,
    importAnchor + "\nimport audioTranslationModule, { audioTranslationEvents } from '@/modules/audio-translation/src/AudioTranslationModule';"
  );

  const messageAnchor = "      if (message.type === 'media' || message.type === 'openPlayer') {";
  if (!source.includes(messageAnchor)) throw new Error('Audio translation message anchor not found.');
  const messagePatch = `      if (message.type === 'voiceTranslateStart') {
        if (Platform.OS !== 'android') {
          setNotice('الترجمة الصوتية متاحة على Android فقط.');
        } else {
          void (async () => {
            try {
              const { PermissionsAndroid } = require('react-native');
              const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
              if (result !== PermissionsAndroid.RESULTS.GRANTED) {
                setNotice('يجب السماح بالميكروفون لتشغيل التقاط صوت الفيديو.');
                return;
              }
              await audioTranslationModule.start();
            } catch (error) {
              setNotice(error instanceof Error ? error.message : 'تعذر بدء الترجمة الصوتية.');
            }
          })();
        }
      }
      if (message.type === 'voiceTranslateStop') {
        try { audioTranslationModule.stop(); } catch {}
      }
`;
  source = source.replace(messageAnchor, messagePatch + messageAnchor);

  const effectAnchor = "  const injectedJavaScript = useMemo(() => `";
  if (!source.includes(effectAnchor)) throw new Error('Audio translation effect anchor not found.');
  const effectPatch = `  useEffect(() => {
    const speechSubscription = audioTranslationEvents.addListener('onSpeechResult', (event: { text?: string; language?: string }) => {
      const text = event?.text?.trim();
      if (!text || !activeTabId) return;
      void (async () => {
        try {
          const endpoint = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=' + encodeURIComponent(text);
          const response = await fetch(endpoint);
          const data = await response.json();
          const translated = Array.isArray(data?.[0]) ? data[0].map((part: any) => Array.isArray(part) ? part[0] : '').join('') : '';
          if (!translated) return;
          const js = \`window.dispatchEvent(new CustomEvent('miniwave-audio-translation',{detail:\${JSON.stringify(translated)}})); true;\`;
          webRefs.current[activeTabId]?.injectJavaScript(js);
        } catch {}
      })();
    });
    const stateSubscription = audioTranslationEvents.addListener('onState', (event: { state?: string; message?: string }) => {
      if (event?.state === 'error' && event.message) setNotice(event.message);
      if (event?.state === 'started') setNotice('بدأت الترجمة من صوت الفيديو.');
      if (event?.state === 'stopped') setNotice('تم إيقاف الترجمة الصوتية.');
    });
    return () => {
      speechSubscription.remove();
      stateSubscription.remove();
    };
  }, [activeTabId]);

`;
  source = source.replace(effectAnchor, effectPatch + effectAnchor);

  const voiceButtonAnchor = "        var subtitleButton = controlButton('Subtitles', 'CC');";
  if (!source.includes(voiceButtonAnchor)) throw new Error('Audio translation button anchor not found.');
  const voicePatch = `        var voiceTranslateButton = controlButton('ترجمة صوت الفيديو', '🎙');
        voiceTranslateButton.style.fontSize = '11px';
        voiceTranslateButton.style.fontWeight = '700';
        voiceTranslateButton.setAttribute('data-miniwave-voice-translation', '1');

        var voiceTranslationId = 'voice-' + Math.random().toString(36).slice(2);
        var voiceTranslationEnabled = false;
        var voiceOverlay = document.createElement('div');
        voiceOverlay.setAttribute('data-miniwave-voice-overlay', '1');
        voiceOverlay.style.cssText = [
          'position:absolute',
          'left:8px',
          'right:8px',
          'bottom:50px',
          'padding:8px 12px',
          'box-sizing:border-box',
          'border-radius:10px',
          'background:rgba(0,0,0,.86)',
          'color:#fff',
          'z-index:45',
          'display:none',
          'font:15px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
          'font-weight:700',
          'line-height:1.45',
          'text-align:center',
          'direction:rtl'
        ].join(';');
        shell.appendChild(voiceOverlay);

        voiceTranslateButton.addEventListener('click', function(event) {
          event.preventDefault();
          event.stopPropagation();
          showControls();
          voiceTranslationEnabled = !voiceTranslationEnabled;
          if (voiceTranslationEnabled) {
            window.__miniwaveVoiceTargetId = voiceTranslationId;
            voiceTranslateButton.style.opacity = '1';
            send('voiceTranslateStart', { voiceId: voiceTranslationId });
          } else {
            if (window.__miniwaveVoiceTargetId === voiceTranslationId) window.__miniwaveVoiceTargetId = null;
            voiceTranslateButton.style.opacity = '.75';
            voiceOverlay.style.display = 'none';
            send('voiceTranslateStop', { voiceId: voiceTranslationId });
          }
        }, true);

        window.addEventListener('miniwave-audio-translation', function(event) {
          if (!voiceTranslationEnabled || window.__miniwaveVoiceTargetId !== voiceTranslationId) return;
          var translated = event && event.detail ? String(event.detail) : '';
          if (!translated) return;
          voiceOverlay.textContent = translated;
          voiceOverlay.style.display = 'block';
          clearTimeout(voiceOverlay._hideTimer);
          voiceOverlay._hideTimer = setTimeout(function() {
            if (voiceTranslationEnabled) voiceOverlay.style.display = 'none';
          }, 5200);
        });

`;
  source = source.replace(voiceButtonAnchor, voiceButtonAnchor + "\n" + voicePatch);

  fs.writeFileSync(file, source);
  console.log('Applied in-video subtitle selection and voice translation to app/(tabs)/index.tsx');
  process.exit(0);
}

