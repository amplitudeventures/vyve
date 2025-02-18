import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { uploadFile as uploadFileToServer } from '@/lib/api';
import { Loader2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import ComboboxWithDropdown from './ui/combobox.tsx';

interface UploadStatus {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  processingDetails?: string;
  processingMethod: ProcessingMethod;
  currentPage?: number;
  totalPages?: number;
  completedAt?: Date;
}

interface DocumentUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
  selectedCompanyName: string;
  setSelectedCompanyName: (arg0: string) => void;
  companyNames: string[],
  setTrigRefetch: React.Dispatch<React.SetStateAction<string>>
}

export type ProcessingMethod = 'standard' | 'vision';

// Add supported file types
const SUPPORTED_FILE_TYPES = {
  PDF: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf']
  },
  DOCUMENT: {
    extensions: ['.doc', '.docx', '.ppt', '.pptx'],
    mimeTypes: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
  },
  TEXT: {
    extensions: ['.txt', '.rtf'],
    mimeTypes: ['text/plain', 'text/rtf']
  },
  IMAGE: {
    extensions: ['.jpg', '.jpeg', '.png', '.tiff'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/tiff']
  }
};

// Get all supported extensions
const SUPPORTED_EXTENSIONS = Object.values(SUPPORTED_FILE_TYPES)
  .flatMap(type => type.extensions)
  .join(',');

// Get all supported mime types
const SUPPORTED_MIME_TYPES = Object.values(SUPPORTED_FILE_TYPES)
  .flatMap(type => type.mimeTypes);

export const DocumentUpload = ({ open, onOpenChange, onUploadComplete, selectedCompanyName, setSelectedCompanyName, companyNames, setTrigRefetch}: DocumentUploadProps) => {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const handleCompanyNameChange = (newCompanyName: string) => {
    setSelectedCompanyName(newCompanyName);
  }

  const handleClose = () => {
    setUploadStatuses([]);
    setIsDragging(false);
    setIsProcessing(false);
    setShowCompletionDialog(false);
    setSelectedCompanyName('');
    onOpenChange(false)
  }
  // Track completion status
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [completionSummary, setCompletionSummary] = useState<{
    successful: number;
    failed: number;
    totalTime?: string;
  }>({ successful: 0, failed: 0 });

  // Add cleanup effect for page refresh/unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Abort all ongoing uploads
      abortControllersRef.current.forEach(controller => {
        controller.abort();
      });
      abortControllersRef.current.clear();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also cleanup on component unmount
      handleBeforeUnload();
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleStop = () => {
    // Stop all ongoing uploads
    abortControllersRef.current.forEach(controller => {
      controller.abort();
    });
    abortControllersRef.current.clear();
    setIsProcessing(false);
    setUploadStatuses(prev =>
      prev.map(status => ({
        ...status,
        status: 'error',
        error: 'Upload cancelled',
        processingDetails: 'Processing cancelled by user'
      }))
    );
    toast({
      title: "Upload Stopped",
      description: "All document uploads were cancelled",
    });
  };

  const updateFileStatus = (fileName: string, updates: Partial<UploadStatus>) => {
    setUploadStatuses(prev =>
      prev.map(status =>
        status.fileName === fileName
          ? { ...status, ...updates }
          : status
      )
    );
  };

  const updateProcessingMethod = (fileName: string, method: ProcessingMethod) => {
    setUploadStatuses(prev =>
      prev.map(status =>
        status.fileName === fileName
          ? { ...status, processingMethod: method }
          : status
      )
    );
  };

  const uploadFile = async (file: File) => {
    const startTime = new Date();
    const controller = new AbortController();
    abortControllersRef.current.set(file.name, controller);

    try {
      const currentStatus = uploadStatuses.find(s => s.fileName === file.name);
      const processingMethod = currentStatus?.processingMethod || 'standard';

      updateFileStatus(file.name, {
        status: 'uploading',
        progress: 0,
        processingDetails: `Starting ${processingMethod === 'vision' ? 'Vision AI' : 'standard'} processing...`
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('processingMethod', processingMethod);

      const result = await uploadFileToServer(
        formData,
        selectedCompanyName,
        companyNames,
        setTrigRefetch,
        controller.signal,
        (update) => {
          if (update.totalPages) {
            const progress = (update.currentPage / update.totalPages) * 100;
            updateFileStatus(file.name, {
              progress,
              currentPage: update.currentPage,
              totalPages: update.totalPages,
              processingDetails: `Processing page ${update.currentPage}/${update.totalPages}`
            });
          }
        }
      );

      const endTime = new Date();
      const processingTime = (endTime.getTime() - startTime.getTime()) / 1000; // in seconds

      updateFileStatus(file.name, {
        status: 'completed',
        progress: 100,
        currentPage: result.totalPages,
        totalPages: result.totalPages,
        completedAt: endTime,
        processingDetails: `Processed ${result.totalPages} pages in ${processingTime.toFixed(1)}s using ${processingMethod === 'vision' ? 'Vision AI' : 'standard'} method`
      });

      toast({
        title: "Success",
        description: `${file.name} processed successfully (${result.totalPages} pages in ${processingTime.toFixed(1)}s)`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      updateFileStatus(file.name, {
        status: 'error',
        error: errorMessage,
        processingDetails: 'Processing failed',
        completedAt: new Date()
      });
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to upload ${file.name}: ${errorMessage}`,
      });
    } finally {
      abortControllersRef.current.delete(file.name);
      // Check if all uploads are complete
      if (abortControllersRef.current.size === 0) {
        const successful = uploadStatuses.filter(s => s.status === 'completed').length;
        const failed = uploadStatuses.filter(s => s.status === 'error').length;

        // Calculate total processing time
        const firstStartTime = Math.min(...uploadStatuses.map(s => startTime.getTime()));
        const lastEndTime = Math.max(...uploadStatuses
          .filter(s => s.completedAt)
          .map(s => s.completedAt!.getTime())
        );
        const totalTime = ((lastEndTime - firstStartTime) / 1000).toFixed(1);

        setCompletionSummary({
          successful,
          failed,
          totalTime
        });
        setShowCompletionDialog(true);
        setIsProcessing(false);
        onUploadComplete();
      }
    }
  };

  const handleFiles = async (files: File[]) => {
    // Validate file types
    const invalidFiles = files.filter(file => !SUPPORTED_MIME_TYPES.includes(file.type));
    if (invalidFiles.length > 0) {
      toast({
        variant: "destructive",
        title: "Unsupported File Type",
        description: `The following files are not supported: ${invalidFiles.map(f => f.name).join(', ')}`
      });
      // Filter out invalid files
      files = files.filter(file => SUPPORTED_MIME_TYPES.includes(file.type));
      if (files.length === 0) return;
    }

    // Add files to the list
    setUploadStatuses(files.map(file => ({
      fileName: file.name,
      progress: 0,
      status: 'pending',
      processingMethod: 'standard' // Default to standard, can be changed per file
    })));
  };

  const startUploads = async () => {
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (!fileInput?.files) {
      console.error('No files found');
      return;
    }

    setIsProcessing(true);
    const uploadPromises = uploadStatuses.map(status => {
      const file = Array.from(fileInput.files || [])
        .find(f => f.name === status.fileName);

      if (!file) {
        console.error(`File ${status.fileName} not found`);
        return Promise.reject(`File ${status.fileName} not found`);
      }

      return uploadFile(file);
    });

    try {
      await Promise.all(uploadPromises);
      const successfulUploads = uploadStatuses.filter(s => s.status === 'completed').length;
      if (successfulUploads > 0) {
        toast({
          title: "Success",
          description: `Successfully uploaded ${successfulUploads} file${successfulUploads > 1 ? 's' : ''}`,
        });
        // Don't close the dialog immediately to show completion status
        setTimeout(() => onOpenChange(false), 1500);
      }
    } catch (error) {
      console.error('Some uploads failed:', error);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    await handleFiles(files);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    await handleFiles(files);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} >
      <DialogContent className="sm:max-w-[800px]" handleClose={handleClose}>
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
        </DialogHeader>

        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${isDragging ? "border-primary bg-primary/10" : "border-gray-300"
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="space-y-6">
            {isProcessing ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="flex items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleStop}
                  >
                    Stop Upload
                  </Button>
                </div>
                <div className="space-y-2 text-center">
                  <p className="font-medium">Processing Documents</p>
                  <p className="text-sm text-muted-foreground">
                    Processing files with their selected methods.
                    This might take a few seconds to a few minutes. Please be patient.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  Drag and drop your documents here, or click to select files
                </p>
                <div>
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileSelect}
                    multiple
                    accept={SUPPORTED_EXTENSIONS}
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={isProcessing}
                  >
                    Select Files
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {uploadStatuses.length > 0 && !isProcessing && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="space-y-4 max-h-[300px] overflow-y-auto">
              {uploadStatuses.map((status) => (
                <div key={status.fileName} className="space-y-2 p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium truncate block">{status.fileName}</span>
                      <span className="text-sm text-gray-500">
                        Select processing method:
                      </span>
                    </div>
                    <RadioGroup
                      value={status.processingMethod}
                      onValueChange={(value) => updateProcessingMethod(status.fileName, value as ProcessingMethod)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="standard" id={`standard-${status.fileName}`} />
                        <Label htmlFor={`standard-${status.fileName}`}>Standard</Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="vision" id={`vision-${status.fileName}`} />
                        <Label htmlFor={`vision-${status.fileName}`}>Vision AI</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              ))}
            </div>
            <Button
              onClick={() => selectedCompanyName ? startUploads() : toast({ title: "Upload Aborted", description: "Please Enter Company Name" })}
              className="w-full"
            >
              Start Upload ({uploadStatuses.length} file{uploadStatuses.length !== 1 ? 's' : ''})
            </Button>
          </div>
        )}

        {uploadStatuses.length > 0 && isProcessing && (
          <div className="mt-4 space-y-4 max-h-[300px] overflow-y-auto">
            {uploadStatuses.map((status) => (
              <div key={status.fileName} className="space-y-2 p-3 border rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium truncate block">{status.fileName}</span>
                    <span className="text-sm text-muted-foreground">
                      {status.status === 'completed' && '✓ Done'}
                      {status.status === 'error' && '✗ Error'}
                      {status.status === 'uploading' && (
                        status.totalPages
                          ? `Processing page ${status.currentPage}/${status.totalPages}`
                          : 'Processing...'
                      )}
                    </span>
                  </div>
                </div>
                <Progress
                  value={status.progress}
                  className={`h-2 ${status.status === 'error'
                    ? 'bg-destructive/20 [&>div]:bg-destructive'
                    : status.status === 'completed'
                      ? 'bg-emerald-100 [&>div]:bg-emerald-500'
                      : 'bg-primary/20 [&>div]:bg-primary'
                    }`}
                />
                {status.processingDetails && (
                  <p className="text-xs text-muted-foreground">{status.processingDetails}</p>
                )}
                {status.error && (
                  <p className="text-xs text-destructive break-words">{status.error}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {showCompletionDialog && (
          <div className="mt-6 p-6 border rounded-lg bg-card">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-emerald-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Upload Complete</h3>
                <p className="text-sm text-muted-foreground">
                  Successfully processed: {completionSummary.successful} file{completionSummary.successful !== 1 ? 's' : ''}
                  {completionSummary.failed > 0 && (
                    <span className="text-destructive"> ({completionSummary.failed} failed)</span>
                  )}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Total processing time</span>
                <span className="font-medium">{completionSummary.totalTime}s</span>
              </div>
              <Button
                className="w-full mt-4"
                onClick={handleClose}
              >
                Close
              </Button>
            </div>
          </div>
        )}
        <div className="p-1">
          <ComboboxWithDropdown
            value={selectedCompanyName || ''}
            onValueChange={handleCompanyNameChange}
            options={companyNames}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
