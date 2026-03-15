import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, TextInput, ActivityIndicator,
  ScrollView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getTransactions, getTransactionCount, deleteTransaction,
  addTransaction, duplicateTransaction, getAccounts,
} from '../db/database';
import { THEME } from '../utils/constants';
import { useAppContext } from '../utils/AppContext';
import TransactionCard from '../components/TransactionCard';
import UndoSnackbar from '../components/UndoSnackbar';

const FILTERS = ['All', 'Expense', 'Income'];
const PAGE_SIZE = 20;

function parseAmountFilter(str) {
  if (!str) return { minAmount: undefined, maxAmount: undefined };
  const s = str.trim();
  if (s.startsWith('>')) {
    const v = parseFloat(s.slice(1));
    return { minAmount: isNaN(v) ? undefined : v, maxAmount: undefined };
  }
  if (s.startsWith('<')) {
    const v = parseFloat(s.slice(1));
    return { minAmount: undefined, maxAmount: isNaN(v) ? undefined : v };
  }
  const v = parseFloat(s);
  if (!isNaN(v)) {
    return { minAmount: v * 0.95, maxAmount: v * 1.05 };
  }
  return { minAmount: undefined, maxAmount: undefined };
}

export default function TransactionsScreen({ navigation }) {
  const { refreshKey, triggerRefresh } = useAppContext();
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [amountFilter, setAmountFilter] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('DESC');
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Account filter
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);

  // Date range filter
  const [showDateRange, setShowDateRange] = useState(false);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Undo snackbar
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [deletedItem, setDeletedItem] = useState(null);
  const snackbarDismissedRef = useRef(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useFocusEffect(useCallback(() => {
    getAccounts().then(setAccounts);
  }, []));

  const { minAmount, maxAmount } = parseAmountFilter(amountFilter);

  const activeFromDate = fromDate ? fromDate.toISOString().split('T')[0] : undefined;
  const activeToDate = toDate ? toDate.toISOString().split('T')[0] : undefined;

  const load = useCallback(async () => {
    const queryParams = {
      type: filter,
      limit: PAGE_SIZE,
      offset: 0,
      search: debouncedSearch || undefined,
      sortBy,
      sortDir,
      minAmount,
      maxAmount,
      account_id: selectedAccount != null ? selectedAccount : undefined,
      fromDate: activeFromDate,
      toDate: activeToDate,
    };
    const countParams = {
      type: filter,
      search: debouncedSearch || undefined,
      minAmount,
      maxAmount,
      account_id: selectedAccount != null ? selectedAccount : undefined,
      fromDate: activeFromDate,
      toDate: activeToDate,
    };
    const [rows, count] = await Promise.all([
      getTransactions(queryParams),
      getTransactionCount(countParams),
    ]);
    setTransactions(rows);
    setTotalCount(count);
    setPage(0);
  }, [filter, debouncedSearch, sortBy, sortDir, minAmount, maxAmount, selectedAccount, activeFromDate, activeToDate]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMore || transactions.length >= totalCount) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const rows = await getTransactions({
      type: filter,
      limit: PAGE_SIZE,
      offset: nextPage * PAGE_SIZE,
      search: debouncedSearch || undefined,
      sortBy,
      sortDir,
      minAmount,
      maxAmount,
      account_id: selectedAccount != null ? selectedAccount : undefined,
      fromDate: activeFromDate,
      toDate: activeToDate,
    });
    setTransactions(prev => [...prev, ...rows]);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const handleDelete = (id) => {
    const item = transactions.find(t => t.id === id);
    if (!item) return;
    snackbarDismissedRef.current = false;
    setDeletedItem(item);
    deleteTransaction(id).then(() => {
      load();
      triggerRefresh();
      setSnackbarVisible(true);
    });
  };

  const handleUndo = async () => {
    if (!deletedItem) return;
    await addTransaction({
      type: deletedItem.type,
      amount: deletedItem.amount,
      category: deletedItem.category,
      description: deletedItem.description,
      date: deletedItem.date,
      recurring: deletedItem.recurring,
      account_id: deletedItem.account_id || 1,
    });
    triggerRefresh();
    load();
    setDeletedItem(null);
    setSnackbarVisible(false);
  };

  const handleEdit = (txn) => {
    navigation.navigate('AddTransaction', { transaction: txn });
  };

  const handleDuplicate = async (id) => {
    await duplicateTransaction(id);
    triggerRefresh();
    load();
  };

  const cycleSortBy = () => {
    if (sortBy === 'date' && sortDir === 'DESC') setSortDir('ASC');
    else if (sortBy === 'date' && sortDir === 'ASC') { setSortBy('amount'); setSortDir('DESC'); }
    else if (sortBy === 'amount' && sortDir === 'DESC') setSortDir('ASC');
    else { setSortBy('date'); setSortDir('DESC'); }
  };

  const sortLabel = sortBy === 'date'
    ? (sortDir === 'DESC' ? '📅 ↓' : '📅 ↑')
    : (sortDir === 'DESC' ? '💲 ↓' : '💲 ↑');

  const clearDateRange = () => {
    setFromDate(null);
    setToDate(null);
    setShowDateRange(false);
  };

  const formatDateShort = (d) => {
    if (!d) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeTop}>
      <View style={styles.container}>
        {/* Search + Sort bar */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by category or note…"
            placeholderTextColor={THEME.textSecondary}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
          <TouchableOpacity style={styles.sortBtn} onPress={cycleSortBy}>
            <Text style={styles.sortBtnText}>{sortLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* Amount filter row */}
        <View style={styles.amountFilterRow}>
          <Text style={styles.amountFilterLabel}>$</Text>
          <TextInput
            style={styles.amountFilterInput}
            placeholder=">50 or <200 or exact"
            placeholderTextColor={THEME.textSecondary}
            value={amountFilter}
            onChangeText={v => { setAmountFilter(v); setPage(0); }}
            keyboardType="default"
            clearButtonMode="while-editing"
          />
          <TouchableOpacity
            style={[styles.dateRangeBtn, showDateRange && styles.dateRangeBtnActive]}
            onPress={() => setShowDateRange(v => !v)}
          >
            <Text style={[styles.dateRangeBtnText, showDateRange && styles.dateRangeBtnTextActive]}>📅 Range</Text>
          </TouchableOpacity>
        </View>

        {/* Date Range Picker */}
        {showDateRange && (
          <View style={styles.dateRangeRow}>
            <TouchableOpacity style={styles.datePill} onPress={() => setShowFromPicker(true)}>
              <Text style={styles.datePillLabel}>From</Text>
              <Text style={styles.datePillValue}>{formatDateShort(fromDate)}</Text>
            </TouchableOpacity>
            <Text style={styles.dateRangeSep}>→</Text>
            <TouchableOpacity style={styles.datePill} onPress={() => setShowToPicker(true)}>
              <Text style={styles.datePillLabel}>To</Text>
              <Text style={styles.datePillValue}>{formatDateShort(toDate)}</Text>
            </TouchableOpacity>
            {(fromDate || toDate) && (
              <TouchableOpacity style={styles.clearRangeBtn} onPress={clearDateRange}>
                <Text style={styles.clearRangeText}>✕ Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {showFromPicker && (
          <DateTimePicker
            value={fromDate || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(e, d) => {
              if (Platform.OS === 'android') setShowFromPicker(false);
              if (d) setFromDate(d);
            }}
            maximumDate={new Date()}
          />
        )}
        {showFromPicker && Platform.OS === 'ios' && (
          <TouchableOpacity style={styles.doneBtn} onPress={() => setShowFromPicker(false)}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        )}
        {showToPicker && (
          <DateTimePicker
            value={toDate || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(e, d) => {
              if (Platform.OS === 'android') setShowToPicker(false);
              if (d) setToDate(d);
            }}
            maximumDate={new Date()}
          />
        )}
        {showToPicker && Platform.OS === 'ios' && (
          <TouchableOpacity style={styles.doneBtn} onPress={() => setShowToPicker(false)}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        )}

        {/* Account filter chips */}
        {accounts.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.accountFilterScroll}
            contentContainerStyle={styles.accountFilterContent}
          >
            <TouchableOpacity
              style={[styles.accountFilterChip, selectedAccount === null && styles.accountFilterChipActive]}
              onPress={() => setSelectedAccount(null)}
            >
              <Text style={[styles.accountFilterText, selectedAccount === null && styles.accountFilterTextActive]}>All</Text>
            </TouchableOpacity>
            {accounts.map(acc => (
              <TouchableOpacity
                key={acc.id}
                style={[styles.accountFilterChip, selectedAccount === acc.id && styles.accountFilterChipActive]}
                onPress={() => setSelectedAccount(acc.id === selectedAccount ? null : acc.id)}
              >
                <Text style={styles.accountFilterIcon}>{acc.icon}</Text>
                <Text style={[styles.accountFilterText, selectedAccount === acc.id && styles.accountFilterTextActive]}>{acc.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Filter chips + count */}
        <View style={styles.filterBar}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.count}>{totalCount} items</Text>
        </View>

        <FlatList
          data={transactions}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <TransactionCard
              item={item}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🧾</Text>
              <Text style={styles.emptyText}>No transactions found</Text>
            </View>
          }
          ListFooterComponent={
            transactions.length < totalCount ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
                {loadingMore
                  ? <ActivityIndicator color={THEME.primary} />
                  : <Text style={styles.loadMoreText}>
                      Load more ({totalCount - transactions.length} remaining)
                    </Text>
                }
              </TouchableOpacity>
            ) : null
          }
        />

        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddTransaction', {})}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>

        <UndoSnackbar
          visible={snackbarVisible}
          message="Transaction deleted"
          onUndo={handleUndo}
          onDismiss={() => { setSnackbarVisible(false); setDeletedItem(null); }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeTop: { flex: 1, backgroundColor: THEME.surface },
  container: { flex: 1, backgroundColor: THEME.background },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 12, paddingBottom: 8, backgroundColor: THEME.surface, gap: 8,
  },
  searchInput: {
    flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, color: THEME.textPrimary,
  },
  sortBtn: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  sortBtnText: { fontSize: 14, fontWeight: '700', color: THEME.textPrimary },
  amountFilterRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingBottom: 8, backgroundColor: THEME.surface, gap: 8,
  },
  amountFilterLabel: { fontSize: 16, fontWeight: '700', color: THEME.textSecondary },
  amountFilterInput: {
    flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8, fontSize: 13, color: THEME.textPrimary,
  },
  dateRangeBtn: {
    backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
  },
  dateRangeBtnActive: { backgroundColor: THEME.primaryLight },
  dateRangeBtnText: { fontSize: 12, fontWeight: '700', color: THEME.textSecondary },
  dateRangeBtnTextActive: { color: THEME.primary },
  dateRangeRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingBottom: 8, backgroundColor: THEME.surface, gap: 8,
  },
  datePill: {
    backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7,
    alignItems: 'center',
  },
  datePillLabel: { fontSize: 10, color: THEME.textSecondary, fontWeight: '600' },
  datePillValue: { fontSize: 13, fontWeight: '700', color: THEME.textPrimary },
  dateRangeSep: { fontSize: 14, color: THEME.textSecondary },
  clearRangeBtn: { marginLeft: 'auto' },
  clearRangeText: { fontSize: 12, color: '#EF4444', fontWeight: '700' },
  doneBtn: {
    alignSelf: 'flex-end', marginHorizontal: 16, marginBottom: 4,
    paddingHorizontal: 16, paddingVertical: 6, backgroundColor: THEME.primary, borderRadius: 10,
  },
  doneBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  accountFilterScroll: { backgroundColor: THEME.surface, maxHeight: 48 },
  accountFilterContent: { paddingHorizontal: 16, paddingBottom: 8, gap: 8, flexDirection: 'row' },
  accountFilterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  accountFilterChipActive: { backgroundColor: THEME.primaryLight },
  accountFilterIcon: { fontSize: 13 },
  accountFilterText: { fontSize: 12, fontWeight: '600', color: THEME.textSecondary },
  accountFilterTextActive: { color: THEME.primary },
  filterBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 10, backgroundColor: THEME.surface,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 8,
  },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6' },
  filterBtnActive: { backgroundColor: THEME.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: THEME.textSecondary },
  filterTextActive: { color: '#FFFFFF' },
  count: { marginLeft: 'auto', fontSize: 12, color: THEME.textSecondary, fontWeight: '500' },
  list: { padding: 16, gap: 10, paddingBottom: 160 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: THEME.textSecondary, fontWeight: '500' },
  loadMoreBtn: {
    marginTop: 8, marginBottom: 16, paddingVertical: 14, borderRadius: 14,
    backgroundColor: THEME.surface, alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  loadMoreText: { fontSize: 14, fontWeight: '600', color: THEME.primary },
  fab: {
    position: 'absolute', bottom: 120, right: 24, width: 56, height: 56,
    borderRadius: 28, backgroundColor: THEME.primary, alignItems: 'center',
    justifyContent: 'center', shadowColor: THEME.primary, shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 8,
  },
  fabText: { color: '#FFFFFF', fontSize: 28, lineHeight: 32 },
});
