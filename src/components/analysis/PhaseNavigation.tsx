import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PHASE_NAMES, PHASE_CATEGORIES, PHASE_DESCRIPTIONS } from "@/config/phaseConfig";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { PhasePrompt } from "@/types/vyve";
import { supabase } from "@/integrations/supabase/client";

interface PhaseNavigationProps {
  currentPhase: number;
  currentSubPhase?: number;
  onPhaseChange: (phase: number, subPhase?: number) => void;
}

export function PhaseNavigation({ currentPhase, currentSubPhase = 0, onPhaseChange }: PhaseNavigationProps) {
  const [activeCategory, setActiveCategory] = useState<string>("Initial Analytics");
  const [phasePrompts, setPhasePrompts] = useState<PhasePrompt[]>([]);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  // Fetch phase prompts when component mounts
  useEffect(() => {
    const fetchPhasePrompts = async () => {
      try {
        const { data, error } = await supabase
          .from('phase_prompts')
          .select('*')
          .order('phase_number')
          .order('sub_phase');
        
        if (error) {
          console.error('Error fetching phase prompts:', error);
          return;
        }

        if (data) {
          console.log('Fetched phase prompts:', data);
          setPhasePrompts(data);
        }
      } catch (err) {
        console.error('Error in fetchPhasePrompts:', err);
      }
    };

    fetchPhasePrompts();
  }, []); // Empty dependency array to run only once on mount

  // Group prompts by phase number
  const promptsByPhase = phasePrompts.reduce((acc, prompt) => {
    if (!acc[prompt.phase_number]) {
      acc[prompt.phase_number] = [];
    }
    acc[prompt.phase_number].push(prompt);
    return acc;
  }, {} as Record<number, PhasePrompt[]>);

  return (
    <div className="space-y-8">
      {/* Main Production Title */}
      <div className="relative">
        <h1 className="text-6xl font-bold text-center tracking-tight mb-2">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400/80 via-purple-400/80 to-pink-400/80 animate-gradient">
            Production
          </span>
        </h1>
        <p className="text-center text-white/40 text-lg">Select a category to explore phases</p>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-32 h-1 mt-6 bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-pink-500/30 rounded-full opacity-60" />
      </div>
      
      <div className="grid grid-cols-[320px_1fr] gap-12">
        {/* Category Navigation */}
        <div className="space-y-4 pr-8">
          {Object.entries(PHASE_CATEGORIES["Production"]).map(([category, phases]) => (
            <Button
              key={category}
              onClick={() => setActiveCategory(category)}
              variant="outline"
              className={cn(
                "w-full group relative overflow-hidden border-0",
                "h-auto py-6 px-6",
                "bg-background/30 hover:bg-background/40",
                "transition-all duration-500",
                activeCategory === category && "bg-background/40 shadow-[0_0_20px_-5px_rgba(168,85,247,0.2)]",
                "before:absolute before:inset-0 before:bg-gradient-to-r before:from-blue-500/5 before:via-purple-500/5 before:to-pink-500/5 before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500",
                activeCategory === category && "before:opacity-100"
              )}
            >
              <div className="relative z-10">
                <div className={cn(
                  "text-xl font-semibold transition-colors duration-300",
                  activeCategory === category && "bg-clip-text text-transparent bg-gradient-to-r from-blue-400/80 via-purple-400/80 to-pink-400/80"
                )}>
                  {category}
                </div>
                <div className="text-sm text-white/40 mt-2 font-medium">
                  {`Phases ${Math.min(...phases)}-${Math.max(...phases)}`}
                </div>
              </div>
              {activeCategory === category && (
                <>
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-500/40 via-purple-500/40 to-pink-500/40 rounded-full" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5" />
                </>
              )}
            </Button>
          ))}
        </div>

        {/* Phase Buttons */}
        <div className="relative group">
          {/* Animated gradient border */}
          <div className="absolute -inset-[1px] bg-gradient-to-r from-blue-500/40 via-purple-500/40 to-pink-500/40 rounded-xl opacity-40 blur group-hover:opacity-60 transition-opacity" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-[1px] bg-background/90 backdrop-blur-sm rounded-xl" />
          
          {/* Content */}
          <div className="relative p-8">
            <div className="grid grid-cols-2 gap-4">
              <TooltipProvider>
                {PHASE_CATEGORIES["Production"][activeCategory].map(phase => {
                  const hasSubPhases = promptsByPhase[phase]?.length > 1;
                  const isExpanded = expandedPhase === phase;
                  
                  return (
                    <div key={phase} className="space-y-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => {
                              if (hasSubPhases) {
                                setExpandedPhase(isExpanded ? null : phase);
                              } else {
                                onPhaseChange(phase, 0);
                              }
                            }}
                            variant="outline"
                            className={cn(
                              "w-full relative group/phase overflow-hidden",
                              "h-auto py-5 px-6 border-0",
                              "bg-background/30 hover:bg-background/40",
                              "transition-all duration-500",
                              (currentPhase === phase && currentSubPhase === 0) && [
                                "shadow-[0_0_20px_-5px_rgba(168,85,247,0.2)]",
                                "bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5"
                              ],
                              "hover:scale-[1.01]"
                            )}
                          >
                            <div className="relative z-10">
                              <div className={cn(
                                "text-base font-semibold transition-colors duration-300",
                                (currentPhase === phase && currentSubPhase === 0) && "bg-clip-text text-transparent bg-gradient-to-r from-blue-400/80 via-purple-400/80 to-pink-400/80"
                              )}>
                                Phase {phase}
                              </div>
                              <div className="text-sm text-white/40 mt-2">
                                {PHASE_NAMES[phase].split(": ")[1]}
                              </div>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover/phase:opacity-100 transition-opacity" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent 
                          side="bottom" 
                          className="max-w-[300px] text-sm bg-background/95 backdrop-blur-sm border-white/5 shadow-xl"
                        >
                          {PHASE_DESCRIPTIONS[phase]}
                        </TooltipContent>
                      </Tooltip>

                      {/* Sub-phases */}
                      {hasSubPhases && isExpanded && (
                        <div className="pl-4 space-y-2">
                          {promptsByPhase[phase].map((prompt, index) => (
                            <Button
                              key={prompt.id}
                              onClick={() => onPhaseChange(phase, prompt.sub_phase)}
                              variant="outline"
                              className={cn(
                                "w-full relative group/subphase overflow-hidden",
                                "h-auto py-3 px-4 border-0",
                                "bg-background/20 hover:bg-background/30",
                                "transition-all duration-500",
                                (currentPhase === phase && currentSubPhase === prompt.sub_phase) && [
                                  "shadow-[0_0_20px_-5px_rgba(168,85,247,0.2)]",
                                  "bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5"
                                ]
                              )}
                            >
                              <div className="relative z-10">
                                <div className={cn(
                                  "text-sm font-medium transition-colors duration-300",
                                  (currentPhase === phase && currentSubPhase === prompt.sub_phase) && "bg-clip-text text-transparent bg-gradient-to-r from-blue-400/80 via-purple-400/80 to-pink-400/80"
                                )}>
                                  {prompt.phase_name}
                                </div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 