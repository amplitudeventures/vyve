import { useNavigate } from 'react-router-dom';
import { useConfig } from '../contexts/ConfigContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Sparkles, ChevronRight } from 'lucide-react';

const AppSelection = () => {
  const navigate = useNavigate();
  const { switchApp } = useConfig();

  const handleAppSelect = async (app: 'vyve' | 'denominator') => {
    try {
      // Switch the app first
      switchApp(app);
      
      // Add a small delay to ensure state updates are processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Then navigate
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error switching app:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_25%)] animate-[spin_20s_linear_infinite]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(120,119,198,0.15),transparent_25%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(0,183,255,0.15),transparent_25%)]"></div>
      </div>

      <div className="container mx-auto min-h-screen flex items-center justify-center p-6">
        <div className="max-w-5xl w-full space-y-12">
          <div className="text-center space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gradient-animate">
              Select Your Application
            </h1>
            <p className="text-lg text-muted-foreground flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-400 animate-pulse" />
              Choose your platform to get started
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card 
              className="card-glow glass glass-hover group cursor-pointer"
              onClick={() => handleAppSelect('vyve')}
            >
              <CardContent className="p-8 flex flex-col items-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/80 to-purple-600/80 flex items-center justify-center transform transition-all duration-300 hover:scale-[1.05] hover:shadow-lg">
                  <span className="text-4xl font-bold text-white">V</span>
                </div>
                <div className="space-y-2 text-center">
                  <h2 className="text-3xl font-semibold gradient-text">Vyve</h2>
                  <CardDescription className="text-indigo-200/70">
                    Advanced document analysis platform
                  </CardDescription>
                </div>
                <Button 
                  className="w-full bg-background/50 hover:bg-background/30 text-white transition-all duration-300 group hover:shadow-md"
                >
                  Select Vyve
                  <ChevronRight className="h-4 w-4 ml-2 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="card-glow glass glass-hover group cursor-pointer"
              onClick={() => handleAppSelect('denominator')}
            >
              <CardContent className="p-8 flex flex-col items-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/80 to-cyan-500/80 flex items-center justify-center transform transition-all duration-300 hover:scale-[1.05] hover:shadow-lg">
                  <span className="text-4xl font-bold text-white">D</span>
                </div>
                <div className="space-y-2 text-center">
                  <h2 className="text-3xl font-semibold gradient-text">Denominator</h2>
                  <CardDescription className="text-blue-200/70">
                    Powerful data processing engine
                  </CardDescription>
                </div>
                <Button 
                  className="w-full bg-background/50 hover:bg-background/30 text-white transition-all duration-300 group hover:shadow-md"
                >
                  Select Denominator
                  <ChevronRight className="h-4 w-4 ml-2 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppSelection; 