import { supabase } from '@/integrations/supabase/client';
import { ProcessingMethod } from '@/components/DocumentUpload';

const API_BASE_URL = 'http://localhost:8000';

interface ProgressUpdate {
  type: 'progress';
  currentPage: number;
  totalPages: number;
  pageText: number;
  totalText: number;
}

export async function uploadFile(
  formData: FormData, 
  companyName: string,
  companyNames: string[],
  setTrigRefetch: React.Dispatch<React.SetStateAction<string>>,
    signal?: AbortSignal,
  onProgress?: (update: ProgressUpdate) => void,
): Promise<any> {
  try {
    const file = formData.get('file') as File;
    const processingMethod = formData.get('processingMethod') as ProcessingMethod || 'standard';
    
    console.log('Sending file to server for processing...');
    console.log('File type:', file.type);
    console.log('Processing method:', processingMethod);
    if (!companyNames.includes(companyName)) {
      try {
        const create = await fetch(`${API_BASE_URL}/create_company`, {
          method: 'POST',
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ company_name: companyName })
        });

        if (!create.ok) {
          throw new Error(`HTTP error! Status: ${create.status}`);
        }

        const created = await create.json();
        setTrigRefetch(prev => prev == '' ? 'ref' : '');
        console.log("company created succefully", created);
      } catch (error) {
        console.error("Error creating: ", error);
      }
    }
    formData.append("company_name", companyName);
    const response = await fetch(`${API_BASE_URL}/upload?processingMethod=${processingMethod}&company_name=${companyName}`, {
      method: 'POST',
      body: formData,
      signal,
      headers: {
        'Accept': 'application/x-ndjson'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to process file');
    }

    if (!response.body) {
      throw new Error('No response body received');
    }

    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult;

    try {
      // If value value here is null, retry the request
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Process any remaining data in buffer
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer.trim());
              if (parsed.type === 'complete') {
                finalResult = parsed;
              }
            } catch (e) {
              console.error('Failed to parse final buffer:', e);
              console.error('Raw buffer:', buffer);
            }
          }
          break;
        }

        // Add new chunk to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines in buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line.trim());
              console.log('Received update:', parsed);
              
              if (parsed.type === 'error') {
                throw new Error(parsed.error);
              }
              
              if (parsed.type === 'progress' && onProgress) {
                onProgress(parsed);
              } else if (parsed.type === 'complete') {
                finalResult = parsed;
              }
            } catch (e) {
              console.error('Failed to parse line:', e);
              console.error('Raw line:', line);
              throw e;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!finalResult) {
      throw new Error('No final result received from server');
    }

    return finalResult;
  } catch (error) {
    console.error('Upload error:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
} 
