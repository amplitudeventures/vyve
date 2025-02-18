import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_FUNCTIONS_URL = process.env.VITE_SUPABASE_FUNCTIONS_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;

async function testDirectOpenAI() {
  console.log('\n=== Testing Direct OpenAI Calls ===\n');
  
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const tests = [
    {
      name: 'Simple user message',
      messages: [{ role: "user", content: "Say hello" }]
    },
    {
      name: 'System + User message (should fail)',
      messages: [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Say hello" }
      ]
    },
    {
      name: 'Combined message (our approach)',
      messages: [{ 
        role: "user", 
        content: "You are a specialized assistant that analyzes documents to extract specific information.\n\nContext: The board consists of 12 members, with 4 women serving as directors.\n\nQuestion: Please extract the percentage of women on the board (numeric value only) without the '%' sign)." 
      }]
    }
  ];

  for (const test of tests) {
    try {
      console.log(`\nTest: ${test.name}`);
      console.log('Request:', JSON.stringify(test.messages, null, 2));
      
      const completion = await client.chat.completions.create({
        messages: test.messages,
        model: "o1-mini",
        max_completion_tokens: 150
      });

      console.log('Success! Response:', completion.choices[0].message.content);
    } catch (error) {
      console.error('Error:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
    }
  }
}

async function testSupabaseFunction() {
  console.log('\n=== Testing Supabase Function ===\n');

  const tests = [
    {
      name: 'Simple question without context',
      data: {
        question: "What is 2+2?",
        model: "o1-mini"
      }
    },
    {
      name: 'Complex question with context',
      data: {
        question: "Please extract the percentage of women on the board (numeric value only) without the '%' sign).",
        model: "o1-mini"
      }
    }
  ];

  for (const test of tests) {
    try {
      console.log(`\nTest: ${test.name}`);
      console.log('Request:', JSON.stringify(test.data, null, 2));

      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/openai`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(test.data)
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(JSON.stringify(result, null, 2));
      }

      console.log('Success! Response:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

async function main() {
  console.log('Starting OpenAI integration tests...');
  console.log('Using model: o1-mini');
  console.log('API Key present:', !!OPENAI_API_KEY);
  console.log('Supabase URL:', SUPABASE_FUNCTIONS_URL);
  
  try {
    await testDirectOpenAI();
    await testSupabaseFunction();
  } catch (error) {
    console.error('Test suite failed:', error);
  }
}

main(); 