
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { GeminiProcessingResult } from "../types";

// Always use a named parameter for the API key and refer to process.env.API_KEY directly.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const processAudioMemo = async (base64Audio: string, mimeType: string): Promise<GeminiProcessingResult> => {
  // Use GenerateContentResponse type for better type safety and clarity
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Audio
          }
        },
        {
          text: `Please transcribe this audio. Then provide a concise title, a summary of the main points, and a few relevant tags. 
          Return the result in JSON format with properties: title, transcript, summary, and tags (an array of strings).`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          transcript: { type: Type.STRING },
          summary: { type: Type.STRING },
          tags: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["title", "transcript", "summary", "tags"]
      }
    }
  });

  try {
    // The response.text is a getter property, not a method. Do not call it as text().
    const result = JSON.parse(response.text || '{}');
    return result as GeminiProcessingResult;
  } catch (error) {
    console.error("Failed to parse Gemini response", error);
    return {
      title: "New Voice Memo",
      transcript: "Could not transcribe audio.",
      summary: "No summary available.",
      tags: ["Voice"]
    };
  }
};

export const refineTextMemo = async (text: string): Promise<Partial<GeminiProcessingResult>> => {
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `The user wrote this memo: "${text}". 
    Please improve the formatting, correct any grammar, provide a better title, and extract 2-3 tags.
    Return JSON with properties: title, content (improved version), and tags.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING },
          tags: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["title", "content", "tags"]
      }
    }
  });

  // Ensure response.text exists before parsing, accessed as a property.
  const jsonStr = response.text || '{}';
  return JSON.parse(jsonStr);
};
