import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
// import { PHASE_NAMES, PHASE_CATEGORIES, PHASE_DESCRIPTIONS } from "@/config/PhaseConfig";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import axios from "axios";

interface SubPhase {
  analysis_result: string;
  status: string;
  order: number;
  id: number;
  name?: string;
  phaseName?: string;
}

interface PhaseData {
  sub_phases: {
    [key: string]: SubPhase;
  };
}

interface PhaseResponse {
  phases: {
    [key: string]: PhaseData;
  };
}

interface PhaseNavigationProps {
  currentPhase: number;
  currentSubPhase?: number;
  onPhaseChange: (phase: number, subPhase?: number) => void;
  phaseOrder?: Record<number, SubPhase>;
}

export function PhaseNavigation({ 
  currentPhase, 
  currentSubPhase = 0, 
  onPhaseChange,
  phaseOrder
}: PhaseNavigationProps) {
  const [activeCategory, setActiveCategory] = useState<string>("Initial Analytics");
  const [phases, setPhases] = useState<PhaseResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPhases = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/get_phases');
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        
        // Process the data to include order and names
        const processedData = {
          phases: {} as PhaseResponse['phases']
        };

        Object.entries(data.phases).forEach(([phaseName, phaseData]: [string, any]) => {
          processedData.phases[phaseName] = {
            sub_phases: {}
          };

          Object.entries(phaseData.sub_phases).forEach(([subPhaseName, subPhaseData]: [string, any]) => {
            // Get the status from phaseOrder if available
            const orderStatus = phaseOrder?.[subPhaseData.order]?.status;
            processedData.phases[phaseName].sub_phases[subPhaseName] = {
              ...subPhaseData,
              name: subPhaseName,
              phaseName: phaseName,
              status: orderStatus || subPhaseData.status // Use phaseOrder status if available
            };
          });
        });

        setPhases(processedData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching phases:', err);
        setLoading(false);
      }
    };

    fetchPhases();

    const intervalId = setInterval(fetchPhases, 2000);

    return () => clearInterval(intervalId);
  }, [phaseOrder]);

  if (loading) {
    return <div>Loading phases...</div>;
  }

  if (!phases) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="relative">
        <h1 className="text-6xl font-bold text-center tracking-tight mb-2">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400/80 via-purple-400/80 to-pink-400/80 animate-gradient">
            Production
          </span>
        </h1>
        <p className="text-center text-white/40 text-lg">Select a category to explore phases</p>
      </div>
      
      <div className="grid grid-cols-[320px_1fr] gap-12">
        {/* Category Navigation */}
        <div className="space-y-4 pr-8">
          {Object.keys(phases.phases).map((category) => (
            <Button
              key={category}
              onClick={() => setActiveCategory(category)}
              variant="outline"
              className={cn(
                "w-full group relative overflow-hidden border-0",
                "h-auto py-6 px-6",
                activeCategory === category && "bg-background/40"
              )}
            >
              <div className="relative z-10">
                <div className={cn(
                  "text-xl font-semibold",
                  activeCategory === category && "bg-clip-text text-transparent bg-gradient-to-r from-blue-400/80 via-purple-400/80 to-pink-400/80"
                )}>
                  {category}
                </div>
                <div className="text-sm text-white/40 mt-2">
                  {`${Object.keys(phases.phases[category].sub_phases).length} Phases`}
                </div>
              </div>
            </Button>
          ))}
        </div>

        {/* Updated Phase List with two columns */}
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(phases.phases[activeCategory].sub_phases)
            .sort((a, b) => a[1].order - b[1].order)
            .map(([name, subPhase]) => (
              <Button
                key={name}
                onClick={() => onPhaseChange(subPhase.order, subPhase.id)}
                variant="outline"
                className={cn(
                  "w-full group relative overflow-hidden border-0",
                  "h-[120px] p-6",
                  "flex flex-col justify-between",
                  "bg-background/30 hover:bg-background/40",
                  currentPhase === subPhase.order && [
                    "bg-background/40",
                    "shadow-[0_0_20px_-5px_rgba(168,85,247,0.2)]"
                  ]
                )}
              >
                <div className="relative z-10 h-full flex flex-col justify-between">
                  <div className="flex-1">
                    <div className={cn(
                      "text-sm font-medium line-clamp-2",
                      currentPhase === subPhase.order && "bg-clip-text text-transparent bg-gradient-to-r from-blue-400/80 via-purple-400/80 to-pink-400/80"
                    )}>
                      {name}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2">
                    <div className={cn(
                      "text-xs flex items-center gap-2",
                      subPhase.status === 'completed' && "text-green-400",
                      subPhase.status === 'in_progress' && "text-blue-400",
                      !subPhase.status && "text-white/40"
                    )}>
                      {subPhase.status === 'in_progress' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      )}
                      {subPhase.status === 'completed' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      )}
                      {subPhase.status || 'Pending'}
                    </div>
                    <div className="text-xs text-white/40">
                      Phase {subPhase.order + 1}
                    </div>
                  </div>
                </div>

                {currentPhase === subPhase.order && (
                  <>
                    <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-500/40 via-purple-500/40 to-pink-500/40 rounded-full" />
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5" />
                  </>
                )}
              </Button>
          ))}
        </div>
      </div>
    </div>
  );
} 
