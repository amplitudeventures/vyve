import { errorLogger } from '@/utils/errorLogger';

const SUPABASE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;



export class PineconeService {
  private static isInitialized: boolean = false;

  static async initialize(apiKey: string) {
    try {
      const response = await fetch(`${SUPABASE_FUNCTION_URL}/pinecone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ 
          action: 'initialize'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(`Failed to initialize: ${data.error}`);
      }

      this.isInitialized = true;
      console.log('Pinecone initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = {
        component: 'PineconeService',
        operation: 'initialize',
        metadata: {
          timestamp: new Date().toISOString(),
          errorMessage,
          errorType: error instanceof Error ? error.constructor.name : typeof error
        }
      };

      errorLogger.logError(error as Error, errorDetails);
      throw new Error(`Failed to initialize Pinecone: ${errorMessage}. Please check your API key and network connection.`);
    }
  }

  static async chat(messages: { role: string; content: string }[], model: string = 'o3-mini') {
    if (!this.isInitialized) {
      throw new Error('Pinecone client not initialized');
    }

    try {
      // Get the last user message
      const lastUserMessage = messages[messages.length - 1];
      if (!lastUserMessage) {
        throw new Error('No message to process');
      }

      // Use the appropriate endpoint based on the model
      const endpoint = model.startsWith('gpt-') || model.startsWith('o1-') || model.startsWith('o3-') || model === 'o3-mini' ? 'openai' : 'deepseek';
      console.log('Using endpoint:', endpoint, 'for model:', model);

      // Format the request body to include full context
      const requestBody = {
        question: lastUserMessage.content,
        model,
        messages: messages.slice(-5), // Keep only last 5 messages for context
        temperature: 0.5,
        context: messages.map(m => m.content).join('\n\n') // Include all message content for context
      };

      console.log(`[PineconeService] Sending request to ${endpoint} endpoint:`, {
        model,
        messageCount: messages.length,
        contextLength: requestBody.context.length,
        timestamp: new Date().toISOString()
      });

      const response = await fetch(`${SUPABASE_FUNCTION_URL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Chat request failed: ${error.error || response.statusText}`);
      }

      const data = await response.json();
      
      // Format citations consistently for both endpoints
      const formattedCitations = data.citations?.map(citation => ({
        content: citation.content || '',
        score: citation.score || 0,
        reference: {
          type: citation.reference?.type || 'document',
          title: citation.reference?.title || citation.metadata?.filename || 'Unknown document'
        }
      })) || [];

      console.log(`[PineconeService] ${endpoint} response received:`, {
        hasCitations: formattedCitations.length > 0,
        citationsCount: formattedCitations.length,
        citationSources: formattedCitations.map(c => c.reference?.title),
        timestamp: new Date().toISOString()
      });

      return {
        answer: data.message.content,
        citations: formattedCitations,
        usage: data.usage || {}
      };
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'PineconeService',
        operation: 'chat',
        metadata: {
          timestamp: new Date().toISOString(),
          model
        }
      });
      throw error;
    }
  }

  
}