import { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { WebsiteSelector } from './documents/WebsiteSelector';
import { SearchDocumentsDialog } from './documents/SearchDocumentsDialog';
import { EmbeddingService } from '@/services/embeddingService';
import { Document, StorageDocument } from '@/types/documents';
import { DocumentActions } from './documents/DocumentActions';
import { DocumentsTable } from './documents/DocumentsTable';

type WebsiteContent = {
  id: string;
  url: string;
  title: string | null;
  created_at: string | null;
};

const DocumentList = ({ selectedCompanyName, companyNames }) => {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [processingQuery, setProcessingQuery] = useState<Document[]>([]);
  const [scrapedLinks, setScrapedLinks] = useState<WebsiteContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [openWebsite, setOpenWebsite] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [processingEmbeddings, setProcessingEmbeddings] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [embeddingProgress, setEmbeddingProgress] = useState<{
    currentDocument?: string;
    current: number;
    total: number;
    vectorCount?: number;
  } | null>(null);

  const refreshLatestContent = async () => {
    try {
      await supabase.rpc('refresh_latest_website_content');
    } catch (error) {
      console.error('Error refreshing latest content:', error);
    }
  };

  const addStorageDocument = async (doc: Document) => {
    try {
      if (!selectedCompanyName) {
        toast({
          title: "Error",
          description: "Please select a company first",
          variant: "destructive",
        });
        return;
      }

      // Get company ID from Supabase directly
      const { data: companyData, error: companyError } = await supabase
        .from('companies_test')
        .select('id')
        .eq('name', selectedCompanyName)
        .single();

      if (companyError || !companyData) {
        toast({
          title: "Error",
          description: "Selected company not found",
          variant: "destructive",
        });
        return;
      }

      // Update document's company_id
      const { error: updateError } = await supabase
        .from('documents')
        .update({ company_id: companyData.id })
        .eq('id', doc.id);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Success",
        description: "Document selected successfully",
      });

      setOpenSearch(false);
      fetchDocuments();
    } catch (error) {
      console.error('Error selecting document:', error);
      toast({
        title: "Error",
        description: "Failed to select document",
        variant: "destructive",
      });
    }
  };

  const fetchDocuments = async () => {
    try {
      if(!companyNames.includes(selectedCompanyName)){
        setDocuments([]);
        return;
      }
      await refreshLatestContent();
      const response = await fetch('http://localhost:8000/get_documents', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedCompanyName })
      });

      if (!response.ok) {
        throw Error("Error Fetching");
      }

      const data = await response.json();
      console.log("Fetched: ", data);
      setDocuments(data.documents || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addToDocuments = async (website: WebsiteContent) => {
    try {
      console.log('Adding website to documents:', website);

      const { data: existingDoc } = await supabase
        .from('documents')
        .select('id')
        .eq('url', website.url)
        .single();

      if (existingDoc) {
        toast({
          title: "Info",
          description: "This website is already in your documents",
        });
        setOpenWebsite(false);
        return;
      }

      const { error } = await supabase
        .from('documents')
        .insert({
          filename: website.title || website.url,
          file_path: website.url,
          content_type: 'website',
          size: 0,
          url: website.url,
          is_website: true,
          should_process: true
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Website added to documents",
      });

      setOpenWebsite(false);
      fetchDocuments();
    } catch (error) {
      console.error('Error adding website to documents:', error);
      toast({
        title: "Error",
        description: "Failed to add website to documents",
        variant: "destructive",
      });
    }
  };

  const toggleFromQueue = (doc: Document) => {
    if (processingQuery.includes(doc)) {
      setProcessingQuery(prev => prev.filter(item => item != doc));
      toast({ title: "notice", description: "Document removed from queue" });
    } else {
      setProcessingQuery(prev => [...prev, doc]);
      toast({ title: "notice", description: "Document added to queue" });
    }
  }

  const removeDocument = async (doc: Document) => {
    try {
      console.log('Toggling document processing status, ID:', doc.id);

      // Call the stored procedure to toggle status
      const { error: updateError } = await supabase
        .rpc('toggle_document_should_process', {
          document_id: doc.id
        });

      if (updateError) {
        console.error('Error updating document:', updateError);
        throw updateError;
      }

      // Get the updated document to ensure we have the correct state
      const { data: updatedDoc, error: fetchError } = await supabase
        .from('documents')
        .select('should_process')
        .eq('id', doc.id)
        .single();

      if (fetchError) throw fetchError;

      // Update the document in local state with the actual database value
      setDocuments(prevDocuments => prevDocuments.map(d =>
        d.id === doc.id ? { ...d, should_process: updatedDoc.should_process } : d
      ));

      toast({
        title: "Success",
        description: updatedDoc.should_process ? "Document added to processing queue" : "Document removed from processing queue",
      });
    } catch (error) {
      console.error('Error updating document:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update document",
        variant: "destructive",
      });
    }
  };

  const handleGenerateEmbeddings = async () => {
    if (processingQuery.length === 0) {
      toast({ title: "Error", description: "Processing Queue is empty, please add documents to process" });
      return;
    }
    try {
      setProcessingEmbeddings(true);
      setEmbeddingProgress(null);
      const processId = crypto.randomUUID();
      setProcessingId(processId);

      // Debug logging
      console.log('Documents to process:', documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        embedding_status: doc.embedding_status,
        content_available: !!doc.content
      })));

      // Set up progress handler
      const onProgress = async (data: any) => {
        if (data.type === 'progress') {
          // Update the current document's status to 'processing'
          if (data.document) {
            setDocuments(prevDocs => prevDocs.map(doc =>
              doc.filename === data.document
                ? { ...doc, embedding_status: 'processing' }
                : doc
            ));
          }

          setEmbeddingProgress({
            currentDocument: data.document,
            current: data.batch,
            total: data.totalBatches,
            vectorCount: data.vectors_processed
          });
        } else if (data.type === 'complete') {
          // Update completed document's status
          if (data.document) {
            setDocuments(prevDocs => prevDocs.map(doc =>
              doc.filename === data.document
                ? { ...doc, embedding_status: 'completed' }
                : doc
            ));
          }

          // Reset progress on completion
          setEmbeddingProgress(null);
          setProcessingEmbeddings(false);
          setProcessingId(null);

          toast({
            title: "Success",
            description: data.message,
          });

          // Refresh documents to get latest status
          fetchDocuments();
        }
      };

      try {
        const requestBody = {
          documents: processingQuery,
          company_name: selectedCompanyName,
        };

        const response = await fetch('http://localhost:8000/process_documents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch document content: ${response.statusText}`);
        }

        const responseData = await response.json();

        console.log('Document processing response:', responseData);

        if (!responseData?.message) {
          throw new Error('No content available for the document');
        }
        setEmbeddingProgress(null);
        setProcessingEmbeddings(false);
        setProcessingId(null);
        fetchDocuments();

      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to process`);
        }
        throw error;
      }

      // Final refresh to ensure we have the latest status
    } catch (error) {
      console.error('Error generating embeddings:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process documents",
        variant: "destructive",
      });
      setEmbeddingProgress(null);
      setProcessingEmbeddings(false);
      setProcessingId(null);
    }
  };

  const handleCancelProcessing = async () => {
    if (processingId) {
      try {
        await EmbeddingService.cancelProcess(processingId);

        toast({
          title: "Processing Cancelled",
          description: "Document processing has been cancelled",
        });

        setProcessingEmbeddings(false);
        setProcessingId(null);
      } catch (error) {
        console.error('Error cancelling process:', error);
        toast({
          title: "Error",
          description: "Failed to cancel processing",
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedCompanyName])

  return (
    <>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileIcon className="h-5 w-5" />
              Uploaded Documents
            </div>
            <DocumentActions
              isProcessing={processingEmbeddings}
              onProcess={handleGenerateEmbeddings}
              onCancel={handleCancelProcessing}
              onOpenSearch={() => setOpenSearch(true)}
              onOpenWebsite={() => setOpenWebsite(true)}
              documentsCount={documents.length}
              currentDocument={embeddingProgress?.currentDocument}
              progress={embeddingProgress}
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentsTable
            loading={loading}
            documents={documents}
            queue={processingQuery}
            onRemove={toggleFromQueue}
          />
        </CardContent>
      </Card>

      <SearchDocumentsDialog
        open={openSearch}
        onOpenChange={setOpenSearch}
        onSelectDocument={addStorageDocument}
      />

      <WebsiteSelector
        open={openWebsite}
        onOpenChange={setOpenWebsite}
        websites={scrapedLinks}
        onSelect={addToDocuments}
      />
    </>
  );
};

export default DocumentList;
