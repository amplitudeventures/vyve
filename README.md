# Document Processing and Embedding Service

This project provides a document processing and embedding service that integrates with Supabase and Pinecone for document storage and vector search capabilities.

## Features

- Document text extraction and processing
- Chunking of large documents for efficient processing
- Generation of embeddings using multilingual-e5-large model
- Vector storage in Pinecone for semantic search
- Progress tracking and error handling
- Support for both local development and production environments

## Prerequisites

- Node.js (v16 or higher)
- Python 3.8+
- Supabase account and project
- Pinecone account and API key

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd <repository-name>
```

2. Install dependencies:
```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
```

3. Configure environment variables:
- Copy `.env.example` to `.env`
- Fill in the required environment variables:
  ```
  VITE_PINECONE_API_KEY=your_pinecone_api_key
  VITE_PINECONE_ENVIRONMENT=your_pinecone_environment
  PINECONE_INDEX_NAME=your_index_name
  SUPABASE_URL=your_supabase_url
  SUPABASE_ANON_KEY=your_supabase_anon_key
  SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
  ```

4. Start the development server:
```bash
# Start the frontend
npm run dev

# Start the embedding service (in a separate terminal)
cd supabase/functions/generate-embeddings
python index.py
```

## Architecture

The system consists of several components:

1. Frontend Service:
   - Handles document upload and management
   - Processes documents into chunks
   - Communicates with the embedding service

2. Embedding Service:
   - Runs as a local server in development or Supabase Edge Function in production
   - Generates embeddings using the multilingual-e5-large model
   - Manages vector storage in Pinecone

3. Vector Storage:
   - Uses Pinecone for efficient vector storage and similarity search
   - Maintains metadata about document chunks

## Development

The project can run in two modes:

### Local Development
- Frontend runs on Vite dev server
- Embedding service runs locally on port 8081
- Direct communication with Pinecone for vector operations

### Production
- Frontend deployed to your hosting platform
- Embedding service runs as a Supabase Edge Function
- Secure communication through Supabase

## API Reference

### Embedding Service Endpoints

POST /
- Processes documents and generates embeddings
- Request body:
  ```json
  {
    "documents": [{
      "id": "string",
      "filename": "string",
      "content": "string",
      "batchIndex": number,
      "totalBatches": number
    }],
    "processId": "string"
  }


  ```


# deploy functions



- Streaming response with progress updates

## Troubleshooting

Common issues and solutions:

1. "Input length exceeded" error:
   - The system automatically chunks documents to stay within the model's 96-input limit
   - Check chunk size configuration if you encounter this error

2. Connection issues:
   - Verify environment variables are correctly set
   - Ensure Pinecone and Supabase services are accessible

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[Your chosen license]