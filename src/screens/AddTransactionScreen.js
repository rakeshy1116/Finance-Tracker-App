import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { addTransaction, updateTransaction, getCustomCategories, getAccounts } from '../db/database';
import { CATEGORIES, INCOME_CATEGORIES, THEME } from '../utils/constants';
import { todayISO } from '../utils/helpers';
import { useAppContext } from '../utils/AppContext';
import { CATEGORY_EMOJI, customEmojiMap, customColorMap } from '../components/CategoryIcon';

export default function AddTransactionScreen({ navigation, route }) {
  const { triggerRefresh } = useAppContext();
  const onSaved = route.params?.onSaved;
  const editTxn = route.params?.transaction ?? null;
  const isEditing = editTxn != null;
  const defaultType = route.params?.defaultType || 'expense';

  const [type, setType] = useState(editTxn?.type || defaultType);
  const [amount, setAmount] = useState(editTxn ? String(editTxn.amount) : '');
  const [category, setCategory] = useState(editTxn?.category || '');
  const [description, setDescription] = useState(editTxn?.description || '');
  const [date, setDate] = useState(editTxn?.date || todayISO());
  const [recurring, setRecurring] = useState(editTxn?.recurring === 1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customCategories, setCustomCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(editTxn?.account_id || 1);

  const isExpense = type === 'expense';

  useEffect(() => {
    getCustomCategories().then(setCustomCategories);
    getAccounts().then(accs => {
      setAccounts(accs);
      if (!editTxn && accs.length > 0) {
        setSelectedAccount(accs[0].id);
      }
    });
  }, []);

  const builtinCategories = type === 'expense' ? CATEGORIES : INCOME_CATEGORIES;
  const filteredCustom = customCategories.filter(c => c.type === type);
  const allCategories = [
    ...builtinCategories.map(name => ({ name, isCustom: false })),
    ...filteredCustom.map(c => ({ name: c.name, isCustom: true, emoji: c.emoji, color: c.color })),
  ];

  const getCatEmoji = (cat) => {
    return customEmojiMap[cat.name] || cat.emoji || CATEGORY_EMOJI[cat.name] || '•';
  };

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDate(selectedDate.toISOString().split('T')[0]);
    }
  };

  const save = async () => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }
    if (!category) {
      Alert.alert('Select a category', 'Please pick a category.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type, amount: parseFloat(amount), category, description, date, recurring,
        account_id: selectedAccount || 1,
      };
      if (isEditing) {
        await updateTransaction({ id: editTxn.id, ...payload });
      } else {
        await addTransaction(payload);
      }
      triggerRefresh();
      onSaved?.();
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save transaction.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Type Toggle — hidden in edit mode since type is fixed */}
        {!isEditing && (
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, isExpense && styles.toggleExpenseActive]}
              onPress={() => { setType('expense'); setCategory(''); }}
            >
              <Text style={[styles.toggleText, isExpense && styles.toggleTextActive]}>💸 Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, !isExpense && styles.toggleIncomeActive]}
              onPress={() => { setType('income'); setCategory(''); }}
            >
              <Text style={[styles.toggleText, !isExpense && styles.toggleTextActive]}>💰 Income</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Amount Card */}
        <LinearGradient
          colors={isExpense ? ['#EF4444', '#F87171'] : ['#22C55E', '#4ADE80']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.amountCard, isEditing && styles.amountCardEditing]}
        >
          <Text style={styles.amountHint}>Enter amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.5)"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
        </LinearGradient>

        <View style={styles.body}>

          {/* Account Selector */}
          {accounts.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>🏦  Account</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.accountRow}>
                  {accounts.map(acc => (
                    <TouchableOpacity
                      key={acc.id}
                      style={[styles.accountChip, selectedAccount === acc.id && styles.accountChipActive]}
                      onPress={() => setSelectedAccount(acc.id)}
                    >
                      <Text style={styles.accountChipIcon}>{acc.icon}</Text>
                      <Text style={[styles.accountChipText, selectedAccount === acc.id && styles.accountChipTextActive]}>
                        {acc.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Date Picker */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>📅  Date</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
              <Text style={styles.dateText}>{date}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={new Date(date + 'T12:00:00')}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.doneBtn} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Recurring Toggle */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>🔁  Recurring transaction</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchDesc}>Mark as a recurring expense or income</Text>
              <Switch
                value={recurring}
                onValueChange={setRecurring}
                trackColor={{ false: '#E5E7EB', true: THEME.primaryLight }}
                thumbColor={recurring ? THEME.primary : '#9CA3AF'}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>📝  Note (optional)</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="What was this for?"
              placeholderTextColor={THEME.textSecondary}
            />
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>🏷️  Category</Text>
            <View style={styles.categoryGrid}>
              {allCategories.map(cat => (
                <TouchableOpacity
                  key={cat.name}
                  style={[styles.catChip, category === cat.name && styles.catChipActive]}
                  onPress={() => setCategory(cat.name)}
                >
                  <Text style={styles.catEmoji}>{getCatEmoji(cat)}</Text>
                  <Text style={[styles.catLabel, category === cat.name && styles.catLabelActive]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.manageCatChip}
                onPress={() => navigation.navigate('ManageCategories')}
              >
                <Text style={styles.catEmoji}>⚙️</Text>
                <Text style={styles.manageCatLabel}>Manage</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={save}
            disabled={saving}
          >
            <LinearGradient
              colors={isExpense ? ['#EF4444', '#F87171'] : ['#22C55E', '#4ADE80']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.saveBtnGradient}
            >
              <Text style={styles.saveBtnText}>
                {saving ? 'Saving…' : isEditing ? 'Update Transaction' : `Save ${isExpense ? 'Expense' : 'Income'}`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  toggleRow: {
    flexDirection: 'row', margin: 16, backgroundColor: '#F3F4F6',
    borderRadius: 16, padding: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  toggleExpenseActive: { backgroundColor: '#EF4444' },
  toggleIncomeActive: { backgroundColor: '#22C55E' },
  toggleText: { fontSize: 14, fontWeight: '600', color: THEME.textSecondary },
  toggleTextActive: { color: '#FFFFFF' },
  amountCard: { marginHorizontal: 16, borderRadius: 24, padding: 28, marginBottom: 4 },
  amountCardEditing: { marginTop: 16 },
  amountHint: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },
  amountRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  currencySymbol: { color: 'rgba(255,255,255,0.85)', fontSize: 36, fontWeight: '700', marginRight: 2 },
  amountInput: { flex: 1, fontSize: 52, fontWeight: '800', color: '#FFFFFF' },
  body: { padding: 16, paddingBottom: 40 },
  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: THEME.textSecondary, marginBottom: 8, letterSpacing: 0.3 },
  input: {
    backgroundColor: THEME.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: THEME.textPrimary, borderWidth: 1, borderColor: '#E5E7EB',
  },
  dateText: { fontSize: 15, color: THEME.textPrimary },
  doneBtn: {
    alignSelf: 'flex-end', marginTop: 8, paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: THEME.primary, borderRadius: 10,
  },
  doneBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  accountRow: { flexDirection: 'row', gap: 8 },
  accountChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14,
    backgroundColor: THEME.surface, borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  accountChipActive: { backgroundColor: '#CCFBF1', borderColor: THEME.primary },
  accountChipIcon: { fontSize: 16 },
  accountChipText: { fontSize: 13, color: THEME.textSecondary, fontWeight: '500' },
  accountChipTextActive: { color: THEME.primary, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: THEME.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  switchDesc: { fontSize: 14, color: THEME.textSecondary, flex: 1, marginRight: 12 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    backgroundColor: THEME.surface, borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  catChipActive: { backgroundColor: '#CCFBF1', borderColor: THEME.primary },
  catEmoji: { fontSize: 14 },
  catLabel: { fontSize: 12, color: THEME.textSecondary, fontWeight: '500' },
  catLabelActive: { color: THEME.primary, fontWeight: '700' },
  manageCatChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  manageCatLabel: { fontSize: 12, color: THEME.textSecondary, fontWeight: '700' },
  saveBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  saveBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
