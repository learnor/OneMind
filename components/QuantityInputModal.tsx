import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface QuantityInputModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  onUseUp: () => void;
  currentQuantity: number;
  itemName: string;
  unit: string;
}

export default function QuantityInputModal({
  visible,
  onClose,
  onConfirm,
  onUseUp,
  currentQuantity,
  itemName,
  unit,
}: QuantityInputModalProps) {
  const { effectiveTheme } = useTheme();
  const theme = Colors[effectiveTheme];
  const isDark = effectiveTheme === 'dark';

  const [inputValue, setInputValue] = useState(currentQuantity.toString());
  const [slideAnim] = useState(new Animated.Value(300));

  useEffect(() => {
    if (visible) {
      setInputValue(currentQuantity.toString());
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, currentQuantity]);

  const handleNumberPress = (num: string) => {
    if (inputValue === '0') {
      setInputValue(num);
    } else {
      setInputValue(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    if (inputValue.length === 1) {
      setInputValue('0');
    } else {
      setInputValue(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setInputValue('0');
  };

  const handleQuickAdjust = (delta: number) => {
    const current = parseInt(inputValue) || 0;
    const newValue = Math.max(0, current + delta);
    setInputValue(newValue.toString());
  };

  const handleConfirm = () => {
    const quantity = parseInt(inputValue) || 0;
    onConfirm(quantity);
    onClose();
  };

  const handleUseUp = () => {
    onUseUp();
    onClose();
  };

  const NumberButton = ({ value, onPress, wide = false, color }: { 
    value: string; 
    onPress: () => void; 
    wide?: boolean;
    color?: string;
  }) => (
    <TouchableOpacity
      style={[
        styles.numButton,
        wide && styles.numButtonWide,
        { backgroundColor: isDark ? '#374151' : '#F3F4F6' },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.numButtonText, { color: color || theme.text }]}>
        {value}
      </Text>
    </TouchableOpacity>
  );

  const QuickButton = ({ label, delta, color }: { label: string; delta: number; color: string }) => (
    <TouchableOpacity
      style={[styles.quickButton, { backgroundColor: color + '20' }]}
      onPress={() => handleQuickAdjust(delta)}
      activeOpacity={0.7}
    >
      <Text style={[styles.quickButtonText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.container,
            { 
              backgroundColor: theme.surface,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>
                设置数量
              </Text>
              <Text style={[styles.itemName, { color: theme.textSecondary }]}>
                {itemName}
              </Text>
            </View>

            {/* Display */}
            <View style={[styles.display, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }]}>
              <Text style={[styles.displayValue, { color: theme.text }]}>
                {inputValue}
              </Text>
              <Text style={[styles.displayUnit, { color: theme.textSecondary }]}>
                {unit}
              </Text>
            </View>

            {/* Quick Adjust Buttons */}
            <View style={styles.quickRow}>
              <QuickButton label="-5" delta={-5} color="#EF4444" />
              <QuickButton label="-1" delta={-1} color="#F97316" />
              <QuickButton label="+1" delta={1} color="#10B981" />
              <QuickButton label="+5" delta={5} color="#3B82F6" />
            </View>

            {/* Number Pad */}
            <View style={styles.numPad}>
              <View style={styles.numRow}>
                <NumberButton value="1" onPress={() => handleNumberPress('1')} />
                <NumberButton value="2" onPress={() => handleNumberPress('2')} />
                <NumberButton value="3" onPress={() => handleNumberPress('3')} />
              </View>
              <View style={styles.numRow}>
                <NumberButton value="4" onPress={() => handleNumberPress('4')} />
                <NumberButton value="5" onPress={() => handleNumberPress('5')} />
                <NumberButton value="6" onPress={() => handleNumberPress('6')} />
              </View>
              <View style={styles.numRow}>
                <NumberButton value="7" onPress={() => handleNumberPress('7')} />
                <NumberButton value="8" onPress={() => handleNumberPress('8')} />
                <NumberButton value="9" onPress={() => handleNumberPress('9')} />
              </View>
              <View style={styles.numRow}>
                <NumberButton value="清空" onPress={handleClear} color={Colors.error} />
                <NumberButton value="0" onPress={() => handleNumberPress('0')} />
                <TouchableOpacity
                  style={[styles.numButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}
                  onPress={handleBackspace}
                  activeOpacity={0.7}
                >
                  <Ionicons name="backspace-outline" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.useUpButton, { backgroundColor: '#FEE2E2' }]}
                onPress={handleUseUp}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={20} color="#DC2626" />
                <Text style={[styles.useUpText, { color: '#DC2626' }]}>用完了</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: Colors.primary }]}
                onPress={handleConfirm}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark" size={22} color="#fff" />
                <Text style={styles.confirmText}>确定</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 34,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  itemName: {
    fontSize: 14,
    marginTop: 4,
  },
  display: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 16,
    marginVertical: 12,
  },
  displayValue: {
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  displayUnit: {
    fontSize: 20,
    marginLeft: 8,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  numPad: {
    marginBottom: 16,
  },
  numRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  numButton: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numButtonWide: {
    flex: 2,
  },
  numButtonText: {
    fontSize: 22,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  useUpButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  useUpText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
