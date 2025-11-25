
export enum AgentStatus {
  Pending = 'Pending',
  Running = 'Running',
  Success = 'Success',
  Error = 'Error',
}

export enum DocumentType {
  EMPTY = 'EMPTY',
  PDF = 'PDF',
  TXT = 'TXT',
  JSON = 'JSON',
  MARKDOWN = 'MARKDOWN',
}

export interface DocumentFile {
  id: string;
  name: string;
  type: DocumentType;
  content: string; // The extracted text used for Agents
  rawContent?: string; // For raw text/json/md preview
  rawFile?: File; // The actual file object for PDF preview
  summary?: string; // Auto-generated summary
}

export interface Agent {
  id: string;
  name: string;
  prompt: string;
  model: string;
  maxTokens: number;
  status: AgentStatus;
  output: string | null;
  outputJson: any | null;
  error: string | null;
}

export interface AnalysisResult {
  sentiment: { positive: number; negative: number; neutral: number } | null;
  entities: Array<{ name: string; type: string }> | null;
}

export interface FlowerTheme {
  name: string;
  primary: string;
  secondary: string;
  surface: string; // light bg
  text: string;
}

export type Language = 'en' | 'zh-TW';

export interface Localization {
  title: string;
  workflow: string;
  dashboard: string;
  settings: string;
  style: string;
  language: string;
  mode: string;
  uploadDocument: string;
  uploadHint: string;
  documentControl: string;
  addAgent: string;
  agentWorkflow: string;
  runWorkflow: string;
  running: string;
  resultsDashboard: string;
  extractedEntities: string;
  sentimentAnalysis: string;
  apiKeySettings: string;
  apiKeyHint: string;
  saveKeys: string;
  summary: string;
  generatingSummary: string;
  zoomIn: string;
  zoomOut: string;
  page: string;
  luckWheel: string;
  spin: string;
  maxTokens: string;
  model: string;
  prompt: string;
  smartNote: string;
  ocrThisPage: string;
  ocrProcessing: string;
  ocrSuccess: string;
  formatNote: string;
  extractEntities: string;
  highlightColor: string;
  keyword: string;
  addHighlight: string;
  markdownPreview: string;
  entityTable: string;
  entityJson: string;
  editOutput: string;
  preview: string;
  save: string;
  cancel: string;
  edit: string;
}

export interface NoteEntity {
  name: string;
  context: string;
  type: string;
}

export interface KeywordConfig {
  text: string;
  color: string;
}
