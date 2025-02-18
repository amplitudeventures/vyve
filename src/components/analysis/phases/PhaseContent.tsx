import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlayCircle, FileText, CheckCircle, AlertCircle, Code, Sparkles, MessageSquare, RefreshCw } from "lucide-react";
import { PhaseConfig, PhasePrompt, AnalysisResult } from "@/types/vyve";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";

interface PhaseContentProps {
  phaseData: PhaseConfig;
  onStart: (model: string) => void;
  onUpdate?: (updatedPhaseData: PhaseConfig) => void;
}

const ADJUSTMENT_SYSTEM_PROMPT = `You are an AI assistant helping to refine and adjust the analysis results based on user feedback.
Your task is to maintain the context and knowledge from the original analysis while incorporating the user's specific requests for adjustments.

Guidelines:
- Preserve the key insights and findings from the original analysis
- Focus on the specific areas the user wants to elaborate on or modify
- Maintain the same level of expertise and analytical depth
- Keep the style consistent with the original analysis
- Include any new perspectives or angles requested by the user
- If the user asks for more examples or elaboration, provide them while maintaining relevance
- Ensure the adjusted response flows naturally and doesn't feel disconnected from the original analysis

The response should feel like a natural evolution of the original analysis, not a separate or disconnected piece.`;

// Update the DEFAULT_ANALYSIS_STEPS to be more detailed
const DEFAULT_ANALYSIS_STEPS = [
  { 
    step: 'Initial Setup',
    description: 'Preparing analysis environment',
    status: 'pending',
    timestamp: new Date().toISOString(),
    order: 0
  },
  { 
    step: 'Document Retrieval',
    description: 'Loading and processing documents',
    status: 'pending',
    timestamp: new Date().toISOString(),
    order: 1
  },
  { 
    step: 'Pinecone Query',
    description: 'Finding relevant document sections',
    status: 'pending',
    timestamp: new Date().toISOString(),
    order: 2
  },
  { 
    step: 'Framework Analysis',
    description: 'Analyzing content structure',
    status: 'pending',
    timestamp: new Date().toISOString(),
    order: 3
  },
  { 
    step: 'OpenAI Analysis',
    description: 'Generating detailed insights',
    status: 'pending',
    timestamp: new Date().toISOString(),
    order: 4
  },
  { 
    step: 'Format Verification',
    description: 'Validating analysis format',
    status: 'pending',
    timestamp: new Date().toISOString(),
    order: 5
  },
  { 
    step: 'Final Verification',
    description: 'Checking analysis quality',
    status: 'pending',
    timestamp: new Date().toISOString(),
    order: 6
  },
  { 
    step: 'Saving Results',
    description: 'Storing analysis results',
    status: 'pending',
    timestamp: new Date().toISOString(),
    order: 7
  }
];

function parsePrompt(promptText: string) {
  const sections = promptText.split('\n\n');
  let objective = '';
  let requiredInput = '';
  let tasks = '';
  let outputFormat = '';

  for (const section of sections) {
    if (section.includes('OBJECTIVE:')) {
      objective = section.replace('OBJECTIVE:', '').trim();
    } else if (section.includes('REQUIRED INPUT:')) {
      requiredInput = section.replace('REQUIRED INPUT:', '').trim();
    } else if (section.includes('TASK:') || section.includes('TASKS:')) {
      tasks = section.replace(/TASKS?:/, '').trim();
    } else if (section.includes('OUTPUT FORMAT:')) {
      outputFormat = section.replace('OUTPUT FORMAT:', '').trim();
    }
  }

  return {
    objective,
    requiredInput,
    tasks,
    outputFormat
  };
}

// Define the status type explicitly
type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'error';

export function PhaseContent({ phaseData, onStart, onUpdate }: PhaseContentProps) {
  // Initialize with default values if phaseData is not provided
  const defaultPhaseData = {
    name: '',
    description: '',
    status: 'pending' as PhaseStatus,
    documents: [],
    error: null,
    result: null,
    prompt: undefined,
    phase: 0
  };

  console.log('Raw phaseData:', phaseData);

  // Create the merged data object
  const currentPhaseData = phaseData || defaultPhaseData;

  // Extract name and description
  const displayName = currentPhaseData.prompt?.phase_name || currentPhaseData.name || 'Untitled Phase';
  const displayDescription = currentPhaseData.description || 
    (currentPhaseData.prompt?.prompt ? 
      currentPhaseData.prompt.prompt.split('\n\n')[0].replace(/^PHASE \d+:/, '').trim() : 
      'No description available'
    );

  console.log('Display values:', { displayName, displayDescription });

  const {
    prompt,
    documents = [],
    status,
    error = null,
    result = null
  } = currentPhaseData;
  
  console.log('PhaseContent rendered with data:', {
    name: displayName,
    description: displayDescription,
    hasPrompt: !!prompt,
    promptDetails: prompt ? {
      phase_number: prompt.phase_number,
      sub_phase: prompt.sub_phase,
      phase_name: prompt.phase_name,
      promptText: prompt.prompt
    } : null,
    documentsCount: documents?.length,
    status,
    hasError: !!error,
    hasResult: !!result
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('selectedModel') || 'deepseek-reasoner';
  });
  const [adjustmentText, setAdjustmentText] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Add proper null check for result
  const hasContent = result?.content && result.content.length > 0;

  // Simplify the parsedPrompt logic
  const parsedPrompt = prompt?.prompt ? parsePrompt(prompt.prompt) : null;

  // Only poll for updates when status is in_progress
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let isPolling = false;
    
    // Only start polling if status is explicitly in_progress and we have a valid phase
    if (status === 'in_progress' && currentPhaseData.phase >= 0 && currentPhaseData.result?.metadata?.status === 'in_progress') {
      console.log('Starting polling for phase:', {
        phase: currentPhaseData.phase,
        status,
        metadata: currentPhaseData.result?.metadata
      });
      
      pollInterval = setInterval(async () => {
        if (isPolling) {
          console.log('Already polling, skipping this interval');
          return;
        }
        
        try {
          isPolling = true;
          
          const { data, error } = await supabase
            .from('analysis_results')
            .select('*')
            .eq('phase_number', currentPhaseData.phase)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (error) {
            console.error('Error polling for updates:', error);
            return;
          }

          const latestResult = data?.[0];
          if (!latestResult) {
            console.log('No results found for phase:', currentPhaseData.phase);
            return;
          }

          // Only update if the status has changed
          if (latestResult.metadata?.status !== status) {
            console.log('Status changed:', { 
              phase: currentPhaseData.phase,
              from: status, 
              to: latestResult.metadata?.status,
              hasContent: !!latestResult.content
            });

            // Update phase data with current progress
            const updatedPhaseData = {
              ...currentPhaseData,
              status: latestResult.metadata?.status === 'completed' ? 'completed' as const : 'in_progress' as const,
              result: {
                phase_number: latestResult.phase_number,
                content: latestResult.content || '',
                created_at: latestResult.created_at,
                metadata: {
                  ...latestResult.metadata,
                  lastUpdate: new Date().toISOString()
                }
              }
            };

            onUpdate?.(updatedPhaseData);
          }

          // Clear interval if complete or error
          if (latestResult.metadata?.status === 'completed' || latestResult.metadata?.status === 'error') {
            console.log('Stopping polling for phase:', currentPhaseData.phase, 'due to status:', latestResult.metadata?.status);
            clearInterval(pollInterval);
          }

        } catch (err) {
          console.error('Error polling for updates:', err);
        } finally {
          isPolling = false;
        }
      }, 1000);

      // Cleanup function
      return () => {
        if (pollInterval) {
          console.log('Cleaning up polling interval for phase:', currentPhaseData.phase);
          clearInterval(pollInterval);
        }
      };
    } else {
      console.log('Not starting polling:', {
        phase: currentPhaseData.phase,
        status,
        hasResult: !!currentPhaseData.result,
        resultStatus: currentPhaseData.result?.metadata?.status
      });
    }
  }, [status, currentPhaseData, onUpdate]);

  // Add useEffect for logging
  useEffect(() => {
    if (status === 'completed' && result?.content) {
      console.log('Analysis completed - Summary:', {
        phase: displayName,
        status,
        resultLength: result.content.length,
        hasMetadata: !!result.metadata,
        keyFindings: result.metadata?.key_findings?.length || 0,
        recommendations: result.metadata?.recommendations?.length || 0
      });
      
      // Log complete content separately
      console.log('Complete analysis content:');
      console.log(result.content);
      
      console.log('Complete metadata:');
      console.log(JSON.stringify(result.metadata, null, 2));
    }
  }, [status, result, displayName]);

  // Update localStorage when model changes
  const handleModelChange = (model: string) => {
    console.log('Model changed:', { from: selectedModel, to: model });
    setSelectedModel(model);
    localStorage.setItem('selectedModel', model);
  };

  // Update the status when adjusting
  useEffect(() => {
    if (isAdjusting && onUpdate) {
      onUpdate({
        ...currentPhaseData,
        status: 'in_progress',
        result: result ? {
          ...result,
          metadata: {
            ...result.metadata,
            status: 'in_progress',
            conversation_log: [
              ...(result.metadata?.conversation_log || []),
              {
                step: 'Applying Adjustments',
                status: 'in_progress',
                timestamp: new Date().toISOString(),
                details: {
                  model: selectedModel,
                  type: 'adjustment'
                }
              }
            ]
          }
        } : undefined
      });
    }
  }, [isAdjusting]);

  const handleAdjustment = async () => {
    if (!adjustmentText.trim() || !result?.content) {
      console.warn('[PhaseContent] Adjustment text is empty or no result content available');
      toast({
        title: "Cannot adjust analysis",
        description: "Please ensure there is analysis content to adjust and you've provided adjustment text.",
        variant: "destructive"
      });
      return;
    }

    setIsAdjusting(true);
    console.log('[PhaseContent] Starting adjustment process:', {
      phaseName: displayName,
      model: selectedModel,
      timestamp: new Date().toISOString()
    });

    try {
      const adjustmentContext = {
        original_content: result.content,
        key_findings: result.metadata?.key_findings || [],
        phase_name: displayName,
        phase_description: displayDescription,
        user_adjustment: adjustmentText
      };

      const response = await fetch('/api/vyve/adjust-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          system_prompt: ADJUSTMENT_SYSTEM_PROMPT,
          context: adjustmentContext,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to apply adjustments: ${response.status} ${response.statusText}`);
      }

      const adjustedResult = await response.json();

      // Update the phase data with the adjusted results
      if (result && onUpdate) {
        onUpdate({
          ...currentPhaseData,
          status: 'completed',
          result: {
            ...result,
            content: adjustedResult.content || result.content,
            metadata: {
              ...result.metadata,
              status: 'completed',
              adjustments: [
                ...(result.metadata?.adjustments || []),
                {
                  timestamp: new Date().toISOString(),
                  prompt: adjustmentText,
                  model: selectedModel
                }
              ],
              key_findings: adjustedResult.key_findings || result.metadata?.key_findings,
              conversation_log: [
                ...(result.metadata?.conversation_log || []),
                {
                  step: 'Applying Adjustments',
                  status: 'completed',
                  timestamp: new Date().toISOString(),
                  details: {
                    model: selectedModel,
                    type: 'adjustment',
                    contentLength: adjustedResult.content?.length,
                    findingsCount: adjustedResult.key_findings?.length
                  }
                }
              ]
            }
          }
        });
      }

      // Clear the adjustment text after successful application
      setAdjustmentText('');
      
      // Show success toast
      toast({
        title: "Adjustments Applied",
        description: "The analysis has been updated based on your feedback.",
      });

    } catch (err) {
      console.error('[PhaseContent] Error applying adjustments:', err);
      
      // Update status to error
      if (onUpdate) {
        onUpdate({
          ...currentPhaseData,
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to apply adjustments'
        });
      }

      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to apply adjustments. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAdjusting(false);
    }
  };

  // Update renderStatus to show more details
  const renderStatus = () => {
    if (status === 'completed' && result?.content) {
      return (
        <div className="mt-6 space-y-4">
          <div className="prose max-w-none dark:prose-invert">
            <pre className="whitespace-pre-wrap">{result.content}</pre>
          </div>
        </div>
      );
    }

    // Only show progress and steps if we have actual result data and status is in_progress
    if (status === 'in_progress' && currentPhaseData.result?.metadata?.status === 'in_progress') {
      // Only use steps from the actual result metadata, not default steps
      const steps = currentPhaseData.result.metadata.conversation_log || [];
      
      const totalSteps = steps.length;
      const completedSteps = steps.filter(log => log.status === 'completed').length;
      const inProgressSteps = steps.filter(log => log.status === 'in_progress').length;
      const progress = totalSteps > 0 ? ((completedSteps + (inProgressSteps * 0.5)) / totalSteps) * 100 : 0;

      // Only render if we have actual steps
      if (totalSteps === 0) return null;

      return (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress value={progress} className="h-2" />
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {completedSteps}/{totalSteps} steps
            </span>
          </div>
          
          <div className="space-y-2">
            {steps.map((log, index) => (
              <div key={index} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                <div className="w-5 flex-shrink-0">
                  {log.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {log.status === 'in_progress' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                  {log.status === 'pending' && <div className="h-4 w-4 rounded-full border border-muted" />}
                  {log.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {log.step}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {log.description}
                    </span>
                  </div>
                  {log.details && (
                    <div className="mt-1">
                      <span className="text-xs text-muted-foreground">
                        {Object.entries(log.details)
                          .filter(([key]) => !['type', 'error'].includes(key))
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                  {log.status === 'error' && log.details?.error && (
                    <p className="text-xs text-red-400 mt-1">
                      {log.details.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Update the render logic to handle null prompt
  const renderPromptContent = () => {
    if (!prompt || !parsedPrompt) return null;

    return (
      <Card className="glass-subtle">
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="prose prose-invert max-w-none">
              <div className="space-y-4">
                {parsedPrompt.objective && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Objective</h3>
                    <p className="text-white/70">{parsedPrompt.objective}</p>
                  </div>
                )}
                {parsedPrompt.requiredInput && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Required Input</h3>
                    <p className="text-white/70">{parsedPrompt.requiredInput}</p>
                  </div>
                )}
                {parsedPrompt.tasks && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Tasks</h3>
                    <p className="text-white/70">{parsedPrompt.tasks}</p>
                  </div>
                )}
                {parsedPrompt.outputFormat && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Output Format</h3>
                    <p className="text-white/70">{parsedPrompt.outputFormat}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Card className="mt-8 card-glow-subtle glass">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute -inset-[1px] bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-pink-500/30 rounded-xl opacity-50 blur group-hover:opacity-70 transition-opacity" />
            <div className="relative w-11 h-11 rounded-xl bg-background/90 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-blue-400/80 group-hover:text-blue-300 transition-colors" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400/80 via-purple-400/80 to-pink-400/80">
              {displayName}
            </CardTitle>
            <CardDescription className="text-lg text-white/40">
              {displayDescription}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Model Selection */}
        <div className="flex items-center gap-4">
          <Select
            value={selectedModel}
            onValueChange={handleModelChange}
            disabled={status === 'in_progress'}
          >
            <SelectTrigger className="glass glass-hover w-[200px]">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent className="dark bg-background/90 backdrop-blur-lg border-white/10">
              <SelectItem value="deepseek-reasoner">DeepSeek Reasoner</SelectItem>
              <SelectItem value="gpt-4">GPT-4</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o-mini</SelectItem>
              <SelectItem value="o3-mini">o3-Mini</SelectItem>
            </SelectContent>
          </Select>
          {(status === 'pending' || status === 'error') && (
            <Button
              onClick={() => onStart(selectedModel)}
              className="button-glow-subtle bg-gradient-to-r from-blue-500/90 via-purple-500/90 to-pink-500/90 hover:from-blue-600/90 hover:via-purple-600/90 hover:to-pink-600/90 text-white shadow-lg group"
            >
              <PlayCircle className="h-4 w-4 mr-2 transition-transform group-hover:-translate-y-0.5" />
              Start Analysis
            </Button>
          )}
        </div>

        {/* Instructions - Show even if prompt is not fully loaded */}
        {prompt && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Instructions</h3>
            <ScrollArea className="h-[200px] rounded-md border p-4">
              <div className="space-y-4">
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {prompt.prompt}
                </p>
              </div>
            </ScrollArea>
          </div>
        )}

        {renderStatus()}

        {/* Analysis Results */}
        {status === 'completed' && result && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-blue-400/80" />
                </div>
                <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-400/80 via-purple-400/80 to-pink-400/80">
                  Analysis Results
                </h3>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => onStart(selectedModel)}
                  className="button-glow-subtle bg-gradient-to-r from-blue-500/80 via-purple-500/80 to-pink-500/80 hover:from-blue-600/80 hover:via-purple-600/80 hover:to-pink-600/80 text-white shadow-lg group"
                >
                  <RefreshCw className="h-4 w-4 mr-2 transition-transform group-hover:rotate-180" />
                  Rerun Analysis
                </Button>
                {result.metadata?.usage && (
                  <div className="text-sm text-muted-foreground/70 flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    <span title="Total tokens used">{result.metadata.usage.total_tokens.toLocaleString()} tokens</span>
                  </div>
                )}
              </div>
            </div>
            <Card className="glass-subtle">
              <CardContent className="p-6">
                <ScrollArea className="h-[300px] overflow-y-auto pr-4" type="always">
                  <div className="space-y-6">
                    <div className="prose prose-invert max-w-none">
                      <div className="whitespace-pre-wrap text-white/80">{result.content}</div>
                    </div>
                    {result.metadata?.key_findings && result.metadata.key_findings.length > 0 && (
                      <div className="pt-4 border-t border-white/5">
                        <h4 className="text-lg font-semibold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-400/80 via-purple-400/80 to-pink-400/80">
                          Key Findings
                        </h4>
                        <ul className="list-none space-y-2">
                          {result.metadata.key_findings.map((finding, index) => (
                            <li key={index} className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 flex items-center justify-center mt-0.5">
                                <span className="text-xs font-medium text-blue-400/80">{index + 1}</span>
                              </div>
                              <span className="text-white/60">{finding}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* User Adjustments Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-blue-400/80" />
                  </div>
                  <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-400/80 via-purple-400/80 to-pink-400/80">
                    Adjustments & Comments
                  </h3>
                </div>
                <Button
                  onClick={() => handleAdjustment()}
                  className="button-glow-subtle bg-gradient-to-r from-blue-500/80 via-purple-500/80 to-pink-500/80 hover:from-blue-600/80 hover:via-purple-600/80 hover:to-pink-600/80 text-white shadow-lg group"
                  disabled={!adjustmentText.trim()}
                >
                  <RefreshCw className="h-4 w-4 mr-2 transition-transform group-hover:rotate-180" />
                  Apply Adjustments
                </Button>
              </div>
              
              <Card className="glass-subtle">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <p className="text-sm text-white/60">
                      Provide additional context, request specific focus areas, or suggest modifications to the analysis.
                      Your input will be used to refine and adjust the current results while maintaining the context.
                    </p>
                    <Textarea
                      placeholder={`Example prompts:
• Could you elaborate more on the technical aspects?
• Please focus more on the business impact.
• Can you rewrite this with a more strategic perspective?
• Add more specific examples related to...`}
                      value={adjustmentText}
                      onChange={(e) => setAdjustmentText(e.target.value)}
                      className="min-h-[120px] bg-background/30 border-white/10 focus:border-white/20 placeholder:text-white/20"
                    />
                    {isAdjusting && (
                      <div className="flex items-center gap-3 text-sm text-blue-400/90">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Applying adjustments...</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Debug Info */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Show Raw Prompt Data
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-4 bg-background/50">
              <CardContent className="p-4">
                <div className="prose prose-invert max-w-none">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium mb-2">Prompt</h3>
                      <p className="text-white/70">
                        {prompt?.prompt || (
                          <span className="text-white/40">Loading prompt data...</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Required Documents */}
        {documents && documents.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Required Documents</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {documents.map((doc) => (
                <Card key={doc.id} className="bg-background/50">
                  <CardContent className="p-4 flex items-start gap-3">
                    <FileText className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="font-medium">
                      {doc.filename}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {renderPromptContent()}
      </CardContent>
    </Card>
  );
} 