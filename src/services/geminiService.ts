import { GoogleGenAI, Type } from "@google/genai";

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  initialDelay: number = 5000
): Promise<T> {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      retries++;
      const errorMsg = (error?.message || error?.toString() || '').toLowerCase();
      const errorCode = (error?.code || error?.status || '').toString();
      const isRateLimit = 
        errorCode.includes('429') || 
        errorMsg.includes('429') || 
        errorMsg.includes('resource_exhausted') || 
        errorMsg.includes('rate limit') ||
        errorMsg.includes('quota exceeded');
      
      const isQuotaError = errorMsg.includes('quota exceeded') || errorMsg.includes('exceeded your current quota');
      
      if (isRateLimit && !isQuotaError && retries < maxRetries) {
        const delay = initialDelay * Math.pow(2, retries - 1);
        console.warn(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

function parseAIResponse(text: string) {
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from markdown blocks
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (e2) {
        // Fallback to manual cleanup
      }
    }
    
    // Last resort: find first { and last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        return JSON.parse(text.substring(firstBrace, lastBrace + 1));
      } catch (e3) {
        // Failed
      }
    }
    throw new Error("Failed to parse AI response as JSON");
  }
}

export async function generateMetadata(
  imageBase64: string | null,
  mimeType: string,
  settings: {
    titleLength: number;
    titleLengthUnit?: 'Words' | 'Chars';
    descriptionLength: number;
    descriptionLengthUnit?: 'Words' | 'Chars';
    keywordsCount: number;
    customPrompt: string;
    apiKey?: string;
    model?: string;
    fileName?: string;
    platform?: string;
    provider?: string;
    avoidTitles?: string[];
  }
) {
  const provider = settings.provider || 'Google Gemini';
  const apiKey = settings.apiKey || (provider === 'Google Gemini' ? process.env.GEMINI_API_KEY : undefined);
  
  if (!apiKey) throw new Error(`API Key for ${provider} is missing.`);

  const platformContext = settings.platform ? `Target Platform: ${settings.platform}` : "";
  const isStock = ['Adobe Stock', 'Shutterstock', 'Freepik', 'Vecteezy', 'Creative Market', 'Getty Images', 'iStock', 'Dreamstime'].includes(settings.platform || '');

  const titleConstraint = settings.titleLengthUnit === 'Words' 
    ? `MAX ${settings.titleLength} words` 
    : `MAX ${settings.titleLength} characters`;

  const descriptionConstraint = settings.platform === 'Adobe Stock' 
    ? "NOT REQUIRED for Adobe Stock. Return an empty string." 
    : (settings.descriptionLengthUnit === 'Words' 
        ? `MAX ${settings.descriptionLength} words` 
        : `MAX ${settings.descriptionLength} characters`);

  const avoidContext = settings.avoidTitles && settings.avoidTitles.length > 0 
    ? `\nCRITICAL: AVOID using these titles as they are already in use for similar content in this batch: ${settings.avoidTitles.join(', ')}. Create a UNIQUE variation.`
    : "";

  const systemInstructions = `
    You are a world-class ${isStock ? 'Microstock Metadata Expert' : 'Freelance SEO & Conversion Expert'}. Your goal is to optimize metadata for ${settings.platform}.
    
    CRITICAL: DO NOT BE ROBOTIC. Standard AI often uses generic, fluffy language. You must avoid this.
    Instead, use "Buyer-First" language. Think about exactly what a buyer types into a search bar when they have a problem to solve.
    
    ${isStock ? `
    MICROSTOCK "SIMILAR CONTENT" SAFEGUARD:
    - If you are analyzing multiple similar designs, you MUST create unique variations.
    - Do not repeat the same title or keywords across similar assets.
    - Use different synonyms, angles, and specific details to differentiate.
    ${avoidContext}
    ` : `
    FREELANCE GIG OPTIMIZATION:
    - Focus on "Buyer-First" language.
    - Use "High-Intent" titles.
    `}
    
    STRICT CONSTRAINTS:
    1. Title: ${titleConstraint}. ${isStock ? 'Focus on descriptive, keyword-rich titles.' : 'Use patterns like "I will [Action] [Service] for [Benefit]".'}
    2. Description: ${descriptionConstraint}. ${isStock ? 'Describe the scene accurately.' : 'Focus on benefits, not just features.'}
    3. Keywords/Tags: Provide EXACTLY ${settings.keywordsCount} relevant, high-traffic tags.
    4. Category: ${settings.platform === 'Adobe Stock' ? 'Provide the most relevant Adobe Stock category NUMBER (1-21). 1:Animals, 2:Buildings, 3:Business, 4:Drinks, 5:Environment, 6:States of Mind, 7:Food, 8:Graphic Resources, 9:Hobbies, 10:Industry, 11:Landscapes, 12:Lifestyle, 13:People, 14:Plants, 15:Culture, 16:Science, 17:Social Issues, 18:Sports, 19:Technology, 20:Transport, 21:Travel.' : 'Not required.'}
    5. Style: ${settings.customPrompt || "Professional, persuasive, and search-optimized."}
    
    ANTI-ROBOTIC RULES:
    - NO generic phrases like "I am a professional...", "I will provide high quality...", "Expert in...".
    - NO "fluff" words. Every word must serve a search or conversion purpose.
    - Use specific industry terminology that buyers use.
    
    Return the result in JSON format with keys: "title", "description", "keywords"${settings.platform === 'Adobe Stock' ? ', "category"' : ''}.
  `;

  const userPrompt = `
    Service/Gig Description: "${settings.fileName}"
    Target Keywords (if any): "${settings.customPrompt}"
    
    Optimize this metadata for ${settings.platform}.
  `;

  return retryWithBackoff(async () => {
    try {
      if (provider === 'Google Gemini') {
        const ai = new GoogleGenAI({ apiKey: apiKey as string });
        const modelName = settings.model || "gemini-3.1-flash-lite-preview";
        
        const response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              ...(imageBase64 ? [{ inlineData: { data: imageBase64, mimeType } }] : []),
              { text: `${systemInstructions}\n\n${userPrompt}` }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                keywords: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                ...(settings.platform === 'Adobe Stock' ? { category: { type: Type.STRING } } : {})
              },
              required: ["title", "description", "keywords", ...(settings.platform === 'Adobe Stock' ? ["category"] : [])]
            }
          }
        });

        const result = parseAIResponse(response.text || "{}");
        return processResult(result, settings);
      } else {
        // OpenAI-compatible providers (Mistral, Groq, OpenAI)
        let endpoint = '';
        let model = settings.model || '';

        if (provider === 'Mistral AI') {
          endpoint = 'https://api.mistral.ai/v1/chat/completions';
          model = model || 'mistral-small-latest';
        } else if (provider === 'Groq Cloud') {
          endpoint = 'https://api.groq.com/openai/v1/chat/completions';
          model = model || 'llama-3.1-70b-versatile';
        } else if (provider === 'OpenAI') {
          endpoint = 'https://api.openai.com/v1/chat/completions';
          model = model || 'gpt-4o-mini';
        }

        const messages: any[] = [
          { role: 'system', content: systemInstructions },
          { role: 'user', content: userPrompt }
        ];

        // Handle vision for OpenAI/Mistral if supported
        if (imageBase64 && (provider === 'OpenAI' || (provider === 'Mistral AI' && model.includes('pixtral')))) {
          messages[1].content = [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
          ];
        }

        const response = await fetch('/api/proxy-ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            endpoint,
            apiKey,
            body: {
              model,
              messages,
              response_format: { type: 'json_object' }
            }
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error?.message || `API Error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content || "{}";
        const result = typeof content === 'string' ? parseAIResponse(content) : content;
        return processResult(result, settings);
      }
    } catch (error) {
      console.error(`${provider} Generation Error:`, error);
      throw error;
    }
  });
}

function processResult(result: any, settings: any) {
  // Post-processing to ensure constraints are met
  
  // Title processing
  if (result.title) {
    if (settings.titleLengthUnit === 'Words') {
      const words = result.title.trim().split(/\s+/);
      if (words.length > settings.titleLength) {
        result.title = words.slice(0, settings.titleLength).join(' ');
      }
    } else {
      if (result.title.length > settings.titleLength) {
        result.title = result.title.substring(0, settings.titleLength).trim();
      }
    }
  }

  // Description processing
  if (result.description) {
    if (settings.descriptionLengthUnit === 'Words') {
      const words = result.description.trim().split(/\s+/);
      if (words.length > settings.descriptionLength) {
        result.description = words.slice(0, settings.descriptionLength).join(' ');
      }
    } else {
      if (result.description.length > settings.descriptionLength) {
        result.description = result.description.substring(0, settings.descriptionLength).trim();
      }
    }
  }

  // Keywords processing
  if (result.keywords && result.keywords.length > settings.keywordsCount) {
    result.keywords = result.keywords.slice(0, settings.keywordsCount);
  }
  
  return result;
}

