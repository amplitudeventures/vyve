import { Button } from "@/components/ui/button";
import { Loader2, SendHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";

interface DocumentProcessingProps {
  isProcessing: boolean;
  onProcess: () => void;
  onCancel: () => void;
  disabled: boolean;
  currentDocument?: string;
  progress?: {
    current: number;
    total: number;
    vectorCount?: number;
  };
}

export const DocumentProcessing = ({
  isProcessing,
  onProcess,
  onCancel,
  disabled,
  currentDocument,
  progress
}: DocumentProcessingProps) => {
  return (
    <div className="flex items-center gap-4">
      {isProcessing ? (
        <>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={onCancel}
            className="flex items-center gap-2"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Cancel Processing
          </Button>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              {currentDocument ? (
                <>
                  Processing {currentDocument}
                  {progress && (
                    <span className="ml-2">
                      ({progress.current} of {progress.total} chunks
                      {progress.vectorCount !== undefined && `, ${progress.vectorCount} vectors`})
                    </span>
                  )}
                </>
              ) : (
                "Initializing embedding generation..."
              )}
            </span>
          </div>
        </>
      ) : (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onProcess}
          disabled={disabled}
          className="flex items-center gap-2"
        >
          <SendHorizontal className="h-4 w-4" />
          Process Documents
        </Button>
      )}
    </div>
  );
};