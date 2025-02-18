import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Document } from "@/types/documents";
import { formatBytes } from "@/utils/formatBytes";
import { formatDate } from "@/utils/formatDate";
import { Skeleton } from "@/components/ui/skeleton";

interface DocumentsTableProps {
  loading: boolean;
  documents: Document[];
  queue: Document[];
  onRemove: (doc: Document) => void;
}

export const DocumentsTable = ({
  loading,
  documents,
  queue,
  onRemove
}: DocumentsTableProps) => {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No documents selected
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Added</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((document) => (
          <TableRow key={document.id}>
            <TableCell className="font-medium">{document.filename}</TableCell>
            <TableCell>{formatBytes(document.size)}</TableCell>
            <TableCell>{formatDate(document.created_at)}</TableCell>
            <TableCell>
              {!document.should_process ? (
                <span className="text-green-500">✓ Processed</span>
              ) :  (
                <span className="text-muted-foreground">Not processed</span>
              )}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(document)}
              >
                {queue.includes(document) ? (
                  <Trash2 className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
