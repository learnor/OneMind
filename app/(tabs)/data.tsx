import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  FlatList,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { useEffectiveColorScheme } from '@/lib/ThemeContext';
import { useNavigation } from '@/lib/navigationContext';
import { navigationEvents } from '@/lib/navigationEvents';
import {
  FinanceSkeleton,
  TodoSkeleton,
  InventorySkeleton,
} from '@/components/SkeletonLoader';
import {
  SpendingTrendChart,
  CategoryPieChart,
  WeeklySummaryCard,
} from '@/components/Charts';
import QuantityInputModal from '@/components/QuantityInputModal';
import {
  getFinanceRecords,
  getFinanceStats,
  deleteFinanceRecord,
  updateFinanceRecord,
  getActions,
  updateActionStatus,
  deleteAction,
  getInventoryItems,
  updateInventoryQuantity,
  deleteInventoryItem,
  getSpendingTrend,
  getCategoryBreakdown,
  getWeeklyStats,
  type FinanceStats,
  type TrendChartData,
  type CategoryChartData,
  type WeeklyStats,
} from '@/lib/dataService';
import type { FinanceRecord, Action, InventoryItem } from '@/lib/types';

type TabType = 'finance' | 'todo' | 'inventory';

// ============ Segment Control ============
interface SegmentControlProps {
  tabs: { key: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[];
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  colorScheme: 'light' | 'dark';
}

function SegmentControl({ tabs, activeTab, onTabChange, colorScheme }: SegmentControlProps) {
  const colors = Colors[colorScheme];
  
  return (
    <View style={[styles.segmentContainer, { backgroundColor: colors.surface }]}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.segmentButton,
            activeTab === tab.key && { backgroundColor: Colors.primary },
          ]}
          onPress={() => onTabChange(tab.key)}
        >
          <Ionicons
            name={tab.icon}
            size={18}
            color={activeTab === tab.key ? '#fff' : colors.textSecondary}
          />
          <Text
            style={[
              styles.segmentLabel,
              { color: activeTab === tab.key ? '#fff' : colors.textSecondary },
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ============ Finance Section ============
interface FinanceSectionProps {
  records: FinanceRecord[];
  stats: FinanceStats | null;
  trendData: TrendChartData;
  categoryData: CategoryChartData[];
  weeklyStats: WeeklyStats;
  colorScheme: 'light' | 'dark';
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<FinanceRecord>) => void;
}

function FinanceSection({ 
  records, 
  stats, 
  trendData, 
  categoryData, 
  weeklyStats,
  colorScheme, 
  onDelete,
  onUpdate
}: FinanceSectionProps) {
  const colors = Colors[colorScheme];

  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [selectedEssential, setSelectedEssential] = useState<'all' | 'essential' | 'non-essential'>('all');
  const [editingRecord, setEditingRecord] = useState<FinanceRecord | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editEssential, setEditEssential] = useState(false);

  const formatAmount = (amount: number) => `¥${amount.toFixed(2)}`;

  const handleDelete = (record: FinanceRecord) => {
    Alert.alert('删除记录', '确定要删除这条消费记录吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => onDelete(record.id) },
    ]);
  };

  const handleEditOpen = (record: FinanceRecord) => {
    setEditingRecord(record);
    setEditAmount(record.amount?.toString() || '');
    setEditCategory(record.category || '');
    setEditDescription(record.description || '');
    setEditEssential(Boolean(record.is_essential));
  };

  const handleEditSave = () => {
    if (!editingRecord) return;
    const amount = Number(editAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('金额错误', '请输入有效的金额');
      return;
    }

    onUpdate(editingRecord.id, {
      amount,
      category: editCategory.trim() || '未分类',
      description: editDescription.trim() || null,
      is_essential: editEssential,
    });

    setEditingRecord(null);
  };

  const categories = Array.from(new Set(records.map(record => record.category || '未分类')));
  const defaultCategories = ['餐饮', '交通', '购物', '娱乐', '生活', '医疗', '教育', '其他'];
  const categoryOptions = Array.from(new Set([...defaultCategories, ...categories]));

  const filteredRecords = records.filter(record => {
    const category = record.category || '未分类';
    const matchesCategory = selectedCategory === 'all' || category === selectedCategory;
    const matchesEssential = selectedEssential === 'all'
      ? true
      : selectedEssential === 'essential'
        ? record.is_essential === true
        : record.is_essential === false || record.is_essential === null;
    return matchesCategory && matchesEssential;
  });

  if (records.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="wallet-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无消费记录</Text>
      </View>
    );
  }

  return (
    <View style={styles.sectionContent}>
      {/* Weekly Summary */}
      <WeeklySummaryCard
        thisWeek={weeklyStats.thisWeek}
        lastWeek={weeklyStats.lastWeek}
        averageDaily={weeklyStats.averageDaily}
      />

      {/* Spending Trend Chart */}
      <SpendingTrendChart data={trendData} title="最近7天消费趋势" />

      {/* Category Pie Chart */}
      <CategoryPieChart data={categoryData} title="消费分类占比" />

      {/* Stats Cards */}
      {stats && (
        <View style={styles.statsGrid}>
          <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>总支出</Text>
            <Text style={[styles.statsValue, { color: Colors.error }]}>{formatAmount(stats.total)}</Text>
          </View>
          <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>记录数</Text>
            <Text style={[styles.statsValue, { color: Colors.primary }]}>{stats.count}</Text>
          </View>
          <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>必要支出</Text>
            <Text style={[styles.statsValue, { color: Colors.accent }]}>{formatAmount(stats.essentialTotal)}</Text>
          </View>
          <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>非必要</Text>
            <Text style={[styles.statsValue, { color: Colors.accentWarm }]}>{formatAmount(stats.nonEssentialTotal)}</Text>
          </View>
        </View>
      )}

      {/* Finance Filters */}
      <View style={[styles.financeFilterRow, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>筛选</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.financeFilterChips}
        >
          <TouchableOpacity
            style={[
              styles.financeFilterChip,
              { backgroundColor: selectedEssential === 'all' ? Colors.primary : colors.border },
            ]}
            onPress={() => setSelectedEssential('all')}
          >
            <Text style={[styles.financeFilterText, { color: selectedEssential === 'all' ? '#fff' : colors.text }]}>全部</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.financeFilterChip,
              { backgroundColor: selectedEssential === 'essential' ? Colors.accent : colors.border },
            ]}
            onPress={() => setSelectedEssential('essential')}
          >
            <Text style={[styles.financeFilterText, { color: selectedEssential === 'essential' ? '#fff' : colors.text }]}>必要</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.financeFilterChip,
              { backgroundColor: selectedEssential === 'non-essential' ? Colors.accentWarm : colors.border },
            ]}
            onPress={() => setSelectedEssential('non-essential')}
          >
            <Text style={[styles.financeFilterText, { color: selectedEssential === 'non-essential' ? '#fff' : colors.text }]}>非必要</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.financeFilterChip,
              { backgroundColor: selectedCategory === 'all' ? Colors.primary : colors.border },
            ]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text style={[styles.financeFilterText, { color: selectedCategory === 'all' ? '#fff' : colors.text }]}>全部分类</Text>
          </TouchableOpacity>
          {categories.map((category) => {
            const isSelected = selectedCategory === category;
            return (
              <TouchableOpacity
                key={category}
                style={[
                  styles.financeFilterChip,
                  { backgroundColor: isSelected ? Colors.primary : colors.border },
                ]}
                onPress={() => setSelectedCategory(isSelected ? 'all' : category)}
              >
                <Text style={[styles.financeFilterText, { color: isSelected ? '#fff' : colors.text }]}>
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {filteredRecords.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="wallet-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无符合条件的记录</Text>
        </View>
      )}

      {/* Records List */}
      {filteredRecords.length > 0 && (
        <View style={[styles.listSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>消费明细</Text>
          {filteredRecords.slice(0, 10).map((record) => (
            <TouchableOpacity
              key={record.id}
              style={styles.recordItem}
              onPress={() => handleEditOpen(record)}
              onLongPress={() => handleDelete(record)}
            >
            <View style={styles.recordLeft}>
              <View style={[styles.recordIcon, { backgroundColor: Colors.accentWarm + '20' }]}>
                <Ionicons name="cart-outline" size={20} color={Colors.accentWarm} />
              </View>
              <View>
                <Text style={[styles.recordCategory, { color: colors.text }]}>
                  {record.category || '未分类'}
                </Text>
                {record.description && (
                  <Text style={[styles.recordDescription, { color: colors.textSecondary }]} numberOfLines={1}>
                    {record.description}
                  </Text>
                )}
                <Text style={[styles.recordDate, { color: colors.textSecondary }]}>
                  {new Date(record.created_at).toLocaleDateString('zh-CN')}
                </Text>
              </View>
            </View>
            <View style={styles.recordRight}>
              <Text style={[styles.recordAmount, { color: Colors.error }]}>
                -{formatAmount(record.amount)}
              </Text>
              {record.emotion_tag && (
                <Text style={[styles.recordEmotion, { color: colors.textSecondary }]}>
                  {record.emotion_tag}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
        {filteredRecords.length > 10 && (
          <Text style={[styles.moreText, { color: colors.textSecondary }]}>
            还有 {filteredRecords.length - 10} 条记录...
          </Text>
        )}
      </View>
      )}

      <Modal
        visible={!!editingRecord}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingRecord(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.financeModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>编辑消费记录</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="金额"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              value={editAmount}
              onChangeText={setEditAmount}
            />
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="分类"
              placeholderTextColor={colors.textSecondary}
              value={editCategory}
              onChangeText={setEditCategory}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modalChipRow}
            >
              {categoryOptions.map((category) => {
                const isSelected = editCategory.trim() === category;
                return (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.modalChip,
                      { backgroundColor: isSelected ? Colors.primary : colors.border },
                    ]}
                    onPress={() => setEditCategory(category)}
                  >
                    <Text style={[styles.modalChipText, { color: isSelected ? '#fff' : colors.text }]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea, { color: colors.text, borderColor: colors.border }]}
              placeholder="描述（可选）"
              placeholderTextColor={colors.textSecondary}
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
            />
            <View style={styles.modalSwitchRow}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>必要支出</Text>
              <Switch value={editEssential} onValueChange={setEditEssential} />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.border }]}
                onPress={() => setEditingRecord(null)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: Colors.primary }]}
                onPress={handleEditSave}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <View style={{ height: 100 }} />
    </View>
  );
}

// ============ Todo Section ============
interface TodoSectionProps {
  actions: Action[];
  colorScheme: 'light' | 'dark';
  onToggle: (id: string, status: 'pending' | 'completed') => void;
  onDelete: (id: string) => void;
}

function TodoSection({ actions, colorScheme, onToggle, onDelete }: TodoSectionProps) {
  const colors = Colors[colorScheme];
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'completed' | 'high'>('all');

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 3: return Colors.error;
      case 2: return Colors.accentWarm;
      default: return Colors.accent;
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 3: return '高';
      case 2: return '中';
      default: return '低';
    }
  };

  const handleDelete = (action: Action) => {
    Alert.alert('删除任务', '确定要删除这条任务吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => onDelete(action.id) },
    ]);
  };

  if (actions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="checkbox-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无待办事项</Text>
      </View>
    );
  }

  const pendingActions = actions.filter(a => a.status === 'pending');
  const completedActions = actions.filter(a => a.status === 'completed');
  const highPriorityActions = pendingActions.filter(action => action.priority === 3);

  const visiblePending = selectedFilter === 'high' ? highPriorityActions : pendingActions;
  const showPending = selectedFilter === 'all' || selectedFilter === 'pending' || selectedFilter === 'high';
  const showCompleted = selectedFilter === 'all' || selectedFilter === 'completed';
  const filteredCount = selectedFilter === 'all'
    ? actions.length
    : selectedFilter === 'pending'
      ? pendingActions.length
      : selectedFilter === 'completed'
        ? completedActions.length
        : highPriorityActions.length;

  return (
    <View style={styles.sectionContent}>
      {/* Filter */}
      <View style={[styles.todoFilterRow, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[
            styles.todoFilterChip,
            { backgroundColor: selectedFilter === 'all' ? Colors.primary : colors.border },
          ]}
          onPress={() => setSelectedFilter('all')}
        >
          <Text style={[styles.todoFilterText, { color: selectedFilter === 'all' ? '#fff' : colors.text }]}>全部</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.todoFilterChip,
            { backgroundColor: selectedFilter === 'pending' ? Colors.primary : colors.border },
          ]}
          onPress={() => setSelectedFilter('pending')}
        >
          <Text style={[styles.todoFilterText, { color: selectedFilter === 'pending' ? '#fff' : colors.text }]}>待完成 {pendingActions.length}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.todoFilterChip,
            { backgroundColor: selectedFilter === 'completed' ? Colors.primary : colors.border },
          ]}
          onPress={() => setSelectedFilter('completed')}
        >
          <Text style={[styles.todoFilterText, { color: selectedFilter === 'completed' ? '#fff' : colors.text }]}>已完成 {completedActions.length}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.todoFilterChip,
            { backgroundColor: selectedFilter === 'high' ? Colors.error : colors.border },
          ]}
          onPress={() => setSelectedFilter('high')}
        >
          <Ionicons name="alert-circle" size={14} color={selectedFilter === 'high' ? '#fff' : Colors.error} />
          <Text
            style={[
              styles.todoFilterText,
              { color: selectedFilter === 'high' ? '#fff' : colors.text },
              { marginLeft: 4 },
            ]}
          >
            高优先 {highPriorityActions.length}
          </Text>
        </TouchableOpacity>
      </View>

      {filteredCount === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkbox-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无符合条件的任务</Text>
        </View>
      )}

      {/* Pending */}
      {showPending && visiblePending.length > 0 && (
        <View style={[styles.listSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>待完成 ({visiblePending.length})</Text>
          {visiblePending.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.todoItem}
              onPress={() => onToggle(action.id, 'completed')}
              onLongPress={() => handleDelete(action)}
            >
              <View style={styles.todoLeft}>
                <View style={[styles.checkbox, { borderColor: colors.border }]}>
                  <View style={styles.checkboxInner} />
                </View>
                <View style={styles.todoContent}>
                  <Text style={[styles.todoTitle, { color: colors.text }]}>{action.title}</Text>
                  <View style={styles.todoMeta}>
                    <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(action.priority) + '20' }]}>
                      <Text style={[styles.priorityText, { color: getPriorityColor(action.priority) }]}>
                        {getPriorityLabel(action.priority)}优先
                      </Text>
                    </View>
                    <Text style={[styles.todoType, { color: colors.textSecondary }]}>{action.type}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Completed */}
      {completedActions.length > 0 && (
        <View style={[styles.listSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>已完成 ({completedActions.length})</Text>
          {completedActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[styles.todoItem, styles.todoCompleted]}
              onPress={() => onToggle(action.id, 'pending')}
              onLongPress={() => handleDelete(action)}
            >
              <View style={styles.todoLeft}>
                <View style={[styles.checkbox, styles.checkboxChecked, { borderColor: Colors.success }]}>
                  <Ionicons name="checkmark" size={14} color={Colors.success} />
                </View>
                <Text style={[styles.todoTitle, styles.todoTitleCompleted, { color: colors.textSecondary }]}>
                  {action.title}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={{ height: 100 }} />
    </View>
  );
}

// ============ Inventory Section ============

// Expiry level types
type ExpiryLevel = 'expired' | 'critical' | 'warning' | 'caution' | 'safe' | 'none';

interface ExpiryInfo {
  level: ExpiryLevel;
  color: string;
  bgColor: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  daysLeft: number | null;
}

function getExpiryInfo(date: string | null): ExpiryInfo {
  if (!date) {
    return {
      level: 'none',
      color: '#9CA3AF',
      bgColor: 'transparent',
      icon: 'time-outline',
      label: '无保质期',
      daysLeft: null,
    };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiryDate = new Date(date);
  expiryDate.setHours(0, 0, 0, 0);
  
  const diffTime = expiryDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    // 已过期 - 红色
    return {
      level: 'expired',
      color: '#DC2626',
      bgColor: '#FEE2E2',
      icon: 'alert-circle',
      label: `已过期${Math.abs(daysLeft)}天`,
      daysLeft,
    };
  } else if (daysLeft <= 1) {
    // 1天内（今天/明天）- 深红色
    return {
      level: 'critical',
      color: '#B91C1C',
      bgColor: '#FEE2E2',
      icon: 'warning',
      label: daysLeft === 0 ? '今天过期' : '明天过期',
      daysLeft,
    };
  } else if (daysLeft <= 3) {
    // 3天内 - 橙色
    return {
      level: 'warning',
      color: '#EA580C',
      bgColor: '#FFEDD5',
      icon: 'alert',
      label: `${daysLeft}天后过期`,
      daysLeft,
    };
  } else if (daysLeft <= 7) {
    // 7天内 - 黄色
    return {
      level: 'caution',
      color: '#CA8A04',
      bgColor: '#FEF9C3',
      icon: 'time',
      label: `${daysLeft}天后过期`,
      daysLeft,
    };
  } else {
    // 安全
    return {
      level: 'safe',
      color: '#16A34A',
      bgColor: '#DCFCE7',
      icon: 'checkmark-circle',
      label: `${daysLeft}天`,
      daysLeft,
    };
  }
}

interface InventorySectionProps {
  items: InventoryItem[];
  colorScheme: 'light' | 'dark';
  onUpdateQuantity: (id: string, quantity: number) => void;
  onDelete: (id: string) => void;
}

function InventorySection({ items, colorScheme, onUpdateQuantity, onDelete }: InventorySectionProps) {
  const colors = Colors[colorScheme];
  
  // Modal state
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null); // 位置筛选
  const [selectedExpiry, setSelectedExpiry] = useState<ExpiryLevel | 'all'>('all');

  const getZoneIcon = (zone: string): keyof typeof Ionicons.glyphMap => {
    switch (zone) {
      case 'Fridge': return 'snow-outline';
      case 'Freezer': return 'cube-outline';
      case 'Pantry': return 'basket-outline';
      case 'Bathroom': return 'water-outline';
      case 'Bedroom': return 'bed-outline';
      case 'LivingRoom': return 'home-outline';
      case 'Kitchen': return 'restaurant-outline';
      case 'Storage': return 'archive-outline';
      default: return 'cube-outline';
    }
  };

  const getZoneColor = (zone: string) => {
    switch (zone) {
      case 'Fridge': return Colors.info;
      case 'Freezer': return Colors.accentCool;
      case 'Pantry': return Colors.accentWarm;
      case 'Bathroom': return '#06B6D4';
      case 'Bedroom': return '#8B5CF6';
      case 'LivingRoom': return Colors.accent;
      case 'Kitchen': return '#F59E0B';
      case 'Storage': return '#6B7280';
      default: return Colors.accent;
    }
  };

  const getZoneLabel = (zone: string): string => {
    const labels: Record<string, string> = {
      'Fridge': '冰箱冷藏',
      'Freezer': '冰箱冷冻',
      'Pantry': '食品柜',
      'Bathroom': '浴室',
      'Bedroom': '卧室',
      'LivingRoom': '客厅',
      'Kitchen': '厨房',
      'Storage': '储物间',
      'Other': '其他',
      'Room': '常温', // 兼容旧数据
    };
    return labels[zone] || zone;
  };

  const handleDelete = (item: InventoryItem) => {
    Alert.alert('删除物品', '确定要删除这个物品吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => onDelete(item.id) },
    ]);
  };

  const handleOpenQuantityModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowQuantityModal(true);
  };

  const handleQuantityConfirm = (quantity: number) => {
    if (selectedItem) {
      onUpdateQuantity(selectedItem.id, quantity);
    }
  };

  const handleUseUp = () => {
    if (selectedItem) {
      Alert.alert(
        '用完了',
        `确定将「${selectedItem.name}」标记为用完吗？`,
        [
          { text: '取消', style: 'cancel' },
          { 
            text: '用完删除', 
            style: 'destructive', 
            onPress: () => onDelete(selectedItem.id) 
          },
          { 
            text: '设为0', 
            onPress: () => onUpdateQuantity(selectedItem.id, 0) 
          },
        ]
      );
    }
  };

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cube-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无库存物品</Text>
      </View>
    );
  }

  // Filter by selected zone
  const zoneFilteredItems = selectedZone 
    ? items.filter(item => item.storage_zone === selectedZone)
    : items;

  const expiryFilteredItems = selectedExpiry === 'all'
    ? zoneFilteredItems
    : zoneFilteredItems.filter(item => getExpiryInfo(item.expiry_date).level === selectedExpiry);

  // Count items by expiry level (only for zone filtered items)
  const expiryCounts = zoneFilteredItems.reduce((acc, item) => {
    const info = getExpiryInfo(item.expiry_date);
    acc[info.level] = (acc[info.level] || 0) + 1;
    return acc;
  }, {} as Record<ExpiryLevel, number>);

  // Get all unique zones
  const allZones = Array.from(new Set(items.map(item => item.storage_zone || 'Other')));
  
  // Group by storage zone
  const grouped = expiryFilteredItems.reduce((acc, item) => {
    const zone = item.storage_zone || 'Other';
    if (!acc[zone]) acc[zone] = [];
    acc[zone].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  const expiryFilterLabels: Record<ExpiryLevel, string> = {
    expired: '已过期',
    critical: '1天内',
    warning: '3天内',
    caution: '7天内',
    safe: '安全',
    none: '无保质期',
  };

  const emptyMessage = selectedExpiry !== 'all'
    ? `暂无${expiryFilterLabels[selectedExpiry]}物品`
    : selectedZone
      ? '该位置暂无物品'
      : '暂无库存物品';

  return (
    <View style={styles.sectionContent}>
      {/* Zone Filter */}
      {allZones.length > 1 && (
        <View style={[styles.zoneFilter, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>位置筛选</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.zoneFilterRow}
          >
            <TouchableOpacity
              style={[
                styles.zoneFilterChip,
                { backgroundColor: selectedZone === null ? Colors.primary : colors.border },
              ]}
              onPress={() => setSelectedZone(null)}
            >
              <Text style={[
                styles.zoneFilterChipText,
                { color: selectedZone === null ? '#fff' : colors.text },
              ]}>
                全部 ({items.length})
              </Text>
            </TouchableOpacity>
            {allZones.map((zone) => {
              const zoneItems = items.filter(item => (item.storage_zone || 'Other') === zone);
              const isSelected = selectedZone === zone;
              return (
                <TouchableOpacity
                  key={zone}
                  style={[
                    styles.zoneFilterChip,
                    { backgroundColor: isSelected ? getZoneColor(zone) : colors.border },
                  ]}
                  onPress={() => setSelectedZone(isSelected ? null : zone)}
                >
                  <Ionicons 
                    name={getZoneIcon(zone)} 
                    size={14} 
                    color={isSelected ? '#fff' : colors.textSecondary} 
                  />
                  <Text style={[
                    styles.zoneFilterChipText,
                    { color: isSelected ? '#fff' : colors.text },
                    { marginLeft: 4 },
                  ]}>
                    {getZoneLabel(zone)} ({zoneItems.length})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Expiry Summary */}
      {zoneFilteredItems.length > 0 && (
        <View style={[styles.expirySummary, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>保质期概览</Text>
          <View style={styles.expiryBadges}>
          {expiryCounts.expired > 0 && (
            <View style={[styles.expiryBadge, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="alert-circle" size={14} color="#DC2626" />
              <Text style={[styles.expiryBadgeText, { color: '#DC2626' }]}>
                已过期 {expiryCounts.expired}
              </Text>
            </View>
          )}
          {expiryCounts.critical > 0 && (
            <View style={[styles.expiryBadge, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="warning" size={14} color="#B91C1C" />
              <Text style={[styles.expiryBadgeText, { color: '#B91C1C' }]}>
                1天内 {expiryCounts.critical}
              </Text>
            </View>
          )}
          {expiryCounts.warning > 0 && (
            <View style={[styles.expiryBadge, { backgroundColor: '#FFEDD5' }]}>
              <Ionicons name="alert" size={14} color="#EA580C" />
              <Text style={[styles.expiryBadgeText, { color: '#EA580C' }]}>
                3天内 {expiryCounts.warning}
              </Text>
            </View>
          )}
          {expiryCounts.caution > 0 && (
            <View style={[styles.expiryBadge, { backgroundColor: '#FEF9C3' }]}>
              <Ionicons name="time" size={14} color="#CA8A04" />
              <Text style={[styles.expiryBadgeText, { color: '#CA8A04' }]}>
                7天内 {expiryCounts.caution}
              </Text>
            </View>
          )}
          {expiryCounts.safe > 0 && (
            <View style={[styles.expiryBadge, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
              <Text style={[styles.expiryBadgeText, { color: '#16A34A' }]}>
                安全 {expiryCounts.safe}
              </Text>
            </View>
          )}
          </View>
        </View>
      )}

      {zoneFilteredItems.length > 0 && (
        <View style={[styles.expiryFilterRow, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>保质期筛选</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.expiryFilterChips}
          >
            <TouchableOpacity
              style={[
                styles.expiryFilterChip,
                { backgroundColor: selectedExpiry === 'all' ? Colors.primary : colors.border },
              ]}
              onPress={() => setSelectedExpiry('all')}
            >
              <Text style={[styles.expiryFilterText, { color: selectedExpiry === 'all' ? '#fff' : colors.text }]}>全部 {zoneFilteredItems.length}</Text>
            </TouchableOpacity>
            {([
              { key: 'expired', label: '已过期', color: '#DC2626', bgColor: '#FEE2E2' },
              { key: 'critical', label: '1天内', color: '#B91C1C', bgColor: '#FEE2E2' },
              { key: 'warning', label: '3天内', color: '#EA580C', bgColor: '#FFEDD5' },
              { key: 'caution', label: '7天内', color: '#CA8A04', bgColor: '#FEF9C3' },
              { key: 'safe', label: '安全', color: '#16A34A', bgColor: '#DCFCE7' },
            ] as const).map(({ key, label, color, bgColor }) => {
              const count = expiryCounts[key] || 0;
              if (count === 0) return null;
              const isSelected = selectedExpiry === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.expiryFilterChip,
                    { backgroundColor: isSelected ? color : bgColor },
                  ]}
                  onPress={() => setSelectedExpiry(isSelected ? 'all' : key)}
                >
                  <Text style={[styles.expiryFilterText, { color: isSelected ? '#fff' : color }]}>
                    {label} {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {Object.keys(grouped).length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {emptyMessage}
          </Text>
        </View>
      ) : (
        Object.entries(grouped).map(([zone, zoneItems]) => (
          <View key={zone} style={[styles.listSection, { backgroundColor: colors.surface }]}>
            <View style={styles.zoneHeader}>
              <Ionicons name={getZoneIcon(zone)} size={20} color={getZoneColor(zone)} />
              <Text style={[styles.sectionTitle, { color: colors.text, marginLeft: 8, marginBottom: 0 }]}>
                {getZoneLabel(zone)} ({zoneItems.length})
              </Text>
            </View>
            {zoneItems.map((item) => {
              const expiryInfo = getExpiryInfo(item.expiry_date);
              const isUrgent = ['expired', 'critical', 'warning'].includes(expiryInfo.level);
              
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.inventoryItem,
                    isUrgent && { backgroundColor: expiryInfo.bgColor + '40' },
                  ]}
                  onLongPress={() => handleDelete(item)}
                >
                  <View style={styles.inventoryLeft}>
                    <View style={styles.inventoryNameRow}>
                      <Text style={[styles.inventoryName, { color: colors.text }]}>{item.name}</Text>
                      {isUrgent && (
                        <Ionicons 
                          name={expiryInfo.icon} 
                          size={16} 
                          color={expiryInfo.color} 
                          style={{ marginLeft: 6 }}
                        />
                      )}
                    </View>
                    <View style={styles.inventoryMeta}>
                      <Text style={[styles.inventoryCategory, { color: colors.textSecondary }]}>
                        {item.category}
                      </Text>
                      {item.expiry_date && (
                        <View style={[styles.expiryTag, { backgroundColor: expiryInfo.bgColor }]}>
                          <Ionicons name={expiryInfo.icon} size={12} color={expiryInfo.color} />
                          <Text style={[styles.expiryTagText, { color: expiryInfo.color }]}>
                            {expiryInfo.label}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.quantityBox, { backgroundColor: Colors.primary + '15' }]}
                    onPress={() => handleOpenQuantityModal(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.quantityValue, { color: Colors.primary }]}>
                      {item.quantity}
                    </Text>
                    <Text style={[styles.quantityUnit, { color: Colors.primary }]}>
                      {item.unit}
                    </Text>
                    <Ionicons name="pencil" size={12} color={Colors.primary} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        ))
      )}
      <View style={{ height: 100 }} />

      {/* Quantity Input Modal */}
      {selectedItem && (
        <QuantityInputModal
          visible={showQuantityModal}
          onClose={() => setShowQuantityModal(false)}
          onConfirm={handleQuantityConfirm}
          onUseUp={handleUseUp}
          currentQuantity={selectedItem.quantity}
          itemName={selectedItem.name}
          unit={selectedItem.unit}
        />
      )}
    </View>
  );
}

// ============ Main Screen ============
export default function DataScreen() {
  const colorScheme = useEffectiveColorScheme();
  const colors = Colors[colorScheme];
  const params = useLocalSearchParams<{ tab?: string }>();
  const { targetTab, clearTargetTab } = useNavigation();

  // Initialize activeTab
  const [activeTab, setActiveTab] = useState<TabType>('finance');

  // Update activeTab from URL params
  useEffect(() => {
    if (params.tab && ['finance', 'todo', 'inventory'].includes(params.tab)) {
      setActiveTab(params.tab as TabType);
    }
  }, [params.tab]);

  // Update activeTab from navigation context (for search navigation)
  useEffect(() => {
    if (targetTab) {
      setActiveTab(targetTab);
      clearTargetTab(); // Clear after using
    }
  }, [targetTab, clearTargetTab]);

  // Listen for navigation events from search
  useEffect(() => {
    const handleNavigateToTab = (tab: TabType) => {
      setActiveTab(tab);
    };

    navigationEvents.onNavigateToTab(handleNavigateToTab);

    return () => {
      navigationEvents.offNavigateToTab(handleNavigateToTab);
    };
  }, []);

  // Also check params on focus
  useFocusEffect(
    useCallback(() => {
      if (params.tab && ['finance', 'todo', 'inventory'].includes(params.tab)) {
        setActiveTab(params.tab as TabType);
      }
      // Check navigation context on focus
      if (targetTab) {
        setActiveTab(targetTab);
        clearTargetTab();
      }
    }, [params.tab, targetTab, clearTargetTab])
  );
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [financeRecords, setFinanceRecords] = useState<FinanceRecord[]>([]);
  const [financeStats, setFinanceStats] = useState<FinanceStats | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  
  // Chart data states
  const [trendData, setTrendData] = useState<TrendChartData>({ labels: [], data: [] });
  const [categoryData, setCategoryData] = useState<CategoryChartData[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({ thisWeek: 0, lastWeek: 0, averageDaily: 0 });

  const tabs: { key: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'finance', label: '消费', icon: 'wallet-outline' },
    { key: 'todo', label: '待办', icon: 'checkbox-outline' },
    { key: 'inventory', label: '库存', icon: 'cube-outline' },
  ];

  useFocusEffect(
    useCallback(() => {
      loadData();
      // Check params on focus
      if (params.tab && ['finance', 'todo', 'inventory'].includes(params.tab)) {
        setActiveTab(params.tab as TabType);
      }
    }, [params.tab])
  );

  const loadData = async () => {
    // Load all data in parallel
    const [
      financeResult, 
      statsResult, 
      actionsResult, 
      inventoryResult,
      trendResult,
      categoryResult,
      weeklyResult,
    ] = await Promise.all([
      getFinanceRecords(),
      getFinanceStats(),
      getActions(),
      getInventoryItems(),
      getSpendingTrend(7),
      getCategoryBreakdown(),
      getWeeklyStats(),
    ]);

    if (!financeResult.error) setFinanceRecords(financeResult.data);
    if (!statsResult.error) setFinanceStats(statsResult.stats);
    if (!actionsResult.error) setActions(actionsResult.data);
    if (!inventoryResult.error) setInventoryItems(inventoryResult.data);
    if (!trendResult.error) setTrendData(trendResult.data);
    if (!categoryResult.error) setCategoryData(categoryResult.data);
    if (!weeklyResult.error) setWeeklyStats(weeklyResult.stats);
    
    setIsLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Render skeleton based on active tab
  const renderSkeleton = () => {
    switch (activeTab) {
      case 'finance':
        return <FinanceSkeleton />;
      case 'todo':
        return <TodoSkeleton />;
      case 'inventory':
        return <InventorySkeleton />;
    }
  };

  // Handlers
  const handleDeleteFinance = async (id: string) => {
    await deleteFinanceRecord(id);
    setFinanceRecords(prev => prev.filter(r => r.id !== id));
    // Reload stats
    const { stats } = await getFinanceStats();
    if (stats) setFinanceStats(stats);
  };

  const handleUpdateFinance = async (id: string, updates: Partial<FinanceRecord>) => {
    await updateFinanceRecord(id, updates);
    setFinanceRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    const [statsResult, trendResult, categoryResult, weeklyResult] = await Promise.all([
      getFinanceStats(),
      getSpendingTrend(7),
      getCategoryBreakdown(),
      getWeeklyStats(),
    ]);
    if (statsResult.stats) setFinanceStats(statsResult.stats);
    if (!trendResult.error) setTrendData(trendResult.data);
    if (!categoryResult.error) setCategoryData(categoryResult.data);
    if (!weeklyResult.error) setWeeklyStats(weeklyResult.stats);
  };

  const handleToggleAction = async (id: string, status: 'pending' | 'completed') => {
    await updateActionStatus(id, status);
    setActions(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const handleDeleteAction = async (id: string) => {
    await deleteAction(id);
    setActions(prev => prev.filter(a => a.id !== id));
  };

  const handleUpdateInventoryQty = async (id: string, quantity: number) => {
    await updateInventoryQuantity(id, quantity);
    setInventoryItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
  };

  const handleDeleteInventory = async (id: string) => {
    await deleteInventoryItem(id);
    setInventoryItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Segment Control */}
      <SegmentControl
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        colorScheme={colorScheme}
      />

      {/* Content */}
      <ScrollView
        style={styles.contentContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {isLoading ? (
          renderSkeleton()
        ) : (
          <>
            {activeTab === 'finance' && (
              <FinanceSection
                records={financeRecords}
                stats={financeStats}
                trendData={trendData}
                categoryData={categoryData}
                weeklyStats={weeklyStats}
                colorScheme={colorScheme}
                onDelete={handleDeleteFinance}
                onUpdate={handleUpdateFinance}
              />
            )}
            {activeTab === 'todo' && (
              <TodoSection
                actions={actions}
                colorScheme={colorScheme}
                onToggle={handleToggleAction}
                onDelete={handleDeleteAction}
              />
            )}
            {activeTab === 'inventory' && (
              <InventorySection
                items={inventoryItems}
                colorScheme={colorScheme}
                onUpdateQuantity={handleUpdateInventoryQty}
                onDelete={handleDeleteInventory}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  sectionContent: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statsCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statsLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  categorySection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  categoryName: {
    fontSize: 15,
  },
  categoryStats: {
    alignItems: 'flex-end',
  },
  categoryCount: {
    fontSize: 12,
  },
  categoryTotal: {
    fontSize: 15,
    fontWeight: '600',
  },
  financeFilterRow: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  financeFilterChips: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
  },
  financeFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  financeFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  recordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recordCategory: {
    fontSize: 15,
    fontWeight: '500',
  },
  recordDescription: {
    fontSize: 12,
    marginTop: 4,
  },
  recordDate: {
    fontSize: 12,
    marginTop: 2,
  },
  recordRight: {
    alignItems: 'flex-end',
  },
  recordAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  recordEmotion: {
    fontSize: 12,
    marginTop: 2,
  },
  todoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  todoCompleted: {
    opacity: 0.6,
  },
  todoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxInner: {},
  checkboxChecked: {
    backgroundColor: Colors.success + '20',
  },
  todoContent: {
    flex: 1,
  },
  todoTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  todoTitleCompleted: {
    textDecorationLine: 'line-through',
  },
  todoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '500',
  },
  todoType: {
    fontSize: 12,
  },
  todoFilterRow: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  todoFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  todoFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inventoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  inventoryLeft: {
    flex: 1,
  },
  inventoryName: {
    fontSize: 15,
    fontWeight: '500',
  },
  inventoryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inventoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  inventoryCategory: {
    fontSize: 12,
  },
  inventoryExpiry: {
    fontSize: 12,
  },
  zoneFilter: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  zoneFilterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  zoneFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  zoneFilterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  expirySummary: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  expiryFilterRow: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  expiryFilterChips: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
  },
  expiryFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  expiryFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expiryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  expiryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expiryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  expiryTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  inventoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  quantityUnit: {
    fontSize: 13,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  financeModal: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
  },
  modalTextarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalChipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  modalChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modalChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  moreText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
