import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

import { supabase } from './supabase';

const BUCKET_NAME = 'captures';

export interface UploadResult {
  success: boolean;
  url: string | null;
  path: string | null;
  error: string | null;
}

/**
 * Generate a unique file path for storage
 */
function generateFilePath(type: 'voice' | 'photo', extension: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${type}/${timestamp}_${random}.${extension}`;
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  localUri: string,
  type: 'voice' | 'photo'
): Promise<UploadResult> {
  try {
    console.log(`Uploading ${type} file:`, localUri);

    // Determine file extension and content type
    const isVoice = type === 'voice';
    const extension = isVoice ? 'm4a' : (localUri.toLowerCase().endsWith('.png') ? 'png' : 'jpg');
    const contentType = isVoice ? 'audio/m4a' : (extension === 'png' ? 'image/png' : 'image/jpeg');

    // Generate unique file path
    const filePath = generateFilePath(type, extension);

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert to ArrayBuffer
    const arrayBuffer = decode(base64);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        url: null,
        path: null,
        error: error.message,
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    console.log('Upload successful:', urlData.publicUrl);

    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path,
      error: null,
    };
  } catch (error) {
    console.error('Upload failed:', error);
    return {
      success: false,
      url: null,
      path: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Upload multiple files to Supabase Storage
 */
export async function uploadFiles(
  localUris: string[],
  type: 'voice' | 'photo'
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  
  for (const uri of localUris) {
    const result = await uploadFile(uri, type);
    results.push(result);
  }
  
  return results;
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(path: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete failed:', error);
    return false;
  }
}
