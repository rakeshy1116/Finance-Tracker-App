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

export default function CategoryIcon({ category, size = 44 }) {
  const bg = (CATEGORY_COLORS[category] || '#B0B0B0') + '22';
  const borderRadius = Math.round(size * 0.32);
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius, backgroundColor: bg }]}>
      <Text style={{ fontSize: Math.round(size * 0.45) }}>{CATEGORY_EMOJI[category] || '💳'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
