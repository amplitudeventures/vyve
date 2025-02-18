export interface PhasePrompt {
  id: number;
  phase_number: number;
  sub_phase: number;
  phase_name: string;
  prompt: string;
  document_ids: number[];
  created_at?: string;
  updated_at?: string;
}

export interface MdDocument {
  id: number;
  filename: string;
  content: string;
  created_at?: string;
  updated_at?: string;
}

export interface ConversationLogEntry {
  step: string;
  content: string;
  timestamp: string;
  status?: 'in_progress' | 'completed' | 'error' | 'pending';
  details?: {
    [key: string]: any;
    type: string;
  };
}

export interface AnalysisMetadata {
  key_findings?: string[];
  recommendations?: string[];
  status?: string;
  step?: string;
  error?: string;
  conversation_log?: Array<ConversationLogEntry>;
  usage?: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
  };
  adjustments?: {
    timestamp: string;
    prompt: string;
    model: string;
  }[];
}

export interface AnalysisResult {
  id: number;
  phase_number: number;
  sub_phase: number;
  result: string;
  content?: string;
  metadata?: {
    status?: 'pending' | 'in_progress' | 'completed' | 'error';
    conversation_log?: Array<{
      step: string;
      status: 'pending' | 'in_progress' | 'completed' | 'error';
      timestamp: string;
      details?: Record<string, any>;
    }>;
    key_findings?: string[];
    error?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface PhaseConfig {
  phase: number;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  result?: any;
  prompt?: PhasePrompt;
  documents?: MdDocument[];
  error?: string;
} 