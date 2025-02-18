export interface Document {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
  url: string | null;
  is_website: boolean;
  file_path: string;
  should_process: boolean;
  content?: string;
  embedding_status?: string;
}

export interface StorageDocument {
  name: string;
  metadata: {
    mimetype: string;
    size: number;
  };
}

export interface ProcessingProgress {
  currentDocument?: string;
  current: number;
  total: number;
  vectorCount?: number;
}