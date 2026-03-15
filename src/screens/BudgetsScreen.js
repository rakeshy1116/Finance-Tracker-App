import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBudgets, setBudget, deleteBudget } from '../db/database';
import { formatCurrency, currentMonth, monthLabel, offsetMonth } from '../utils/helpers';
import { CATEGORIES, THEME } from '../utils/constants';
import { CATEGORY_EMOJI } from '../components/CategoryIcon';
import BudgetCard from '../components/BudgetCard';

export default function BudgetsScreen() {
  const [budgets, setBudgetsState] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [modal, setModal] = useState(false);
  const [selCategory, setSelCategory] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getBudgets(month);
    setBudgetsState(data);
  }, [month]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openModal = () => { setSelCategory(''); setBudgetAmount(''); setModal(true); };

  const saveBudget = async () => {
    if (!selCategory) { Alert.alert('Select a category'); return; }
    const amt = parseFloat(budgetAmount);
    if (!amt || amt <= 0) { Alert.alert('Enter a valid amount'); return; }
    await setBudget({ category: selCategory, amount: amt, month });
    setModal(false);
    load();
  };

  const confirmDelete = (id) => {
    Alert.alert('Remove Budget', 'Delete this budget?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteBudget(id); load(); } },
    ]);
  };

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const unusedCategories = CATEGORIES.filter(c => !budgets.find(b => b.category === c));
  const isCurrentMonth = month >= currentMonth();

  return (
    <SafeAreaView edges={['top']} style={styles.safeTop}>
    <View style={styles.container}>
      {/* Month Selector */}
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => setMonth(m => offsetMonth(m, -1))} style={styles.monthArrow}>
          <Text style={styles.monthArrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
        <TouchableOpacity
          onPress={() => setMonth(m => offsetMonth(m, 1))}
          style={styles.monthArrow}
          disabled={isCurrentMonth}
        >
          <Text style={[styles.monthArrowText, isCurrentMonth && styles.monthArrowDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Header */}
        {budgets.length > 0 && (
          <LinearGradient
            colors={['#0F766E', '#0D9488', '#2DD4BF']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <Text style={styles.summaryMonth}>{monthLabel(month)}</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Budget</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalBudget)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Spent</Text>
                <Text style={[styles.summaryValue, { color: '#FCA5A5' }]}>{formatCurrency(totalSpent)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Remaining</Text>
                <Text style={[styles.summaryValue, { color: '#86EFAC' }]}>{formatCurrency(totalBudget - totalSpent)}</Text>
              </View>
            </View>
            <View style={styles.overallProgressBg}>
              <View style={[styles.overallProgressFill, {
                width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%`,
                backgroundColor: totalSpent > totalBudget ? '#FCA5A5' : '#86EFAC',
              }]} />
            </View>
            <Text style={styles.overallPct}>
              {Math.round((totalSpent / totalBudget) * 100)}% of total budget used
            </Text>
          </LinearGradient>
        )}

        <View style={styles.listContainer}>
          {budgets.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎯</Text>
              <Text style={styles.emptyText}>No budgets for {monthLabel(month)}</Text>
              <Text style={styles.emptySubText}>Tap + to set monthly limits per category</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openModal}>
                <Text style={styles.emptyBtnText}>Set First Budget</Text>
              </TouchableOpacity>
            </View>
          ) : (
            budgets.map(b => (
              <BudgetCard key={b.id} budget={b} onDelete={confirmDelete} />
            ))
          )}
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Budget Modal */}
      <Modal visible={modal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <TouchableOpacity style={styles.overlayDismiss} onPress={() => setModal(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Set Budget — {monthLabel(month)}</Text>

            <Text style={styles.sheetLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {(unusedCategories.length > 0 ? unusedCategories : CATEGORIES).map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, selCategory === cat && styles.catChipActive]}
                  onPress={() => setSelCategory(cat)}
                >
                  <Text style={{ fontSize: 16 }}>{CATEGORY_EMOJI[cat] || '💰'}</Text>
                  <Text style={[styles.catChipText, selCategory === cat && styles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sheetLabel}>Monthly Limit</Text>
            <View style={styles.amountInputWrap}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.amountField}
                placeholder="0.00"
                placeholderTextColor={THEME.textSecondary}
                keyboardType="decimal-pad"
                value={budgetAmount}
                onChangeText={setBudgetAmount}
                autoFocus
              />
            </View>

            <View style={styles.sheetBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveBudget}>
                <LinearGradient
                  colors={['#0F766E', '#0D9488', '#2DD4BF']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.saveBtnGradient}
                >
                  <Text style={styles.saveBtnText}>Save Budget</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeTop: { flex: 1, backgroundColor: THEME.background },
  container: { flex: 1, backgroundColor: THEME.background },
  monthSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, backgroundColor: THEME.surface,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  monthArrow: { padding: 12 },
  monthArrowText: { fontSize: 26, color: THEME.primary, fontWeight: '600' },
  monthArrowDisabled: { opacity: 0.25 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: THEME.textPrimary, minWidth: 180, textAlign: 'center' },
  summaryCard: { margin: 16, borderRadius: 24, padding: 20 },
  summaryMonth: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', marginBottom: 16 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  summaryValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginTop: 4 },
  overallProgressBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  overallProgressFill: { height: '100%', borderRadius: 3 },
  overallPct: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 6, textAlign: 'right' },
  listContainer: { paddingHorizontal: 16 },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 17, fontWeight: '700', color: THEME.textPrimary, textAlign: 'center' },
  emptySubText: { fontSize: 13, color: THEME.textSecondary, marginTop: 6, textAlign: 'center' },
  emptyBtn: {
    marginTop: 20, backgroundColor: THEME.primary, paddingHorizontal: 24,
    paddingVertical: 12, borderRadius: 14,
  },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  fab: {
    position: 'absolute', bottom: 110, right: 24, width: 56, height: 56,
    borderRadius: 28, backgroundColor: THEME.primary, alignItems: 'center',
    justifyContent: 'center', shadowColor: THEME.primary, shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 8,
  },
  fabText: { color: '#FFFFFF', fontSize: 28, lineHeight: 32 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: THEME.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: THEME.textPrimary, marginBottom: 20 },
  sheetLabel: { fontSize: 13, fontWeight: '700', color: THEME.textSecondary, marginBottom: 10, letterSpacing: 0.3 },
  catScroll: { marginBottom: 20 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, marginRight: 8,
    backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent',
  },
  catChipActive: { backgroundColor: '#CCFBF1', borderColor: THEME.primary },
  catChipText: { fontSize: 13, color: THEME.textSecondary, fontWeight: '500' },
  catChipTextActive: { color: THEME.primary, fontWeight: '700' },
  amountInputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
    borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', paddingHorizontal: 16, marginBottom: 24,
  },
  dollarSign: { fontSize: 24, fontWeight: '700', color: THEME.textSecondary, marginRight: 4 },
  amountField: { flex: 1, fontSize: 32, fontWeight: '800', color: THEME.textPrimary, paddingVertical: 14 },
  sheetBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: THEME.textSecondary },
  saveBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  saveBtnGradient: { paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
