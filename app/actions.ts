'use server';

import { GoogleGenAI, Type } from '@google/genai';

export interface ExtractedBoxData {
  box_number: number;
  destination_room: string;
  items: string[];
}

export async function getApiKey() {
  const key = process.env.API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!key) {
    console.error('API Key not found in environment variables (API_KEY or NEXT_PUBLIC_GEMINI_API_KEY)');
    return null;
  }
  return key;
}

export async function checkEnvironmentStatus() {
  const serverKey = process.env.API_KEY;
  const publicKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  
  return {
    serverKeyConfigured: !!serverKey && serverKey !== 'TODO',
    serverKeyPrefix: serverKey ? serverKey.substring(0, 4) + '...' : 'N/A',
    publicKeyConfigured: !!publicKey && publicKey !== 'TODO',
    publicKeyPrefix: publicKey ? publicKey.substring(0, 4) + '...' : 'N/A',
    nodeEnv: process.env.NODE_ENV
  };
}

export async function extractBoxData(base64Image: string, mimeType: string, retries = 2): Promise<ExtractedBoxData> {
  // Prioritize server-side API_KEY, fallback to NEXT_PUBLIC_ if needed
  let apiKey = process.env.API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  
  if (apiKey) {
    apiKey = apiKey.trim();
  }
  
  const keyPrefix = apiKey ? apiKey.substring(0, 4) + '...' : 'NONE';
  console.log(`[extractBoxData] Starting extraction. API Key present: ${!!apiKey}, Prefix: ${keyPrefix}, Length: ${apiKey?.length}`);
  console.log(`[extractBoxData] Image length: ${base64Image?.length}`);

  if (!apiKey || apiKey === 'TODO' || apiKey.includes('INSERT_KEY') || apiKey.startsWith('MY_G')) {
    console.error(`[extractBoxData] API Key is invalid (Value: ${apiKey?.substring(0, 10)}...)`);
    throw new Error(`Invalid API Key detected ('${apiKey?.substring(0, 15)}...'). It looks like a placeholder. Please update your Secrets with a real Gemini API Key (starts with AIza).`);
  }

  const ai = new GoogleGenAI({ apiKey });
  let lastError: any;
  
  // Handle base64 string that might or might not have the prefix
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  for (let i = 0; i <= retries; i++) {
    try {
      // Try gemini-2.5-flash as it might be more stable with certain keys
      const modelName = 'gemini-2.5-flash'; 
      console.log(`[extractBoxData] Attempt ${i + 1} with model ${modelName}`);
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType,
                },
              },
              {
                text: `Analyze this image of a moving box list. 
The handwriting might be messy. If you see ambiguous characters, use context to infer the word (e.g., a squiggle that looks like an 'S' at the start of a kitchen item is likely 'Spoons').

Look for:
1. Box Number: Usually a prominent number at the top or circled.
2. Items: A list of objects. Clean up typos and standardize names (e.g., 'Toster' -> 'Toaster').
3. Destination Room: Infer from items (e.g., 'Plates' -> 'Kitchen') or look for a room name.

Return a JSON object with: {box_number: int, destination_room: string, items: [string, string]}.`,
              },
            ],
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              box_number: {
                type: Type.INTEGER,
                description: 'The box number found in the image. If none found, return 0.',
              },
              destination_room: {
                type: Type.STRING,
                description: 'The destination room for the box.',
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
                description: 'The list of items in the box.',
              },
            },
            required: ['box_number', 'destination_room', 'items'],
          },
        },
      });

      const text = response.text;
      if (!text) {
        console.error('[extractBoxData] Empty response from AI');
        throw new Error('Empty response from AI');
      }
      
      console.log('[extractBoxData] Success:', text.substring(0, 100) + '...');
      return JSON.parse(text) as ExtractedBoxData;
    } catch (error: any) {
      lastError = error;
      console.error(`[extractBoxData] Error on attempt ${i + 1}:`, error);
      
      // Check for fetch errors specifically
      if (error.message?.includes('fetch') || error.name === 'TypeError') {
        console.error('[extractBoxData] Network error calling Gemini API:', error);
      }

      // If it's a transient error, wait a bit before retrying
      if (i < retries) {
        console.log(`[extractBoxData] Retrying in ${1000 * (i + 1)}ms...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  console.error('[extractBoxData] All attempts failed');
  throw lastError || new Error('Failed to extract data after multiple attempts');
}
