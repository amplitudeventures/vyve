import { denominatorClient, verifyTables } from './services/denominator-client';

export async function testQueries() {
  const testSession = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString()
  };

  console.log('Database Test Session Started:', testSession);

  // 1. Basic Connection Test
  try {
    const { data, error } = await denominatorClient.auth.getSession();
    console.log('Supabase Connection Status:', {
      connected: !error,
      hasSession: !!data?.session,
      error: error ? {
        message: error.message,
        status: error.status
      } : null,
      sessionId: testSession.id
    });
  } catch (e) {
    console.error('Connection Test Failed:', {
      error: e instanceof Error ? e.message : 'Unknown error',
      stack: e instanceof Error ? e.stack : undefined,
      sessionId: testSession.id
    });
  }

  // 2. Verify Tables
  try {
    console.log('\nVerifying Database Tables...');
    const availableTables = await verifyTables();
    
    if (availableTables.length === 0) {
      console.error('Some tables are missing:', {
        missing: ['Denominator questions', 'Denominator questions soft', 'Kristian questions'],
        details: availableTables,
        sessionId: testSession.id
      });
    } else {
      console.log('Available tables:', {
        tables: availableTables,
        sessionId: testSession.id
      });
    }
  } catch (e) {
    console.error('Table Verification Failed:', {
      error: e instanceof Error ? e.message : 'Unknown error',
      stack: e instanceof Error ? e.stack : undefined,
      sessionId: testSession.id
    });
  }

  console.log('\nDatabase Test Session Completed:', {
    ...testSession,
    duration: `${Date.now() - parseInt(testSession.id)}ms`
  });
}

// Only run the tests if this file is being executed directly
if (import.meta.url.endsWith('test-db.ts')) {
  testQueries().catch(error => {
    console.error('Test Suite Failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  });
} 