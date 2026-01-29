import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { useEffectiveColorScheme } from '@/lib/ThemeContext';
import {
  getHistory,
  clearHistory,
  deleteHistoryItem,
  formatTimestamp,
  type CaptureHistoryItem,
} from '@/lib/historyStore';



// Get icon for route type
function getRouteIcon(routeType?: string): keyof typeof Ionicons.glyphMap {
  switch (routeType) {
    case 'finance':
      return 'wallet-outline';
    case 'todo':
      return 'checkbox-outline';
    case 'inventory':
      return 'cube-outline';
    default:
      return 'help-circle-outline';
  }
}

// Get color for route type
function getRouteColor(routeType?: string): string {
  switch (routeType) {
    case 'finance':
      return Colors.accentWarm;
    case 'todo':
      return Colors.info;
    case 'inventory':
      return Colors.accent;
    default:
      return Colors.light.textSecondary;
  }
}

// Get label for route type
function getRouteLabel(routeType?: string): string {
  switch (routeType) {
    case 'finance':
      return '消费';
    case 'todo':
      return '待办';
    case 'inventory':
      return '库存';
    default:
      return '未知';
  }
}

// Get status indicator
function getStatusInfo(status?: string): { color: string; text: string } {
  switch (status) {
    case 'processing':
      return { color: Colors.accentWarm, text: '处理中...' };
    case 'completed':
      return { color: Colors.success, text: '已完成' };
    case 'failed':
      return { color: Colors.error, text: '失败' };
    default:
      return { color: Colors.light.textSecondary, text: '本地' };
  }
}

interface HistoryItemProps {
  item: CaptureHistoryItem;
  colorScheme: 'light' | 'dark';
  onPress: () => void;
  onDelete: () => void;
  onSwipeWillOpen: () => void;
  onSwipeOpen: () => void;
  onSwipeClose: () => void;
  onRegisterSwipeable: (id: string, ref: Swipeable | null) => void;
  isSwipeOpen: boolean;
}

function HistoryItem({ item, colorScheme, isSwipeOpen, onPress, onDelete, onSwipeWillOpen, onSwipeOpen, onSwipeClose, onRegisterSwipeable }: HistoryItemProps) {
  const colors = Colors[colorScheme];
  const routeType = item.aiResponse?.route_type;
  const statusInfo = getStatusInfo(item.processingStatus);
  const swipeableRef = useRef<Swipeable>(null);

  React.useEffect(() => {
    onRegisterSwipeable(item.id, swipeableRef.current);
    return () => {
      onRegisterSwipeable(item.id, null);
    };
  }, [item.id, onRegisterSwipeable]);

  React.useEffect(() => {
    if (!isSwipeOpen) {
      swipeableRef.current?.close();
    }
  }, [isSwipeOpen]);

  const handlePress = () => {
    if (isSwipeOpen) {
      onSwipeClose();
      swipeableRef.current?.close();
      return;
    }
    onPress();
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={() => (
        <RectButton style={styles.deleteButtonContainer} onPress={onDelete}>
          <Ionicons name="trash-outline" size={24} color="#fff" />
        </RectButton>
      )}
      rightThreshold={20}
      friction={1}
      overshootRight={false}
      onSwipeableWillOpen={onSwipeWillOpen}
      onSwipeableOpen={onSwipeOpen}
      onSwipeableClose={onSwipeClose}
    >
      <View style={styles.swipeContainer}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handlePress}
          style={[styles.itemContainer, { backgroundColor: colors.surface }]}
        >
          {/* Left: Type Icon */}
          <View style={[styles.typeIconContainer, { backgroundColor: item.type === 'voice' ? Colors.primaryLight + '20' : Colors.accent + '20' }]}>
            <Ionicons
              name={item.type === 'voice' ? 'mic' : 'camera'}
              size={24}
              color={item.type === 'voice' ? Colors.primary : Colors.accent}
            />
          </View>

          {/* Middle: Content */}
          <View style={styles.contentContainer}>
            {/* Title row */}
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.text }]}>
                {item.type === 'voice' ? '语音记录' : `照片 (${item.photoCount || 1}张)`}
              </Text>
              <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                {formatTimestamp(item.timestamp)}
              </Text>
            </View>

            {/* AI Response Summary */}
            {item.aiResponse && item.processingStatus === 'completed' ? (
              <View style={styles.aiResponseContainer}>
                <View style={[styles.routeBadge, { backgroundColor: getRouteColor(routeType) + '20' }]}>
                  <Ionicons
                    name={getRouteIcon(routeType)}
                    size={14}
                    color={getRouteColor(routeType)}
                  />
                  <Text style={[styles.routeLabel, { color: getRouteColor(routeType) }]}>
                    {getRouteLabel(routeType)}
                  </Text>
                </View>
                <Text
                  style={[styles.summary, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {item.aiResponse.summary}
                </Text>
              </View>
            ) : (
              <View style={styles.statusContainer}>
                <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                  {statusInfo.text}
                </Text>
              </View>
            )}

            {/* Additional info */}
            {item.type === 'voice' && item.duration && (
              <Text style={[styles.duration, { color: colors.textSecondary }]}>
                时长: {Math.round(item.duration / 1000)}秒
              </Text>
            )}
          </View>

          {/* Right: Thumbnail for photos or chevron */}
          {item.type === 'photo' && item.uri ? (
            <View style={styles.rightContainer} pointerEvents="none">
              <Image source={{ uri: item.uri }} style={styles.thumbnail} />
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={styles.chevron} />
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>
    </Swipeable>
  );
}

export default function HistoryScreen() {
  const colorScheme = useEffectiveColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();

  const [history, setHistory] = useState<CaptureHistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const swipeableRefs = useRef(new Map<string, Swipeable>());

  // Load history when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const loadHistory = async () => {
    const items = await getHistory();
    setHistory(items);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const registerSwipeable = useCallback((id: string, ref: Swipeable | null) => {
    if (ref) {
      swipeableRefs.current.set(id, ref);
    } else {
      swipeableRefs.current.delete(id);
    }
  }, []);

  const handleItemPress = (item: CaptureHistoryItem) => {
    if (openSwipeId) {
      swipeableRefs.current.get(openSwipeId)?.close();
      setOpenSwipeId(null);
      return;
    }
    router.push(`/record/${item.id}`);
  };

  const handleSwipeWillOpen = (itemId: string) => {
    if (openSwipeId && openSwipeId !== itemId) {
      swipeableRefs.current.get(openSwipeId)?.close();
    }
    setOpenSwipeId(itemId);
  };

  const handleSwipeOpen = (itemId: string) => {
    setOpenSwipeId(itemId);
  };

  const handleDeleteItem = async (item: CaptureHistoryItem) => {
    await deleteHistoryItem(item.id);
    setHistory(prev => prev.filter(h => h.id !== item.id));
    setOpenSwipeId(null);
  };

  const handleClearHistory = () => {
    Alert.alert(
      '清空历史记录',
      '确定要清空所有历史记录吗？此操作不可撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清空',
          style: 'destructive',
          onPress: async () => {
            await clearHistory();
            setHistory([]);
          },
        },
      ]
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="time-outline"
        size={64}
        color={colors.textSecondary}
      />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        暂无记录
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        使用首页的全能按钮开始记录
      </Text>
    </View>
  );

  // Statistics
  const stats = {
    total: history.length,
    voice: history.filter(i => i.type === 'voice').length,
    photo: history.filter(i => i.type === 'photo').length,
    completed: history.filter(i => i.processingStatus === 'completed').length,
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Stats Header */}
      {history.length > 0 && (
        <View style={[styles.statsContainer, { backgroundColor: colors.surface }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.primary }]}>{stats.total}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>总计</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.primary }]}>{stats.voice}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>语音</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.accent }]}>{stats.photo}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>照片</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.success }]}>{stats.completed}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>已分析</Text>
          </View>
        </View>
      )}

      {/* History List */}
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HistoryItem
            item={item}
            colorScheme={colorScheme}
            isSwipeOpen={openSwipeId === item.id}
            onPress={() => handleItemPress(item)}
            onDelete={() => handleDeleteItem(item)}
            onSwipeWillOpen={() => handleSwipeWillOpen(item.id)}
            onSwipeOpen={() => handleSwipeOpen(item.id)}
            onSwipeClose={() => setOpenSwipeId(prev => (prev === item.id ? null : prev))}
            onRegisterSwipeable={registerSwipeable}
          />
        )}
        contentContainerStyle={history.length === 0 ? styles.emptyList : styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onScrollBeginDrag={() => setOpenSwipeId(null)}
      />

      {/* Clear Button */}
      {history.length > 0 && (
        <TouchableOpacity
          style={[styles.clearButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleClearHistory}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
          <Text style={[styles.clearButtonText, { color: Colors.error }]}>
            清空记录
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  deleteButtonContainer: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.error,
    borderRadius: 12,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevron: {
    marginLeft: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },
  listContent: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  typeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
  },
  aiResponseContainer: {
    marginTop: 4,
  },
  routeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  summary: {
    fontSize: 14,
    lineHeight: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
  },
  duration: {
    fontSize: 12,
    marginTop: 4,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 8,
  },
});
