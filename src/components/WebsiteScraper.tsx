import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { ApifyService } from "@/services/apifyService";
import { Globe2, Loader2, Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ScrapedURL = {
  id: string;
  url: string;
  title: string | null;
  created_at: string | null;
  base_url?: string;
  has_subsections?: boolean;
};

export const WebsiteScraper: React.FC<{ companyName?: string }> = ({ companyName = 'amplitude' }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [scrapedUrls, setScrapedUrls] = useState<ScrapedURL[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);

  const fetchScrapedUrls = async () => {
    //try {
    //  const { data: websiteContent, error } = await supabase
    //    .from('website_content')
    //    .select('id, url, title, created_at')
    //    .order('created_at', { ascending: false });
    //
    //  if (error) throw error;
    //
    //  // Process URLs to identify base URLs and subsections
    //  const processedUrls = websiteContent.map(content => {
    //    const urlObj = new URL(content.url);
    //    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
    //    return {
    //      ...content,
    //      base_url: baseUrl,
    //    };
    //  });
    //
    //  // Group by base URL to identify which ones have subsections
    //  const urlGroups = processedUrls.reduce((acc, curr) => {
    //    acc[curr.base_url] = (acc[curr.base_url] || 0) + 1;
    //    return acc;
    //  }, {} as Record<string, number>);
    //
    //  const uniqueUrls = processedUrls.map(url => ({
    //    ...url,
    //    has_subsections: urlGroups[url.base_url] > 1
    //  }));
    //
    //  setScrapedUrls(uniqueUrls);
    //} catch (error) {
    //  console.error('Error fetching scraped URLs:', error);
    //  toast({
    //    title: "Error",
    //    description: "Failed to load existing URLs",
    //    variant: "destructive",
    //  });
    //}
  };

  //const fetchCompanyId = async () => {
  //  try {
  //    const { data: company, error } = await supabase
  //      .from('companies')
  //      .select('id')
  //      .eq('name', companyName)
  //      .single();
  //
  //    if (error) throw error;
  //    setCompanyId(company.id);
  //  } catch (error) {
  //    console.error('Error fetching company ID:', error);
  //  }
  //};
  
  useEffect(() => {
    fetchScrapedUrls();
    // fetchCompanyId();
  }, []);

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const saveToDocuments = async (url: string) => {
    //try {
    //  // First check if URL already exists
    //  const { data: existingDoc, error: checkError } = await supabase
    //    .from('documents')
    //    .select()
    //    .eq('url', new URL(url).hostname,)
    //    .single();
    //
    //  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows returned
    //    throw checkError;
    //  }
    //
    //  if (existingDoc) {
    //    return existingDoc; // Return existing document if found
    //  }
    //
    //  // Insert new document if not found
    //  const { data, error } = await supabase
    //    .from('documents')
    //    .insert({
    //      filename: new URL(url).hostname,
    //      file_path: url,
    //      url: url,
    //      is_website: true,
    //      content_type: 'website',
    //    })
    //    .select()
    //    .single();
    //
    //  if (error) throw error;
    //  return data;
    //} catch (error) {
    //  console.error('Error saving website to documents:', error);
    //  throw error;
    //}
  };

  const handleSelectUrl = async (selectedUrl: ScrapedURL) => {
    //setOpen(false);
    //setUrl(selectedUrl.url);
    //
    //if (selectedUrl.has_subsections) {
    //  // If the URL has subsections, fetch and save all related URLs
    //  const { data: relatedUrls, error } = await supabase
    //    .from('website_content')
    //    .select('url')
    //    .ilike('url', `${selectedUrl.base_url}%`)
    //    .order('created_at', { ascending: false });
    //
    //  if (error) {
    //    console.error('Error fetching related URLs:', error);
    //    return;
    //  }
    //
    //  // Save all related URLs to documents
    //  for (const relatedUrl of relatedUrls) {
    //    await saveToDocuments(relatedUrl.url);
    //  }
    //
    //  toast({
    //    title: "Success",
    //    description: `Added ${relatedUrls.length} related URLs from ${selectedUrl.base_url}`,
    //  });
    //} else {
    //  // Save single URL
    //  await saveToDocuments(selectedUrl.url);
    //  toast({
    //    title: "Success",
    //    description: "URL added to documents",
    //  });
    //}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url) {
      toast({
        title: "Error",
        description: "Please enter a URL",
        variant: "destructive",
      });
      return;
    }

    if (!validateUrl(url)) {
      toast({
        title: "Error",
        description: "Please enter a valid URL (e.g., https://example.com)",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await ApifyService.scrapeWebsite(url);
      
      if (result) {
        await saveToDocuments(url);
        toast({
          title: "Success",
          description: "Website content has been scraped and saved",
        });
        setUrl('');
        fetchScrapedUrls(); // Refresh the list of scraped URLs
      } else {
        toast({
          title: "Error",
          description: "Failed to scrape website content - no data received",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error in WebsiteScraper:', error);
      
      let errorMessage = "An unexpected error occurred while scraping the website";
      
      if (error instanceof Error) {
        if (error.message.includes('Edge Function')) {
          errorMessage = "Connection to scraping service failed. Please try again in a few moments.";
        } else if (error.message.includes('aborted')) {
          errorMessage = "Scraping was interrupted. Some content may have been saved.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col space-y-2">
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="Enter website URL (e.g., https://example.com)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full"
            pattern="https?://.*"
            title="Please enter a valid URL starting with http:// or https://"
            disabled={isLoading}
          />
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-[200px] justify-between"
                disabled={isLoading}
              >
                <Search className="mr-2 h-4 w-4" />
                Select existing
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
              <Command>
                <CommandInput 
                  placeholder="Search scraped URLs..." 
                  value={searchValue}
                  onValueChange={setSearchValue}
                />
                <CommandList>
                  <CommandEmpty>No URLs found.</CommandEmpty>
                  <CommandGroup>
                    {scrapedUrls.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.url}
                        onSelect={() => handleSelectUrl(item)}
                      >
                        <Globe2 className={cn(
                          "mr-2 h-4 w-4",
                          item.has_subsections && "text-blue-500"
                        )} />
                        <div className="flex flex-col">
                          <span>{item.title || item.url}</span>
                          {item.has_subsections && (
                            <span className="text-xs text-muted-foreground">
                              Includes subsections
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Scraping Website...
          </>
        ) : (
          "Scrape Website"
        )}
      </Button>
      {isLoading && (
        <div className="text-center text-sm text-muted-foreground animate-fade-in">
          Please wait while we analyze the website. This process typically takes 1-5 minutes.
        </div>
      )}
    </form>
  );
};
