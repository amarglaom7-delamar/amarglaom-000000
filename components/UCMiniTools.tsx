import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Bookmark = { id: string; title: string; url: string; createdAt: number };
type SavedPage = { id: string; title: string; url: string; localUri: string; savedAt: number };

export default function UCMiniTools({
  visible, onClose, nightMode, textOnly, onToggleNight, onToggleText, onSavePage, onOpenVideos, onOpenSavedPages, bookmarks, setBookmarks, onNotice,
}: {
  visible: boolean; onClose: () => void; nightMode: boolean; textOnly: boolean;
  onToggleNight: () => void; onToggleText: () => void; onSavePage: () => void;
  onOpenVideos: () => void; onOpenSavedPages: () => void;
  bookmarks: Bookmark[]; setBookmarks: React.Dispatch<React.SetStateAction<Bookmark[]>>;
  onNotice: (text: string) => void;
}) {
  const [network, setNetwork] = useState('');
  const [checking, setChecking] = useState(false);
  const checkNetwork = async () => {
    setChecking(true); setNetwork('');
    const started = Date.now();
    try {
      const response = await fetch('https://www.google.com/generate_204');
      setNetwork(response.ok ? `متصل · ${Date.now() - started} ms` : 'الاتصال غير مستقر');
    } catch { setNetwork('لا يوجد اتصال بالإنترنت'); }
    finally { setChecking(false); }
  };
  const exportBookmarks = async () => {
    try {
      const html = '<!DOCTYPE NETSCAPE-Bookmark-file-1><META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8"><TITLE>MiniWave Bookmarks</TITLE><H1>Bookmarks</H1><DL><p>' +
        bookmarks.map(b => `<DT><A HREF="${b.url.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}">${b.title.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</A>`).join('') + '</DL><p>';
      const uri = `${FileSystem.cacheDirectory}miniwave-bookmarks-${Date.now()}.html`;
      await FileSystem.writeAsStringAsync(uri, html);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/html' });
    } catch { onNotice('تعذر تصدير المفضلة'); }
  };
  const importBookmarks = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'text/html', copyToCacheDirectory: true });
      if (result.canceled) return;
      const html = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const found: Bookmark[] = [];
      const re = /<A\s+[^>]*HREF=["']([^"']+)["'][^>]*>([\s\S]*?)<\/A>/gi;
      let m;
      while ((m = re.exec(html)) && found.length < 200) {
        if (/^https?:\/\//i.test(m[1])) found.push({ id: `bookmark-${Date.now()}-${found.length}`, url: m[1], title: m[2].replace(/<[^>]+>/g,'').trim() || m[1], createdAt: Date.now() });
      }
      setBookmarks(current => [...found, ...current.filter(x => !found.some(f => f.url === x.url))].slice(0,300));
      onNotice(`تم استيراد ${found.length} مفضلة`);
    } catch { onNotice('تعذر استيراد المفضلة'); }
  };
  const row = (icon: keyof typeof Ionicons.glyphMap, title: string, detail: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={styles.row}>
      <Ionicons name={icon} size={23} color="#4f8cff" />
      <View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.detail}>{detail}</Text></View>
      <Ionicons name="chevron-forward" size={18} color="#888" />
    </Pressable>
  );
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.backdrop}><View style={styles.sheet}>
      <View style={styles.header}><Text style={styles.headerText}>أدوات المتصفح</Text><Pressable onPress={onClose}><Ionicons name="close" size={25} color="#888" /></Pressable></View>
      <ScrollView contentContainerStyle={styles.list}>
        {row('moon-outline','الوضع الليلي للصفحة',nightMode?'مفعّل':'متوقف',onToggleNight)}
        {row('text-outline','وضع النص فقط','إخفاء الصور والفيديو لتوفير البيانات',onToggleText)}
        {row('download-outline','حفظ الصفحة','حفظ نسخة HTML محلية',onSavePage)}
        {row('videocam-outline','فيديوهاتي','الفيديوهات المكتملة في التنزيلات',onOpenVideos)}
        {row('documents-outline','الصفحات المحفوظة','فتح النسخ المحلية المحفوظة',onOpenSavedPages)}
        {row('download-outline','استيراد المفضلة','استيراد ملف HTML من الجهاز',()=>void importBookmarks())}
        {row('share-outline','تصدير المفضلة','إنشاء ملف مفضلة قابل للاستيراد',()=>void exportBookmarks())}
        <Pressable onPress={()=>void checkNetwork()} style={styles.row}><Ionicons name="speedometer-outline" size={23} color="#4f8cff"/><View style={styles.copy}><Text style={styles.title}>فحص الشبكة</Text><Text style={styles.detail}>{checking?'جارٍ الفحص…':network||'اختبار الاتصال وزمن الاستجابة'}</Text></View>{checking?<ActivityIndicator size="small" color="#4f8cff"/>:<Ionicons name="chevron-forward" size={18} color="#888"/>}</Pressable>
      </ScrollView>
    </View></View>
  </Modal>;
}
const styles=StyleSheet.create({
 backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.55)'},
 sheet:{maxHeight:'88%',minHeight:'45%',backgroundColor:'#fff',borderTopLeftRadius:25,borderTopRightRadius:25,padding:16},
 header:{height:48,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 headerText:{fontSize:21,fontWeight:'800',color:'#111'},
 list:{gap:10,paddingBottom:25},
 row:{minHeight:68,borderWidth:1,borderColor:'#e2e2e2',borderRadius:16,padding:12,flexDirection:'row',alignItems:'center',gap:12},
 copy:{flex:1},title:{fontSize:14,fontWeight:'800',color:'#111'},detail:{fontSize:11,color:'#777',marginTop:4}
});
