# OneMind (万物一心)

AI 个人生活操作系统 - 你的数字管家

## 🌟 核心理念

- **预测为主，确认补位**：AI 学习你的消耗习惯，主动预测剩余量，仅在不确定时请求拍照确认
- **无感捕捉 (Frictionless Capture)**：支持连续拍照、长语音输入，AI 自动完成结构化分流
- **跨维度关联**：将财务支出、物资变动、地点语境与个人情绪深度绑定

## 🛠 技术栈

- **前端**: React Native (Expo) + Expo Router
- **后端**: Supabase (PostgreSQL, Auth, Storage)
- **AI 大脑**: OpenAI GPT-4o (多模态理解) + Whisper (语音转文字)
- **逻辑流**: LangChain (AI 智能体任务编排)

## 🚀 快速开始

### 前置要求

- Node.js 18+
- npm 或 yarn
- iOS 模拟器 (Xcode) 或 Android 模拟器
- [Expo Go](https://expo.dev/client) 应用（可选，用于真机测试）

### 安装依赖

```bash
cd OneMind
npm install
```

### 配置环境变量

复制环境变量模板并填入你的 Supabase 配置：

```bash
cp .env.example .env
```

在 `.env` 文件中填入：

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 启动开发服务器

```bash
# 启动 Expo 开发服务器
npm start

# 或直接启动特定平台
npm run ios      # iOS 模拟器
npm run android  # Android 模拟器
npm run web      # Web 浏览器
```

## 📁 项目结构

```
OneMind/
├── app/                      # Expo Router 页面
│   ├── _layout.tsx          # 根布局
│   ├── (tabs)/              # Tab 导航
│   │   ├── _layout.tsx      # Tab 布局
│   │   ├── index.tsx        # 首页
│   │   └── settings.tsx     # 设置页
│   └── camera.tsx           # 连拍相机页面
├── components/              # 可复用组件
│   ├── OmniInputButton.tsx  # 全能输入按钮
│   └── VoiceRecorder.tsx    # 语音录制 Hook
├── lib/                     # 工具库
│   ├── supabase.ts         # Supabase 客户端
│   └── types.ts            # TypeScript 类型
└── constants/
    └── Colors.ts           # 主题色彩
```

## 🎯 核心功能

### 全能输入按钮 (OmniInputButton)

- **点击**: 开始/停止语音录制
- **长按** (500ms): 触觉反馈 + 进入连拍相机

### 语音录制

- 使用 `expo-av` 实现高质量录音
- 自动请求麦克风权限
- 实时显示录音时长

### 连拍相机

- 手动多拍模式：每点一次拍一张
- 底部预览栏显示已拍照片
- 支持删除单张照片
- 批量上传至 Supabase Storage

## 📅 开发路线图

- [x] **Phase 1 (MVP)**: 全能输入框 + 语音录制 + 连拍相机
- [ ] **Phase 2**: AI 自动分流逻辑 + 基础记账与 Todo
- [ ] **Phase 3**: 消耗预测模型 + 冰箱/冷冻库管理
- [ ] **Phase 4**: 价格历史追踪 + 购物策略推荐
- [ ] **Phase 5**: 多设备联动 + 健康/位置数据集成

## 📄 许可证

MIT License
