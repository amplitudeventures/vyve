import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, Sparkles, AlertCircle } from "lucide-react";

interface Document {
  filename: string;
  content_type: string;
  created_at: string;
}

const formSchema = z.object({
  companyName: z.string().min(2, {
    message: "Please select a company.",
  }),
});

interface CompanyFormProps {
  onCompanyCreated: (companyId: string) => void;
  disabled: boolean;
  isAnalyzing: boolean;
  onStopAnalysis: () => void;
}

export const CompanyForm = ({ onCompanyCreated, disabled, isAnalyzing, onStopAnalysis }: CompanyFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyNames, setCompanyNames] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: "",
    },
  });

  useEffect(() => {
    if (!disabled) {
      form.reset({ companyName: "" });
      setSelectedCompany('');
    }
  }, [disabled, form]);

  useEffect(() => {
    async function fetchCompaniesWithDocuments() {
      try {
        console.log('Fetching companies...');
        // First get all companies
        const response = await fetch('http://localhost:8000/get_companies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        const responseData = await response.json();
        
        if (!responseData || !Array.isArray(responseData.companies)) {
          console.error("Invalid API response format:", responseData);
          setCompanyNames([]);
          return;
        }

        console.log('Found companies:', responseData.companies);

        // For each company, check if it has documents
        const companiesWithDocs = await Promise.all(
          responseData.companies.map(async (company) => {
            console.log(`Checking documents for company: ${company}`);
            try {
              const docResponse = await fetch('http://localhost:8000/get_documents', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: company }),
              });
              
              if (!docResponse.ok) {
                console.log(`Failed to fetch documents for ${company}:`, docResponse.status);
                return null;
              }
              
              const docData = await docResponse.json();
              const hasDocuments = (docData.documents || []).length > 0;
              console.log(`Company ${company} has documents:`, hasDocuments, docData.documents);
              return hasDocuments ? company : null;
            } catch (error) {
              console.error(`Error checking documents for ${company}:`, error);
              return null;
            }
          })
        );

        // Filter out companies with no documents
        const validCompanies = companiesWithDocs.filter(company => company !== null) as string[];
        console.log('Companies with documents:', validCompanies);
        
        if (validCompanies.length === 0) {
          toast({
            title: "No Companies Available",
            description: "There are no companies with associated documents.",
            variant: "destructive",
          });
        }
        
        setCompanyNames(validCompanies);
      } catch (error) {
        console.error('Error fetching companies:', error);
        toast({
          title: "Error",
          description: "Failed to fetch companies with documents",
          variant: "destructive",
        });
        setCompanyNames([]); 
      }
    }
    fetchCompaniesWithDocuments();
  }, [toast]);

  useEffect(() => {
    async function fetchDocuments() {
      if (!selectedCompany) return;
      
      try {
        const response = await fetch('http://localhost:8000/get_documents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: selectedCompany }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch documents');
        }
        
        const data = await response.json();
        setDocuments(data.documents || []);
      } catch (error) {
        console.error('Error fetching documents:', error);
        toast({
          title: "Error",
          description: "Failed to fetch company documents",
          variant: "destructive",
        });
      }
    }

    fetchDocuments();
  }, [selectedCompany, toast]);

  const createCompany = async (values: z.infer<typeof formSchema>) => {
    if (disabled) return;

    setIsSubmitting(true);
    try {
      toast({ title: "Success", description: "Company selected successfully" });
      console.log(`calling analysis with company name: ${selectedCompany}`)
      onCompanyCreated(selectedCompany);
    } catch (error) {
      console.error("Error selecting company:", error);
      toast({ title: "Error", description: "Failed to select company", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-background/50 hover:bg-background/30 transition-all duration-300 border-white/10">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="text-xl gradient-text">Company Information</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(createCompany)} className="space-y-4">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex gap-4">
                      <Select
                        value={field.value}
                        onValueChange={(value) =>{
                          field.onChange(value);
                          setSelectedCompany(value);
                        }}
                        disabled={isAnalyzing}
                      >
                        <SelectTrigger className="bg-background/50 hover:bg-background/30 transition-all duration-300 w-[180px] border-white/10">
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
                      {!isAnalyzing ? (
                        <Button
                          type="submit"
                          disabled={!field.value || companyNames.length === 0}
                          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 flex items-center gap-2"
                        >
                          <Sparkles className="h-4 w-4" />
                          {isSubmitting ? "Processing..." : "Run Analysis"}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onStopAnalysis();
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white font-semibold px-8 flex items-center gap-2"
                        >
                          <AlertCircle className="h-4 w-4" />
                          Stop Analysis
                        </Button>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />
          </form>
        </Form>

        {selectedCompany && documents.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Associated Documents:</h3>
            <div className="space-y-2">
              {documents.map((doc, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-2 p-2 rounded-md bg-background/30 border border-white/10"
                >
                  <FileText className="h-4 w-4 text-blue-400" />
                  <span className="text-sm text-muted-foreground">{doc.filename}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedCompany && documents.length === 0 && (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground">No documents associated with this company.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
