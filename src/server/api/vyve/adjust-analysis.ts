import { RequestHandler } from 'express';
import { OpenAIService } from '@/services/openaiService';
import { formatLogObject } from '@/utils/logUtils';

const openai = new OpenAIService();

export const adjustAnalysis: RequestHandler = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    console.log('[adjust-analysis] Received adjustment request:', formatLogObject({
      timestamp: new Date().toISOString(),
      body: {
        ...req.body,
        context: {
          ...req.body.context,
          original_content: req.body.context?.original_content?.substring(0, 100) + '...' // Truncate for logging
        }
      }
    }));

    const { model, system_prompt, context } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!model) missingFields.push('model');
    if (!system_prompt) missingFields.push('system_prompt');
    if (!context) missingFields.push('context');
    if (!context?.original_content) missingFields.push('context.original_content');
    if (!context?.user_adjustment) missingFields.push('context.user_adjustment');

    if (missingFields.length > 0) {
      console.error('[adjust-analysis] Missing required fields:', formatLogObject({
        missingFields,
        receivedFields: Object.keys(req.body)
      }));
      res.status(400).json({
        error: 'Missing required parameters',
        details: `Missing fields: ${missingFields.join(', ')}`
      });
      return;
    }

    // Prepare the messages for the adjustment
    const messages = [
      {
        role: 'system' as const,
        content: system_prompt,
      },
      {
        role: 'user' as const,
        content: `Original Analysis:\n${context.original_content}\n\nKey Findings:\n${context.key_findings.join('\n')}\n\nPhase: ${context.phase_name}\nDescription: ${context.phase_description}\n\nUser Adjustment Request:\n${context.user_adjustment}`,
      },
    ];

    console.log('[adjust-analysis] Sending request to OpenAI:', formatLogObject({
      model,
      messageCount: messages.length,
      promptLength: messages[1].content.length
    }));

    // Get the adjusted analysis
    const response = await openai.analyze({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    console.log('[adjust-analysis] Received initial response:', formatLogObject({
      contentLength: response.content.length,
      usage: response.usage
    }));

    // Extract key findings using a follow-up call
    const findingsPrompt = `Based on the adjusted analysis below, extract the key findings as a concise bullet-point list:\n\n${response.content}`;
    
    const findingsResponse = await openai.analyze({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a precise extractor of key findings. Output only the bullet points, one per line, starting with "• ".',
        },
        {
          role: 'user',
          content: findingsPrompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    // Process the findings into an array
    const key_findings = findingsResponse.content
      .split('\n')
      .filter(line => line.trim().startsWith('•'))
      .map(line => line.trim().substring(2).trim());

    const duration = Date.now() - startTime;
    console.log('[adjust-analysis] Completed successfully:', formatLogObject({
      duration: `${duration}ms`,
      findingsCount: key_findings.length,
      totalUsage: {
        ...response.usage,
        findings_usage: findingsResponse.usage
      }
    }));

    res.json({
      content: response.content,
      key_findings,
      usage: {
        main_analysis: response.usage,
        findings_extraction: findingsResponse.usage
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[adjust-analysis] Error processing adjustment:', formatLogObject({
      duration: `${duration}ms`,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      request: {
        body: req.body,
        headers: req.headers
      }
    }));

    res.status(500).json({
      error: 'Failed to process adjustment',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}; 