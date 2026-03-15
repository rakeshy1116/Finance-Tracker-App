import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getCustomCategories, addCustomCategory, deleteCustomCategory,
} from '../db/database';
import { CATEGORIES, INCOME_CATEGORIES, THEME } from '../utils/constants';
import { setCustomCategoryMaps } from '../components/CategoryIcon';

const PRESET_EMOJIS = [
  '🍕','🛒','🎮','📱','🏋️','🎵','🐾','🌿','🏖️','🎨',
  '💇','🚀','🏡','🌟','💡','🔧','🎭','🍷','☕','🎯',
  '🧳','🎸','🎤','📷','🌺','🦋','🏄','🎲','🧠','💎',
];

const PRESET_COLORS = [
  '#F97316','#0EA5E9','#A855F7','#EC4899','#14B8A6',
  '#6366F1','#EAB308','#3B82F6','#F43F5E','#8B5CF6',
  '#10B981','#94A3B8',
];

export default function ManageCategoriesScreen({ navigation }) {
  const [customCategories, setCustomCategoriesState] = useState([]);
  const [modal, setModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('expense');
  const [newEmoji, setNewEmoji] = useState('💰');
  const [newColor, setNewColor] = useState('#0D9488');

  const load = useCallback(async () => {
    const cats = await getCustomCategories();
    setCustomCategoriesState(cats);
    // Update global emoji/color maps
    const emojiMap = {};
    const colorMap = {};
    cats.forEach(c => {
      emojiMap[c.name] = c.emoji;
      colorMap[c.name] = c.color;
    });
    setCustomCategoryMaps(emojiMap, colorMap);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openModal = () => {
    setNewName('');
    setNewType('expense');
    setNewEmoji('💰');
    setNewColor(PRESET_COLORS[0]);
    setModal(true);
  };

  const saveCategory = async () => {
    const name = newName.trim();
    if (!name) { Alert.alert('Enter a category name'); return; }
    const allBuiltin = [...CATEGORIES, ...INCOME_CATEGORIES];
    if (allBuiltin.includes(name)) {
      Alert.alert('Name taken', 'This name matches a built-in category. Choose a different name.');
      return;
    }
    await addCustomCategory({ name, type: newType, emoji: newEmoji, color: newColor });
    setModal(false);
    load();
  };

  const confirmDelete = (id, name) => {
    Alert.alert('Delete Category', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteCustomCategory(id); load(); },
      },
    ]);
  };

  const renderDeleteAction = (id, name) => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => confirmDelete(id, name)}
    >
      <Text style={styles.deleteActionText}>🗑</Text>
      <Text style={styles.deleteActionLabel}>Delete</Text>
    </TouchableOpacity>
  );

  const builtinExpense = CATEGORIES;
  const builtinIncome = INCOME_CATEGORIES;

  return (
    <SafeAreaView edges={['top']} style={styles.safeTop}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Manage Categories</Text>
          <TouchableOpacity onPress={openModal} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* Custom Categories */}
          {customCategories.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Custom Categories</Text>
              {customCategories.map(cat => (
                <Swipeable
                  key={cat.id}
                  renderRightActions={() => renderDeleteAction(cat.id, cat.name)}
                  rightThreshold={40}
                  friction={2}
                  overshootRight={false}
                >
                  <View style={styles.catRow}>
                    <View style={[styles.catIconBg, { backgroundColor: (cat.color || '#94A3B8') + '22' }]}>
                      <Text style={styles.catIconEmoji}>{cat.emoji}</Text>
                    </View>
                    <View style={styles.catInfo}>
                      <Text style={styles.catName}>{cat.name}</Text>
                      <Text style={styles.catType}>{cat.type === 'expense' ? '💸 Expense' : '💰 Income'}</Text>
                    </View>
                    <View style={[styles.colorDot, { backgroundColor: cat.color }]} />
                  </View>
                </Swipeable>
              ))}
            </View>
          )}

          {customCategories.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🏷️</Text>
              <Text style={styles.emptyText}>No custom categories yet</Text>
              <Text style={styles.emptySubText}>Tap "+ Add" to create your own categories</Text>
            </View>
          )}

          {/* Built-in Expense */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Built-in Expense Categories</Text>
            <View style={styles.builtinGrid}>
              {builtinExpense.map(cat => (
                <View key={cat} style={styles.builtinChip}>
                  <Text style={styles.builtinText}>{cat}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Built-in Income */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Built-in Income Categories</Text>
            <View style={styles.builtinGrid}>
              {builtinIncome.map(cat => (
                <View key={cat} style={[styles.builtinChip, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.builtinText, { color: '#15803D' }]}>{cat}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Add Modal */}
        <Modal visible={modal} animationType="slide" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.overlay}
          >
            <TouchableOpacity style={styles.overlayDismiss} onPress={() => setModal(false)} />
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>New Category</Text>

              {/* Type toggle */}
              <View style={styles.typeToggle}>
                <TouchableOpacity
                  style={[styles.typeBtn, newType === 'expense' && styles.typeBtnExpense]}
                  onPress={() => setNewType('expense')}
                >
                  <Text style={[styles.typeBtnText, newType === 'expense' && styles.typeBtnTextActive]}>💸 Expense</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, newType === 'income' && styles.typeBtnIncome]}
                  onPress={() => setNewType('income')}
                >
                  <Text style={[styles.typeBtnText, newType === 'income' && styles.typeBtnTextActive]}>💰 Income</Text>
                </TouchableOpacity>
              </View>

              {/* Name input */}
              <Text style={styles.fieldLabel}>Category Name</Text>
              <TextInput
                style={styles.nameInput}
                placeholder="e.g. Subscriptions"
                placeholderTextColor={THEME.textSecondary}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                maxLength={24}
              />

              {/* Emoji picker */}
              <Text style={styles.fieldLabel}>Emoji</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiScroll}>
                {PRESET_EMOJIS.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.emojiBtn, newEmoji === e && styles.emojiBtnActive]}
                    onPress={() => setNewEmoji(e)}
                  >
                    <Text style={styles.emojiChar}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Color picker */}
              <Text style={styles.fieldLabel}>Color</Text>
              <View style={styles.colorGrid}>
                {PRESET_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorBtn, { backgroundColor: c }, newColor === c && styles.colorBtnSelected]}
                    onPress={() => setNewColor(c)}
                  />
                ))}
              </View>

              {/* Preview */}
              <View style={styles.preview}>
                <View style={[styles.previewIcon, { backgroundColor: newColor + '22' }]}>
                  <Text style={styles.previewEmoji}>{newEmoji}</Text>
                </View>
                <Text style={styles.previewName}>{newName || 'Category Name'}</Text>
              </View>

              <View style={styles.sheetBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveCategory}>
                  <Text style={styles.saveBtnText}>Save Category</Text>
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
  safeTop: { flex: 1, backgroundColor: THEME.surface },
  container: { flex: 1, backgroundColor: THEME.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: THEME.surface,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { padding: 4 },
  backText: { color: THEME.primary, fontSize: 15, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: THEME.textPrimary },
  addBtn: {
    backgroundColor: THEME.primary, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  content: { padding: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: THEME.textPrimary, marginBottom: 10 },
  catRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.surface,
    borderRadius: 16, padding: 14, marginBottom: 8, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  catIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  catIconEmoji: { fontSize: 22 },
  catInfo: { flex: 1 },
  catName: { fontSize: 15, fontWeight: '700', color: THEME.textPrimary },
  catType: { fontSize: 12, color: THEME.textSecondary, marginTop: 2 },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  deleteAction: {
    backgroundColor: '#EF4444', borderRadius: 16, marginLeft: 8,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 20, minWidth: 72, marginBottom: 8,
  },
  deleteActionText: { fontSize: 20, color: '#FFFFFF' },
  deleteActionLabel: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 10 },
  emptyText: { fontSize: 16, fontWeight: '700', color: THEME.textPrimary },
  emptySubText: { fontSize: 13, color: THEME.textSecondary, marginTop: 6, textAlign: 'center' },
  builtinGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  builtinChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: '#EFF9F8', borderWidth: 1, borderColor: '#D0F0EC',
  },
  builtinText: { fontSize: 12, color: THEME.textSecondary, fontWeight: '500' },
  // Modal
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: THEME.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: THEME.textPrimary, marginBottom: 16 },
  typeToggle: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 14, padding: 4, marginBottom: 16 },
  typeBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  typeBtnExpense: { backgroundColor: '#EF4444' },
  typeBtnIncome: { backgroundColor: '#22C55E' },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: THEME.textSecondary },
  typeBtnTextActive: { color: '#FFFFFF' },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: THEME.textSecondary, marginBottom: 8, letterSpacing: 0.3 },
  nameInput: {
    backgroundColor: '#F0FDFA', borderRadius: 14, borderWidth: 1.5, borderColor: '#D0F0EC',
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: THEME.textPrimary, marginBottom: 16,
  },
  emojiScroll: { marginBottom: 16 },
  emojiBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: '#F3F4F6' },
  emojiBtnActive: { backgroundColor: THEME.primaryLight, borderWidth: 2, borderColor: THEME.primary },
  emojiChar: { fontSize: 22 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  colorBtn: { width: 36, height: 36, borderRadius: 18 },
  colorBtnSelected: { borderWidth: 3, borderColor: THEME.textPrimary },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F0FDFA', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#D0F0EC' },
  previewIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  previewEmoji: { fontSize: 22 },
  previewName: { fontSize: 16, fontWeight: '700', color: THEME.textPrimary },
  sheetBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: '#F3F4F6',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: THEME.textSecondary },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: THEME.primary,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
