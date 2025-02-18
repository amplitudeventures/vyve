const DEEPSEEK_API_KEY = 'sk-b489dfd755fa429cb0ce8f7911f81bdc';

// Simulated document content for testing
const SAMPLE_DOCUMENTS = [
  {
    content: "The company was founded in 2020 with a mission to revolutionize AI technology.",
    title: "Company History"
  },
  {
    content: "Our flagship product uses advanced machine learning algorithms to process natural language.",
    title: "Product Description"
  }
];

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function testDocumentChat(question: string) {
  try {
    console.log('Testing DeepSeek document chat...');
    
    // Create context from documents
    const context = SAMPLE_DOCUMENTS
      .map(doc => `[${doc.title}]: ${doc.content}`)
      .join('\n\n');
    
    // Create messages array with system prompt, context, and user question
    const messages: Message[] = [
      {
        role: "system",
        content: "You are a specialized assistant that analyzes documents to extract specific information. Base your answers only on the provided document context. If the information isn't in the context, say you don't have that information."
      },
      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion:\n${question}`
      }
    ];

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-reasoner",
        messages
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get response from DeepSeek');
    }

    const completion = await response.json();
    const answer = completion.choices[0]?.message?.content;
    console.log('\nQuestion:', question);
    console.log('DeepSeek Response:', answer);
    return answer;
  } catch (error) {
    console.error('Error testing DeepSeek document chat:', error);
    throw error;
  }
}

// Run test with sample questions
async function runTests() {
  const questions = [
    "When was the company founded?",
    "What technology does the product use?",
    "Who is the CEO?" // This should return that it doesn't have this information
  ];

  console.log('Starting document chat tests...\n');
  
  for (const question of questions) {
    try {
      await testDocumentChat(question);
      console.log('---\n');
    } catch (error) {
      console.error(`Test failed for question: ${question}`, error);
    }
  }
}

runTests()
  .then(() => console.log('All tests completed'))
  .catch(error => console.error('Tests failed:', error)); 