import { useState, useEffect } from "react";
import { denominatorClient, type Dataset, getTableName, initializeAuth } from "../services/denominator-client";
import { useToast } from "@/hooks/use-toast";

export type { Dataset };

interface Question {
  question_id: number;
  question_text: string;
  display_order?: number;
}

export interface Answer {
  question_id: number;
  questionText: string;
  answer?: string[];
  error?: string;
  status: 'pending' | 'loading' | 'completed' | 'error' | 'canceled' | 'diff';
  input_tokens?: number;
  output_tokens?: number;
}

// Type guard to validate fetched questions
function isValidQuestion(q: unknown): q is Question {
  return (
    typeof q === 'object' &&
    q !== null &&
    'question_id' in q &&
    typeof (q as any).question_id === 'number' &&
    'question_text' in q &&
    typeof (q as any).question_text === 'string'
  );
}

function isValidQuestions(questions: unknown): questions is Question[] {
  return Array.isArray(questions) && questions.every(isValidQuestion);
}

export function useAnalysis(dataset: Dataset = 'standard') {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Initialize auth first
        await initializeAuth();
        
        const table = getTableName(dataset);
        console.log(`[Analysis] Fetching data from table: ${table.name}`);
        
        const { data: fetchedQuestions, error: questionsError } = await denominatorClient
          .from(table.escaped)
          .select('*')
          .order('display_order', { ascending: true, nullsFirst: false });

        if (questionsError) {
          throw new Error(`Failed to fetch questions: ${questionsError.message}`);
        }

        if (!fetchedQuestions) {
          throw new Error('No questions data received');
        }

        if (!isValidQuestions(fetchedQuestions)) {
          throw new Error('Invalid questions data format received from server');
        }

        setQuestions(fetchedQuestions);
        // Transform questions into answers with the correct structure
        setAnswers(fetchedQuestions.map((q: Question) => ({ 
          question_id: q.question_id,
          questionText: q.question_text,
          answer: [],
          status: 'pending' as const
        })));
      } catch (err) {
        console.error('[Analysis] Error fetching data:', err);
        setError(err instanceof Error ? err : new Error('Unknown error occurred'));
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : 'Failed to fetch questions',
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dataset, toast]);

  const updateAnswer = (
    questionId: number, 
    answer: string[], 
    status: Answer['status'] = 'completed',
    input_tokens?: number,
    output_tokens?: number
  ) => {
    console.log(`[Analysis] Updating answer for question ${questionId}:`, {
      answer: answer,
      status,
      input_tokens,
      output_tokens
    });

    setAnswers(prev => {
      const newAnswers = [...prev];
      const index = newAnswers.findIndex(a => a.question_id === questionId);
      if (index !== -1) {
        // Preserve the existing answer object structure
        newAnswers[index] = { 
          ...newAnswers[index],  // Keep existing properties
          answer: answer|| newAnswers[index].answer || [],  // Keep existing answer if new one is empty
          status,
          input_tokens: input_tokens || newAnswers[index].input_tokens,
          output_tokens: output_tokens || newAnswers[index].output_tokens,
          error: status === 'error' ? answer.join() : undefined
        };
        console.log(`[Analysis] Updated answer at index ${index}:`, newAnswers[index]);
      } else {
        console.warn(`[Analysis] Could not find answer with question_id ${questionId}`);
      }
      return newAnswers;
    });
  };

  const saveAnalysisResults = async (companyId: string) => {
    try {
      setLoading(true);

      // Ensure we're authenticated before saving
      await initializeAuth();

      const validAnswers = answers.filter(a => a && Array.isArray(a.answer) && a.answer.some(ans => ans.trim() !== ''));
          
      if (validAnswers.length === 0) {
        throw new Error('No answers to save');
      }

      const results = validAnswers.map(answer => ({
        company_id: companyId,
        question_id: answer.question_id,
        answer: answer.answer,
        dataset_type: dataset
      }));

      const { error: saveError } = await denominatorClient
        .from('company_analysis_results')
        .upsert(results);

      if (saveError) {
        throw saveError;
      }

      toast({
        title: "Success",
        description: "Analysis results saved successfully",
      });

      return true;
    } catch (err) {
      console.error('[Analysis] Error saving results:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to save analysis results',
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    questions,
    answers,
    loading,
    error,
    progress,
    updateAnswer,
    saveAnalysisResults
  };
}
