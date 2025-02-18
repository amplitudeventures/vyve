import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { FileIcon, Globe2, Trash2, X } from "lucide-react";
import { formatFileSize } from "./utils";

interface DocumentTableRowProps {
  doc: {
    id: string;
    filename: string;
    content_type: string;
    size: number;
    created_at: string;
    url: string | null;
    is_website: boolean;
  };
  onRemove: (id: string) => void;
}

export const DocumentTableRow = ({ doc, onRemove }: DocumentTableRowProps) => {
  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent link click when removing
    onRemove(doc.id);
  };

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          {doc.is_website ? (
            <>
              <Globe2 className="h-4 w-4" />
              <a 
                href={doc.url || '#'} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {doc.filename}
              </a>
            </>
          ) : (
            <>
              <FileIcon className="h-4 w-4" />
              <span className="font-medium">{doc.filename}</span>
            </>
          )}
        </div>
      </TableCell>
      <TableCell>{doc.content_type}</TableCell>
      <TableCell>{formatFileSize(doc.size)}</TableCell>
      <TableCell>
        {new Date(doc.created_at).toLocaleString()}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          className="hover:text-red-500"
        >
          {doc.is_website ? <X className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </TableCell>
    </TableRow>
  );
};