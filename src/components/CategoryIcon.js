import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CATEGORY_COLORS } from '../utils/constants';

export const CATEGORY_EMOJI = {
  'Food & Dining': '🍔',
  'Transportation': '🚗',
  'Shopping': '🛍️',
  'Entertainment': '🎬',
  'Health & Medical': '💊',
  'Housing & Rent': '🏠',
  'Utilities': '💡',
  'Education': '📚',
  'Travel': '✈️',
  'Personal Care': '💅',
  'Investments': '📈',
  'Other': '📦',
  'Salary': '💼',
  'Freelance': '💻',
  'Business': '🏢',
  'Investment Returns': '💰',
  'Gift': '🎁',
  'Other Income': '💵',
};

// customEmojiMap and customColorMap can be set at runtime from the DB
export let customEmojiMap = {};
export let customColorMap = {};

export function setCustomCategoryMaps(emojiMap, colorMap) {
  customEmojiMap = emojiMap;
  customColorMap = colorMap;
}

export default function CategoryIcon({ category, size = 44 }) {
  const emoji = customEmojiMap[category] || CATEGORY_EMOJI[category] || '💳';
  const colorBase = customColorMap[category] || CATEGORY_COLORS[category] || '#B0B0B0';
  const bg = colorBase + '22';
  const borderRadius = Math.round(size * 0.32);
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius, backgroundColor: bg }]}>
      <Text style={{ fontSize: Math.round(size * 0.45) }}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
