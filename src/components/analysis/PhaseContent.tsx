import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { PhasePrompt, AnalysisResult } from "@/types/vyve";
import { cn } from "@/lib/utils";

interface PhaseContentProps {
  prompt?: PhasePrompt;
  result?: AnalysisResult;
  onAnalysisComplete: (result: AnalysisResult) => void;
}

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

export function PhaseContent({ prompt, result, onAnalysisComplete }: PhaseContentProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartAnalysis = async () => {
    if (!prompt) return;
    
    setIsAnalyzing(true);
    setError(null);

    try {
      // TODO: Implement the analysis logic here
      const analysisResult: AnalysisResult = {
        id: Date.now(),
        phase_number: prompt.phase_number,
        sub_phase: prompt.sub_phase,
        result: "Sample analysis result",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      onAnalysisComplete(analysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during analysis");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!prompt) {
    return (
      <div className="text-center text-white/40 py-12">
        No prompt available for this phase
      </div>
    );
  }

  const parsedPrompt = parsePrompt(prompt.prompt);

  return (
    <div className="space-y-6">
      <Card className="bg-background/30 backdrop-blur-sm border-white/5">
        <div className="p-6">
          <h2 className="text-2xl font-semibold mb-4">
            Phase {prompt.phase_number}.{prompt.sub_phase}: {prompt.phase_name}
          </h2>
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
      </Card>

      {result ? (
        <Card className="bg-background/30 backdrop-blur-sm border-white/5">
          <div className="p-6">
            <h3 className="text-xl font-semibold mb-4">Analysis Result</h3>
            <div className="prose prose-invert max-w-none">
              <p className="text-white/70">{result.result}</p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="flex justify-center">
          <Button
            onClick={handleStartAnalysis}
            disabled={isAnalyzing}
            className={cn(
              "relative overflow-hidden group",
              "bg-gradient-to-r from-blue-500/80 via-purple-500/80 to-pink-500/80",
              "hover:from-blue-500/90 hover:via-purple-500/90 hover:to-pink-500/90",
              "border-0 shadow-lg shadow-purple-500/20"
            )}
          >
            {isAnalyzing ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Analyzing...
              </>
            ) : (
              "Start Analysis"
            )}
          </Button>
        </div>
      )}

      {error && (
        <div className="text-red-500 text-center mt-4">
          {error}
        </div>
      )}
    </div>
  );
} 