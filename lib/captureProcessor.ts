import {
  AIRouteResponse,
  FinanceData,
  InventoryData,
  processImageInput,
  processVoiceInput,
  TodoData,
} from './aiService';
import { supabase } from './supabase';
import { uploadFile, uploadFiles } from './uploadService';

export type ProcessingStatus = 'uploading' | 'analyzing' | 'saving' | 'completed' | 'failed';

export interface ProcessingProgress {
  status: ProcessingStatus;
  message: string;
  progress: number; // 0-100
}

export interface ProcessingResult {
  success: boolean;
  sessionId: string | null;
  aiResponse: AIRouteResponse | null;
  error: string | null;
}

type ProgressCallback = (progress: ProcessingProgress) => void;

/**
 * Create an input session record in the database
 */
async function createInputSession(
  sourceType: 'Voice' | 'Image_Batch',
  rawContentUrl: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('input_sessions')
      .insert({
        source_type: sourceType,
        raw_content_url: rawContentUrl,
        status: 'processing',
      } as any)
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create input session:', error);
      return null;
    }

    return (data as any)?.id || null;
  } catch (error) {
    console.error('Create session error:', error);
    return null;
  }
}

/**
 * Update input session with AI response
 */
async function updateInputSession(
  sessionId: string,
  aiResponse: AIRouteResponse,
  status: 'completed' | 'failed'
): Promise<void> {
  try {
    await (supabase
      .from('input_sessions') as any)
      .update({
        ai_response: aiResponse,
        processed_summary: aiResponse.summary,
        status,
      })
      .eq('id', sessionId);
  } catch (error) {
    console.error('Update session error:', error);
  }
}

/**
 * Save finance record to database
 */
async function saveFinanceRecord(
  data: FinanceData,
  sessionId: string
): Promise<boolean> {
  try {
    const amount = Number.isFinite(data.amount) ? data.amount : 0;
    const { error } = await supabase
      .from('finance_records')
      .insert({
        amount,
        category: data.category,
        description: data.description,
        emotion_tag: data.emotion_tag,
        is_essential: data.is_essential,
        record_date: data.record_date || new Date().toISOString().split('T')[0],
        session_id: sessionId,
      } as any);

    if (error) {
      console.error('Failed to save finance record:', error);
      return false;
    }

    console.log('Finance record saved successfully');
    return true;
  } catch (error) {
    console.error('Save finance error:', error);
    return false;
  }
}

/**
 * Save todo/action to database
 */
async function saveTodoRecord(
  data: TodoData,
  sessionId: string
): Promise<boolean> {
  try {
    const title = data.title?.trim() || '未命名任务';
    const type = data.type || 'Todo';
    const priority = data.priority || 2;
    const description = data.description || null;

    const { error } = await supabase
      .from('actions')
      .insert({
        title,
        description,
        type,
        priority,
        due_date: data.due_date,
        status: 'pending',
        session_id: sessionId,
      } as any);

    if (error) {
      console.error('Failed to save todo:', error);
      return false;
    }

    console.log('Todo saved successfully');
    return true;
  } catch (error) {
    console.error('Save todo error:', error);
    return false;
  }
}

/**
 * Save inventory item to database
 */
async function saveInventoryRecord(
  data: InventoryData,
  sessionId: string
): Promise<boolean> {
  try {
    const name = data.name?.trim() || '未命名物品';
    const category = data.category || '其他';
    const storage_zone = data.storage_zone || 'Other';
    const quantity = Number.isFinite(data.quantity) ? data.quantity : 1;
    const unit = data.unit || '个';

    const { error } = await supabase
      .from('inventory_items')
      .insert({
        name,
        category,
        storage_zone,
        quantity,
        unit,
        expiry_date: data.expiry_date,
        session_id: sessionId,
      } as any);

    if (error) {
      console.error('Failed to save inventory:', error);
      return false;
    }

    console.log('Inventory item saved successfully');
    return true;
  } catch (error) {
    console.error('Save inventory error:', error);
    return false;
  }
}

/**
 * Save AI response to appropriate database table based on route type
 */
async function saveToDatabase(
  aiResponse: AIRouteResponse,
  sessionId: string
): Promise<boolean> {
  if (!aiResponse.data) {
    console.log('No data to save');
    return true;
  }

  switch (aiResponse.route_type) {
    case 'finance':
      return await saveFinanceRecord(aiResponse.data as FinanceData, sessionId);
    case 'todo':
      return await saveTodoRecord(aiResponse.data as TodoData, sessionId);
    case 'inventory':
      return await saveInventoryRecord(aiResponse.data as InventoryData, sessionId);
    default:
      console.log('Unknown route type, skipping database save');
      return true;
  }
}

/**
 * Process voice recording: upload → transcribe → route → save
 */
export async function processVoiceCapture(
  audioUri: string,
  onProgress?: ProgressCallback
): Promise<ProcessingResult> {
  try {
    // Step 1: Upload to Supabase Storage
    onProgress?.({ status: 'uploading', message: '正在上传录音...', progress: 10 });
    
    const uploadResult = await uploadFile(audioUri, 'voice');
    if (!uploadResult.success) {
      return {
        success: false,
        sessionId: null,
        aiResponse: null,
        error: `上传失败: ${uploadResult.error}`,
      };
    }

    // Step 2: Create input session
    onProgress?.({ status: 'uploading', message: '创建会话...', progress: 25 });
    
    const sessionId = await createInputSession('Voice', uploadResult.url!);
    if (!sessionId) {
      return {
        success: false,
        sessionId: null,
        aiResponse: null,
        error: '创建会话失败',
      };
    }

    // Step 3: AI Processing (Whisper + GPT-4o)
    onProgress?.({ status: 'analyzing', message: 'AI 正在分析...', progress: 50 });
    
    const aiResponse = await processVoiceInput(audioUri);

    // Step 4: Save to database
    onProgress?.({ status: 'saving', message: '正在保存结果...', progress: 80 });
    
    const saveSuccess = await saveToDatabase(aiResponse, sessionId);
    
    // Step 5: Update session status
    await updateInputSession(sessionId, aiResponse, saveSuccess ? 'completed' : 'failed');

    onProgress?.({ status: 'completed', message: '处理完成！', progress: 100 });

    return {
      success: true,
      sessionId,
      aiResponse,
      error: null,
    };
  } catch (error) {
    console.error('Voice processing error:', error);
    return {
      success: false,
      sessionId: null,
      aiResponse: null,
      error: error instanceof Error ? error.message : '处理失败',
    };
  }
}

/**
 * Process photo capture: upload → analyze → route → save
 */
export async function processPhotoCapture(
  photoUris: string[],
  onProgress?: ProgressCallback
): Promise<ProcessingResult> {
  try {
    // Step 1: Upload all photos to Supabase Storage
    onProgress?.({ status: 'uploading', message: `正在上传 ${photoUris.length} 张照片...`, progress: 10 });
    
    const uploadResults = await uploadFiles(photoUris, 'photo');
    const successfulUploads = uploadResults.filter(r => r.success);
    
    if (successfulUploads.length === 0) {
      return {
        success: false,
        sessionId: null,
        aiResponse: null,
        error: '所有照片上传失败',
      };
    }

    // Combine URLs for session record
    const combinedUrls = successfulUploads.map(r => r.url).join(',');

    // Step 2: Create input session
    onProgress?.({ status: 'uploading', message: '创建会话...', progress: 25 });
    
    const sessionId = await createInputSession('Image_Batch', combinedUrls);
    if (!sessionId) {
      return {
        success: false,
        sessionId: null,
        aiResponse: null,
        error: '创建会话失败',
      };
    }

    // Step 3: AI Processing (GPT-4o Vision)
    onProgress?.({ status: 'analyzing', message: 'AI 正在分析图片...', progress: 50 });
    
    const aiResponse = await processImageInput(photoUris);

    // Step 4: Save to database
    onProgress?.({ status: 'saving', message: '正在保存结果...', progress: 80 });
    
    const saveSuccess = await saveToDatabase(aiResponse, sessionId);
    
    // Step 5: Update session status
    await updateInputSession(sessionId, aiResponse, saveSuccess ? 'completed' : 'failed');

    onProgress?.({ status: 'completed', message: '处理完成！', progress: 100 });

    return {
      success: true,
      sessionId,
      aiResponse,
      error: null,
    };
  } catch (error) {
    console.error('Photo processing error:', error);
    return {
      success: false,
      sessionId: null,
      aiResponse: null,
      error: error instanceof Error ? error.message : '处理失败',
    };
  }
}

/**
 * Get route type display name in Chinese
 */
export function getRouteTypeDisplayName(routeType: string): string {
  switch (routeType) {
    case 'finance':
      return '消费记录';
    case 'todo':
      return '待办事项';
    case 'inventory':
      return '物品库存';
    default:
      return '未知类型';
  }
}

/**
 * Get route type icon name
 */
export function getRouteTypeIcon(routeType: string): string {
  switch (routeType) {
    case 'finance':
      return 'card-outline';
    case 'todo':
      return 'checkbox-outline';
    case 'inventory':
      return 'cube-outline';
    default:
      return 'help-circle-outline';
  }
}
