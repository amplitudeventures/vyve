export interface WebsiteContent {
  id?: string;
  url: string;
  title?: string;
  description?: string;
  main_content?: any;
  headings?: any;
  depth?: number;
  links_found?: number;
  created_at?: string;
}

export interface ApifyDatasetItem {
  url: string;
  title?: string;
  description?: string;
  text?: string;
  headings?: any;
  depth?: number;
  links?: any[];
}