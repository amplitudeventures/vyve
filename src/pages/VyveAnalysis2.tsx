import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Settings, ChevronRight, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { PhaseNavigation } from "@/components/analysis/PhaseNavigation";
import ContentPhase from "@/components/analysis/phases/ContentPhase";

// Dummy functions
const handleRestart = () => console.log("Reset All Data clicked");


const dummy = {
  "phases": [
    {
      "name": "phase name 1",
      "id": 1,
      "subphases": {
        "subphase1": {
          "name": "sub phase name",
          "analysis_result": "RESULT",
          "status": "completed",
          "id": 1
        }, "subphase2": {
          "name": "sub phase name",
          "analysis_result": "",
          "status": "pending",
          "id": 2
        }, "subphase3": {
          "name": "sub phase name",
          "analysis_result": "",
          "status": "error",
          "id": 3
        }
      },
    },
    {
      "name": "phase name 2",
      "id": 1,
      "subphases": {
        "subphase1": {
          "name": "sub phase name",
          "analysis_result": "RESULT",
          "status": "completed",
          "id": 1
        },
        "subphase2": {
          "name": "sub phase name",
          "analysis_result": "",
          "status": "pending",
          "id": 2
        },
        "subphase3": {
          "name": "sub phase name",
          "analysis_result": "",
          "status": "error",
          "id": 3
        }
      }
    }
  ],
  "phase_prompts": [
    {
      "id": 1,
      "name": "Identify Key Points",
      "phase_index": 1,
      "text": ` PHASE 0: DOCUMENT ANALYSIS
OBJECTIVE:
Establish an initial, comprehensive understanding of the company’s business context through a focused analysis of the provided documentation. This analysis should emphasize the company’s identity, operational scope, and sustainability (ESG) positioning, along with its industry categorization according to the NACE framework.
REQUIRED INPUT:
• Retrieve all available company documents from Pinecone relevant to the business context.
• Include industry classification documents: Industry Categorization.md (defines the primary NACE category or categories) and Industry Categorization Level 2.md (specifies subcategories relevant to the company).
• Understand your personality and purpose through the AI Identity provided in your context, and strictly adhere to this personality.
TASKS:
1. Retrieve and review the provided company documents.
2. Examine industry classification details to determine the applicable NACE category (or categories) and any relevant subcategories.
3. Develop a comprehensive understanding of the company’s identity—covering who the company is, what it does, why it exists, and when key milestones occur.
OUTPUT FORMAT:
• Key Findings: Summarize the central insights obtained from the documentation.
• Detailed Analysis: Provide a concise, approximately 300-word summary that also defines the NACE categorization.`
    },
    {
      "id": 2,
      "name": "Extract Sentiments",
      "phase_index": 1,
      "text": "Analyze the sentiment in the document."
    }
  ],
  "analysis_results": [
    {
      "id": 1,
      "sub_phase_id": 1,
      "result": "The document contains five key points.",
      "status": "Completed",
      "error": "",
      "created_at": "2025-02-17T12:00:00Z",
      "updated_at": "2025-02-17T12:30:00Z"
    },
    {
      "id": 2,
      "sub_phase_id": 2,
      "result": "The sentiment analysis detected a neutral tone.",
      "status": "Completed",
      "error": "",
      "created_at": "2025-02-17T12:15:00Z",
      "updated_at": "2025-02-17T12:45:00Z"
    }
  ]
}

const VyveAnalysis = ({ error }) => {

  const getStatus = (currPhase, data, currSub) => {
    const phaseData = Object.values(data)[currPhase];
    const subPhase = Object.values(phaseData)[currSub];
    return {
      "status": subPhase["status"],
      "subPhaseName": subPhase["name"], 
      "results": subPhase["analysis_results"]
    };
  }
  const getPhaseName = (currPhase, data) => {
    const phaseData = Object.values(data)[currPhase];
    return phaseData["name"];
  }

  const renderPhaseContent = () => {
    return (
      <ContentPhase
        phaseData={{
          phase: currentPhase,
          subphase: currentSubPhase,
          displayName: dummy["phases"][currentPhase]["name"],
          description: "description",
          status: Object.values(dummy["phases"][currentPhase]["subphases"])[currentSubPhase]["status"]
          ,
          prompt: "Prompt",
          result: Object.values(dummy["phases"][currentPhase]["subphases"])[currentSubPhase]["analysis_result"]
        }}
        onStart={() => { }} />);
  }
  const [currentPhase, setCurrentPhase] = useState(0);
  const [currentSubPhase, setCurrentSubPhase] = useState(0);
  const [isLoading, setIsLoding] = useState(false);

  const navigate = useNavigate();

  const handlePhaseChange = (phase, subPhase) => {
    console.log("Phase changed to", phase, subPhase)
    setCurrentPhase(phase);
    setCurrentSubPhase(subPhase);
  };
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_25%)] animate-[spin_20s_linear_infinite]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(120,119,198,0.08),transparent_25%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(0,183,255,0.08),transparent_25%)]" />
      </div>

      <div className="relative min-h-screen flex flex-col">
        <div className="relative">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
          <div className="relative backdrop-blur-md bg-background/40 border-b border-white/5">
            <div className="container mx-auto py-5 px-6 max-w-[95%] xl:max-w-[90%] 2xl:max-w-[85%]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <button
                    className="relative group overflow-hidden rounded-lg border-white/10 hover:border-white/20 transition-colors"
                    onClick={() => navigate("/")}
                  >
                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                    <span className="font-medium">Back to Home</span>
                  </button>
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <div className="relative w-11 h-11 rounded-xl bg-background/90 backdrop-blur-sm flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-blue-400/80 group-hover:text-blue-300 transition-colors" />
                      </div>
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400/90 via-purple-400/90 to-pink-400/90">
                        Vyve Analysis
                      </h1>
                      <p className="text-sm text-white/40">Analyze and process your data</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    className="relative group overflow-hidden rounded-lg border-white/10 hover:border-white/20 transition-colors"
                    onClick={handleRestart}
                  >
                    <RefreshCw className="h-4 w-4 transition-transform group-hover:rotate-180" />
                    <span className="font-medium">Reset All Data</span>
                  </button>
                  <button
                    className="relative group overflow-hidden rounded-lg border-white/10 hover:border-white/20 transition-colors"
                    onClick={() => navigate("/select-app")}
                  >
                    <Settings className="h-4 w-4 transition-transform group-hover:rotate-90" />
                    <span className="font-medium">Switch App</span>
                    <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 relative">
          <div className="container mx-auto py-8 px-6 max-w-[95%] xl:max-w-[90%] 2xl:max-w-[85%] space-y-8">
            <div className="card-glow-subtle glass p-8">
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
                <div className="mt-8">{renderPhaseContent()}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VyveAnalysis;
