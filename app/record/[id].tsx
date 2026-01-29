import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { useEffectiveColorScheme } from '@/lib/ThemeContext';
import {
  getHistoryItem,
  updateHistoryItem,
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
      return '消费记录';
    case 'todo':
      return '待办事项';
    case 'inventory':
      return '库存物品';
    default:
      return '未分类';
  }
}

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useEffectiveColorScheme();
  const colors = Colors[colorScheme];

  const [item, setItem] = useState<CaptureHistoryItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItem();
  }, [id]);

  const loadItem = async () => {
    if (id) {
      const record = await getHistoryItem(id);
      setItem(record);
      if (record?.aiResponse?.summary) {
        setEditedSummary(record.aiResponse.summary);
      }
    }
    setLoading(false);
  };

  const handleDelete = () => {
    Alert.alert(
      '删除记录',
      '确定要删除这条记录吗？此操作不可撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            if (id) {
              await deleteHistoryItem(id);
              router.back();
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (item && item.aiResponse) {
      await updateHistoryItem(item.id, {
        aiResponse: {
          ...item.aiResponse,
          summary: editedSummary,
        },
      });
      setItem({
        ...item,
        aiResponse: {
          ...item.aiResponse,
          summary: editedSummary,
        },
      });
      setIsEditing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>加载中...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.errorText, { color: colors.text }]}>记录不存在</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: Colors.primary }]}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const routeType = item.aiResponse?.route_type;
  const routeColor = getRouteColor(routeType);

  // Format full date
  const fullDate = new Date(item.timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <>
      <Stack.Screen
        options={{
          title: '记录详情',
          headerRight: () => (
            <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
              <Ionicons name="trash-outline" size={22} color={Colors.error} />
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Type Badge */}
          <View style={[styles.typeBadge, { backgroundColor: item.type === 'voice' ? Colors.primaryLight + '20' : Colors.accent + '20' }]}>
            <Ionicons
              name={item.type === 'voice' ? 'mic' : 'camera'}
              size={20}
              color={item.type === 'voice' ? Colors.primary : Colors.accent}
            />
            <Text style={[styles.typeText, { color: item.type === 'voice' ? Colors.primary : Colors.accent }]}>
              {item.type === 'voice' ? '语音记录' : '照片记录'}
            </Text>
          </View>

          {/* Photo Preview */}
          {item.type === 'photo' && item.uri && (
            <View style={styles.imageContainer}>
              <Image source={{ uri: item.uri }} style={styles.image} resizeMode="contain" />
            </View>
          )}

          {/* Meta Info */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>基本信息</Text>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>创建时间</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{fullDate}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>相对时间</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{formatTimestamp(item.timestamp)}</Text>
            </View>

            {item.type === 'voice' && item.duration && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>录音时长</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{Math.round(item.duration / 1000)} 秒</Text>
              </View>
            )}

            {item.type === 'photo' && item.photoCount && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>照片数量</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{item.photoCount} 张</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>处理状态</Text>
              <View style={[styles.statusBadge, { backgroundColor: item.processingStatus === 'completed' ? Colors.success + '20' : Colors.accentWarm + '20' }]}>
                <Text style={{ color: item.processingStatus === 'completed' ? Colors.success : Colors.accentWarm, fontSize: 13 }}>
                  {item.processingStatus === 'completed' ? '已完成' : item.processingStatus === 'processing' ? '处理中' : item.processingStatus === 'failed' ? '失败' : '本地'}
                </Text>
              </View>
            </View>
          </View>

          {/* AI Analysis Result */}
          {item.aiResponse && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>AI 分析结果</Text>
                {!isEditing && (
                  <TouchableOpacity onPress={() => setIsEditing(true)}>
                    <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Route Type */}
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>分类</Text>
                <View style={[styles.routeBadge, { backgroundColor: routeColor + '20' }]}>
                  <Ionicons name={getRouteIcon(routeType)} size={16} color={routeColor} />
                  <Text style={[styles.routeText, { color: routeColor }]}>{getRouteLabel(routeType)}</Text>
                </View>
              </View>

              {/* Confidence */}
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>置信度</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {Math.round((item.aiResponse.confidence || 0) * 100)}%
                </Text>
              </View>

              {/* Summary */}
              <View style={styles.summaryContainer}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary, marginBottom: 8 }]}>摘要</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.summaryInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                    value={editedSummary}
                    onChangeText={setEditedSummary}
                    multiline
                    numberOfLines={4}
                    placeholder="编辑摘要..."
                    placeholderTextColor={colors.textSecondary}
                  />
                ) : (
                  <Text style={[styles.summaryText, { color: colors.text }]}>
                    {item.aiResponse.summary}
                  </Text>
                )}
              </View>

              {/* Data Details */}
              {item.aiResponse.data && (
                <View style={styles.dataContainer}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary, marginBottom: 8 }]}>详细数据</Text>
                  <View style={[styles.dataBox, { backgroundColor: colors.background }]}>
                    <Text style={[styles.dataText, { color: colors.text }]}>
                      {JSON.stringify(item.aiResponse.data, null, 2)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Edit Actions */}
              {isEditing && (
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { borderColor: colors.border }]}
                    onPress={() => {
                      setIsEditing(false);
                      setEditedSummary(item.aiResponse?.summary || '');
                    }}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: Colors.primary }]}
                    onPress={handleSave}
                  >
                    <Text style={styles.saveButtonText}>保存</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Session ID */}
          {item.sessionId && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>技术信息</Text>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Session ID</Text>
                <Text style={[styles.infoValueSmall, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.sessionId}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Delete Button at Bottom */}
        <View style={[styles.bottomActions, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.deleteButton, { borderColor: Colors.error }]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
            <Text style={[styles.deleteButtonText, { color: Colors.error }]}>删除记录</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  headerButton: {
    padding: 8,
  },
  errorText: {
    fontSize: 16,
    marginTop: 12,
  },
  backLink: {
    fontSize: 16,
    marginTop: 16,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: 250,
    backgroundColor: '#f0f0f0',
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValueSmall: {
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  routeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  routeText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  summaryContainer: {
    marginTop: 12,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
  },
  summaryInput: {
    fontSize: 15,
    lineHeight: 22,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dataContainer: {
    marginTop: 16,
  },
  dataBox: {
    borderRadius: 8,
    padding: 12,
  },
  dataText: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
});
