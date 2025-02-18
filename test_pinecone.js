import { Pinecone } from '@pinecone-database/pinecone';

async function testPineconeConnection() {
  try {
    console.log('🔍 Testing Pinecone Connection...');
    
    // Get environment variables
    const apiKey = process.env.PINECONE_API_KEY;
    const environment = process.env.PINECONE_ENVIRONMENT;
    const indexName = process.env.PINECONE_INDEX_NAME;

    // Check if environment variables are set
    console.log('\n📋 Environment Variables Check:');
    console.log(`API Key exists: ${!!apiKey}`);
    console.log(`Environment exists: ${!!environment}`);
    console.log(`Index name exists: ${!!indexName}`);

    if (!apiKey || !environment || !indexName) {
      throw new Error('Missing required environment variables');
    }

    // Initialize Pinecone
    console.log('\n🔌 Initializing Pinecone...');
    const pinecone = new Pinecone({
      apiKey,
      environment,
    });

    // Try to access the index
    console.log('\n📊 Accessing index...');
    const index = pinecone.index(indexName);
    
    // Get index stats
    console.log('\n📈 Getting index stats...');
    const stats = await index.describeIndexStats();
    
    console.log('\n✅ Connection successful!');
    console.log('Index stats:', JSON.stringify(stats, null, 2));

  } catch (error) {
    console.error('\n❌ Error testing Pinecone connection:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
}

// Run the test
console.log('🚀 Starting Pinecone connection test...\n');
await testPineconeConnection(); 