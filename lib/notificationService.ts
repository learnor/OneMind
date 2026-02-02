import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getExpiringItems, getActions } from './dataService';
import type { Action } from './types';

// Storage keys
const NOTIFICATION_ENABLED_KEY = '@OneMind:notifications_enabled';
const LAST_CHECK_KEY = '@OneMind:last_notification_check';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ============ Permission Management ============

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Notification permission not granted');
    return false;
  }

  // Configure for Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'OneMind 提醒',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
    });

    await Notifications.setNotificationChannelAsync('expiry', {
      name: '过期提醒',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F59E0B',
    });

    await Notifications.setNotificationChannelAsync('todo', {
      name: '待办提醒',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
    });
  }

  return true;
}

export async function getNotificationPermissionStatus(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

// ============ Notification Preferences ============

export async function isNotificationEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(NOTIFICATION_ENABLED_KEY);
    return value !== 'false'; // Default to true
  } catch {
    return true;
  }
}

export async function setNotificationEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, enabled.toString());
    if (enabled) {
      await requestNotificationPermissions();
    }
  } catch (error) {
    console.error('Failed to save notification preference:', error);
  }
}

// ============ Send Notifications ============

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId: string = 'default'
): Promise<string | null> {
  try {
    const enabled = await isNotificationEnabled();
    if (!enabled) return null;

    const hasPermission = await getNotificationPermissionStatus();
    if (!hasPermission) return null;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null, // Send immediately
    });

    return notificationId;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return null;
  }
}

export async function scheduleNotification(
  title: string,
  body: string,
  triggerDate: Date,
  data?: Record<string, unknown>
): Promise<string | null> {
  try {
    const enabled = await isNotificationEnabled();
    if (!enabled) return null;

    const hasPermission = await getNotificationPermissionStatus();
    if (!hasPermission) return null;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    return notificationId;
  } catch (error) {
    console.error('Failed to schedule notification:', error);
    return null;
  }
}

// ============ Expiry & Todo Checking ============

// Expiry levels for inventory items
export interface ExpiryLevels {
  expired: number;      // 已过期
  expiring1Day: number; // 1天内过期（今天/明天）
  expiring3Days: number; // 3天内过期
  expiring7Days: number; // 7天内过期
}

export interface CheckResult {
  expiryLevels: ExpiryLevels;
  expiredItems: number;   // Total expired (for backward compat)
  expiringItems: number;  // Total expiring (for backward compat)
  urgentTodos: number;
  overdueTodos: number;
}

export async function checkAndNotify(): Promise<CheckResult> {
  const emptyExpiryLevels: ExpiryLevels = {
    expired: 0,
    expiring1Day: 0,
    expiring3Days: 0,
    expiring7Days: 0,
  };
  
  const result: CheckResult = {
    expiryLevels: emptyExpiryLevels,
    expiringItems: 0,
    expiredItems: 0,
    urgentTodos: 0,
    overdueTodos: 0,
  };

  try {
    const enabled = await isNotificationEnabled();
    if (!enabled) return result;

    // Check if we've already checked today
    const lastCheck = await AsyncStorage.getItem(LAST_CHECK_KEY);
    const today = new Date().toDateString();
    
    if (lastCheck === today) {
      // Already checked today, skip
      return result;
    }

    // Update last check date
    await AsyncStorage.setItem(LAST_CHECK_KEY, today);

    // Check expiring inventory items
    const expiryLevels = await checkExpiringInventory();
    result.expiryLevels = expiryLevels;
    result.expiredItems = expiryLevels.expired;
    result.expiringItems = expiryLevels.expiring1Day + expiryLevels.expiring3Days + expiryLevels.expiring7Days;

    // Check urgent/overdue todos
    const todoStatus = await checkUrgentTodos();
    result.urgentTodos = todoStatus.urgent;
    result.overdueTodos = todoStatus.overdue;

    // Send consolidated notification if there are items
    await sendConsolidatedNotification(result);

    return result;
  } catch (error) {
    console.error('Failed to check and notify:', error);
    return result;
  }
}

async function checkExpiringInventory(): Promise<ExpiryLevels> {
  const levels: ExpiryLevels = {
    expired: 0,
    expiring1Day: 0,
    expiring3Days: 0,
    expiring7Days: 0,
  };
  
  try {
    const { data: items, error } = await getExpiringItems(7); // Items expiring within 7 days
    
    if (error || !items) {
      console.error('Failed to fetch expiring items:', error);
      return levels;
    }
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const day1 = new Date(now);
    day1.setDate(day1.getDate() + 1);
    
    const day3 = new Date(now);
    day3.setDate(day3.getDate() + 3);
    
    const day7 = new Date(now);
    day7.setDate(day7.getDate() + 7);

    for (const item of items) {
      if (item.expiry_date) {
        const expiryDate = new Date(item.expiry_date);
        expiryDate.setHours(0, 0, 0, 0);
        
        if (expiryDate < now) {
          // 已过期
          levels.expired++;
        } else if (expiryDate <= day1) {
          // 1天内过期（今天或明天）
          levels.expiring1Day++;
        } else if (expiryDate <= day3) {
          // 3天内过期
          levels.expiring3Days++;
        } else if (expiryDate <= day7) {
          // 7天内过期
          levels.expiring7Days++;
        }
      }
    }

    return levels;
  } catch (error) {
    console.error('Failed to check expiring inventory:', error);
    return levels;
  }
}

async function checkUrgentTodos(): Promise<{ urgent: number; overdue: number }> {
  try {
    const { data: actions, error } = await getActions();
    
    if (error || !actions) {
      console.error('Failed to fetch actions:', error);
      return { urgent: 0, overdue: 0 };
    }
    
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let urgent = 0;
    let overdue = 0;

    for (const action of actions) {
      if (action.status === 'completed') continue;

      if (action.due_date) {
        const dueDate = new Date(action.due_date);
        if (dueDate < now) {
          overdue++;
        } else if (dueDate <= tomorrow) {
          urgent++;
        }
      }

      // High priority items are also considered urgent
      if (action.priority === 3 && action.status === 'pending') {
        urgent++;
      }
    }

    return { urgent, overdue };
  } catch (error) {
    console.error('Failed to check urgent todos:', error);
    return { urgent: 0, overdue: 0 };
  }
}

async function sendConsolidatedNotification(result: CheckResult): Promise<void> {
  const messages: string[] = [];
  const { expiryLevels } = result;

  // 已过期 - 最紧急
  if (expiryLevels.expired > 0) {
    messages.push(`🚨 ${expiryLevels.expired} 件物品已过期`);
  }

  // 1天内过期 - 紧急
  if (expiryLevels.expiring1Day > 0) {
    messages.push(`🔴 ${expiryLevels.expiring1Day} 件物品今明两天过期`);
  }

  // 3天内过期 - 警告
  if (expiryLevels.expiring3Days > 0) {
    messages.push(`🟠 ${expiryLevels.expiring3Days} 件物品3天内过期`);
  }

  // 7天内过期 - 提醒
  if (expiryLevels.expiring7Days > 0) {
    messages.push(`🟡 ${expiryLevels.expiring7Days} 件物品7天内过期`);
  }

  // 待办提醒
  if (result.overdueTodos > 0) {
    messages.push(`📋 ${result.overdueTodos} 项待办已逾期`);
  }

  if (result.urgentTodos > 0) {
    messages.push(`⏰ ${result.urgentTodos} 项紧急待办`);
  }

  if (messages.length === 0) return;

  const title = '📌 OneMind 提醒';
  const body = messages.join('\n');

  await sendLocalNotification(title, body, {
    type: 'daily_summary',
    ...result,
  });
}

// ============ Force Check (ignore daily limit) ============

export async function forceCheckAndNotify(): Promise<CheckResult> {
  // Clear last check to force a new check
  await AsyncStorage.removeItem(LAST_CHECK_KEY);
  return checkAndNotify();
}

// ============ Cancel All Notifications ============

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ============ Get Badge Count ============

export async function updateBadgeCount(): Promise<void> {
  try {
    const result = await getUrgentCounts();
    const total = result.expiredItems + result.overdueTodos;
    await Notifications.setBadgeCountAsync(total);
  } catch (error) {
    console.error('Failed to update badge count:', error);
  }
}

export async function getUrgentCounts(): Promise<{
  expiryLevels: ExpiryLevels;
  expiringItems: number;
  expiredItems: number;
  urgentTodos: number;
  overdueTodos: number;
}> {
  const expiryLevels = await checkExpiringInventory();
  const todoStatus = await checkUrgentTodos();

  return {
    expiryLevels,
    expiringItems: expiryLevels.expiring1Day + expiryLevels.expiring3Days + expiryLevels.expiring7Days,
    expiredItems: expiryLevels.expired,
    urgentTodos: todoStatus.urgent,
    overdueTodos: todoStatus.overdue,
  };
}

// ============ Action Notifications ============

const DEFAULT_REMIND_HOUR = 9;
const remindNotificationId = (id: string) => `action-${id}-remind`;
const dueNotificationId = (id: string) => `action-${id}-due`;

function parseDateTime(value: string | null, fallbackHour = DEFAULT_REMIND_HOUR): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const withTime = trimmed.includes(' ') && !trimmed.includes('T') ? trimmed.replace(' ', 'T') : trimmed;
  const date = new Date(isDateOnly ? `${trimmed}T${String(fallbackHour).padStart(2, '0')}:00:00` : withTime);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatDueCountdown(dueDate: Date | null) {
  if (!dueDate) return '';
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) return '已过期';
  if (diffDays === 0) return '今天截止';
  return `${diffDays}天后截止`;
}

export async function cancelActionNotifications(actionId: string) {
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(remindNotificationId(actionId)).catch(() => null),
    Notifications.cancelScheduledNotificationAsync(dueNotificationId(actionId)).catch(() => null),
  ]);
}

export async function scheduleActionNotifications(action: Action) {
  if (action.status === 'completed') {
    await cancelActionNotifications(action.id);
    return;
  }

  const enabled = await isNotificationEnabled();
  if (!enabled) return;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  await cancelActionNotifications(action.id);

  const dueDate = parseDateTime(action.due_date, DEFAULT_REMIND_HOUR);
  const remindDate = parseDateTime(action.remind_at, DEFAULT_REMIND_HOUR) || (action.remind_at ? null : dueDate);
  const countdownText = formatDueCountdown(dueDate);
  const bodySuffix = countdownText ? ` · ${countdownText}` : '';

  if (remindDate && remindDate.getTime() > Date.now()) {
    await Notifications.scheduleNotificationAsync({
      identifier: remindNotificationId(action.id),
      content: {
        title: action.title,
        body: `${action.category || '待办提醒'}${bodySuffix}`,
        data: { actionId: action.id },
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: remindDate },
    });
  }

  if (dueDate && (!remindDate || !isSameDay(remindDate, dueDate)) && dueDate.getTime() > Date.now()) {
    await Notifications.scheduleNotificationAsync({
      identifier: dueNotificationId(action.id),
      content: {
        title: action.title,
        body: `到期提醒${bodySuffix}`,
        data: { actionId: action.id },
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dueDate },
    });
  }
}
