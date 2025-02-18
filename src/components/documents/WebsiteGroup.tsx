import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Globe2, Trash2 } from "lucide-react";
import { DocumentTableRow } from "./DocumentTableRow";
import { formatFileSize } from "./utils";

interface WebsiteGroupProps {
  baseUrl: string;
  docs: Array<{
    id: string;
    filename: string;
    content_type: string;
    size: number;
    created_at: string;
    url: string | null;
    is_website: boolean;
  }>;
  onRemove: (id: string) => void;
}

export const WebsiteGroup = ({ baseUrl, docs, onRemove }: WebsiteGroupProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const mainDoc = docs[0];

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent link click when removing
    onRemove(mainDoc.id);
  };

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <Globe2 className="h-4 w-4" />
            <a 
              href={baseUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {baseUrl}
            </a>
          </div>
        </TableCell>
        <TableCell>{mainDoc.content_type}</TableCell>
        <TableCell>{formatFileSize(mainDoc.size)}</TableCell>
        <TableCell>
          {new Date(mainDoc.created_at).toLocaleString()}
        </TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            className="hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
      {isExpanded && docs.slice(1).map(doc => (
        <DocumentTableRow 
          key={doc.id} 
          doc={doc}
          onRemove={onRemove}
        />
      ))}
    </>
  );
};