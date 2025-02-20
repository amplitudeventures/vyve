//import { Document, ProcessingProgress } from "@/types/documents";
//import { errorLogger } from "@/utils/errorLogger";
//import { TextProcessing } from "@/utils/textProcessing";
//import * as pdfjsLib from 'pdfjs-dist';
//
//// Initialize PDF.js
//if (typeof window !== 'undefined') {
//  // Using the ES module build of PDF.js
//  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
//    'pdfjs-dist/build/pdf.worker.mjs',
//    import.meta.url
//  ).toString();
//}
//
//export class EmbeddingService {
//  private static readonly MAX_RETRIES = 3;
//  private static readonly RETRY_DELAY = 1000;
//  private static readonly MAX_BATCH_SIZE = 96; // Maximum batch size for multilingual-e5-large model
//  private processingDocuments: Set<string> = new Set();
//  private processingTimeout: number = 5000; // 5 seconds
//
//  private static batchArray<T>(array: T[], size: number): T[][] {
//    const batches: T[][] = [];
//    for (let i = 0; i < array.length; i += size) {
//      batches.push(array.slice(i, i + size));
//    }
//    return batches;
//  }
//
//  private static async downloadContent(document: Document): Promise<string> {
//    try {
//      if (document.is_website) {
//        const { data: websiteContent, error: websiteError } = await supabase
//          .from('website_content')
//          .select('main_content')
//          .eq('url', document.url)
//          .order('created_at', { ascending: false })
//          .limit(1)
//          .single();
//
//        if (websiteError) throw websiteError;
//        if (!websiteContent?.main_content) throw new Error('No content available');
//
//        return typeof websiteContent.main_content === 'string' 
//          ? websiteContent.main_content 
//          : JSON.stringify(websiteContent.main_content);
//      } else {
//        // Get the extracted text from Supabase
//        const { data: documentContent, error: contentError } = await supabase
//          .from('documents')
//          .select('content')
//          .eq('id', document.id)
//          .maybeSingle();
//
//        if (contentError) throw contentError;
//
//        console.log('Document content structure:', {
//          hasContent: !!documentContent?.content,
//          contentType: typeof documentContent?.content,
//          isObject: documentContent?.content && typeof documentContent.content === 'object',
//          keys: documentContent?.content ? Object.keys(documentContent.content) : [],
//          rawContent: documentContent?.content
//        });
//
//        if (!documentContent?.content) {
//          throw new Error('No content available for document');
//        }
//
//        // Handle different content formats
//        if (typeof documentContent.content === 'string') {
//          return documentContent.content;
//        }
//
//        if (typeof documentContent.content === 'object') {
//          // First try text field
//          if (documentContent.content.text) {
//            return documentContent.content.text;
//          }
//          // Then try content field
//          if (documentContent.content.content) {
//            return documentContent.content.content;
//          }
//          // Then try raw_text field
//          if (documentContent.content.raw_text) {
//            return documentContent.content.raw_text;
//          }
//          // Then try extractedText field
//          if (documentContent.content.extractedText) {
//            return documentContent.content.extractedText;
//          }
//          // Try to get any string value
//          const stringValue = Object.values(documentContent.content)
//            .find(value => typeof value === 'string');
//          if (stringValue) {
//            return stringValue;
//          }
//          // If we have an array of strings, join them
//          const textArray = Object.values(documentContent.content)
//            .filter(value => typeof value === 'string');
//          if (textArray.length > 0) {
//            return textArray.join('\n\n');
//          }
//        }
//
//        // If all else fails, try to stringify the content
//        const contentStr = JSON.stringify(documentContent.content);
//        if (contentStr && contentStr !== '{}' && contentStr !== '[]') {
//          return contentStr;
//        }
//
//        throw new Error(`No valid text content found in document: ${JSON.stringify(documentContent.content)}`);
//      }
//    } catch (error) {
//      console.error('Content Download Error:', error);
//      if (error instanceof Error) {
//        throw new Error(`Failed to process ${document.filename}: ${error.message}`);
//      }
//      throw error;
//    }
//  }
//
//  async processDocuments(documents: Document[], onProgress?: (progress: ProcessingProgress) => void): Promise<void> {
//    const activeDocuments = documents.filter(doc => 
//      !this.processingDocuments.has(doc.id) && 
//      doc.should_process && 
//      doc.embedding_status !== 'completed'
//    );
//
//    if (activeDocuments.length === 0) {
//      console.log('No new documents to process');
//      return;
//    }
//
//    // Mark documents as processing
//    activeDocuments.forEach(doc => this.processingDocuments.add(doc.id));
//
//    try {
//      // Process all documents in one request
//      const processId = crypto.randomUUID();
//      await EmbeddingService.generateEmbeddings(activeDocuments, processId, onProgress);
//    } finally {
//      // Clear processing status after timeout
//      setTimeout(() => {
//        activeDocuments.forEach(doc => this.processingDocuments.delete(doc.id));
//      }, this.processingTimeout);
//    }
//  }
//
//  static async generateEmbeddings(
//    documents: Document[], 
//    processId?: string,
//    onProgress?: (data: any) => void
//  ) {
//    const controller = new AbortController();
//    const timeout = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
//
//    try {
//      // Send all documents in one request
//      const functionUrl = 'http://localhost:8000/process';
//      const requestBody = {
//        documents: documents,
//        processId: processId || crypto.randomUUID()
//      };
//
//      console.log('Sending request with:', {
//        totalDocuments: documents.length,
//        processId: requestBody.processId
//      });
//
//      const response = await fetch(functionUrl, {
//        method: 'POST',
//        headers: {
//          'Content-Type': 'application/json',
//          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
//        },
//        body: JSON.stringify(requestBody),
//        signal: controller.signal
//      });
//
//      if (!response.ok) {
//        const errorText = await response.text();
//        throw new Error(`HTTP error! status: ${response.status}, error: ${errorText}`);
//      }
//
//      // Handle streaming response
//      const reader = response.body?.getReader();
//      if (!reader) throw new Error('No response body reader available');
//
//      let responseBuffer = '';
//      let totalProcessed = 0;
//      const totalDocuments = documents.length;
//
//      while (true) {
//        const { done, value } = await reader.read();
//        if (done) break;
//
//        const text = new TextDecoder().decode(value);
//        responseBuffer += text;
//        const lines = responseBuffer.split('\n');
//
//        // Process complete lines
//        for (let i = 0; i < lines.length - 1; i++) {
//          const line = lines[i].trim();
//          if (!line) continue;
//
//          try {
//            const data = JSON.parse(line);
//
//            // Enhanced progress reporting
//            if (data.type === 'progress') {
//              totalProcessed++;
//              const progress = {
//                ...data,
//                totalDocuments,
//                processedDocuments: totalProcessed,
//                percentComplete: Math.round((totalProcessed / totalDocuments) * 100)
//              };
//              if (onProgress) onProgress(progress);
//            } else if (data.type === 'error') {
//              console.error('Server reported error:', data);
//              if (onProgress) onProgress({
//                type: 'error',
//                error: data.error,
//                document: data.document
//              });
//            } else if (data.type === 'complete') {
//              if (onProgress) onProgress({
//                type: 'complete',
//                totalProcessed,
//                totalDocuments,
//                message: 'All documents processed successfully'
//              });
//            }
//          } catch (e) {
//            console.error('Error parsing server response:', e, 'Line:', line);
//          }
//        }
//
//        responseBuffer = lines[lines.length - 1];
//      }
//
//      return { processed: documents.map(d => d.filename), errors: [] };
//    } finally {
//      clearTimeout(timeout);
//    }
//  }
//
//  static async cancelProcess(processId: string) {
//    try {
//      console.log('Cancelling embedding process:', { processId });
//
//      const { data, error } = await supabase.functions.invoke('generate-embeddings', {
//        body: { action: 'cancel', processId }
//      });
//
//      if (error) throw error;
//      return data;
//    } catch (error) {
//      console.error('Fatal Process Cancellation Error:', error);
//      throw error;
//    }
//  }
//}
