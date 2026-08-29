const fs = require('fs');
const path = require('path');

const file = path.join(path.resolve(__dirname, '..'), 'app', '(tabs)', 'index.tsx');
if (!fs.existsSync(file)) throw new Error(`Browser source not found: ${file}`);
let source = fs.readFileSync(file, 'utf8');
if (source.includes('data-miniwave-last-url-v1')) {
  console.log('Last URL persistence already applied.');
  process.exit(0);
}

// Persist the last non-private navigation without storing passwords or page contents.
const storageAnchor = "  settings: '@miniwave/settings',";
if (!source.includes(storageAnchor)) throw new Error('STORAGE settings anchor not found; refusing partial patch.');
source = source.replace(storageAnchor, `${storageAnchor}\n  lastUrl: '@miniwave/last-url',`);

// Restore the last URL after the app's normal state has hydrated.
const returnAnchor = /\n\s*return \(/;
const restoreEffect = `\n\n  // data-miniwave-last-url-v1\n  useEffect(() => {\n    if (!hydrated) return;\n    let cancelled = false;\n    (async () => {\n      try {\n        const raw = await AsyncStorage.getItem(STORAGE.lastUrl);\n        if (!raw || cancelled) return;\n        const saved = JSON.parse(raw);\n        if (!saved?.url || !/^https?:\\/\\//i.test(saved.url)) return;\n        setTabs((current) => {\n          if (!current.length) return current;\n          const first = current[0];\n          if (first.url === saved.url) return current;\n          return [{ ...first, url: saved.url, title: saved.title || saved.url, canGoBack: false, canGoForward: false, loading: true }, ...current.slice(1)];\n        });\n        setAddress(saved.url);\n      } catch {}\n    })();\n    return () => { cancelled = true; };\n  }, [hydrated]);\n`;
if (!returnAnchor.test(source)) throw new Error('Component return anchor not found; refusing partial patch.');
source = source.replace(returnAnchor, restoreEffect + '\n  return (');

// Add navigation persistence to the WebView unless it already has our marker.
const webViewTag = /<WebView\b/;
const match = source.match(webViewTag);
if (!match) throw new Error('WebView component not found; refusing partial patch.');
const insertion = `\n          // data-miniwave-last-url-v1\n          onNavigationStateChange={(nav) => {\n            if (nav?.url && /^https?:\\/\\//i.test(nav.url) && !activeTab?.private) {\n              AsyncStorage.setItem(STORAGE.lastUrl, JSON.stringify({ url: nav.url, title: nav.title || nav.url })).catch(() => {});\n            }\n          }}`;
// Put the prop immediately after the opening WebView tag. Existing props remain intact.
source = source.replace(webViewTag, `<WebView${insertion}`);

fs.writeFileSync(file, source);
console.log('Applied last URL save/restore behavior.');
