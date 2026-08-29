# UC Mini-style player optimization

Development plan for the in-page video player.

## Phase 5 performance targets
- Throttle media discovery and stop observers when no media is active.
- Keep only the active media candidate selected for player actions.
- Persist navigation/video state sparingly to reduce storage writes.
- Prefer inline playback and avoid unnecessary WebView reloads.
- Avoid aggressive ad-page interception that can break legitimate media.
- Do not bypass DRM or protected media.
- Keep download actions tied to the currently playing media source.

## Player behavior targets
- Inline playback in the current page.
- Gesture seek and double-tap seek.
- Playback speed controls.
- Full-screen transition with state restoration.
- Current-position persistence.
- Real-file download when the media source is directly downloadable.
