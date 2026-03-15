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
    <View style={[styles.card, { borderTopColor: barColor }]}>
      <View style={styles.header}>
        <View style={styles.left}>
          <CategoryIcon category={category} size={44} />
          <View style={styles.meta}>
            <Text style={styles.category}>{category}</Text>
            <Text style={styles.sub}>{formatCurrency(spent)} of {formatCurrency(amount)}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => onDelete(budget.id)} style={styles.right}>
          <Text style={styles.deleteIcon}>🗑</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.progressWrapper}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={[styles.progressPct, { color: barColor }]}>{Math.round(pct)}%</Text>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderTopWidth: 3,
    shadowColor: '#0D9488',
    shadowOpacity: 0.08,
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
  progressWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  progressBg: { flex: 1, height: 8, backgroundColor: '#E8F5F3', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressPct: { fontSize: 11, fontWeight: '700', minWidth: 32, textAlign: 'right' },
  overText: { fontSize: 12, color: '#DC2626', fontWeight: '600' },
  remainText: { fontSize: 12, color: '#059669', fontWeight: '600' },
});
