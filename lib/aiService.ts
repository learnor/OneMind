import { GoogleGenerativeAI } from '@google/generative-ai';
import * as FileSystem from 'expo-file-system/legacy';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(
  process.env.EXPO_PUBLIC_GEMINI_API_KEY || ''
);

// Route types for AI classification
export type RouteType = 'finance' | 'todo' | 'inventory' | 'unknown';

// Structured response from AI
export interface AIRouteResponse {
  route_type: RouteType;
  confidence: number;
  summary: string;
  data: FinanceData | TodoData | InventoryData | null;
}

export interface AIRouteBatchResponse {
  items: AIRouteResponse[];
}

export interface FinanceData {
  amount: number;
  category: string;
  description: string;
  emotion_tag?: string;
  is_essential?: boolean;
  record_date?: string;
}

export interface TodoData {
  title: string;
  description?: string;
  type: 'Todo' | 'Reminder' | 'Inspiration';
  priority: 1 | 2 | 3;
  due_date?: string;
  remind_at?: string;
  repeat_rule?: string;
  repeat_interval?: number;
  category?: string;
}

import type { StorageZone } from './types';

export interface InventoryData {
  name: string;
  category: string; // 分类（可选，AI 自动识别，如：食品、日用品、个护、药品等）
  storage_zone: StorageZone; // 存储位置（必选，AI 自动识别）
  quantity: number;
  unit: string;
  expiry_date?: string; // 仅食品和药品需要
}

// System prompt for content routing
const SYSTEM_PROMPT = `你是 OneMind 的智能助手，负责分析用户的语音或图片输入，并将其分类到正确的类别。

**分析原则**：
1. 优先理解用户的意图和上下文
2. 提取关键信息时要准确和完整
3. 对于模糊的内容，选择最可能的分类
4. 置信度要真实反映判断的确定性

**分类详细说明**：

1. **消费记录 (finance)** - 任何与花钱、购物、支付相关的内容
   - 关键词：买、购买、花费、付款、价格、费用、账单、收据等
   - 提取字段：
     * amount: 金额（数字，不含货币符号）
     * category: 消费分类（餐饮、交通、购物、娱乐、生活缴费等）
     * description: 具体描述（商品名称、消费事由等）
     * emotion_tag: 情绪标签（开心、后悔、无奈、必要等，可选）
     * is_essential: 是否必要消费（true/false，可选）
     * record_date: 消费日期（YYYY-MM-DD，可选，默认今天）

2. **待办事项 (todo)** - 任何需要记住或完成的事情
   - 关键词：要做、需要、记得、提醒、任务、计划、安排等
   - 提取字段：
     * title: 任务标题（简洁明确）
     * description: 详细描述（可选）
     * type: 类型（Todo/Reminder/Inspiration）
       * Todo: 具体需要完成的任务
       * Reminder: 提醒事项（如记得吃药）
       * Inspiration: 灵感想法（如想学新技能）
     * priority: 优先级（1低/2中/3高）
       * 3: 紧急且重要
       * 2: 重要但不紧急或紧急但不重要
       * 1: 一般任务
     * due_date: 截止日期（YYYY-MM-DD，可选）
     * remind_at: 提醒时间（YYYY-MM-DD HH:mm，可选）
     * repeat_rule: 重复规则（none/daily/weekly/monthly/custom，可选）
     * repeat_interval: 自定义重复间隔（数字，配合 repeat_rule=custom，可选）
     * category: 分类（自由文本，如 工作/生活/学习/健康/购物/出行/灵感）

3. **物品库存 (inventory)** - 任何关于物品、食物、日用品的记录
   - 关键词：买了、存入、剩余、还有、补充、库存等
   - 提取字段：
     * name: 物品名称（具体品牌+规格）
     * category: 物品分类（食品、日用品、个护、药品、清洁用品等）
     * storage_zone: 存储位置（重要，根据物品特性判断）
       * Fridge: 冰箱冷藏（牛奶、蔬菜、水果、剩菜等）
       * Freezer: 冰箱冷冻（冷冻食品、冰淇淋、肉类等）
       * Pantry: 食品柜（米面、调料、罐头、零食等常温食品）
       * Bathroom: 浴室（牙膏、洗发水、沐浴露、化妆品等）
       * Kitchen: 厨房（锅具、餐具、清洁用品等非食品）
       * LivingRoom: 客厅（装饰品、纸巾、小家电等）
       * Bedroom: 卧室（衣物、个人用品等）
       * Storage: 储物间（备用品、季节性物品）
       * Other: 其他位置
     * quantity: 数量（数字）
     * unit: 单位（个、瓶、袋、盒、斤、克等）
     * expiry_date: 过期日期（YYYY-MM-DD，仅食品和药品需要）

**存储位置判断优先级**：
- 食品：首先判断是否需要冷藏 → Fridge/Freezer → 其次看是否常温食品 → Pantry
- 日用品：按使用场景 → Bathroom(洗护)/Kitchen(厨具)/LivingRoom(客厅用品)
- 药品：通常有特殊存储要求 → 遵循说明或放在干燥处 → Bedroom/Storage

**置信度评估**：
- 0.9-1.0: 关键词明确，上下文清晰
- 0.7-0.9: 有明显倾向，但可能存在歧义
- 0.5-0.7: 内容模糊，需要基于常识判断
- 0.5以下: 非常模糊或无法分类

**JSON 返回格式**：
{
  "route_type": "finance" | "todo" | "inventory" | "unknown",
  "confidence": 0.0-1.0,
  "summary": "一句话总结用户输入的核心内容",
  "data": { ... 对应类型的字段，字段不存在时用 null 或忽略 }
}

**特别注意事项**：
- 金额提取要准确，注意小数点和大写数字
- 日期要转换为标准格式 YYYY-MM-DD
- 对于库存物品，要区分购买记录和库存盘点
- 如果用户同时提到多种类型的内容，选择最主要的一个
- 无法确定时 route_type 设为 "unknown"，但尽量提供有用的 summary
- 只返回 JSON 格式，不要包含任何其他文字或解释`;

/**
 * Convert file to base64 and get MIME type
 */
async function fileToGenerativePart(uri: string, mimeType: string) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
}

/**
 * Transcribe audio using Gemini (audio understanding) with retry
 */
export async function transcribeAudio(audioUri: string, maxRetries = 2): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`Transcribing audio with Gemini (attempt ${attempt}):`, audioUri);

      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.1, // Low temperature for transcription
          maxOutputTokens: 500,
        },
      });
      
      // Read audio file
      const audioPart = await fileToGenerativePart(audioUri, 'audio/m4a');

      const prompt = attempt === 1
        ? '请将这段音频转录为文字。只输出转录的文字内容，不要添加任何解释或格式。如果是中文就输出中文，如果是英文就输出英文。'
        : '请重新转录这段音频，确保只输出纯文字内容，不要包含任何解释或格式。';

      const result = await model.generateContent([prompt, audioPart]);
      const response = await result.response;
      const text = response.text().trim();
      
      console.log('Transcription result:', text);

      // Validate transcription result
      if (!text || text.length < 1) {
        throw new Error('Empty transcription result');
      }

      // Filter out common explanations AI might add
      const cleanText = text
        .replace(/^(转录结果|Transcription|文字内容|Text)[:：]\s*/i, '')
        .replace(/[\u4e00-\u9fff]*(transcription|转录)[\u4e00-\u9fff]*/gi, '')
        .trim();

      return cleanText || text;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Transcription error (attempt ${attempt}):`, lastError);
      
      if (attempt <= maxRetries) {
        console.log(`Retrying transcription in ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  console.error('All transcription attempts failed:', lastError);
  throw new Error(`转录失败: ${lastError?.message || '未知错误'}`);
}

/**
 * Analyze image using Gemini Vision with retry
 */
export async function analyzeImage(imageUri: string, maxRetries = 2): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`Analyzing image with Gemini (attempt ${attempt}):`, imageUri);

      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.2, // Low temperature for analysis
          maxOutputTokens: 1000,
        },
      });
      
      // Determine MIME type
      const mimeType = imageUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const imagePart = await fileToGenerativePart(imageUri, mimeType);

      const prompt = attempt === 1
        ? '请分析这张图片，提取其中的关键信息。如果是收据或账单，提取金额和商品信息；如果是物品，描述物品名称和数量；如果是待办事项或便签，提取内容。请详细描述你看到的内容。'
        : '请重新分析这张图片，重点提取：1) 如果是收据，请准确提取总金额和主要商品 2) 如果是物品，请说明物品名称、数量和可能的存储位置 3) 如果是文字内容，请完整提取文字信息。请提供详细准确的分析。';

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text().trim();
      
      console.log('Image analysis result:', text);

      // Validate analysis result
      if (!text || text.length < 10) {
        throw new Error('Image analysis result too short or empty');
      }

      return text;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Image analysis error (attempt ${attempt}):`, lastError);
      
      if (attempt <= maxRetries) {
        console.log(`Retrying image analysis in ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  console.error('All image analysis attempts failed:', lastError);
  throw new Error(`图片分析失败: ${lastError?.message || '未知错误'}`);
}

/**
 * Analyze multiple images and combine results with retry
 */
export async function analyzeImages(imageUris: string[], maxRetries = 2): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`Analyzing multiple images with Gemini (attempt ${attempt}):`, imageUris.length);

      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1500,
        },
      });
      
      // Prepare all image parts
      const parts: any[] = [
        attempt === 1
          ? `请分析这${imageUris.length}张图片，提取其中的所有关键信息。如果是收据或账单，提取总金额和商品列表；如果是物品，列出所有物品名称和数量；如果是待办事项或便签，提取所有内容。请综合所有图片给出完整的分析。`
          : `请重新分析这${imageUris.length}张图片，重点提取：1) 收据总金额和商品明细 2) 物品名称、数量、可能存储位置 3) 文字内容完整转录。请综合输出准确完整的分析。`,
      ];

      for (const uri of imageUris) {
        const mimeType = uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        const imagePart = await fileToGenerativePart(uri, mimeType);
        parts.push(imagePart);
      }

      const result = await model.generateContent(parts);
      const response = await result.response;
      const text = response.text().trim();
      
      console.log('Multi-image analysis result:', text);

      if (!text || text.length < 10) {
        throw new Error('Multi-image analysis result too short or empty');
      }

      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Multi-image analysis error (attempt ${attempt}):`, lastError);
      
      if (attempt <= maxRetries) {
        console.log(`Retrying multi-image analysis in ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  console.error('All multi-image analysis attempts failed:', lastError);
  throw new Error(`多图分析失败: ${lastError?.message || '未知错误'}`);
}

/**
 * Extract partial JSON fields from model output
 */
function extractRouteFromText(text: string): AIRouteResponse | null {
  const routeTypeMatch = text.match(/"route_type"\s*:\s*"(finance|todo|inventory|unknown)"/i);
  const confidenceMatch = text.match(/"confidence"\s*:\s*([0-9.]+)/i);
  const summaryMatch = text.match(/"summary"\s*:\s*"([^"\n\r]*)/i);

  if (!routeTypeMatch) {
    return null;
  }

  const route_type = routeTypeMatch[1] as AIRouteResponse['route_type'];
  const confidence = confidenceMatch ? Number(confidenceMatch[1]) : 0.5;
  const summary = summaryMatch ? summaryMatch[1] : '解析不完整，已自动修复';

  let data: AIRouteResponse['data'] = null;
  if (route_type === 'finance') {
    const amountMatch = text.match(/"amount"\s*:\s*([0-9.]+)/i);
    const categoryMatch = text.match(/"category"\s*:\s*"([^"\n\r]*)/i);
    const descriptionMatch = text.match(/"description"\s*:\s*"([^"\n\r]*)/i);
    data = {
      amount: amountMatch ? Number(amountMatch[1]) : 0,
      category: categoryMatch ? categoryMatch[1] : '其他',
      description: descriptionMatch ? descriptionMatch[1] : summary,
    };
  }

  return {
    route_type,
    confidence: Number.isFinite(confidence) ? confidence : 0.5,
    summary,
    data,
  };
}

function normalizeRouteResponse(response: AIRouteResponse): AIRouteResponse {
  if (response.route_type === 'finance') {
    const data = response.data as FinanceData | null;
    return {
      ...response,
      data: {
        amount: data?.amount ?? 0,
        category: data?.category || '其他',
        description: data?.description || response.summary,
        emotion_tag: data?.emotion_tag,
        is_essential: data?.is_essential,
        record_date: data?.record_date,
      },
    };
  }

  if (response.route_type === 'todo') {
    const data = response.data as TodoData | null;
    const priorityValue = Number(data?.priority);
    const ruleCategory = inferTodoCategoryFromText(`${data?.title || ''} ${data?.description || ''}`.trim());
    const category = ruleCategory !== '未分类' ? ruleCategory : (data?.category || ruleCategory);
    return {
      ...response,
      data: {
        title: data?.title || response.summary || '未命名任务',
        description: data?.description,
        type: data?.type || 'Todo',
        priority: Number.isFinite(priorityValue) && priorityValue >= 1 && priorityValue <= 3 ? (priorityValue as 1 | 2 | 3) : 2,
        due_date: data?.due_date,
        remind_at: data?.remind_at,
        repeat_rule: data?.repeat_rule,
        repeat_interval: data?.repeat_interval,
        category,
      },
    };
  }

  if (response.route_type === 'inventory') {
    const data = response.data as InventoryData | null;
    return {
      ...response,
      data: {
        name: data?.name || response.summary || '未命名物品',
        category: data?.category || '其他',
        storage_zone: data?.storage_zone || 'Other',
        quantity: Number.isFinite(data?.quantity) ? (data?.quantity as number) : 1,
        unit: data?.unit || '个',
        expiry_date: data?.expiry_date,
      },
    };
  }

  return response;
}

function buildSummaryFromText(content: string) {
  const cleaned = content.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '内容为空';
  return cleaned.length > 40 ? `${cleaned.slice(0, 40)}...` : cleaned;
}

export function inferTodoCategoryFromText(content: string): string {
  const cleaned = content.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '未分类';

  const categories: Array<{ label: string; keywords: string[] }> = [
    { label: '工作', keywords: ['会议', '客户', '方案', '汇报', '项目', '同事', '周报', '对接'] },
    { label: '学习', keywords: ['学习', '课程', '复习', '作业', '考试', '阅读', '笔记'] },
    { label: '健康', keywords: ['健身', '跑步', '体检', '吃药', '看医生', '锻炼'] },
    { label: '购物', keywords: ['买', '采购', '下单', '超市', '购物', '快递'] },
    { label: '出行', keywords: ['出差', '旅行', '机票', '高铁', '航班', '酒店'] },
    { label: '生活', keywords: ['家务', '缴费', '水电', '收拾', '做饭', '打扫'] },
    { label: '灵感', keywords: ['灵感', '想法', '点子', 'idea', '主意'] },
  ];

  for (const category of categories) {
    if (category.keywords.some((keyword) => cleaned.includes(keyword))) {
      return category.label;
    }
  }

  return '未分类';
}

function inferRouteFromText(content: string): AIRouteResponse | null {
  const cleaned = content.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;

  const financeKeywords = ['花', '花费', '付款', '支付', '消费', '买', '购买', '账单', '收据', '费用', '¥', '元'];
  const todoKeywords = ['要做', '需要', '记得', '提醒', '任务', '计划', '安排', '待办'];
  const inventoryKeywords = ['库存', '剩余', '还有', '补充', '用完', '存入', '放入', '放在', '冰箱', '冷冻', '冷藏'];

  const hasFinance = financeKeywords.some((keyword) => cleaned.includes(keyword));
  const hasTodo = todoKeywords.some((keyword) => cleaned.includes(keyword));
  const hasInventory = inventoryKeywords.some((keyword) => cleaned.includes(keyword));

  const amountMatch = cleaned.match(/(\d+(?:\.\d+)?)(?:\s*(元|块|¥))?/);
  const quantityMatch = cleaned.match(/(\d+(?:\.\d+)?)(?:\s*(个|瓶|袋|盒|斤|克|包|箱|件|支|片))?/);

  if (hasInventory && !hasFinance) {
    const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
    const unit = quantityMatch?.[2] || '个';
    return {
      route_type: 'inventory',
      confidence: 0.4,
      summary: buildSummaryFromText(cleaned),
      data: {
        name: buildSummaryFromText(cleaned),
        category: '其他',
        storage_zone: cleaned.includes('冷冻') ? 'Freezer' : cleaned.includes('冰箱') || cleaned.includes('冷藏') ? 'Fridge' : 'Other',
        quantity: Number.isFinite(quantity) ? quantity : 1,
        unit,
      },
    };
  }

  if (hasFinance && amountMatch) {
    const amount = Number(amountMatch[1]);
    return {
      route_type: 'finance',
      confidence: 0.4,
      summary: buildSummaryFromText(cleaned),
      data: {
        amount: Number.isFinite(amount) ? amount : 0,
        category: '其他',
        description: buildSummaryFromText(cleaned),
      },
    };
  }

  if (hasTodo) {
    return {
      route_type: 'todo',
      confidence: 0.4,
      summary: buildSummaryFromText(cleaned),
      data: {
        title: buildSummaryFromText(cleaned),
        description: undefined,
        type: 'Todo',
        priority: 2,
        category: inferTodoCategoryFromText(cleaned),
      },
    };
  }

  return null;
}

function formatRouteLogPrefix(requestId: string, attempt: number) {
  return `[route:${requestId}#${attempt}]`;
}

/**
 * Route content to appropriate category using Gemini with retry mechanism
 */
export async function routeContent(content: string, maxRetries = 2): Promise<AIRouteResponse> {
  let lastError: Error | null = null;
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const contentPreview = content.replace(/\s+/g, ' ').trim().slice(0, 100);

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const logPrefix = formatRouteLogPrefix(requestId, attempt);
      console.log(`${logPrefix} Routing content:`, contentPreview);

      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: attempt > 1 ? 0.1 : 0.3, // Lower temperature for retries
          maxOutputTokens: 1000,
        },
      });

      const prompt = attempt === 1 
        ? `用户输入内容：\n${content}`
        : `请重新分析以下内容，确保返回有效的 JSON 格式。如果不确定分类，请选择 "unknown" 并提供合理的 summary。\n\n用户输入内容：\n${content}`;

      const result = await model.generateContent([
        SYSTEM_PROMPT,
        prompt,
      ]);

      const response = await result.response;
      const resultText = response.text().trim();
      
      console.log(`${logPrefix} Route result (${resultText.length} chars):`, resultText);

      const cleanedText = resultText
        .replace(/```json\s*/i, '')
        .replace(/```/g, '')
        .trim();

      if (!cleanedText.endsWith('}')) {
        console.warn(`${logPrefix} Response may be truncated`);
      }

      // Better JSON parsing with fallback
      let parsed: AIRouteResponse;
      try {
        if (!cleanedText.startsWith('{') || !cleanedText.includes('}')) {
          throw new Error('Incomplete JSON response');
        }
        parsed = JSON.parse(cleanedText) as AIRouteResponse;
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        
        // Try to extract JSON from response if it contains other text
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]) as AIRouteResponse;
          } catch {
            const fallback = extractRouteFromText(cleanedText);
            if (fallback) {
              parsed = fallback;
            } else {
              throw new Error(`Invalid JSON response: ${resultText}`);
            }
          }
        } else {
          const fallback = extractRouteFromText(cleanedText);
          if (fallback) {
            parsed = fallback;
          } else {
            throw new Error(`Invalid JSON response: ${resultText}`);
          }
        }
      }

      // Validate response structure
      if (!parsed.route_type || !parsed.summary) {
        throw new Error('Invalid response structure: missing required fields');
      }

      // Ensure valid route_type
      if (!['finance', 'todo', 'inventory', 'unknown'].includes(parsed.route_type)) {
        parsed.route_type = 'unknown';
      }

      // Ensure confidence is valid
      if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
        parsed.confidence = 0.5; // Default confidence
      }

      const normalized = normalizeRouteResponse(parsed);
      if (normalized !== parsed) {
        console.warn(`${logPrefix} Normalized AI response fields`);
      }

      if (normalized.route_type === 'unknown' || normalized.confidence < 0.4) {
        const heuristic = inferRouteFromText(content);
        if (heuristic) {
          console.warn(`${logPrefix} Heuristic routing applied`);
          return normalizeRouteResponse(heuristic);
        }
      }

      return normalized;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`${formatRouteLogPrefix(requestId, attempt)} Routing error:`, lastError);
      
      // If this is not the last attempt, wait a bit before retrying
      if (attempt <= maxRetries) {
        console.log(`${formatRouteLogPrefix(requestId, attempt)} Retrying in ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  // All attempts failed
  console.error(`${formatRouteLogPrefix(requestId, maxRetries + 1)} All routing attempts failed:`, lastError);
  return {
    route_type: 'unknown',
    confidence: 0,
    summary: lastError?.message.includes('JSON') 
      ? 'AI 响应格式错误，请重试' 
      : '分析失败，请检查网络连接',
    data: null,
  };
}

export async function routeContentBatch(content: string, maxRetries = 1): Promise<AIRouteResponse[]> {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const contentPreview = content.replace(/\s+/g, ' ').trim().slice(0, 120);

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const logPrefix = formatRouteLogPrefix(requestId, attempt);
      console.log(`${logPrefix} Routing content batch:`, contentPreview);

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: attempt > 1 ? 0.1 : 0.2,
          maxOutputTokens: 1600,
        },
      });

      const prompt = attempt === 1
        ? `用户输入内容：\n${content}\n\n如果包含多条独立记录，请拆分为多个对象并返回 JSON: { "items": [ ... ] }。如果只有一条，items 只包含一条。`
        : `请重新分析以下内容，输出 JSON: { "items": [ ... ] }，每个 item 必须符合 route_type/summary/data 结构。\n\n用户输入内容：\n${content}`;

      const result = await model.generateContent([
        SYSTEM_PROMPT,
        prompt,
      ]);

      const response = await result.response;
      const resultText = response.text().trim();
      console.log(`${logPrefix} Batch route result (${resultText.length} chars):`, resultText);

      const cleanedText = resultText
        .replace(/```json\s*/i, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(cleanedText) as AIRouteBatchResponse | AIRouteResponse;
      const items = Array.isArray((parsed as AIRouteBatchResponse).items)
        ? (parsed as AIRouteBatchResponse).items
        : [parsed as AIRouteResponse];

      const normalizedItems = items
        .filter((item) => item && item.route_type)
        .map((item) => normalizeRouteResponse(item));

      if (normalizedItems.length > 0) {
        return normalizedItems;
      }
    } catch (error) {
      console.error(`${formatRouteLogPrefix(requestId, attempt)} Batch routing error:`, error);
      if (attempt <= maxRetries) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  const fallback = await routeContent(content);
  return [fallback];
}

/**
 * Full processing pipeline for voice input with error handling
 */
export async function processVoiceInput(audioUri: string): Promise<AIRouteResponse> {
  try {
    // Step 1: Transcribe audio to text
    console.log('Step 1: Transcribing audio...');
    const transcription = await transcribeAudio(audioUri);
    
    if (!transcription || transcription.trim().length === 0) {
      return {
        route_type: 'unknown',
        confidence: 0,
        summary: '语音转录为空，请检查录音质量',
        data: null,
      };
    }

    console.log('Transcription successful:', transcription.substring(0, 50) + '...');
    
    // Step 2: Route the transcribed content
    console.log('Step 2: Routing content...');
    const result = await routeContent(transcription);
    
    // Add transcription to summary for debugging if confidence is low
    if (result.confidence < 0.7) {
      result.summary += ` (原文: ${transcription.substring(0, 30)}${transcription.length > 30 ? '...' : ''})`;
    }
    
    return result;
  } catch (error) {
    console.error('Voice processing pipeline error:', error);
    return {
      route_type: 'unknown',
      confidence: 0,
      summary: error instanceof Error && error.message.includes('转录失败')
        ? '语音转录失败，请重新录音'
        : '语音处理失败，请重试',
      data: null,
    };
  }
}

export async function processVoiceInputBatch(audioUri: string): Promise<AIRouteResponse[]> {
  try {
    console.log('Step 1: Transcribing audio...');
    const transcription = await transcribeAudio(audioUri);

    if (!transcription || transcription.trim().length === 0) {
      return [{
        route_type: 'unknown',
        confidence: 0,
        summary: '语音转录为空，请检查录音质量',
        data: null,
      }];
    }

    console.log('Transcription successful:', transcription.substring(0, 50) + '...');
    console.log('Step 2: Routing content batch...');
    const results = await routeContentBatch(transcription);

    if (results.length === 1 && results[0].confidence < 0.7) {
      results[0].summary += ` (原文: ${transcription.substring(0, 30)}${transcription.length > 30 ? '...' : ''})`;
    }

    return results;
  } catch (error) {
    console.error('Voice batch processing error:', error);
    return [{
      route_type: 'unknown',
      confidence: 0,
      summary: error instanceof Error && error.message.includes('转录失败')
        ? '语音转录失败，请重新录音'
        : '语音处理失败，请重试',
      data: null,
    }];
  }
}

/**
 * Full processing pipeline for image input with error handling
 */
export async function processImageInput(imageUris: string[]): Promise<AIRouteResponse> {
  try {
    // Step 1: Analyze images
    console.log('Step 1: Analyzing images...');
    const analysis = imageUris.length === 1 
      ? await analyzeImage(imageUris[0])
      : await analyzeImages(imageUris);
    
    if (!analysis || analysis.trim().length === 0) {
      return {
        route_type: 'unknown',
        confidence: 0,
        summary: '图片分析结果为空，请重新拍照',
        data: null,
      };
    }

    console.log('Image analysis successful:', analysis.substring(0, 50) + '...');
    
    // Step 2: Route the analyzed content
    console.log('Step 2: Routing content...');
    const result = await routeContent(analysis);
    
    // Add analysis hint for low confidence
    if (result.confidence < 0.7) {
      result.summary += ` (图片内容: ${analysis.substring(0, 30)}${analysis.length > 30 ? '...' : ''})`;
    }
    
    return result;
  } catch (error) {
    console.error('Image processing pipeline error:', error);
    return {
      route_type: 'unknown',
      confidence: 0,
      summary: error instanceof Error && error.message.includes('图片分析失败')
        ? '图片分析失败，请重新拍照'
        : '图片处理失败，请重试',
      data: null,
    };
  }
}
