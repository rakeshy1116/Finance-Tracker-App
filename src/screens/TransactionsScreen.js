import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTransactions, getTransactionCount, deleteTransaction } from '../db/database';
import { THEME } from '../utils/constants';
import { useAppContext } from '../utils/AppContext';
import TransactionCard from '../components/TransactionCard';

const FILTERS = ['All', 'Expense', 'Income'];
const PAGE_SIZE = 20;

export default function TransactionsScreen({ navigation }) {
  const { refreshKey } = useAppContext();
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('DESC');
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounce search — reset page on new query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const [rows, count] = await Promise.all([
      getTransactions({
        type: filter,
        limit: PAGE_SIZE,
        offset: 0,
        search: debouncedSearch || undefined,
        sortBy,
        sortDir,
      }),
      getTransactionCount({
        type: filter,
        search: debouncedSearch || undefined,
      }),
    ]);
    setTransactions(rows);
    setTotalCount(count);
    setPage(0);
  }, [filter, debouncedSearch, sortBy, sortDir]);

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
    });
    setTransactions(prev => [...prev, ...rows]);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Transaction', 'Remove this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTransaction(id); load(); } },
    ]);
  };

  const handleEdit = (txn) => {
    navigation.navigate('AddTransaction', { transaction: txn });
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
            <TransactionCard item={item} onDelete={handleDelete} onEdit={handleEdit} />
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
  list: { padding: 16, gap: 10, paddingBottom: 140 },
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
