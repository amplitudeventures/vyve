import { useState } from 'react';
import { testQueries } from '../test-db';
import { Button } from './ui/button';

export function DatabaseTest() {
  const [isRunning, setIsRunning] = useState(false);

  const runTest = async () => {
    try {
      setIsRunning(true);
      await testQueries();
    } catch (error) {
      console.error('Test execution failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-4">
      <Button 
        onClick={runTest} 
        disabled={isRunning}
        variant={isRunning ? "secondary" : "default"}
      >
        {isRunning ? 'Running Tests...' : 'Run Database Tests'}
      </Button>
    </div>
  );
} 