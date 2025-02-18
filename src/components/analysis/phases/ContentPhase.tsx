
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlayCircle, Sparkles } from 'lucide-react';
import React, { useState } from 'react'

interface PhaseData {
  phase: number;
  displayName: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  result?: any;
  prompt?: string;
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
interface ContentPhaseProps {
  phaseData: PhaseData;
  onStart: (model: string) => void;
}
function ContentPhase({ phaseData, onStart }: ContentPhaseProps) {
  console.log("phasedata: " ,phaseData);
  const currentPhase = phaseData;
  const { phase, displayName, description, status, result, prompt } = currentPhase;
  const [selectedModel, setSelectedModel] = useState('');
  const handleModelChange = () => { }

  const parsedPrompt = prompt ? parsePrompt(prompt) : null;
  console.log("Here: ", prompt);

  const renderPromptContent = () => {
    if (!prompt || !parsedPrompt) return null;
    console.log('This is the parsed content', parsedPrompt);

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
    (
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
                {description}
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
            {(status) && (
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
                    {prompt}
                  </p>
                </div>
              </ScrollArea>
            </div>
          )}
          {renderPromptContent()}
        </CardContent>
      </Card>
    )
  )
}

export default ContentPhase
