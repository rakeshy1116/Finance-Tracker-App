import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { THEME } from '../utils/constants';

export default function UndoSnackbar({ visible, message, onUndo, onDismiss }) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        hide();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hide = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 100, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      onDismiss && onDismiss();
    });
  };

  const handleUndo = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 100, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      onUndo && onUndo();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.snackbar, { transform: [{ translateY }], opacity }]}>
      <Text style={styles.message} numberOfLines={1}>{message || 'Transaction deleted'}</Text>
      <TouchableOpacity onPress={handleUndo} style={styles.undoBtn} activeOpacity={0.8}>
        <Text style={styles.undoText}>UNDO</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  snackbar: {
    position: 'absolute',
    bottom: 140,
    left: 16,
    right: 16,
    backgroundColor: '#1F2937',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 12,
    zIndex: 999,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  undoBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: THEME.primary,
    borderRadius: 8,
  },
  undoText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
