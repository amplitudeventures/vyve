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

async function checkTables() {
  // Insert test prompts
  console.log('\nInserting test prompts:');
  const testPrompts = [
    {
      phase_number: 0,
      sub_phase: 0,
      phase_name: 'Initial Analysis',
      prompt: 'Analyze the document for key sustainability themes and metrics.',
      document_ids: ['doc1', 'doc2']
    },
    {
      phase_number: 0,
      sub_phase: 1,
      phase_name: 'Framework Identification',
      prompt: 'Identify the key frameworks and methodologies used for sustainability reporting.',
      document_ids: ['doc1', 'doc3']
    },
    {
      phase_number: 2,
      sub_phase: 1,
      phase_name: 'Implementation Strategy',
      prompt: 'Outline the implementation strategy for sustainability initiatives.',
      document_ids: ['doc2', 'doc3']
    }
  ];

  for (const prompt of testPrompts) {
    const { error: insertError } = await supabase
      .from('phase_prompts')
      .insert(prompt);
    
    if (insertError) {
      console.error(`Error inserting prompt for phase ${prompt.phase_number}.${prompt.sub_phase}:`, insertError);
    } else {
      console.log(`Successfully inserted prompt for phase ${prompt.phase_number}.${prompt.sub_phase}`);
    }
  }

  // Check phase_prompts table
  console.log('\nChecking phase_prompts table:');
  const { data: phasePrompts, error: phasePromptsError } = await supabase
    .from('phase_prompts')
    .select('*')
    .order('phase_number')
    .order('sub_phase');

  if (phasePromptsError) {
    console.error('Error fetching phase prompts:', phasePromptsError);
  } else {
    console.log('Phase prompts:', JSON.stringify(phasePrompts, null, 2));
  }

  // Check analysis_results table
  console.log('\nChecking analysis_results table...');
  const { data: analysisResults, error: analysisError } = await supabase
    .from('analysis_results')
    .select('*')
    .order('phase_number', { ascending: true })
    .order('sub_phase', { ascending: true });

  if (analysisError) {
    console.error('Error fetching analysis results:', analysisError);
  } else {
    console.log('Analysis Results:', JSON.stringify(analysisResults, null, 2));
  }
}

checkTables().catch(console.error); 