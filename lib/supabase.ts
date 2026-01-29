import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { Database } from './types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or Anon Key not found. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Helper function to upload file to Supabase Storage
export async function uploadFile(
  bucket: string,
  path: string,
  file: Blob | ArrayBuffer,
  contentType: string
): Promise<{ url: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        contentType,
        upsert: false,
      });

    if (error) {
      return { url: null, error };
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

    return { url: urlData.publicUrl, error: null };
  } catch (err) {
    return { url: null, error: err as Error };
  }
}

// Helper to create an input session
export async function createInputSession(
  userId: string,
  sourceType: 'Voice' | 'Image_Batch' | 'Mixed',
  rawContentUrl: string | null
): Promise<{ id: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('input_sessions')
      .insert({
        user_id: userId,
        source_type: sourceType,
        raw_content_url: rawContentUrl,
      } as any)
      .select('id')
      .single();

    if (error) {
      return { id: null, error };
    }

    return { id: (data as any)?.id ?? null, error: null };
  } catch (err) {
    return { id: null, error: err as Error };
  }
}
