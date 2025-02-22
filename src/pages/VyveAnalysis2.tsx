import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Settings, ChevronRight, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { PhaseNavigation } from "@/components/analysis/PhaseNavigation";
import ContentPhase from "@/components/analysis/phases/ContentPhase";
import { PHASE_DESCRIPTIONS, PHASE_NAMES } from "@/config/PhaseConfig";

const handleRestart = () => console.log("Reset All Data clicked");



const VyveAnalysis = ({ error }) => {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [allPhaseData, setAllPhaseData] = useState(null);
  const [phaseOrder, setPhaseOrder] = useState(null);
  const [currentSubPhase, setCurrentSubPhase] = useState(0);
  const [isLoading, setIsLoding] = useState(false);

  const navigate = useNavigate();

  const fetchData = async () => {
    const response = await fetch('http://127.0.0.1:8000/get_phases', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    Object.entries(data.phases).forEach(([phaseName, phaseData]) => {
      let counter = 0;
      Object.entries(phaseData.sub_phases).forEach(([subPhaseName, subPhaseData]) => {
        subPhaseData.phase_no = counter;
        counter += 1;
      });
    });
    const temp = {};
    Object.entries(data.phases).forEach(([phaseName, phaseData]) => {
      Object.entries(phaseData.sub_phases).forEach(([subPhaseName, subPhaseData]) => {
        subPhaseData['name'] = subPhaseName;
        subPhaseData['phaseName'] = phaseName;
        temp[subPhaseData.phase_no] = subPhaseData;
      });
    });
    setAllPhaseData(data["phases"]);
    setPhaseOrder(temp);
  }

  const handleStartAnalysis = async (phaseName) => {
    const temp = { ...phaseOrder };

    for (let i = 1; i < 10; i++) {
      console.log('hello');

      for (const [phaseOrd, phaseData] of Object.entries(temp)) {
        if (i === phaseData['order']) {
          try {
            const formData = new URLSearchParams();
            formData.append('id', phaseData['id']);
            const response = await fetch('http://127.0.0.1:8000/start_analysis/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: formData.toString(),
            });

            if (!response.ok) {
              throw new Error('Error analyzing');
            }

            const data = await response.json();
            console.log('this is the data: ', data);
            temp[phaseOrd]['analysis_result'] = data['result'];

          } catch (error) {
            console.error(error.message);
          }
        }
      }
    }

    setPhaseOrder(temp);
  };

  useEffect(() => {
    fetchData();
  }, [])


  useEffect(() => {
    console.log('this is the response: ', allPhaseData);
    console.log('this is the response: ', phaseOrder);

  }, [allPhaseData])



  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch('http://127.0.0.1:8000/get_phases', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      console.log("These are the phases: ", data);
    }
    fetchData();
  }, []);


  const renderPhaseContent = () => {
    if (!phaseOrder) {
      return (
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>)
    }
    return (
      <ContentPhase
        phaseData={{
          phase: currentPhase,
          phaseName: phaseOrder[currentPhase]['phaseName'],
          displayName: phaseOrder[currentPhase]['name'],
          description: PHASE_DESCRIPTIONS[currentPhase],
          status: phaseOrder[currentPhase]['status'],
          prompt: "Prompt",
          result: phaseOrder[currentPhase]['analysis_result'],
        }}
        onStart={handleStartAnalysis} />);
  }

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
