import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import CategoryIcon from './CategoryIcon';
import { formatCurrency } from '../utils/helpers';
import { THEME } from '../utils/constants';

export default function BudgetCard({ budget, onDelete }) {
  const { spent, amount, category } = budget;
  const pct = Math.min((spent / amount) * 100, 100);
  const over = spent > amount;
  const barColor = over ? '#EF4444' : pct > 75 ? '#F59E0B' : '#22C55E';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.left}>
          <CategoryIcon category={category} size={44} />
          <View style={styles.meta}>
            <Text style={styles.category}>{category}</Text>
            <Text style={styles.sub}>{formatCurrency(spent)} of {formatCurrency(amount)}</Text>
          </View>
        </View>
        <View style={styles.right}>
          <Text style={[styles.pct, { color: barColor }]}>{Math.round(pct)}%</Text>
          <TouchableOpacity onPress={() => onDelete(budget.id)}>
            <Text style={styles.deleteIcon}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      {over
        ? <Text style={styles.overText}>⚠️ Over by {formatCurrency(spent - amount)}</Text>
        : <Text style={styles.remainText}>✅ {formatCurrency(amount - spent)} remaining</Text>
      }
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 3,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  meta: {},
  category: { fontSize: 15, fontWeight: '700', color: THEME.textPrimary },
  sub: { fontSize: 12, color: THEME.textSecondary, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  pct: { fontSize: 16, fontWeight: '800' },
  deleteIcon: { fontSize: 16 },
  progressBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 4 },
  overText: { fontSize: 12, color: '#EF4444', fontWeight: '600' },
  remainText: { fontSize: 12, color: '#22C55E', fontWeight: '600' },
});
