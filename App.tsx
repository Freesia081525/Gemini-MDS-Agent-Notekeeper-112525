
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { createRoot } from "react-dom/client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Agent, AgentStatus, DocumentFile, DocumentType, AnalysisResult, NoteEntity, KeywordConfig } from './types';
import { DEFAULT_AGENTS, FLOWER_THEMES, LOCALIZATION, MODEL_OPTIONS } from './constants';
import { 
    initGeminiService, 
    initOpenAIService, 
    unifiedProcessAgentPrompt, 
    performOcrWithGemini,
    generateDocumentSummary,
    generateSmartFormat,
    generateEntityExtraction
} from './services/aiService';

import { 
    PlusIcon, PlayIcon, UploadIcon, DocumentIcon, FileTextIcon, 
    SettingsIcon, PaletteIcon, LanguageIcon, SunIcon, MoonIcon, KeyIcon,
    MagicIcon, TableIcon, CodeIcon, HighlightIcon, PencilSquareIcon, EyeIcon, XMarkIcon
} from './components/icons';
import PdfViewer from './components/PdfViewer';
import ThemeWheel from './components/ThemeWheel';

declare const pdfjsLib: any;

function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) { console.error(error); return initialValue; }
  });

  const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) { console.error(error); }
  };
  return [storedValue, setValue];
}

const getEnv = (key: string) => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
  } catch (e) { }
  return '';
};

const App: React.FC = () => {
  // --- API Key State ---
  const [envGeminiApiKey] = useState(getEnv('API_KEY') || '');
  const [envOpenAIApiKey] = useState(getEnv('REACT_APP_OPENAI_API_KEY') || '');
  const [userGeminiApiKey, setUserGeminiApiKey] = useLocalStorage('geminiApiKey', '');
  const [userOpenAIApiKey, setUserOpenAIApiKey] = useLocalStorage('openaiApiKey', '');
  
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string>('');
  const [tempGeminiKey, setTempGeminiKey] = useState(userGeminiApiKey);
  const [tempOpenAIKey, setTempOpenAIKey] = useState(userOpenAIApiKey);

  const effectiveGeminiApiKey = useMemo(() => envGeminiApiKey || userGeminiApiKey, [envGeminiApiKey, userGeminiApiKey]);
  const effectiveOpenAIApiKey = useMemo(() => envOpenAIApiKey || userOpenAIApiKey, [envOpenAIApiKey, userOpenAIApiKey]);
  const isGeminiKeySet = !!effectiveGeminiApiKey;

  useEffect(() => {
    if (effectiveGeminiApiKey) initGeminiService(effectiveGeminiApiKey);
    if (effectiveOpenAIApiKey) initOpenAIService(effectiveOpenAIApiKey);
  }, [effectiveGeminiApiKey, effectiveOpenAIApiKey]);

  // --- UI State ---
  const [themeIndex, setThemeIndex] = useLocalStorage('themeIndex', 0);
  const [isDarkMode, setIsDarkMode] = useLocalStorage('isDarkMode', true);
  const [lang, setLang] = useLocalStorage<'en' | 'zh-TW'>('lang', 'en');
  const [activeTab, setActiveTab] = useState('workflow');
  const [isWheelOpen, setIsWheelOpen] = useState(false);

  const T = useMemo(() => LOCALIZATION[lang], [lang]);
  const activeTheme = useMemo(() => FLOWER_THEMES[themeIndex] || FLOWER_THEMES[0], [themeIndex]);

  // --- Logic State ---
  const [documentFile, setDocumentFile] = useState<DocumentFile>({ id: 'initial', name: 'No document loaded', type: DocumentType.EMPTY, content: '' });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // --- Editing State ---
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editOutputContent, setEditOutputContent] = useState('');
  const [editPreviewMode, setEditPreviewMode] = useState(false);

  // --- Smart Note State ---
  const [noteContent, setNoteContent] = useLocalStorage('smartNoteContent', '# My Notes\nStart typing here...');
  const [noteEntities, setNoteEntities] = useState<NoteEntity[]>([]);
  const [noteKeywords, setNoteKeywords] = useLocalStorage<KeywordConfig[]>('noteKeywords', []);
  const [newKeyword, setNewKeyword] = useState('');
  const [keywordColor, setKeywordColor] = useState('#fde047');
  const [isNoteProcessing, setIsNoteProcessing] = useState(false);

  // Apply Theme
  useEffect(() => { document.documentElement.classList.toggle('dark', isDarkMode); }, [isDarkMode]);
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', activeTheme.primary);
    root.style.setProperty('--color-secondary', activeTheme.secondary);
    root.style.setProperty('--color-surface', activeTheme.surface);
  }, [activeTheme]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Reset
    setAgents([]);
    setAnalysisResult(null);
    setIsProcessing(false);
    
    const fileType = file.name.split('.').pop()?.toLowerCase();
    
    if (fileType === 'pdf') {
       setDocumentFile({ id: file.name, name: file.name, type: DocumentType.PDF, content: 'Use the "OCR This Page" button in the viewer to add text for agents.', file });
    } else if (fileType === 'json') {
       const content = await file.text();
       setDocumentFile({ id: file.name, name: file.name, type: DocumentType.JSON, content, rawContent: content });
       triggerSummarize(content);
    } else if (fileType === 'md') {
       const content = await file.text();
       setDocumentFile({ id: file.name, name: file.name, type: DocumentType.MARKDOWN, content, rawContent: content });
       triggerSummarize(content);
    } else {
       // TXT
       const content = await file.text();
       setDocumentFile({ id: file.name, name: file.name, type: DocumentType.TXT, content, rawContent: content });
       triggerSummarize(content);
    }
  };

  const triggerSummarize = async (text: string) => {
      setIsSummarizing(true);
      const summary = await generateDocumentSummary(text);
      setDocumentFile(prev => ({ ...prev, summary }));
      setIsSummarizing(false);
  }

  const handleOcrPage = async (base64Image: string) => {
      if (!isGeminiKeySet) {
          setApiKeyError("Gemini API key required for OCR.");
          setIsApiKeyModalOpen(true);
          return;
      }
      try {
          const text = await performOcrWithGemini(base64Image);
          // Append to document content
          setDocumentFile(prev => {
              const prevContent = prev.content === 'Use the "OCR This Page" button in the viewer to add text for agents.' ? '' : prev.content;
              return { 
                  ...prev, 
                  content: prevContent + `\n\n--- OCR Result ---\n${text}` 
              };
          });
          // Optional: re-summarize if enough content added?
      } catch (e: any) {
          alert("OCR Failed: " + e.message);
      }
  };

  // --- Smart Note Logic ---
  const handleFormatNote = async () => {
      if (!isGeminiKeySet) { setIsApiKeyModalOpen(true); return; }
      setIsNoteProcessing(true);
      try {
          const formatted = await generateSmartFormat(noteContent);
          setNoteContent(formatted);
      } catch(e: any) { alert(e.message); }
      setIsNoteProcessing(false);
  }

  const handleExtractEntities = async () => {
      if (!isGeminiKeySet) { setIsApiKeyModalOpen(true); return; }
      setIsNoteProcessing(true);
      try {
          const entities = await generateEntityExtraction(noteContent);
          setNoteEntities(entities);
      } catch(e: any) { alert(e.message); }
      setIsNoteProcessing(false);
  }

  const addKeyword = () => {
      if(newKeyword.trim()) {
          setNoteKeywords(prev => [...prev, { text: newKeyword.trim(), color: keywordColor }]);
          setNewKeyword('');
      }
  }

  const removeKeyword = (text: string) => {
      setNoteKeywords(prev => prev.filter(k => k.text !== text));
  }

  const HighlightedText = ({ text, keywords }: { text: string, keywords: KeywordConfig[] }) => {
      if (!keywords.length) return <div className="whitespace-pre-wrap">{text}</div>;
      
      const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(${keywords.map(k => escapeRegExp(k.text)).join('|')})`, 'gi');
      
      const parts = text.split(pattern);
      return (
          <div className="whitespace-pre-wrap font-sans">
              {parts.map((part, i) => {
                  const kw = keywords.find(k => k.text.toLowerCase() === part.toLowerCase());
                  return kw 
                    ? <span key={i} style={{ backgroundColor: kw.color, padding: '0 2px', borderRadius: '2px', color: '#000' }}>{part}</span> 
                    : part;
              })}
          </div>
      );
  }


  // --- Agent & Workflow Logic ---
  const addAgent = (template: Omit<Agent, 'id' | 'status' | 'output' | 'error' | 'outputJson' | 'model' | 'maxTokens'>) => {
    const newAgent: Agent = {
      ...template,
      id: `agent-${Date.now()}`,
      status: AgentStatus.Pending,
      output: null, error: null, outputJson: null,
      model: MODEL_OPTIONS[0].value,
      maxTokens: 1000,
    };
    setAgents(prev => [...prev, newAgent]);
  };

  const updateAgent = (id: string, updates: Partial<Agent>) => {
      setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }
  
  const handleEditAgentOutput = (agent: Agent) => {
      setEditingAgent(agent);
      setEditOutputContent(agent.output || '');
      setEditPreviewMode(false);
  }
  
  const saveEditedOutput = () => {
      if (editingAgent) {
          updateAgent(editingAgent.id, { output: editOutputContent });
          setEditingAgent(null);
      }
  }

  const parseJsonOutput = (text: string): any | null => {
      try {
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```([\s\S]*?)```/);
        return JSON.parse(jsonMatch ? jsonMatch[1] : text);
      } catch (e) { return null; }
  };

  const runWorkflow = useCallback(async () => {
    setIsProcessing(true);
    setAnalysisResult(null);
    let currentAgents = agents.map(a => ({...a, status: AgentStatus.Pending, output: null, error: null}));
    setAgents(currentAgents);

    for (const agent of agents) {
        currentAgents = currentAgents.map(a => (a.id === agent.id ? { ...a, status: AgentStatus.Running } : a));
        setAgents(currentAgents);
      try {
        const output = await unifiedProcessAgentPrompt(agent, documentFile.content);
        const outputJson = parseJsonOutput(output);
        currentAgents = currentAgents.map(a => (a.id === agent.id ? { ...a, status: AgentStatus.Success, output, outputJson } : a));
        setAgents(currentAgents);
      } catch (error: any) {
        currentAgents = currentAgents.map(a => (a.id === agent.id ? { ...a, status: AgentStatus.Error, error: error.message } : a));
        setAgents(currentAgents);
      }
    }
    const sentimentAgent = currentAgents.find(a => a.name.includes('Sentiment') && a.outputJson);
    const entityAgent = currentAgents.find(a => a.name.includes('Entity') && Array.isArray(a.outputJson));
    let res: AnalysisResult = { sentiment: null, entities: null };
    if (sentimentAgent) {
        const s = sentimentAgent.outputJson.sentiment?.toLowerCase();
        res.sentiment = { 
            positive: s === 'positive' ? 1 : 0, 
            negative: s === 'negative' ? 1 : 0, 
            neutral: s === 'neutral' ? 1 : 0 
        };
    }
    if (entityAgent) {
        res.entities = entityAgent.outputJson;
    }
    setAnalysisResult(res);
    setIsProcessing(false);
    if(res.sentiment || res.entities) setActiveTab('dashboard');

  }, [agents, documentFile.content]);

  const handleSaveApiKeys = () => {
      if(tempGeminiKey) setUserGeminiApiKey(tempGeminiKey.trim());
      if(tempOpenAIKey) setUserOpenAIApiKey(tempOpenAIKey.trim());
      setApiKeyError('');
      setIsApiKeyModalOpen(false);
  }

  return (
    <div className="font-sans text-gray-800 dark:text-gray-200 min-h-screen bg-surface transition-colors duration-300">
        <ThemeWheel 
            isOpen={isWheelOpen} 
            onClose={() => setIsWheelOpen(false)} 
            themes={FLOWER_THEMES} 
            onSelect={(idx) => { setThemeIndex(idx); setIsWheelOpen(false); }}
            labels={{ title: T.luckWheel, spin: T.spin }}
        />

        {/* API Key Modal */}
        {isApiKeyModalOpen && (
             <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md m-4 border-l-4 border-primary">
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 text-primary"><KeyIcon className="w-6 h-6"/> {T.apiKeySettings}</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">{T.apiKeyHint}</p>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Gemini API Key</label>
                            <input type="password" value={tempGeminiKey} onChange={(e) => setTempGeminiKey(e.target.value)} placeholder="sk-..." className="w-full mt-1 p-3 bg-gray-100 dark:bg-gray-700 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">OpenAI API Key</label>
                            <input type="password" value={tempOpenAIKey} onChange={(e) => setTempOpenAIKey(e.target.value)} placeholder="sk-..." className="w-full mt-1 p-3 bg-gray-100 dark:bg-gray-700 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                        </div>
                        {apiKeyError && <p className="text-sm text-red-500 mt-2">{apiKeyError}</p>}
                        <button onClick={handleSaveApiKeys} className="w-full px-4 py-3 bg-primary text-white font-semibold rounded-lg shadow hover:opacity-90">
                            {T.saveKeys}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Edit Output Modal */}
        {editingAgent && (
             <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                    <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-700/30 rounded-t-2xl">
                        <h3 className="font-bold text-lg flex items-center gap-2"><PencilSquareIcon className="w-5 h-5 text-primary"/> {T.editOutput}: {editingAgent.name}</h3>
                        <button onClick={() => setEditingAgent(null)} className="text-gray-400 hover:text-red-500 transition"><XMarkIcon className="w-6 h-6"/></button>
                    </div>
                    
                    <div className="p-2 bg-gray-100 dark:bg-gray-900 flex gap-1">
                        <button onClick={() => setEditPreviewMode(false)} className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 ${!editPreviewMode ? 'bg-white dark:bg-gray-800 shadow text-primary' : 'text-gray-500 hover:bg-white/50'}`}>
                            <PencilSquareIcon className="w-4 h-4" /> {T.edit}
                        </button>
                        <button onClick={() => setEditPreviewMode(true)} className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 ${editPreviewMode ? 'bg-white dark:bg-gray-800 shadow text-primary' : 'text-gray-500 hover:bg-white/50'}`}>
                            <EyeIcon className="w-4 h-4" /> {T.preview}
                        </button>
                    </div>

                    <div className="flex-grow overflow-auto p-4">
                        {editPreviewMode ? (
                             <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{editOutputContent}</ReactMarkdown>
                             </div>
                        ) : (
                             <textarea 
                                value={editOutputContent} 
                                onChange={(e) => setEditOutputContent(e.target.value)} 
                                className="w-full h-full min-h-[400px] p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary outline-none font-mono text-sm resize-none"
                                placeholder="Edit output content..."
                             />
                        )}
                    </div>
                    
                    <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-3 rounded-b-2xl bg-gray-50 dark:bg-gray-800">
                        <button onClick={() => setEditingAgent(null)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">{T.cancel}</button>
                        <button onClick={saveEditedOutput} className="px-6 py-2 text-sm font-bold text-white bg-primary rounded-lg hover:opacity-90 shadow-md">{T.save}</button>
                    </div>
                </div>
            </div>
        )}
        
        {/* Header */}
        <header className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b dark:border-gray-700 p-4 sticky top-0 z-40 shadow-sm">
             <div className="max-w-screen-xl mx-auto flex justify-between items-center">
                 <div className='flex items-center gap-3'>
                    <div className="p-2 bg-primary/10 rounded-lg">
                         <DocumentIcon className="w-6 h-6 text-primary" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white hidden sm:block tracking-tight">{T.title}</h1>
                 </div>
                 
                 <div className='flex items-center gap-3'>
                    <button onClick={() => setIsApiKeyModalOpen(true)} className={`p-2 rounded-full transition-colors ${!isGeminiKeySet ? 'bg-red-100 text-red-500 animate-pulse' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                        <KeyIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={() => setIsWheelOpen(true)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-primary" title={T.luckWheel}>
                         <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" style={{ animationDuration: '3s' }}></div>
                    </button>
                    <div className="relative group">
                        <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <SettingsIcon className="w-5 h-5 text-gray-600 dark:text-gray-300"/>
                        </button>
                        <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-4 border border-gray-100 dark:border-gray-700 hidden group-hover:block z-50">
                           <h3 className="font-semibold mb-3 text-sm text-gray-500 uppercase tracking-wider">{T.settings}</h3>
                           <div className="space-y-4">
                                <label className="flex items-center gap-3 text-sm">
                                    <PaletteIcon className="w-5 h-5 text-primary"/>
                                    <span className="flex-grow">{T.style}</span>
                                    <select value={themeIndex} onChange={e => setThemeIndex(Number(e.target.value))} className="text-xs bg-gray-50 dark:bg-gray-700 border-none rounded-md p-2">
                                        {FLOWER_THEMES.map((theme, i) => <option key={i} value={i}>{theme.name}</option>)}
                                    </select>
                                </label>
                                <label className="flex items-center gap-3 text-sm">
                                    <LanguageIcon className="w-5 h-5 text-primary"/>
                                    <span className="flex-grow">{T.language}</span>
                                    <select value={lang} onChange={e => setLang(e.target.value as 'en' | 'zh-TW')} className="text-xs bg-gray-50 dark:bg-gray-700 border-none rounded-md p-2">
                                        <option value="en">English</option>
                                        <option value="zh-TW">繁體中文</option>
                                    </select>
                                </label>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-3"><SunIcon className="w-5 h-5 text-primary"/>{T.mode}</span>
                                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                        <button onClick={() => setIsDarkMode(false)} className={`p-1.5 rounded-md transition ${!isDarkMode ? 'bg-white shadow text-yellow-500' : 'text-gray-400'}`}><SunIcon className="w-4 h-4"/></button>
                                        <button onClick={() => setIsDarkMode(true)} className={`p-1.5 rounded-md transition ${isDarkMode ? 'bg-gray-600 shadow text-indigo-300' : 'text-gray-400'}`}><MoonIcon className="w-4 h-4"/></button>
                                    </div>
                                </div>
                           </div>
                        </div>
                    </div>
                 </div>
             </div>
        </header>

        <main className="max-w-screen-xl mx-auto p-4 md:p-6 space-y-6">
            <div className="flex justify-center">
                <div className="bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm inline-flex">
                    {['workflow', 'dashboard', 'smartNote'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === tab ? 'bg-primary text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                            {T[tab as keyof typeof T] || tab}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'workflow' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left: Doc Viewer */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-[600px]">
                          <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-700/30">
                              <h2 className="font-semibold flex items-center gap-2"><FileTextIcon className="w-5 h-5 text-primary"/> {T.documentControl}</h2>
                          </div>
                          
                          {documentFile.type === DocumentType.EMPTY ? (
                              <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
                                  <div className="relative group cursor-pointer">
                                      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition duration-300">
                                          <UploadIcon className="w-8 h-8 text-primary" />
                                      </div>
                                      <input type="file" onChange={handleFileChange} accept=".pdf,.txt,.json,.md" className="absolute inset-0 opacity-0 cursor-pointer" />
                                  </div>
                                  <h3 className="text-lg font-medium">{T.uploadDocument}</h3>
                                  <p className="text-sm text-gray-500 mt-1">{T.uploadHint}</p>
                              </div>
                          ) : (
                              <div className="flex-grow overflow-hidden flex flex-col relative bg-gray-50 dark:bg-gray-900">
                                  {documentFile.type === DocumentType.PDF ? (
                                      <PdfViewer 
                                        file={documentFile.rawFile || null} 
                                        labels={{ zoomIn: T.zoomIn, zoomOut: T.zoomOut, page: T.page, ocr: T.ocrThisPage, processing: T.ocrProcessing }}
                                        onOcrPage={handleOcrPage}
                                      />
                                  ) : (
                                      <div className="flex-grow overflow-auto p-4">
                                         {documentFile.type === DocumentType.JSON ? (
                                             <pre className="text-xs font-mono text-green-600 dark:text-green-400">{documentFile.rawContent}</pre>
                                         ) : documentFile.type === DocumentType.MARKDOWN ? (
                                             <div className="prose prose-sm dark:prose-invert max-w-none">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{documentFile.rawContent || ''}</ReactMarkdown>
                                             </div>
                                         ) : (
                                             <textarea readOnly className="w-full h-full bg-transparent resize-none outline-none font-mono text-xs" value={documentFile.rawContent || documentFile.content} />
                                         )}
                                      </div>
                                  )}
                                  
                                  {isSummarizing && (
                                      <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex flex-col items-center justify-center backdrop-blur-sm z-10">
                                          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                                          <p className="text-sm font-medium animate-pulse">{T.generatingSummary}</p>
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>
                      
                      {documentFile.summary && (
                          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                              <h3 className="font-semibold mb-3 flex items-center gap-2 text-primary">
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  {T.summary}
                              </h3>
                              <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-h-40 overflow-y-auto">
                                  {documentFile.summary}
                              </div>
                          </div>
                      )}
                    </div>

                    {/* Right: Agents */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                           <div className="flex justify-between items-center mb-6">
                               <h2 className="text-lg font-bold">{T.agentWorkflow}</h2>
                               <button onClick={runWorkflow} disabled={isProcessing || agents.length === 0} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-full shadow-lg shadow-primary/30 hover:opacity-90 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:shadow-none transition-all hover:scale-105 active:scale-95">
                                    <PlayIcon className="w-5 h-5"/> {isProcessing ? T.running : T.runWorkflow}
                               </button>
                           </div>
                           
                           <div className="space-y-4 mb-6 min-h-[200px]">
                               {agents.map((agent) => (
                                   <div key={agent.id} className="group p-5 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-primary/50 transition-colors">
                                       <div className="flex flex-col md:flex-row gap-4 mb-3">
                                           <div className="flex-grow">
                                               <div className="flex items-center gap-2 mb-2">
                                                   <h3 className="font-bold text-gray-800 dark:text-gray-100">{agent.name}</h3>
                                                   <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                                                       agent.status === AgentStatus.Success ? 'bg-green-50 text-green-600 border-green-200' : 
                                                       agent.status === AgentStatus.Error ? 'bg-red-50 text-red-600 border-red-200' :
                                                       agent.status === AgentStatus.Running ? 'bg-blue-50 text-blue-600 border-blue-200 animate-pulse' :
                                                       'bg-gray-200 text-gray-500 border-gray-300'
                                                   }`}>{agent.status}</span>
                                               </div>
                                               
                                               <div className="grid grid-cols-2 gap-3 text-sm">
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">{T.model}</label>
                                                        <select value={agent.model} onChange={(e) => updateAgent(agent.id, { model: e.target.value })} className="w-full bg-white dark:bg-gray-800 border dark:border-gray-600 rounded px-2 py-1 text-xs">
                                                            {MODEL_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">{T.maxTokens}: {agent.maxTokens}</label>
                                                        <input type="range" min="100" max="12000" step="100" value={agent.maxTokens} onChange={(e) => updateAgent(agent.id, { maxTokens: Number(e.target.value) })} className="w-full accent-primary h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
                                                    </div>
                                               </div>
                                           </div>
                                           <button onClick={() => setAgents(prev => prev.filter(a => a.id !== agent.id))} className="text-gray-300 hover:text-red-500 self-start">
                                               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                           </button>
                                       </div>
                                       
                                       <div className="space-y-2">
                                           <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{T.prompt}</label>
                                           <textarea value={agent.prompt} onChange={(e) => updateAgent(agent.id, { prompt: e.target.value })} className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none transition-shadow" rows={2}/>
                                       </div>

                                       {agent.output && (
                                           <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                               <div className="flex justify-between items-center mb-1">
                                                   <p className="text-xs font-semibold text-gray-500">OUTPUT</p>
                                                   <button onClick={() => handleEditAgentOutput(agent)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                                                       <PencilSquareIcon className="w-3 h-3"/> {T.editOutput} / {T.preview}
                                                   </button>
                                               </div>
                                               <div className="bg-white dark:bg-gray-900 p-3 rounded-lg text-xs font-mono max-h-32 overflow-y-auto border border-gray-100 dark:border-gray-700">
                                                   {agent.output}
                                               </div>
                                           </div>
                                       )}
                                       {agent.error && <p className="mt-2 text-xs text-red-500 bg-red-50 p-2 rounded">{agent.error}</p>}
                                   </div>
                               ))}
                               {agents.length === 0 && (
                                   <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/50">
                                       <p className="text-gray-400">Add agents below to start building your workflow.</p>
                                   </div>
                               )}
                           </div>
                           
                           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {DEFAULT_AGENTS.map(template => (
                                  <button key={template.name} onClick={() => addAgent(template)} className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-primary hover:text-primary rounded-xl text-sm font-medium transition-all hover:-translate-y-1 shadow-sm">
                                    <PlusIcon className="w-4 h-4"/>
                                    {template.name}
                                  </button>
                              ))}
                          </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* SMART NOTE TAB */}
            {activeTab === 'smartNote' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[800px]">
                    {/* Toolbar & Input */}
                    <div className="lg:col-span-5 flex flex-col gap-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                            <h2 className="font-bold text-lg flex items-center gap-2"><MagicIcon className="w-5 h-5 text-primary"/> {T.smartNote}</h2>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={handleFormatNote} disabled={isNoteProcessing} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors">
                                    <MagicIcon className="w-4 h-4" /> {T.formatNote}
                                </button>
                                <button onClick={handleExtractEntities} disabled={isNoteProcessing} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-200 rounded-lg text-sm font-medium transition-colors">
                                    <TableIcon className="w-4 h-4" /> {T.extractEntities}
                                </button>
                            </div>
                            
                            {/* Keyword Input */}
                            <div className="flex gap-2 items-center bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
                                <input type="color" value={keywordColor} onChange={e => setKeywordColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-none" title={T.highlightColor}/>
                                <input 
                                    type="text" 
                                    value={newKeyword} 
                                    onChange={e => setNewKeyword(e.target.value)} 
                                    placeholder={T.keyword} 
                                    className="flex-grow bg-transparent text-sm outline-none border-b border-gray-300 dark:border-gray-700 focus:border-primary px-2"
                                    onKeyDown={e => e.key === 'Enter' && addKeyword()}
                                />
                                <button onClick={addKeyword} className="text-primary hover:bg-primary/10 p-1 rounded"><PlusIcon className="w-5 h-5"/></button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {noteKeywords.map((k, i) => (
                                    <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-200 dark:border-gray-600" style={{backgroundColor: k.color + '20', color: isDarkMode ? '#eee' : '#333'}}>
                                        <span className="w-2 h-2 rounded-full" style={{backgroundColor: k.color}}></span>
                                        {k.text}
                                        <button onClick={() => removeKeyword(k.text)} className="ml-1 text-gray-400 hover:text-red-500">&times;</button>
                                    </span>
                                ))}
                            </div>
                        </div>
                        
                        <textarea 
                            value={noteContent} 
                            onChange={e => setNoteContent(e.target.value)} 
                            className="flex-grow w-full p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none resize-none font-mono text-sm shadow-sm"
                            placeholder="Type your notes here..."
                        />
                    </div>

                    {/* Preview Area */}
                    <div className="lg:col-span-7 flex flex-col gap-6 overflow-hidden">
                        {/* Markdown View */}
                        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col min-h-0">
                            <div className="p-3 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 font-semibold text-sm flex gap-2 items-center text-gray-500">
                                <HighlightIcon className="w-4 h-4"/> {T.markdownPreview}
                            </div>
                            <div className="flex-1 overflow-auto p-6 relative">
                                {noteKeywords.length > 0 ? (
                                    <HighlightedText text={noteContent} keywords={noteKeywords} />
                                ) : (
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{noteContent}</ReactMarkdown>
                                    </div>
                                )}
                                {isNoteProcessing && <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center backdrop-blur-sm"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>}
                            </div>
                        </div>

                        {/* Entities Table/JSON */}
                        {noteEntities.length > 0 && (
                            <div className="h-64 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
                                <div className="p-2 border-b dark:border-gray-700 flex gap-4">
                                    <span className="font-semibold text-sm flex items-center gap-2"><TableIcon className="w-4 h-4"/> {T.entityTable}</span>
                                    <span className="font-semibold text-sm flex items-center gap-2 text-gray-400"><CodeIcon className="w-4 h-4"/> {T.entityJson}</span>
                                </div>
                                <div className="flex-1 overflow-auto p-0 grid grid-cols-1 md:grid-cols-2">
                                    <div className="overflow-auto border-r dark:border-gray-700">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 sticky top-0">
                                                <tr>
                                                    <th className="p-2 font-medium">Name</th>
                                                    <th className="p-2 font-medium">Type</th>
                                                    <th className="p-2 font-medium">Context</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-gray-700">
                                                {noteEntities.map((e, i) => (
                                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                        <td className="p-2 font-medium">{e.name}</td>
                                                        <td className="p-2 text-gray-500">{e.type}</td>
                                                        <td className="p-2 text-gray-500 truncate max-w-[150px]" title={e.context}>{e.context}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="p-2 overflow-auto bg-gray-50 dark:bg-gray-900">
                                        <pre className="text-[10px] font-mono text-blue-600 dark:text-blue-400 whitespace-pre-wrap">
                                            {JSON.stringify(noteEntities, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {activeTab === 'dashboard' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-bold mb-6">{T.resultsDashboard}</h2>
                    {analysisResult ? (
                        <div className="grid md:grid-cols-2 gap-8">
                            {analysisResult.entities && analysisResult.entities.length > 0 ? (
                                <div className="bg-surface/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                                    <h3 className="font-semibold mb-4 text-center">{T.extractedEntities}</h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={Object.entries(analysisResult.entities.reduce((acc, curr) => { acc[curr.type] = (acc[curr.type] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([name, value]) => ({ name, count: value }))} layout="vertical" margin={{ left: 20 }}>
                                                <XAxis type="number" hide />
                                                <YAxis type="category" dataKey="name" width={80} tick={{fontSize: 12, fill: isDarkMode ? '#cbd5e1' : '#475569'}}/>
                                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                                                <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 4, 4, 0]} barSize={24} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            ) : <div className="h-64 flex items-center justify-center text-gray-400 border-2 border-dashed rounded-xl">No Entity Data</div>}
                            
                            {analysisResult.sentiment ? (
                                <div className="bg-surface/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                                    <h3 className="font-semibold mb-4 text-center">{T.sentimentAnalysis}</h3>
                                    <div className="h-64">
                                        <ResponsiveContainer>
                                            <PieChart>
                                                <Pie 
                                                    data={[{ name: 'Positive', value: analysisResult.sentiment.positive }, { name: 'Negative', value: analysisResult.sentiment.negative }, { name: 'Neutral', value: analysisResult.sentiment.neutral }]} 
                                                    cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                                                >
                                                    <Cell key="positive" fill="#10b981" />
                                                    <Cell key="negative" fill="#ef4444" />
                                                    <Cell key="neutral" fill="#94a3b8" />
                                                </Pie>
                                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }}/>
                                                <Legend verticalAlign="bottom" height={36}/>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            ) : <div className="h-64 flex items-center justify-center text-gray-400 border-2 border-dashed rounded-xl">No Sentiment Data</div>}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                            <p className="text-gray-500">Run a workflow to generate insights.</p>
                        </div>
                    )}
                </div>
            )}
        </main>
    </div>
  );
};

export default App;
