
import os
from langchain.tools import Tool
from dotenv import load_dotenv
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_openai import ChatOpenAI
from .pinecone_handler import PineconeHandler
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
import logging
import asyncio


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

MODEL_NAME = 'o3-mini'

SYSTEM_PROMPT = """

You are an AI assistant designed to retrieve and process information from a Pinecone vector database. 
Your primary responsibilities are:

    Retrieval: Use the provided Pinecone tool to search for relevant information based on the given query. 
    Ensure you retrieve all necessary and related data before formulating a response.
    
    Accuracy: Your responses must be strictly based on the retrieved data. 
    You must not generate or infer any information that is not explicitly found in the retrieved content.
    
    Completeness: Before responding, verify that you have gathered enough information to provide a thorough and accurate answer. 
    If additional data is needed, perform another retrieval before proceeding.
    
    Response Formatting: Structure your response exactly as requested by the user. Whether the user asks for a summary, 
    a direct answer, a structured report, or any other specific format, ensure that the response adheres strictly to their instructions.

If the retrieved information is insufficient to answer the query, state clearly that the necessary information is not available rather 
than making assumptions or fabrications. Your goal is to provide reliable and verifiable answers based strictly on retrieved content.
"""

USER_PROMPT = """
{input}
"""

class LangChainProcessor:
    def __init__(self, pc=None):
        self.pc = pc
        self.model = MODEL_NAME
        self.llm = ChatOpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            model=self.model,
            max_retries=3,
            timeout=60,
            verbose=True
        )
        
        self.system_prompt = SYSTEM_PROMPT
        self.user_prompt = USER_PROMPT
        self.thought_process = []
        self.executor = self.get_executor()

        logger.info("Initialized LangChainProcessor")

    def get_executor(self):
        """Create a new executor instance with async support"""
        chat_prompt = ChatPromptTemplate.from_messages([
            ("system", self.system_prompt),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
            ("human", self.user_prompt)
        ])

        # Create tools that use async methods
        search_tool = Tool(
            name="Search_documents",
            func=self.query_similar_wraped,
            description="Use this tool to search documents..."
        )
        
        save_thought_process_tool = Tool(
            name="Save_thought_process",
            func=self.save_thought_process,
            description="Use this tool to save thought process..."
        )

        tools = [search_tool, save_thought_process_tool]
        
        agent = create_tool_calling_agent(self.llm, tools, chat_prompt)
        executor = AgentExecutor.from_agent_and_tools(
            agent=agent,
            tools=tools,
            verbose=True,
            max_iterations=None,
            return_intermediate_steps=True,
            handle_parsing_errors=True
        )
        return executor

    def analyze_phase(self, user_prompt):
        try:
            # Get executor and initial token count
            try:
                response = self.executor.invoke({
                    "input": user_prompt,
                })
                return response['output']
            except Exception as exec_e:
                logger.error(f"Error in executor: {str(exec_e)}")
                raise
            
        except Exception as e:
            logger.error(f"Error processing question: {str(e)}")
            raise

    def save_thought_process(self, thought_process):
        """Save the thought process to the thought_process list"""
        if not isinstance(thought_process, str):
            logger.warning(f"Invalid thought process type: {type(thought_process)}")
            return
        self.thought_process.append(thought_process)
        logger.debug(f"Saved thought process: {thought_process[:100]}...")

    def query_similar_wraped(self, query: str, top_k=5):
        """
        Args:
            query (str): The query to search for
        Returns:
            List[Dict]: A list of dictionaries containing score, text, and metadata
        """
        if not self.pc:
            logger.error("PineConeHandler not initialized")
            return []
        try:
            similarity_search = self.pc.query_similar(query, top_k)
            if not similarity_search:
                logger.warning("No results from initial query, creating new executor and retrying")
                return []
            return similarity_search
        except Exception as e:
            logger.error(f"Error in query_similar_wraped: {str(e)}")
            return []

    async def chat_loop(self):
        print("Welcome! Ask questions about the documents. Type 'quit' to exit.")
        
        while True:
            user_input = input("\nYour question: ").strip()
            
            if user_input.lower() in ['quit', 'exit', 'q']:
                print("Goodbye!")
                break
                
            if not user_input:
                continue
                
            try:
                response = self.analyze_phase(user_input)
                print("\nAssistant:", response)
                for thought in self.thought_process:
                    print(f"\nThought: {thought}")
                self.thought_process = []
                
            except Exception as e:
                print(f"\nError: {str(e)}")



if __name__ == "__main__":
    pc = PineconeHandler(index_name=os.getenv("PINECONE_INDEX_NAME"), 
                         pinecone_api_key=os.getenv("PINECONE_API_KEY"), 
                         pinecone_environment=os.getenv("PINECONE_ENVIRONMENT"), 
                         openai_api_key=os.getenv("OPENAI_API_KEY"))
    processor = LangChainProcessor(pc)
    asyncio.run(processor.chat_loop())