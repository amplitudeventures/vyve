export const formatFileSize = (bytes: number) => {
  if (!bytes) return 'N/A';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

export const groupDocumentsByBaseUrl = (documents: Array<{
  id: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
  url: string | null;
  is_website: boolean;
}>) => {
  return documents.reduce((acc, doc) => {
    if (doc.is_website && doc.url) {
      try {
        const url = new URL(doc.url);
        const baseUrl = `${url.protocol}//${url.hostname}`;
        if (!acc[baseUrl]) {
          acc[baseUrl] = [];
        }
        acc[baseUrl].push(doc);
      } catch {
        if (!acc['others']) acc['others'] = [];
        acc['others'].push(doc);
      }
    } else {
      if (!acc['others']) acc['others'] = [];
      acc['others'].push(doc);
    }
    return acc;
  }, {} as Record<string, typeof documents>);
};