import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Globe2 } from "lucide-react";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface WebsiteSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websites: Array<{
    id: string;
    url: string;
    title: string | null;
    created_at: string | null;
  }>;
  onSelect: (website: { id: string; url: string; title: string | null; created_at: string | null }) => void;
}

export const WebsiteSelector = ({ 
  open, 
  onOpenChange, 
  websites, 
  onSelect 
}: WebsiteSelectorProps) => {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle>Add Website</DialogTitle>
      <DialogDescription>Select a website to add to your documents.</DialogDescription>
      <CommandInput placeholder="Search available websites..." />
      <CommandList>
        <CommandEmpty>No websites found.</CommandEmpty>
        <CommandGroup heading="Available Websites">
          {websites.map((website) => (
            <CommandItem
              key={website.id}
              onSelect={() => {
                onSelect(website);
                onOpenChange(false);
              }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Globe2 className="h-4 w-4" />
              {website.title || website.url}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};