import { RequestHandler } from 'express';
import { OpenAIService } from '../../services/openaiService.js';
import { formatLogObject } from '../../utils/logUtils.js';

const openai = new OpenAIService();

export const adjustAnalysis: RequestHandler = async (req, res, next): Promise<void> => {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`[adjust-analysis:${requestId}] Request received:`, formatLogObject({
      model: req.body?.model,
      contextLength: req.body?.context?.original_content?.length,
      hasSystemPrompt: !!req.body?.system_prompt,
      hasUserAdjustment: !!req.body?.context?.user_adjustment,
      timestamp: new Date().toISOString()
    }));

    const { model, system_prompt, context } = req.body;

    // Basic validation
    if (!model || !system_prompt || !context?.original_content || !context?.user_adjustment) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields',
        requestId
      });
      return;
    }

    // Initialize OpenAI
    try {
      await openai.initialize();
    } catch (initError) {
      console.error(`[adjust-analysis:${requestId}] OpenAI initialization failed:`, formatLogObject({
        error: initError instanceof Error ? initError.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }));
      res.status(500).json({
        error: 'OPENAI_INIT_ERROR',
        message: 'Failed to initialize OpenAI service',
        details: initError instanceof Error ? initError.message : 'Unknown error',
        requestId
      });
      return;
    }

    // Get model config and validate content length
    const modelConfig = openai.getModelConfig(model);

    // Calculate token estimate (4 chars per token is a rough estimate)
    const estimatedTokens = Math.ceil((
      context.original_content.length + 
      system_prompt.length + 
      context.user_adjustment.length + 
      (context.key_findings?.join('\n').length || 0)
    ) / 4);

    // For o3-mini, we need to be more conservative with token limits
    const maxAllowedTokens = model === 'o3-mini' ? modelConfig.maxAllowedTokens : modelConfig.maxAllowedTokens;

    if (estimatedTokens > maxAllowedTokens) {
      // If content is too long, truncate it
      const maxContentLength = Math.floor(maxAllowedTokens * 3); // Convert back to chars (rough estimate)
      const truncatedContent = context.original_content.slice(0, maxContentLength);
      
      console.log(`[adjust-analysis:${requestId}] Content truncated:`, formatLogObject({
        originalLength: context.original_content.length,
        truncatedLength: truncatedContent.length,
        model,
        maxAllowedTokens,
        timestamp: new Date().toISOString()
      }));

      // Update the context with truncated content
      context.original_content = truncatedContent;
    }

    // Prepare messages
    const messages = [
      {
        role: 'system' as const,
        content: system_prompt,
      },
      {
        role: 'user' as const,
        content: `Original Analysis:\n${context.original_content}\n\nKey Findings:\n${context.key_findings?.join('\n') || 'No key findings provided'}\n\nPhase: ${context.phase_name || 'Unknown'}\nDescription: ${context.phase_description || 'No description'}\n\nUser Adjustment Request:\n${context.user_adjustment}`,
      },
    ];

    console.log(`[adjust-analysis:${requestId}] Sending request to OpenAI:`, formatLogObject({
      model,
      messageCount: messages.length,
      timestamp: new Date().toISOString()
    }));

    // Get the adjusted analysis
    let response;
    try {
      response = await openai.analyze({
        model,
        messages,
        max_tokens: model === 'o3-mini' ? 6000 : modelConfig.defaultMaxTokens,
      });
    } catch (openaiError) {
      console.error(`[adjust-analysis:${requestId}] OpenAI analysis failed:`, formatLogObject({
        error: openaiError instanceof Error ? openaiError.message : 'Unknown error',
        model,
        timestamp: new Date().toISOString()
      }));
      res.status(500).json({
        error: 'OPENAI_API_ERROR',
        message: 'OpenAI analysis failed',
        details: openaiError instanceof Error ? openaiError.message : 'Unknown error',
        requestId
      });
      return;
    }

    if (!response?.content) {
      res.status(500).json({
        error: 'OPENAI_ERROR',
        message: 'Invalid response from OpenAI',
        requestId
      });
      return;
    }

    // Extract key findings
    let findingsResponse;
    try {
      findingsResponse = await openai.analyze({
        model,
        messages: [
          {
            role: 'system' as const,
            content: 'Extract key findings as bullet points. Output only the bullet points, one per line, starting with "• ".',
          },
          {
            role: 'user' as const,
            content: `Extract key findings from:\n\n${response.content}`,
          },
        ],
        max_tokens: 500,
      });
    } catch (findingsError) {
      console.error(`[adjust-analysis:${requestId}] Key findings extraction failed:`, formatLogObject({
        error: findingsError instanceof Error ? findingsError.message : 'Unknown error',
        model,
        timestamp: new Date().toISOString()
      }));
      // Continue without key findings
      findingsResponse = null;
    }

    const key_findings = findingsResponse?.content
      ? findingsResponse.content
          .split('\n')
          .filter(line => line.trim().startsWith('•'))
          .map(line => line.trim().substring(2).trim())
      : [];

    // Return response with validation feedback
    res.json({
      content: response.content,
      key_findings,
      usage: response.usage,
      validation: {
        warnings: [],
        contentModifications: [],
        metrics: {
          estimatedTokens,
          responseTokens: response.usage?.total_tokens || 0,
          contentLength: context.original_content.length
        }
      }
    });

  } catch (error) {
    console.error(`[adjust-analysis:${requestId}] Error:`, formatLogObject({
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : 'Unknown error',
      model: req.body?.model,
      timestamp: new Date().toISOString()
    }));

    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      requestId
    });
  }
}; 