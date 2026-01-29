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

根据用户输入，识别并提取以下三种类型之一：

1. **消费记录 (finance)** - 任何与花钱、购物、支付相关的内容
   提取：金额(amount)、分类(category)、描述(description)、情绪(emotion_tag)、是否必要(is_essential)

2. **待办事项 (todo)** - 任何需要记住或完成的事情
   提取：标题(title)、描述(description)、类型(type: Todo/Reminder/Inspiration)、优先级(priority: 1低/2中/3高)、截止日期(due_date)

3. **物品库存 (inventory)** - 任何关于物品、食物、日用品的记录
   提取：名称(name)、分类(category)、存储位置(storage_zone)、数量(quantity)、单位(unit)、过期日期(expiry_date)
   
   存储位置(storage_zone)选项：
   - Fridge: 冰箱冷藏（牛奶、蔬菜、水果等需要冷藏的食品）
   - Freezer: 冰箱冷冻（冷冻食品、冰淇淋等）
   - Pantry: 食品柜/储物柜（米面、调料、罐头等常温食品）
   - Bathroom: 浴室/卫生间（牙膏、洗发水、沐浴露、纸巾等）
   - Bedroom: 卧室（个人用品、衣物相关）
   - LivingRoom: 客厅（日用品、装饰品等）
   - Kitchen: 厨房（非食品类，如保鲜膜、垃圾袋、清洁用品等）
   - Storage: 储物间/储藏室（备用品、大件物品）
   - Other: 其他位置
   
   分类(category)建议（AI 自动识别，可选）：
   - 食品、日用品、个护、药品、清洁用品、其他
   
   注意：
   - 位置优先于分类，根据物品通常存放的位置判断
   - 只有食品和药品需要设置过期日期(expiry_date)
   - 如果无法确定位置，使用 "Other"

请以 JSON 格式返回，结构如下：
{
  "route_type": "finance" | "todo" | "inventory" | "unknown",
  "confidence": 0.0-1.0,
  "summary": "一句话总结",
  "data": { ... 对应类型的字段 }
}

注意：
- 金额应为数字，不含货币符号
- 日期格式为 YYYY-MM-DD
- 如果无法确定类别，route_type 设为 "unknown"
- 从图片中提取价格时注意识别小数点
- 只返回 JSON，不要有其他文字`;

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
 * Transcribe audio using Gemini (audio understanding)
 * Note: Gemini 1.5 supports audio files directly
 */
export async function transcribeAudio(audioUri: string): Promise<string> {
  try {
    console.log('Transcribing audio with Gemini:', audioUri);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    // Read audio file
    const audioPart = await fileToGenerativePart(audioUri, 'audio/m4a');

    const result = await model.generateContent([
      '请将这段音频转录为文字。只输出转录的文字内容，不要添加任何解释或格式。如果是中文就输出中文，如果是英文就输出英文。',
      audioPart,
    ]);

    const response = await result.response;
    const text = response.text();
    
    console.log('Transcription result:', text);
    return text;
  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error(`Failed to transcribe audio: ${error}`);
  }
}

/**
 * Analyze image using Gemini Vision
 */
export async function analyzeImage(imageUri: string): Promise<string> {
  try {
    console.log('Analyzing image with Gemini:', imageUri);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    // Determine MIME type
    const mimeType = imageUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    const imagePart = await fileToGenerativePart(imageUri, mimeType);

    const result = await model.generateContent([
      '请分析这张图片，提取其中的关键信息。如果是收据或账单，提取金额和商品信息；如果是物品，描述物品名称和数量；如果是待办事项或便签，提取内容。请详细描述你看到的内容。',
      imagePart,
    ]);

    const response = await result.response;
    const text = response.text();
    
    console.log('Image analysis result:', text);
    return text;
  } catch (error) {
    console.error('Image analysis error:', error);
    throw new Error(`Failed to analyze image: ${error}`);
  }
}

/**
 * Analyze multiple images and combine results
 */
export async function analyzeImages(imageUris: string[]): Promise<string> {
  try {
    console.log('Analyzing multiple images with Gemini:', imageUris.length);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    // Prepare all image parts
    const parts: any[] = [
      `请分析这${imageUris.length}张图片，提取其中的所有关键信息。如果是收据或账单，提取总金额和商品列表；如果是物品，列出所有物品名称和数量；如果是待办事项或便签，提取所有内容。请综合所有图片给出完整的分析。`,
    ];

    for (const uri of imageUris) {
      const mimeType = uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const imagePart = await fileToGenerativePart(uri, mimeType);
      parts.push(imagePart);
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const text = response.text();
    
    console.log('Multi-image analysis result:', text);
    return text;
  } catch (error) {
    console.error('Multi-image analysis error:', error);
    throw new Error(`Failed to analyze images: ${error}`);
  }
}

/**
 * Route content to appropriate category using Gemini
 */
export async function routeContent(content: string): Promise<AIRouteResponse> {
  try {
    console.log('Routing content with Gemini:', content.substring(0, 100) + '...');

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent([
      SYSTEM_PROMPT,
      `用户输入内容：\n${content}`,
    ]);

    const response = await result.response;
    const resultText = response.text();
    
    console.log('Route result:', resultText);

    // Parse JSON response
    const parsed = JSON.parse(resultText) as AIRouteResponse;
    return parsed;
  } catch (error) {
    console.error('Routing error:', error);
    return {
      route_type: 'unknown',
      confidence: 0,
      summary: '分析失败',
      data: null,
    };
  }
}

/**
 * Full processing pipeline for voice input
 */
export async function processVoiceInput(audioUri: string): Promise<AIRouteResponse> {
  // Step 1: Transcribe audio to text
  const transcription = await transcribeAudio(audioUri);
  
  // Step 2: Route the transcribed content
  const result = await routeContent(transcription);
  
  return result;
}

/**
 * Full processing pipeline for image input
 */
export async function processImageInput(imageUris: string[]): Promise<AIRouteResponse> {
  // Step 1: Analyze images
  const analysis = imageUris.length === 1 
    ? await analyzeImage(imageUris[0])
    : await analyzeImages(imageUris);
  
  // Step 2: Route the analyzed content
  const result = await routeContent(analysis);
  
  return result;
}
