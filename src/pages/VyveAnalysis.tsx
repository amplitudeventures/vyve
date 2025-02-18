import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Settings, AlertCircle, ChevronRight, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PhaseNavigation } from "@/components/analysis/PhaseNavigation";
import { PhaseContent } from "@/components/analysis/phases/PhaseContent";
import { useVyveAnalysis } from "@/hooks/useVyveAnalysis";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { PhasePrompt, AnalysisResult } from "@/types/vyve";

interface VyveAnalysisState {
  currentPhase: number;
  currentSubPhase: number;
  isLoading: boolean;
  error: string | null;
  phasePrompts: PhasePrompt[];
  analysisResults: AnalysisResult[];
}

const VyveAnalysis = () => {
  const [state, setState] = useState<VyveAnalysisState>({
    currentPhase: 0,
    currentSubPhase: 0,
    isLoading: true,
    error: null,
    phasePrompts: [],
    analysisResults: []
  });

  const { currentPhase, currentSubPhase, isLoading, error, phasePrompts, analysisResults } = state;

  const navigate = useNavigate();
  const { toast } = useToast();
  const { phases, loading, error: analysisError, loadPhaseData, startPhaseAnalysis, setPhases, clearAllPhases } = useVyveAnalysis();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        
        console.log('Fetching initial phase data...');
        
        // Fetch phase prompts
        const { data: promptData, error: promptError } = await supabase
          .from('phase_prompts')
          .select('*')
          .order('phase_number')
          .order('sub_phase');
        
        if (promptError) {
          console.error('Error fetching phase prompts:', promptError);
          throw promptError;
        }

        // Only log the count of prompts to avoid unnecessary processing
        console.log('Fetched phase prompts:', { count: promptData?.length || 0 });

        // Fetch only existing analysis results
        const { data: resultData, error: resultError } = await supabase
          .from('analysis_results')
          .select('*')
          .order('phase_number')
          .order('sub_phase');
        
        if (resultError) {
          console.error('Error fetching analysis results:', resultError);
          throw resultError;
        }

        // Only log the count of results to avoid unnecessary processing
        console.log('Fetched analysis results:', { count: resultData?.length || 0 });

        setState(prev => ({
          ...prev,
          phasePrompts: promptData || [],
          analysisResults: resultData || [],
          isLoading: false
        }));
      } catch (err) {
        console.error('Error in fetchData:', err);
        setState(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : 'An error occurred',
          isLoading: false
        }));
      }
    };

    fetchData();
  }, []);

  const handlePhaseChange = (phase: number, subPhase: number = 0) => {
    console.log('Changing phase to:', { phase, subPhase });
    setState(prev => ({ ...prev, currentPhase: phase, currentSubPhase: subPhase }));
  };

  const getCurrentPhasePrompt = () => {
    const prompt = phasePrompts.find(
      prompt => prompt.phase_number === currentPhase && prompt.sub_phase === currentSubPhase
    );
    console.log('Current phase prompt:', prompt);
    return prompt;
  };

  const getCurrentPhaseResult = () => {
    const result = analysisResults.find(
      result => result.phase_number === currentPhase && result.sub_phase === currentSubPhase
    );
    console.log('Current phase result:', result);
    return result;
  };

  // Helper function to determine phase status
  const getPhaseStatus = (result: any): 'pending' | 'in_progress' | 'completed' | 'error' => {
    if (!result || !result.metadata) return 'pending';
    if (result.metadata.status && ['pending', 'in_progress', 'completed', 'error'].includes(result.metadata.status)) {
      return result.metadata.status as 'pending' | 'in_progress' | 'completed' | 'error';
    }
    return 'pending';
  };

  // Render PhaseContent with correct initial status
  const renderPhaseContent = () => {
    const currentPrompt = getCurrentPhasePrompt();
    const currentResult = getCurrentPhaseResult();
    const status = getPhaseStatus(currentResult);

    console.log('Rendering phase content:', {
      phase: currentPhase,
      prompt: currentPrompt?.phase_name,
      status: status,
      hasResult: !!currentResult,
      resultMetadata: currentResult?.metadata
    });

    // Ensure we're not passing any result data if there's no actual analysis result
    const resultData = currentResult && currentResult.metadata?.status === 'in_progress' ? {
      phase_number: currentResult.phase_number,
      content: currentResult.content || currentResult.result || '',
      created_at: currentResult.created_at,
      metadata: {
        ...currentResult.metadata,
        status: status // Ensure status is consistent
      }
    } : null;

    return (
      <PhaseContent
        phaseData={{
          phase: currentPhase,
          name: currentPrompt?.phase_name || `Phase ${currentPhase}`,
          description: currentPrompt?.prompt?.split('\n\n')[0].replace(/^PHASE \d+:/, '').trim() || "No description available",
          status: status,
          prompt: currentPrompt,
          result: resultData,
          documents: [],
          error: currentResult?.metadata?.error || null
        }}
        onStart={handleStartAnalysis}
        onUpdate={(updatedPhaseData) => {
          // Only update if the status has actually changed
          if (updatedPhaseData.status !== status) {
            console.log('Updating phase data:', {
              phase: currentPhase,
              oldStatus: status,
              newStatus: updatedPhaseData.status
            });
            
            setState(prev => ({
              ...prev,
              analysisResults: prev.analysisResults.map(r =>
                r.phase_number === currentPhase
                  ? {
                      ...r,
                      content: updatedPhaseData.result?.content,
                      metadata: {
                        ...updatedPhaseData.result?.metadata,
                        status: updatedPhaseData.status
                      }
                    }
                  : r
              )
            }));
          }
        }}
      />
    );
  };

  // Handle start analysis
  const handleStartAnalysis = async (model: string) => {
    try {
      console.log('Starting analysis with model:', model);
      
      // Create initial analysis result with proper metadata
      const initialResult: AnalysisResult = {
        id: Date.now(), // Temporary ID until server assigns one
        phase_number: currentPhase,
        sub_phase: 0,
        content: '',
        result: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          status: 'in_progress',
          conversation_log: [
            {
              step: 'Initial Setup',
              status: 'in_progress',
              timestamp: new Date().toISOString(),
              details: { 
                type: 'setup', 
                model,
                description: 'Preparing analysis environment'
              }
            }
          ]
        }
      };

      // Update local state first
      setState(prev => ({
        ...prev,
        analysisResults: [
          ...prev.analysisResults.filter(r => r.phase_number !== currentPhase),
          initialResult
        ]
      }));

      // Start the analysis
      await startPhaseAnalysis(currentPhase, model);
      
      toast({
        title: "Analysis Started",
        description: `Phase ${currentPhase} analysis has been initiated.`,
      });
    } catch (err) {
      console.error('Error starting analysis:', err);
      
      // Update the phase status to error
      setState(prev => ({
        ...prev,
        analysisResults: prev.analysisResults.map(r =>
          r.phase_number === currentPhase
            ? {
                ...r,
                metadata: {
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Failed to start analysis'
                }
              }
            : r
        )
      }));

      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to start analysis",
        variant: "destructive",
      });
    }
  };

  // Handle restart
  const handleRestart = async () => {
    try {
      // First try to use the RPC function
      const { error: rpcError } = await supabase.rpc('clear_analysis_results');

      if (rpcError) {
        console.error('Error using RPC to clear analysis results:', rpcError);
        
        // Fallback: Delete all records with a WHERE clause that matches all records
        const { error: deleteError } = await supabase
          .from('analysis_results')
          .delete()
          .gte('phase_number', 0); // This ensures we delete all phases while satisfying the WHERE clause requirement

        if (deleteError) {
          console.error('Error clearing analysis results:', deleteError);
          throw deleteError;
        }
      }

      // Then clear local data
      await clearAllPhases();
      
      // Clear browser console
      console.clear();
      
      toast({
        title: "Analysis Reset",
        description: "All phase results have been cleared. Page will refresh...",
      });

      // Short delay to show the toast before reload
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error('Error clearing phases:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to reset analysis. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Enhanced Background Effects - Reduced brightness */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_25%)] animate-[spin_20s_linear_infinite]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(120,119,198,0.08),transparent_25%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(0,183,255,0.08),transparent_25%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
        
        {/* Additional decorative elements - Reduced opacity */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/0 via-purple-500/10 to-pink-500/0" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500/0 via-purple-500/10 to-blue-500/0" />
        <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-blue-500/0 via-purple-500/10 to-pink-500/0" />
        <div className="absolute right-0 top-0 w-1 h-full bg-gradient-to-b from-pink-500/0 via-purple-500/10 to-blue-500/0" />
      </div>

      {/* Main Content */}
      <div className="relative min-h-screen flex flex-col">
        {/* Enhanced Top Navigation Bar */}
        <div className="relative">
          {/* Top Gradient Line - Reduced opacity */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
          
          {/* Navigation Content */}
          <div className="relative backdrop-blur-md bg-background/40 border-b border-white/5">
            <div className="container mx-auto py-5 px-6 max-w-[95%] xl:max-w-[90%] 2xl:max-w-[85%]">
              <div className="flex items-center justify-between">
                {/* Left Side */}
                <div className="flex items-center gap-8">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/')}
                    className="relative group overflow-hidden rounded-lg border-white/10 hover:border-white/20 transition-colors"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-center gap-2">
                      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                      <span className="font-medium">Back to Home</span>
                    </div>
                  </Button>

                  <div className="flex items-center gap-4">
                    <div className="h-8 w-[1px] bg-gradient-to-b from-white/[0.01] via-white/5 to-white/[0.01]" />
                    <div className="flex items-center gap-4">
                      <div className="relative group">
                        <div className="absolute -inset-[1px] bg-gradient-to-r from-blue-500/40 via-purple-500/40 to-pink-500/40 rounded-xl opacity-50 blur group-hover:opacity-70 transition-opacity" />
                        <div className="relative w-11 h-11 rounded-xl bg-background/90 backdrop-blur-sm flex items-center justify-center">
                          <Sparkles className="h-5 w-5 text-blue-400/80 group-hover:text-blue-300 transition-colors" />
                        </div>
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400/90 via-purple-400/90 to-pink-400/90">
                          Vyve Analysis
                        </h1>
                        <p className="text-sm text-white/40">
                          Analyze and process your data
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side */}
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={handleRestart}
                    className="relative group overflow-hidden rounded-lg border-white/10 hover:border-white/20 transition-colors"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-orange-500/5 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 transition-transform group-hover:rotate-180" />
                      <span className="font-medium">Reset All Data</span>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/select-app')}
                    className="relative group overflow-hidden rounded-lg border-white/10 hover:border-white/20 transition-colors"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-pink-500/5 via-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-center gap-2">
                      <Settings className="h-4 w-4 transition-transform group-hover:rotate-90" />
                      <span className="font-medium">Switch App</span>
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5" />
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Shadow - Reduced opacity */}
          <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/3 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-b from-background/30 to-transparent pointer-events-none" />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 relative">
          <div className="container mx-auto py-8 px-6 max-w-[95%] xl:max-w-[90%] 2xl:max-w-[85%] space-y-8">
            {/* Main Content Card */}
            <Card className="card-glow-subtle glass">
              <CardContent className="p-8">
                <PhaseNavigation 
                  currentPhase={currentPhase}
                  currentSubPhase={currentSubPhase}
                  onPhaseChange={handlePhaseChange}
                />
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Spinner />
                  </div>
                ) : error ? (
                  <div className="text-red-500 text-center mt-8">{error}</div>
                ) : (
                  <div className="mt-8">
                    {renderPhaseContent()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VyveAnalysis; 