import { useState, useEffect } from 'react';
import { VyveService } from '@/services/vyveService';
import { PhaseConfig } from '@/types/vyve';
import { PHASE_NAMES, PHASE_DESCRIPTIONS } from '@/config/phaseConfig';
import { localDb } from '@/services/localDbService';

export function useVyveAnalysis() {
  const [phases, setPhases] = useState<PhaseConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize phases
  useEffect(() => {
    const initializePhases = async () => {
      // Try to load saved phases from IndexedDB
      const savedPhases = await localDb.getAllPhaseResults();
      
      // Create initial phases array
      const initialPhases: PhaseConfig[] = Array.from({ length: 8 }, (_, i) => {
        // Check if we have a saved phase
        const savedPhase = savedPhases.find(p => p.phase === i);
        if (savedPhase) {
          return savedPhase;
        }
        // Otherwise return default phase
        return {
          phase: i,
          name: PHASE_NAMES[i],
          description: PHASE_DESCRIPTIONS[i],
          status: 'pending'
        };
      });
      
      setPhases(initialPhases);
    };

    initializePhases();
  }, []);

  // Load phase data
  const loadPhaseData = async (phase: number) => {
    try {
      // First check if we have this phase in local storage
      const savedPhase = await localDb.getPhaseResult(phase);
      if (savedPhase && savedPhase.status === 'completed') {
        setPhases(prevPhases => 
          prevPhases.map(p => 
            p.phase === phase ? savedPhase : p
          )
        );
        return;
      }

      setLoading(true);
      setError(null);

      const { prompt, documents } = await VyveService.getPhaseData(phase);
      
      const updatedPhase = {
        phase,
        name: PHASE_NAMES[phase],
        description: PHASE_DESCRIPTIONS[phase],
        status: 'pending' as const,
        prompt,
        documents
      };

      // Save to local storage
      await localDb.savePhaseResult(updatedPhase);
      
      setPhases(prevPhases => 
        prevPhases.map(p => 
          p.phase === phase ? updatedPhase : p
        )
      );
    } catch (err) {
      console.error('Error loading phase data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load phase data');
      
      // Update phase with error status
      setPhases(prevPhases => 
        prevPhases.map(p => 
          p.phase === phase ? {
            ...p,
            status: 'error' as const,
            error: err instanceof Error ? err.message : 'Failed to load phase data'
          } : p
        )
      );
    } finally {
      setLoading(false);
    }
  };

  // Start phase analysis
  const startPhaseAnalysis = async (phase: number, model: string = 'deepseek-reasoner') => {
    try {
      setLoading(true);
      setError(null);

      // Update phase status to loading
      setPhases(prevPhases => 
        prevPhases.map(p => 
          p.phase === phase ? {
            ...p,
            status: 'in_progress' as const,
            error: null,
            result: {
              ...p.result,
              metadata: {
                status: 'in_progress',
                conversation_log: [
                  {
                    step: 'Initial Document Retrieval',
                    status: 'in_progress',
                    content: '',
                    timestamp: new Date().toISOString(),
                    details: { type: 'pinecone_query' }
                  }
                ]
              }
            }
          } : p
        )
      );

      const result = await VyveService.startPhaseAnalysis(phase, model);
      
      // Update phase with completed status and content
      setPhases(prevPhases => 
        prevPhases.map(p => 
          p.phase === phase ? {
            ...p,
            status: 'completed' as const,
            error: null,
            result: {
              phase_number: phase,
              content: result.content,
              metadata: {
                ...result.metadata,
                status: 'completed',
                conversation_log: result.metadata.conversation_log.map(log => ({
                  ...log,
                  status: 'completed'
                }))
              }
            }
          } : p
        )
      );

      // Save completed phase to local storage
      await localDb.savePhaseResult({
        phase,
        name: PHASE_NAMES[phase],
        description: PHASE_DESCRIPTIONS[phase],
        status: 'completed',
        result: {
          phase_number: phase,
          content: result.content,
          metadata: result.metadata
        }
      });

      return result;
    } catch (err) {
      console.error('Error starting phase analysis:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start analysis';
      setError(errorMessage);
      
      // Update phase with error status
      setPhases(prevPhases => 
        prevPhases.map(p => 
          p.phase === phase ? {
            ...p,
            status: 'error' as const,
            error: errorMessage
          } : p
        )
      );
      
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Clear all phases
  const clearAllPhases = async () => {
    try {
      await localDb.clearAllPhases();
      const initialPhases: PhaseConfig[] = Array.from({ length: 8 }, (_, i) => ({
        phase: i,
        name: PHASE_NAMES[i],
        description: PHASE_DESCRIPTIONS[i],
        status: 'pending'
      }));
      setPhases(initialPhases);
    } catch (err) {
      console.error('Error clearing phases:', err);
      throw err;
    }
  };

  return {
    phases,
    loading,
    error,
    loadPhaseData,
    startPhaseAnalysis,
    clearAllPhases,
    setPhases
  };
} 