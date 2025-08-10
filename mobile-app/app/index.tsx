import React from 'react';
import { Redirect } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';

export default function Index() {
  const { loaded, language } = useLanguage();

  if (!loaded) return null;

  if (!language) {
    return <Redirect href={"/language-select" as any} />;
  }

  return <Redirect href={"/(tabs)/camera" as any} />;
}