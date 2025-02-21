export interface AppConfig {
  name: string;
  supabase: {
    url: string;
    anonKey: string;
    functionsUrl: string;
  };
  pinecone: {
    apiKey: string;
    environment: string;
    indexName: string;
  };
  theme: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export type AppName = 'vyve' | 'denominator';

export interface ConfigContextType {
  currentApp: AppName;
  config: AppConfig;
  switchApp: (app: AppName) => void;
} 