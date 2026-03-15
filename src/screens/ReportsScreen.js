import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions, RefreshControl,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { PieChart, LineChart, BarChart } from 'react-native-chart-kit';
import {
  getCategoryBreakdown, getMonthlyTrend, getMonthlySummary,
  getLastMonthSummary, getCategoryTrend,
} from '../db/database';
import { formatCurrency, currentMonth, monthLabel, offsetMonth } from '../utils/helpers';
import { THEME, CATEGORY_COLORS } from '../utils/constants';
import { exportAsCSV, exportAsJSON, importFromJSON } from '../utils/exportData';
import { useAppContext } from '../utils/AppContext';
import { CATEGORY_EMOJI } from '../components/CategoryIcon';

const WIDTH = Dimensions.get('window').width - 32;

const CHART_CONFIG = {
  backgroundColor: THEME.surface,
  backgroundGradientFrom: THEME.surface,
  backgroundGradientTo: THEME.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(13, 148, 136, ${opacity})`,
  labelColor: () => THEME.textSecondary,
  propsForDots: { r: '5', strokeWidth: '2', stroke: THEME.primary },
  propsForBackgroundLines: { stroke: '#F3F4F6' },
};

const BAR_CHART_CONFIG = {
  ...CHART_CONFIG,
  barPercentage: 0.6,
  fillShadowGradient: THEME.primary,
  fillShadowGradientOpacity: 1,
};

function DeltaArrow({ curr, prev, higherIsGood = true }) {
  if (!prev || prev === 0) return null;
  const delta = Math.round(((curr - prev) / prev) * 100);
  const isUp = delta >= 0;
  const isGood = higherIsGood ? isUp : !isUp;
  return (
    <View style={[compStyles.deltaBadge, { backgroundColor: isGood ? '#DCFCE7' : '#FEE2E2' }]}>
      <Text style={[compStyles.deltaText, { color: isGood ? '#15803D' : '#B91C1C' }]}>
        {isUp ? '↑' : '↓'} {Math.abs(delta)}%
      </Text>
    </View>
  );
}

const compStyles = StyleSheet.create({
  deltaBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  deltaText: { fontSize: 11, fontWeight: '700' },
});

export default function ReportsScreen() {
  const { triggerRefresh } = useAppContext();
  const [exporting, setExporting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [breakdown, setBreakdown] = useState([]);
  const [trend, setTrend] = useState([]);
  const [categoryTrend, setCategoryTrend] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [lastSummary, setLastSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const month = currentMonth();

  const load = useCallback(async () => {
    setLoading(true);
    const [b, t, s, ls, ct] = await Promise.all([
      getCategoryBreakdown(month),
      getMonthlyTrend(6),
      getMonthlySummary(month),
      getLastMonthSummary(month),
      getCategoryTrend(4),
    ]);
    setBreakdown(b);
    setTrend(t);
    setSummary(s);
    setLastSummary(ls);
    setCategoryTrend(ct);
    setLoading(false);
  }, [month]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const pieData = (() => {
    const sorted = [...breakdown].slice(0, 7);
    if (breakdown.length > 7) {
      const otherTotal = breakdown.slice(7).reduce((s, i) => s + i.total, 0);
      sorted.push({ category: 'Other', total: otherTotal });
    }
    return sorted.map(item => ({
      name: item.category.length > 10 ? item.category.slice(0, 10) + '…' : item.category,
      amount: item.total,
      color: CATEGORY_COLORS[item.category] || '#B0B0B0',
      legendFontColor: THEME.textSecondary,
      legendFontSize: 11,
    }));
  })();

  const buildLineData = () => {
    const months = [...new Set(trend.map(r => r.month))].slice(-6);
    if (months.length < 2) return null;
    const expenseData = months.map(m => trend.find(r => r.month === m && r.type === 'expense')?.total || 0);
    const incomeData = months.map(m => trend.find(r => r.month === m && r.type === 'income')?.total || 0);
    const labels = months.map(m => {
      const [, mo] = m.split('-');
      return new Date(2024, parseInt(mo) - 1).toLocaleDateString('en-US', { month: 'short' });
    });
    return {
      labels,
      datasets: [
        { data: expenseData, color: () => '#EF4444', strokeWidth: 2 },
        { data: incomeData, color: () => '#22C55E', strokeWidth: 2 },
      ],
      legend: ['Expenses', 'Income'],
    };
  };

  const buildCategoryTrendData = () => {
    const months = [...new Set(categoryTrend.map(r => r.month))].slice(-4);
    if (months.length === 0) return null;

    // Pick top 4 categories by total spend
    const catTotals = {};
    categoryTrend.forEach(r => {
      catTotals[r.category] = (catTotals[r.category] || 0) + r.total;
    });
    const top4 = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(e => e[0]);

    if (top4.length === 0) return null;

    // Build bar data — one "dataset" per category, bars grouped by month
    // react-native-chart-kit BarChart only supports one dataset, so we flatten:
    // Show one category at a time: use the top category's monthly data
    const primaryCat = top4[0];
    const data = months.map(m => {
      const row = categoryTrend.find(r => r.month === m && r.category === primaryCat);
      return row ? row.total : 0;
    });

    const labels = months.map(m => {
      const [, mo] = m.split('-');
      return new Date(2024, parseInt(mo) - 1).toLocaleDateString('en-US', { month: 'short' });
    });

    return { labels, data, topCategories: top4, months };
  };

  const lineData = buildLineData();
  const categoryTrendData = buildCategoryTrendData();
  const savingsRate = summary.income > 0 ? Math.round((summary.balance / summary.income) * 100) : 0;
  const lastSavingsRate = lastSummary.income > 0 ? Math.round((lastSummary.balance / lastSummary.income) * 100) : 0;
  const prevMonthLabel = monthLabel(offsetMonth(month, -1));

  const handleExportCSV = async () => {
    setExporting(true);
    try { await exportAsCSV(); }
    catch (e) { Alert.alert('Export failed', e.message); }
    finally { setExporting(false); }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try { await exportAsJSON(); }
    catch (e) { Alert.alert('Backup failed', e.message); }
    finally { setBackingUp(false); }
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      Alert.alert(
        'Restore Backup',
        'This will overwrite ALL current data. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore', style: 'destructive',
            onPress: async () => {
              setImporting(true);
              try {
                await importFromJSON(result.assets[0].uri);
                triggerRefresh();
                load();
                Alert.alert('Success', 'Data restored successfully.');
              } catch (e) {
                Alert.alert('Restore failed', e.message);
              } finally {
                setImporting(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeTop}>
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <LinearGradient
        colors={['#0F766E', '#0D9488', '#2DD4BF']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTopRow}>
          <Text style={styles.heroMonth}>{monthLabel(month)}</Text>
          <View style={styles.exportBtns}>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV} disabled={exporting}>
              {exporting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.exportBtnText}>⬇ CSV</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={handleBackup} disabled={backingUp}>
              {backingUp ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.exportBtnText}>💾 Backup</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={handleImport} disabled={importing}>
              {importing ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.exportBtnText}>⬆ Restore</Text>}
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.heroTitle}>Financial Summary</Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Income</Text>
            <Text style={[styles.heroStatValue, { color: '#86EFAC' }]}>{formatCurrency(summary.income)}</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Expenses</Text>
            <Text style={[styles.heroStatValue, { color: '#FCA5A5' }]}>{formatCurrency(summary.expense)}</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Saved</Text>
            <Text style={[styles.heroStatValue, { color: savingsRate >= 0 ? '#86EFAC' : '#FCA5A5' }]}>
              {savingsRate}%
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>

        {/* Month Comparison Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Month Comparison</Text>
          {loading ? (
            <View style={styles.empty}><ActivityIndicator color={THEME.primary} /></View>
          ) : (
            <>
              <View style={styles.compRow}>
                <View style={styles.compHeader}>
                  <Text style={styles.compLabel} numberOfLines={1}></Text>
                </View>
                <View style={styles.compHeader}>
                  <Text style={styles.compColLabel} numberOfLines={1}>{prevMonthLabel.split(' ')[0]}</Text>
                </View>
                <View style={styles.compHeader}>
                  <Text style={styles.compColLabel} numberOfLines={1}>{monthLabel(month).split(' ')[0]}</Text>
                </View>
                <View style={styles.compHeader}>
                  <Text style={styles.compColLabel}>Change</Text>
                </View>
              </View>

              <View style={[styles.compRow, { backgroundColor: '#F0FDF4', borderRadius: 10 }]}>
                <View style={styles.compCell}><Text style={styles.compMetric}>Income</Text></View>
                <View style={styles.compCell}><Text style={styles.compValueSub}>{formatCurrency(lastSummary.income)}</Text></View>
                <View style={styles.compCell}><Text style={[styles.compValue, { color: '#15803D' }]}>{formatCurrency(summary.income)}</Text></View>
                <View style={styles.compCell}><DeltaArrow curr={summary.income} prev={lastSummary.income} higherIsGood={true} /></View>
              </View>

              <View style={[styles.compRow, { backgroundColor: '#FFF1F2', borderRadius: 10, marginTop: 4 }]}>
                <View style={styles.compCell}><Text style={styles.compMetric}>Expenses</Text></View>
                <View style={styles.compCell}><Text style={styles.compValueSub}>{formatCurrency(lastSummary.expense)}</Text></View>
                <View style={styles.compCell}><Text style={[styles.compValue, { color: '#B91C1C' }]}>{formatCurrency(summary.expense)}</Text></View>
                <View style={styles.compCell}><DeltaArrow curr={summary.expense} prev={lastSummary.expense} higherIsGood={false} /></View>
              </View>

              <View style={[styles.compRow, { backgroundColor: '#F0F9FF', borderRadius: 10, marginTop: 4 }]}>
                <View style={styles.compCell}><Text style={styles.compMetric}>Savings%</Text></View>
                <View style={styles.compCell}><Text style={styles.compValueSub}>{lastSavingsRate}%</Text></View>
                <View style={styles.compCell}><Text style={[styles.compValue, { color: THEME.primary }]}>{savingsRate}%</Text></View>
                <View style={styles.compCell}><DeltaArrow curr={savingsRate} prev={lastSavingsRate} higherIsGood={true} /></View>
              </View>
            </>
          )}
        </View>

        {/* Spending by Category */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending by Category</Text>
          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={THEME.primary} />
              <Text style={[styles.emptyText, { marginTop: 8 }]}>Loading…</Text>
            </View>
          ) : breakdown.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📊</Text>
              <Text style={styles.emptyText}>No expense data this month</Text>
            </View>
          ) : (
            <>
              <PieChart
                data={pieData}
                width={WIDTH - 32}
                height={180}
                chartConfig={CHART_CONFIG}
                accessor="amount"
                backgroundColor="transparent"
                paddingLeft="0"
                absolute={false}
              />
              <View style={styles.breakdown}>
                {breakdown.map(item => {
                  const total = breakdown.reduce((s, i) => s + i.total, 0);
                  const pct = Math.round((item.total / total) * 100);
                  return (
                    <View key={item.category} style={styles.breakdownRow}>
                      <View style={styles.breakdownLeft}>
                        <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS[item.category] || '#B0B0B0' }]} />
                        <Text style={styles.breakdownEmoji}>{CATEGORY_EMOJI[item.category] || '•'}</Text>
                        <Text style={styles.breakdownCat}>{item.category}</Text>
                      </View>
                      <View style={styles.breakdownRight}>
                        <Text style={styles.breakdownPct}>{pct}%</Text>
                        <Text style={styles.breakdownAmt}>{formatCurrency(item.total)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {/* 6-Month Trend */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>6-Month Trend</Text>
          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={THEME.primary} />
              <Text style={[styles.emptyText, { marginTop: 8 }]}>Loading…</Text>
            </View>
          ) : !lineData ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📈</Text>
              <Text style={styles.emptyText}>Not enough data yet</Text>
              <Text style={[styles.emptyText, { fontSize: 12, marginTop: 4 }]}>Add transactions in at least 2 months</Text>
            </View>
          ) : (
            <>
              <LineChart
                data={lineData}
                width={WIDTH - 32}
                height={200}
                chartConfig={CHART_CONFIG}
                bezier
                withInnerLines={false}
                withOuterLines
                fromZero
                withScrollableDot={false}
                style={styles.chart}
              />
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.legendText}>Expenses</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
                  <Text style={styles.legendText}>Income</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Category Trends */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Category Trends</Text>
          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={THEME.primary} />
              <Text style={[styles.emptyText, { marginTop: 8 }]}>Loading…</Text>
            </View>
          ) : !categoryTrendData ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📉</Text>
              <Text style={styles.emptyText}>Not enough category data yet</Text>
            </View>
          ) : (
            <>
              <Text style={styles.catTrendSub}>
                Top category: {categoryTrendData.topCategories[0]}
              </Text>
              <BarChart
                data={{
                  labels: categoryTrendData.labels,
                  datasets: [{ data: categoryTrendData.data.map(v => Math.max(v, 0)) }],
                }}
                width={WIDTH - 32}
                height={180}
                chartConfig={BAR_CHART_CONFIG}
                fromZero
                showValuesOnTopOfBars={false}
                style={styles.chart}
              />
              <View style={styles.catTrendList}>
                {categoryTrendData.topCategories.map((cat, i) => {
                  const total = categoryTrend.filter(r => r.category === cat).reduce((s, r) => s + r.total, 0);
                  return (
                    <View key={cat} style={styles.catTrendRow}>
                      <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS[cat] || '#B0B0B0' }]} />
                      <Text style={styles.breakdownEmoji}>{CATEGORY_EMOJI[cat] || '•'}</Text>
                      <Text style={styles.breakdownCat}>{cat}</Text>
                      <Text style={styles.breakdownAmt}>{formatCurrency(total)}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>

      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  safeTop: { flex: 1, backgroundColor: '#0F766E' },
  hero: { paddingTop: 20, paddingBottom: 32, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroMonth: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  exportBtns: { flexDirection: 'row', gap: 6 },
  exportBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center',
  },
  exportBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 8, marginBottom: 20 },
  heroStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18, padding: 16 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  heroStatValue: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  content: { padding: 16, paddingBottom: 110, gap: 16 },
  card: {
    backgroundColor: THEME.surface, borderRadius: 24, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 3,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: THEME.textPrimary, marginBottom: 16 },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyText: { color: THEME.textSecondary, fontSize: 14, textAlign: 'center' },
  chart: { borderRadius: 12, marginLeft: -12 },
  breakdown: { marginTop: 8, gap: 10 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  breakdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  breakdownEmoji: { fontSize: 14 },
  breakdownCat: { fontSize: 13, color: THEME.textPrimary, flex: 1 },
  breakdownRight: { alignItems: 'flex-end' },
  breakdownPct: { fontSize: 12, color: THEME.textSecondary, fontWeight: '600' },
  breakdownAmt: { fontSize: 13, fontWeight: '700', color: THEME.textPrimary },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, color: THEME.textSecondary, fontWeight: '500' },
  // Month comparison
  compRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8 },
  compHeader: { flex: 1, alignItems: 'center' },
  compCell: { flex: 1, alignItems: 'center' },
  compLabel: { fontSize: 11, color: THEME.textSecondary, fontWeight: '600' },
  compColLabel: { fontSize: 12, fontWeight: '700', color: THEME.textSecondary },
  compMetric: { fontSize: 13, fontWeight: '700', color: THEME.textPrimary },
  compValue: { fontSize: 13, fontWeight: '800' },
  compValueSub: { fontSize: 12, color: THEME.textSecondary, fontWeight: '600' },
  // Category trend
  catTrendSub: { fontSize: 12, color: THEME.textSecondary, marginBottom: 8, fontWeight: '600' },
  catTrendList: { marginTop: 12, gap: 8 },
  catTrendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
