import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import CategoryIcon from './CategoryIcon';
import { formatCurrency, formatDate } from '../utils/helpers';
import { THEME, CATEGORY_COLORS } from '../utils/constants';

export default function TransactionCard({ item, onDelete, onEdit, onDuplicate }) {
  const swipeableRef = useRef(null);

  const renderRightActions = (progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          swipeableRef.current?.close();
          onDelete && onDelete(item.id);
        }}
        activeOpacity={0.8}
      >
        <Animated.Text style={[styles.deleteActionText, { transform: [{ scale }] }]}>🗑</Animated.Text>
        <Animated.Text style={[styles.deleteActionLabel, { transform: [{ scale }] }]}>Delete</Animated.Text>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={onDelete ? renderRightActions : null}
      rightThreshold={40}
      friction={2}
      overshootRight={false}
    >
      <View style={[styles.card, { borderLeftColor: CATEGORY_COLORS[item.category] || '#94A3B8' }]}>
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
          <Text style={[styles.amount, { color: item.type === 'income' ? '#059669' : '#DC2626' }]}>
            {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
          </Text>
          <View style={styles.actions}>
            {onDuplicate && (
              <TouchableOpacity onPress={() => onDuplicate(item.id)} style={styles.actionBtn}>
                <Text style={styles.dupIcon}>📋</Text>
              </TouchableOpacity>
            )}
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
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderLeftWidth: 3,
    shadowColor: '#0D9488',
    shadowOpacity: 0.07,
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
  actionBtn: { padding: 4, backgroundColor: '#F0F9F8', borderRadius: 8 },
  dupIcon: { fontSize: 13 },
  editIcon: { fontSize: 14 },
  delIcon: { fontSize: 15 },
  deleteAction: {
    backgroundColor: '#EF4444',
    borderRadius: 18,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    minWidth: 72,
  },
  deleteActionText: { fontSize: 22, color: '#FFFFFF' },
  deleteActionLabel: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', marginTop: 2 },
});
