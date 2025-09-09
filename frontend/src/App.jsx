import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';

// --- UI Components ---

const Header = () => (
  <header className="bg-gray-900 text-white shadow-lg">
    <div className="container mx-auto px-4 py-6 flex justify-between items-center">
      {/* Group logo and title together for alignment */}
      <div className="flex items-center">
        {/* <img src="/logoo.png" alt="Logo" className="h-10 mr-3" /> */}
        <h1 className="text-3xl font-bold tracking-tight">
          answer
          {/* Use a span to style a part of the text differently */}
          <span className="text-blue-400">me.ai</span>
        </h1>
      </div>
      <p className="text-md text-gray-400">Chat with Any PDF, Instantly</p>
    </div>
  </header>
);

const FileUploader = ({ onFileUpload, uploading, file }) => {
    const onDrop = useCallback(acceptedFiles => {
        if (acceptedFiles.length > 0) {
            onFileUpload(acceptedFiles[0]);
        }
    }, [onFileUpload]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: false,
    });

    return (
        <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}>
            <input {...getInputProps()} />
            {uploading ? (
                <div className="flex flex-col items-center justify-center">
                    <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-2 text-gray-600">Processing PDF...</p>
                </div>
            ) : file ? (
                 <div className="text-green-600">
                    <p className="font-semibold">Successfully uploaded:</p>
                    <p>{file.name}</p>
                </div>
            ) : (
                isDragActive ?
                    <p className="text-blue-600">Drop the PDF here ...</p> :
                    <p className="text-gray-500">Drag & drop a PDF here, or click to select a file</p>
            )}
        </div>
    );
};

const QuestionForm = ({ onAsk, asking }) => {
    const [question, setQuestion] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (question.trim()) {
            onAsk(question);
            setQuestion('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mt-6">
            <div className="relative">
                <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask a question based on the PDF content..."
                    className="w-full p-4 pr-16 rounded-full border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
                    disabled={asking}
                />
                <button
                    type="submit"
                    className="absolute top-1/2 right-2 -translate-y-1/2 bg-blue-600 text-white rounded-full p-3 hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                    disabled={asking}
                >
                    {asking ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    )}
                </button>
            </div>
        </form>
    );
};

const AnswerDisplay = ({ answer, sources }) => {
    if (!answer) return null;

    return (
        <div className="mt-8 p-6 bg-white rounded-xl shadow-md border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Answer:</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{answer}</p>
            {sources && sources.length > 0 && (
                <div className="mt-4">
                    <h3 className="text-lg font-semibold text-gray-800">Sources:</h3>
                     <div className="mt-2 space-y-2">
                        {sources.map((source, index) => (
                            <div key={index} className="bg-gray-100 p-3 rounded-lg">
                                <p className="text-sm text-gray-600 truncate">"...{source.pageContent}..."</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


// --- Main App Component ---

function App() {
    const [file, setFile] = useState(null);
    const [fileId, setFileId] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [sources, setSources] = useState([]);
    const [asking, setAsking] = useState(false);
    const [error, setError] = useState('');

    const handleFileUpload = async (uploadedFile) => {
        setFile(uploadedFile);
        setUploading(true);
        setError('');
        setAnswer('');
        setSources([]);

        const formData = new FormData();
        formData.append('pdf', uploadedFile);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('File upload failed.');
            }

            const data = await response.json();
            setFileId(data.fileId);
        } catch (err) {
            setError('Error uploading file. Please try again.');
            console.error(err);
        } finally {
            setUploading(false);
        }
    };

    const handleAskQuestion = async (userQuestion) => {
        if (!fileId) {
            setError('Please upload a PDF first.');
            return;
        }

        setQuestion(userQuestion);
        setAsking(true);
        setError('');
        setAnswer('');
        setSources([]);


        try {
            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question: userQuestion, fileId }),
            });

            if (!response.ok) {
                throw new Error('Failed to get an answer.');
            }

            const data = await response.json();
            setAnswer(data.text);
            setSources(data.sourceDocuments)
        } catch (err) {
            setError('Error asking question. Please try again.');
            console.error(err);
        } finally {
            setAsking(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <Header />
            <main className="container mx-auto px-4 py-10">
                <div className="max-w-2xl mx-auto">
                    <FileUploader onFileUpload={handleFileUpload} uploading={uploading} file={file} />
                    {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
                    {fileId && !uploading && <QuestionForm onAsk={handleAskQuestion} asking={asking} />}
                    <AnswerDisplay answer={answer} sources={sources} />
                </div>
            </main>
        </div>
    );
}

export default App;