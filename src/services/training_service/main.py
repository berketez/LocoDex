import os
import shutil
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import chromadb
from chromadb.utils import embedding_functions
import ollama

# --- Konfigürasyon ---
UPLOAD_DIRECTORY = "uploaded_files"
CHROMA_DB_PATH = "chroma_db"
CHROMA_COLLECTION_NAME = "rag_collection"

# --- FastAPI Uygulaması ---
app = FastAPI()

# CORS (Cross-Origin Resource Sharing) ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Geliştirme için tüm kaynaklara izin ver, produksiyonda kısıtla
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ChromaDB Kurulumu ---
client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
ollama_ef = embedding_functions.OllamaEmbeddingFunction(
    url="http://localhost:11434/api/embeddings",
    model_name="llama2",
)
collection = client.get_or_create_collection(
    name=CHROMA_COLLECTION_NAME,
    embedding_function=ollama_ef
)

# --- Pydantic Modelleri ---
class Query(BaseModel):
    text: str

class Document(BaseModel):
    id: str
    text: str
    metadata: dict

# --- Yardımcı Fonksiyonlar ---
def initialize_directories():
    """Gerekli dizinleri oluşturur."""
    os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)
    os.makedirs(CHROMA_DB_PATH, exist_ok=True)

# --- API Uç Noktaları ---
@app.on_event("startup")
async def startup_event():
    """Uygulama başlangıcında çalışır."""
    initialize_directories()

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    """Dosya yükler, metni çıkarır ve vektör veritabanına ekler."""
    try:
        file_path = os.path.join(UPLOAD_DIRECTORY, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Basit metin çıkarma (şimdilik sadece .txt varsayılıyor)
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()

        # Metni ChromaDB'ye ekle
        collection.add(
            documents=[text],
            metadatas=[{"source": file.filename}],
            ids=[file.filename]
        )

        return {"filename": file.filename, "status": "processed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query/")
async def query_rag(query: Query):
    """RAG kullanarak bir sorguya yanıt oluşturur."""
    try:
        # ChromaDB'den ilgili belgeleri al
        results = collection.query(
            query_texts=[query.text],
            n_results=2
        )

        if not results["documents"]:
            return {"response": "İlgili bilgi bulunamadı.", "sources": []}

        context = "\n".join(results["documents"][0])
        sources = [metadata["source"] for metadata in results["metadatas"][0]]

        # Use the LiteLLM router to generate a response
        import requests
        response = requests.post(
            "http://localhost:8000/chat/completions", # Default LiteLLM port
            json={
                "model": "ollama/llama2", # Specify the model to use via the router
                "messages": [
                    {
                        "role": "system",
                        "content": f"You are a helpful assistant. Use the following context to answer the user's question. Context: {context}",
                    },
                    {
                        "role": "user",
                        "content": query.text,
                    },
                ],
            }
        )
        response.raise_for_status() # Raise an exception for bad status codes
        response_data = response.json()
        response_text = response_data['choices'][0]['message']['content']

        return {"response": response_text, "sources": sources}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import subprocess
import json

class FineTuneRequest(BaseModel):
    base_model: str
    dataset_path: str
    output_path: str
    config: dict

TRAINING_DATA_DIRECTORY = "training_datasets"

@app.post("/upload_dataset/")
async def upload_dataset(file: UploadFile = File(...)):
    """Eğitim veri kümesini yükler."""
    try:
        os.makedirs(TRAINING_DATA_DIRECTORY, exist_ok=True)
        file_path = os.path.join(TRAINING_DATA_DIRECTORY, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"filename": file.filename, "status": "uploaded_for_training"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/finetune/")
async def start_fine_tuning(request: FineTuneRequest):
    """Arka planda ince ayar işlemini başlatır."""
    try:
        config_str = json.dumps(request.config)
        command = f"python fine_tuner.py --base_model {request.base_model} --dataset_path {request.dataset_path} --output_path {request.output_path} --config '{config_str}'"
        
        # İnce ayar betiğini ayrı bir işlem olarak başlat
        subprocess.Popen(command, shell=True)

        return {"status": "Fine-tuning process started", "command": command}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class MergeRequest(BaseModel):
    base_model: str
    lora_adapter_path: str
    output_path: str

@app.post("/merge_model/")
async def merge_model(request: MergeRequest):
    """Arka planda LoRA birleştirme işlemini başlatır."""
    try:
        command = f"python merge_lora.py --base_model {request.base_model} --lora_adapter {request.lora_adapter_path} --output_path {request.output_path}"
        
        subprocess.Popen(command, shell=True)

        return {"status": "Model merging process started", "command": command}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
