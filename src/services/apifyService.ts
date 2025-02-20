import { WebsiteContent } from '@/types/apify';
import { transformApifyDataToSupabase } from '@/utils/dataTransformers';

const SUPABASE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export class ApifyService {
  static async scrapeWebsite(url: string): Promise<WebsiteContent | null> {
    try {
      // Ensure URL is properly formatted
      let formattedUrl = url.trim();
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = `https://${formattedUrl}`;
      }
      // Remove any trailing slashes and port specifications
      formattedUrl = formattedUrl.replace(/:\/$/, '').replace(/\/$/, '');
      
      console.log('Starting scrape for URL:', formattedUrl);

      const response = await fetch(`${SUPABASE_FUNCTION_URL}/scrape-website`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ url: formattedUrl })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to scrape website');
      }

      const functionResponse = await response.json();

      console.log('Received scraping response:', functionResponse);

      if (!functionResponse || functionResponse.length === 0) {
        console.error('No data found from scraping');
        return null;
      }
      console.log('Function response:', functionResponse);
      const transformedData = transformApifyDataToSupabase(functionResponse[0], formattedUrl);
      
      // Get the text from the function response
      const text = functionResponse[0].text;

      
      console.log('Transformed data:', transformedData);
      
      //const { data: savedData, error } = await supabase
      //  .from('website_content')
      //  .insert(transformedData)
      //  .select()
      //  .single();
      //
      //if (error) {
      //  console.error('Error saving to Supabase:', error);
      //  return null;
      //}
      const savedData: WebsiteContent = null;
      console.log('Successfully saved data:', savedData);
      return savedData;
    } catch (error) {
      console.error('Error in scrapeWebsite:', error);
      throw error;
    }
  }
}
