import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView, { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { useColors } from '@/hooks/useColors';
import audioTranslationModule, { audioTranslationEvents } from '@/modules/audio-translation/src/AudioTranslationModule';
import themeColors from '@/constants/colors';

type ThemeMode = 'auto' | 'light' | 'dark';
type Language = 'ar' | 'en';
type SearchEngine = 'google' | 'bing' | 'duckduckgo';
type LibraryTab = 'history' | 'bookmarks' | 'downloads';
type BrowserTab = {
  id: string;
  url: string;
  title: string;
  private: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
};
type HistoryEntry = { id: string; title: string; url: string; visitedAt: number; private?: boolean };
type Bookmark = { id: string; title: string; url: string; createdAt: number };
type DownloadEntry = {
  id: string;
  url: string;
  name: string;
  progress: number;
  status: 'queued' | 'downloading' | 'paused' | 'done' | 'failed';
  resumeData?: string;
  localUri?: string;
  error?: string;
};
type Settings = {
  theme: ThemeMode;
  language: Language;
  searchEngine: SearchEngine;
  privateDefault: boolean;
  dataSaver: boolean;
  blockTrackers: boolean;
  notifications: boolean;
};
type MediaCandidate = { url: string; label: string; isPlaying?: boolean };

const DEFAULT_SEARCH_ENGINE: SearchEngine = 'google';
const HOME_URL = 'https://www.google.com/';
const SEARCH_ENGINE_OPTIONS: Array<{ id: SearchEngine; label: string }> = [
  { id: 'google', label: 'Google' },
  { id: 'bing', label: 'Bing' },
  { id: 'duckduckgo', label: 'DuckDuckGo' },
];
const SEARCH_URLS: Record<SearchEngine, string> = {
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
};
const STORAGE = {
  history: '@miniwave/history',
  bookmarks: '@miniwave/bookmarks',
  downloads: '@miniwave/downloads',
  settings: '@miniwave/settings',
};

const defaultSettings: Settings = {
  theme: 'auto',
  language: 'ar',
  searchEngine: DEFAULT_SEARCH_ENGINE,
  privateDefault: false,
  dataSaver: false,
  blockTrackers: false,
  notifications: false,
};

const knownTrackers = [
  'doubleclick.net',
  'googlesyndication.com',
  'google-analytics.com',
  'connect.facebook.net',
  'adnxs.com',
  'adsrvr.org',
  'scorecardresearch.com',
  'hotjar.com',
];

const t = {
  ar: {
    home: 'الرئيسية',
    search: 'ابحث أو اكتب عنوان موقع',
    searchEngine: 'محرك البحث',
    tabs: 'التبويبات',
    history: 'السجل',
    bookmarks: 'المفضلة',
    downloads: 'التنزيلات',
    settings: 'الإعدادات',
    private: 'خاص',
    newTab: 'تبويب جديد',
    privateTab: 'تبويب خاص',
    close: 'إغلاق',
    noHistory: 'لا يوجد سجل تصفح',
    noBookmarks: 'لا توجد مفضلة بعد',
    noDownloads: 'لا توجد تنزيلات',
    clear: 'مسح الكل',
    addBookmark: 'إضافة للمفضلة',
    removeBookmark: 'إزالة من المفضلة',
    share: 'مشاركة',
    qr: 'ماسح QR',
    scanQr: 'وجّه الكاميرا إلى رمز QR',
    cameraPermission: 'اسمح باستخدام الكاميرا لمسح رموز QR',
    allowCamera: 'السماح بالكاميرا',
    invalidUrl: 'اكتب رابطًا صحيحًا أو كلمة بحث.',
    download: 'تنزيل',
    downloadVideo: 'تنزيل الوسائط',
    downloadStarted: 'بدأ التنزيل',
    downloadDone: 'اكتمل التنزيل',
    downloadFailed: 'فشل التنزيل',
    downloadPaused: 'تم إيقاف التنزيل مؤقتًا',
    downloadResumed: 'استؤنف التنزيل',
    chooseQuality: 'اختر الجودة',
    fileUpload: 'رفع الملفات مدعوم عبر المواقع التي توفر زر اختيار ملف.',
    appearance: 'المظهر',
    language: 'اللغة',
    auto: 'تلقائي',
    light: 'فاتح',
    dark: 'داكن',
    dataSaver: 'توفير البيانات',
    dataSaverDetail: 'تقليل الصور والتشغيل التلقائي',
    adBlock: 'حظر الإعلانات والتتبع',
    adBlockDetail: 'حظر نطاقات التتبع المعروفة',
    notification: 'إشعارات التنزيل',
    notificationDetail: 'إشعار محلي عند اكتمال الملف',
    privateDefault: 'فتح التبويبات الجديدة كخاصة',
    privateDetail: 'لا تحفظ السجل أو المفضلة في التصفح الخاص',
    about: 'حول عمار جلعوم',
    reset: 'إعادة ضبط البيانات',
    resetDetail: 'حذف السجل والمفضلة والتنزيلات',
    cancel: 'إلغاء',
    delete: 'حذف',
    open: 'فتح',
    copied: 'تمت إضافة الرابط',
    errorPage: 'تعذر فتح الصفحة',
    retry: 'إعادة المحاولة',
    loading: 'جارٍ التحميل',
    offline: 'تحقق من اتصال الإنترنت أو VPN الخارجي.',
    noMedia: 'لم يتم العثور على ملف وسائط قابل للتنزيل.',
    hlsNotice: 'تم اكتشاف بث HLS؛ تنزيله كملف MP4 يحتاج محوّل فيديو أصليًا.',
    drmNotice: 'لا يمكن تنزيل هذا المحتوى لأنه محمي أو يتطلب DRM.',
    downloadManager: 'مدير التنزيلات',
    clearHistoryConfirm: 'هل تريد حذف سجل التصفح؟',
  },
  en: {
    home: 'Home',
    search: 'Search or enter website',
    searchEngine: 'Search engine',
    tabs: 'Tabs',
    history: 'History',
    bookmarks: 'Bookmarks',
    downloads: 'Downloads',
    settings: 'Settings',
    private: 'Private',
    newTab: 'New tab',
    privateTab: 'Private tab',
    close: 'Close',
    noHistory: 'No browsing history',
    noBookmarks: 'No bookmarks yet',
    noDownloads: 'No downloads',
    clear: 'Clear all',
    addBookmark: 'Add bookmark',
    removeBookmark: 'Remove bookmark',
    share: 'Share',
    qr: 'QR scanner',
    scanQr: 'Point the camera at a QR code',
    cameraPermission: 'Allow camera access to scan QR codes',
    allowCamera: 'Allow camera',
    invalidUrl: 'Enter a valid URL or search term.',
    download: 'Download',
    downloadVideo: 'Download media',
    downloadStarted: 'Download started',
    downloadDone: 'Download complete',
    downloadFailed: 'Download failed',
    downloadPaused: 'Download paused',
    downloadResumed: 'Download resumed',
    chooseQuality: 'Choose quality',
    fileUpload: 'File uploads work on sites that provide a file picker.',
    appearance: 'Appearance',
    language: 'Language',
    auto: 'Auto',
    light: 'Light',
    dark: 'Dark',
    dataSaver: 'Data saver',
    dataSaverDetail: 'Reduce images and autoplay',
    adBlock: 'Ad and tracker blocking',
    adBlockDetail: 'Block known tracking domains',
    notification: 'Download notifications',
    notificationDetail: 'Show a local notification when files finish',
    privateDefault: 'Open new tabs privately',
    privateDetail: 'Private tabs do not save history or bookmarks',
    about: 'About عمار جلعوم',
    reset: 'Reset data',
    resetDetail: 'Delete history, bookmarks, and downloads',
    cancel: 'Cancel',
    delete: 'Delete',
    open: 'Open',
    copied: 'Link added',
    errorPage: 'Could not load this page',
    retry: 'Retry',
    loading: 'Loading',
    offline: 'Check your internet connection or external VPN.',
    noMedia: 'No downloadable media was detected.',
    hlsNotice: 'HLS streaming was detected; saving it as MP4 requires a native video remuxer.',
    drmNotice: 'This content is protected or requires DRM and cannot be downloaded.',
    downloadManager: 'Download manager',
    clearHistoryConfirm: 'Delete browsing history?',
  },
} as const;

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSearchUrl(query: string, searchEngine: SearchEngine) {
  return `${SEARCH_URLS[searchEngine]}${encodeURIComponent(query.trim())}`;
}

function normalizeInput(input: string, searchEngine: SearchEngine = DEFAULT_SEARCH_ENGINE) {
  const value = input.trim();
  if (!value) return '';
  if (/^(https?|file|about):\/\//i.test(value)) return value;
  if (/^(localhost|127(?:\.\d{1,3}){3})(:\d{1,5})?(\/.*)?$/i.test(value)) return `http://${value}`;
  if (/^(?:www\.)?[\w-]+(?:\.[\w-]+)+(?::\d{1,5})?(?:\/.*)?$/i.test(value)) return `https://${value}`;
  return buildSearchUrl(value, searchEngine);
}

function getSearchEngineLabel(searchEngine: SearchEngine) {
  return SEARCH_ENGINE_OPTIONS.find((option) => option.id === searchEngine)?.label ?? 'Google';
}

function fileNameFromUrl(url: string) {
  try {
    const path = new URL(url).pathname.split('/').filter(Boolean).pop();
    return (path && decodeURIComponent(path).replace(/[^\w.-]+/g, '_')) || `miniwave-${Date.now()}.bin`;
  } catch {
    return `miniwave-${Date.now()}.bin`;
  }
}

function isBlockedHost(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return knownTrackers.some((tracker) => host === tracker || host.endsWith(`.${tracker}`));
  } catch {
    return false;
  }
}

function IconButton({
  name,
  color,
  label,
  onPress,
  disabled = false,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Ionicons name={name} size={21} color={color} />
    </Pressable>
  );
}

function formatPlayerTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '00:00';
  const total = Math.floor(value);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return [h, m, s].map((part) => String(part).padStart(2, '0')).join(':');
  return [m, s].map((part) => String(part).padStart(2, '0')).join(':');
}

function InternalVideoPlayer({
  candidate,
  sources,
  insets,
  language,
  onClose,
  onDownload,
  onShare,
  onFavorite,
}: {
  candidate: MediaCandidate;
  sources: MediaCandidate[];
  insets: { top: number; bottom: number };
  language: Language;
  onClose: () => void;
  onDownload: (url: string, name?: string) => void;
  onShare: () => void;
  onFavorite: () => void;
  frameStyle?: any;
}) {
  const isHls = /\.m3u8(?:$|\?)/i.test(candidate.url);
  const source = useMemo(() => isHls ? { uri: candidate.url, contentType: 'hls' as const } : { uri: candidate.url, useCaching: true }, [candidate.url, isHls]);
  const player = useVideoPlayer(source, (instance) => {
    instance.timeUpdateEventInterval = 0.25;
    instance.play();
  });
  const { currentTime = 0 } = useEvent(player, 'timeUpdate', { currentTime: 0 });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status, error: null });
  const [showControls, setShowControls] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);
  const [muted, setMuted] = useState(false);
  const lastTapRef = useRef({ time: 0, x: 0 });
  const duration = Number.isFinite(player.duration) ? player.duration : 0;
  const sourceChoices = sources.length > 1 ? sources : [];
  const title = candidate.label || 'Video';

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      return;
    }
    const timer = setTimeout(() => setShowControls(false), 3200);
    return () => clearTimeout(timer);
  }, [isPlaying, currentTime]);

  const toggleControls = () => setShowControls((value) => !value);
  const togglePlay = () => (isPlaying ? player.pause() : player.play());
  const handlePlayerTap = (event: any) => {
    const now = Date.now();
    const x = Number(event.nativeEvent.locationX || 0);
    const previous = lastTapRef.current;
    if (now - previous.time < 280) {
      const delta = x - previous.x;
      player.seekBy(delta < 0 ? -10 : 10);
      setShowControls(true);
      lastTapRef.current = { time: 0, x: 0 };
      return;
    }
    lastTapRef.current = { time: now, x };
    toggleControls();
  };
  const handleLongPress = () => {
    setSpeed(2);
    player.playbackRate = 2;
    if (!isPlaying) player.play();
  };
  const releaseLongPress = () => {
    if (speed === 2) {
      setSpeed(1);
      player.playbackRate = 1;
    }
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    player.muted = next;
  };
  const changeSpeed = () => {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    player.playbackRate = next;
  };
  const seekFromProgress = (event: any) => {
    if (!duration || !progressWidth) return;
    const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / progressWidth));
    player.currentTime = duration * ratio;
  };

  const chooseSource = (index: number) => {
    const next = sourceChoices[index];
    if (!next || next.url === candidate.url) return;
    setSourceIndex(index);
    player.replace({ uri: next.url, contentType: /\.m3u8(?:$|\?)/i.test(next.url) ? 'hls' : 'auto' });
    player.play();
  };

  return (
    <View style={[styles.internalPlayerScreen, styles.internalPlayerInline, frameStyle]}>
      <StatusBar style="light" hidden={false} />
        <Pressable style={styles.internalPlayerVideoArea} onPress={handlePlayerTap} onLongPress={handleLongPress} onPressOut={releaseLongPress}>
          <VideoView player={player} style={styles.internalPlayerVideo} nativeControls={false} contentFit="contain" allowsFullscreen allowsPictureInPicture />
          {status === 'loading' ? <View style={styles.internalPlayerLoading}><ActivityIndicator size="large" color="#ffffff" /></View> : null}
          {status === 'error' ? <View style={styles.internalPlayerError}><Ionicons name="alert-circle-outline" size={46} color="#ffffff" /><Text style={styles.internalPlayerErrorText}>{language === 'ar' ? 'تعذر تشغيل هذا الفيديو داخل المشغل' : 'This video could not be played in the internal player'}</Text></View> : null}
          {showControls ? (
            <View pointerEvents="box-none" style={[styles.internalPlayerOverlay, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
              <View style={styles.internalPlayerTopBar}>
                <Pressable onPress={onClose} hitSlop={10} style={styles.internalPlayerTopButton}><Ionicons name="arrow-back" size={24} color="#ffffff" /></Pressable>
                <Text numberOfLines={1} style={styles.internalPlayerTitle}>{title}</Text>
                <Pressable onPress={onShare} hitSlop={10} style={styles.internalPlayerTopButton}><Ionicons name="share-outline" size={22} color="#ffffff" /></Pressable>
              </View>
              <View style={styles.internalPlayerBottom}>
                <Pressable onPress={seekFromProgress} onLayout={(event) => setProgressWidth(event.nativeEvent.layout.width)} style={styles.internalPlayerProgressTrack}>
                  <View style={[styles.internalPlayerProgressFill, { width: duration ? ((currentTime / duration) * 100) + '%' : '0%' }]} />
                </View>
                <View style={styles.internalPlayerControlsRow}>
                  <Pressable onPress={() => player.seekBy(-10)} style={styles.internalPlayerControl}><Ionicons name="play-back" size={21} color="#ffffff" /></Pressable>
                  <Pressable onPress={togglePlay} style={styles.internalPlayerPlay}><Ionicons name={isPlaying ? 'pause' : 'play'} size={25} color="#000000" /></Pressable>
                  <Pressable onPress={() => player.seekBy(10)} style={styles.internalPlayerControl}><Ionicons name="play-forward" size={21} color="#ffffff" /></Pressable>
                  <Text style={styles.internalPlayerTime}>{formatPlayerTime(currentTime)} / {formatPlayerTime(duration)}</Text>
                  <Pressable onPress={changeSpeed} style={styles.internalPlayerSpeed}><Text style={styles.internalPlayerSpeedText}>{speed}x</Text></Pressable>
                  <Pressable onPress={toggleMute} style={styles.internalPlayerControl}><Ionicons name={muted ? 'volume-mute-outline' : 'volume-high-outline'} size={21} color="#ffffff" /></Pressable>
                  <Pressable onPress={() => onDownload(candidate.url, 'video-' + Date.now())} style={styles.internalPlayerControl}><Ionicons name="download-outline" size={22} color="#ffffff" /></Pressable>
                  <Pressable onPress={onFavorite} style={styles.internalPlayerControl}><Ionicons name="star-outline" size={21} color="#ffffff" /></Pressable>
                  <Pressable onPress={() => void player.startPictureInPicture()} style={styles.internalPlayerControl}><Ionicons name="albums-outline" size={21} color="#ffffff" /></Pressable>
                  <Pressable onPress={() => void player.enterFullscreen()} style={styles.internalPlayerControl}><Ionicons name="expand-outline" size={21} color="#ffffff" /></Pressable>
                </View>
                {sourceChoices.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.internalPlayerSources}>{sourceChoices.map((item, index) => <Pressable key={item.url} onPress={() => chooseSource(index)} style={[styles.internalPlayerSourceChip, sourceIndex === index && styles.internalPlayerSourceChipActive]}><Text style={styles.internalPlayerSourceText}>{item.label || (index + 1) + 'P'}</Text></Pressable>)}</ScrollView> : null}
              </View>
            </View>
          ) : null}
        </Pressable>
    </View>
  );
}

export default function MiniWaveBrowser() {
  const systemScheme = useColorScheme();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [hydrated, setHydrated] = useState(false);
  const [tabs, setTabs] = useState<BrowserTab[]>([
    { id: makeId('tab'), url: HOME_URL, title: 'Google', private: false, canGoBack: false, canGoForward: false, loading: true },
  ]);
  const [activeTabId, setActiveTabId] = useState('');
  const [address, setAddress] = useState(HOME_URL);
  const [editingAddress, setEditingAddress] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [downloads, setDownloads] = useState<DownloadEntry[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('history');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tabsOpen, setTabsOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [downloadOptions, setDownloadOptions] = useState<MediaCandidate[] | null>(null);
  const [mediaCandidates, setMediaCandidates] = useState<MediaCandidate[]>([]);
  const [mediaTabId, setMediaTabId] = useState('');
  const [internalPlayer, setInternalPlayer] = useState<MediaCandidate | null>(null);
  const [internalPlayerSources, setInternalPlayerSources] = useState<MediaCandidate[]>([]);
  const [internalPlayerFrame, setInternalPlayerFrame] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [webProgress, setWebProgress] = useState(0);
  const [webKeys, setWebKeys] = useState<Record<string, number>>({});
  const webRefs = useRef<Record<string, WebView | null>>({});
  const downloadsRef = useRef<Record<string, FileSystem.DownloadResumable>>({});
  const lang = t[settings.language];
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const isDark = settings.theme === 'dark' || (settings.theme === 'auto' && systemScheme === 'dark');
  const displayColors = isDark ? { ...themeColors.dark, radius: themeColors.radius } : { ...themeColors.light, radius: themeColors.radius };
  const rtl = settings.language === 'ar';

  const textAlign = rtl ? 'right' : 'left';
  const rowDirection = rtl ? 'row-reverse' : 'row';

  useEffect(() => {
    const initialId = tabs[0]?.id;
    if (!activeTabId && initialId) setActiveTabId(initialId);
  }, [activeTabId, tabs]);

  useEffect(() => {
    void Promise.all([
      AsyncStorage.getItem(STORAGE.history),
      AsyncStorage.getItem(STORAGE.bookmarks),
      AsyncStorage.getItem(STORAGE.downloads),
      AsyncStorage.getItem(STORAGE.settings),
    ]).then(([storedHistory, storedBookmarks, storedDownloads, storedSettings]) => {
      try {
        if (storedHistory) setHistory(JSON.parse(storedHistory) as HistoryEntry[]);
        if (storedBookmarks) setBookmarks(JSON.parse(storedBookmarks) as Bookmark[]);
        if (storedDownloads) setDownloads(JSON.parse(storedDownloads) as DownloadEntry[]);
        if (storedSettings) setSettings({ ...defaultSettings, ...(JSON.parse(storedSettings) as Partial<Settings>) });
      } catch {
        setNotice(lang.offline);
      } finally {
        setHydrated(true);
      }
    });
  }, [lang.offline]);

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.multiSet([
      [STORAGE.history, JSON.stringify(history.slice(0, 100))],
      [STORAGE.bookmarks, JSON.stringify(bookmarks)],
      [STORAGE.downloads, JSON.stringify(downloads.slice(0, 50))],
      [STORAGE.settings, JSON.stringify(settings)],
    ]);
  }, [bookmarks, downloads, history, hydrated, settings]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 2800);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    setMediaCandidates([]);
    setDownloadOptions(null);
    setMediaTabId(activeTabId);
    setInternalPlayer(null);
    setInternalPlayerSources([]);
    setInternalPlayerFrame(null);
  }, [activeTabId]);

  useEffect(() => {
    const handleHardwareBack = () => {
      if (internalPlayer) {
        setInternalPlayer(null);
        setInternalPlayerSources([]);
        return true;
      }
      if (downloadOptions) {
        setDownloadOptions(null);
        return true;
      }
      if (qrOpen) {
        setQrOpen(false);
        return true;
      }
      if (tabsOpen) {
        setTabsOpen(false);
        return true;
      }
      if (settingsOpen) {
        setSettingsOpen(false);
        return true;
      }
      if (libraryOpen) {
        setLibraryOpen(false);
        return true;
      }
      if (activeTab?.canGoBack) {
        webRefs.current[activeTab.id]?.goBack();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => subscription.remove();
  }, [activeTab, downloadOptions, internalPlayer, libraryOpen, qrOpen, settingsOpen, tabsOpen]);

  const setTab = useCallback((id: string, patch: Partial<BrowserTab>) => {
    setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)));
  }, []);

  const openUrl = useCallback((input: string, tabId = activeTabId) => {
    const url = normalizeInput(input, settings.searchEngine);
    if (!url) {
      setNotice(lang.invalidUrl);
      return;
    }
    Keyboard.dismiss();
    setError('');
    setMediaCandidates([]);
    setAddress(url);
    if (tabId) {
      setTab(tabId, { url, loading: true, canGoBack: false, canGoForward: false });
      setWebKeys((current) => ({ ...current, [tabId]: (current[tabId] ?? 0) + 1 }));
    }
  }, [activeTabId, lang.invalidUrl, setTab, settings.searchEngine]);

  const addHistory = useCallback((navigation: WebViewNavigation, privateTab: boolean) => {
    if (privateTab || !navigation.url || navigation.url.startsWith('about:blank')) return;
    setHistory((current) => [
      { id: makeId('history'), title: navigation.title || navigation.url, url: navigation.url, visitedAt: Date.now() },
      ...current.filter((item) => item.url !== navigation.url),
    ].slice(0, 100));
  }, []);

  const toggleBookmark = useCallback(() => {
    if (!activeTab?.url || activeTab.url === HOME_URL) return;
    if (activeTab.private) {
      setNotice(lang.privateDetail);
      return;
    }
    const existing = bookmarks.find((item) => item.url === activeTab.url);
    if (existing) {
      setBookmarks((current) => current.filter((item) => item.id !== existing.id));
      setNotice(lang.removeBookmark);
    } else {
      setBookmarks((current) => [...current, { id: makeId('bookmark'), title: activeTab.title || activeTab.url, url: activeTab.url, createdAt: Date.now() }]);
      setNotice(lang.addBookmark);
    }
  }, [activeTab, bookmarks, lang.addBookmark, lang.removeBookmark]);

  const createTab = useCallback((privateMode = settings.privateDefault) => {
    const tab: BrowserTab = {
      id: makeId('tab'),
      url: HOME_URL,
      title: privateMode ? lang.privateTab : lang.newTab,
      private: privateMode,
      canGoBack: false,
      canGoForward: false,
      loading: true,
    };
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    setAddress(HOME_URL);
    setTabsOpen(false);
  }, [lang.newTab, lang.privateTab, settings.privateDefault]);

  const closeTab = useCallback((id: string) => {
    setTabs((current) => {
      if (current.length === 1) {
        const replacement: BrowserTab = { id: makeId('tab'), url: HOME_URL, title: lang.newTab, private: false, canGoBack: false, canGoForward: false, loading: true };
        setActiveTabId(replacement.id);
        setAddress(HOME_URL);
        return [replacement];
      }
      const next = current.filter((tab) => tab.id !== id);
      if (id === activeTabId) {
        const nextActive = next[next.length - 1];
        setActiveTabId(nextActive.id);
        setAddress(nextActive.url);
      }
      return next;
    });
  }, [activeTabId, lang.newTab]);

  const notifyDownload = useCallback(async (title: string, body: string) => {
    if (!settings.notifications || Platform.OS === 'web') return;
    try {
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) {
        await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
      }
    } catch {
      // Notifications are optional and should never break downloads.
    }
  }, [settings.notifications]);

  const startDownload = useCallback(async (url: string, suggestedName?: string) => {
    if (!url || !/^https?:\/\//i.test(url)) {
      setNotice(lang.drmNotice);
      return;
    }
    if (/\.m3u8(?:$|\?)/i.test(url)) {
      setNotice(lang.hlsNotice);
      return;
    }
    const id = makeId('download');
    const name = (suggestedName || fileNameFromUrl(url)).replace(/[^\w.-]+/g, '_');
    const directory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
    const extensionMatch = name.match(/(\.[a-z0-9]{2,5})$/i);
    const extension = extensionMatch?.[1] ?? '.mp4';
    const nameWithoutExtension = extensionMatch ? name.slice(0, -extension.length) : name;
    const target = `${directory}${nameWithoutExtension || `miniwave-video-${id}`}-${Date.now()}${extension}`;
    const entry: DownloadEntry = { id, url, name, progress: 0, status: 'downloading' };
    setDownloads((current) => [entry, ...current]);
    setDownloadOptions(null);
    setNotice(lang.downloadStarted);
    try {
      const resumable = FileSystem.createDownloadResumable(
        url,
        target,
        {},
        (progress) => {
          const ratio = progress.totalBytesExpectedToWrite > 0 ? progress.totalBytesWritten / progress.totalBytesExpectedToWrite : 0;
          setDownloads((current) => current.map((item) => item.id === id ? { ...item, progress: Math.min(99, Math.round(ratio * 100)) } : item));
        },
      );
      downloadsRef.current[id] = resumable;
      const result = await resumable.downloadAsync();
      if (!result?.uri) {
        const snapshot = downloadsRef.current[id]?.savable?.();
        if (snapshot?.resumeData) {
          setDownloads((items) => items.map((item) => item.id === id ? { ...item, status: 'paused', resumeData: JSON.stringify(snapshot) } : item));
          return;
        }
        throw new Error('The video file was not saved');
      }
      const contentType = Object.entries(result.headers ?? {}).find(([key]) => key.toLowerCase() === 'content-type')?.[1] ?? '';
      if (result.status >= 400 || /text\/html|application\/json/i.test(contentType)) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
        throw new Error('The source returned a web page instead of a video file');
      }
      setDownloads((current) => current.map((item) => item.id === id ? { ...item, progress: 100, status: 'done', localUri: result?.uri } : item));
      setNotice(lang.downloadDone);
      await notifyDownload(lang.downloadDone, name);
    } catch (downloadError) {
      const message = downloadError instanceof Error ? downloadError.message : lang.downloadFailed;
      setDownloads((current) => current.map((item) => item.id === id ? { ...item, status: 'failed', error: message } : item));
      setNotice(lang.downloadFailed);
      await notifyDownload(lang.downloadFailed, name);
    } finally {
      setDownloads((items) => {
        const item = items.find((entry) => entry.id === id);
        if (item?.status !== 'paused') delete downloadsRef.current[id];
        return items;
      });
    }
  }, [lang.downloadDone, lang.downloadFailed, lang.downloadStarted, lang.hlsNotice, notifyDownload]);

  const pauseDownload = useCallback(async (id: string) => {
    const task = downloadsRef.current[id];
    if (!task) return;
    try {
      const snapshot = await task.pauseAsync();
      setDownloads((items) => items.map((item) => item.id === id ? { ...item, status: 'paused', resumeData: JSON.stringify(snapshot) } : item));
      setNotice(lang.downloadPaused);
    } catch {
      setNotice(lang.downloadFailed);
    }
  }, [lang.downloadFailed, lang.downloadPaused]);

  const resumeDownload = useCallback(async (id: string) => {
    const task = downloadsRef.current[id];
    if (!task) return;
    setDownloads((items) => items.map((item) => item.id === id ? { ...item, status: 'downloading' } : item));
    setNotice(lang.downloadResumed);
    try {
      const result = await task.resumeAsync();
      if (!result?.uri) return;
      setDownloads((items) => items.map((item) => item.id === id ? { ...item, progress: 100, status: 'done', localUri: result.uri, resumeData: undefined } : item));
      const name = downloads.find((item) => item.id === id)?.name ?? 'video';
      await notifyDownload(lang.downloadDone, name);
      delete downloadsRef.current[id];
    } catch {
      setDownloads((items) => items.map((item) => item.id === id ? { ...item, status: 'failed', error: lang.downloadFailed } : item));
      setNotice(lang.downloadFailed);
    }
  }, [downloads, lang.downloadDone, lang.downloadFailed, lang.downloadResumed, notifyDownload]);

  useEffect(() => {
    if (!hydrated) return;
    downloads.filter((item) => item.status === 'paused' && item.resumeData && !downloadsRef.current[item.id]).forEach((item) => {
      try {
        const snapshot = JSON.parse(item.resumeData || '{}') as {
          url?: string;
          fileUri?: string;
          options?: Record<string, unknown>;
          resumeData?: string;
        };
        if (!snapshot.url || !snapshot.fileUri || !snapshot.resumeData) return;
        const task = FileSystem.createDownloadResumable(
          snapshot.url,
          snapshot.fileUri,
          snapshot.options || {},
          (progress) => {
            const ratio = progress.totalBytesExpectedToWrite > 0 ? progress.totalBytesWritten / progress.totalBytesExpectedToWrite : 0;
            setDownloads((items) => items.map((entry) => entry.id === item.id ? { ...entry, progress: Math.min(99, Math.round(ratio * 100)) } : entry));
          },
          snapshot.resumeData,
        );
        downloadsRef.current[item.id] = task;
      } catch {
        // Ignore invalid saved resume snapshots.
      }
    });
  }, [downloads, hydrated]);

  const onWebMessage = useCallback((event: WebViewMessageEvent, tabId: string) => {
    if (tabId !== activeTabId) return;
    try {
      const message = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        url?: string;
        title?: string;
        sources?: MediaCandidate[];
        rect?: { left: number; top: number; width: number; height: number };
      };
      if (message.type === 'videoRect' && message.rect && internalPlayer) {
        setInternalPlayerFrame({
          left: Math.max(0, Number(message.rect.left) || 0),
          top: Math.max(0, Number(message.rect.top) || 0),
          width: Math.max(120, Number(message.rect.width) || 0),
          height: Math.max(90, Number(message.rect.height) || 0),
        });
      }
      if (message.type === 'download' && message.url) void startDownload(message.url, message.title);
      if (message.type === 'share' && message.url) {
        void Share.share({ message: message.url, title: message.title });
      }
      if (message.type === 'favorite') {
        toggleBookmark();
      }
      if (message.type === 'back') {
        webRefs.current[tabId]?.goBack();
      }
      if (message.type === 'voiceTranslateStart') {
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
      if (message.type === 'media' || message.type === 'openPlayer') {
        const sources = (message.sources ?? [])
          .filter((item) => item.url && /^https?:\/\//i.test(item.url))
          .map((item) => ({ ...item, label: item.label || lang.downloadVideo }));
        if (message.url && /^https?:\/\//i.test(message.url)) sources.unshift({ url: message.url, label: lang.downloadVideo, isPlaying: true });
        const unique = sources.filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index).slice(0, 8);
        setMediaTabId(tabId);
        setMediaCandidates(unique);
        if (message.type === 'openPlayer' && unique[0] && message.rect) {
          setInternalPlayer(unique[0]);
          setInternalPlayerSources(unique);
          setInternalPlayerFrame({
            left: Math.max(0, Number(message.rect.left) || 0),
            top: Math.max(0, Number(message.rect.top) || 0),
            width: Math.max(120, Number(message.rect.width) || 0),
            height: Math.max(90, Number(message.rect.height) || 0),
          });
        }
      }
    } catch {
      // Ignore messages from pages that are not JSON.
    }
  }, [activeTabId, internalPlayer, lang.downloadVideo, startDownload, toggleBookmark]);

  useEffect(() => {
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
          const js = `window.dispatchEvent(new CustomEvent('miniwave-audio-translation',{detail:${JSON.stringify(translated)}})); true;`;
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

  const injectedJavaScript = useMemo(() => `
    (function() {
      var __miniwaveInternalVideo = null;
      var dataSaver = ${settings.dataSaver ? 'true' : 'false'};
      var script = document.createElement('style');
      script.innerHTML = dataSaver ? 'img, picture, video, iframe[src*="ads"] { opacity: .88; }' : '';
      document.documentElement.appendChild(script);
      function send(type, payload) { try { window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({type:type}, payload || {}))); } catch(e) {} }
      function isHlsUrl(url) {
        return !!url && /^https?:\\/\\//i.test(url) && /\\.m3u8(?:$|\\?)/i.test(url);
      }
      function usableMediaUrl(url) {
        return !!url && /^https?:\\/\\//i.test(url);
      }
      function mediaUrl(mediaElement) {
        var source = mediaElement.querySelector('source');
        return mediaElement.currentSrc || mediaElement.src || (source && source.src) || '';
      }
      function formatTime(value) {
        if (!isFinite(value) || value < 0) return '00:00';
        var totalSeconds = Math.floor(value);
        var hours = Math.floor(totalSeconds / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        var seconds = totalSeconds % 60;
        if (hours > 0) return [hours, minutes, seconds].map(function(part) { return String(part).padStart(2, '0'); }).join(':');
        return [minutes, seconds].map(function(part) { return String(part).padStart(2, '0'); }).join(':');
      }
      function addVideoControls(mediaElement) {
        if (!mediaElement || mediaElement.tagName !== 'VIDEO' || mediaElement.dataset.miniwaveControlsReady === '1') return;
        var parent = mediaElement.parentElement;
        if (!parent) return;
        mediaElement.dataset.miniwaveControlsReady = '1';

        var originalWidth = mediaElement.getBoundingClientRect().width;
        var parentWidth = parent.getBoundingClientRect().width;
        var shell = document.createElement('div');
        shell.setAttribute('data-miniwave-video-shell', '1');
        shell.style.cssText = [
          'position:relative',
          'display:inline-block',
          'vertical-align:top',
          'max-width:100%',
          'background:#000',
          'line-height:0',
          originalWidth > 0 && parentWidth > 0 && originalWidth < parentWidth * .86 ? 'width:' + originalWidth + 'px' : 'width:100%'
        ].join(';');
        parent.insertBefore(shell, mediaElement);
        shell.appendChild(mediaElement);
        mediaElement.style.display = 'block';
        mediaElement.style.width = '100%';
        mediaElement.style.maxWidth = '100%';

        var progress = document.createElement('div');
        progress.setAttribute('aria-label', 'Video progress');
        progress.style.cssText = [
          'height:3px',
          'width:100%',
          'background:rgba(255,255,255,.28)',
          'cursor:pointer',
          'opacity:0',
          'transition:opacity .18s ease'
        ].join(';');
        var progressFill = document.createElement('div');
        progressFill.style.cssText = 'height:100%;width:0;background:#fff;transition:width .1s linear;';
        progress.appendChild(progressFill);

        var controls = document.createElement('div');
        controls.setAttribute('role', 'toolbar');
        controls.setAttribute('aria-label', 'Video controls');
        controls.style.cssText = [
          'display:flex',
          'align-items:center',
          'gap:5px',
          'width:100%',
          'min-height:38px',
          'padding:4px 6px',
          'box-sizing:border-box',
          'background:#000',
          'color:#fff',
          'direction:ltr',
          'opacity:0',
          'max-height:0',
          'overflow:hidden',
          'pointer-events:none',
          'transition:opacity .18s ease,max-height .18s ease',
          'font:12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'
        ].join(';');

        var time = document.createElement('span');
        time.style.cssText = 'flex:1;min-width:54px;color:#fff;font-size:10px;line-height:24px;white-space:nowrap;text-align:left;';
        time.textContent = '00:00 / 00:00';
        controls.appendChild(time);

        function controlButton(label, icon) {
          var button = document.createElement('button');
          button.type = 'button';
          button.setAttribute('aria-label', label);
          button.setAttribute('title', label);
          button.textContent = icon;
          button.style.cssText = [
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'width:27px',
            'height:27px',
            'padding:0',
            'border:0',
            'background:transparent',
            'color:#fff',
            'font:18px/1 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
            'cursor:pointer',
            'opacity:.95',
            'touch-action:manipulation'
          ].join(';');
          button.addEventListener('touchstart', showControls, {passive:true});
          button.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            showControls();
          }, true);
          controls.appendChild(button);
          return button;
        }

        var playButton = controlButton('Play/Pause', '▶');
        var shareButton = controlButton('Share', '↗');
        var favoriteButton = controlButton('Favorite', '☆');
        var downloadButton = controlButton('Download', '↓');
        var backButton = controlButton('Back', '‹');
        var fullscreenButton = controlButton('Fullscreen', '⛶');
        var voiceTranslateButton = controlButton('ترجمة صوت الفيديو', '🎙');
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


        shell.appendChild(progress);
        shell.appendChild(controls);

        var hideTimer = null;
        function setControlsVisible(visible) {
          controls.style.opacity = visible ? '1' : '0';
          controls.style.maxHeight = visible ? '42px' : '0';
          controls.style.pointerEvents = visible ? 'auto' : 'none';
          progress.style.opacity = visible ? '1' : '0';
        }
        function showControls() {
          setControlsVisible(true);
          if (hideTimer) clearTimeout(hideTimer);
          if (!mediaElement.paused) {
            hideTimer = setTimeout(function() { setControlsVisible(false); }, 3200);
          }
        }
        function updateProgress() {
          var duration = mediaElement.duration;
          var ratio = duration > 0 && isFinite(duration) ? Math.min(1, Math.max(0, mediaElement.currentTime / duration)) : 0;
          progressFill.style.width = (ratio * 100) + '%';
          time.textContent = formatTime(mediaElement.currentTime) + ' / ' + formatTime(duration);
          playButton.textContent = mediaElement.paused ? '▶' : 'Ⅱ';
          downloadButton.style.opacity = usableMediaUrl(mediaUrl(mediaElement)) ? '.95' : '.35';
        }
        function seek(event) {
          var duration = mediaElement.duration;
          if (!duration || !isFinite(duration)) return;
          var rect = progress.getBoundingClientRect();
          var fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
          mediaElement.currentTime = duration * fraction;
          showControls();
        }

        playButton.addEventListener('click', function() {
          try {
            if (mediaElement.paused) mediaElement.play();
            else mediaElement.pause();
            showControls();
            updateProgress();
          } catch(e) {}
        }, true);
        shareButton.addEventListener('click', function() {
          send('share', {url: location.href, title: document.title});
        }, true);
        favoriteButton.addEventListener('click', function() {
          favoriteButton.textContent = favoriteButton.textContent === '★' ? '☆' : '★';
          send('favorite', {url: location.href, title: document.title});
        }, true);
        downloadButton.addEventListener('click', function() {
          var url = mediaUrl(mediaElement);
          if (usableMediaUrl(url)) send('download', {url:url, title: document.title || 'video-' + Date.now()});
        }, true);
        backButton.addEventListener('click', function() {
          send('back');
        }, true);
        fullscreenButton.addEventListener('click', function() {
          try {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else if (mediaElement.requestFullscreen) {
              mediaElement.requestFullscreen();
            } else if (mediaElement.webkitEnterFullscreen) {
              mediaElement.webkitEnterFullscreen();
            }
          } catch(e) {}
        }, true);
        progress.addEventListener('click', seek, true);
        controls.addEventListener('touchstart', showControls, {passive:true});
        function openInternalPlayer() {
          var url = mediaUrl(mediaElement);
          if (!usableMediaUrl(url)) return;
          var sourceList = [{url:url, label:isHlsUrl(url) ? 'HLS' : (mediaElement.videoWidth ? mediaElement.videoWidth + 'p' : 'Video'), isPlaying:true}];
          Array.prototype.slice.call(mediaElement.querySelectorAll('source')).forEach(function(source, index) {
            var sourceUrl = source.src;
            if (usableMediaUrl(sourceUrl)) sourceList.push({url:sourceUrl, label:isHlsUrl(sourceUrl) ? 'HLS' : (source.getAttribute('label') || source.getAttribute('size') || ('Source ' + (index + 1))), isPlaying:true});
          });
          sourceList = sourceList.filter(function(item, index, all) { return all.findIndex(function(candidate) { return candidate.url === item.url; }) === index; }).slice(0, 8);
          send('openPlayer', {url:url, title:document.title || 'Video', sources:sourceList});
        }
        mediaElement.addEventListener('click', function(event) {
          try {
            __miniwaveInternalVideo = mediaElement;
            __miniwaveInternalVideo = mediaElement;
            var rect = mediaElement.getBoundingClientRect();
            var url = mediaUrl(mediaElement);
            var sources = [];
            if (url) sources.push({url:url, label:'الفيديو', isPlaying:true});
            Array.prototype.slice.call(mediaElement.querySelectorAll('source')).forEach(function(source, index) {
              if (usableMediaUrl(source.src)) sources.push({url:source.src, label:source.getAttribute('label') || source.getAttribute('size') || ('جودة ' + (index + 1)), isPlaying:true});
            });
            var uniqueSources = sources.filter(function(item, index, all) {
              return all.findIndex(function(candidate) { return candidate.url === item.url; }) === index;
            });
            mediaElement.pause();
            send('openPlayer', {url:url, sources:uniqueSources, rect:{left:rect.left, top:rect.top, width:rect.width, height:rect.height}});
            if (event && event.preventDefault) event.preventDefault();
            if (event && event.stopPropagation) event.stopPropagation();
          } catch(e) {}
        }, true);
        mediaElement.addEventListener('touchstart', function() {
          try {
            var rect = mediaElement.getBoundingClientRect();
            var url = mediaUrl(mediaElement);
            var sources = url ? [{url:url, label:'الفيديو', isPlaying:true}] : [];
            send('openPlayer', {url:url, sources:sources, rect:{left:rect.left, top:rect.top, width:rect.width, height:rect.height}});
          } catch(e) {}
        }, {passive:true});
        ['timeupdate', 'loadedmetadata', 'loadeddata', 'durationchange', 'progress', 'canplay', 'emptied'].forEach(function(eventName) {
          mediaElement.addEventListener(eventName, updateProgress, true);
        });
        mediaElement.addEventListener('play', showControls, true);
        mediaElement.addEventListener('pause', function() { setControlsVisible(true); }, true);
        mediaElement.addEventListener('ended', function() { setControlsVisible(true); }, true);
        updateProgress();
      }
      function media() {
        var videos = Array.prototype.slice.call(document.querySelectorAll('video, audio'));
        var sources = [];
        videos.forEach(function(mediaElement) {
          addVideoControls(mediaElement);
          if (mediaElement.paused || mediaElement.ended) return;
          var url = mediaUrl(mediaElement);
          if (usableMediaUrl(url)) sources.push({url:url, label: isHlsUrl(url) ? 'HLS' : (mediaElement.videoWidth ? mediaElement.videoWidth + 'p' : (mediaElement.tagName === 'AUDIO' ? 'Audio' : 'Video')), isPlaying:true});
          Array.prototype.slice.call(mediaElement.querySelectorAll('source')).forEach(function(source, index) {
            var sourceUrl = source.src;
            if (usableMediaUrl(sourceUrl)) sources.push({url:sourceUrl, label: isHlsUrl(sourceUrl) ? 'HLS' : (source.getAttribute('label') || source.getAttribute('size') || ('Source ' + (index + 1))), isPlaying:true});
          });
        });
        var unique = sources.filter(function(item, index, all) {
          return all.findIndex(function(candidate) { return candidate.url === item.url; }) === index;
        });
        send('media', {sources:unique});
      }
      document.addEventListener('click', function(event) {
        var node = event.target && event.target.closest ? event.target.closest('a') : null;
        if (node && (node.download || /\\.(pdf|zip|apk|png|jpe?g|gif|webp|mp4|webm|mov|mp3|m4a|wav|docx?|xlsx?)($|\\?)/i.test(node.href || ''))) {
          event.preventDefault();
          event.stopPropagation();
          send('download', {url: node.href, title: node.download || node.textContent || ''});
        }
      }, true);
      ['loadedmetadata', 'loadeddata', 'canplay', 'play', 'durationchange', 'progress'].forEach(function(eventName) {
        document.addEventListener(eventName, media, true);
      });
      window.addEventListener('scroll', function() {
        try {
          var active = __miniwaveInternalVideo || document.querySelector('video[data-miniwave-controls-ready="1"]');
          if (!active) return;
          var rect = active.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) send('videoRect', {rect:{left:rect.left, top:rect.top, width:rect.width, height:rect.height}});
        } catch(e) {}
      }, {passive:true});
      var observer = new MutationObserver(media);
      observer.observe(document.documentElement || document, {childList:true, subtree:true, attributes:true, attributeFilter:['src']});
      media();
      setTimeout(media, 900);
      setTimeout(media, 2200);
      setInterval(media, 3500);
      true;
    })();
  `, [settings.dataSaver]);

  const activeBookmark = activeTab && !activeTab.private ? bookmarks.some((item) => item.url === activeTab.url) : false;

  const selectQrResult = useCallback((data: string) => {
    setQrOpen(false);
    if (data) openUrl(data);
  }, [openUrl]);

  const renderWebView = (tab: BrowserTab) => (
    <View key={`${tab.id}-${webKeys[tab.id] ?? 0}`} style={[styles.webLayer, tab.id !== activeTabId && styles.hiddenWebLayer]}>
      <WebView
        ref={(ref) => { webRefs.current[tab.id] = ref; }}
        source={{ uri: tab.url }}
        onLoadProgress={(event) => tab.id === activeTabId && setWebProgress(event.nativeEvent.progress)}
        onLoadStart={() => { if (tab.id === activeTabId) setError(''); setTab(tab.id, { loading: true }); }}
        onLoadEnd={() => setTab(tab.id, { loading: false })}
        onNavigationStateChange={(navigation) => {
          setTab(tab.id, { url: navigation.url, title: navigation.title || navigation.url, canGoBack: navigation.canGoBack, canGoForward: navigation.canGoForward, loading: false });
          if (tab.id === activeTabId) setAddress(navigation.url);
          addHistory(navigation, tab.private);
        }}
        onError={() => { if (tab.id === activeTabId) setError(lang.errorPage); setTab(tab.id, { loading: false }); }}
        onHttpError={() => { if (tab.id === activeTabId) setError(lang.errorPage); }}
        onMessage={(event) => onWebMessage(event, tab.id)}
        onFileDownload={(event) => void startDownload(event.nativeEvent.downloadUrl)}
        onShouldStartLoadWithRequest={(request) => {
          if (settings.blockTrackers && isBlockedHost(request.url)) return false;
          return true;
        }}
        injectedJavaScript={injectedJavaScript}
        javaScriptEnabled
        domStorageEnabled
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        originWhitelist={['http://*', 'https://*', 'file://*', 'about:blank']}
        startInLoadingState
        renderLoading={() => <View style={[styles.webLoading, { backgroundColor: displayColors.background }]}><ActivityIndicator color={displayColors.primary} /></View>}
        onRenderProcessGone={() => { if (tab.id === activeTabId) setError(lang.errorPage); }}
      />
    </View>
  );

  const openLibraryItem = (url: string) => {
    setLibraryOpen(false);
    openUrl(url);
  };

  const shareCurrent = async () => {
    if (!activeTab) return;
    await Share.share({ message: activeTab.url, title: activeTab.title });
  };

  const shareDownload = async (item: DownloadEntry) => {
    if (!item.localUri || !(await Sharing.isAvailableAsync())) return;
    await Sharing.shareAsync(item.localUri);
  };

  const requestNotifications = async (value: boolean) => {
    if (!value || Platform.OS === 'web') {
      setSettings((current) => ({ ...current, notifications: value }));
      return;
    }
    const result = await Notifications.requestPermissionsAsync();
    setSettings((current) => ({ ...current, notifications: value && result.granted }));
  };

  const resetData = () => {
    Alert.alert(lang.reset, lang.resetDetail, [
      { text: lang.cancel, style: 'cancel' },
      { text: lang.delete, style: 'destructive', onPress: () => { setHistory([]); setBookmarks([]); setDownloads([]); setNotice(lang.copied); } },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: displayColors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.browserChrome, { paddingTop: insets.top + 6, backgroundColor: displayColors.background }]}>
        <View style={[styles.brandLine, { flexDirection: rowDirection }]}>
          <View style={[styles.logoMark, { backgroundColor: displayColors.primary }]}><Ionicons name="pulse" size={19} color={displayColors.primaryForeground} /></View>
          <Text style={[styles.brandText, { color: displayColors.foreground }]}>عمار جلعوم</Text>
          <View style={styles.chromeSpacer} />
          <IconButton name="qr-code-outline" label={lang.qr} color={displayColors.primary} onPress={() => setQrOpen(true)} />
          <IconButton name="copy-outline" label={lang.newTab} color={displayColors.mutedForeground} onPress={() => createTab(false)} />
          <Pressable onPress={() => setTabsOpen(true)} style={({ pressed }) => [styles.tabCounter, pressed && styles.pressed, { backgroundColor: displayColors.secondary }]} accessibilityLabel={lang.tabs}>
            <Text style={[styles.tabCounterText, { color: displayColors.primary }]}>{tabs.length}</Text>
          </Pressable>
        </View>
        <View style={[styles.addressRow, { flexDirection: rowDirection }]}>
          <IconButton name={activeBookmark ? 'star' : 'star-outline'} label={activeBookmark ? lang.removeBookmark : lang.addBookmark} color={activeBookmark ? displayColors.accent : displayColors.mutedForeground} onPress={toggleBookmark} disabled={!activeTab || activeTab.url === HOME_URL} />
          <View style={[styles.addressShell, { backgroundColor: displayColors.card, borderColor: displayColors.border, flexDirection: rowDirection }]}>
            <Ionicons name={activeTab?.url.startsWith('https') ? 'lock-closed-outline' : 'globe-outline'} size={15} color={displayColors.primary} />
            <TextInput
              value={editingAddress ? address : (activeTab?.url ?? '')}
              onChangeText={setAddress}
              onFocus={() => setEditingAddress(true)}
              onBlur={() => setEditingAddress(false)}
              onSubmitEditing={(event) => openUrl(event.nativeEvent.text || address)}
              placeholder={lang.search}
              placeholderTextColor={displayColors.mutedForeground}
              style={[styles.addressInput, { color: displayColors.foreground, textAlign }]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              selectTextOnFocus
            />
            {activeTab?.loading && <ActivityIndicator size="small" color={displayColors.primary} />}
          </View>
          <IconButton name="ellipsis-horizontal" label={lang.settings} color={displayColors.mutedForeground} onPress={() => setSettingsOpen(true)} />
        </View>
        {activeTab?.loading && <View style={[styles.progressTrack, { backgroundColor: displayColors.secondary }]}><View style={[styles.progressFill, { backgroundColor: displayColors.accent, width: `${Math.max(4, webProgress * 100)}%` }]} /></View>}
      </View>

      <View style={styles.webArea}>
        {tabs.map(renderWebView)}
        {error ? (
          <View style={[styles.errorOverlay, { backgroundColor: displayColors.background }]}>
            <Ionicons name="cloud-offline-outline" size={48} color={displayColors.accent} />
            <Text style={[styles.errorTitle, { color: displayColors.foreground }]}>{lang.errorPage}</Text>
            <Text style={[styles.errorDetail, { color: displayColors.mutedForeground }]}>{lang.offline}</Text>
            <Pressable style={[styles.primaryButton, { backgroundColor: displayColors.primary }]} onPress={() => { setError(''); if (activeTab) setWebKeys((current) => ({ ...current, [activeTab.id]: (current[activeTab.id] ?? 0) + 1 })); }}>
              <Text style={[styles.primaryButtonText, { color: displayColors.primaryForeground }]}>{lang.retry}</Text>
            </Pressable>
          </View>
        ) : null}
        {mediaTabId === activeTabId && mediaCandidates.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel={lang.downloadVideo} onPress={() => void startDownload(mediaCandidates[0].url, `video-${Date.now()}${fileNameFromUrl(mediaCandidates[0].url).match(/(\.[a-z0-9]{2,5})$/i)?.[1] ?? '.mp4'}`)} style={[styles.mediaDownload, { backgroundColor: displayColors.accent }]}>
            <Ionicons name="download-outline" size={18} color={displayColors.accentForeground} />
            <Text style={[styles.mediaDownloadText, { color: displayColors.accentForeground }]}>{lang.downloadVideo}</Text>
          </Pressable>
        )}
      </View>

      {internalPlayer && internalPlayerFrame ? <InternalVideoPlayer candidate={internalPlayer} sources={internalPlayerSources} insets={{ top: 0, bottom: 0 }} language={settings.language} frameStyle={{ left: internalPlayerFrame.left, top: internalPlayerFrame.top, width: internalPlayerFrame.width, height: internalPlayerFrame.height }} onClose={() => { setInternalPlayer(null); setInternalPlayerSources([]); setInternalPlayerFrame(null); }} onDownload={(url, name) => void startDownload(url, name)} onShare={() => void Share.share({ message: internalPlayer.url, title: activeTab?.title || 'Video' })} onFavorite={toggleBookmark} /> : null}

      <View style={[styles.toolbar, { backgroundColor: displayColors.card, borderTopColor: displayColors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        <IconButton name="arrow-back" label={rtl ? 'السابق' : 'Back'} color={activeTab?.canGoBack ? displayColors.foreground : displayColors.border} onPress={() => activeTab && webRefs.current[activeTab.id]?.goBack()} disabled={!activeTab?.canGoBack} />
        <IconButton name="arrow-forward" label={rtl ? 'التالي' : 'Forward'} color={activeTab?.canGoForward ? displayColors.foreground : displayColors.border} onPress={() => activeTab && webRefs.current[activeTab.id]?.goForward()} disabled={!activeTab?.canGoForward} />
        <IconButton name="refresh" label={rtl ? 'تحديث' : 'Refresh'} color={displayColors.foreground} onPress={() => activeTab && webRefs.current[activeTab.id]?.reload()} />
        <IconButton name="share-outline" label={lang.share} color={displayColors.foreground} onPress={() => void shareCurrent()} />
        <IconButton name="book-outline" label={lang.bookmarks} color={displayColors.foreground} onPress={() => { setLibraryTab('bookmarks'); setLibraryOpen(true); }} />
        <IconButton name="download-outline" label={lang.downloads} color={displayColors.foreground} onPress={() => { setLibraryTab('downloads'); setLibraryOpen(true); }} />
      </View>

      {notice ? <View style={[styles.notice, { backgroundColor: displayColors.foreground }]}><Text style={[styles.noticeText, { color: displayColors.background }]}>{notice}</Text></View> : null}

      <Modal visible={tabsOpen} animationType="slide" transparent onRequestClose={() => setTabsOpen(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,.52)' }]}>
          <View style={[styles.sheet, { backgroundColor: displayColors.background, paddingBottom: insets.bottom + 12 }]}>
            <View style={[styles.sheetHeader, { flexDirection: rowDirection }]}><Text style={[styles.sheetTitle, { color: displayColors.foreground }]}>{lang.tabs} ({tabs.length})</Text><IconButton name="close" label={lang.close} color={displayColors.mutedForeground} onPress={() => setTabsOpen(false)} /></View>
            <View style={[styles.actionRow, { flexDirection: rowDirection }]}>
              <Pressable style={[styles.secondaryButton, { backgroundColor: displayColors.secondary }]} onPress={() => createTab(false)}><Ionicons name="add" size={18} color={displayColors.primary} /><Text style={[styles.secondaryButtonText, { color: displayColors.primary }]}>{lang.newTab}</Text></Pressable>
              <Pressable style={[styles.secondaryButton, { backgroundColor: displayColors.secondary }]} onPress={() => createTab(true)}><Ionicons name="eye-off-outline" size={18} color={displayColors.primary} /><Text style={[styles.secondaryButtonText, { color: displayColors.primary }]}>{lang.privateTab}</Text></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetList}>
              {tabs.map((tab) => (
                <Pressable key={tab.id} onPress={() => { setActiveTabId(tab.id); setAddress(tab.url); setTabsOpen(false); }} style={[styles.tabCard, { backgroundColor: displayColors.card, borderColor: tab.id === activeTabId ? displayColors.primary : displayColors.border, flexDirection: rowDirection }]}>
                  <View style={styles.tabCardCopy}><Text numberOfLines={1} style={[styles.tabCardTitle, { color: displayColors.foreground, textAlign }]}>{tab.private ? `${lang.private} · ` : ''}{tab.title}</Text><Text numberOfLines={1} style={[styles.tabCardUrl, { color: displayColors.mutedForeground, textAlign }]}>{tab.url}</Text></View>
                  <IconButton name="close-circle-outline" label={lang.close} color={displayColors.mutedForeground} onPress={() => closeTab(tab.id)} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={libraryOpen} animationType="slide" transparent onRequestClose={() => setLibraryOpen(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,.52)' }]}>
          <View style={[styles.sheet, { backgroundColor: displayColors.background, paddingBottom: insets.bottom + 12 }]}>
            <View style={[styles.sheetHeader, { flexDirection: rowDirection }]}><Text style={[styles.sheetTitle, { color: displayColors.foreground }]}>{libraryTab === 'history' ? lang.history : libraryTab === 'bookmarks' ? lang.bookmarks : lang.downloadManager}</Text><IconButton name="close" label={lang.close} color={displayColors.mutedForeground} onPress={() => setLibraryOpen(false)} /></View>
            <View style={[styles.segmented, { backgroundColor: displayColors.secondary, flexDirection: rowDirection }]}>
              {(['history', 'bookmarks', 'downloads'] as LibraryTab[]).map((value) => <Pressable key={value} onPress={() => setLibraryTab(value)} style={[styles.segment, libraryTab === value && { backgroundColor: displayColors.card }]}><Text style={[styles.segmentText, { color: libraryTab === value ? displayColors.primary : displayColors.mutedForeground }]}>{value === 'history' ? lang.history : value === 'bookmarks' ? lang.bookmarks : lang.downloads}</Text></Pressable>)}
            </View>
            {libraryTab === 'history' && <View style={styles.libraryActions}><Pressable onPress={() => Alert.alert(lang.history, lang.clearHistoryConfirm, [{ text: lang.cancel, style: 'cancel' }, { text: lang.delete, style: 'destructive', onPress: () => setHistory([]) }])}><Text style={[styles.clearText, { color: displayColors.accent }]}>{lang.clear}</Text></Pressable></View>}
            <ScrollView contentContainerStyle={styles.sheetList}>
              {libraryTab === 'history' && (history.length ? history.map((item) => <Pressable key={item.id} onPress={() => openLibraryItem(item.url)} style={[styles.libraryCard, { backgroundColor: displayColors.card, borderColor: displayColors.border, flexDirection: rowDirection }]}><Ionicons name="time-outline" size={21} color={displayColors.primary} /><View style={styles.tabCardCopy}><Text numberOfLines={1} style={[styles.tabCardTitle, { color: displayColors.foreground, textAlign }]}>{item.title}</Text><Text numberOfLines={1} style={[styles.tabCardUrl, { color: displayColors.mutedForeground, textAlign }]}>{item.url}</Text></View></Pressable>) : <Empty label={lang.noHistory} colors={displayColors} />)}
              {libraryTab === 'bookmarks' && (bookmarks.length ? bookmarks.map((item) => <Pressable key={item.id} onPress={() => openLibraryItem(item.url)} style={[styles.libraryCard, { backgroundColor: displayColors.card, borderColor: displayColors.border, flexDirection: rowDirection }]}><Ionicons name="star" size={21} color={displayColors.accent} /><View style={styles.tabCardCopy}><Text numberOfLines={1} style={[styles.tabCardTitle, { color: displayColors.foreground, textAlign }]}>{item.title}</Text><Text numberOfLines={1} style={[styles.tabCardUrl, { color: displayColors.mutedForeground, textAlign }]}>{item.url}</Text></View><IconButton name="trash-outline" label={lang.delete} color={displayColors.mutedForeground} onPress={() => setBookmarks((current) => current.filter((entry) => entry.id !== item.id))} /></Pressable>) : <Empty label={lang.noBookmarks} colors={displayColors} />)}
              {libraryTab === 'downloads' && (downloads.length ? downloads.map((item) => <View key={item.id} style={[styles.libraryCard, { backgroundColor: displayColors.card, borderColor: displayColors.border, flexDirection: rowDirection }]}><Ionicons name={item.status === 'done' ? 'checkmark-circle' : item.status === 'failed' ? 'alert-circle' : 'download-outline'} size={21} color={item.status === 'failed' ? displayColors.destructive : displayColors.primary} /><View style={styles.tabCardCopy}><Text numberOfLines={1} style={[styles.tabCardTitle, { color: displayColors.foreground, textAlign }]}>{item.name}</Text><Text style={[styles.tabCardUrl, { color: displayColors.mutedForeground, textAlign }]}>{item.status === 'done' ? `${lang.downloadDone} · 100%` : item.status === 'failed' ? lang.downloadFailed : `${item.progress}%`}</Text>{(item.status === 'downloading' || item.status === 'paused') && <View style={[styles.progressTrack, { backgroundColor: displayColors.secondary }]}><View style={[styles.progressFill, { width: `${item.progress}%`, backgroundColor: displayColors.primary }]} /></View>}</View>{item.status === 'downloading' && <IconButton name="pause-circle-outline" label={lang.downloadPaused} color={displayColors.primary} onPress={() => void pauseDownload(item.id)} />}{item.status === 'paused' && <IconButton name="play-circle-outline" label={lang.downloadResumed} color={displayColors.primary} onPress={() => void resumeDownload(item.id)} />}{item.status === 'done' && <IconButton name="share-outline" label={lang.share} color={displayColors.primary} onPress={() => void shareDownload(item)} />}<IconButton name="trash-outline" label={lang.delete} color={displayColors.mutedForeground} onPress={() => setDownloads((current) => current.filter((entry) => entry.id !== item.id))} /></View>) : <Empty label={lang.noDownloads} colors={displayColors} />)}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={settingsOpen} animationType="slide" transparent onRequestClose={() => setSettingsOpen(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,.52)' }]}>
          <View style={[styles.sheet, { backgroundColor: displayColors.background, paddingBottom: insets.bottom + 12 }]}>
            <View style={[styles.sheetHeader, { flexDirection: rowDirection }]}><Text style={[styles.sheetTitle, { color: displayColors.foreground }]}>{lang.settings}</Text><IconButton name="close" label={lang.close} color={displayColors.mutedForeground} onPress={() => setSettingsOpen(false)} /></View>
            <ScrollView contentContainerStyle={styles.settingsList}>
              <Text style={[styles.settingSection, { color: displayColors.primary, textAlign }]}>{lang.appearance}</Text>
              <SettingRow icon="contrast-outline" title={lang.appearance} detail={`${lang.auto} · ${lang.light} · ${lang.dark}`} colors={displayColors} trailing={<View style={[styles.modeRow, { flexDirection: rowDirection }]}>{(['auto', 'light', 'dark'] as ThemeMode[]).map((mode) => <Pressable key={mode} onPress={() => setSettings((current) => ({ ...current, theme: mode }))} style={[styles.modePill, settings.theme === mode && { backgroundColor: displayColors.primary }]}><Text style={[styles.modeText, { color: settings.theme === mode ? displayColors.primaryForeground : displayColors.mutedForeground }]}>{mode === 'auto' ? lang.auto : mode === 'light' ? lang.light : lang.dark}</Text></Pressable>)}</View>} />
              <SettingRow icon="language-outline" title={lang.language} detail={settings.language === 'ar' ? 'العربية' : 'English'} colors={displayColors} trailing={<Switch value={settings.language === 'en'} onValueChange={(value) => setSettings((current) => ({ ...current, language: value ? 'en' : 'ar' }))} trackColor={{ false: displayColors.secondary, true: displayColors.primary }} thumbColor={displayColors.card} />} />
               <SettingRow icon="search-outline" title={lang.searchEngine} detail={getSearchEngineLabel(settings.searchEngine)} colors={displayColors} trailing={<View style={[styles.modeRow, { flexDirection: rowDirection }]}>{SEARCH_ENGINE_OPTIONS.map((option) => <Pressable key={option.id} onPress={() => setSettings((current) => ({ ...current, searchEngine: option.id }))} style={[styles.modePill, settings.searchEngine === option.id && { backgroundColor: displayColors.primary }]}><Text style={[styles.modeText, { color: settings.searchEngine === option.id ? displayColors.primaryForeground : displayColors.mutedForeground }]}>{option.label}</Text></Pressable>)}</View>} />
              <Text style={[styles.settingSection, { color: displayColors.primary, textAlign }]}>{lang.settings}</Text>
              <SettingRow icon="speedometer-outline" title={lang.dataSaver} detail={lang.dataSaverDetail} colors={displayColors} trailing={<Switch value={settings.dataSaver} onValueChange={(value) => setSettings((current) => ({ ...current, dataSaver: value }))} trackColor={{ false: displayColors.secondary, true: displayColors.primary }} thumbColor={displayColors.card} />} />
              <SettingRow icon="shield-checkmark-outline" title={lang.adBlock} detail={lang.adBlockDetail} colors={displayColors} trailing={<Switch value={settings.blockTrackers} onValueChange={(value) => setSettings((current) => ({ ...current, blockTrackers: value }))} trackColor={{ false: displayColors.secondary, true: displayColors.primary }} thumbColor={displayColors.card} />} />
              <SettingRow icon="notifications-outline" title={lang.notification} detail={lang.notificationDetail} colors={displayColors} trailing={<Switch value={settings.notifications} onValueChange={(value) => void requestNotifications(value)} trackColor={{ false: displayColors.secondary, true: displayColors.primary }} thumbColor={displayColors.card} />} />
              <SettingRow icon="eye-off-outline" title={lang.privateDefault} detail={lang.privateDetail} colors={displayColors} trailing={<Switch value={settings.privateDefault} onValueChange={(value) => setSettings((current) => ({ ...current, privateDefault: value }))} trackColor={{ false: displayColors.secondary, true: displayColors.primary }} thumbColor={displayColors.card} />} />
              <Pressable onPress={resetData} style={[styles.resetRow, { borderColor: displayColors.border, backgroundColor: displayColors.card, flexDirection: rowDirection }]}><Ionicons name="trash-bin-outline" size={22} color={displayColors.destructive} /><View style={styles.tabCardCopy}><Text style={[styles.tabCardTitle, { color: displayColors.destructive, textAlign }]}>{lang.reset}</Text><Text style={[styles.tabCardUrl, { color: displayColors.mutedForeground, textAlign }]}>{lang.resetDetail}</Text></View></Pressable>
              <View style={[styles.aboutBox, { backgroundColor: displayColors.primary }]}><Text style={[styles.aboutName, { color: displayColors.primaryForeground }]}>عمار جلعوم</Text><Text style={[styles.aboutDetail, { color: displayColors.primaryForeground }]}>متصفح عمار جلعوم · {lang.fileUpload}</Text><Text style={[styles.aboutVersion, { color: displayColors.primaryForeground }]}>v1.0 · Android browser</Text></View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={qrOpen} animationType="slide" onRequestClose={() => setQrOpen(false)}>
        <View style={[styles.qrScreen, { backgroundColor: displayColors.background, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.sheetHeader, { flexDirection: rowDirection }]}><Text style={[styles.sheetTitle, { color: displayColors.foreground }]}>{lang.qr}</Text><IconButton name="close" label={lang.close} color={displayColors.mutedForeground} onPress={() => setQrOpen(false)} /></View>
          {!permission?.granted ? <View style={styles.permissionBox}><Ionicons name="camera-outline" size={54} color={displayColors.primary} /><Text style={[styles.errorTitle, { color: displayColors.foreground }]}>{lang.cameraPermission}</Text><Pressable onPress={() => void requestPermission()} style={[styles.primaryButton, { backgroundColor: displayColors.primary }]}><Text style={[styles.primaryButtonText, { color: displayColors.primaryForeground }]}>{lang.allowCamera}</Text></Pressable></View> : <View style={styles.cameraFrame}><CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={(result) => selectQrResult(result.data)} /><View style={styles.scanGuide}><View style={styles.scanCorner} /><Text style={styles.scanText}>{lang.scanQr}</Text></View></View>}
        </View>
      </Modal>

      <Modal visible={!!downloadOptions} transparent animationType="fade" onRequestClose={() => setDownloadOptions(null)}>
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,.52)' }]}>
          <View style={[styles.qualityCard, { backgroundColor: displayColors.background }]}>
            <Text style={[styles.sheetTitle, { color: displayColors.foreground, textAlign }]}>{lang.chooseQuality}</Text>
            {(downloadOptions ?? []).map((candidate, index) => <Pressable key={`${candidate.url}-${index}`} onPress={() => void startDownload(candidate.url, `${candidate.label}-${fileNameFromUrl(candidate.url)}`)} style={[styles.qualityRow, { borderColor: displayColors.border, flexDirection: rowDirection }]}><Ionicons name="download-outline" size={20} color={displayColors.primary} /><Text style={[styles.tabCardTitle, { color: displayColors.foreground, textAlign }]}>{candidate.label}</Text></Pressable>)}
            <Pressable onPress={() => setDownloadOptions(null)} style={[styles.secondaryButton, { backgroundColor: displayColors.secondary }]}><Text style={[styles.secondaryButtonText, { color: displayColors.primary }]}>{lang.cancel}</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Empty({ label, colors }: { label: string; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.empty}><Ionicons name="file-tray-outline" size={42} color={colors.primary} /><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{label}</Text></View>;
}

function SettingRow({ icon, title, detail, colors, trailing }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; colors: ReturnType<typeof useColors>; trailing: React.ReactNode }) {
  return <View style={[styles.settingRow, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.settingIcon, { backgroundColor: colors.secondary }]}><Ionicons name={icon} size={21} color={colors.primary} /></View><View style={styles.tabCardCopy}><Text style={[styles.tabCardTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.tabCardUrl, { color: colors.mutedForeground }]}>{detail}</Text></View>{trailing}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  browserChrome: { paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  brandLine: { alignItems: 'center', minHeight: 36, gap: 8 },
  logoMark: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  chromeSpacer: { flex: 1 },
  iconButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  pressed: { opacity: 0.62, transform: [{ scale: 0.96 }] },
  disabled: { opacity: 0.42 },
  tabCounter: { minWidth: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  tabCounterText: { fontSize: 13, fontWeight: '800' },
  addressRow: { alignItems: 'center', gap: 3, marginTop: 3, marginBottom: 7 },
  addressShell: { flex: 1, minHeight: 43, borderWidth: 1, borderRadius: 15, paddingHorizontal: 10, alignItems: 'center', gap: 7 },
  addressInput: { flex: 1, fontSize: 14, paddingVertical: 0, minWidth: 0 },
  progressTrack: { height: 2, overflow: 'hidden' },
  progressFill: { height: '100%' },
  webArea: { flex: 1, position: 'relative' },
  webLayer: { ...StyleSheet.absoluteFillObject },
  hiddenWebLayer: { width: 0, height: 0, opacity: 0, overflow: 'hidden' },
  webLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  toolbar: { minHeight: 56, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 3 },
  mediaDownload: { position: 'absolute', right: 15, bottom: 15, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6, elevation: 4 },
  mediaDownloadText: { fontSize: 12, fontWeight: '800' },
  notice: { position: 'absolute', left: 26, right: 26, bottom: 72, borderRadius: 13, padding: 12, alignItems: 'center', elevation: 5 },
  noticeText: { fontSize: 13, fontWeight: '700' },
  errorOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 30 },
  errorTitle: { fontSize: 19, fontWeight: '800', textAlign: 'center', marginTop: 13 },
  errorDetail: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  primaryButton: { borderRadius: 14, paddingHorizontal: 20, paddingVertical: 13, marginTop: 17, alignItems: 'center' },
  primaryButtonText: { fontSize: 14, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', minHeight: '48%', borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 15, paddingTop: 12 },
  sheetHeader: { alignItems: 'center', justifyContent: 'space-between', minHeight: 43 },
  sheetTitle: { fontSize: 21, fontWeight: '800' },
  actionRow: { gap: 8, marginVertical: 7 },
  secondaryButton: { borderRadius: 13, paddingVertical: 12, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, flex: 1 },
  secondaryButtonText: { fontSize: 13, fontWeight: '800' },
  sheetList: { gap: 9, paddingTop: 8, paddingBottom: 22 },
  tabCard: { borderWidth: 1, borderRadius: 15, padding: 11, alignItems: 'center', gap: 8 },
  tabCardCopy: { flex: 1, minWidth: 0 },
  tabCardTitle: { fontSize: 14, fontWeight: '800' },
  tabCardUrl: { fontSize: 11, marginTop: 4 },
  segmented: { borderRadius: 13, padding: 3, marginTop: 5 },
  segment: { flex: 1, borderRadius: 10, alignItems: 'center', paddingVertical: 9 },
  segmentText: { fontSize: 11, fontWeight: '800' },
  libraryActions: { alignItems: 'flex-end', paddingTop: 8 },
  clearText: { fontSize: 12, fontWeight: '800' },
  libraryCard: { borderWidth: 1, borderRadius: 15, padding: 12, alignItems: 'center', gap: 10 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  settingsList: { gap: 10, paddingBottom: 24 },
  settingSection: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  settingRow: { minHeight: 72, borderWidth: 1, borderRadius: 15, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  modeRow: { gap: 3 },
  modePill: { paddingVertical: 6, paddingHorizontal: 7, borderRadius: 8 },
  modeText: { fontSize: 10, fontWeight: '800' },
  resetRow: { minHeight: 70, borderWidth: 1, borderRadius: 15, padding: 12, alignItems: 'center', gap: 10 },
  aboutBox: { borderRadius: 18, padding: 16, marginTop: 5 },
  aboutName: { fontSize: 18, fontWeight: '800' },
  aboutDetail: { fontSize: 12, lineHeight: 19, marginTop: 7 },
  aboutVersion: { fontSize: 11, marginTop: 9, opacity: 0.85 },
  qrScreen: { flex: 1, paddingHorizontal: 15 },
  cameraFrame: { flex: 1, borderRadius: 22, overflow: 'hidden', marginVertical: 15, position: 'relative' },
  scanGuide: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanCorner: { width: 220, height: 220, borderWidth: 2, borderColor: '#f4a261', borderRadius: 25 },
  scanText: { color: '#ffffff', fontSize: 14, fontWeight: '700', marginTop: 28, backgroundColor: 'rgba(0,0,0,.45)', padding: 8, borderRadius: 9 },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  qualityCard: { margin: 20, borderRadius: 22, padding: 17, gap: 9 },
  qualityRow: { borderWidth: 1, borderRadius: 13, padding: 13, alignItems: 'center', gap: 8 },
  internalPlayerScreen: { flex: 1, backgroundColor: '#000000' },
  internalPlayerInline: { position: 'absolute', zIndex: 2147483646, elevation: 30, overflow: 'hidden' },
  internalPlayerVideoArea: { flex: 1, backgroundColor: '#000000' },
  internalPlayerVideo: { flex: 1, width: '100%' },
  internalPlayerLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  internalPlayerError: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 },
  internalPlayerErrorText: { color: '#ffffff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  internalPlayerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,.18)' },
  internalPlayerTopBar: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  internalPlayerTopButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.42)' },
  internalPlayerTitle: { flex: 1, color: '#ffffff', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  internalPlayerBottom: { backgroundColor: 'rgba(0,0,0,.82)', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 7 },
  internalPlayerProgressTrack: { height: 3, width: '100%', backgroundColor: 'rgba(255,255,255,.28)', borderRadius: 3, overflow: 'hidden' },
  internalPlayerProgressFill: { height: '100%', backgroundColor: '#ffffff' },
  internalPlayerControlsRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 5 },
  internalPlayerControl: { width: 34, height: 36, alignItems: 'center', justifyContent: 'center' },
  internalPlayerPlay: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  internalPlayerTime: { flex: 1, color: '#ffffff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  internalPlayerSpeed: { minWidth: 40, height: 30, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,.45)', alignItems: 'center', justifyContent: 'center' },
  internalPlayerSpeedText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  internalPlayerSources: { gap: 7, paddingVertical: 5 },
  internalPlayerSourceChip: { borderWidth: 1, borderColor: 'rgba(255,255,255,.35)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  internalPlayerSourceChipActive: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  internalPlayerSourceText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
});


