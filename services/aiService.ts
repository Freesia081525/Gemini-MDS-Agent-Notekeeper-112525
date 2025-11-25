import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { Agent, NoteEntity } from '../types';

let geminiAI: GoogleGenAI | null = null;
let openai: OpenAI | null = null;

export const initGeminiService = (apiKey: string) => {
  if (!apiKey) {
    geminiAI = null;
    return;
  }
  // Initialize with the new SDK syntax
  geminiAI = new GoogleGenAI({ apiKey });
};

export const initOpenAIService = (apiKey: string) => {
  if (!apiKey) {
    openai = null;
    return;
  }
  openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
};

export const unifiedProcessAgentPrompt = async (agent: Agent, documentContent: string): Promise<string> => {
  const [provider, modelName] = agent.model.split('/');
  const fullPrompt = `DOCUMENT CONTENT:\n---\n${documentContent}\n---\n\nTASK:\n${agent.prompt}`;

  if (provider === 'gemini') {
    if (!geminiAI) throw new Error("Gemini API key is not configured.");
    try {
      // Use ai.models.generateContent
      const result = await geminiAI.models.generateContent({
        model: modelName,
        contents: fullPrompt,
        config: {
            maxOutputTokens: agent.maxTokens,
        }
      });
      
      return result.text || "";
    } catch (error: any) {
      if (error.message?.includes('403') || error.message?.includes('key')) {
        throw new Error('Invalid Gemini API Key.');
      }
      throw new Error(`Gemini Error: ${error.message}`);
    }
  }

  if (provider === 'openai') {
    if (!openai) throw new Error("OpenAI API key is not configured.");
    try {
      const completion = await openai.chat.completions.create({
        model: modelName,
        messages: [{ role: "user", content: fullPrompt }],
        max_tokens: agent.maxTokens,
      });
      return completion.choices[0]?.message?.content ?? "";
    } catch (error: any) {
       if (error.status === 401) {
        throw new Error('Invalid OpenAI API Key.');
      }
      throw new Error(`OpenAI Error: ${error.message}`);
    }
  }

  throw new Error(`Unsupported provider: ${provider}`);
};

export const performOcrWithGemini = async (imageDataBase64: string): Promise<string> => {
  if (!geminiAI) throw new Error("Gemini API key is not configured for OCR.");
  
  try {
    // New SDK structure for multimodal content
    const response = await geminiAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageDataBase64
            }
          },
          {
            text: "Perform accurate OCR on this image. Return only the extracted text, preserving layout where possible."
          }
        ]
      }
    });

    return response.text || "";
  } catch (error: any) {
    console.error("OCR Error", error);
    throw new Error("Failed to perform OCR with Gemini.");
  }
};

export const generateDocumentSummary = async (text: string): Promise<string> => {
    if (!geminiAI) return "Gemini API Key missing for summary.";
    try {
        const response = await geminiAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Summarize the following text in 3 concise paragraphs:\n\n${text.substring(0, 30000)}` // Truncate to avoid limit in simple demo
        });
        return response.text || "Could not generate summary.";
    } catch (e) {
        return "Failed to generate summary.";
    }
}

export const generateSmartFormat = async (text: string): Promise<string> => {
    if(!geminiAI) throw new Error("Gemini API Key missing");
    const response = await geminiAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Transform the following raw notes into clean, well-structured Markdown. Use headers, bullet points, and bold text for emphasis where appropriate.\n\nRAW NOTES:\n${text}`
    });
    return response.text || text;
}

export const generateEntityExtraction = async (text: string): Promise<NoteEntity[]> => {
    if(!geminiAI) throw new Error("Gemini API Key missing");
    const response = await geminiAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Extract exactly 20 key entities (concepts, people, places, or items) from the text. 
        Return a JSON array of objects with keys: "name" (string), "type" (string), "context" (short sentence explaining its relevance).
        
        TEXT:\n${text}
        
        Output JSON:`
    });
    
    try {
        const textRes = response.text || "[]";
        const jsonMatch = textRes.match(/```json\n([\s\S]*?)\n```/) || textRes.match(/```([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : textRes;
        return JSON.parse(jsonStr);
    } catch(e) {
        console.error("Entity parsing error", e);
        return [];
    }
}