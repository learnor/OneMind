import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AIRouteResponse } from './aiService';

const HISTORY_KEY = '@OneMind:capture_history';

export type CaptureType = 'voice' | 'photo';
export type ProcessingStatus = 'local' | 'processing' | 'completed' | 'failed';

export interface CaptureHistoryItem {
  id: string;
  type: CaptureType;
  uri: string;
  timestamp: number;
  duration?: number; // for voice recordings (ms)
  photoCount?: number; // for photo batches
  // AI processing fields
  processingStatus?: ProcessingStatus;
  aiResponse?: AIRouteResponse;
  sessionId?: string;
}

// Get all history items
export async function getHistory(): Promise<CaptureHistoryItem[]> {
  try {
    const json = await AsyncStorage.getItem(HISTORY_KEY);
    if (json) {
      return JSON.parse(json);
    }
    return [];
  } catch (error) {
    console.error('Failed to get history:', error);
    return [];
  }
}

// Add a new history item
export async function addHistoryItem(item: Omit<CaptureHistoryItem, 'id' | 'timestamp'>): Promise<CaptureHistoryItem> {
  try {
    const history = await getHistory();
    const newItem: CaptureHistoryItem = {
      ...item,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };
    
    // Keep only last 50 items
    const updatedHistory = [newItem, ...history].slice(0, 50);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
    
    return newItem;
  } catch (error) {
    console.error('Failed to add history item:', error);
    throw error;
  }
}

// Update an existing history item
export async function updateHistoryItem(
  id: string,
  updates: Partial<CaptureHistoryItem>
): Promise<void> {
  try {
    const history = await getHistory();
    const index = history.findIndex(item => item.id === id);
    
    if (index !== -1) {
      history[index] = { ...history[index], ...updates };
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }
  } catch (error) {
    console.error('Failed to update history item:', error);
  }
}

// Delete a single history item
export async function deleteHistoryItem(id: string): Promise<void> {
  try {
    const history = await getHistory();
    const updatedHistory = history.filter(item => item.id !== id);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error('Failed to delete history item:', error);
    throw error;
  }
}

// Get a single history item by ID
export async function getHistoryItem(id: string): Promise<CaptureHistoryItem | null> {
  try {
    const history = await getHistory();
    return history.find(item => item.id === id) || null;
  } catch (error) {
    console.error('Failed to get history item:', error);
    return null;
  }
}

// Clear all history
export async function clearHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
}

// Format timestamp for display
export function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) { // < 1 minute
    return '刚刚';
  } else if (diff < 3600000) { // < 1 hour
    const minutes = Math.floor(diff / 60000);
    return `${minutes} 分钟前`;
  } else if (diff < 86400000) { // < 1 day
    const hours = Math.floor(diff / 3600000);
    return `${hours} 小时前`;
  } else {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
}
