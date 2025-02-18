import OpenAI from 'openai';
import { errorLogger } from '../utils/errorLogger.js';
import { PineconeService } from './pineconeService.js';
import { formatLogObject } from '../utils/logUtils.js';
import { validateAnalysisOutput, AnalysisValidationResult, validateMessages } from '../utils/validationUtils.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

interface AnalyzeParams {
  model: string;
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  validation?: {
    autoRetry?: boolean;
    maxRetries?: number;
    adjustParams?: boolean;
    minCoverage?: number;
    minSimilarity?: number;
  };
}

interface RetryAttempt {
  attempt: number;
  params: { temperature: number; max_tokens: number };
  validation: AnalysisValidationResult;
}

interface ValidationResult {
  result: AnalysisValidationResult;
  retryCount?: number;
  retryHistory?: RetryAttempt[];
  adjustedParams?: Record<string, any>;
}

interface AnalyzeResponse {
  content: string;
  usage: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
  };
  validation?: ValidationResult;
}

interface ValidationRetryConfig {
  maxRetries: number;
  temperatureStep: number;
  maxTokensIncrease: number;
  minTemperature: number;
  maxTemperature: number;
}

interface ModelParams {
  model: string;
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
}

interface ModelConfig {
  useMaxCompletionTokens: boolean;
  defaultMaxTokens: number;
  maxAllowedTokens: number;  // Total context length
  useTemperature: boolean;
  defaultTemperature?: number;
  defaultCompletionTokens: number;  // Default completion length if not calculated
}

interface TokenParams {
  max_tokens?: number;
  max_completion_tokens?: number;
}

interface PhaseContext {
  phase: number;
  answer: string;
  timestamp: string;
}

interface PhaseAnalysisParams extends AnalyzeParams {
  phase: number;
  previousPhaseAnswers?: PhaseContext[];
}

interface AnalysisResponse {
  answer: {
    role: string;
    content: string;
  };
  citations: any[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const DEFAULT_VALIDATION = {
  autoRetry: true,
  maxRetries: 2,
  adjustParams: true,
  minCoverage: 10,
  minSimilarity: 10,
  temperatureStep: 0.1,
  maxTokensIncrease: 500,
  minTemperature: 0.1,
  maxTemperature: 0.9
};

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'o3-mini': {
    useMaxCompletionTokens: true,
    defaultMaxTokens: 40000,     // Increased from 16000
    maxAllowedTokens: 200000,   // Total context length
    useTemperature: false,
    defaultCompletionTokens: 40000  // Increased from 16000
  },
  'gpt-4': {
    useMaxCompletionTokens: false,
    defaultMaxTokens: 40000,      // Increased from 8000
    maxAllowedTokens: 100000,     // Increased from 8000
    useTemperature: true,
    defaultTemperature: 0.7,
    defaultCompletionTokens: 40000 // Increased from 8000
  },
  'gpt-3.5-turbo': {
    useMaxCompletionTokens: false,
    defaultMaxTokens: 40000,      // Increased from 4000
    maxAllowedTokens: 100000,     // Increased from 4000
    useTemperature: true,
    defaultTemperature: 0.7,
    defaultCompletionTokens: 40000 // Increased from 4000
  }
};

export class OpenAIService {
  private client: OpenAI | null = null;
  private static instance: OpenAIService | null = null;

  constructor() {
    if (OpenAIService.instance) {
      return OpenAIService.instance;
    }
    OpenAIService.instance = this;
  }

  async initialize() {
    if (this.client) {
      return;
    }

    // Use Vite's environment variables
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not found in environment variables (VITE_OPENAI_API_KEY)');
    }
    
    try {
      this.client = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true
      });
      console.log('[OpenAIService] Successfully initialized OpenAI client');
    } catch (error) {
      console.error('[OpenAIService] Failed to initialize OpenAI client:', formatLogObject({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }));
      throw error;
    }
  }

  public getModelConfig(model: string): ModelConfig {
    return MODEL_CONFIGS[model] || MODEL_CONFIGS['gpt-3.5-turbo'];
  }

  private validateAndAdjustTokens(params: TokenParams, model: string): TokenParams {
    const config = this.getModelConfig(model);
    const adjustedParams: TokenParams = { ...params };

    // Get the current token limit
    const currentTokens = params.max_tokens ?? params.max_completion_tokens ?? config.defaultMaxTokens;

    // Ensure we don't exceed model's maximum tokens
    const validatedTokens = Math.min(currentTokens, config.maxAllowedTokens);

    // Set the appropriate token parameter based on model
    if (config.useMaxCompletionTokens) {
      delete adjustedParams.max_tokens;
      adjustedParams.max_completion_tokens = validatedTokens;
    } else {
      delete adjustedParams.max_completion_tokens;
      adjustedParams.max_tokens = validatedTokens;
    }

    return adjustedParams;
  }

  async analyze(params: AnalyzeParams, retryCount: number = 0): Promise<AnalyzeResponse> {
    if (!this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    const retryHistory: RetryAttempt[] = [];

    try {
      const modelConfig = this.getModelConfig(params.model);

      // Validate messages using the new utility
      const validation = validateMessages(params.messages);
      if (!validation.isValid) {
        console.error('[OpenAIService] Invalid messages:', {
          error: validation.error,
          messages: params.messages,
          timestamp: new Date().toISOString()
        });
        throw new Error(validation.error || 'Invalid message content');
      }

      // Validate messages before proceeding
      if (!params.messages || !Array.isArray(params.messages) || params.messages.length === 0) {
        console.error('[OpenAIService] Invalid messages array:', {
          hasMessages: !!params.messages,
          isArray: Array.isArray(params.messages),
          length: params.messages?.length,
          timestamp: new Date().toISOString()
        });
        throw new Error('No messages provided for analysis');
      }

      // Log raw message payload for debugging
      console.log('[OpenAIService] Raw message payload:', JSON.stringify(params.messages, null, 2));

      // Validate each message has valid content and role
      const invalidMessages = params.messages.filter(msg => {
        const isValid = msg && 
          typeof msg === 'object' && 
          'role' in msg && 
          'content' in msg && 
          typeof msg.content === 'string' && 
          msg.content.length > 0;
        
        if (!isValid) {
          console.error('[OpenAIService] Invalid message detected:', {
            message: msg,
            hasRole: 'role' in msg,
            hasContent: 'content' in msg,
            contentType: msg.content ? typeof msg.content : 'undefined',
            contentLength: msg.content?.length,
            timestamp: new Date().toISOString()
          });
        }
        
        return !isValid;
      });

      if (invalidMessages.length > 0) {
        console.error('[OpenAIService] Invalid messages found:', {
          totalMessages: params.messages.length,
          invalidCount: invalidMessages.length,
          invalidMessages: invalidMessages.map(msg => ({
            role: msg?.role,
            hasContent: !!msg?.content,
            contentType: typeof msg?.content,
            contentLength: msg?.content?.length
          })),
          timestamp: new Date().toISOString()
        });
        throw new Error('Invalid message content: all messages must have non-null string content');
      }

      // Ensure all messages have valid content
      const validatedMessages = params.messages.map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      }));

      // Log the validated messages
      console.log('[OpenAIService] Validated messages:', {
        messageCount: validatedMessages.length,
        messages: validatedMessages.map(msg => ({
          role: msg.role,
          contentLength: msg.content.length,
          contentPreview: msg.content.substring(0, 100) + '...'
        })),
        timestamp: new Date().toISOString()
      });

      // Use the model directly with validated messages
      const completionParams: any = {
        model: params.model,
        messages: validatedMessages,
        ...this.validateAndAdjustTokens({
          max_tokens: params.max_tokens,
          max_completion_tokens: params.max_completion_tokens
        }, params.model)
      };

      // Only add temperature if the model supports it
      if (modelConfig.useTemperature) {
        completionParams.temperature = params.temperature ?? modelConfig.defaultTemperature ?? 0.7;
      }

      // Log final request parameters
      console.log('[OpenAIService] Final OpenAI request:', {
        model: completionParams.model,
        messageCount: completionParams.messages.length,
        messages: completionParams.messages.map((msg: any) => ({
          role: msg.role,
          contentLength: msg.content.length,
          contentPreview: msg.content.substring(0, 100) + '...'
        })),
        temperature: completionParams.temperature,
        max_tokens: completionParams.max_tokens,
        max_completion_tokens: completionParams.max_completion_tokens,
        timestamp: new Date().toISOString()
      });

      let completion;
      try {
        completion = await this.client.chat.completions.create(completionParams);
      } catch (openaiError) {
        // Enhanced error handling for OpenAI API errors
        const error = openaiError as Error;
        console.error('[OpenAIService] OpenAI API error:', formatLogObject({
          error: error.message,
          model: params.model,
          params: {
            ...completionParams,
            messages: completionParams.messages.map((msg: any) => ({
              role: msg.role,
              contentLength: msg.content.length
            }))
          },
          timestamp: new Date().toISOString()
        }));

        // Throw a more descriptive error
        throw new Error(`OpenAI API error with model ${params.model}: ${error.message}`);
      }

      const content = completion.choices[0]?.message?.content || '';
      
      // Enhanced system message content extraction
      const systemMessage = params.messages.find(m => m.role === 'system');
      let originalContext = '';
      
      if (systemMessage) {
        if (typeof systemMessage.content === 'string') {
          originalContext = systemMessage.content;
        } else if (Array.isArray(systemMessage.content)) {
          originalContext = systemMessage.content
            .map(part => typeof part === 'string' ? part : part.text)
            .filter(Boolean)
            .join(' ');
        }
      }

      if (!originalContext) {
        console.warn('[OpenAIService] No system message content found for validation');
      }

      const validationResult = validateAnalysisOutput(content, originalContext, {
        minContentLength: 50,
        requiredKeywords: this.extractKeywords(originalContext),
        contextImportance: 0.6,
        semanticThreshold: 0.5
      });

      // Track this attempt in retry history
      retryHistory.push({
        attempt: retryCount,
        params: {
          temperature: params.temperature ?? 0.7,
          max_tokens: params.max_tokens ?? 2000
        },
        validation: validationResult
      });

      // Log validation results
      console.log('[OpenAIService] Analysis validation:', formatLogObject({
        isValid: validationResult.isValid,
        metrics: validationResult.metrics,
        discrepanciesCount: validationResult.discrepancies.length,
        retryCount,
        retryHistory,
        timestamp: new Date().toISOString()
      }));

      // Handle validation failure
      if (!validationResult.isValid) {
        console.warn('[OpenAIService] Analysis validation failed:', formatLogObject({
          discrepancies: validationResult.discrepancies,
          recommendation: validationResult.recommendation,
          retryCount,
          retryHistory,
          timestamp: new Date().toISOString()
        }));

        // Enhanced retry condition check
        let shouldRetry = params.validation?.autoRetry !== false && 
          retryCount < (params.validation?.maxRetries ?? DEFAULT_VALIDATION.maxRetries) &&
          params.validation?.adjustParams !== false;

        if (shouldRetry) {
          // Adjust parameters for retry
          const adjustedParams = this.adjustParamsForRetry(params, retryCount, validationResult);
          
          // Prevent retry if parameters haven't changed significantly
          const hasSignificantChanges = this.hasSignificantParameterChanges(
            { temperature: params.temperature, max_tokens: params.max_tokens },
            { temperature: adjustedParams.temperature, max_tokens: adjustedParams.max_tokens }
          );

          if (!hasSignificantChanges) {
            console.warn('[OpenAIService] Skipping retry - parameter adjustments too small');
            shouldRetry = false;
          } else {
            console.log('[OpenAIService] Retrying analysis with adjusted parameters:', formatLogObject({
              originalParams: {
                temperature: params.temperature,
                max_tokens: params.max_tokens
              },
              adjustedParams: {
                temperature: adjustedParams.temperature,
                max_tokens: adjustedParams.max_tokens
              },
              retryCount: retryCount + 1,
              retryHistory,
              timestamp: new Date().toISOString()
            }));

            // Recursive retry with adjusted parameters
            return this.analyze(adjustedParams, retryCount + 1);
          }
        }

        // Log final status if not retrying
        console.warn('[OpenAIService] Not retrying analysis:', formatLogObject({
          reason: retryCount >= (params.validation?.maxRetries ?? DEFAULT_VALIDATION.maxRetries) 
            ? 'Max retries reached' 
            : params.validation?.autoRetry === false
              ? 'Auto-retry disabled'
              : 'Parameter adjustments insufficient',
          retryCount,
          maxRetries: params.validation?.maxRetries ?? DEFAULT_VALIDATION.maxRetries,
          retryHistory,
          timestamp: new Date().toISOString()
        }));

        // Log validation failure with complete history
        errorLogger.logError(new Error('Analysis validation failed after retries'), {
          component: 'OpenAIService',
          operation: 'analyze',
          metadata: {
            retryHistory,
            finalValidation: validationResult,
            model: params.model,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      return {
        content,
        usage: {
          total_tokens: completion.usage?.total_tokens || 0,
          prompt_tokens: completion.usage?.prompt_tokens || 0,
          completion_tokens: completion.usage?.completion_tokens || 0,
        },
        validation: {
          result: validationResult,
          retryCount,
          retryHistory,
          adjustedParams: retryCount > 0 ? {
            temperature: params.temperature,
            max_tokens: params.max_tokens
          } : undefined
        }
      };
    } catch (error) {
      console.error('[OpenAIService] Analysis failed:', formatLogObject({
        error: error instanceof Error ? error.message : 'Unknown error',
        model: params.model,
        retryCount,
        retryHistory,
        timestamp: new Date().toISOString()
      }));
      throw error;
    }
  }

  private hasSignificantParameterChanges(
    original: { temperature?: number; max_tokens?: number },
    adjusted: { temperature?: number; max_tokens?: number }
  ): boolean {
    const MIN_TEMP_CHANGE = 0.05;
    const MIN_TOKEN_CHANGE = 200;

    // Only check temperature if both values are present
    const hasSignificantTempChange = original.temperature !== undefined && adjusted.temperature !== undefined
      ? Math.abs(original.temperature - adjusted.temperature) >= MIN_TEMP_CHANGE
      : false;

    const hasSignificantTokenChange = Math.abs((original.max_tokens ?? 0) - (adjusted.max_tokens ?? 0)) >= MIN_TOKEN_CHANGE;

    return hasSignificantTempChange || hasSignificantTokenChange;
  }

  private adjustParamsForRetry(
    params: AnalyzeParams, 
    currentRetryCount: number,
    validationResult: AnalysisValidationResult
  ): AnalyzeParams {
    const config = this.getModelConfig(params.model);
    
    // Create base params
    const adjustedParams: AnalyzeParams = {
      ...params
    };

    // Only adjust temperature if the model supports it
    if (config.useTemperature) {
      const currentTemp = params.temperature ?? config.defaultTemperature ?? 0.7;
      
      // Adjust temperature based on validation metrics
      let temperatureAdjustment = DEFAULT_VALIDATION.temperatureStep;
      if (validationResult.metrics.contextCoverage < 0.3) {
        temperatureAdjustment *= 2;
      }

      // Calculate new temperature
      adjustedParams.temperature = Math.max(
        DEFAULT_VALIDATION.minTemperature,
        currentTemp - (temperatureAdjustment * (currentRetryCount + 1))
      );
    }

    // Calculate token increase based on content length
    let tokenIncrease = DEFAULT_VALIDATION.maxTokensIncrease;
    if (validationResult.metrics.contentLength < 100) {
      tokenIncrease *= 1.5;
    }

    // Get current tokens and calculate new value
    const currentTokens = params.max_tokens ?? params.max_completion_tokens ?? config.defaultMaxTokens;
    const newTokens = Math.min(
      currentTokens + tokenIncrease,
      config.maxAllowedTokens
    );

    // Apply validated token parameters
    const validatedTokens = this.validateAndAdjustTokens(
      { max_tokens: newTokens },
      params.model
    );

    return {
      ...adjustedParams,
      ...validatedTokens
    };
  }

  private calculateAvailableTokens(promptTokens: number, model: string): number {
    const config = this.getModelConfig(model);
    
    // Calculate maximum available tokens
    const maxAvailable = config.maxAllowedTokens - promptTokens;
    
    // Ensure we leave some buffer for safety
    const safetyBuffer = 1000; // Increased from 100 to handle larger responses
    const availableWithBuffer = Math.max(0, maxAvailable - safetyBuffer);
    
    // Take the smaller of:
    // 1. Available tokens with buffer
    // 2. Model's default completion length
    const finalTokenCount = Math.min(
      availableWithBuffer,
      config.defaultCompletionTokens
    );

    console.log('[OpenAIService] Token allocation calculation:', formatLogObject({
      promptTokens,
      maxModelTokens: config.maxAllowedTokens,
      availableTokens: maxAvailable,
      availableWithBuffer,
      defaultCompletionTokens: config.defaultCompletionTokens,
      finalTokenCount,
      model,
      timestamp: new Date().toISOString()
    }));

    return finalTokenCount;
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  async analyzeWithAssistant(
    question: string, 
    context: string, 
    model: string = 'o3-mini',
    validation?: {
      autoRetry?: boolean;
      maxRetries?: number;
      adjustParams?: boolean;
    }
  ): Promise<AnalysisResponse> {
    console.log('[OpenAIService] Starting analysis with model:', formatLogObject({
      model,
      contextLength: context.length,
      questionLength: question.length,
      timestamp: new Date().toISOString()
    }));

    try {
      // First, use Pinecone to find relevant documents
      console.log('[OpenAIService] Querying Pinecone for relevant documents...', formatLogObject({
        model,
        contextLength: context.length,
        questionLength: question.length,
        messages: [
          {
            role: 'system',
            content: context
          },
          {
            role: 'user',
            content: question
          }
        ],
        timestamp: new Date().toISOString()
      }));

      let pineconeResponse;
      try {
        pineconeResponse = await PineconeService.chat([
          {
            role: 'system',
            content: context
          },
          {
            role: 'user',
            content: question
          }
        ], model);
        
        if (!pineconeResponse || !pineconeResponse.citations || pineconeResponse.citations.length === 0) {
          console.warn('[OpenAIService] No relevant documents found in Pinecone response:', formatLogObject({
            response: pineconeResponse,
            timestamp: new Date().toISOString()
          }));
          
          return {
            answer: {
              role: 'assistant',
              content: 'NA'
            },
            citations: [],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
          };
        }

        console.log('[OpenAIService] Pinecone query successful:', formatLogObject({
          hasCitations: !!pineconeResponse.citations,
          citationsCount: pineconeResponse.citations?.length || 0,
          citations: pineconeResponse.citations?.map(c => ({
            content: c.content,
            score: c.score,
            reference: c.reference
          })),
          timestamp: new Date().toISOString()
        }));

        // Filter out low-scoring citations
        const MIN_SCORE_THRESHOLD = 0.6;
        const filteredCitations = pineconeResponse.citations.filter(c => c.score >= MIN_SCORE_THRESHOLD);

        if (filteredCitations.length === 0) {
          console.warn('[OpenAIService] No citations met the minimum score threshold:', formatLogObject({
            threshold: MIN_SCORE_THRESHOLD,
            originalCount: pineconeResponse.citations.length,
            scores: pineconeResponse.citations.map(c => c.score),
            timestamp: new Date().toISOString()
          }));
          
          return {
            answer: {
              role: 'assistant',
              content: "While I found some documents, they don't seem to be relevant enough to provide a confident answer to this question."
            },
            citations: pineconeResponse.citations,
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
          };
        }

        // Sort citations by score
        const sortedCitations = [...filteredCitations].sort((a, b) => b.score - a.score);

        // Format relevant documents into context
        const relevantDocs = this.formatRelevantDocs(sortedCitations);

        // Keep the original system content
        const systemContent = context;
        const userContent = this.buildUserContent(question, relevantDocs);

        console.log('[OpenAIService] Message preparation complete:', formatLogObject({
          model,
          systemContent: systemContent,
          relevantDocuments: sortedCitations.map(c => ({
            title: c.reference?.title,
            content: c.content,
            score: c.score
          })),
          userContent: userContent,
          systemContentLength: systemContent.length,
          relevantDocsLength: relevantDocs.length,
          totalLength: systemContent.length + userContent.length,
          approximateTokens: Math.ceil((systemContent.length + userContent.length) / 4),
          timestamp: new Date().toISOString()
        }));

        // Prepare messages based on model
        const messages = this.prepareMessages(question, systemContent, sortedCitations);

        // Get model configuration and make the API call
        const modelConfig = this.getModelConfig(model);
        const completion = await this.makeOpenAICall(messages, modelConfig);

        return {
          answer: {
            role: 'assistant',
            content: completion.choices[0].message.content
          },
          citations: sortedCitations,
          usage: completion.usage
        };

      } catch (pineconeError) {
        console.error('[OpenAIService] Pinecone query failed:', formatLogObject({
          error: pineconeError instanceof Error ? pineconeError.message : 'Unknown error',
          stack: pineconeError instanceof Error ? pineconeError.stack : undefined,
          timestamp: new Date().toISOString()
        }));
        
        errorLogger.logError(pineconeError as Error, {
          component: 'OpenAIService',
          operation: 'pineconeQuery',
          metadata: {
            model,
            contextLength: context.length,
            questionLength: question.length,
            timestamp: new Date().toISOString()
          }
        });

        // Return a user-friendly error message
        return {
          answer: {
            role: 'assistant',
            content: "I encountered an error while searching the documents. Please try again or contact support if the issue persists."
          },
          citations: [],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        };
      }
    } catch (error) {
      console.error('[OpenAIService] Analysis failed:', formatLogObject({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }));

      errorLogger.logError(error as Error, {
        component: 'OpenAIService',
        operation: 'analyzeWithAssistant',
        metadata: {
          model,
          contextLength: context.length,
          questionLength: question.length,
          timestamp: new Date().toISOString()
        }
      });

      throw error;
    }
  }

  // Helper functions for message preparation
  private formatRelevantDocs(citations: any[] = []): string {
    if (!citations?.length) {
      return '\nNo relevant sections found in the indexed documents.';
    }
    return '\nRelevant sections from indexed documents:\n' + citations
      .map((c, i) => {
        const score = c.score.toFixed(3);
        return `[${i + 1}] Relevance ${score}:\n${c.content.trim()}`;
      })
      .join('\n\n');
  }

  private buildUserContent(question: string, relevantDocs: string): string {
    if (question === "NA") {
      return "Please analyze the provided documents and summarize the key points related to sustainability, environmental impact, and business practices.";
    }
    
    return `${question}\n\n${relevantDocs}\n\nProvide a focused and specific answer to the question based on these search results. Your response should:
1. Directly address the question asked
2. Use specific examples and evidence from the provided documents
3. Be concise and to the point
4. Highlight any uncertainties or areas where the documents don't provide sufficient information

Use plain text only, without any special formatting or markdown.`;
  }

  private prepareMessages(question: string, systemContent: string, citations: any[] = []): ChatCompletionMessageParam[] {
    // Validate inputs
    if (!question || !systemContent) {
        throw new Error('[OpenAIService] Invalid input: question or systemContent is null/undefined');
    }

    const relevantDocs = this.formatRelevantDocs(citations);
    const userContent = this.buildUserContent(question, relevantDocs);

    // Validate generated content
    if (!userContent) {
        throw new Error('[OpenAIService] Failed to generate user content');
    }

    return [
        {
            role: "system" as const,
            content: systemContent
        },
        {
            role: "user" as const,
            content: userContent
        }
    ];
  }

  // Helper method to extract important keywords from context
  private extractKeywords(context: string): string[] {
    // Simple keyword extraction based on frequency and importance
    const words = context.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();
    
    // Skip common words
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    words.forEach(word => {
      if (!stopWords.has(word) && word.length > 3) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    });
    
    // Get top keywords by frequency
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private formatPhaseContext(phase: number, previousPhases: PhaseContext[]): string {
    if (phase === 0) {
      return ''; // Phase 0 should not include any previous context
    }

    // Sort phases to ensure chronological order
    const sortedPhases = [...previousPhases].sort((a, b) => a.phase - b.phase);
    
    // Validate that we have all previous phases
    for (let i = 0; i < phase; i++) {
      const hasPhase = sortedPhases.some(p => p.phase === i);
      if (!hasPhase) {
        console.warn(`[OpenAIService] Missing phase ${i} in context building for phase ${phase}`);
      }
    }

    // Build the context with clear section headers and delimiters
    let formattedContext = '';
    
    sortedPhases.forEach(prevPhase => {
      formattedContext += `\n--- Reference: Phase ${prevPhase.phase} Results ---\n`;
      formattedContext += `${prevPhase.answer.trim()}\n`;
      formattedContext += `----------------------------------------\n`;
    });

    return formattedContext;
  }

  private buildPhaseSystemPrompt(context: string, phase: number, previousPhases: PhaseContext[] = []): string {
    // For phase 0, return only the original context with a clear header
    if (phase === 0) {
      return `=== Phase 0 Analysis Context ===\n\n${context}`;
    }

    // For other phases, build a structured prompt that includes:
    // 1. Current phase header and instructions (primary focus)
    // 2. Previous phase results (as reference material)
    const currentPhaseHeader = `=== Current Phase ${phase} Instructions ===\n${context}\n\n`;
    
    // Add reference header for previous phases
    const referenceHeader = `=== Reference Material (Previous Phase Results) ===\n`;
    const previousContext = this.formatPhaseContext(phase, previousPhases);
    
    const instructions = `
=== Important Instructions for Current Phase ===
1. Focus primarily on the requirements specified in the Current Phase Instructions above
2. Use the previous phase results only as reference material
3. Structure your response exactly according to the output format specified in the current phase
4. Do not summarize previous phases - focus on completing the current phase's tasks
5. Maintain strict adherence to the current phase's output format requirements

Now, proceed with the analysis following the format specified in the Current Phase Instructions above.
`;

    // Order is important: Current phase instructions first, then supporting material
    return `${currentPhaseHeader}${instructions}${referenceHeader}${previousContext}`;
  }

  async analyzeWithPhaseContext(
    question: string,
    context: string,
    phase: number,
    previousPhases: PhaseContext[] = [],
    model: string = 'o3-mini',
    validation?: {
      autoRetry?: boolean;
      maxRetries?: number;
      adjustParams?: boolean;
    }
  ) {
    console.log('[OpenAIService] Starting phase analysis:', formatLogObject({
      phase,
      previousPhaseCount: previousPhases.length,
      expectedPreviousPhases: phase,
      hasMissingPhases: previousPhases.length < phase,
      model,
      timestamp: new Date().toISOString()
    }));

    // Validate phase number and previous phases
    if (phase < 0) {
      throw new Error('Invalid phase number: phase cannot be negative');
    }

    if (phase > 0 && previousPhases.length === 0) {
      console.warn('[OpenAIService] No previous phase results provided for phase > 0');
    }

    // Build the system prompt with enhanced phase context
    const systemPrompt = this.buildPhaseSystemPrompt(context, phase, previousPhases);
    
    // Log the context building details
    console.log('[OpenAIService] Built phase context:', formatLogObject({
      phase,
      contextLength: systemPrompt.length,
      previousPhaseCount: previousPhases.length,
      phaseNumbers: previousPhases.map(p => p.phase),
      model,
      timestamp: new Date().toISOString()
    }));

    try {
      // Use the existing analyzeWithAssistant method with the enhanced context
      const result = await this.analyzeWithAssistant(question, systemPrompt, model, validation);
      
      // Log successful analysis
      console.log('[OpenAIService] Phase analysis completed:', formatLogObject({
        phase,
        resultLength: result.answer?.content?.length || 0,
        usage: result.usage,
        model,
        timestamp: new Date().toISOString()
      }));

      return result;
    } catch (error) {
      // Enhanced error logging for phase analysis
      console.error('[OpenAIService] Phase analysis failed:', formatLogObject({
        phase,
        error: error instanceof Error ? error.message : 'Unknown error',
        model,
        timestamp: new Date().toISOString()
      }));
      
      // Log error with full context for debugging
      errorLogger.logError(error as Error, {
        component: 'OpenAIService',
        operation: 'analyzeWithPhaseContext',
        metadata: {
          phase,
          previousPhaseCount: previousPhases.length,
          model,
          contextLength: systemPrompt.length,
          timestamp: new Date().toISOString()
        }
      });
      
      throw error;
    }
  }

  private async makeOpenAICall(messages: any[], modelConfig: any) {
    console.log('[OpenAIService] Sending request to OpenAI API:', {
      model: modelConfig.model,
      messageStructure: messages,
      timestamp: new Date().toISOString()
    });

    // Estimate prompt tokens
    const messagesText = messages.map(m => m.content).join(' ');
    const estimatedPromptTokens = this.estimateTokenCount(messagesText);
    
    // Calculate available completion tokens
    const availableCompletionTokens = this.calculateAvailableTokens(estimatedPromptTokens, modelConfig.model);

    const params: any = {
      model: modelConfig.model,
      messages,
      temperature: 0.3
    };

    // Set token parameter based on model
    if (modelConfig.useMaxCompletionTokens) {
      params.max_completion_tokens = availableCompletionTokens;
    } else {
      params.max_tokens = availableCompletionTokens;
    }

    return await this.client.chat.completions.create(params);
  }
}