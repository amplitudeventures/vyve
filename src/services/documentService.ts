import { supabase } from '@/integrations/supabase/client';

const SUPABASE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface Document {
  id?: string;
  filename: string;
  content_type?: string;
  file_path: string;
  size?: number;
  url?: string;
  is_website?: boolean;
  created_at?: string;
}

export class DocumentService {
  static async uploadDocument(file: File): Promise<Document | null> {
    try {
      console.log('Starting document upload:', file.name);
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${SUPABASE_FUNCTION_URL}/upload-file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload document');
      }

      const uploadResponse = await response.json();
      console.log('Upload response:', uploadResponse);

      // Save document metadata to Supabase
      const { data: savedDoc, error: saveError } = await supabase
        .from('documents')
        .insert({
          filename: file.name,
          content_type: file.type,
          file_path: uploadResponse.path,
          size: file.size,
          url: uploadResponse.url,
          is_website: false
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving document metadata:', saveError);
        return null;
      }

      console.log('Document saved:', savedDoc);
      return savedDoc;
    } catch (error) {
      console.error('Error in uploadDocument:', error);
      throw error;
    }
  }

  static async getDocuments(): Promise<Document[]> {
    try {
      const { data: documents, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
        return [];
      }

      return documents;
    } catch (error) {
      console.error('Error in getDocuments:', error);
      return [];
    }
  }
} 