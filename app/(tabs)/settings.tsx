import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Switch,
  Modal,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';

import { Colors } from '@/constants/Colors';
import { useTheme, ThemeMode } from '@/lib/ThemeContext';
import { clearHistory } from '@/lib/historyStore';
import { 
  isNotificationEnabled, 
  setNotificationEnabled, 
  forceCheckAndNotify,
  getUrgentCounts,
  type ExpiryLevels,
} from '@/lib/notificationService';

// ============ Settings Item Component ============
interface SettingsItemProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  onPress?: () => void;
  iconColor?: string;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
}

function SettingsItem({ 
  icon, 
  title, 
  subtitle, 
  onPress, 
  iconColor,
  rightElement,
  showChevron = true,
}: SettingsItemProps) {
  const { effectiveTheme } = useTheme();
  const theme = Colors[effectiveTheme];

  return (
    <TouchableOpacity
      style={[styles.settingsItem, { backgroundColor: theme.surface }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !rightElement}
    >
      <View style={[styles.iconContainer, { backgroundColor: (iconColor || Colors.primary) + '15' }]}>
        <Ionicons name={icon} size={20} color={iconColor || Colors.primary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, { color: theme.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        )}
      </View>
      {rightElement || (showChevron && onPress && (
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      ))}
    </TouchableOpacity>
  );
}

// ============ Theme Selector Modal ============
interface ThemeSelectorProps {
  visible: boolean;
  onClose: () => void;
  currentTheme: ThemeMode;
  onSelectTheme: (theme: ThemeMode) => void;
}

function ThemeSelector({ visible, onClose, currentTheme, onSelectTheme }: ThemeSelectorProps) {
  const { effectiveTheme } = useTheme();
  const theme = Colors[effectiveTheme];

  const themeOptions: { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'light', label: '浅色模式', icon: 'sunny-outline' },
    { key: 'dark', label: '深色模式', icon: 'moon-outline' },
    { key: 'system', label: '跟随系统', icon: 'phone-portrait-outline' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>选择主题</Text>
          {themeOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.themeOption,
                { borderColor: theme.border },
                currentTheme === option.key && { 
                  backgroundColor: Colors.primary + '15',
                  borderColor: Colors.primary,
                },
              ]}
              onPress={() => {
                onSelectTheme(option.key);
                onClose();
              }}
            >
              <Ionicons 
                name={option.icon} 
                size={24} 
                color={currentTheme === option.key ? Colors.primary : theme.textSecondary} 
              />
              <Text 
                style={[
                  styles.themeOptionText, 
                  { color: currentTheme === option.key ? Colors.primary : theme.text },
                ]}
              >
                {option.label}
              </Text>
              {currentTheme === option.key && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ============ About Modal ============
interface AboutModalProps {
  visible: boolean;
  onClose: () => void;
}

function AboutModal({ visible, onClose }: AboutModalProps) {
  const { effectiveTheme } = useTheme();
  const theme = Colors[effectiveTheme];
  
  const appVersion = Application.nativeApplicationVersion || '1.0.0';
  const buildVersion = Application.nativeBuildVersion || '1';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={[styles.aboutContent, { backgroundColor: theme.surface }]}>
          {/* Logo */}
          <View style={styles.aboutLogo}>
            <View style={styles.aboutLogoInner}>
              <Ionicons name="sparkles" size={36} color="#fff" />
            </View>
          </View>
          
          <Text style={[styles.aboutTitle, { color: theme.text }]}>OneMind</Text>
          <Text style={[styles.aboutSubtitle, { color: theme.textSecondary }]}>
            AI 生活管家
          </Text>
          
          <View style={[styles.versionBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.versionLabel, { color: theme.textSecondary }]}>版本</Text>
            <Text style={[styles.versionText, { color: theme.text }]}>
              {appVersion} ({buildVersion})
            </Text>
          </View>

          <Text style={[styles.aboutDescription, { color: theme.textSecondary }]}>
            一键录入，智能分流{'\n'}
            语音、拍照快速记录生活{'\n'}
            AI 自动分类到消费、待办、库存
          </Text>

          <View style={styles.aboutLinks}>
            <TouchableOpacity 
              style={[styles.aboutLink, { borderColor: theme.border }]}
              onPress={() => Linking.openURL('https://github.com')}
            >
              <Ionicons name="logo-github" size={20} color={theme.textSecondary} />
              <Text style={[styles.aboutLinkText, { color: theme.textSecondary }]}>GitHub</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.aboutLink, { borderColor: theme.border }]}
              onPress={() => Linking.openURL('mailto:support@onemind.app')}
            >
              <Ionicons name="mail-outline" size={20} color={theme.textSecondary} />
              <Text style={[styles.aboutLinkText, { color: theme.textSecondary }]}>反馈</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.copyright, { color: theme.textSecondary }]}>
            © 2026 OneMind. All rights reserved.
          </Text>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ============ Main Settings Screen ============
export default function SettingsScreen() {
  const { themeMode, setThemeMode, effectiveTheme } = useTheme();
  const theme = Colors[effectiveTheme];

  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [cacheSize, setCacheSize] = useState<string>('计算中...');
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [expiryLevels, setExpiryLevels] = useState<ExpiryLevels>({
    expired: 0,
    expiring1Day: 0,
    expiring3Days: 0,
    expiring7Days: 0,
  });
  const [todoStats, setTodoStats] = useState({ urgent: 0, overdue: 0 });

  // Load settings on mount
  useEffect(() => {
    calculateCacheSize();
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const enabled = await isNotificationEnabled();
      setNotificationsEnabled(enabled);
      
      // Get current urgent counts
      const counts = await getUrgentCounts();
      setExpiryLevels(counts.expiryLevels);
      setTodoStats({ urgent: counts.urgentTodos, overdue: counts.overdueTodos });
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    await setNotificationEnabled(enabled);
    if (enabled) {
      // Immediately check and notify when enabled
      const result = await forceCheckAndNotify();
      setExpiryLevels(result.expiryLevels);
      setTodoStats({ urgent: result.urgentTodos, overdue: result.overdueTodos });
    }
  };

  const getTotalAlerts = () => {
    return expiryLevels.expired + expiryLevels.expiring1Day + expiryLevels.expiring3Days + 
           expiryLevels.expiring7Days + todoStats.urgent + todoStats.overdue;
  };

  const handleTestNotification = async () => {
    const result = await forceCheckAndNotify();
    setExpiryLevels(result.expiryLevels);
    setTodoStats({ urgent: result.urgentTodos, overdue: result.overdueTodos });
    
    const { expiryLevels: levels } = result;
    const hasAlerts = levels.expired > 0 || levels.expiring1Day > 0 || 
                      levels.expiring3Days > 0 || levels.expiring7Days > 0 ||
                      result.urgentTodos > 0 || result.overdueTodos > 0;
    
    if (!hasAlerts) {
      Alert.alert('检查完成', '目前没有需要提醒的事项 🎉');
    } else {
      const messages: string[] = [];
      if (levels.expired > 0) messages.push(`🚨 ${levels.expired} 件物品已过期`);
      if (levels.expiring1Day > 0) messages.push(`🔴 ${levels.expiring1Day} 件物品1天内过期`);
      if (levels.expiring3Days > 0) messages.push(`🟠 ${levels.expiring3Days} 件物品3天内过期`);
      if (levels.expiring7Days > 0) messages.push(`🟡 ${levels.expiring7Days} 件物品7天内过期`);
      if (result.overdueTodos > 0) messages.push(`📋 ${result.overdueTodos} 项待办已逾期`);
      if (result.urgentTodos > 0) messages.push(`⏰ ${result.urgentTodos} 项紧急待办`);
      
      Alert.alert('检查完成', messages.join('\n'));
    }
  };

  const calculateCacheSize = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length * 2; // UTF-16 encoding
        }
      }
      
      if (totalSize < 1024) {
        setCacheSize(`${totalSize} B`);
      } else if (totalSize < 1024 * 1024) {
        setCacheSize(`${(totalSize / 1024).toFixed(1)} KB`);
      } else {
        setCacheSize(`${(totalSize / (1024 * 1024)).toFixed(1)} MB`);
      }
    } catch (error) {
      setCacheSize('未知');
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      '清除缓存',
      '这将清除所有本地缓存数据，包括历史记录。此操作不可撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearHistory();
              await calculateCacheSize();
              Alert.alert('成功', '缓存已清除');
            } catch (error) {
              Alert.alert('错误', '清除缓存失败');
            }
          },
        },
      ]
    );
  };

  const getThemeLabel = () => {
    switch (themeMode) {
      case 'light': return '浅色模式';
      case 'dark': return '深色模式';
      case 'system': return '跟随系统';
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Theme Selector Modal */}
      <ThemeSelector
        visible={showThemeSelector}
        onClose={() => setShowThemeSelector(false)}
        currentTheme={themeMode}
        onSelectTheme={setThemeMode}
      />

      {/* About Modal */}
      <AboutModal
        visible={showAbout}
        onClose={() => setShowAbout(false)}
      />

      {/* Appearance Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>外观</Text>
        <SettingsItem
          icon="color-palette-outline"
          title="主题"
          subtitle={getThemeLabel()}
          onPress={() => setShowThemeSelector(true)}
          iconColor={Colors.primary}
        />
        <SettingsItem
          icon="phone-portrait-outline"
          title="触感反馈"
          subtitle="按钮点击震动"
          iconColor={Colors.accentCool}
          showChevron={false}
          rightElement={
            <Switch
              value={hapticEnabled}
              onValueChange={setHapticEnabled}
              trackColor={{ false: theme.border, true: Colors.primary + '60' }}
              thumbColor={hapticEnabled ? Colors.primary : '#f4f3f4'}
            />
          }
        />
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>通知提醒</Text>
        <SettingsItem
          icon="notifications-outline"
          title="智能提醒"
          subtitle={notificationsEnabled 
            ? (getTotalAlerts() > 0 ? `${getTotalAlerts()} 项需要关注` : '已开启') 
            : '已关闭'}
          iconColor={Colors.accent}
          showChevron={false}
          rightElement={
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: theme.border, true: Colors.accent + '60' }}
              thumbColor={notificationsEnabled ? Colors.accent : '#f4f3f4'}
            />
          }
        />
        
        {/* Expiry Status Summary */}
        <View style={[styles.expiryStatusCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.expiryStatusTitle, { color: theme.text }]}>库存保质期状态</Text>
          <View style={styles.expiryStatusGrid}>
            <View style={[styles.expiryStatusItem, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={[styles.expiryStatusCount, { color: '#DC2626' }]}>{expiryLevels.expired}</Text>
              <Text style={[styles.expiryStatusLabel, { color: '#DC2626' }]}>已过期</Text>
            </View>
            <View style={[styles.expiryStatusItem, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="warning" size={20} color="#B91C1C" />
              <Text style={[styles.expiryStatusCount, { color: '#B91C1C' }]}>{expiryLevels.expiring1Day}</Text>
              <Text style={[styles.expiryStatusLabel, { color: '#B91C1C' }]}>1天内</Text>
            </View>
            <View style={[styles.expiryStatusItem, { backgroundColor: '#FFEDD5' }]}>
              <Ionicons name="alert" size={20} color="#EA580C" />
              <Text style={[styles.expiryStatusCount, { color: '#EA580C' }]}>{expiryLevels.expiring3Days}</Text>
              <Text style={[styles.expiryStatusLabel, { color: '#EA580C' }]}>3天内</Text>
            </View>
            <View style={[styles.expiryStatusItem, { backgroundColor: '#FEF9C3' }]}>
              <Ionicons name="time" size={20} color="#CA8A04" />
              <Text style={[styles.expiryStatusCount, { color: '#CA8A04' }]}>{expiryLevels.expiring7Days}</Text>
              <Text style={[styles.expiryStatusLabel, { color: '#CA8A04' }]}>7天内</Text>
            </View>
          </View>
        </View>

        <SettingsItem
          icon="calendar-outline"
          title="待办提醒"
          subtitle="到期和高优先级待办提醒"
          iconColor={Colors.info}
          showChevron={false}
          rightElement={
            todoStats.overdue > 0 ? (
              <View style={[styles.badge, { backgroundColor: Colors.error }]}>
                <Text style={styles.badgeText}>{todoStats.overdue} 逾期</Text>
              </View>
            ) : todoStats.urgent > 0 ? (
              <View style={[styles.badge, { backgroundColor: Colors.accentWarm }]}>
                <Text style={styles.badgeText}>{todoStats.urgent} 紧急</Text>
              </View>
            ) : null
          }
        />
        <SettingsItem
          icon="refresh-outline"
          title="立即检查"
          subtitle="手动检查过期和待办事项"
          iconColor={Colors.primary}
          onPress={handleTestNotification}
        />
      </View>

      {/* Data Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>数据</Text>
        <SettingsItem
          icon="trash-outline"
          title="清除缓存"
          subtitle={`当前缓存: ${cacheSize}`}
          onPress={handleClearCache}
          iconColor={Colors.error}
        />
        <SettingsItem
          icon="cloud-upload-outline"
          title="数据同步"
          subtitle="自动同步到云端"
          iconColor={Colors.info}
          showChevron={false}
          rightElement={
            <View style={[styles.badge, { backgroundColor: Colors.accentWarm }]}>
              <Text style={styles.badgeText}>即将推出</Text>
            </View>
          }
        />
      </View>

      {/* AI Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>AI 设置</Text>
        <SettingsItem
          icon="sparkles-outline"
          title="AI 模型"
          subtitle="Gemini 2.5 Flash"
          iconColor={Colors.accent}
          showChevron={false}
        />
        <SettingsItem
          icon="happy-outline"
          title="AI 性格"
          subtitle="温柔管家"
          iconColor={Colors.accentWarm}
          showChevron={false}
          rightElement={
            <View style={[styles.badge, { backgroundColor: Colors.accentWarm }]}>
              <Text style={styles.badgeText}>即将推出</Text>
            </View>
          }
        />
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>支持</Text>
        <SettingsItem
          icon="help-circle-outline"
          title="帮助中心"
          subtitle="常见问题与使用指南"
          iconColor={Colors.info}
          onPress={() => Alert.alert('帮助中心', '功能开发中')}
        />
        <SettingsItem
          icon="chatbubble-outline"
          title="意见反馈"
          subtitle="告诉我们你的想法"
          iconColor={Colors.accent}
          onPress={() => Linking.openURL('mailto:support@onemind.app')}
        />
        <SettingsItem
          icon="star-outline"
          title="给个好评"
          subtitle="如果喜欢请支持我们"
          iconColor={Colors.accentWarm}
          onPress={() => Alert.alert('感谢', '感谢你的支持！')}
        />
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>关于</Text>
        <SettingsItem
          icon="information-circle-outline"
          title="关于 OneMind"
          subtitle={`版本 ${Application.nativeApplicationVersion || '1.0.0'}`}
          onPress={() => setShowAbout(true)}
        />
        <SettingsItem
          icon="document-text-outline"
          title="隐私政策"
          iconColor={theme.textSecondary}
          onPress={() => Alert.alert('隐私政策', '功能开发中')}
        />
        <SettingsItem
          icon="shield-checkmark-outline"
          title="用户协议"
          iconColor={theme.textSecondary}
          onPress={() => Alert.alert('用户协议', '功能开发中')}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          OneMind · AI 生活管家
        </Text>
        <Text style={[styles.footerSubtext, { color: theme.textSecondary }]}>
          一键录入，智能分流
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  expiryStatusCard: {
    marginHorizontal: 0,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
  },
  expiryStatusTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  expiryStatusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  expiryStatusItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  expiryStatusCount: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  expiryStatusLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footerSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  themeOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  // About modal styles
  aboutContent: {
    width: '85%',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  aboutLogo: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  aboutLogoInner: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  aboutSubtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  versionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
    gap: 8,
  },
  versionLabel: {
    fontSize: 13,
  },
  versionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  aboutDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 20,
  },
  aboutLinks: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  aboutLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  aboutLinkText: {
    fontSize: 14,
  },
  copyright: {
    fontSize: 12,
    marginTop: 24,
  },
});
