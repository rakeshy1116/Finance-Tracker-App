import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import CategoryIcon from './CategoryIcon';
import { formatCurrency, formatDate } from '../utils/helpers';
import { THEME } from '../utils/constants';

export default function TransactionCard({ item, onDelete, onEdit }) {
  return (
    <View style={styles.card}>
      <CategoryIcon category={item.category} size={46} />
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.category}>{item.category}</Text>
          {item.recurring === 1 && <Text style={styles.recurringBadge}>🔁</Text>}
        </View>
        {item.description ? (
          <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>
        ) : null}
        <Text style={styles.date}>{formatDate(item.date)}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: item.type === 'income' ? '#22C55E' : '#EF4444' }]}>
          {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
        </Text>
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity onPress={() => onEdit(item)} style={styles.actionBtn}>
              <Text style={styles.editIcon}>✏️</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.actionBtn}>
              <Text style={styles.delIcon}>🗑</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  info: { flex: 1, marginLeft: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  category: { fontSize: 15, fontWeight: '700', color: THEME.textPrimary },
  recurringBadge: { fontSize: 12 },
  desc: { fontSize: 12, color: THEME.textSecondary, marginTop: 1 },
  date: { fontSize: 12, color: THEME.textSecondary, marginTop: 3 },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 15, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 2 },
  editIcon: { fontSize: 14 },
  delIcon: { fontSize: 15 },
});
