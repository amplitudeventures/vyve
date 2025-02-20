import { DocumentUpload } from "@/components/DocumentUpload";
import { WebsiteScraper } from "@/components/WebsiteScraper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import DocumentList from "@/components/DocumentList";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, PlayCircle, MessageSquare, Trash2, Settings, Database, Loader2, ChevronRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useConfig } from "@/contexts/ConfigContext";
import { Separator } from "@/components/ui/separator";
import { PasswordDialog } from "@/components/PasswordDialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const Index = () => {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearingDocs, setIsClearingDocs] = useState(false);
  const [isClearingWebsites, setIsClearingWebsites] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [uploadCompanyName, setUploadCompanyName] = useState('');
  const [companyNames, setCompanyNames] = useState([]);
  const [trigRefetch, setTrigRefetch] = useState('');
  const [denominatorDialogOpen, setDenominatorDialogOpen] = useState(false);
  const [vyveDialogOpen, setVyveDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentApp, config } = useConfig();

  useEffect(() => {
    async function fetchCompanies() {
      try {
        const response = await fetch('http://localhost:8000/get_companies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        const responseData = await response.json();
        if (responseData && Array.isArray(responseData.companies)) {
          setCompanyNames(responseData.companies);
        } else {
          console.error("Invalid API response format:", responseData);
          setCompanyNames([]);
        }

      } catch (error) {
        console.error('Error fetching company names:', error);
        setCompanyNames([]);
      }
    }

    fetchCompanies();
  }, [trigRefetch]);


  useEffect(() => {
    // If no app is selected, redirect to app selection
    if (!currentApp) {
      navigate('/select-app');
    }
  }, [currentApp, navigate]);

  const handleUploadComplete = () => {
    console.log('Upload completed, refreshing documents...');
    setUploadCompanyName('');  // Reset upload company name after completion
  };

  const handleClearDocuments = async () => {

    if (!confirm('Are you sure you want to clear the Documents? This will remove all documents')) {
      return;
    }
    if (!selectedCompany) {
      toast({ title: 'Error', description: 'Please select Company Name' });
      return;
    }

    setIsClearing(true);
    try {
      console.log('Clearing index...');
      const response = await fetch(
        'http://localhost:8000/clear_documents',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 'company_name': selectedCompany })
        }
      );

      const result = await response.json();
      console.log('Clear index response:', result);

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to clear index');
      }

      // Show detailed success message
      toast({
        title: "Success",
        description: `Index "${result.indexName}" cleared successfully. Removed ${result.beforeStats?.totalVectorCount || 0
          } vectors from the index.`,
      });

      // Log detailed statistics
      console.log('Index clearing details:', {
        indexName: result.indexName,
        beforeStats: result.beforeStats,
        afterStats: result.afterStats
      });

    } catch (error) {
      console.error('Error clearing index:', error);
      toast({
        title: "Error",
        description: error instanceof Error
          ? `Failed to clear index: ${error.message}`
          : "Failed to clear index",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearWebsites = async () => {
    //if (!confirm('Are you sure you want to clear all websites? This will permanently delete all website content from the database.')) {
    //  return;
    //}
    //
    //setIsClearingWebsites(true);
    //try {
    //  console.log('Attempting to clear websites...');
    //
    //  // Delete all websites using raw SQL
    //  const { data: { rowsAffected }, error: deleteError } = await supabase.rpc('execute_sql', {
    //    query: 'DELETE FROM website_content WHERE id IS NOT NULL'
    //  });
    //
    //  if (deleteError) {
    //    console.error('Error clearing websites:', {
    //      code: deleteError.code,
    //      message: deleteError.message,
    //      details: deleteError.details,
    //      hint: deleteError.hint
    //    });
    //    throw deleteError;
    //  }
    //
    //  console.log(`Delete operation completed successfully. Deleted ${rowsAffected} websites.`);
    //  toast({
    //    title: "Success",
    //    description: `Successfully cleared ${rowsAffected} websites`,
    //  });
    //
    //  // Force refresh the website list
    //  window.location.reload();
    //} catch (error: any) {
    //  console.error('Error clearing websites:', {
    //    code: error.code,
    //    message: error.message,
    //    details: error.details,
    //    hint: error.hint,
    //    fullError: error
    //  });
    //  toast({
    //    title: "Error",
    //    description: `Failed to clear websites: [${error.code}] ${error.message}`,
    //    variant: "destructive",
    //  });
    //} finally {
    //  setIsClearingWebsites(false);
    //}
  };

  const handleClearIndex = async () => {
    if (!confirm('Are you sure you want to clear the index? This will remove all document embeddings.')) {
      return;
    }

    if (!selectedCompany) {
      toast({ title: 'Error', description: 'Please select Company Name' });
      return;
    }
    setIsClearing(true);
    try {
      console.log('Clearing index...');
      const response = await fetch(
        'http://localhost:8000/clear_index',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 'company_name': selectedCompany })
        }
      );

      const result = await response.json();
      console.log('Clear index response:', result);

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to clear index');
      }

      // Show detailed success message
      toast({
        title: "Success",
        description: `Index "${result.indexName}" cleared successfully. Removed ${result.beforeStats?.totalVectorCount || 0
          } vectors from the index.`,
      });

      // Log detailed statistics
      console.log('Index clearing details:', {
        indexName: result.indexName,
        beforeStats: result.beforeStats,
        afterStats: result.afterStats
      });

    } catch (error) {
      console.error('Error clearing index:', error);
      toast({
        title: "Error",
        description: error instanceof Error
          ? `Failed to clear index: ${error.message}`
          : "Failed to clear index",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
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

      <div className="container mx-auto py-12 px-6 max-w-[95%] xl:max-w-[90%] 2xl:max-w-[85%] space-y-12 relative">
        {/* Header Section */}
        <div className="text-center space-y-4 max-w-4xl mx-auto">
          <div className="inline-block">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gradient-animate mb-2">
              {currentApp === 'vyve' ? 'Vyve' : 'Denominator'}
              <span className="text-blue-400"> Insight Engine</span>
            </h1>
            <div className="flex items-center justify-center gap-2 text-lg text-muted-foreground">
              <Sparkles className="h-5 w-5 text-blue-400 animate-pulse" />
              <p>Upload documents, analyze websites, and gain insights from your data</p>
            </div>
          </div>
          <div className="flex items-center gap-4 justify-center mt-4">
            <Button
              variant="outline"
              onClick={() => navigate('/select-app')}
              className="glass glass-hover  h-10"
            >
              <Settings className="h-4 w-4 mr-2" />
              Switch Application
            </Button>
            <Select
              value={selectedCompany}
              onValueChange={setSelectedCompany}
            >
              <SelectTrigger className="bg-background/50 hover:bg-background/30 transition-all duration-300 w-[180px] border-white/10 h-10 flex items-center leading-none">
                <SelectValue placeholder={companyNames.length === 0 ? "No companies available" : "Select company"} />
              </SelectTrigger>
              <SelectContent className="dark bg-background/80 backdrop-blur-lg border-white/10">
                {companyNames.map((company, index) => (
                  <SelectItem key={index} value={company}>
                    {company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8">
          <Card className="card-glow glass glass-hover group">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl gradient-text group-hover:scale-105 transition-transform">
                  Upload Document
                </CardTitle>
                <Upload className="h-5 w-5 text-blue-400 group-hover:animate-bounce" />
              </div>
              <CardDescription className="text-sm text-blue-200/70">
                Upload and analyze your documents with AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                size="lg"
                onClick={() => setUploadOpen(true)}
                className="w-full button-glow bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg group"
              >
                <Upload className="h-4 w-4 mr-2 transition-transform group-hover:-translate-y-0.5" />
                Upload Document
                <ChevronRight className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-all" />
              </Button>
            </CardContent>
          </Card>

          <Card className="card-glow glass glass-hover group">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl gradient-text group-hover:scale-105 transition-transform">
                  Website Analysis
                </CardTitle>
                <MessageSquare className="h-5 w-5 text-purple-400 group-hover:animate-bounce" />
              </div>
              <CardDescription className="text-sm text-purple-200/70">
                Extract and analyze content from websites
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WebsiteScraper />
            </CardContent>
          </Card>

          <Card className="card-glow glass glass-hover group">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl gradient-text group-hover:scale-105 transition-transform">
                  Clear Data
                </CardTitle>
                <Trash2 className="h-5 w-5 text-red-400 group-hover:animate-bounce" />
              </div>
              <CardDescription className="text-sm text-red-200/70">
                Manage and clear your stored data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                size="lg"
                onClick={handleClearIndex}
                className="w-full button-glow bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg group"
                disabled={isClearing}
              >
                {isClearing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Clearing Index...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2 transition-transform group-hover:-translate-y-0.5" />
                    Clear Index
                    <ChevronRight className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-all" />
                  </>
                )}
              </Button>
              <Button
                size="lg"
                onClick={handleClearDocuments}
                className="w-full button-glow bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg group"
                disabled={isClearingDocs}
              >
                {isClearingDocs ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Clearing Documents...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2 transition-transform group-hover:-translate-y-0.5" />
                    Clear Documents
                    <ChevronRight className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-all" />
                  </>
                )}
              </Button>
              <Button
                size="lg"
                onClick={handleClearWebsites}
                className="w-full button-glow bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg group"
                disabled={isClearingWebsites}
              >
                {isClearingWebsites ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Clearing Websites...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2 transition-transform group-hover:-translate-y-0.5" />
                    Clear Websites
                    <ChevronRight className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-all" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="space-y-8 max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => setDenominatorDialogOpen(true)}
              className="w-full sm:max-w-md button-glow bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg group"
            >
              <PlayCircle className="h-4 w-4 mr-2 transition-transform group-hover:-translate-y-0.5" />
              Run Denominator Analysis
              <ChevronRight className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-all" />
            </Button>

            <Button
              size="lg"
              onClick={() => setVyveDialogOpen(true)}
              className="w-full sm:max-w-md button-glow bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg group"
            >
              <PlayCircle className="h-4 w-4 mr-2 transition-transform group-hover:-translate-y-0.5" />
              Run Vyve Analysis
              <ChevronRight className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-all" />
            </Button>
          </div>

          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/chat")}
              className="w-full sm:max-w-md button-glow bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg group"
            >
              <MessageSquare className="h-4 w-4 mr-2 transition-transform group-hover:-translate-y-0.5" />
              Chat with Documents
              <ChevronRight className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-all" />
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            <Separator className="my-8" />
          </div>

          <div className="w-full">
            <DocumentList selectedCompanyName={selectedCompany} companyNames={companyNames} />
          </div>
        </div>
      </div>

      <DocumentUpload
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploadComplete={handleUploadComplete}
        selectedCompanyName={uploadCompanyName}
        setSelectedCompanyName={setUploadCompanyName}
        companyNames={companyNames}
        setTrigRefetch={setTrigRefetch}
      />

      <PasswordDialog
        open={denominatorDialogOpen}
        onOpenChange={setDenominatorDialogOpen}
        title="Enter Denominator Analysis Password"
        onSubmit={(password) => {
          if (password === "denominator") {
            navigate("/analysis");
          } else {
            toast({
              title: "Access Denied",
              description: "Incorrect password for Denominator Analysis.",
              variant: "destructive",
            });
          }
          setDenominatorDialogOpen(false);
        }}
      />

      <PasswordDialog
        open={vyveDialogOpen}
        onOpenChange={setVyveDialogOpen}
        title="Enter Vyve Analysis Password"
        onSubmit={(password) => {
          if (password === "vyve") {
            navigate("/vyve-analysis2");
          } else {
            toast({
              title: "Access Denied",
              description: "Incorrect password for Vyve Analysis.",
              variant: "destructive",
            });
          }
          setVyveDialogOpen(false);
        }}
      />
    </div>
  );
};

export default Index;
