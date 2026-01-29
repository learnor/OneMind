// Database Types based on OneMind Schema

export interface Profile {
  id: string; // UUID, references auth.users
  username: string | null;
  ai_persona: string; // Default: 'Gentle Butler'
  avatar_url: string | null;
  created_at: string;
}

export interface Location {
  id: string;
  user_id: string;
  name: string | null; // e.g., '山姆会员店'
  category: 'Home' | 'Office' | 'Shop' | 'Gym' | string;
  coords: { lat: number; lng: number } | null;
  address: string | null;
}

export type InputSessionSourceType = 'Voice' | 'Image_Batch' | 'Mixed';

export interface InputSession {
  id: string;
  user_id: string;
  source_type: InputSessionSourceType;
  raw_content_url: string | null; // Storage path for voice/images
  processed_summary: string | null; // AI-generated summary
  created_at: string;
}

// Storage zones - 位置优先，弱化分类
export type StorageZone = 
  // 食品相关
  | 'Fridge'      // 冰箱冷藏
  | 'Freezer'     // 冰箱冷冻
  | 'Pantry'      // 食品柜/储物柜
  // 日用品相关
  | 'Bathroom'    // 浴室/卫生间
  | 'Bedroom'     // 卧室
  | 'LivingRoom'  // 客厅
  | 'Kitchen'     // 厨房（非食品）
  | 'Storage'     // 储物间/储藏室
  | 'Other';      // 其他

export interface InventoryItem {
  id: string;
  user_id: string;
  name: string;
  category: '食品' | '耗材' | '药品' | string;
  storage_zone: StorageZone;
  quantity: number;
  unit: string; // e.g., '个', '瓶', 'kg'
  expiry_date: string | null;
  predicted_depletion_date: string | null;
  requires_thawing: boolean;
  last_confirmed_at: string | null;
  price_history_id: string | null;
}

export interface FinanceRecord {
  id: string;
  user_id: string;
  amount: number;
  category: string | null;
  emotion_tag: string | null; // Mood when spending
  is_essential: boolean | null;
  location_id: string | null;
  session_id: string | null;
  created_at: string;
}

export interface PriceHistory {
  id: string;
  item_name_semantic: string; // Semantic name for cross-platform matching
  price_per_unit: number;
  channel: string | null; // Purchase channel
  is_on_sale: boolean | null;
  location_id: string | null;
  recorded_at: string;
}

export type ActionType = 'Todo' | 'Done' | 'Inspiration' | 'Reminder';
export type TriggerType = 'Time' | 'Location' | 'Depletion';
export type ActionStatus = 'pending' | 'completed' | 'snoozed';

export interface Action {
  id: string;
  user_id: string;
  title: string;
  type: ActionType;
  priority: 1 | 2 | 3; // 1: Low, 2: Medium, 3: High
  trigger_type: TriggerType | null;
  trigger_value: Record<string, unknown> | null; // JSONB for time/location
  status: ActionStatus;
  related_inventory_id: string | null;
}

// Supabase Database type for type-safe queries
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'>;
        Update: Partial<Omit<Profile, 'id'>>;
      };
      locations: {
        Row: Location;
        Insert: Omit<Location, 'id'>;
        Update: Partial<Omit<Location, 'id'>>;
      };
      input_sessions: {
        Row: InputSession;
        Insert: Omit<InputSession, 'id' | 'created_at'>;
        Update: Partial<Omit<InputSession, 'id'>>;
      };
      inventory_items: {
        Row: InventoryItem;
        Insert: Omit<InventoryItem, 'id'>;
        Update: Partial<Omit<InventoryItem, 'id'>>;
      };
      finance_records: {
        Row: FinanceRecord;
        Insert: Omit<FinanceRecord, 'id' | 'created_at'>;
        Update: Partial<Omit<FinanceRecord, 'id'>>;
      };
      price_history: {
        Row: PriceHistory;
        Insert: Omit<PriceHistory, 'id' | 'recorded_at'>;
        Update: Partial<Omit<PriceHistory, 'id'>>;
      };
      actions: {
        Row: Action;
        Insert: Omit<Action, 'id'>;
        Update: Partial<Omit<Action, 'id'>>;
      };
    };
  };
}
