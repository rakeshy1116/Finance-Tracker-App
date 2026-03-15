import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal, KeyboardAvoidingView, Platform,
  RefreshControl,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  getSavingsGoals, addSavingsGoal, deleteSavingsGoal, contributeToGoal,
} from '../db/database';
import { formatCurrency, todayISO } from '../utils/helpers';
import { THEME } from '../utils/constants';

const PRESET_EMOJIS = ['🎯','✈️','🏠','🚗','🎓','💍','🌴','💻','📱','🎸','🏋️','🎨','🌟','💎','🛳️','🍕'];
const PRESET_COLORS = [
  '#0D9488','#3B82F6','#F97316','#A855F7','#EC4899',
  '#22C55E','#EF4444','#EAB308','#6366F1','#14B8A6',
];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days;
}

function GoalCard({ goal, onContribute, onDelete }) {
  const pct = Math.min((goal.saved_amount / goal.target_amount) * 100, 100);
  const remaining = Math.max(goal.target_amount - goal.saved_amount, 0);
  const days = daysUntil(goal.deadline);
  const done = goal.saved_amount >= goal.target_amount;

  const renderDeleteAction = () => (
    <TouchableOpacity style={styles.deleteAction} onPress={() => onDelete(goal.id)}>
      <Text style={styles.deleteActionText}>🗑</Text>
      <Text style={styles.deleteActionLabel}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable
      renderRightActions={renderDeleteAction}
      rightThreshold={40}
      friction={2}
      overshootRight={false}
    >
      <TouchableOpacity style={styles.goalCard} onPress={() => onContribute(goal)} activeOpacity={0.85}>
        <View style={styles.goalHeader}>
          <View style={[styles.goalIconBg, { backgroundColor: (goal.color || THEME.primary) + '22' }]}>
            <Text style={styles.goalIconEmoji}>{goal.emoji}</Text>
          </View>
          <View style={styles.goalInfo}>
            <Text style={styles.goalName}>{goal.name}</Text>
            {days !== null && (
              <Text style={[styles.goalDeadline, { color: days < 30 ? '#EF4444' : THEME.textSecondary }]}>
                {done ? '✅ Goal reached!' : days > 0 ? `${days}d remaining` : 'Past deadline'}
              </Text>
            )}
          </View>
          <View style={styles.goalAmounts}>
            <Text style={[styles.goalSaved, { color: goal.color || THEME.primary }]}>
              {formatCurrency(goal.saved_amount)}
            </Text>
            <Text style={styles.goalTarget}>/ {formatCurrency(goal.target_amount)}</Text>
          </View>
        </View>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, {
            width: `${pct}%`,
            backgroundColor: done ? '#22C55E' : goal.color || THEME.primary,
          }]} />
        </View>
        <View style={styles.goalFooter}>
          <Text style={styles.goalPct}>{Math.round(pct)}% saved</Text>
          {!done && <Text style={styles.goalRemaining}>{formatCurrency(remaining)} to go</Text>}
          <Text style={styles.tapHint}>Tap to contribute →</Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

export default function SavingsGoalsScreen() {
  const [goals, setGoals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [contributeModal, setContributeModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);

  // Add goal form
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [color, setColor] = useState(THEME.primary);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState(null);

  // Contribute form
  const [contribution, setContribution] = useState('');

  const load = useCallback(async () => {
    const data = await getSavingsGoals();
    setGoals(data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openAddModal = () => {
    setName(''); setTarget(''); setDeadline(''); setEmoji('🎯');
    setColor(THEME.primary); setDeadlineDate(null);
    setAddModal(true);
  };

  const saveGoal = async () => {
    if (!name.trim()) { Alert.alert('Enter a goal name'); return; }
    const t = parseFloat(target);
    if (!t || t <= 0) { Alert.alert('Enter a valid target amount'); return; }
    await addSavingsGoal({
      name: name.trim(),
      target_amount: t,
      deadline: deadlineDate ? deadlineDate.toISOString().split('T')[0] : null,
      emoji,
      color,
    });
    setAddModal(false);
    load();
  };

  const handleContribute = (goal) => {
    setSelectedGoal(goal);
    setContribution('');
    setContributeModal(true);
  };

  const submitContribution = async () => {
    const amt = parseFloat(contribution);
    if (!amt || amt <= 0) { Alert.alert('Enter a valid amount'); return; }
    await contributeToGoal(selectedGoal.id, amt);
    setContributeModal(false);
    load();
  };

  const confirmDelete = (id) => {
    Alert.alert('Delete Goal', 'Remove this savings goal?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteSavingsGoal(id); load(); } },
    ]);
  };

  const totalSaved = goals.reduce((s, g) => s + g.saved_amount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0);

  return (
    <SafeAreaView edges={['top']} style={styles.safeTop}>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Hero */}
          <LinearGradient
            colors={['#0F766E', '#0D9488', '#2DD4BF']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.heroLabel}>Savings Goals</Text>
            <Text style={styles.heroBalance}>{formatCurrency(totalSaved)}</Text>
            <Text style={styles.heroSubLabel}>of {formatCurrency(totalTarget)} target</Text>
            {totalTarget > 0 && (
              <View style={styles.heroProgressBg}>
                <View style={[styles.heroProgressFill, {
                  width: `${Math.min((totalSaved / totalTarget) * 100, 100)}%`,
                }]} />
              </View>
            )}
          </LinearGradient>

          <View style={styles.content}>
            {goals.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🎯</Text>
                <Text style={styles.emptyText}>No savings goals yet</Text>
                <Text style={styles.emptySubText}>Set a goal and track your progress</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={openAddModal}>
                  <Text style={styles.emptyBtnText}>Create First Goal</Text>
                </TouchableOpacity>
              </View>
            ) : (
              goals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onContribute={handleContribute}
                  onDelete={confirmDelete}
                />
              ))
            )}
          </View>
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity style={styles.fab} onPress={openAddModal}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>

        {/* Add Goal Modal */}
        <Modal visible={addModal} animationType="slide" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
            <TouchableOpacity style={styles.overlayDismiss} onPress={() => setAddModal(false)} />
            <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled">
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>New Savings Goal</Text>

              <Text style={styles.fieldLabel}>Goal Name</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g. Dream Vacation"
                placeholderTextColor={THEME.textSecondary}
                value={name}
                onChangeText={setName}
                autoFocus
              />

              <Text style={styles.fieldLabel}>Target Amount ($)</Text>
              <TextInput
                style={styles.inputField}
                placeholder="0.00"
                placeholderTextColor={THEME.textSecondary}
                keyboardType="decimal-pad"
                value={target}
                onChangeText={setTarget}
              />

              <Text style={styles.fieldLabel}>Deadline (optional)</Text>
              <TouchableOpacity style={styles.inputField} onPress={() => setShowDatePicker(true)}>
                <Text style={{ color: deadlineDate ? THEME.textPrimary : THEME.textSecondary, fontSize: 15 }}>
                  {deadlineDate ? deadlineDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'No deadline'}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={deadlineDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => {
                    if (Platform.OS === 'android') setShowDatePicker(false);
                    if (d) setDeadlineDate(d);
                  }}
                  minimumDate={new Date()}
                />
              )}
              {showDatePicker && Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.doneBtn} onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.fieldLabel}>Emoji</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {PRESET_EMOJIS.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.emojiBtn, emoji === e && styles.emojiBtnActive]}
                    onPress={() => setEmoji(e)}
                  >
                    <Text style={styles.emojiChar}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Color</Text>
              <View style={styles.colorGrid}>
                {PRESET_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorBtn, { backgroundColor: c }, color === c && styles.colorBtnSelected]}
                    onPress={() => setColor(c)}
                  />
                ))}
              </View>

              <View style={styles.sheetBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddModal(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: color }]} onPress={saveGoal}>
                  <Text style={styles.saveBtnText}>Create Goal</Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        {/* Contribute Modal */}
        <Modal visible={contributeModal} animationType="fade" transparent>
          <View style={styles.contributeOverlay}>
            <View style={styles.contributeSheet}>
              <Text style={styles.sheetTitle}>
                {selectedGoal?.emoji} {selectedGoal?.name}
              </Text>
              <Text style={styles.contributeSubtext}>
                Currently saved: {formatCurrency(selectedGoal?.saved_amount || 0)} / {formatCurrency(selectedGoal?.target_amount || 0)}
              </Text>
              <Text style={styles.fieldLabel}>Contribution Amount ($)</Text>
              <TextInput
                style={styles.inputField}
                placeholder="0.00"
                placeholderTextColor={THEME.textSecondary}
                keyboardType="decimal-pad"
                value={contribution}
                onChangeText={setContribution}
                autoFocus
              />
              <View style={styles.sheetBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setContributeModal(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: selectedGoal?.color || THEME.primary }]} onPress={submitContribution}>
                  <Text style={styles.saveBtnText}>Add Funds</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeTop: { flex: 1, backgroundColor: '#0F766E' },
  container: { flex: 1, backgroundColor: THEME.background },
  hero: { paddingTop: 20, paddingBottom: 32, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' },
  heroBalance: { color: '#FFFFFF', fontSize: 44, fontWeight: '800', marginTop: 4, letterSpacing: -1 },
  heroSubLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  heroProgressBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden', marginTop: 16 },
  heroProgressFill: { height: '100%', borderRadius: 3, backgroundColor: '#FFFFFF' },
  content: { padding: 16, gap: 12 },
  goalCard: {
    backgroundColor: THEME.surface, borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 3,
  },
  goalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  goalIconBg: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  goalIconEmoji: { fontSize: 26 },
  goalInfo: { flex: 1 },
  goalName: { fontSize: 16, fontWeight: '700', color: THEME.textPrimary },
  goalDeadline: { fontSize: 12, marginTop: 3, fontWeight: '500' },
  goalAmounts: { alignItems: 'flex-end' },
  goalSaved: { fontSize: 16, fontWeight: '800' },
  goalTarget: { fontSize: 12, color: THEME.textSecondary, fontWeight: '500' },
  progressBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 4 },
  goalFooter: { flexDirection: 'row', alignItems: 'center' },
  goalPct: { fontSize: 12, color: THEME.textSecondary, fontWeight: '600' },
  goalRemaining: { fontSize: 12, color: THEME.textSecondary, marginLeft: 8, fontWeight: '500' },
  tapHint: { marginLeft: 'auto', fontSize: 12, color: THEME.primary, fontWeight: '600' },
  deleteAction: {
    backgroundColor: '#EF4444', borderRadius: 20, marginLeft: 8,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, minWidth: 72,
  },
  deleteActionText: { fontSize: 20, color: '#FFFFFF' },
  deleteActionLabel: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: THEME.textPrimary },
  emptySubText: { fontSize: 13, color: THEME.textSecondary, marginTop: 6, textAlign: 'center' },
  emptyBtn: { marginTop: 20, backgroundColor: THEME.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
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
    padding: 24, maxHeight: '85%',
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: THEME.textPrimary, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: THEME.textSecondary, marginBottom: 8, letterSpacing: 0.3 },
  inputField: {
    backgroundColor: '#F9FAFB', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: THEME.textPrimary, marginBottom: 16,
  },
  doneBtn: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: THEME.primary, borderRadius: 10, marginBottom: 8 },
  doneBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  emojiBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: '#F3F4F6' },
  emojiBtnActive: { backgroundColor: THEME.primaryLight, borderWidth: 2, borderColor: THEME.primary },
  emojiChar: { fontSize: 22 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  colorBtn: { width: 36, height: 36, borderRadius: 18 },
  colorBtnSelected: { borderWidth: 3, borderColor: THEME.textPrimary },
  sheetBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: '#F3F4F6' },
  cancelText: { fontSize: 15, fontWeight: '700', color: THEME.textSecondary },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  // Contribute modal
  contributeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  contributeSheet: { backgroundColor: THEME.surface, borderRadius: 24, padding: 24 },
  contributeSubtext: { fontSize: 13, color: THEME.textSecondary, marginBottom: 20, fontWeight: '500' },
});
