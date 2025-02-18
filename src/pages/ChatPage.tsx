import { Chat } from "@/components/Chat";
import { useEffect, useState } from "react";
import { PineconeService } from "@/services/pineconeService";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

// Polyfill for Pinecone client
if (typeof global === 'undefined') {
  (window as any).global = window;
}

const ChatPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isInitialized, setIsInitialized] = useState(true);

  // useEffect(() => {
  //   const initializePinecone = async () => {
  //     try {
  //       // Call the get-secret Edge Function to get the Pinecone API key
  //       const { data, error } = await supabase.functions.invoke('get-secret', {
  //         body: { name: 'PINECONE_API_KEY' }
  //       });

  //       if (error || !data?.secret) {
  //         throw new Error(error?.message || 'Failed to get Pinecone API key');
  //       }
        
  //       console.log('Received API key:', data.secret.substring(0, 10) + '...');
  //       await PineconeService.initialize(data.secret);
  //       setIsInitialized(true);
  //     } catch (error) {
  //       console.error("Failed to initialize Pinecone:", error);
  //       toast({
  //         title: "Error",
  //         description: "Failed to initialize chat service. Please try again later.",
  //         variant: "destructive",
  //       });
  //     }
  //   };

  //   initializePinecone();
  // }, [toast]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_25%)] animate-[spin_20s_linear_infinite]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(120,119,198,0.15),transparent_25%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(0,183,255,0.15),transparent_25%)]"></div>
      </div>

      <div className="container mx-auto py-8 px-6 max-w-[95%] xl:max-w-[90%] 2xl:max-w-[85%] space-y-8 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 bg-background/50 hover:bg-background/30 transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="hidden sm:block h-8 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-400" />
              <h1 className="text-2xl font-semibold text-foreground">Chat with Your Documents</h1>
            </div>
          </div>
          <div className="w-[88px]" /> {/* Spacer for centering */}
        </div>
        
        <Card className="bg-background/50 hover:bg-background/30 border border-white/5 transition-colors duration-200">
          {isInitialized ? (
            <div className="p-6">
              <Chat />
            </div>
          ) : (
            <div className="flex justify-center items-center h-[400px] gap-3">
              <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
              <p className="text-muted-foreground">Initializing chat service...</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ChatPage; 