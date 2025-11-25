Technical Specification: Floral Agentic Workflow Application
1. Executive Summary
The Floral Agentic Workflow is a client-side Single Page Application (SPA) designed to empower users to analyze documents (PDF, JSON, MD, TXT) using customizable AI agents. The application leverages Google’s Gemini API and OpenAI’s API for Optical Character Recognition (OCR), text summarization, entity extraction, and sentiment analysis. It features a highly customizable "Floral" UI utilizing CSS variables for dynamic theming, a luck-wheel style selector, and a robust "Smart Note" editing environment.
2. System Architecture
2.1 High-Level Architecture
The application follows a Serverless, Client-Side Architecture. No backend database or server is required for the core logic. All state persistence is handled via the browser's localStorage, and AI computations are offloaded to third-party APIs (Google GenAI/OpenAI) directly from the client.
Presentation Layer: React 19 (DOM), Tailwind CSS.
Logic Layer: TypeScript, React Hooks (useState, useEffect, useCallback).
Data Layer: Browser localStorage, File API (FileReader).
External Services: Google Gemini API (Multimodal/Text), OpenAI API (Text).
2.2 Directory Structure
code
Text
/
├── index.html          # Entry point, import maps, PDF.js worker config
├── index.tsx           # React Root initialization
├── App.tsx             # Main controller, state management, UI layout
├── types.ts            # TypeScript interfaces and Enum definitions
├── constants.ts        # Configuration constants, Themes, Localization strings
├── services/
│   └── aiService.ts    # API wrappers for Gemini and OpenAI
└── components/
    ├── icons.tsx       # SVG Icon library
    ├── PdfViewer.tsx   # Canvas-based PDF rendering & OCR controls
    └── ThemeWheel.tsx  # Interactive theme selection component
3. Technology Stack
Category	Technology	Reasoning
Framework	React 19	Latest concurrent features, robust ecosystem.
Language	TypeScript	Type safety for complex data structures (Agents, Documents).
Styling	Tailwind CSS	Utility-first, easy implementation of Dark Mode and CSS Variables.
AI SDK	@google/genai	Native Google SDK for Gemini 2.5 Flash (Multimodal capabilities).
Visualization	Recharts	Responsive, composable charting for dashboard analytics.
PDF Handling	PDF.js	Industry standard for rendering PDFs to HTML5 Canvas.
Markdown	React-Markdown	Safe rendering of AI-generated Markdown content.
4. Feature Specifications
4.1 Document Processing Engine
Supported Formats: .pdf, .txt, .json, .md.
Ingestion Logic:
Text-based files are read via FileReader.readAsText.
PDF files are loaded as binary buffers into pdfjs-dist.
Viewer:
PDF: Renders current page to HTML Canvas. Supports Zoom (0.5x - 3.0x) and Pagination.
Text/Code: Rendered in a <pre> block or Markdown viewer.
OCR Capability: User-triggered "OCR This Page" button captures the current Canvas state as a high-quality JPEG Base64 string and sends it to gemini-2.5-flash for text extraction.
4.2 Agentic Workflow Engine
Agent Model: Defined by the Agent interface.
Configurable: Model (Gemini/OpenAI), Max Tokens (100 - 12,000), System Prompt.
Execution Pipeline:
Sequential execution of agent list.
Input: Document Content + User Prompt.
Output Handling: Raw text storage + JSON parsing (regex extraction of code blocks).
Modification: Users can open a Modal to Edit raw output or Preview Markdown rendering.
4.3 Smart Note System
Input: Text area for free-form notes.
AI Features:
Smart Format: LLM prompt transforms raw text into structured Markdown.
Entity Extraction: Extracts 20 structured entities with context into a table.
Keyword Highlighting: Custom Regex-based highlighter. Users define (Keyword, Color) tuples.
4.4 UI/UX & Theming
Dynamic Theming:
20 predefined FlowerTheme objects.
CSS Variables (--color-primary, --color-surface) injected into :root at runtime.
Luck Wheel: Canvas/CSS transform-based interactive spinner for random theme selection.
Localization: Complete support for en (English) and zh-TW (Traditional Chinese) via a dictionary map in constants.ts.
5. Data Models
5.1 The Agent
code
TypeScript
interface Agent {
  id: string;
  name: string;
  prompt: string;
  model: string;     // e.g., 'gemini/gemini-2.5-flash'
  maxTokens: number; // Slider range: 100 - 12000
  status: 'Pending' | 'Running' | 'Success' | 'Error';
  output: string | null;
  outputJson: any | null; // Parsed JSON if applicable
}
5.2 The Document
code
TypeScript
interface DocumentFile {
  id: string;
  name: string;
  type: 'PDF' | 'TXT' | 'JSON' | 'MARKDOWN' | 'EMPTY';
  content: string;    // The context sent to LLM (includes OCR results)
  rawContent?: string; // The original text for preview
  rawFile?: File;     // Binary object for PDF.js
  summary?: string;   // Auto-generated summary
}
6. API Integration Strategy
6.1 Authentication
Storage: API Keys are stored in window.localStorage.
Security: Keys are never transmitted to any server other than the official Google/OpenAI endpoints.
Session: Keys are loaded into memory on app mount (initGeminiService, initOpenAIService).
6.2 Service Logic (aiService.ts)
Text Generation:
unifiedProcessAgentPrompt: Switches logic based on model prefix (gemini/ vs openai/).
Gemini: Uses ai.models.generateContent with config.maxOutputTokens.
OpenAI: Uses chat.completions.create.
Multimodal (OCR):
Uses Gemini's inlineData capability. Sends { mimeType: 'image/jpeg', data: base64 }.
7. Performance & Optimization
PDF Rendering: Uses pdf.js worker to prevent blocking the main thread during document parsing.
Memoization: React useMemo used for expensive derivations (e.g., Sentiment/Entity analysis aggregation) and Theme object calculation.
Debouncing: Not currently implemented but recommended for future versions of the "Smart Note" highlighter if content exceeds 10k words.
Asset Loading: Tailwind and Icons are lightweight. PDF.js worker is loaded via CDN to reduce bundle size.
8. Future Roadmap / Extension Points
Export Functionality: Add ability to export Agent results to .csv or .json files.
Prompt Library: Save and load custom agent prompts from a persistent library.
Chained Agents: Allow Agent B to use Agent A's output as input (Sequential Chains).
Local LLM Support: Integration with Chrome Built-in AI (Nano) or Ollama for offline privacy.
Multi-File Support: Batch processing of multiple PDFs.
