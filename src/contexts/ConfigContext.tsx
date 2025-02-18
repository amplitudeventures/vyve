import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppConfig, AppName, ConfigContextType } from '../config/configTypes';
import { reinitializeSupabaseClient } from '@/integrations/supabase/client';

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider = ({ children }: ConfigProviderProps) => {
  const [currentApp, setCurrentApp] = useState<AppName>(() => {
    const saved = localStorage.getItem('currentApp');
    return (saved as AppName) || 'denominator';
  });

  const [config, setConfig] = useState<AppConfig>(() => {
    // Initial config will be loaded based on environment variables
    return {
      name: currentApp,
      supabase: {
        url: import.meta.env.VITE_SUPABASE_URL || '',
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        functionsUrl: import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || '',
      },
      pinecone: {
        apiKey: import.meta.env.VITE_PINECONE_API_KEY || '',
        environment: import.meta.env.VITE_PINECONE_ENVIRONMENT || '',
        indexName: `${currentApp}-index`,
      },
      theme: {
        primary: currentApp === 'vyve' ? '#6366f1' : '#0ea5e9',
        secondary: currentApp === 'vyve' ? '#4f46e5' : '#0284c7',
        accent: currentApp === 'vyve' ? '#818cf8' : '#38bdf8',
      },
    };
  });

  const switchApp = (app: AppName) => {
    // First update the local storage
    localStorage.setItem('currentApp', app);

    // Load the correct environment file based on the app
    const envFile = `.env.${app}`;
    const envVars = import.meta.env;

    // Get the new Supabase configuration
    const newSupabaseUrl = envVars[`VITE_SUPABASE_URL`] || '';
    const newSupabaseAnonKey = envVars[`VITE_SUPABASE_ANON_KEY`] || '';
    const newSupabaseFunctionsUrl = envVars[`VITE_SUPABASE_FUNCTIONS_URL`] || '';

    try {
      // Reinitialize the Supabase client with new configuration
      reinitializeSupabaseClient(newSupabaseUrl, newSupabaseAnonKey);

      // Update the config state
      setConfig(prevConfig => ({
        ...prevConfig,
        name: app,
        supabase: {
          url: newSupabaseUrl,
          anonKey: newSupabaseAnonKey,
          functionsUrl: newSupabaseFunctionsUrl,
        },
        pinecone: {
          ...prevConfig.pinecone,
          indexName: `${app}-index`,
        },
        theme: {
          primary: app === 'vyve' ? '#6366f1' : '#0ea5e9',
          secondary: app === 'vyve' ? '#4f46e5' : '#0284c7',
          accent: app === 'vyve' ? '#818cf8' : '#38bdf8',
        },
      }));

      // Finally update the current app state
      setCurrentApp(app);
    } catch (error) {
      console.error('Error switching app:', error);
      // Revert local storage if there was an error
      localStorage.setItem('currentApp', currentApp);
    }
  };

  return (
    <ConfigContext.Provider value={{ currentApp, config, switchApp }}>
      {children}
    </ConfigContext.Provider>
  );
}; 