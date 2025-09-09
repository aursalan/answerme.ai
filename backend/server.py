import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.llms import Ollama
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
import shutil

# --- Basic Setup ---
app = Flask(__name__, static_folder='../client/dist', static_url_path='/')
CORS(app)

# --- Configuration ---
UPLOAD_FOLDER = 'uploads'
VECTOR_STORE_FOLDER = 'vector_stores'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['VECTOR_STORE_FOLDER'] = VECTOR_STORE_FOLDER

# Clean up previous runs
if os.path.exists(UPLOAD_FOLDER):
    shutil.rmtree(UPLOAD_FOLDER)
if os.path.exists(VECTOR_STORE_FOLDER):
    shutil.rmtree(VECTOR_STORE_FOLDER)

# Create directories
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(VECTOR_STORE_FOLDER, exist_ok=True)


# --- Core LLM Logic ---

def get_qa_chain(file_path, file_id):
    """
    Loads a PDF, splits it, creates embeddings, a vector store, and a QA chain.
    This function is simplified to process and chain on-the-fly for each upload.
    For production, you'd persist the vector store.
    """
    # 1. Load PDF
    loader = PyPDFLoader(file_path)
    documents = loader.load()

    # 2. Split text into chunks
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    split_docs = text_splitter.split_documents(documents)

    # 3. Create embeddings
    embeddings = OllamaEmbeddings(
        model="llama2",
        base_url="http://localhost:11434" # Ensure Ollama is running
    )

    # 4. Create FAISS vector store in memory
    vector_store = FAISS.from_documents(split_docs, embeddings)

    # 5. Create the QA Chain
    model = Ollama(model="llama2", base_url="http://localhost:11434")
    
    template = """Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer. Keep the answer concise.
    Context: {context}
    Question: {question}
    Helpful Answer:"""
    prompt = PromptTemplate.from_template(template)

    chain = RetrievalQA.from_chain_type(
        llm=model,
        chain_type="stuff",
        retriever=vector_store.as_retriever(),
        return_source_documents=True,
        chain_type_kwargs={"prompt": prompt}
    )
    return chain

# --- In-memory storage for chains ---
# In a real app, you'd manage this more robustly (e.g., with a DB or a cache like Redis)
chains = {}

# --- API Endpoints ---

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'pdf' not in request.files:
        return jsonify({'message': 'No PDF file part in the request'}), 400
    
    file = request.files['pdf']
    if file.filename == '':
        return jsonify({'message': 'No file selected'}), 400
        
    if file and file.filename.endswith('.pdf'):
        filename = secure_filename(file.filename)
        # Create a unique ID for the session
        file_id = os.urandom(8).hex()
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{file_id}.pdf")
        file.save(file_path)

        try:
            # Create and store the chain in memory
            chains[file_id] = get_qa_chain(file_path, file_id)
            return jsonify({'message': 'File processed successfully.', 'fileId': file_id}), 200
        except Exception as e:
            print(f"Error processing PDF: {e}")
            return jsonify({'message': 'Failed to process PDF.'}), 500
    
    return jsonify({'message': 'Invalid file type'}), 400


@app.route('/api/ask', methods=['POST'])
def ask_question():
    data = request.get_json()
    question = data.get('question')
    file_id = data.get('fileId')

    if not question or not file_id:
        return jsonify({'message': 'Question and fileId are required.'}), 400

    if file_id not in chains:
        return jsonify({'message': 'Invalid fileId. Please upload the PDF again.'}), 404

    try:
        chain = chains[file_id]
        result = chain.invoke({'query': question})
        
        # Convert source documents to a JSON-serializable format
        source_documents = []
        if 'source_documents' in result:
            for doc in result['source_documents']:
                source_documents.append({
                    'pageContent': doc.page_content,
                    'metadata': doc.metadata,
                })

        return jsonify({
            'text': result.get('result'),
            'sourceDocuments': source_documents
        }), 200
    except Exception as e:
        print(f"Error during question asking: {e}")
        return jsonify({'message': 'An error occurred while answering the question.'}), 500

# --- Serve React App ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(debug=True, port=3001)
