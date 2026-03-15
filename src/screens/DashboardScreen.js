import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getMonthlySummary, getLastMonthSummary, getTransactions, getNetWorth,
} from '../db/database';
import { formatCurrency, currentMonth, monthLabel, formatDate } from '../utils/helpers';
import { THEME } from '../utils/constants';
import { useAppContext } from '../utils/AppContext';
import CategoryIcon from '../components/CategoryIcon';

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export default function DashboardScreen({ navigation }) {
  const { refreshKey } = useAppContext();
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [lastSummary, setLastSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [recent, setRecent] = useState([]);
  const [netWorthAccounts, setNetWorthAccounts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const month = currentMonth();

  const load = useCallback(async () => {
    const [s, ls, txns, nw] = await Promise.all([
      getMonthlySummary(month),
      getLastMonthSummary(month),
      getTransactions({ month }),
      getNetWorth(),
    ]);
    setSummary(s);
    setLastSummary(ls);
    setRecent(txns.slice(0, 5));
    setNetWorthAccounts(nw);
  }, [month]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const savingsRate = summary.income > 0
    ? Math.round((summary.balance / summary.income) * 100) : 0;

  // vs-last-month deltas
  const incomeChange = lastSummary.income > 0
    ? Math.round(((summary.income - lastSummary.income) / lastSummary.income) * 100)
    : null;
  const expenseChange = lastSummary.expense > 0
    ? Math.round(((summary.expense - lastSummary.expense) / lastSummary.expense) * 100)
    : null;

  // Daily burn rate
  const now = new Date();
  const dayOfMonth = now.getDate();
  const totalDays = daysInMonth(now.getFullYear(), now.getMonth() + 1);
  const dailyRate = dayOfMonth > 0 ? summary.expense / dayOfMonth : 0;
  const projected = dailyRate * totalDays;

  // Net worth total
  const totalNetWorth = netWorthAccounts.reduce((s, a) => s + a.balance, 0);

  const renderDelta = (change) => {
    if (change === null) return null;
    const isPos = change >= 0;
    return (
      <View style={[styles.deltaBadge, { backgroundColor: isPos ? '#DCFCE7' : '#FEE2E2' }]}>
        <Text style={[styles.deltaText, { color: isPos ? '#15803D' : '#B91C1C' }]}>
          {isPos ? '+' : ''}{change}%
        </Text>
      </View>
    );
  };

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
            <Text style={styles.heroLabel}>Net Worth</Text>
            <Text style={styles.heroBalance}>{formatCurrency(totalNetWorth)}</Text>

            <View style={styles.savingsPill}>
              <Text style={styles.savingsPillText}>
                {savingsRate >= 0 ? '🎯' : '⚠️'} {savingsRate}% savings rate this month
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>↑</Text>
                <Text style={styles.statLabel}>Income</Text>
                <Text style={[styles.statValue, { color: '#86EFAC' }]}>{formatCurrency(summary.income)}</Text>
                {renderDelta(incomeChange)}
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>↓</Text>
                <Text style={styles.statLabel}>Expenses</Text>
                <Text style={[styles.statValue, { color: '#FCA5A5' }]}>{formatCurrency(summary.expense)}</Text>
                {renderDelta(expenseChange)}
              </View>
            </View>
          </LinearGradient>

          {/* Daily Burn Rate */}
          {summary.expense > 0 && (
            <View style={styles.burnCard}>
              <Text style={styles.burnText}>
                🔥 Burning {formatCurrency(dailyRate)}/day · Projected {formatCurrency(projected)} this month
              </Text>
            </View>
          )}

          {/* Per-Account Balance Cards */}
          {netWorthAccounts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Accounts</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountsScroll}>
                {netWorthAccounts.map(acc => (
                  <View key={acc.id} style={[styles.accountCard, { borderLeftColor: acc.color, backgroundColor: acc.color + '15' }]}>
                    <Text style={styles.accountIcon}>{acc.icon}</Text>
                    <Text style={styles.accountName}>{acc.name}</Text>
                    <Text style={[styles.accountBalance, { color: acc.balance >= 0 ? '#15803D' : '#B91C1C' }]}>
                      {formatCurrency(acc.balance)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.actionsCard}>
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
          </View>

          {/* Recent Transactions */}
          <View style={styles.recentSection}>
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
                    <Text style={[styles.txnAmount, { color: txn.type === 'income' ? '#059669' : '#DC2626' }]}>
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
  statCard: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8 },
  statIcon: { color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: '700' },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  statValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  deltaBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginTop: 4 },
  deltaText: { fontSize: 11, fontWeight: '700' },
  burnCard: {
    marginHorizontal: 20, marginTop: 14, backgroundColor: '#FFF7ED',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    borderLeftWidth: 3, borderLeftColor: '#F97316',
  },
  burnText: { fontSize: 13, color: '#92400E', fontWeight: '600' },
  section: { marginHorizontal: 20, marginTop: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: THEME.textPrimary, marginBottom: 10 },
  accountsScroll: { marginBottom: 4 },
  accountCard: {
    borderRadius: 16, padding: 14, marginRight: 10,
    minWidth: 110, borderLeftWidth: 4, shadowColor: '#0D9488',
    shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  accountIcon: { fontSize: 22, marginBottom: 4 },
  accountName: { fontSize: 12, color: THEME.textSecondary, fontWeight: '600', marginBottom: 4 },
  accountBalance: { fontSize: 15, fontWeight: '800' },
  actionsCard: {
    marginHorizontal: 20, marginTop: 14, backgroundColor: '#FFFFFF',
    borderRadius: 20, padding: 12,
    shadowColor: '#0D9488', shadowOpacity: 0.07, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 18, gap: 6 },
  actionIcon: { fontSize: 22 },
  actionLabel: { fontSize: 12, fontWeight: '700' },
  recentSection: { marginHorizontal: 20, backgroundColor: THEME.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E8F5F3' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  seeAll: { fontSize: 13, color: THEME.primary, fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingVertical: 28 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: '600', color: THEME.textPrimary },
  emptySubText: { fontSize: 13, color: THEME.textSecondary, marginTop: 4, textAlign: 'center' },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E8F5F3', gap: 12 },
  txnInfo: { flex: 1 },
  txnTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txnCategory: { fontSize: 15, fontWeight: '600', color: THEME.textPrimary },
  recurringBadge: { fontSize: 12 },
  txnDate: { fontSize: 12, color: THEME.textSecondary, marginTop: 2 },
  txnRight: { alignItems: 'flex-end' },
  txnAmount: { fontSize: 15, fontWeight: '700' },
  txnDesc: { fontSize: 11, color: THEME.textSecondary, marginTop: 2, maxWidth: 100 },
});
