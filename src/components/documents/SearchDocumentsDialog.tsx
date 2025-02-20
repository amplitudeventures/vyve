import { useState, useEffect } from 'react';
import { FileIcon, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Document } from '@/types/documents';

interface SearchDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDocument: (doc: Document) => Promise<void>;
}

export const SearchDocumentsDialog = ({ 
  open, 
  onOpenChange, 
  onSelectDocument 
}: SearchDocumentsDialogProps) => {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDocuments = async () => {
    //setLoading(true);
    //try {
    //  const { data, error } = await supabase
    //    .from('documents')
    //    .select('*')
    //    .order('created_at', { ascending: false });
    //
    //  if (error) throw error;
    //  setDocuments(data || []);
    //} catch (error) {
    //  console.error('Error fetching documents:', error);
    //  toast({
    //    title: "Error",
    //    description: "Failed to fetch documents",
    //    variant: "destructive",
    //  });
    //} finally {
    //  setLoading(false);
    //}
  };

  useEffect(() => {
    if (open) {
      fetchDocuments();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Document</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground">No documents found</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  className="flex items-center space-x-3 p-3 hover:bg-accent rounded-lg w-full text-left transition-colors"
                  onClick={() => onSelectDocument(doc)}
                >
                  <FileIcon className="h-5 w-5 text-blue-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{doc.filename}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(doc.created_at || '').toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
