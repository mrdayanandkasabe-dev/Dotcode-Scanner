import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";

// Lazy initialization holder
let ai: GoogleGenAI | null = null;
const STORAGE_KEY = 'user_gemini_api_key';

// Helper to save key from UI
export const setStoredApiKey = (key: string) => {
  if (key) {
    localStorage.setItem(STORAGE_KEY, key.trim());
    ai = null; // Force re-initialization
  }
};

// Helper to remove key (logout)
export const removeStoredApiKey = () => {
  localStorage.removeItem(STORAGE_KEY);
  ai = null;
};

// Check if we have a key available (Env OR Storage)
export const hasApiKey = () => {
  const envKey = process.env.API_KEY;
  const storedKey = localStorage.getItem(STORAGE_KEY);
  
  // Return true if either exists and is not a placeholder
  if (envKey && envKey !== "" && envKey !== "undefined") return true;
  if (storedKey && storedKey !== "") return true;
  
  return false;
};

const getAI = () => {
  if (!ai) {
    // 1. Try Environment Variable (Build time / Vercel Settings)
    let apiKey = process.env.API_KEY;
    
    // 2. If missing, try Local Storage (User entered in UI)
    if (!apiKey || apiKey === "" || apiKey === "undefined") {
      apiKey = localStorage.getItem(STORAGE_KEY) || "";
    }
    
    // 3. If still missing, throw specific error to trigger UI prompt
    if (!apiKey) {
      const error = new Error("API Key is missing. Please enter it in Settings.");
      (error as any).code = "MISSING_API_KEY";
      throw error;
    }
    
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

export interface ScannedItem {
  dotCode: string;
  manufacturingDate?: string;
  price?: string;
  confidence: "High" | "Medium" | "Low";
  rawText?: string;
}

export interface AnalysisResult {
  items: ScannedItem[];
  summary: string;
}

export const analyzeImage = async (base64Image: string): Promise<AnalysisResult> => {
  // Ensure we have a clean base64 string
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  
  try {
    const client = getAI();
    
    // Using gemini-2.0-flash for superior vision capabilities
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data,
            },
          },
          {
            text: `Analyze this image of product packaging. 
            Your goal is to extract ANY and ALL visible alphanumeric tracking codes, DotCodes, or batch codes.
            
            Look for:
            - Matrices of dots with text (DotCodes).
            - Text starting with "VR", "HCN", or similar alphanumeric patterns.
            - White text on black backgrounds.
            - Any unique product identifiers.
            
            Do NOT be conservative. If you see text that looks like a code, extract it.
            
            For EACH detected code, extract:
            1. The main alphanumeric tracking code (dotCode).
            2. The manufacturing date (MFD) if visible.
            3. The price (MRP) if visible.
            4. A confidence assessment (High/Medium/Low).
            5. The raw text read from the label.
            
            Return the data in RAW JSON format. Do NOT use markdown formatting (no \`\`\`json blocks).`
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        // Disable safety settings to prevent blocking of product labels
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dotCode: { type: Type.STRING, description: "The extracted alphanumeric tracking code." },
                  manufacturingDate: { type: Type.STRING, description: "The manufacturing date (e.g. 06/09/25)." },
                  price: { type: Type.STRING, description: "The price (e.g. 170.00)." },
                  confidence: { type: Type.STRING, enum: ["High", "Medium", "Low"], description: "Confidence level of the extraction." },
                  rawText: { type: Type.STRING, description: "All text read from this specific label area." }
                },
                required: ["dotCode", "confidence"]
              },
              description: "List of all detected product codes."
            },
            summary: { type: Type.STRING, description: "A short summary sentence about what was detected (e.g. 'Found 5 product codes')." }
          },
          required: ["items", "summary"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text received from Gemini API");
    }

    console.log("Raw Model Response:", text); // Debugging

    // Robust JSON extraction: Find the substring between the first '{' and last '}'
    const jsonStartIndex = text.indexOf('{');
    const jsonEndIndex = text.lastIndexOf('}');
    
    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
       // If the model refuses to answer or returns just text
       console.error("Invalid response format:", text);
       throw new Error(`AI did not return a valid JSON object. Raw response: "${text.substring(0, 100)}..."`);
    }

    const jsonString = text.substring(jsonStartIndex, jsonEndIndex + 1);

    try {
      return JSON.parse(jsonString) as AnalysisResult;
    } catch (e) {
      console.error("JSON Parse Error. Raw Text:", text);
      throw new Error(`Failed to parse AI response: ${e instanceof Error ? e.message : String(e)}. Raw text length: ${text.length}`);
    }

  } catch (error: any) {
    console.error("Error calling Gemini:", error);
    
    // Check for missing key code from our getAI function
    if ((error as any).code === "MISSING_API_KEY") throw error;

    // Pass through specific errors
    if (error.message?.includes("API Key")) throw error;
    if (error.message?.includes("JSON")) throw error;
    
    if (error.status === 403) throw new Error("API Key invalid or restricted (403). Please check your API key.");
    if (error.status === 404) throw new Error("Model not found (404). Check API Key access or model availability.");
    if (error.status === 429) throw new Error("API Quota exceeded (429). You are being rate limited.");
    if (error.status === 400) throw new Error("Bad Request (400). The image might be too large or invalid.");
    
    throw new Error(`Analysis failed: ${error.message || "Unknown error"}`);
  }
};