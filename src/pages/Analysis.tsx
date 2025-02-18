import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, BarChart, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { CompanyForm } from "@/components/analysis/CompanyForm";
import { QuestionList } from "@/components/analysis/QuestionList";
import { useAnalysis, type Dataset } from "@/hooks/useAnalysis";
import type { Answer } from "@/hooks/useAnalysis";
import { toast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { testQueries } from '../test-db.ts';
import { DatabaseTest } from '@/components/DatabaseTest';
import { verifyTables } from '@/services/denominator-client';

const SUPABASE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ANALYSIS_API_URL = 'http://localhost:8000';

const Analysis = () => {
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<Dataset>('kristian');
  const [selectedModel, setSelectedModel] = useState<string>('o3-mini');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [shouldStopAnalysis, setShouldStopAnalysis] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  const {
    answers,
    loading: dataLoading,
    error,
    updateAnswer,
    saveAnalysisResults
  } = useAnalysis(selectedDataset);

  useEffect(() => {
    // Run the test queries in development only
    if (import.meta.env.DEV) {
      testQueries().then(() => {
        console.log('Database tests completed');
      }).catch(console.error);
    }
  }, []); // Run once on mount

  const stopAnalysis = () => {
    if (abortController) {
      abortController.abort(); // This will immediately cancel all ongoing fetch requests
    }
    setShouldStopAnalysis(true);
    setIsAnalyzing(false);
    setAnalysisProgress(0);
    setCompanyId(null); // Reset company ID to allow new selection
    
    // Call the cancel_analysis endpoint
    fetch(`http://localhost:8000/cancel_analysis/${selectedDataset}`, {
      method: 'POST',
    })
    .then(response => response.json())
    .then(data => {
      console.log('Analysis cancelled:', data);
      // Reset all loading questions to canceled
      answers.forEach(answer => {
        if (answer.status === 'loading') {
          updateAnswer(answer.question_id, [], 'canceled');
        }
      });
      toast({
        title: "Analysis Stopped",
        description: "Analysis has been stopped immediately.",
      });
    })
    .catch(error => {
      console.error('Error cancelling analysis:', error);
      toast({
        title: "Error",
        description: "Failed to stop analysis completely. Some tasks may still be running.",
        variant: "destructive"
      });
    });
  };

  const analyzeQuestions = async (newCompanyId: string) => {
    if (isAnalyzing) return;

    const startTime = Date.now();
    console.log('Starting analysis for company:', newCompanyId, {
      totalQuestions: answers.length,
      selectedModel,
      selectedDataset
    });
    
    const controller = new AbortController();
    setAbortController(controller);
    
    setCompanyId(newCompanyId);
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setShouldStopAnalysis(false);

    try {
      const totalQuestions = answers.length;
      let completedQuestions = 0;
      const errors: Array<{ question_id: number, error: string, timestamp: string }> = [];
      
      console.log(`Starting all ${totalQuestions} questions simultaneously at ${new Date().toISOString()}`);
      
      // Pre-mark all questions as loading
      answers.forEach(answer => {
        updateAnswer(answer.question_id, [], 'loading');
        console.log(`[Analysis] Marked question ${answer.question_id} as loading`);
      });

      // Create request promises with improved error handling and retries
      const createRequest = async (answer: Answer, attempt = 1, maxRetries = 2) => {
        const requestController = new AbortController();
        controller.signal.addEventListener('abort', () => requestController.abort());
        
        const startTime = Date.now();
        console.log(`[Analysis] Question ${answer.question_id} - Starting request (attempt ${attempt})`);

        try {
          const [response, response2] = await Promise.all([fetch(`${ANALYSIS_API_URL}/analysis`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              question: answer.questionText,
              company_name: newCompanyId,
              isVerify: true,
            }),
          }), fetch(`${ANALYSIS_API_URL}/analysis`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              question: answer.questionText,
              company_name: newCompanyId,
              isVerify: false,
            }),
          })]) ;

          if (!response.ok || !response2.ok) {
            const errorText = await response.text();
            let errorMessage;
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.error || errorJson.detail || 'Failed to analyze question';
            } catch {
              errorMessage = errorText || `HTTP error! status: ${response.status}`;
            }
            throw new Error(errorMessage);
          }

          const data = await response.json();
          const data2 = await response2.json();
          const processingTime = Date.now() - startTime;
          console.log(`[Analysis] Question ${answer.question_id} - Completed in ${processingTime}ms`);
          console.log('verify true result: ', data2);
          
          if (data.status === 'error') {
            updateAnswer(answer.question_id, data.error || 'Unknown error', 'error');
            throw new Error(data.error || 'Unknown error');
          }
          
          // Ensure we have a valid answer
          if (!data.answer && data.answer !== '') {
            console.warn(`[Analysis] No answer received for question ${answer.question_id}`);
            updateAnswer(
              answer.question_id,
              ['No answer received'],
              'error'
            );
            return { success: false, questionId: answer.question_id, error: 'No answer received' };
          }
          
          updateAnswer(
            answer.question_id,
            [data.answer, data2.answer],
            data.answer != data2.answer ? 'diff' : 'completed',
            data.input_tokens,
            data.output_tokens
          );
          
          completedQuestions++;
          setAnalysisProgress((completedQuestions / totalQuestions) * 100);
          
          return { success: true, questionId: answer.question_id, data };
        } catch (error) {
          if (error instanceof Error) {
            console.error(`[Analysis] Question ${answer.question_id} - Error (attempt ${attempt}):`, error);
            
            if (error.name === 'AbortError') {
              updateAnswer(answer.question_id, [], 'canceled');
              return { success: false, questionId: answer.question_id, error: 'canceled' };
            }
            
            // Retry on network errors if we haven't exceeded max retries
            if (attempt < maxRetries && (error.name === 'TypeError' || error.message.includes('network'))) {
              console.log(`[Analysis] Question ${answer.question_id} - Retrying... (${attempt}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
              return createRequest(answer, attempt + 1, maxRetries);
            }
            
            errors.push({
              question_id: answer.question_id,
              error: error.message,
              timestamp: new Date().toISOString()
            });
            
            updateAnswer(answer.question_id, [error.message], 'error');
            return { success: false, questionId: answer.question_id, error: error.message };
          }
          throw error;
        }
      };

      // Process all requests in parallel with improved concurrency control
      const batchSize = 5; // Process 5 requests at a time to avoid overwhelming the server
      const allAnswers = [...answers];
      const results = [];
      
      while (allAnswers.length > 0 && !shouldStopAnalysis) {
        const batch = allAnswers.splice(0, batchSize);
        const batchPromises = batch.map(answer => createRequest(answer));
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);
      }

      console.log('All requests completed:', results.length);
      if (errors.length > 0) {
        console.error('Analysis completed with errors:', {
          totalErrors: errors.length,
          errors
        });
        
        // Show toast with error summary
        toast({
          title: `Analysis Completed with ${errors.length} Errors`,
          description: `${errors.length} questions failed to process. Check console for details.`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Analysis Completed",
          description: `Successfully processed ${totalQuestions} questions.`,
        });
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
      setShouldStopAnalysis(false);
      setAbortController(null);
    }
  };

  const handleDatasetChange = (value: Dataset) => {
    if (!dataLoading) {
      setSelectedDataset(value);
      setCompanyId(null);
    }
  };

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Sparkles className="h-8 w-8 animate-spin" />
          <p>Loading questions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-red-500">Error: {error.message}</p>
          <Button onClick={() => navigate('/')}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <DatabaseTest />
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_25%)] animate-[spin_20s_linear_infinite]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(120,119,198,0.15),transparent_25%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(0,183,255,0.15),transparent_25%)]"></div>
      </div>

      <div className="container mx-auto py-8 px-6 max-w-[95%] xl:max-w-[90%] 2xl:max-w-[85%] space-y-8 relative">
        <div className="flex flex-col space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="bg-background/50 hover:bg-background/30 transition-all duration-300 flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
              <div className="hidden sm:block h-8 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <BarChart className="h-5 w-5 text-blue-400" />
                <h1 className="text-2xl font-semibold gradient-text">Analysis Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Select
                value={selectedDataset}
                onValueChange={handleDatasetChange}
                disabled={dataLoading || !!companyId}
              >
                <SelectTrigger className="bg-background/50 hover:bg-background/30 transition-all duration-300 w-[180px] border-white/10">
                  <SelectValue placeholder="Select dataset" />
                </SelectTrigger>
                <SelectContent className="dark bg-background/80 backdrop-blur-lg border-white/10">
                  <SelectItem value="standard">Standard Questions</SelectItem>
                  <SelectItem value="soft">Soft Questions</SelectItem>
                  <SelectItem value="kristian">Kristian's Questions</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={dataLoading || !!companyId}
              >
                <SelectTrigger className="bg-background/50 hover:bg-background/30 transition-all duration-300 w-[180px] border-white/10">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent className="dark bg-background/80 backdrop-blur-lg border-white/10">
                  <SelectItem value="deepseek-reasoner">DeepSeek Reasoner</SelectItem>
                  <SelectItem value="o3-mini">o3 Mini</SelectItem>
                </SelectContent>
              </Select>
              {isAnalyzing && (
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-400 animate-pulse" />
                    Analyzing: {Math.round(analysisProgress)}%
                  </div>
                  <Progress value={analysisProgress} className="w-[200px] bg-white/5" />
                </div>
              )}
            </div>
          </div>

          <Card className="border-white/10">
            <div className="p-6">
              <CompanyForm 
                onCompanyCreated={analyzeQuestions}
                disabled={false}
                isAnalyzing={isAnalyzing}
                onStopAnalysis={stopAnalysis}
              />
            </div>
          </Card>

          <Card className="border-white/10">
            <div className="p-6">
              <QuestionList answers={answers} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Analysis;
