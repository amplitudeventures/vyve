import { Button } from "@/components/ui/button";
import { Globe2, Search } from "lucide-react";
import { DocumentProcessing } from "./DocumentProcessing";

interface DocumentActionsProps {
  isProcessing: boolean;
  onProcess: () => void;
  onCancel: () => void;
  onOpenSearch: () => void;
  onOpenWebsite: () => void;
  documentsCount: number;
  currentDocument?: string;
  progress?: {
    current: number;
    total: number;
    vectorCount?: number;
  };
}

export const DocumentActions = ({
  isProcessing,
  onProcess,
  onCancel,
  onOpenSearch,
  onOpenWebsite,
  documentsCount,
}: DocumentActionsProps) => {



  return (
    <div className="flex gap-2">
      <DocumentProcessing
        isProcessing={isProcessing}
        onProcess={onProcess}
        onCancel={onCancel}
        disabled={documentsCount === 0}
      />
      <Button variant="outline" size="sm" onClick={onOpenSearch}>
        <Search className="h-4 w-4 mr-2" />
        Search Documents
      </Button>
      <Button variant="outline" size="sm" onClick={onOpenWebsite}>
        <Globe2 className="h-4 w-4 mr-2" />
        Add Website
      </Button>
    </div>
  );
};
