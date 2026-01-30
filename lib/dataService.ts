import { supabase } from './supabase';
import type { FinanceRecord, Action, InventoryItem, StorageZone } from './types';

// Default anonymous user ID (for development without auth)
const ANON_USER_ID = '00000000-0000-0000-0000-000000000000';

// ============ Finance Records ============

export interface FinanceStats {
  total: number;
  count: number;
  byCategory: Record<string, { total: number; count: number }>;
  byEmotion: Record<string, number>;
  essentialTotal: number;
  nonEssentialTotal: number;
}

export async function getFinanceRecords(
  limit = 50,
  offset = 0
): Promise<{ data: FinanceRecord[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('finance_records')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { data: [], error };
    }

    return { data: data as FinanceRecord[], error: null };
  } catch (err) {
    return { data: [], error: err as Error };
  }
}

export async function getFinanceStats(): Promise<{ stats: FinanceStats | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('finance_records')
      .select('*');

    if (error) {
      return { stats: null, error };
    }

    const records = data as FinanceRecord[];
    
    const stats: FinanceStats = {
      total: 0,
      count: records.length,
      byCategory: {},
      byEmotion: {},
      essentialTotal: 0,
      nonEssentialTotal: 0,
    };

    records.forEach(record => {
      const amount = record.amount || 0;
      stats.total += amount;

      // By category
      const category = record.category || '未分类';
      if (!stats.byCategory[category]) {
        stats.byCategory[category] = { total: 0, count: 0 };
      }
      stats.byCategory[category].total += amount;
      stats.byCategory[category].count += 1;

      // By emotion
      if (record.emotion_tag) {
        stats.byEmotion[record.emotion_tag] = (stats.byEmotion[record.emotion_tag] || 0) + amount;
      }

      // Essential vs non-essential
      if (record.is_essential) {
        stats.essentialTotal += amount;
      } else {
        stats.nonEssentialTotal += amount;
      }
    });

    return { stats, error: null };
  } catch (err) {
    return { stats: null, error: err as Error };
  }
}

export async function deleteFinanceRecord(id: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('finance_records')
      .delete()
      .eq('id', id);

    return { error };
  } catch (err) {
    return { error: err as Error };
  }
}

export async function updateFinanceRecord(
  id: string,
  updates: Partial<Pick<FinanceRecord, 'amount' | 'category' | 'description' | 'is_essential' | 'record_date'>>
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('finance_records')
      .update(updates as any)
      .eq('id', id);

    return { error };
  } catch (err) {
    return { error: err as Error };
  }
}

// ============ Actions (Todos) ============

export async function getActions(
  status?: 'pending' | 'completed' | 'snoozed',
  limit = 50
): Promise<{ data: Action[]; error: Error | null }> {
  try {
    let query = supabase
      .from('actions')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return { data: [], error };
    }

    return { data: data as Action[], error: null };
  } catch (err) {
    return { data: [], error: err as Error };
  }
}

export async function updateActionStatus(
  id: string,
  status: 'pending' | 'completed' | 'snoozed'
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('actions')
      .update({ status } as any)
      .eq('id', id);

    return { error };
  } catch (err) {
    return { error: err as Error };
  }
}

export async function deleteAction(id: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('actions')
      .delete()
      .eq('id', id);

    return { error };
  } catch (err) {
    return { error: err as Error };
  }
}

// ============ Inventory Items ============

export async function getInventoryItems(
  storageZone?: StorageZone,
  limit = 100
): Promise<{ data: InventoryItem[]; error: Error | null }> {
  try {
    let query = supabase
      .from('inventory_items')
      .select('*')
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .limit(limit);

    if (storageZone) {
      query = query.eq('storage_zone', storageZone);
    }

    const { data, error } = await query;

    if (error) {
      return { data: [], error };
    }

    return { data: data as InventoryItem[], error: null };
  } catch (err) {
    return { data: [], error: err as Error };
  }
}

export async function updateInventoryQuantity(
  id: string,
  quantity: number
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('inventory_items')
      .update({ quantity, last_confirmed_at: new Date().toISOString() } as any)
      .eq('id', id);

    return { error };
  } catch (err) {
    return { error: err as Error };
  }
}

export async function deleteInventoryItem(id: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id);

    return { error };
  } catch (err) {
    return { error: err as Error };
  }
}

// Get items expiring soon (within days)
export async function getExpiringItems(days = 7): Promise<{ data: InventoryItem[]; error: Error | null }> {
  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .not('expiry_date', 'is', null)
      .lte('expiry_date', futureDate.toISOString().split('T')[0])
      .order('expiry_date', { ascending: true });

    if (error) {
      return { data: [], error };
    }

    return { data: data as InventoryItem[], error: null };
  } catch (err) {
    return { data: [], error: err as Error };
  }
}

// ============ Chart Data ============

export interface TrendChartData {
  labels: string[];
  data: number[];
}

export interface CategoryChartData {
  name: string;
  amount: number;
  color: string;
}

export interface WeeklyStats {
  thisWeek: number;
  lastWeek: number;
  averageDaily: number;
}

// Get spending trend data for the last N days
export async function getSpendingTrend(days = 7): Promise<{ 
  data: TrendChartData; 
  error: Error | null 
}> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('finance_records')
      .select('amount, created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      return { data: { labels: [], data: [] }, error };
    }

    // Group by date
    const dailyTotals: Record<string, number> = {};
    const labels: string[] = [];
    
    // Initialize all days with 0
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      const dayLabel = `${date.getMonth() + 1}/${date.getDate()}`;
      dailyTotals[dateKey] = 0;
      labels.push(dayLabel);
    }

    // Sum amounts by date
    (data as FinanceRecord[]).forEach(record => {
      if (record.created_at) {
        const dateKey = new Date(record.created_at).toISOString().split('T')[0];
        if (dailyTotals.hasOwnProperty(dateKey)) {
          dailyTotals[dateKey] += record.amount || 0;
        }
      }
    });

    const chartData = Object.keys(dailyTotals)
      .sort()
      .map(key => dailyTotals[key]);

    return { 
      data: { labels, data: chartData }, 
      error: null 
    };
  } catch (err) {
    return { data: { labels: [], data: [] }, error: err as Error };
  }
}

// Get category breakdown for pie chart
export async function getCategoryBreakdown(): Promise<{
  data: CategoryChartData[];
  error: Error | null;
}> {
  const CATEGORY_COLORS: Record<string, string> = {
    '餐饮': '#F59E0B',
    '交通': '#3B82F6',
    '购物': '#EC4899',
    '娱乐': '#8B5CF6',
    '生活': '#10B981',
    '医疗': '#EF4444',
    '教育': '#06B6D4',
    '其他': '#6B7280',
    '未分类': '#9CA3AF',
  };

  try {
    const { data, error } = await supabase
      .from('finance_records')
      .select('amount, category');

    if (error) {
      return { data: [], error };
    }

    const categoryTotals: Record<string, number> = {};
    
    (data as FinanceRecord[]).forEach(record => {
      const category = record.category || '未分类';
      categoryTotals[category] = (categoryTotals[category] || 0) + (record.amount || 0);
    });

    const chartData: CategoryChartData[] = Object.entries(categoryTotals)
      .map(([name, amount]) => ({
        name,
        amount,
        color: CATEGORY_COLORS[name] || '#6366F1',
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6); // Top 6 categories

    return { data: chartData, error: null };
  } catch (err) {
    return { data: [], error: err as Error };
  }
}

// Get weekly comparison stats
export async function getWeeklyStats(): Promise<{
  stats: WeeklyStats;
  error: Error | null;
}> {
  try {
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setMilliseconds(-1);

    // This week's spending
    const { data: thisWeekData, error: error1 } = await supabase
      .from('finance_records')
      .select('amount')
      .gte('created_at', thisWeekStart.toISOString());

    // Last week's spending
    const { data: lastWeekData, error: error2 } = await supabase
      .from('finance_records')
      .select('amount')
      .gte('created_at', lastWeekStart.toISOString())
      .lt('created_at', thisWeekStart.toISOString());

    if (error1 || error2) {
      return { 
        stats: { thisWeek: 0, lastWeek: 0, averageDaily: 0 }, 
        error: error1 || error2 
      };
    }

    const thisWeek = (thisWeekData as FinanceRecord[]).reduce(
      (sum, r) => sum + (r.amount || 0), 0
    );
    const lastWeek = (lastWeekData as FinanceRecord[]).reduce(
      (sum, r) => sum + (r.amount || 0), 0
    );

    // Days elapsed this week (including today)
    const daysThisWeek = now.getDay() + 1;
    const averageDaily = daysThisWeek > 0 ? thisWeek / daysThisWeek : 0;

    return {
      stats: { thisWeek, lastWeek, averageDaily },
      error: null,
    };
  } catch (err) {
    return { 
      stats: { thisWeek: 0, lastWeek: 0, averageDaily: 0 }, 
      error: err as Error 
    };
  }
}
