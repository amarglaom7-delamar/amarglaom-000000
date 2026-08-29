const fs = require('fs');
const path = require('path');

const file = path.join(path.resolve(__dirname, '..'), 'app', '(tabs)', 'index.tsx');
if (!fs.existsSync(file)) throw new Error(`Browser source not found: ${file}`);
let source = fs.readFileSync(file, 'utf8');
if (source.includes('MINIWAVE_RESUME_URL_V1')) {
  console.log('Resume URL patch already applied.');
  process.exit(0);
}

const storageAnchor = "const STORAGE = {";
if (!source.includes(storageAnchor)) throw new Error('STORAGE anchor not found.');
source = source.replace(storageAnchor, `// MINIWAVE_RESUME_URL_V1\nconst RESUME_URL_STORAGE_KEY = '@miniwave/last-url';\n\n${storageAnchor}`);

const componentAnchor = "  const rtl = settings.language === 'ar';";
if (!source.includes(componentAnchor)) throw new Error('Component state anchor not found.');
source = source.replace(componentAnchor, `${componentAnchor}\n\n  // Restore the last normal browsing URL after the app is reopened.\n  useEffect(() => {\n    let cancelled = false;\n    AsyncStorage.getItem(RESUME_URL_STORAGE_KEY).then((saved) => {\n      if (cancelled || !saved || !/^https?:\\/\\//i.test(saved)) return;\n      setTabs((current) => {\n        if (!current.length) return current;\n        const first = current[0];\n        return [{ ...first, url: saved, title: saved }, ...current.slice(1)];\n      });\n      setAddress(saved);\n      setWebKeys((current) => ({ ...current, [tabs[0]?.id ?? '']: Date.now() }));\n    }).catch(() => undefined);\n    return () => { cancelled = true; };\n  }, []);\n\n  const rememberUrl = useCallback((url: string, isPrivate = false) => {\n    if (isPrivate || !/^https?:\\/\\//i.test(url)) return;\n    AsyncStorage.setItem(RESUME_URL_STORAGE_KEY, url).catch(() => undefined);\n  }, []);`);

const navHandlerAnchor = "  const rtl = settings.language === 'ar';";
const navHandler = `\n  const handleResumeNavigation = useCallback((navigation: WebViewNavigation) => {\n    const url = navigation.url;\n    if (!url || !activeTabId) return;\n    setAddress(url);\n    setTabs((current) => current.map((tab) => tab.id === activeTabId ? { ...tab, url, title: navigation.title || tab.title, canGoBack: navigation.canGoBack, canGoForward: navigation.canGoForward, loading: navigation.loading } : tab));\n    rememberUrl(url, Boolean(activeTab?.private));\n  }, [activeTabId, activeTab?.private, rememberUrl]);\n`;
source = source.replace(navHandlerAnchor, navHandlerAnchor + navHandler);

const webViewPattern = /(<WebView\\b[^>]*?)(\\s*\/?>)/g;
let count = 0;
source = source.replace(webViewPattern, (full, open, close) => {
  if (open.includes('onNavigationStateChange=')) return full;
  count += 1;
  return `${open}\n        onNavigationStateChange={handleResumeNavigation}${close}`;
});
if (!count) throw new Error('No WebView component found; refusing partial patch.');

fs.writeFileSync(file, source);
console.log(`Applied resume URL support to ${count} WebView instance(s).`);
