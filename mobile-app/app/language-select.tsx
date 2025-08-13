import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage, LanguageCode } from '@/context/LanguageContext';

const LANGUAGES: { code: LanguageCode; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ar', label: 'العربية', flag: '🇵🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'ur', label: 'اردو', flag: '🇵🇰' },
];

export default function LanguageSelect() {
  const router = useRouter();
  const { setLanguage, language } = useLanguage();
  const [selected, setSelected] = useState<LanguageCode | null>(language);

  const preview = useMemo(() => {
    switch (selected) {
      case 'ar':
        return 'اختر لغتك المفضلة لبدء الاستخدام';
      case 'fr':
        return "Choisissez votre langue pour commencer";
      case 'es':
        return 'Elige tu idioma para empezar';
      case 'de':
        return 'Wähle deine Sprache zum Starten';
      case 'tr':
        return 'Başlamak için dilini seç';
      case 'ur':
        return 'آغاز کرنے کے لیے اپنی زبان منتخب کریں';
      default:
        return 'Choose your preferred language to get started';
    }
  }, [selected]);

  const onContinue = async () => {
    if (!selected) return;
    await setLanguage(selected);
    router.replace('/(tabs)/camera');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>{preview}</Text>

        <FlatList
          data={LANGUAGES}
          numColumns={2}
          keyExtractor={(item) => item.code}
          columnWrapperStyle={{ gap: 16 }}
          contentContainerStyle={{ gap: 16, paddingVertical: 24 }}
          renderItem={({ item }) => {
            const isActive = selected === item.code;
            return (
              <TouchableOpacity
                onPress={() => setSelected(item.code)}
                activeOpacity={0.85}
                style={[styles.card, isActive && styles.cardActive]}
              >
                <Text style={styles.flag}>{item.flag}</Text>
                <Text style={[styles.cardText, isActive && styles.cardTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          }}
        />

        <TouchableOpacity
          onPress={onContinue}
          disabled={!selected}
          activeOpacity={0.9}
          style={[styles.cta, !selected && styles.ctaDisabled]}
        >
          <Text style={styles.ctaText}>{selected ? 'Continue' : 'Select a language'}</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>You can change this later in settings.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#2f2a29' },
  container: {
    flex: 1,
    padding: 24,
    gap: 8,
    backgroundColor: '#2f2a29',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#e0d7d6',
    marginTop: 4,
  },
  card: {
    flex: 1,
    backgroundColor: '#3a3433',
    borderColor: '#4a4443',
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  cardActive: {
    backgroundColor: '#3f3938',
    borderColor: 'rgba(232, 26, 19, 0.35)',
  },
  flag: { fontSize: 34 },
  cardText: { color: '#e6dfde', fontSize: 16, fontWeight: '600' },
  cardTextActive: { color: '#ffffff' },
  cta: {
    marginTop: 'auto',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(232, 26, 19, 0.20)',
    shadowColor: '#e81a13',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  ctaDisabled: { backgroundColor: '#5c504f', borderWidth: 0, shadowOpacity: 0 },
  ctaText: { color: '#2f2a29', fontSize: 16, fontWeight: '700' },
  footer: { textAlign: 'center', color: '#c9bdbb', marginTop: 12 },
});
