import { getHistory, formatTimestamp as formatHistoryTimestamp } from './historyStore';
import { getFinanceRecords, getActions, getInventoryItems } from './dataService';
import type { CaptureHistoryItem } from './historyStore';
import type { FinanceRecord, Action, InventoryItem } from './types';

export interface SearchResult {
  type: 'history' | 'finance' | 'todo' | 'inventory';
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  data: CaptureHistoryItem | FinanceRecord | Action | InventoryItem;
  matchedFields: string[];
}

/**
 * Search across all data types
 */
export async function searchAll(query: string): Promise<SearchResult[]> {
  try {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = query.trim().toLowerCase();
    const results: SearchResult[] = [];

    // Search history (with error handling)
    try {
      const historyResults = await searchHistory(searchTerm);
      if (historyResults && Array.isArray(historyResults)) {
        // Use traditional for loop to avoid iterator issues
        // Check length safely
        try {
          const len = Number(historyResults.length);
          if (isNaN(len) || len < 0) {
            throw new Error('Invalid length');
          }
          for (let i = 0; i < len; i++) {
            const result = historyResults[i];
            if (result && typeof result === 'object') {
              results.push(result);
            }
          }
        } catch (lenError) {
          console.error('Error accessing historyResults length:', lenError);
        }
      }
    } catch (error) {
      console.error('History search error:', error);
    }

    // Search finance records (with error handling)
    try {
      const financeResults = await searchFinance(searchTerm);
      if (financeResults && Array.isArray(financeResults)) {
        try {
          const len = Number(financeResults.length);
          if (!isNaN(len) && len >= 0) {
            for (let i = 0; i < len; i++) {
              const result = financeResults[i];
              if (result && typeof result === 'object') {
                results.push(result);
              }
            }
          }
        } catch (lenError) {
          console.error('Error accessing financeResults length:', lenError);
        }
      }
    } catch (error) {
      console.error('Finance search error:', error);
    }

    // Search todos/actions (with error handling)
    try {
      const todoResults = await searchTodos(searchTerm);
      if (todoResults && Array.isArray(todoResults)) {
        try {
          const len = Number(todoResults.length);
          if (!isNaN(len) && len >= 0) {
            for (let i = 0; i < len; i++) {
              const result = todoResults[i];
              if (result && typeof result === 'object') {
                results.push(result);
              }
            }
          }
        } catch (lenError) {
          console.error('Error accessing todoResults length:', lenError);
        }
      }
    } catch (error) {
      console.error('Todo search error:', error);
    }

    // Search inventory (with error handling)
    try {
      const inventoryResults = await searchInventory(searchTerm);
      if (inventoryResults && Array.isArray(inventoryResults)) {
        try {
          const len = Number(inventoryResults.length);
          if (!isNaN(len) && len >= 0) {
            for (let i = 0; i < len; i++) {
              const result = inventoryResults[i];
              if (result && typeof result === 'object') {
                results.push(result);
              }
            }
          }
        } catch (lenError) {
          console.error('Error accessing inventoryResults length:', lenError);
        }
      }
    } catch (error) {
      console.error('Inventory search error:', error);
    }

    // Ensure results is an array and filter out invalid items
    if (!Array.isArray(results) || typeof results.length !== 'number') {
      console.error('Results is not an array:', results);
      return [];
    }

    // Manually filter instead of using Array.filter to avoid iterator issues
    const validResults: SearchResult[] = [];
    const resultsLen = results.length;
    for (let i = 0; i < resultsLen; i++) {
    const result = results[i];
    if (
      result &&
      typeof result === 'object' &&
      Array.isArray(result.matchedFields) &&
      typeof result.id === 'string' &&
      typeof result.title === 'string'
    ) {
      validResults.push(result);
    }
  }

    // Sort by relevance (exact matches first, then partial matches)
    // Create a new array to ensure it's a proper array instance
    const sortedResults: SearchResult[] = [];
    
    // First, add exact matches
    const validLen = validResults.length;
    for (let i = 0; i < validLen; i++) {
    const result = validResults[i];
    if (!result || !result.matchedFields || !Array.isArray(result.matchedFields)) continue;
    
    let isExact = false;
    for (let j = 0; j < result.matchedFields.length; j++) {
      const field = result.matchedFields[j];
      if (typeof field === 'string' && field.toLowerCase() === searchTerm) {
        isExact = true;
        break;
      }
    }
    
    if (isExact) {
      sortedResults.push(result);
    }
  }
  
    // Then, add partial matches
    for (let i = 0; i < validLen; i++) {
    const result = validResults[i];
    if (!result || !result.matchedFields || !Array.isArray(result.matchedFields)) continue;
    
    let isExact = false;
    for (let j = 0; j < result.matchedFields.length; j++) {
      const field = result.matchedFields[j];
      if (typeof field === 'string' && field.toLowerCase() === searchTerm) {
        isExact = true;
        break;
      }
    }
    
    if (!isExact) {
      sortedResults.push(result);
    }
  }
    
    return sortedResults;
  } catch (error) {
    console.error('Error in searchAll:', error);
    return [];
  }
}

/**
 * Search history records
 */
async function searchHistory(query: string): Promise<SearchResult[]> {
  try {
    const history = await getHistory();
    const results: SearchResult[] = [];

    if (!history || !Array.isArray(history) || history.length === 0) {
      return results;
    }

    // Use traditional for loop to avoid iterator issues
    for (let i = 0; i < history.length; i++) {
      const item = history[i];
      // Skip invalid items
      if (!item || typeof item !== 'object' || !item.id || !item.timestamp) {
        continue;
      }

    const matchedFields: string[] = [];
    
    // Search in AI response summary
    if (item.aiResponse?.summary && typeof item.aiResponse.summary === 'string') {
      if (item.aiResponse.summary.toLowerCase().includes(query)) {
        matchedFields.push(item.aiResponse.summary);
      }
    }

    // Search in route type
    if (item.aiResponse?.route_type && typeof item.aiResponse.route_type === 'string') {
      if (item.aiResponse.route_type.toLowerCase().includes(query)) {
        matchedFields.push(item.aiResponse.route_type);
      }
    }

    // Search in type (voice/photo)
    if (item.type && typeof item.type === 'string') {
      if (item.type.toLowerCase().includes(query)) {
        matchedFields.push(item.type === 'voice' ? '语音' : '照片');
      }
    }

    if (matchedFields.length > 0) {
      const title = item.aiResponse?.summary || (item.type === 'voice' ? '语音录制' : '拍照记录');
      results.push({
        type: 'history',
        id: String(item.id),
        title: String(title),
        subtitle: formatHistoryTimestamp(item.timestamp),
        icon: getHistoryIcon(item.aiResponse?.route_type),
        color: getHistoryColor(item.aiResponse?.route_type),
        data: item,
        matchedFields: (() => {
          const filtered: string[] = [];
          for (let k = 0; k < matchedFields.length; k++) {
            const f = matchedFields[k];
            if (typeof f === 'string') {
              filtered.push(f);
            }
          }
          return filtered;
        })(),
      });
    }
  }

    return results;
  } catch (error) {
    console.error('Error in searchHistory:', error);
    return [];
  }
}

/**
 * Search finance records
 */
async function searchFinance(query: string): Promise<SearchResult[]> {
  try {
    const { data: records, error } = await getFinanceRecords(100);
    const results: SearchResult[] = [];

    if (error || !records || !Array.isArray(records)) {
      return results;
    }

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (!record || typeof record !== 'object') {
        continue;
      }

      const matchedFields: string[] = [];

    // Search in category
    if (record.category?.toLowerCase().includes(query)) {
      matchedFields.push(record.category);
    }

    // Search in emotion tag
    if (record.emotion_tag?.toLowerCase().includes(query)) {
      matchedFields.push(record.emotion_tag);
    }

    // Search in amount (as string)
    if (record.amount.toString().includes(query)) {
      matchedFields.push(`¥${record.amount}`);
    }

    if (matchedFields.length > 0) {
      results.push({
        type: 'finance',
        id: record.id,
        title: record.category || '未分类',
        subtitle: `¥${record.amount.toFixed(2)} · ${new Date(record.created_at).toLocaleDateString('zh-CN')}`,
        icon: 'wallet-outline',
        color: '#F59E0B',
        data: record,
        matchedFields,
      });
    }
    }

    return results;
  } catch (error) {
    console.error('Error in searchFinance:', error);
    return [];
  }
}

/**
 * Search todos/actions
 */
async function searchTodos(query: string): Promise<SearchResult[]> {
  try {
    const { data: actions, error } = await getActions();
    const results: SearchResult[] = [];

    if (error || !actions || !Array.isArray(actions)) {
      return results;
    }

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      if (!action || typeof action !== 'object') {
        continue;
      }
    const matchedFields: string[] = [];

    // Search in title
    if (action.title?.toLowerCase().includes(query)) {
      matchedFields.push(action.title);
    }

    // Search in type
    if (action.type?.toLowerCase().includes(query)) {
      matchedFields.push(action.type);
    }

    // Search in priority
    const priorityMap: Record<number, string> = { 1: '低', 2: '中', 3: '高' };
    const priorityText = priorityMap[action.priority];
    if (priorityText?.toLowerCase().includes(query)) {
      matchedFields.push(priorityText);
    }

    if (matchedFields.length > 0) {
      const statusText = action.status === 'completed' ? '已完成' : '待完成';
      results.push({
        type: 'todo',
        id: action.id,
        title: action.title,
        subtitle: `${statusText} · ${action.type}`,
        icon: action.status === 'completed' ? 'checkmark-circle' : 'checkbox-outline',
        color: action.status === 'completed' ? '#10B981' : '#3B82F6',
        data: action,
        matchedFields,
      });
    }
    }

    return results;
  } catch (error) {
    console.error('Error in searchTodos:', error);
    return [];
  }
}

/**
 * Search inventory items
 */
async function searchInventory(query: string): Promise<SearchResult[]> {
  try {
    const { data: items, error } = await getInventoryItems();
    const results: SearchResult[] = [];

    if (error || !items || !Array.isArray(items)) {
      return results;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== 'object') {
        continue;
      }
    const matchedFields: string[] = [];

    // Search in name
    if (item.name?.toLowerCase().includes(query)) {
      matchedFields.push(item.name);
    }

    // Search in category
    if (item.category?.toLowerCase().includes(query)) {
      matchedFields.push(item.category);
    }

    // Search in storage zone
    const zoneMap: Record<string, string> = {
      'Fridge': '冰箱冷藏',
      'Freezer': '冰箱冷冻',
      'Pantry': '食品柜',
      'Bathroom': '浴室',
      'Bedroom': '卧室',
      'LivingRoom': '客厅',
      'Kitchen': '厨房',
      'Storage': '储物间',
      'Other': '其他',
    };
    const zoneLabel = zoneMap[item.storage_zone] || item.storage_zone;
    if (zoneLabel.toLowerCase().includes(query)) {
      matchedFields.push(zoneLabel);
    }

    if (matchedFields.length > 0) {
      results.push({
        type: 'inventory',
        id: item.id,
        title: item.name,
        subtitle: `${item.quantity} ${item.unit} · ${zoneLabel}`,
        icon: 'cube-outline',
        color: '#6366F1',
        data: item,
        matchedFields,
      });
      }
    }

    return results;
  } catch (error) {
    console.error('Error in searchInventory:', error);
    return [];
  }
}

/**
 * Helper functions
 */
function getHistoryIcon(routeType?: string): string {
  switch (routeType) {
    case 'finance': return 'wallet-outline';
    case 'todo': return 'checkbox-outline';
    case 'inventory': return 'cube-outline';
    default: return 'document-outline';
  }
}

function getHistoryColor(routeType?: string): string {
  switch (routeType) {
    case 'finance': return '#F59E0B';
    case 'todo': return '#3B82F6';
    case 'inventory': return '#6366F1';
    default: return '#6B7280';
  }
}

