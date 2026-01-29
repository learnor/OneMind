-- OneMind Database Schema
-- 在 Supabase SQL Editor 中执行此文件

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 用户扩展信息 (与 Auth 关联)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users PRIMARY KEY,
    username TEXT,
    ai_persona TEXT DEFAULT 'Gentle Butler', -- 性格设定
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 地点管理 (支持地理围栏)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users,
    name TEXT, -- 如：山姆会员店
    category TEXT, -- Home, Office, Shop, Gym
    lat DOUBLE PRECISION, -- 纬度
    lng DOUBLE PRECISION, -- 经度
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 输入会话 (记录连拍或长语音的上下文)
CREATE TABLE IF NOT EXISTS input_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users,
    source_type TEXT, -- Voice, Image_Batch, Mixed
    raw_content_url TEXT, -- 存储原始语音或图片路径
    processed_summary TEXT, -- AI 总结的一句话
    ai_response JSONB, -- AI 返回的完整结构化数据
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 物资库存 (Inventory)
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users,
    name TEXT NOT NULL,
    category TEXT, -- 食品, 耗材, 药品
    storage_zone TEXT, -- Room, Fridge, Freezer
    quantity DECIMAL DEFAULT 1.0,
    unit TEXT, -- 个, 瓶, kg
    expiry_date DATE, -- 到期日
    predicted_depletion_date DATE, -- AI 预测耗尽日
    requires_thawing BOOLEAN DEFAULT FALSE, -- 是否需要解冻
    last_confirmed_at TIMESTAMP WITH TIME ZONE, -- 最后拍照确认时间
    session_id UUID REFERENCES input_sessions(id), -- 关联输入会话
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 财务记录 (Finance)
CREATE TABLE IF NOT EXISTS finance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users,
    amount DECIMAL(12,2) NOT NULL,
    category TEXT,
    description TEXT, -- 消费描述
    emotion_tag TEXT, -- 消费时的心情
    is_essential BOOLEAN, -- 是否必要
    location_id UUID REFERENCES locations(id),
    session_id UUID REFERENCES input_sessions(id),
    record_date DATE DEFAULT CURRENT_DATE, -- 消费日期
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 价格历史库 (Price Intelligence)
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users,
    item_name_semantic TEXT, -- 语义化名称，便于跨平台匹配
    price_per_unit DECIMAL(12,2), -- 换算后的单价
    channel TEXT, -- 购买渠道
    is_on_sale BOOLEAN,
    location_id UUID REFERENCES locations(id),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 行动流 (Action Flow / Todo)
CREATE TABLE IF NOT EXISTS actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'Todo', -- Todo, Done, Inspiration, Reminder
    priority INT DEFAULT 1, -- 1:Low, 2:Medium, 3:High
    trigger_type TEXT, -- Time, Location, Depletion (物资耗尽)
    trigger_value JSONB, -- 存储时间或位置坐标
    status TEXT DEFAULT 'pending', -- pending, completed, snoozed, cancelled
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    session_id UUID REFERENCES input_sessions(id),
    related_inventory_id UUID REFERENCES inventory_items(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_input_sessions_user_id ON input_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_input_sessions_status ON input_sessions(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id ON inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_records_user_id ON finance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_records_date ON finance_records(record_date);
CREATE INDEX IF NOT EXISTS idx_actions_user_id ON actions(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);

-- 设置 RLS (Row Level Security) 策略
-- 启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE input_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能访问自己的数据
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage own locations" ON locations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own input_sessions" ON input_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own inventory" ON inventory_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own finance" ON finance_records FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own price_history" ON price_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own actions" ON actions FOR ALL USING (auth.uid() = user_id);

-- 为匿名用户（未登录）临时启用插入权限（开发阶段）
-- 注意：生产环境应移除这些策略
CREATE POLICY "Allow anonymous inserts to input_sessions" ON input_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous inserts to inventory_items" ON inventory_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous inserts to finance_records" ON finance_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous inserts to actions" ON actions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous select from input_sessions" ON input_sessions FOR SELECT USING (true);
CREATE POLICY "Allow anonymous select from inventory_items" ON inventory_items FOR SELECT USING (true);
CREATE POLICY "Allow anonymous select from finance_records" ON finance_records FOR SELECT USING (true);
CREATE POLICY "Allow anonymous select from actions" ON actions FOR SELECT USING (true);
