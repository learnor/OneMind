-- Storage Bucket 设置
-- 在 Supabase SQL Editor 中执行，或在 Storage 页面手动创建

-- 创建 captures bucket 用于存储语音和图片
INSERT INTO storage.buckets (id, name, public)
VALUES ('captures', 'captures', true)
ON CONFLICT (id) DO NOTHING;

-- 设置 Storage 策略：允许匿名上传和读取（开发阶段）
-- 注意：生产环境应限制为认证用户

-- 允许所有人上传文件
CREATE POLICY "Allow public uploads" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'captures');

-- 允许所有人读取文件
CREATE POLICY "Allow public reads" ON storage.objects
FOR SELECT USING (bucket_id = 'captures');

-- 允许所有人删除自己上传的文件
CREATE POLICY "Allow public deletes" ON storage.objects
FOR DELETE USING (bucket_id = 'captures');
