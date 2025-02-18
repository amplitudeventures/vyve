import { createClient } from '@supabase/supabase-js';

export type Dataset = 'standard' | 'soft' | 'kristian';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create a single instance of the Supabase client with global headers
const denominatorClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'denominator-auth-token'
  },
  global: {
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'apikey': supabaseAnonKey
    }
  }
});

// Initialize auth state
export async function initializeAuth() {
  try {
    const { data: { session }, error } = await denominatorClient.auth.getSession();
    if (error) {
      console.error('[Denominator] Session error:', error);
      return null;
    }
    
    if (!session) {
      console.log('[Denominator] No session, using anon key');
    }
    
    return session;
  } catch (err) {
    console.error('[Denominator] Auth error:', err);
    return null;
  }
}

export type TableInfo = {
  name: string;  // Display name
  escaped: string;  // Table name in database
};

export function getTableName(dataset: Dataset): TableInfo {
  switch (dataset) {
    case 'standard':
      return {
        name: 'Denominator questions',
        escaped: 'Denominator questions'  // Use exact table name from database
      };
    case 'soft':
      return {
        name: 'Denominator questions soft',
        escaped: 'Denominator questions soft'  // Use exact table name from database
      };
    case 'kristian':
      return {
        name: 'Kristian questions',
        escaped: 'Kristian questions'  // Use exact table name from database
      };
    default:
      throw new Error(`Unknown dataset: ${dataset}`);
  }
}

export async function verifyTables(): Promise<string[]> {
  const tables = [
    getTableName('standard'),
    getTableName('soft'),
    getTableName('kristian')
  ];

  const availableTables: string[] = [];
  const errors: string[] = [];

  // Ensure we have auth initialized
  await initializeAuth();

  for (const table of tables) {
    try {
      console.log(`[Denominator] Checking table ${table.name}...`);
      
      const { data, error: tableError } = await denominatorClient
        .from(table.escaped)
        .select('*')
        .limit(1);

      if (tableError) {
        console.error(`[Denominator] Error verifying table ${table.name}:`, tableError);
        errors.push(table.name);
        continue;
      }

      console.log(`[Denominator] Table ${table.name} exists`);
      availableTables.push(table.name);
    } catch (error) {
      console.error(`[Denominator] Error verifying table ${table.name}:`, error);
      errors.push(table.name);
    }
  }

  if (errors.length > 0) {
    console.error('[Denominator] Failed to verify tables:', errors.join(', '));
  }

  return availableTables;
}

export { denominatorClient }; 