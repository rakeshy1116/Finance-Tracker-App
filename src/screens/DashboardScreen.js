import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMonthlySummary, getTransactions } from '../db/database';
import { formatCurrency, currentMonth, monthLabel, formatDate } from '../utils/helpers';
import { THEME } from '../utils/constants';
import { useAppContext } from '../utils/AppContext';
import CategoryIcon from '../components/CategoryIcon';

export default function DashboardScreen({ navigation }) {
  const { refreshKey } = useAppContext();
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [recent, setRecent] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const month = currentMonth();

  const load = useCallback(async () => {
    const [s, txns] = await Promise.all([
      getMonthlySummary(month),
      getTransactions({ month }),
    ]);
    setSummary(s);
    setRecent(txns.slice(0, 5));
  }, [month]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const savingsRate = summary.income > 0
    ? Math.round((summary.balance / summary.income) * 100) : 0;

  return (
    <SafeAreaView edges={['top']} style={styles.safeTop}>
      <StatusBar barStyle="light-content" backgroundColor="#0F766E" />
      <View style={styles.root}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        >
          <LinearGradient
            colors={['#0F766E', '#0D9488', '#2DD4BF']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.heroMonth}>{monthLabel(month)}</Text>
            <Text style={styles.heroLabel}>Net Balance</Text>
            <Text style={styles.heroBalance}>{formatCurrency(summary.balance)}</Text>

            <View style={styles.savingsPill}>
              <Text style={styles.savingsPillText}>
                {savingsRate >= 0 ? '🎯' : '⚠️'} {savingsRate}% savings rate
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>↑</Text>
                <Text style={styles.statLabel}>Income</Text>
                <Text style={[styles.statValue, { color: '#86EFAC' }]}>{formatCurrency(summary.income)}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>↓</Text>
                <Text style={styles.statLabel}>Expenses</Text>
                <Text style={[styles.statValue, { color: '#FCA5A5' }]}>{formatCurrency(summary.expense)}</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Quick Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]}
              onPress={() => navigation.navigate('AddTransaction', { defaultType: 'expense', onSaved: load })}
            >
              <Text style={styles.actionIcon}>➖</Text>
              <Text style={[styles.actionLabel, { color: '#EF4444' }]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#DCFCE7' }]}
              onPress={() => navigation.navigate('AddTransaction', { defaultType: 'income', onSaved: load })}
            >
              <Text style={styles.actionIcon}>➕</Text>
              <Text style={[styles.actionLabel, { color: '#22C55E' }]}>Income</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#CCFBF1' }]}
              onPress={() => navigation.navigate('Reports')}
            >
              <Text style={styles.actionIcon}>📊</Text>
              <Text style={[styles.actionLabel, { color: '#0D9488' }]}>Reports</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Transactions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
                <Text style={styles.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>

            {recent.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>💸</Text>
                <Text style={styles.emptyText}>No transactions yet</Text>
                <Text style={styles.emptySubText}>Add your first expense or income above</Text>
              </View>
            ) : (
              recent.map((txn, i) => (
                <View key={txn.id} style={[styles.txnRow, i === recent.length - 1 && { borderBottomWidth: 0 }]}>
                  <CategoryIcon category={txn.category} size={44} />
                  <View style={styles.txnInfo}>
                    <View style={styles.txnTopRow}>
                      <Text style={styles.txnCategory}>{txn.category}</Text>
                      {txn.recurring === 1 && <Text style={styles.recurringBadge}>🔁</Text>}
                    </View>
                    <Text style={styles.txnDate}>{formatDate(txn.date)}</Text>
                  </View>
                  <View style={styles.txnRight}>
                    <Text style={[styles.txnAmount, { color: txn.type === 'income' ? '#22C55E' : '#EF4444' }]}>
                      {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
                    </Text>
                    {txn.description ? <Text style={styles.txnDesc} numberOfLines={1}>{txn.description}</Text> : null}
                  </View>
                </View>
              ))
            )}
          </View>
          <View style={{ height: 120 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeTop: { flex: 1, backgroundColor: '#0F766E' },
  root: { flex: 1, backgroundColor: THEME.background },
  hero: { paddingTop: 20, paddingBottom: 32, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  heroMonth: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 15, marginTop: 12 },
  heroBalance: { color: '#FFFFFF', fontSize: 44, fontWeight: '800', marginTop: 4, letterSpacing: -1 },
  savingsPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginTop: 10 },
  savingsPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 16, marginTop: 20 },
  statCard: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8 },
  statIcon: { color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: '700' },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  statValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  actions: { flexDirection: 'row', margin: 20, gap: 10 },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 18, gap: 6 },
  actionIcon: { fontSize: 22 },
  actionLabel: { fontSize: 12, fontWeight: '700' },
  section: { marginHorizontal: 20, backgroundColor: THEME.surface, borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: THEME.textPrimary },
  seeAll: { fontSize: 13, color: THEME.primary, fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingVertical: 28 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: '600', color: THEME.textPrimary },
  emptySubText: { fontSize: 13, color: THEME.textSecondary, marginTop: 4, textAlign: 'center' },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  txnInfo: { flex: 1 },
  txnTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txnCategory: { fontSize: 15, fontWeight: '600', color: THEME.textPrimary },
  recurringBadge: { fontSize: 12 },
  txnDate: { fontSize: 12, color: THEME.textSecondary, marginTop: 2 },
  txnRight: { alignItems: 'flex-end' },
  txnAmount: { fontSize: 15, fontWeight: '700' },
  txnDesc: { fontSize: 11, color: THEME.textSecondary, marginTop: 2, maxWidth: 100 },
});
