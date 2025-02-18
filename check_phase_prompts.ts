import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPhasePrompts() {
  try {
    console.log('\nChecking phase_prompts table structure:');
    const { data: tableInfo, error: tableError } = await supabase
      .from('phase_prompts')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('Error accessing phase_prompts table:', tableError);
      if (tableError.code === 'PGRST204') {
        console.error('Table does not exist or no permissions');
      }
      return;
    }

    console.log('Successfully accessed phase_prompts table');
    console.log('Table structure:', tableInfo);

    // Check RLS policies
    console.log('\nChecking RLS policies...');
    const { data: policies, error: policyError } = await supabase
      .rpc('get_policies', { table_name: 'phase_prompts' });

    if (policyError) {
      console.error('Error checking policies:', policyError);
      return;
    }

    console.log('Policies:', policies);

    // Try to fetch all prompts
    console.log('\nFetching all prompts:');
    const { data: prompts, error: promptsError } = await supabase
      .from('phase_prompts')
      .select('*')
      .order('phase_number')
      .order('sub_phase');

    if (promptsError) {
      console.error('Error fetching prompts:', promptsError);
      return;
    }

    console.log(`Found ${prompts.length} prompts:`, prompts);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkPhasePrompts(); 