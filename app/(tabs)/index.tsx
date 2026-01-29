import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { OmniInputButton } from '@/components/OmniInputButton';
import { formatDuration, useVoiceRecorder } from '@/components/VoiceRecorder';
import { Colors } from '@/constants/Colors';
import { useEffectiveColorScheme } from '@/lib/ThemeContext';
import { useRouter } from 'expo-router';
import {
  getRouteTypeDisplayName,
  getRouteTypeIcon,
  processVoiceCapture,
  ProcessingProgress,
} from '@/lib/captureProcessor';
import {
  addHistoryItem,
  CaptureHistoryItem,
  formatTimestamp,
  getHistory,
  updateHistoryItem,
} from '@/lib/historyStore';
import {
  getFinanceStats,
  getActions,
  getInventoryItems,
} from '@/lib/dataService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Quick Stats Card Component
interface QuickStatProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  colorScheme: 'light' | 'dark';
}

function QuickStat({ icon, label, value, color, colorScheme }: QuickStatProps) {
  const theme = Colors[colorScheme];
  return (
    <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
      <View style={[styles.statIconBg, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useEffectiveColorScheme();
  const theme = Colors[colorScheme];

  const [history, setHistory] = useState<CaptureHistoryItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);
  
  // Quick stats
  const [stats, setStats] = useState({
    totalSpent: 0,
    pendingTasks: 0,
    inventoryCount: 0,
  });

  const {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    permissionStatus,
    requestPermission,
  } = useVoiceRecorder();

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadHistory();
      loadStats();
    }, [])
  );

  const loadHistory = async () => {
    const items = await getHistory();
    setHistory(items);
  };

  const loadStats = async () => {
    const [financeResult, actionsResult, inventoryResult] = await Promise.all([
      getFinanceStats(),
      getActions('pending'),
      getInventoryItems(),
    ]);
    
    setStats({
      totalSpent: financeResult.stats?.total || 0,
      pendingTasks: actionsResult.data?.length || 0,
      inventoryCount: inventoryResult.data?.length || 0,
    });
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadHistory();
    setIsRefreshing(false);
  };

  const handleStartRecording = useCallback(async () => {
    if (permissionStatus !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          '需要麦克风权限',
          '请在设置中允许 OneMind 访问麦克风以使用语音功能。'
        );
        return;
      }
    }
    await startRecording();
  }, [permissionStatus, requestPermission, startRecording]);

  const handleStopRecording = useCallback(async () => {
    const result = await stopRecording();
    if (result) {
      // Add to history first (local state)
      const historyItem = await addHistoryItem({
        type: 'voice',
        uri: result.uri,
        duration: result.duration,
        processingStatus: 'processing',
      });
      
      // Reload history to show the item
      await loadHistory();
      
      // Start AI processing
      setIsProcessing(true);
      
      try {
        const processingResult = await processVoiceCapture(
          result.uri,
          (progress) => setProcessingProgress(progress)
        );
        
        // Update history item with AI results
        await updateHistoryItem(historyItem.id, {
          processingStatus: processingResult.success ? 'completed' : 'failed',
          aiResponse: processingResult.aiResponse || undefined,
          sessionId: processingResult.sessionId || undefined,
        });
        
        if (processingResult.success && processingResult.aiResponse) {
          const routeType = getRouteTypeDisplayName(processingResult.aiResponse.route_type);
          Alert.alert(
            'AI 分析完成',
            `已识别为: ${routeType}\n\n${processingResult.aiResponse.summary}`,
            [{ text: '好的' }]
          );
        } else if (processingResult.error) {
          Alert.alert('处理失败', processingResult.error);
        }
      } catch (error) {
        console.error('Processing error:', error);
        await updateHistoryItem(historyItem.id, {
          processingStatus: 'failed',
        });
      } finally {
        setIsProcessing(false);
        setProcessingProgress(null);
        await loadHistory();
      }
    }
  }, [stopRecording]);

  const renderHistoryItem = (item: CaptureHistoryItem) => {
    const isItemProcessing = item.processingStatus === 'processing';
    const hasAIResult = item.aiResponse && item.processingStatus === 'completed';
    
    return (
      <View
        key={item.id}
        style={[styles.activityItem, { backgroundColor: theme.surface }]}
      >
        {item.type === 'photo' ? (
          <Image
            source={{ uri: item.uri }}
            style={styles.photoThumbnail}
          />
        ) : hasAIResult ? (
          <View style={[styles.activityIcon, { backgroundColor: Colors.accent + '20' }]}>
            <Ionicons 
              name={getRouteTypeIcon(item.aiResponse!.route_type) as any} 
              size={20} 
              color={Colors.accent} 
            />
          </View>
        ) : (
          <View style={[styles.activityIcon, { backgroundColor: Colors.primary + '20' }]}>
            <Ionicons name="mic" size={20} color={Colors.primary} />
          </View>
        )}
        <View style={styles.activityContent}>
          <Text style={[styles.activityTitle, { color: theme.text }]}>
            {hasAIResult 
              ? getRouteTypeDisplayName(item.aiResponse!.route_type)
              : item.type === 'photo' ? '拍照记录' : '语音录制'}
          </Text>
          <Text style={[styles.activitySubtitle, { color: theme.textSecondary }]} numberOfLines={2}>
            {hasAIResult
              ? item.aiResponse!.summary
              : item.type === 'photo'
                ? `${item.photoCount} 张照片`
                : `时长: ${formatDuration(item.duration || 0)}`}
          </Text>
        </View>
        <View style={styles.activityRight}>
          {isItemProcessing ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={[styles.activityTime, { color: theme.textSecondary }]}>
              {formatTimestamp(item.timestamp)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了 🌙';
    if (hour < 12) return '早上好 ☀️';
    if (hour < 14) return '中午好 🌤️';
    if (hour < 18) return '下午好 ☕';
    return '晚上好 🌙';
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Processing Modal */}
      <Modal
        visible={isProcessing}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.processingIcon}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {processingProgress?.message || 'AI 正在分析...'}
            </Text>
            {processingProgress && (
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${processingProgress.progress}%` }
                  ]} 
                />
              </View>
            )}
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Header with gradient */}
        <View style={styles.headerContainer}>
          <View style={[styles.headerGradient, { backgroundColor: Colors.primary + '08' }]} />
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerLeft}>
                <Text style={[styles.greeting, { color: theme.textSecondary }]}>
                  {getGreeting()}
                </Text>
                <Text style={[styles.title, { color: theme.text }]}>
                  OneMind
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.searchButton, { backgroundColor: theme.surface }]}
                onPress={() => router.push('/search')}
                activeOpacity={0.7}
              >
                <Ionicons name="search" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              智能记录，轻松生活
            </Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <QuickStat
            icon="wallet-outline"
            label="本月支出"
            value={`¥${stats.totalSpent.toFixed(0)}`}
            color={Colors.accentWarm}
            colorScheme={colorScheme}
          />
          <QuickStat
            icon="checkbox-outline"
            label="待办事项"
            value={`${stats.pendingTasks}`}
            color={Colors.info}
            colorScheme={colorScheme}
          />
          <QuickStat
            icon="cube-outline"
            label="库存物品"
            value={`${stats.inventoryCount}`}
            color={Colors.accent}
            colorScheme={colorScheme}
          />
        </View>

        {/* Recording status */}
        {isRecording && (
          <View style={[styles.recordingStatus, { backgroundColor: Colors.error + '15' }]}>
            <View style={styles.recordingDot} />
            <Text style={[styles.recordingText, { color: Colors.error }]}>
              正在录音 {formatDuration(recordingDuration)}
            </Text>
          </View>
        )}

        {/* Recent activity section */}
        <View style={styles.activitySection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              最近活动
            </Text>
            {history.length > 0 && (
              <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>
                {history.length} 条
              </Text>
            )}
          </View>

          {history.length > 0 ? (
            history.slice(0, 5).map(renderHistoryItem)
          ) : (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="sparkles" size={32} color={Colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                开始你的第一次记录
              </Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                点击下方按钮录音，或长按拍照
              </Text>
            </View>
          )}
        </View>

        {/* Tips Card */}
        <View style={[styles.tipsCard, { backgroundColor: Colors.primary + '10' }]}>
          <Ionicons name="bulb-outline" size={20} color={Colors.primary} />
          <Text style={[styles.tipsText, { color: Colors.primary }]}>
            提示：语音说「买了咖啡 25 元」，AI 会自动记录消费
          </Text>
        </View>

        {/* Spacer for bottom button */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Omni Input Button */}
      <View style={styles.bottomSection}>
        <OmniInputButton
          isRecording={isRecording}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerContainer: {
    position: 'relative',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  headerLeft: {
    flex: 1,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  greeting: {
    fontSize: 15,
    marginBottom: 4,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  // Quick Stats
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  // Recording Status
  recordingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
    marginRight: 10,
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Activity Section
  activitySection: {
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCount: {
    fontSize: 13,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  activityIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  photoThumbnail: {
    width: 46,
    height: 46,
    borderRadius: 14,
    marginRight: 14,
    backgroundColor: '#333',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  activitySubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  activityRight: {
    marginLeft: 8,
  },
  activityTime: {
    fontSize: 12,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Tips Card
  tipsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  tipsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  // Bottom Section
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    width: '80%',
    padding: 28,
    borderRadius: 24,
    alignItems: 'center',
  },
  processingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.primary + '20',
    borderRadius: 3,
    marginTop: 20,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
});
