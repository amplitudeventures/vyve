from typing import List
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader
from langchain_community.document_loaders.image import UnstructuredImageLoader


class DocumentUtils:
    def __init__(self):
        pass
    def read_pdf(self, path: str) -> List[str]:
        loader = PyPDFLoader(path)
        docs = loader.load()
        return docs
    
    def read_docx(self, path: str) -> List[str]:
        loader = Docx2txtLoader(path)
        docs = loader.load()
        return docs
    
    def read_image(self, path: str) -> List[str]:
        loader = UnstructuredImageLoader(path)
        docs = loader.load()
        return docs
    
    