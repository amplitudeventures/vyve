import { useEffect, useState } from 'react';
import { Send, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  status?: 'sending' | 'error';
  error?: string;
  citations?: Array<{
    content: string;
    score: number;
    reference: {
      type: string;
      title?: string;
      url?: string;
    };
  }>;
}

interface Company {
  id: string;
  name: string;
  // Add other company fields as needed
}

export const Chat = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<string[]>(['o3-mini', 'deepseek-reasoner']);
  const [selectedModel, setSelectedModel] = useState<string>(models[0]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('');

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch('http://localhost:8000/get_companies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        } );
        const data = await response.json();


        console.log('Fetched companies data:', data);
        setCompanies(data.companies);
        // if (data.companies.length > 0) {
        //   setSelectedCompany(data.companies[0]);
        // }
      } catch (error) {
        console.error('Error fetching companies:', error);
        toast({
          title: "Error",
          description: "Failed to fetch companies. Please try again later.",
          variant: "destructive",
        });
      }
    };
    fetchCompanies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    const pendingMessage: Message = { role: 'assistant', content: '', status: 'sending' };
    
    setMessages(prev => [...prev, userMessage, pendingMessage]);
    setInput('');
    setIsLoading(true);

    try {
      console.log('Sending chat request...', {
        model: selectedModel,
        messageCount: messages.length + 1
      });

      // const response = await PineconeService.chat([...messages, userMessage], selectedModel);
      const requestBody = {
        question: userMessage.content,
        messages: messages.slice(-5), // Keep only last 5 messages for context
        company_name: selectedCompany,
        context: messages.map(m => m.content).join('\n\n'), // Include all message content for context
        model: selectedModel
      };
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }).then(async res => {
        console.log('Response:', res);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to get chat response');
        }
        return data;
      });


      console.log('Received chat response:', {
        hasAnswer: !!response.answer,
        citationsCount: response.citations?.length || 0
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.answer.answer,
        citations: response.citations
      };

      setMessages(prev => [...prev.slice(0, -1), assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Failed to get response. Please try again.',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };

      setMessages(prev => [...prev.slice(0, -1), errorMessage]);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get response from assistant",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-blue-400 animate-pulse" />
              <span>Processing with {selectedModel}...</span>
            </div>
          ) : !selectedCompany && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <span>Select a company first...</span>
            </div>
          ) }
        </div>
        <div className="flex gap-2">
          <Select
            value={selectedCompany}
            onValueChange={setSelectedCompany}
            disabled={isLoading}
          >
            <SelectTrigger className="bg-background/50 hover:bg-background/30 transition-all duration-300 w-[180px] border-white/10">
              <SelectValue placeholder="Select company" />
            </SelectTrigger>
            <SelectContent className="dark bg-background/80 backdrop-blur-lg border-white/10">
              {companies.map((company: string, index: number) => (
                <SelectItem key={index} value={company}>
                  {company}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedModel}
            onValueChange={(value) => {
              setSelectedModel(value);
            }}
            disabled={isLoading}
          >
            <SelectTrigger className="bg-background/50 hover:bg-background/30 transition-all duration-300 w-[180px] border-white/10">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent className="dark bg-background/80 backdrop-blur-lg border-white/10">
                {models.map((model: string, index: number) => (
                    <SelectItem key={index} value={model}>{model}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="h-[400px] overflow-y-auto space-y-4 p-4 rounded-lg border border-white/5">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex flex-col ${
              message.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-lg p-4",
                message.role === 'user'
                  ? 'bg-blue-500/8 border border-blue-400/10'
                  : message.status === 'error'
                  ? 'bg-red-500/8 border border-red-400/10'
                  : 'bg-purple-500/8 border border-purple-400/10'
              )}
            >
              {message.status === 'sending' ? (
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400/70 animate-pulse" />
                  <p className="text-muted-foreground">Processing response...</p>
                </div>
              ) : message.status === 'error' ? (
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 mt-1 shrink-0" />
                  <div>
                    <p className="text-foreground">{message.content}</p>
                    {message.error && (
                      <p className="text-sm text-red-400/70 mt-1">{message.error}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-foreground">{message.content}</p>
              )}
            </div>
            {message.citations && message.citations.length > 0 && (
              <div className="mt-2 text-sm text-muted-foreground space-y-2">
                <p className="font-semibold text-blue-400/80">Sources:</p>
                {message.citations.map((citation, idx) => (
                  <div key={idx} className="ml-2 bg-background/25 p-2 rounded-lg border border-white/5">
                    <p className="text-muted-foreground">{citation.content}</p>
                    <p className="text-xs text-blue-400/70">
                      {citation.reference.title || citation.reference.url}
                      {citation.score && ` (Relevance: ${(citation.score * 100).toFixed(1)}%)`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={selectedCompany ? "Ask a question about your documents..." : "Select a company first..."}
          disabled={isLoading || !selectedCompany}
          className="bg-background/40 border-white/5 hover:opacity-95 transition-opacity duration-300"
        />
        <Button 
          type="submit" 
          disabled={isLoading || !selectedCompany}
          className="bg-gradient-to-r from-blue-500/80 to-cyan-500/80 hover:opacity-95 text-white shadow-sm transition-opacity duration-300"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}; 