import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { formatLogObject } from '../utils/logUtils';

// Extend AxiosRequestConfig to include metadata
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: {
    requestId: string;
    startTime: number;
  };
}

// Console styling for better visibility
const consoleStyles = {
  header: 'background: #2196F3; color: white; padding: 2px 6px; border-radius: 2px;',
  success: 'background: #4CAF50; color: white; padding: 2px 6px; border-radius: 2px;',
  error: 'background: #f44336; color: white; padding: 2px 6px; border-radius: 2px;',
  warning: 'background: #ff9800; color: white; padding: 2px 6px; border-radius: 2px;',
  info: 'background: #607d8b; color: white; padding: 2px 6px; border-radius: 2px;'
};

// Create an axios instance with interceptors
const api = axios.create();

// Request interceptor
api.interceptors.request.use(
  (config: ExtendedAxiosRequestConfig) => {
    const requestId = Math.random().toString(36).substring(7);
    config.metadata = { 
      requestId,
      startTime: Date.now()
    };
    
    console.group(`%c[API Request] ${config.url}`, consoleStyles.info);
    console.log('%cRequest Details:', consoleStyles.info, {
      method: config.method?.toUpperCase(),
      url: config.url,
      requestId,
      headers: config.headers,
      data: config.data
    });
    console.groupEnd();
    
    return config;
  },
  (error) => {
    console.error(`%c[API Request Error]`, consoleStyles.error, error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    const config = response.config as ExtendedAxiosRequestConfig;
    const duration = Date.now() - (config.metadata?.startTime || Date.now());
    
    console.group(`%c[API Response] ${config.url}`, consoleStyles.success);
    console.log('%cResponse Details:', consoleStyles.info, {
      status: response.status,
      statusText: response.statusText,
      duration: `${duration}ms`,
      requestId: config.metadata?.requestId,
      headers: response.headers,
      data: response.data
    });
    console.groupEnd();
    
    return response;
  },
  (error: AxiosError) => {
    const config = error.config as ExtendedAxiosRequestConfig;
    const duration = Date.now() - (config?.metadata?.startTime || Date.now());
    
    console.group(`%c[API Error] ${config?.url}`, consoleStyles.error);
    console.log('%cError Details:', consoleStyles.error, {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      duration: `${duration}ms`,
      requestId: config?.metadata?.requestId
    });
    
    if (error.response?.data) {
      console.log('%cServer Response:', consoleStyles.warning, error.response.data);
    }
    
    if (error.request) {
      console.log('%cRequest Details:', consoleStyles.info, {
        method: config?.method?.toUpperCase(),
        url: config?.url,
        headers: config?.headers,
        data: config?.data
      });
    }
    
    if (error.stack) {
      console.log('%cStack Trace:', consoleStyles.info, error.stack);
    }
    
    console.groupEnd();
    return Promise.reject(error);
  }
);

const logPhaseEvent = (event: string, data: any) => {
  console.groupCollapsed(`%c[PhaseContent] ${event}`, consoleStyles.header);
  console.log('%cTimestamp:', consoleStyles.info, new Date().toISOString());
  console.log('%cEvent Details:', consoleStyles.info, formatLogObject(data));
  console.groupEnd();
};

const logPhaseError = (event: string, error: any, context: any = {}) => {
  console.group(`%c[PhaseContent] ${event}`, consoleStyles.error);
  console.log('%cTimestamp:', consoleStyles.info, new Date().toISOString());
  
  if (error instanceof AxiosError) {
    console.log('%cAPI Error:', consoleStyles.error, {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      serverMessage: error.response?.data?.message,
      serverError: error.response?.data?.error,
      serverDetails: error.response?.data?.details
    });
    
    if (error.config) {
      console.log('%cRequest Config:', consoleStyles.info, {
        method: error.config.method?.toUpperCase(),
        url: error.config.url,
        headers: error.config.headers,
        data: error.config.data
      });
    }
  } else {
    console.log('%cError Details:', consoleStyles.error, formatLogObject({
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      ...error
    }));
  }
  
  console.log('%cContext:', consoleStyles.warning, formatLogObject(context));
  console.groupEnd();
};

interface AdjustmentError {
  response?: {
    status?: number;
    statusText?: string;
    data?: {
      error?: string;
      message?: string;
      details?: any;
      requestId?: string;
    };
  };
}

const handleAdjustmentError = (error: AxiosError<any>) => {
  const errorContext = {
    status: error.response?.status,
    statusText: error.response?.statusText,
    errorCode: error.response?.data?.error,
    errorMessage: error.response?.data?.message,
    errorDetails: error.response?.data?.details,
    requestId: error.response?.data?.requestId,
    config: {
      method: error.config?.method,
      url: error.config?.url,
      headers: error.config?.headers,
      data: error.config?.data
    }
  };

  logPhaseError('Adjustment Request Failed', error, errorContext);

  let userMessage = 'Failed to apply adjustments: ';
  let errorType = 'Unknown Error';
  
  if (error.response?.data?.error) {
    errorType = error.response.data.error;
    switch (error.response.data.error) {
      case 'VALIDATION_ERROR':
        userMessage += `Invalid request - ${error.response.data.details.map((e: any) => e.error).join(', ')}`;
        break;
      case 'OPENAI_INIT_ERROR':
        userMessage += 'OpenAI service initialization failed. Please try again later.';
        break;
      case 'OPENAI_API_ERROR':
        userMessage += `OpenAI API error: ${error.response.data.details?.message || 'Unknown error'}`;
        break;
      case 'FINDINGS_EXTRACTION_ERROR':
        userMessage += 'Failed to extract key findings from the analysis.';
        break;
      default:
        userMessage += error.response.data.message || error.response.statusText || 'Unknown error';
    }
    
    if (error.response.data.requestId) {
      userMessage += ` (Request ID: ${error.response.data.requestId})`;
    }
  } else if (error.response?.status === 404) {
    errorType = 'Not Found';
    userMessage += 'Adjustment endpoint not found. Please check your server configuration.';
  } else if (error.response?.status === 429) {
    errorType = 'Rate Limit';
    userMessage += 'Too many requests. Please wait a moment and try again.';
  } else if (!error.response) {
    errorType = 'Network Error';
    userMessage += 'Network error. Please check your internet connection.';
  } else {
    // Enhanced 500 error handling
    if (error.response.status === 500) {
      userMessage += `Internal Server Error - ${error.response.data?.message || 'Unknown server error'}`;
      if (error.response.data?.details) {
        userMessage += `\nDetails: ${JSON.stringify(error.response.data.details)}`;
      }
      if (error.response.data?.stack && process.env.NODE_ENV === 'development') {
        console.error('Server Stack Trace:', error.response.data.stack);
      }
    } else {
      userMessage += `${error.response.status} ${error.response.statusText}`;
    }
  }

  console.error(`%c[PhaseContent] ${errorType}:`, consoleStyles.error, userMessage);
  throw new Error(userMessage);
};

const handleAdjustment = async (
  model: string,
  systemPrompt: string,
  content: string,
  keyFindings: string[],
  phaseName: string,
  phaseDescription: string,
  adjustmentPrompt: string
) => {
  const requestData = {
    model,
    system_prompt: systemPrompt,
    context: {
      original_content: content,
      key_findings: keyFindings,
      phase_name: phaseName,
      phase_description: phaseDescription,
      user_adjustment: adjustmentPrompt
    }
  };

  logPhaseEvent('Starting Adjustment', {
    phaseName,
    model,
    contentLength: content.length,
    keyFindingsCount: keyFindings.length,
    adjustmentPromptLength: adjustmentPrompt.length
  });

  try {
    const startTime = Date.now();
    const response = await api.post('/api/vyve/adjust-analysis', requestData);
    const duration = Date.now() - startTime;

    logPhaseEvent('Adjustment Completed', {
      duration: `${duration}ms`,
      responseLength: response.data.content.length,
      keyFindingsCount: response.data.key_findings.length,
      usage: response.data.usage,
      requestId: response.data.requestId
    });

    return response.data;
  } catch (error) {
    handleAdjustmentError(error as AxiosError);
  }
};

// Export the logging utilities for use in other components
export const PhaseLogging = {
  logEvent: logPhaseEvent,
  logError: logPhaseError,
  styles: consoleStyles
}; 