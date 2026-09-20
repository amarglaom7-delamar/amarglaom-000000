import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type ColorSet = {
  background: string;
  card: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  border: string;
  accent: string;
};

type Props = {
  colors: ColorSet;
  language: 'ar' | 'en';
  history: Array<{ id: string; title: string; url: string }>;
  bookmarks: Array<{ id: string; title: string; url: string }>;
  downloadsCount: number;
  onNavigate: (url: string) => void;
  onOpenHistory: () => void;
  onOpenBookmarks: () => void;
  onOpenDownloads: () => void;
  onOpenTools: () => void;
  onOpenTabs: () => void;
};

const shortcuts = [
  { key: 'google', icon: 'logo-google', label: 'Google', url: 'https://www.google.com/' },
  { key: 'youtube', icon: 'logo-youtube', label: 'YouTube', url: 'https://www.youtube.com/' },
  { key: 'facebook', icon: 'logo-facebook', label: 'Facebook', url: 'https://www.facebook.com/' },
  { key: 'tiktok', icon: 'musical-notes', label: 'TikTok', url: 'https://www.tiktok.com/' },
  { key: 'whatsapp', icon: 'chatbubble-ellipses', label: 'WhatsApp', url: 'https://web.whatsapp.com/' },
  { key: 'bing', icon: 'search-outline', label: 'Bing', url: 'https://www.bing.com/' },
] as const;

export default function UCMiniHome({
  colors,
  language,
  history,
  bookmarks,
  downloadsCount,
  onNavigate,
  onOpenHistory,
  onOpenBookmarks,
  onOpenDownloads,
  onOpenTools,
  onOpenTabs,
}: Props) {
  const ar = language === 'ar';
  const recent = history.slice(0, 4);
  const saved = bookmarks.slice(0, 4);

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: colors.primary }]}>
          <Ionicons name="flash" size={27} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{ar ? 'عمار جلعوم' : 'Amar Jalaom'}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {ar ? 'تصفح سريع · تحميل · خصوصية' : 'Fast browsing · downloads · privacy'}
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{ar ? 'اختصارات سريعة' : 'Quick access'}</Text>
        <Pressable onPress={onOpenTabs}>
          <Text style={[styles.link, { color: colors.primary }]}>{ar ? 'التبويبات' : 'Tabs'}</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {shortcuts.map((item) => (
          <Pressable key={item.key} onPress={() => onNavigate(item.url)} style={({ pressed }) => [styles.shortcut, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}>
            <View style={[styles.shortcutIcon, { backgroundColor: colors.secondary }]}>
              <Ionicons name={item.icon} size={22} color={colors.primary} />
            </View>
            <Text numberOfLines={1} style={[styles.shortcutText, { color: colors.foreground }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actionRow}>
        <Pressable onPress={onOpenBookmarks} style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="star" size={22} color={colors.accent} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>{ar ? 'المفضلة' : 'Bookmarks'}</Text>
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{bookmarks.length}</Text>
        </Pressable>
        <Pressable onPress={onOpenDownloads} style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="download" size={22} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>{ar ? 'التنزيلات' : 'Downloads'}</Text>
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{downloadsCount}</Text>
        </Pressable>
        <Pressable onPress={onOpenTools} style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="construct" size={22} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>{ar ? 'الأدوات' : 'Tools'}</Text>
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>+</Text>
        </Pressable>
      </View>

      {saved.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{ar ? 'المفضلة' : 'Bookmarks'}</Text>
            <Pressable onPress={onOpenBookmarks}><Text style={[styles.link, { color: colors.primary }]}>{ar ? 'عرض الكل' : 'View all'}</Text></Pressable>
          </View>
          {saved.map((item) => (
            <Pressable key={item.id} onPress={() => onNavigate(item.url)} style={[styles.listRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="star-outline" size={19} color={colors.accent} />
              <View style={styles.listCopy}>
                <Text numberOfLines={1} style={[styles.listTitle, { color: colors.foreground }]}>{item.title || item.url}</Text>
                <Text numberOfLines={1} style={[styles.listUrl, { color: colors.mutedForeground }]}>{item.url}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {recent.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{ar ? 'آخر الصفحات' : 'Recent pages'}</Text>
            <Pressable onPress={onOpenHistory}><Text style={[styles.link, { color: colors.primary }]}>{ar ? 'السجل' : 'History'}</Text></Pressable>
          </View>
          {recent.map((item) => (
            <Pressable key={item.id} onPress={() => onNavigate(item.url)} style={[styles.listRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="time-outline" size={19} color={colors.primary} />
              <View style={styles.listCopy}>
                <Text numberOfLines={1} style={[styles.listTitle, { color: colors.foreground }]}>{item.title || item.url}</Text>
                <Text numberOfLines={1} style={[styles.listUrl, { color: colors.mutedForeground }]}>{item.url}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={[styles.tip, { backgroundColor: colors.secondary }]}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
        <Text style={[styles.tipText, { color: colors.mutedForeground }]}>
          {ar ? 'وضع خاص، حظر التتبع، توفير البيانات والتنزيلات متاحة من أدوات المتصفح.' : 'Private mode, tracker blocking, data saver and downloads are available from browser tools.'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  hero: { alignItems: 'center', paddingTop: 16, paddingBottom: 20 },
  heroIcon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 23, fontWeight: '900', marginTop: 10 },
  subtitle: { fontSize: 12, marginTop: 5 },
  section: { marginTop: 19 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  sectionTitle: { fontSize: 15, fontWeight: '900' },
  link: { fontSize: 12, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  shortcut: { width: '31.8%', minHeight: 83, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 9 },
  shortcutIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  shortcutText: { fontSize: 11, fontWeight: '800', marginTop: 6 },
  actionRow: { flexDirection: 'row', gap: 9, marginTop: 14 },
  actionCard: { flex: 1, minHeight: 74, borderWidth: 1, borderRadius: 15, padding: 10, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 11, fontWeight: '800', marginTop: 5 },
  actionCount: { fontSize: 10, marginTop: 2 },
  listRow: { minHeight: 59, borderWidth: 1, borderRadius: 14, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 },
  listCopy: { flex: 1, minWidth: 0 },
  listTitle: { fontSize: 13, fontWeight: '800' },
  listUrl: { fontSize: 10, marginTop: 3 },
  tip: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 14, padding: 12, marginTop: 18 },
  tipText: { flex: 1, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.68, transform: [{ scale: 0.98 }] },
});
