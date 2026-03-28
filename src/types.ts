export type AIProvider = 'Google Gemini' | 'Mistral AI' | 'Groq Cloud' | 'OpenAI';

export interface SavedKey {
  id: string;
  key: string;
  visible: boolean;
  provider: AIProvider;
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  platform: Platform;
  filesCount: number;
  data: any[];
}

export interface GeneratedMetadata {
  id: string;
  fileName: string;
  thumbnail: string;
  title: string;
  description: string;
  keywords: string[];
  category?: string;
  status: 'preparing' | 'pending' | 'generating' | 'completed' | 'error';
  error?: string;
  currentKey?: string;
}

export interface GenerationSettings {
  batchSize: number;
  rpm: number;
  isRpmEnabled: boolean;
  titleLength: number;
  titleLengthUnit: 'Words' | 'Chars';
  descriptionLength: number;
  descriptionLengthUnit: 'Words' | 'Chars';
  keywordsCount: number;
  customPrompt: string;
  themeColor: string;
  autoDownload: boolean;
  autoDownloadZip: boolean;
  changeFileExtension: string;
}

export type Platform = 'General' | 'Adobe Stock' | 'Shutterstock' | 'Freepik' | 'Getty Images' | 'iStock' | 'Dreamstime' | 'Vecteezy';
