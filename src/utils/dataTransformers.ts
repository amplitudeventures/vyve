import { ApifyDatasetItem, WebsiteContent } from "@/types/apify";

export const transformApifyDataToSupabase = (
  item: ApifyDatasetItem,
  originalUrl: string
): Omit<WebsiteContent, 'id' | 'created_at'> => {
  console.log('Transforming data for URL:', originalUrl);
  console.log('Original item:', item);
  
  const transformed = {
    url: originalUrl,
    title: item.title || '',
    description: item.description || '',
    main_content: item.text || null,
    headings: item.headings || null,
    depth: item.depth || 0,
    links_found: item.links?.length || 0,
  };
  
  console.log('Transformed data:', transformed);
  return transformed;
};