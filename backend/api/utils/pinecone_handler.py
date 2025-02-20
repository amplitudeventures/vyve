from pinecone import Pinecone, ServerlessSpec
from langchain_community.document_loaders import PyPDFLoader
from langchain.schema import Document
from dotenv import load_dotenv
import uuid
import logging
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from langchain_openai import OpenAIEmbeddings
# load_dotenv()

DIMENSION = 3072
CHUNK_SIZE = 3000 # 800 
CHUNK_OVERLAP = 50
MAX_QUERY_TOKENS = 6000
MODEL_NAME = "o3-mini"
EMBEDDING_MODEL = "text-embedding-3-large"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PineconeError(Exception):
    """Base class for Pinecone-related errors"""
    pass

class DocumentProcessingError(Exception):
    """Error processing a document"""
    pass

class PineconeHandler:
    def __init__(self, index_name, pinecone_api_key, pinecone_environment, openai_api_key):#, api_key: str, environment: str):
        self.index_name = index_name
        self.pinecone_api_key = pinecone_api_key
        self.pinecone_environment = pinecone_environment
        self.openai_api_key = openai_api_key
        self.pc = Pinecone(api_key=pinecone_api_key)
        self.index = self.get_index(index_name)
        self.embeddings = OpenAIEmbeddings(
            model=EMBEDDING_MODEL,
            api_key=openai_api_key
        )
        
    async def get_document_chunks(self, file_name: str) -> list[Document]:
        """Retrieve and process document chunks with retry logic"""
        try:
            temp_path = f"/tmp/{file_name}"
            return []
            
        except Exception as e:
            raise DocumentProcessingError(f"Failed to process document {file_name}: {str(e)}")
    
    def get_index(self, index_name: str):
        try:
            index_names = self.pc.list_indexes().names()
            # logger.info(index_names)
            if index_name not in index_names:
                try:
                    self.pc.create_index(
                        name=index_name,
                        dimension=DIMENSION,
                        metric='cosine',
                        spec=ServerlessSpec(cloud='aws', region='us-east-1')
                    )
                    logger.info(f"Created index {index_name}")
                except Exception as create_error:
                    raise Exception(f"Failed to create index {index_name}: {str(create_error)}")            
            logger.info(f"Index {index_name} already exists")
            index = self.pc.Index(index_name)
            return index
        except Exception as e:
            #logger.info(f"Error in _get_index for {index_name}: {str(e)}")
            raise RuntimeError(f"Failed to get or create Pinecone index {index_name}: {str(e)}")
    
    def read_doc(self, directory):
        """Load documents from a directory."""
        return PyPDFLoader(directory).load()
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(Exception)
    )
    def get_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings with retry logic"""
        try:
            return self.embeddings.embed_documents(texts)
        except Exception as e:
            logger.error(f"Error generating embeddings: {str(e)}")
            raise PineconeError(f"Failed to generate embeddings: {str(e)}")

    async def upsert_documents(self, file_names: list[str], namespace: str):
        """Embed and upsert documents with improved error handling"""
        try:
            # Clean up old documents
            if self.namespace_exists(namespace):
                self.delete_namespace(namespace)
            logger.info(f"Upserting documents for namespace: {namespace}")

            # Process documents
            documents = []
            for file_name in file_names:
                try:
                    chunks = await self.get_document_chunks(file_name)
                    documents.extend(chunks)
                except DocumentProcessingError as e:
                    logger.error(f"Skipping document {file_name} due to error: {str(e)}")
                    continue

            if not documents:
                raise PineconeError("No documents were successfully processed")

            # Generate vectors
            vectors = []
            for doc in documents:
                try:
                    metadata = {
                        "text": doc.page_content,
                        "filename": file_names[0],  # Using first filename as reference
                        "page": doc.metadata.get("page", 0)
                    }
                    metadata.update(doc.metadata)
                    
                    vector = await asyncio.wait_for(
                        asyncio.to_thread(self.get_embeddings, [doc.page_content]),
                        timeout=30
                    )
                    vectors.append((str(uuid.uuid4()), vector[0], metadata))
                except Exception as e:
                    logger.error(f"Error processing document chunk: {str(e)}")
                    continue

            if not vectors:
                raise PineconeError("No vectors were successfully generated")

            # Upsert vectors in smaller batches
            batch_size = 100
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                try:
                    await asyncio.wait_for(
                        asyncio.to_thread(
                            self.index.upsert,
                            vectors=batch,
                            # namespace=namespace,
                            show_progress=True
                        ),
                        timeout=60
                    )
                    logger.info(f"Upserted batch {i//batch_size + 1} of {(len(vectors) + batch_size - 1)//batch_size}")
                except Exception as e:
                    logger.error(f"Error upserting batch: {str(e)}")
                    raise PineconeError(f"Failed to upsert vector batch: {str(e)}")

        except Exception as e:
            logger.error(f"Error in upsert_documents: {str(e)}")
            raise PineconeError(f"Document processing failed: {str(e)}")

    def query_similar(self, query: str, top_k: int = 5, namespace: str = None):
        """
        Query similar documents from Pinecone.
        - Use this function when you need to find relevant information from the documents
        - Provide a clear and concise question that directly relates to the information you need

        Args:
            query (str): The query to search for
            top_k (int): Number of results to return
            namespace (str): The namespace to search in
        Returns:
            List[Dict]: A list of dictionaries containing score, text, and metadata
        """
        try:
            if not query:
                logger.error("Empty query provided")
                return []

            # if namespace and not self.namespace_exists(namespace):
            #     logger.error(f"Namespace {namespace} does not exist")
            #     return []

            logger.info(f"Generating embedding for query: {query[:100]}...")
            query_embedding = self.get_embeddings([query])[0]   
            logger.info(f"Successfully generated query embedding of dimension {len(query_embedding)}")

            # Wrap the Pinecone query in asyncio.wait_for
            try:
                results = self.index.query(
                    vector=query_embedding,
                    top_k=top_k,
                    include_metadata=True,
                    # namespace=namespace
                )
                logger.info(f"Query results: {results}")
            except asyncio.TimeoutError:
                logger.error("Query timed out after 30 seconds")
                return []
            except Exception as e:
                logger.error(f"Error during query: {str(e)}")
                return []
            
            if not results.matches:
                logger.warning(f"No matches found for query in namespace {namespace}")
                return []

            # Process and sort results
            processed_results = []
            # for result in results.matches:
            #     if not hasattr(result, 'score') or not hasattr(result, 'metadata'):
            #         logger.warning(f"Invalid result format: {result}")
            #         continue
                    
            #     # Convert text to raw value if it's a percentage or number
            #     text = result.metadata.get("text", "")
            #     if text.endswith('%'):
            #         try:
            #             # Try to convert percentage to raw number
            #             raw_value = float(text.rstrip('%'))
            #             text = f"{raw_value}%"
            #         except ValueError:
            #             pass
            #     elif text.isdigit():
            #         # Convert string numbers to raw numbers
            #         text = int(text)
            #     elif text.lower() in ['true', 'false']:
            #         # Convert string booleans to raw booleans
            #         text = text.lower() == 'true'
                
            #     processed_results.append({
            #         "score": result.score,
            #         "text": text,
            #         "metadata": {k:v for k,v in result.metadata.items() if k == "page"}
            #     })

            # Sort by score in descending order
            sorted_results = sorted(results.matches, key=lambda x: x.score, reverse=True)
            logger.info(f"Returning {len(sorted_results)} processed results")
            return sorted_results

        except Exception as e:
            logger.error(f"Error in query_similar: {str(e)}")
            return []
        
    def namespace_exists(self, namespace: str) -> bool:
        """
        Check if a namespace exists in the index.
        
        Args:
            namespace (str): The namespace to check
            
        Returns:
            bool: True if the namespace exists, False otherwise
        """
        try:
            # Get statistics about the index
            stats = self.index.describe_index_stats()
            logger.info(stats)
            # Check if the namespace exists in the namespaces dictionary
            return namespace in stats.namespaces
        except Exception as e:
            logger.info(f"Error checking namespace existence: {str(e)}")
            return False
            
    def delete_namespace(self, namespace: str) -> bool:
        """
        Delete a namespace from the index.
        
        Args:
            namespace (str): The namespace to delete
            
        Returns:
            bool: True if deletion was successful, False otherwise
        """
        try:
            if not self.namespace_exists(namespace):
                logger.info(f"Namespace {namespace} does not exist")
                return False
                
            self.index.delete(delete_all=True, namespace=namespace)
            logger.info(f"Successfully deleted namespace: {namespace}")
            return True
        except Exception as e:
            logger.info(f"Error deleting namespace: {str(e)}")
            return False
        
    def delete_index(self, company_name: str):
        """Delete all vectors from the index."""
        try:
            # First check if the index exists and is ready
            if not self.index:
                self.index = self.get_index(company_name)

            if not company_name:
                raise Exception("Company name is required")
            
            if self.namespace_exists(company_name):
                self.delete_namespace(company_name)

            # Get stats to check if there's anything to delete
            stats = self.index.describe_index_stats()
            if stats.total_vector_count == 0:
                logger.info("Index is already empty")
                return True

            # Delete all vectors
            self.index.delete(delete_all=True, namespace='')
            logger.info("Successfully deleted all vectors from index")
            return True
        except Exception as e:
            logger.error(f"Error deleting index contents: {str(e)}")
            raise Exception(f"Failed to clear index: {str(e)}")
        


if __name__ == "__main__":
    import os 
    from dotenv import load_dotenv
    load_dotenv()

    index_name = "denominator-embeddings"
    api_key = os.getenv("PINECONE_ATHEM_API_KEY")
    environment = os.getenv("PINECONE_ATHEM_ENVIRONMENT")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    print(f'api_key: {api_key}')
    print(f'environment: {environment}')
    print(f'openai_api_key: {openai_api_key}')
    pc = PineconeHandler(index_name, api_key, environment, openai_api_key)
    pc.query_similar("emissions offset")