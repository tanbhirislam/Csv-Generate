import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Upload, 
  Settings, 
  Play, 
  Pause, 
  Trash2, 
  Download, 
  History, 
  Key, 
  HelpCircle, 
  ChevronRight, 
  Copy, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Layers,
  X,
  Eye,
  EyeOff,
  Youtube,
  Facebook,
  MessageCircle,
  Sun,
  Moon,
  Briefcase,
  ShoppingBag,
  Search,
  Camera,
  Zap,
  Sparkles,
  Globe,
  ShieldCheck,
  Cloud,
  Layout,
  Users,
  Shield,
  BarChart3,
  LogOut,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { cn } from './lib/utils';
import { GeneratedMetadata, GenerationSettings, Platform, AIProvider, SavedKey, HistoryItem } from './types';
import { generateMetadata } from './services/geminiService';
import { auth, db, loginWithGoogle, logout, UserProfile, AppSetting, UsageLog } from './firebase';
import { Routes, Route, useNavigate, Navigate, Link } from 'react-router-dom';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, getDocs, updateDoc, serverTimestamp, Timestamp, onSnapshot } from 'firebase/firestore';

import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for pdfjs
const PDFJS_VERSION = '5.5.207';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

const PLATFORMS: Platform[] = [
  'Adobe Stock', 'Shutterstock', 'Freepik', 'Vecteezy', 'Getty Images', 'iStock', 'Dreamstime', 'Fiverr', 'Upwork', 'Etsy', 'General SEO'
];

interface FileWithMetadata extends GeneratedMetadata {
  id: string;
  fileName: string;
  thumbnail: string;
  status: 'preparing' | 'pending' | 'generating' | 'completed' | 'error';
  error?: string;
  originalFile?: File | null;
  type?: 'image' | 'eps' | 'svg';
}

const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  'Google Gemini': ['Gemini 3.1 Flash Lite', 'Gemini 3.1 Pro'],
  'Mistral AI': ['Mistral Small', 'Mistral Large', 'Pixtral 12B'],
  'Groq Cloud': ['Llama 3.1 70B', 'Llama 3.3 70B', 'Mixtral 8x7B'],
  'OpenAI': ['GPT-4o mini', 'GPT-4o']
};

export default function App() {
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [generating, setGenerating] = useState(false);
  const [activePlatform, setActivePlatform] = useState<Platform>('Fiverr');
  const [settings, setSettings] = useState<GenerationSettings>(() => {
    const saved = localStorage.getItem('generation_settings');
    const defaultSettings: GenerationSettings = {
      batchSize: 5,
      rpm: 60,
      isRpmEnabled: false,
      titleLength: 20,
      titleLengthUnit: 'Words',
      descriptionLength: 56,
      descriptionLengthUnit: 'Words',
      keywordsCount: 30,
      customPrompt: 'Default (Recommended)',
      themeColor: '#3b82f6',
      themeMode: 'dark',
      autoDownload: false,
      autoDownloadZip: false,
      changeFileExtension: 'Default'
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultSettings, ...parsed };
      } catch (e) {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  const [sidebarTab, setSidebarTab] = useState<'metadata' | 'prompt'>('metadata');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const navigate = useNavigate();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [adminSettings, setAdminSettings] = useState<AppSetting | null>(null);
  const [previewFile, setPreviewFile] = useState<FileWithMetadata | null>(null);
  const [activeProvider, setActiveProvider] = useState<AIProvider>('Google Gemini');
  const [selectedModel, setSelectedModel] = useState('Gemini 3.1 Flash Lite');
  const [savedKeys, setSavedKeys] = useState<SavedKey[]>(() => {
    const saved = localStorage.getItem('ai_api_keys') || localStorage.getItem('gemini_api_keys');
    const keys = saved ? JSON.parse(saved) : [];
    // Migration for old keys without provider
    return keys.map((k: any) => ({ ...k, provider: k.provider || 'Google Gemini' }));
  });
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('generation_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [newKey, setNewKey] = useState('');
  const [activeKeyInUse, setActiveKeyInUse] = useState<string | null>(null);
  const generatingRef = useRef(false);
  const settingsRef = useRef(settings);
  const filesRef = useRef(files);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    localStorage.setItem('ai_api_keys', JSON.stringify(savedKeys));
  }, [savedKeys]);

  useEffect(() => {
    localStorage.setItem('generation_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (settings.themeMode === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [settings.themeMode]);

  useEffect(() => {
    if (adminSettings) {
      // Update favicon
      if (adminSettings.faviconUrl) {
        let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = adminSettings.faviconUrl;
      }
      
      // Update site title
      document.title = adminSettings.siteName;
      
      // Update primary color CSS variable
      document.documentElement.style.setProperty('--primary-color', adminSettings.primaryColor);
      document.documentElement.style.setProperty('--accent-color', adminSettings.accentColor);
    }
  }, [adminSettings]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Sync user profile
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        let profile: UserProfile;
        if (!userSnap.exists()) {
          profile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'User',
            photoURL: firebaseUser.photoURL || '',
            role: firebaseUser.email === 'businessonline.6251@gmail.com' ? 'admin' : 'user',
            createdAt: Timestamp.now(),
            lastLogin: Timestamp.now()
          };
          await setDoc(userRef, profile);
        } else {
          profile = userSnap.data() as UserProfile;
          await updateDoc(userRef, { lastLogin: serverTimestamp() });
        }
        
        setUserProfile(profile);
        setIsAdmin(profile.role === 'admin' && profile.email === 'businessonline.6251@gmail.com' && firebaseUser.emailVerified);
      } else {
        setUserProfile(null);
        setIsAdmin(false);
      }
      setIsLoadingAuth(false);
    });

    // Fetch global settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setAdminSettings(docSnap.data() as AppSetting);
      } else {
        const defaultAdminSettings: AppSetting = {
          maintenanceMode: false,
          defaultRPM: 60,
          allowedProviders: ['Google Gemini', 'Mistral AI', 'Groq Cloud', 'OpenAI'],
          siteName: 'SEO Metadata Generator',
          siteDescription: 'Professional SEO metadata generator for stock contributors.',
          logoUrl: '',
          faviconUrl: '',
          primaryColor: '#3b82f6',
          secondaryColor: '#1e293b',
          accentColor: '#8b5cf6',
          footerText: '© 2024 SEO Metadata Generator. All rights reserved.',
          heroTitle: 'Generate High-Quality SEO Metadata',
          heroSubtitle: 'Boost your visibility on stock platforms with AI-powered titles, descriptions, and keywords.',
          heroTitleColor: '#ffffff',
          heroSubtitleColor: 'rgba(255, 255, 255, 0.4)',
          settingsTitle: 'GIG SEO SETTINGS',
          tutorialText: 'Tutorial',
          tutorialUrl: 'https://youtube.com/@tanbhirislamjihad',
          facebookUrl: 'https://facebook.com/tanbhirislamjihad.bd?mibextid=ZbWKwL',
          youtubeUrl: 'https://youtube.com/@tanbhirislamjihad'
        };
        setAdminSettings(defaultAdminSettings);
      }
    }, (err) => {
      console.error('Failed to fetch global settings:', err);
    });

    return () => {
      unsubscribe();
      unsubSettings();
    };
  }, []);

  const [logoClicks, setLogoClicks] = useState(0);

  const handleLogoClick = () => {
    if (!isAdmin) return;
    const newClicks = logoClicks + 1;
    setLogoClicks(newClicks);
    if (newClicks >= 5) {
      window.location.href = '/admin.html';
      setLogoClicks(0);
    }
    // Reset clicks after 2 seconds of inactivity
    setTimeout(() => setLogoClicks(0), 2000);
  };

  // Sync local theme with admin settings if not already customized
  useEffect(() => {
    if (adminSettings?.primaryColor && settings.themeColor === '#3b82f6') {
      setSettings(prev => ({ ...prev, themeColor: adminSettings.primaryColor }));
    }
  }, [adminSettings?.primaryColor]);

  // Update document title and favicon
  useEffect(() => {
    if (adminSettings?.siteName) {
      document.title = adminSettings.siteName;
    }
    if (adminSettings?.faviconUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = adminSettings.faviconUrl;
    }
  }, [adminSettings?.siteName, adminSettings?.faviconUrl]);

  const activeThemeColor = settings.themeColor;
  const activeSecondaryColor = adminSettings?.secondaryColor || '#1e293b';
  const activeAccentColor = adminSettings?.accentColor || '#8b5cf6';

  const currentProviderKeys = savedKeys.filter(k => k.provider === activeProvider);
  const currentActiveKey = currentProviderKeys.length > 0 ? currentProviderKeys[0].key : undefined;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || []) as File[];
    if (uploadedFiles.length === 0) return;

    // Separate CSVs from media files
    const csvFiles = uploadedFiles.filter(f => f.name.toLowerCase().endsWith('.csv'));
    const mediaFiles = uploadedFiles.filter(f => !f.name.toLowerCase().endsWith('.csv'));

    const processMediaFile = async (file: File): Promise<FileWithMetadata> => {
      let thumbnail = '';
      let type: 'image' | 'eps' | 'svg' = 'image';

      const fileNameLower = file.name.toLowerCase();

      if (file.type.startsWith('image/') || file.type === 'image/svg+xml' || fileNameLower.endsWith('.svg')) {
        thumbnail = URL.createObjectURL(file);
        type = file.type === 'image/svg+xml' || fileNameLower.endsWith('.svg') ? 'svg' : 'image';
      } else if (fileNameLower.endsWith('.eps')) {
        type = 'eps';
        // Try to extract a preview from EPS if it has a PDF compatibility layer
        try {
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Check for binary EPS header (0xC5D0D3C6)
          // Many EPS files have a 30-byte binary header before the PostScript/PDF content
          let startPos = 0;
          if (uint8Array[0] === 0xC5 && uint8Array[1] === 0xD0 && uint8Array[2] === 0xD3 && uint8Array[3] === 0xC6) {
            // Binary header found, get the offset to the PostScript section
            // The offset is stored in bytes 4-7 (little-endian)
            startPos = uint8Array[4] | (uint8Array[5] << 8) | (uint8Array[6] << 16) | (uint8Array[7] << 24);
          }

          // Search for %PDF- header in the first 10MB (some AI/EPS files have very large headers)
          const searchRange = Math.min(uint8Array.length, 10 * 1024 * 1024);
          const pdfHeader = new Uint8Array([37, 80, 68, 70, 45]); // %PDF-
          
          let pdfStartIndex = -1;
          for (let i = startPos; i < searchRange - 5; i++) {
            if (uint8Array[i] === pdfHeader[0] && 
                uint8Array[i+1] === pdfHeader[1] && 
                uint8Array[i+2] === pdfHeader[2] && 
                uint8Array[i+3] === pdfHeader[3] && 
                uint8Array[i+4] === pdfHeader[4]) {
              pdfStartIndex = i;
              break;
            }
          }
          
          if (pdfStartIndex !== -1) {
            const pdfData = uint8Array.slice(pdfStartIndex);
            const loadingTask = pdfjsLib.getDocument({ 
              data: pdfData,
              stopAtErrors: false, // Be more lenient with PDF errors in EPS
            });
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            
            // Use a higher scale for better quality preview
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // Limit canvas size to avoid memory issues
            const maxDimension = 4096;
            let scale = 2;
            if (viewport.width > maxDimension || viewport.height > maxDimension) {
              scale = maxDimension / Math.max(viewport.width, viewport.height);
            }
            const finalViewport = scale === 2 ? viewport : page.getViewport({ scale });

            canvas.height = finalViewport.height;
            canvas.width = finalViewport.width;
            
            if (context) {
              context.fillStyle = 'white';
              context.fillRect(0, 0, canvas.width, canvas.height);
              await page.render({ canvasContext: context, viewport: finalViewport, canvas }).promise;
              thumbnail = canvas.toDataURL('image/png');
            }
          }
        } catch (error) {
          console.error('Error rendering EPS preview:', error);
        }
        
        if (!thumbnail) {
          // Better fallback for EPS - use a specific vector icon
          thumbnail = 'https://cdn-icons-png.flaticon.com/512/337/337941.png'; // EPS icon
        }
      } else {
        // Generic file icon
        thumbnail = 'https://cdn-icons-png.flaticon.com/512/337/337946.png';
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        fileName: file.name,
        thumbnail,
        title: '',
        description: '',
        keywords: [],
        status: 'pending',
        originalFile: file,
        type
      };
    };

    // Process CSVs
    csvFiles.forEach(file => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const importedFiles: FileWithMetadata[] = results.data.map((row: any) => {
            const fileName = row.Filename || row.filename || row.File || row.file || 'unknown.jpg';
            return {
              id: Math.random().toString(36).substr(2, 9),
              fileName,
              thumbnail: 'https://cdn-icons-png.flaticon.com/512/16/16410.png', // Generic image placeholder
              title: row.Title || row.title || '',
              description: row.Description || row.description || '',
              keywords: (row.Keywords || row.keywords || '').split(',').map((k: string) => k.trim()).filter(Boolean),
              status: (row.Title || row.Description) ? 'completed' : 'pending',
              originalFile: null,
              type: 'image'
            };
          });
          setFiles(prev => [...prev, ...importedFiles]);
        }
      });
    });

    // Process media files and try to match with existing pending entries
    const processAllMedia = async () => {
      // First, add all files to the state with 'preparing' status
      const initialFiles = mediaFiles.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        fileName: file.name,
        thumbnail: 'https://cdn-icons-png.flaticon.com/512/16/16410.png',
        title: '',
        description: '',
        keywords: [],
        status: 'preparing' as const,
        originalFile: file,
        type: 'image' as const
      }));
      
      setFiles(prev => [...prev, ...initialFiles]);

      // Process all files in parallel for better performance
      await Promise.all(initialFiles.map(async (initialFile) => {
        if (!initialFile.originalFile) return;
        
        try {
          const processed = await processMediaFile(initialFile.originalFile);
          
          setFiles(prev => prev.map(f => {
            if (f.id === initialFile.id) {
              return {
                ...f,
                thumbnail: processed.thumbnail,
                type: processed.type,
                status: 'pending' as const
              };
            }
            return f;
          }));
        } catch (error) {
          console.error(`Error processing file ${initialFile.fileName}:`, error);
          setFiles(prev => prev.map(f => {
            if (f.id === initialFile.id) {
              return {
                ...f,
                status: 'pending' as const // Still allow it to be pending even if preview fails
              };
            }
            return f;
          }));
        }
      }));
    };

    processAllMedia();

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const redoGeneration = async (id: string) => {
    const fileIndex = files.findIndex(f => f.id === id);
    if (fileIndex === -1) return;

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'generating', error: undefined } : f));
    
    try {
      const currentFile = files[fileIndex];
      const providerKeys = savedKeys.filter(k => k.provider === activeProvider);
      
      if (providerKeys.length === 0) {
        setIsSettingsOpen(true);
        addNotification(`Please add a ${activeProvider} API Key in settings first.`, 'error');
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: 'No API key found' } : f));
        return;
      }

      // Map selected model to actual model ID
      const modelMap: Record<string, string> = {
        'Gemini 3.1 Flash Lite': 'gemini-3.1-flash-lite-preview',
        'Gemini 3.1 Pro': 'gemini-3.1-pro-preview',
        'Mistral Small': 'mistral-small-latest',
        'Mistral Large': 'mistral-large-latest',
        'Pixtral 12B': 'pixtral-12b-latest',
        'Llama 3.1 70B': 'llama-3.1-70b-versatile',
        'Llama 3.3 70B': 'llama-3.3-70b-specdec',
        'Mixtral 8x7B': 'mixtral-8x7b-32768',
        'GPT-4o mini': 'gpt-4o-mini',
        'GPT-4o': 'gpt-4o'
      };
      const modelId = modelMap[selectedModel] || modelMap['Gemini 3.1 Flash Lite'];

      let aiData = { base64: null as string | null, mimeType: 'image/jpeg' };
      if (currentFile.originalFile) {
        aiData = await processFileForAI(currentFile.originalFile);
      }

      // Try keys until success
      let success = false;
      let keyIdx = 0;
      const existingTitles = filesRef.current
        .filter(f => f.status === 'completed' && f.id !== id)
        .map(f => f.title)
        .slice(-10);

      while (!success && keyIdx < providerKeys.length) {
        const activeKey = providerKeys[keyIdx].key;
        setFiles(prev => prev.map(f => f.id === id ? { ...f, currentKey: activeKey } : f));
        
        try {
          const result = await generateMetadata(
            aiData.base64,
            aiData.mimeType,
            {
              titleLength: settingsRef.current.titleLength,
              titleLengthUnit: settingsRef.current.titleLengthUnit,
              descriptionLength: settingsRef.current.descriptionLength,
              descriptionLengthUnit: settingsRef.current.descriptionLengthUnit,
              keywordsCount: settingsRef.current.keywordsCount,
              customPrompt: settingsRef.current.customPrompt === 'Default (Recommended)' ? '' : settingsRef.current.customPrompt,
              apiKey: activeKey,
              model: modelId,
              fileName: currentFile.fileName,
              platform: activePlatform,
              provider: activeProvider,
              avoidTitles: existingTitles
            }
          );

          setFiles(prev => prev.map(f => f.id === id ? { ...f, ...result, status: 'completed' } : f));
          success = true;
        } catch (error: any) {
          const errorMsg = (error?.message || error?.toString() || '').toLowerCase();
          const isRateLimit = errorMsg.includes('429') || errorMsg.includes('quota exceeded') || errorMsg.includes('rate limit');
          
          if (isRateLimit && keyIdx < providerKeys.length - 1) {
            keyIdx++;
            addNotification(`Key exhausted. Shifting to next key...`, 'info');
          } else {
            throw error;
          }
        }
      }
    } catch (error: any) {
      console.error(`Redo failed for ${id}:`, error);
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'error', 
        error: error?.message || 'Generation failed.' 
      } : f));
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const processFileForAI = async (file: File): Promise<{ base64: string | null, mimeType: string }> => {
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = Math.min(1, 1024 / Math.max(img.width || 1024, img.height || 1024));
            canvas.width = (img.width || 1024) * scale;
            canvas.height = (img.height || 1024) * scale;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const pngBase64 = canvas.toDataURL('image/png').split(',')[1];
              resolve({ base64: pngBase64, mimeType: 'image/png' });
            } else {
              resolve({ base64: null, mimeType: 'image/png' });
            }
          };
          img.onerror = () => resolve({ base64: null, mimeType: 'image/png' });
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      });
    }
    
    if (file.name.toLowerCase().endsWith('.eps')) {
      // If we have a thumbnail that isn't the placeholder, use it for AI
      const fileInQueue = files.find(f => f.fileName === file.name);
      if (fileInQueue && fileInQueue.thumbnail && !fileInQueue.thumbnail.includes('cdn-icons-png')) {
        return { base64: fileInQueue.thumbnail.split(',')[1], mimeType: 'image/png' };
      }
      return { base64: null, mimeType: 'application/postscript' };
    }

    const base64 = await fileToBase64(file);
    return { base64, mimeType: file.type || 'image/jpeg' };
  };

  const clearAll = () => {
    setFiles([]);
    setGenerating(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Optional: show a toast or feedback
  };

  const [showSettingsFeedback, setShowSettingsFeedback] = useState(false);

  const handleSaveSettings = () => {
    localStorage.setItem('generation_settings', JSON.stringify(settings));
    setShowSettingsFeedback(true);
    setTimeout(() => setShowSettingsFeedback(false), 2000);
  };

  const [notifications, setNotifications] = useState<{ id: string; message: string; type: 'info' | 'error' | 'success' }[]>([]);

  const addNotification = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const startGeneration = async () => {
    if (generating) {
      setGenerating(false);
      generatingRef.current = false;
      return;
    }
    
    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
    if (pendingFiles.length === 0) {
      addNotification('No pending files to generate metadata for.', 'info');
      return;
    }

    if (!user) {
      addNotification('Please login with Google to start generating metadata.', 'error');
      loginWithGoogle();
      return;
    }

    if (adminSettings?.maintenanceMode && !isAdmin) {
      addNotification('The application is currently undergoing maintenance. Please try again later.', 'error');
      return;
    }

    const providerKeys = savedKeys.filter(k => k.provider === activeProvider);
    if (providerKeys.length === 0) {
      setIsSettingsOpen(true);
      addNotification(`Please add a ${activeProvider} API Key in settings first.`, 'error');
      return;
    }

    setGenerating(true);
    generatingRef.current = true;
    
    // Map selected model to actual model ID
    const modelMap: Record<string, string> = {
      'Gemini 3.1 Flash Lite': 'gemini-3.1-flash-lite-preview',
      'Gemini 3.1 Pro': 'gemini-3.1-pro-preview',
      'Mistral Small': 'mistral-small-latest',
      'Mistral Large': 'mistral-large-latest',
      'Pixtral 12B': 'pixtral-12b-latest',
      'Llama 3.1 70B': 'llama-3.1-70b-versatile',
      'Llama 3.3 70B': 'llama-3.3-70b-specdec',
      'Mixtral 8x7B': 'mixtral-8x7b-32768',
      'GPT-4o mini': 'gpt-4o-mini',
      'GPT-4o': 'gpt-4o'
    };
    const modelId = modelMap[selectedModel] || modelMap['Gemini 3.1 Flash Lite'];

    // Track exhausted keys for this session
    const exhaustedKeys = new Set<string>();
    const generatedTitlesInBatch = new Set<string>();
    const keyIndexRef = { current: 0 };

    // Process in batches
    let completedInThisSession = 0;
    let i = 0;
    while (i < pendingFiles.length && generatingRef.current) {
      const currentBatchSize = settingsRef.current.batchSize;
      const batch = pendingFiles.slice(i, i + currentBatchSize);
      
      // Update status to generating for the whole batch
      setFiles(prev => prev.map(f => 
        batch.find(bf => bf.id === f.id) ? { ...f, status: 'generating' } : f
      ));

      await Promise.all(batch.map(async (currentFile) => {
        let success = false;
        let attempts = 0;
        const maxKeyAttempts = providerKeys.length;

        while (!success && attempts < maxKeyAttempts && generatingRef.current) {
          // ... (existing key selection logic)
          let activeKeyObj = providerKeys[keyIndexRef.current % providerKeys.length];
          
          // Skip exhausted keys if possible
          let searchCount = 0;
          while (exhaustedKeys.has(activeKeyObj.key) && searchCount < providerKeys.length) {
            keyIndexRef.current++;
            activeKeyObj = providerKeys[keyIndexRef.current % providerKeys.length];
            searchCount++;
          }

          setActiveKeyInUse(activeKeyObj.key);
          setFiles(prev => prev.map(f => f.id === currentFile.id ? { ...f, currentKey: activeKeyObj.key } : f));

          try {
            let aiData = { base64: null as string | null, mimeType: 'image/jpeg' };
            if (currentFile.originalFile) {
              aiData = await processFileForAI(currentFile.originalFile);
            }

            const result = await generateMetadata(
              aiData.base64,
              aiData.mimeType,
              {
                titleLength: settingsRef.current.titleLength,
                titleLengthUnit: settingsRef.current.titleLengthUnit,
                descriptionLength: settingsRef.current.descriptionLength,
                descriptionLengthUnit: settingsRef.current.descriptionLengthUnit,
                keywordsCount: settingsRef.current.keywordsCount,
                customPrompt: settingsRef.current.customPrompt === 'Default (Recommended)' ? '' : settingsRef.current.customPrompt,
                apiKey: activeKeyObj.key,
                model: modelId,
                fileName: currentFile.fileName,
                platform: activePlatform,
                provider: activeProvider,
                avoidTitles: Array.from(generatedTitlesInBatch).slice(-10)
              }
            );

            if (!generatingRef.current) return;

            if (result.title) {
              generatedTitlesInBatch.add(result.title);
            }

            setFiles(prev => prev.map(f => f.id === currentFile.id ? { ...f, ...result, status: 'completed' } : f));
            success = true;
            completedInThisSession++;
            // Rotate key index for next request to distribute load
            keyIndexRef.current++;
          } catch (error: any) {
            // ... (existing error handling)
            const errorMsg = (error?.message || error?.toString() || '').toLowerCase();
            const errorCode = (error?.code || error?.status || '').toString();
            const isRateLimit = 
              errorCode.includes('429') || 
              errorMsg.includes('429') || 
              errorMsg.includes('resource_exhausted') || 
              errorMsg.includes('rate limit') ||
              errorMsg.includes('quota exceeded');

            if (isRateLimit) {
              console.warn(`Key ${maskKey(activeKeyObj.key)} exhausted. Shifting to next key...`);
              exhaustedKeys.add(activeKeyObj.key);
              addNotification(`API Key ${maskKey(activeKeyObj.key)} quota exhausted. Shifting...`, 'error');
              keyIndexRef.current++;
              attempts++;
              
              if (attempts >= maxKeyAttempts) {
                setFiles(prev => prev.map(f => f.id === currentFile.id ? { 
                  ...f, 
                  status: 'error',
                  error: 'All available API keys for this provider are exhausted.'
                } : f));
              }
            } else {
              console.error(`Error generating for ${currentFile.fileName}:`, error);
              setFiles(prev => prev.map(f => f.id === currentFile.id ? { 
                ...f, 
                status: 'error',
                error: 'Generation failed.'
              } : f));
              success = true; // Stop retrying for non-rate-limit errors
            }
          }
        }
      }));

      i += currentBatchSize;
      setActiveKeyInUse(null);

      // Log usage to Firestore
      if (user) {
        try {
          await setDoc(doc(collection(db, 'usage_logs')), {
            userId: user.uid,
            platform: activePlatform,
            timestamp: serverTimestamp(),
            fileCount: batch.length
          });
        } catch (e) {
          console.error('Failed to log usage:', e);
        }
      }

      // RPM Throttling: Wait if there are more batches
      if (generatingRef.current && i < pendingFiles.length) {
        const effectiveRPM = settingsRef.current.isRpmEnabled 
          ? Math.min(settingsRef.current.rpm, adminSettings?.defaultRPM || 60)
          : (adminSettings?.defaultRPM || 60);
        
        const delay = (60 / effectiveRPM) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    setGenerating(false);
    generatingRef.current = false;

    // Trigger completion modal if any files were completed in this session
    if (completedInThisSession > 0) {
      setTimeout(() => {
        setIsCompletionModalOpen(true);
        
        // Auto-download if enabled
        if (settingsRef.current.autoDownload) {
          exportCSV();
        }
        if (settingsRef.current.autoDownloadZip) {
          downloadEmbeddedZip();
        }
      }, 500);
    }
  };

  const downloadEmbeddedZip = async () => {
    const completedFiles = filesRef.current.filter(f => f.status === 'completed');
    if (completedFiles.length === 0) return;

    const zip = new JSZip();
    const folder = zip.folder("metadata_embedded_files");

    for (const file of completedFiles) {
      if (file.originalFile) {
        folder?.file(file.fileName, file.originalFile);
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `metadata_embedded_${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const data = files
      .filter(f => f.status === 'completed')
      .map(f => {
        if (activePlatform === 'Fiverr') {
          return {
            'Service Title': f.title,
            'Gig Description': f.description,
            'Search Tags': f.keywords.join(', ')
          };
        }
        if (activePlatform === 'Upwork') {
          return {
            'Job Title': f.title,
            'Profile Overview': f.description,
            'Skills': f.keywords.join(', ')
          };
        }
        if (activePlatform === 'Getty Images' || activePlatform === 'iStock') {
          return {
            'Filename': f.fileName,
            'Description': f.description || f.title,
            'Keywords': f.keywords.join(', ')
          };
        }
        if (activePlatform === 'Vecteezy') {
          return {
            'Filename': f.fileName,
            'Title': f.title,
            'Description': f.description,
            'Keywords': f.keywords.join(', ')
          };
        }
        // Default for LinkedIn, Etsy, etc.
        return {
          'Title': f.title,
          'Description': f.description,
          'Keywords/Tags': f.keywords.join(', ')
        };
      });

    if (data.length === 0) return;

    // Save to history
    const newHistoryItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString(),
      platform: activePlatform,
      filesCount: data.length,
      data: data
    };
    setHistory(prev => [newHistoryItem, ...prev]);

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `metadata_${activePlatform.toLowerCase().replace(' ', '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadHistoryItem = (item: HistoryItem) => {
    const csv = Papa.unparse(item.data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `metadata_${item.platform.toLowerCase().replace(' ', '_')}_${item.id}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  const testKey = async (keyToTest?: string, keyId?: string): Promise<boolean> => {
    const key = typeof keyToTest === 'string' ? keyToTest : newKey.trim();
    if (!key) return false;
    
    if (keyId) {
      setSavedKeys(prev => prev.map(k => k.id === keyId ? { ...k, status: 'testing' } : k));
    } else {
      setTestStatus('testing');
    }
    setTestError(null);
    
    try {
      // Map selected model to actual model ID
      const modelMap: Record<string, string> = {
        'Gemini 3.1 Flash Lite': 'gemini-3.1-flash-lite-preview',
        'Gemini 3.1 Pro': 'gemini-3.1-pro-preview',
        'Mistral Small': 'mistral-small-latest',
        'Mistral Large': 'mistral-large-latest',
        'Pixtral 12B': 'pixtral-12b-latest',
        'Llama 3.1 70B': 'llama-3.1-70b-versatile',
        'Llama 3.3 70B': 'llama-3.3-70b-specdec',
        'Mixtral 8x7B': 'mixtral-8x7b-32768',
        'GPT-4o mini': 'gpt-4o-mini',
        'GPT-4o': 'gpt-4o'
      };
      
      // For testing, we prefer the most stable/basic model for the provider
      let modelId = modelMap[selectedModel];
      if (activeProvider === 'Google Gemini') modelId = 'gemini-flash-latest';
      else if (activeProvider === 'Mistral AI') modelId = 'mistral-small-latest';
      else if (activeProvider === 'Groq Cloud') modelId = 'llama-3.1-70b-versatile';
      else if (activeProvider === 'OpenAI') modelId = 'gpt-4o-mini';
      
      modelId = modelId || modelMap[selectedModel] || 'gemini-flash-latest';

      // Simple text-only test call to the selected provider for maximum compatibility
      const result = await generateMetadata(
        null,
        "image/png",
        {
          titleLength: 10,
          descriptionLength: 10,
          keywordsCount: 5,
          customPrompt: "Test",
          apiKey: key,
          model: modelId,
          fileName: "test_image.jpg",
          platform: activePlatform,
          provider: activeProvider,
          avoidTitles: []
        }
      );
      
      if (result && (result.title || result.description)) {
        if (keyId) {
          setSavedKeys(prev => prev.map(k => k.id === keyId ? { ...k, status: 'valid' } : k));
        } else {
          setTestStatus('success');
          setTimeout(() => setTestStatus('idle'), 2000);
        }
        return true;
      }
      
      const errorMsg = "API returned an empty or invalid response. Please check your key permissions.";
      if (keyId) {
        setSavedKeys(prev => prev.map(k => k.id === keyId ? { ...k, status: 'invalid' } : k));
      } else {
        setTestError(errorMsg);
        setTestStatus('error');
      }
      return false;
    } catch (error: any) {
      console.error(`Test failed for ${activeProvider}:`, error);
      let errorMsg = error?.message || error?.toString() || 'Unknown error';
      
      // Make common errors more user-friendly
      if (errorMsg.includes('API key not valid')) {
        errorMsg = "The API key you entered is invalid. Please double-check it and try again.";
      } else if (errorMsg.includes('Quota exceeded') || errorMsg.includes('429')) {
        errorMsg = "Rate limit exceeded or quota reached for this key. Please try a different key.";
      } else if (errorMsg.includes('Failed to fetch')) {
        errorMsg = "Network error: Could not reach the AI provider. This might be a temporary issue or a CORS restriction.";
      }
      
      if (keyId) {
        setSavedKeys(prev => prev.map(k => k.id === keyId ? { ...k, status: 'invalid' } : k));
      } else {
        setTestError(errorMsg);
        setTestStatus('error');
        // Keep error visible longer for user to read
        setTimeout(() => {
          setTestStatus('idle');
        }, 8000);
      }
      return false;
    }
  };

  const saveKey = async () => {
    const rawKeys = newKey.trim();
    if (!rawKeys) return;
    
    // Split by newlines or commas and clean up
    const keysToProcess = rawKeys.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 0);
    
    if (keysToProcess.length === 0) return;
    
    const newKeys: SavedKey[] = [];
    const existingKeys = savedKeys.filter(k => k.provider === activeProvider).map(k => k.key);
    
    for (const key of keysToProcess) {
      if (!existingKeys.includes(key)) {
        newKeys.push({
          id: Math.random().toString(36).substr(2, 9) + Date.now().toString(),
          key: key,
          visible: false,
          provider: activeProvider,
          status: 'testing'
        });
      }
    }

    if (newKeys.length === 0) {
      setNewKey('');
      return;
    }

    setSavedKeys(prev => [...prev, ...newKeys]);
    setNewKey('');
    addNotification(`Saving ${newKeys.length} keys...`, 'info');

    // Test in background
    newKeys.forEach(async (k) => {
      await testKey(k.key, k.id);
    });
  };


  const removeKey = (id: string) => {
    setSavedKeys(savedKeys.filter(k => k.id !== id));
  };

  const toggleKeyVisibility = (id: string) => {
    setSavedKeys(savedKeys.map(k => k.id === id ? { ...k, visible: !k.visible } : k));
  };

  const maskKey = (key: string) => {
    if (key.length < 10) return "••••••••••";
    return "••••••••••••••••••••••••••••" + key.slice(-6);
  };

  return (
    <Routes>
      <Route path="/admin.html" element={<AdminPage isAdmin={isAdmin} user={user} />} />
      <Route path="/login.html" element={<LoginPage />} />
      <Route path="/user.html" element={
        <div 
          className={cn(
            "min-h-screen font-sans transition-colors duration-300 bg-bg-main text-text-main", 
            settings.themeMode === 'light' ? 'light' : ''
          )} 
          style={{ 
            '--theme-color': activeThemeColor,
            '--secondary-color': activeSecondaryColor,
            '--accent-color': activeAccentColor
          } as React.CSSProperties}
        >
      {/* Header */}
      <header className="h-16 border-b border-border-main flex items-center justify-between px-8 bg-bg-card sticky top-0 z-50">
        <div 
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={handleLogoClick}
        >
          {adminSettings?.logoUrl ? (
            <img 
              src={adminSettings.logoUrl} 
              alt="Logo" 
              className="w-10 h-10 rounded-xl object-contain shadow-lg"
              referrerPolicy="no-referrer"
            />
          ) : (
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-2xl relative overflow-hidden group"
              style={{ 
                background: `linear-gradient(135deg, ${activeThemeColor}, ${activeSecondaryColor})`,
              }}
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <motion.div
                animate={{ 
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  duration: 4, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Sparkles className="w-6 h-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
              </motion.div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/20 blur-sm rounded-full" />
            </motion.div>
          )}
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tighter leading-none bg-clip-text text-transparent" 
              style={{ 
                backgroundImage: `linear-gradient(to right, ${activeThemeColor}, ${activeAccentColor})`,
                WebkitBackgroundClip: 'text'
              }}
            >
              {adminSettings?.siteName || 'SEO GIG'}
            </span>
            <div className="flex items-center gap-1 mt-1">
              <div className="h-[1px] w-3 bg-current opacity-20" />
              <span className="text-[9px] uppercase tracking-[0.3em] font-black opacity-40 leading-none">
                Optimizer
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a 
            href={adminSettings?.tutorialUrl || "https://youtube.com/@tanbhirislamjihad"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-full transition-all border group"
            style={{ 
              backgroundColor: `${activeThemeColor}1a`, 
              color: activeThemeColor,
              borderColor: `${activeThemeColor}33`
            }}
          >
            <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">{adminSettings?.tutorialText || 'Tutorial'}</span>
          </a>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const newMode = settings.themeMode === 'dark' ? 'light' : 'dark';
              setSettings(prev => ({ ...prev, themeMode: newMode }));
              localStorage.setItem('generation_settings', JSON.stringify({ ...settings, themeMode: newMode }));
            }}
            className="p-2 rounded-full transition-all border group relative z-[60]"
            style={{ 
              backgroundColor: `${activeThemeColor}1a`, 
              color: activeThemeColor,
              borderColor: `${activeThemeColor}33`
            }}
            title={settings.themeMode === 'dark' ? 'Switch to White Mode' : 'Switch to Night Mode'}
          >
            {settings.themeMode === 'dark' ? (
              <Moon className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            ) : (
              <Sun className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-3 pl-4 border-l border-border-main">
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-text-main leading-none">{user.displayName}</span>
                <span className="text-[10px] text-text-dim uppercase tracking-wider">{isAdmin ? 'Admin' : 'User'}</span>
              </div>
              <img 
                src={user.photoURL || ''} 
                alt="Profile" 
                className="w-8 h-8 rounded-full border border-border-main"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={async () => {
                  await logout();
                  window.location.href = '/login.html';
                }}
                className="p-2 hover:bg-red-500/10 rounded-full text-text-dim hover:text-red-500 transition-all"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <a 
              href="/login.html"
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black font-black text-xs hover:bg-white/90 transition-all shadow-xl"
            >
              <LogIn className="w-4 h-4" />
              Login with Google
            </a>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-8 pt-12 pb-4 text-center max-w-5xl mx-auto">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-black mb-6 tracking-tight"
          style={{ color: settings.themeMode === 'light' ? '#0f172a' : (adminSettings?.heroTitleColor || '#ffffff') }}
        >
          {adminSettings?.heroTitle || 'Generate High-Quality SEO Metadata'}
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg md:text-xl max-w-3xl mx-auto leading-relaxed"
          style={{ color: settings.themeMode === 'light' ? '#475569' : (adminSettings?.heroSubtitleColor || 'rgba(255, 255, 255, 0.4)') }}
        >
          {adminSettings?.heroSubtitle || 'Boost your visibility on stock platforms with AI-powered titles, descriptions, and keywords.'}
        </motion.p>
      </section>

      <div className="fixed top-6 right-6 z-[100] space-y-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className={cn(
                "pointer-events-auto px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-4 min-w-[300px]",
                n.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                n.type === 'success' ? "bg-green-500/10 border-green-500/20 text-green-500" :
                "bg-bg-hover border-border-main text-text-main"
              )}
            >
              {n.type === 'error' && <AlertCircle className="w-5 h-5" />}
              {n.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
              {n.type === 'info' && <HelpCircle className="w-5 h-5" />}
              <p className="text-sm font-bold">{n.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <main className="p-8 grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8 max-w-[1600px] mx-auto">
        {/* Sidebar Controls */}
        <aside className="space-y-6">
          <div className="bg-bg-card rounded-2xl p-6 border border-border-main shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold uppercase tracking-tight">
                {adminSettings?.settingsTitle || 'GIG SEO SETTINGS'}
              </h2>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg"
                style={{ backgroundColor: activeThemeColor }}
              >
                <Settings className="w-5 h-5 text-text-main" />
              </button>
            </div>

            {/* Active AI Status */}
            <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-500/80">
                  ACTIVE AI: <span className="text-text-main">{activeProvider}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 rounded-full border border-blue-500/20">
                <CheckCircle2 className="w-3 h-3 text-blue-500" />
                <span className="text-[9px] font-bold text-blue-500 uppercase">Safeguard Active</span>
              </div>
            </div>

            <div className="space-y-8">
              {/* Batch Size */}
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-main font-medium flex items-center gap-1.5">
                    Batch Size (Concurrent) <HelpCircle className="w-3.5 h-3.5 text-text-dim" />
                  </span>
                  <span className="bg-bg-input px-2 py-1 rounded text-xs font-mono text-text-muted">{settings.batchSize}x</span>
                </div>
                <input 
                  type="range" 
                  min="1" max="20" 
                  value={settings.batchSize}
                  onChange={(e) => setSettings({...settings, batchSize: parseInt(e.target.value)})}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: activeThemeColor }}
                />
              </div>

              {/* RPM */}
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-main font-medium flex items-center gap-1.5">
                    Requests Per Minute (RPM) <HelpCircle className="w-3.5 h-3.5 text-text-dim" />
                  </span>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setSettings({...settings, isRpmEnabled: !settings.isRpmEnabled})}
                      className={cn(
                        "w-10 h-5 rounded-full transition-all relative",
                        settings.isRpmEnabled ? "bg-white/20" : "bg-white/10"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-3 h-3 rounded-full transition-all bg-white",
                        settings.isRpmEnabled ? "right-1" : "left-1"
                      )} />
                    </button>
                    <span className="bg-bg-input px-2 py-1 rounded text-xs font-mono text-text-muted">{settings.rpm} / min</span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="1" max="60" 
                  value={settings.rpm}
                  disabled={!settings.isRpmEnabled}
                  onChange={(e) => setSettings({...settings, rpm: parseInt(e.target.value)})}
                  className={cn(
                    "w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-opacity",
                    settings.isRpmEnabled ? "bg-white/10" : "bg-white/5 opacity-30"
                  )}
                  style={{ accentColor: settings.isRpmEnabled ? activeThemeColor : '#444' }}
                />
              </div>

              <div className="h-px bg-white/5" />

              {/* Tabs for Metadata/Prompt */}
              <div className="flex gap-6">
                <button 
                  onClick={() => setSidebarTab('metadata')}
                  className={cn(
                    "text-sm font-bold pb-2 transition-all relative",
                    sidebarTab === 'metadata' ? "text-text-main" : "text-text-dim hover:text-text-muted"
                  )}
                >
                  Metadata
                  {sidebarTab === 'metadata' && (
                    <motion.div 
                      layoutId="sidebar-tab"
                      className="absolute -bottom-0.5 left-0 right-0 h-0.5"
                      style={{ backgroundColor: activeThemeColor }}
                    />
                  )}
                </button>
                <button 
                  onClick={() => setSidebarTab('prompt')}
                  className={cn(
                    "text-sm font-bold pb-2 transition-all relative",
                    sidebarTab === 'prompt' ? "text-text-main" : "text-text-dim hover:text-text-muted"
                  )}
                >
                  Prompt
                  {sidebarTab === 'prompt' && (
                    <motion.div 
                      layoutId="sidebar-tab"
                      className="absolute -bottom-0.5 left-0 right-0 h-0.5"
                      style={{ backgroundColor: activeThemeColor }}
                    />
                  )}
                </button>
              </div>

              {/* Tab Content */}
              <div className="space-y-6">
                {sidebarTab === 'metadata' ? (
                  <div className="space-y-6">
                    {/* Auto Download Toggles */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-text-muted flex items-center gap-1.5">
                          Auto Download CSV <HelpCircle className="w-3 h-3 opacity-30" />
                        </span>
                        <button 
                          onClick={() => setSettings({...settings, autoDownload: !settings.autoDownload})}
                          className={cn(
                            "w-10 h-5 rounded-full transition-all relative",
                            settings.autoDownload ? "bg-bg-hover" : "bg-bg-input"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-3 h-3 rounded-full transition-all bg-text-main",
                            settings.autoDownload ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-text-muted flex items-center gap-1.5">
                          Auto Download Embedded Zip <HelpCircle className="w-3 h-3 opacity-30" />
                        </span>
                        <button 
                          onClick={() => setSettings({...settings, autoDownloadZip: !settings.autoDownloadZip})}
                          className={cn(
                            "w-10 h-5 rounded-full transition-all relative",
                            settings.autoDownloadZip ? "bg-bg-hover" : "bg-bg-input"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-3 h-3 rounded-full transition-all bg-text-main",
                            settings.autoDownloadZip ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>

                    <div className="h-px bg-bg-input" />

                    {[
                      { label: 'Title Length', key: 'titleLength', max: 200, unitKey: 'titleLengthUnit' },
                      { label: 'Description Length', key: 'descriptionLength', max: 200, unitKey: 'descriptionLengthUnit' },
                      { label: 'Keywords Count', key: 'keywordsCount', max: 50, unitKey: null }
                    ].map((slider) => (
                      <div key={slider.key} className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-text-main font-medium">{slider.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-text-main">{settings[slider.key as keyof GenerationSettings]}</span>
                            {slider.unitKey && (
                              <select 
                                value={settings[slider.unitKey as keyof GenerationSettings] as string}
                                onChange={(e) => setSettings({...settings, [slider.unitKey!]: e.target.value})}
                                className="bg-bg-input border border-border-main rounded px-1 py-0.5 text-[10px] font-bold focus:outline-none"
                              >
                                <option value="Words">Words</option>
                                <option value="Chars">Chars</option>
                              </select>
                            )}
                            {!slider.unitKey && <span className="text-[10px] font-bold text-text-muted uppercase">Keywords</span>}
                          </div>
                        </div>
                        <input 
                          type="range" 
                          min="1" max={slider.max} 
                          value={settings[slider.key as keyof GenerationSettings] as number}
                          onChange={(e) => setSettings({...settings, [slider.key]: parseInt(e.target.value)})}
                          className="w-full h-1.5 bg-bg-input rounded-lg appearance-none cursor-pointer"
                          style={{ accentColor: activeThemeColor }}
                        />
                      </div>
                    ))}

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Advance Title</span>
                      <button 
                        onClick={() => setIsPromptModalOpen(true)}
                        className="text-xs font-bold transition-colors"
                        style={{ color: activeThemeColor }}
                      >
                        Expand
                      </button>
                    </div>

                    <div className="space-y-3">
                      <span className="text-sm font-medium">Custom Prompt</span>
                      <div className="relative">
                        <select 
                          className="w-full bg-bg-input border border-border-main rounded-xl px-4 py-3 text-sm focus:outline-none appearance-none cursor-pointer"
                          value={settings.customPrompt}
                          onChange={(e) => setSettings({...settings, customPrompt: e.target.value})}
                        >
                          <option value="Default (Recommended)">Default (Recommended)</option>
                          <option value="Creative">Creative</option>
                          <option value="SEO Focused">SEO Focused</option>
                          <option value="Minimalist">Minimalist</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                          <ChevronRight className="w-4 h-4 rotate-90" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-sm font-medium">Change File extension</span>
                      <input 
                        type="text"
                        className="w-full bg-bg-input border border-border-main rounded-xl px-4 py-3 text-sm focus:outline-none placeholder:text-text-dim"
                        placeholder="Default"
                        value={settings.changeFileExtension}
                        onChange={(e) => setSettings({...settings, changeFileExtension: e.target.value})}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-main font-medium">Custom Prompt</span>
                      <button 
                        onClick={() => setIsPromptModalOpen(true)}
                        className="text-xs font-bold uppercase tracking-wider hover:underline"
                        style={{ color: activeThemeColor }}
                      >
                        Expand
                      </button>
                    </div>
                    <div className="relative">
                      <textarea 
                        className="w-full bg-bg-input border border-border-main rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors h-48 resize-none"
                        style={{ borderColor: activeThemeColor + '33' }}
                        placeholder="Add custom instructions for the AI..."
                        value={settings.customPrompt}
                        onChange={(e) => setSettings({...settings, customPrompt: e.target.value})}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Theme Color */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Theme Color :</span>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-10 h-10 rounded-full border-2 border-border-main shadow-lg cursor-pointer"
                    style={{ backgroundColor: settings.themeColor }}
                    onClick={() => {
                      const colors = ['#3b82f6', '#f97316', '#10b981', '#ef4444', '#8b5cf6'];
                      const currentIndex = colors.indexOf(settings.themeColor);
                      const nextIndex = (currentIndex + 1) % colors.length;
                      setSettings({...settings, themeColor: colors[nextIndex]});
                    }}
                  />
                </div>
              </div>

              {/* Theme Mode Toggle removed from here and moved to header */}

              <button 
                onClick={handleSaveSettings}
                className={cn(
                  "w-full font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] text-white",
                  showSettingsFeedback ? "bg-green-500" : ""
                )}
                style={{ 
                  backgroundColor: showSettingsFeedback ? undefined : activeThemeColor,
                  boxShadow: showSettingsFeedback ? undefined : `0 10px 15px -3px ${activeThemeColor}33`
                }}
              >
                {showSettingsFeedback ? 'Settings Saved!' : 'Save Settings'}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="space-y-8">
          {/* Upload Section */}
          <section className="bg-bg-card rounded-2xl p-8 border border-border-main shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Service Descriptions</h2>
            </div>

            {/* Dropzone / Grid */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "min-h-[300px] border-2 border-dashed rounded-2xl transition-all flex flex-wrap gap-4 p-6 cursor-pointer",
                files.length === 0 
                  ? "border-border-main bg-bg-input" 
                  : "border-transparent bg-bg-input"
              )}
              style={{ 
                borderColor: files.length === 0 ? undefined : 'transparent',
                '--hover-border-color': activeThemeColor + '4d' 
              } as any}
            >
              <input 
                type="file" 
                multiple 
                accept="image/*,.eps,.svg,.csv"
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
              
              {files.length === 0 ? (
                <div className="w-full flex flex-col items-center justify-center text-text-dim">
                  <Upload className="w-12 h-12 mb-4" />
                  <p className="text-lg font-medium">Click or drag service details here</p>
                  <p className="text-sm">Supports Text, CSV, and Service Details</p>
                </div>
              ) : (
                <div className="w-full max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 w-full">
                  {files.map((file) => (
                    <div key={file.id} className="relative aspect-square group">
                      <img 
                        src={file.thumbnail} 
                        alt={file.fileName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover rounded-xl border border-white/10"
                      />
                      {file.type !== 'image' && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[8px] font-bold text-text-main/80 uppercase tracking-wider border border-border-main">
                          {file.type}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-4">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewFile(file);
                          }}
                          className="p-3 bg-bg-input hover:bg-bg-hover rounded-full transition-all hover:scale-110"
                          title="View Preview"
                        >
                          <Eye className="w-6 h-6 text-text-main" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(file.id);
                          }}
                          className="p-3 bg-bg-input hover:bg-bg-hover rounded-full transition-all hover:scale-110"
                          title="Remove File"
                        >
                          <Trash2 className="w-6 h-6 text-red-500" />
                        </button>
                      </div>
                      {file.status === 'preparing' && (
                        <div 
                          className="absolute inset-0 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center gap-2"
                          style={{ backgroundColor: activeThemeColor + '33' }}
                        >
                          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: activeThemeColor }} />
                          <span className="text-[10px] font-bold text-text-main uppercase tracking-widest">Preparing...</span>
                        </div>
                      )}
                      {file.status === 'generating' && (
                        <div 
                          className="absolute inset-0 backdrop-blur-[2px] rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: activeThemeColor + '33' }}
                        >
                          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: activeThemeColor }} />
                        </div>
                      )}
                      {file.status === 'completed' && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="w-5 h-5 text-green-500 fill-black" />
                        </div>
                      )}
                      {file.status === 'error' && (
                        <div className="absolute top-2 right-2 group/error">
                          <AlertCircle className="w-5 h-5 text-red-500 fill-black cursor-help" />
                          <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-red-500 text-text-main text-[10px] rounded-lg opacity-0 group-hover/error:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                            {file.error || 'Generation failed'}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Add More Button */}
                  <div 
                    className="aspect-square rounded-xl border-2 border-dashed border-border-main flex flex-col items-center justify-center text-text-dim transition-all"
                    style={{ 
                      '--hover-border-color': activeThemeColor + '4d',
                      '--hover-text-color': activeThemeColor + '80'
                    } as any}
                  >
                    <span className="text-2xl font-bold">+{files.length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

            {/* Platform Tabs */}
            <div className="flex flex-wrap gap-2 mt-8 p-1 bg-white/5 rounded-xl w-fit">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setActivePlatform(p)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                    activePlatform === p 
                      ? "text-text-main shadow-lg" 
                      : "text-text-dim hover:text-text-muted"
                  )}
                  style={{ 
                    backgroundColor: activePlatform === p ? activeThemeColor : undefined,
                    boxShadow: activePlatform === p ? `0 10px 15px -3px ${activeThemeColor}33` : undefined
                  }}
                >
                  {p === 'Adobe Stock' && <ImageIcon className="w-4 h-4" />}
                  {p === 'Shutterstock' && <Camera className="w-4 h-4" />}
                  {p === 'Freepik' && <Zap className="w-4 h-4" />}
                  {p === 'Vecteezy' && <Layout className="w-4 h-4" />}
                  {p === 'Getty Images' && <Globe className="w-4 h-4" />}
                  {p === 'iStock' && <ShieldCheck className="w-4 h-4" />}
                  {p === 'Dreamstime' && <Cloud className="w-4 h-4" />}
                  {p === 'Fiverr' && <Layers className="w-4 h-4" />}
                  {p === 'Upwork' && <Briefcase className="w-4 h-4" />}
                  {p === 'Etsy' && <ShoppingBag className="w-4 h-4" />}
                  {p === 'General SEO' && <Search className="w-4 h-4" />}
                  {p}
                </button>
              ))}
            </div>

            {/* Active API Key Info */}
            <div className="mt-6 flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Key className="w-5 h-5 text-white/40" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white/20 uppercase tracking-widest">Active API Provider</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/5">
                    {activeProvider}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm font-mono text-white/60">
                    {generating && activeKeyInUse 
                      ? `Using: ${maskKey(activeKeyInUse)}`
                      : currentProviderKeys.length > 1 
                        ? `${currentProviderKeys.length} Keys Active (Auto-Rotating)` 
                        : currentActiveKey ? maskKey(currentActiveKey) : `No ${activeProvider} key found`}
                  </p>
                  <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-xs font-bold hover:underline"
                    style={{ color: activeThemeColor }}
                  >
                    Manage Keys
                  </button>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            {generating && (
              <div className="mt-8 space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span style={{ color: activeThemeColor }}>
                    {files.filter(f => f.status === 'completed').length === files.length 
                      ? 'Generation Complete!' 
                      : `Processing ${files.filter(f => f.status === 'generating').length} files...`}
                  </span>
                  <span style={{ color: activeThemeColor }}>
                    {Math.round((files.filter(f => f.status === 'completed').length / files.length) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(files.filter(f => f.status === 'completed').length / files.length) * 100}%` }}
                    className="h-full"
                    style={{ 
                      backgroundColor: activeThemeColor,
                      boxShadow: `0 0 10px ${activeThemeColor}80`
                    }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 mt-8">
              <button 
                onClick={clearAll}
                className="flex-1 min-w-[140px] bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <Trash2 className="w-5 h-5" /> Clear All
              </button>
              <button 
                onClick={startGeneration}
                className="flex-1 min-w-[140px] font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all border"
                style={{ 
                  backgroundColor: `${activeThemeColor}1a`, 
                  color: activeThemeColor,
                  borderColor: `${activeThemeColor}33`
                }}
              >
                {generating ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />} {generating ? 'Pause' : 'Resume'}
              </button>
              <button 
                onClick={startGeneration}
                disabled={files.length === 0}
                className="flex-1 min-w-[140px] text-text-main font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{ 
                  backgroundColor: activeThemeColor,
                  boxShadow: `0 10px 15px -3px ${activeThemeColor}33`
                }}
              >
                <RefreshCw className={cn("w-5 h-5", generating && "animate-spin")} /> 
                {generating ? 'Stop Generation' : 'Start Generation'}
              </button>
              <button 
                onClick={exportCSV}
                className="flex-1 min-w-[140px] bg-green-500/10 hover:bg-green-500/20 text-green-500 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <Download className="w-5 h-5" /> Export CSV
              </button>
              <button 
                onClick={() => setIsHistoryOpen(true)}
                className="flex-1 min-w-[140px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <History className="w-5 h-5" /> History
              </button>
            </div>
          </section>

          {/* Results Section */}
          <section className="bg-bg-card rounded-2xl border border-border-main shadow-xl overflow-hidden">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Gig Optimization Queue ({files.length})</h2>
            </div>

            <div className="divide-y divide-white/5">
              {files.map((file) => (
                <div key={file.id} className={cn(
                  "p-8 flex gap-8 group hover:bg-white/[0.02] transition-colors relative",
                  file.status === 'generating' && "bg-opacity-[0.02]"
                )}
                style={{ backgroundColor: file.status === 'generating' ? activeThemeColor + '05' : undefined }}
                >
                  <div className="w-48 space-y-4">
                    <div className="relative aspect-video">
                      <img 
                        src={file.thumbnail} 
                        alt={file.fileName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover rounded-xl border border-white/10"
                      />
                      {file.status === 'preparing' && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] rounded-xl flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: activeThemeColor }} />
                          <span className="text-xs font-bold text-text-main uppercase tracking-widest">Preparing...</span>
                        </div>
                      )}
                      {file.status === 'generating' && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] rounded-xl flex items-center justify-center">
                          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: activeThemeColor }} />
                        </div>
                      )}
                      {file.status === 'error' && (
                        <div className="absolute inset-0 bg-red-500/20 backdrop-blur-[1px] rounded-xl flex items-center justify-center">
                          <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => redoGeneration(file.id)}
                      disabled={file.status === 'generating'}
                      className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={cn("w-4 h-4", file.status === 'generating' && "animate-spin")} /> 
                      {file.status === 'error' ? 'Retry' : 'Redo'}
                    </button>
                  </div>

                  <div className="flex-1 space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-lg">{file.fileName}</h3>
                          {file.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                          {file.status === 'pending' && <span className="px-2 py-0.5 bg-white/5 text-white/40 text-[10px] font-bold rounded uppercase tracking-wider">Pending</span>}
                          {file.currentKey && (
                            <span className="px-2 py-0.5 bg-white/5 text-white/30 text-[10px] font-mono rounded border border-white/5">
                              Key: {maskKey(file.currentKey)}
                            </span>
                          )}
                        </div>
                        {file.status === 'completed' && (
                          <button 
                            onClick={() => {
                              const parts = [file.title, file.description, file.keywords.join(', ')];
                              copyToClipboard(parts.join('\n\n'));
                            }}
                            className="p-2 hover:bg-bg-hover rounded-lg transition-colors text-text-dim hover:text-text-main"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {file.status === 'completed' && (
                        <div className="flex items-center gap-4 text-xs font-bold text-text-dim uppercase tracking-widest">
                          <span>Title: {file.title.length} chars</span>
                          <span>Desc: {file.description.length} chars</span>
                          <span>Keywords: {file.keywords.length}</span>
                        </div>
                      )}
                    </div>

                    {file.status === 'completed' ? (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-text-dim uppercase tracking-widest">Title</span>
                          <p className="text-text-main/80 leading-relaxed">{file.title}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-text-dim uppercase tracking-widest">Description</span>
                          <p className="text-text-muted leading-relaxed">{file.description}</p>
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-text-dim uppercase tracking-widest">Keywords</span>
                          <div className="flex flex-wrap gap-2">
                            {file.keywords.map((kw, i) => (
                              <span key={i} className="text-sm text-text-dim hover:text-text-muted cursor-default">
                                {kw}{i < file.keywords.length - 1 ? ',' : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center text-white/20 italic text-sm">
                        {file.status === 'generating' ? 'AI is analyzing your file...' : 
                         file.status === 'error' ? 'Something went wrong. Please try again.' :
                         'Waiting to start...'}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {files.length === 0 && (
                <div className="p-20 flex flex-col items-center justify-center text-white/10">
                  <FileText className="w-16 h-16 mb-4" />
                  <p className="text-xl font-medium">No files in queue</p>
                  <p className="text-sm">Upload files to see them here</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Prompt Modal */}
      <AnimatePresence>
        {isPromptModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPromptModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl bg-bg-card rounded-3xl border border-border-main shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-border-main flex items-center justify-between">
                <h3 className="text-xl font-bold">Custom AI Prompt</h3>
                <button 
                  onClick={() => setIsPromptModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <p className="text-white/40 text-sm">
                  Add specific instructions for the AI to follow when generating metadata. 
                  For example: "Focus on the vintage aesthetic" or "Include specific technical terms for 3D rendering".
                </p>
                <textarea 
                  className="w-full bg-bg-input border border-border-main rounded-2xl p-6 text-lg focus:outline-none transition-colors h-64 resize-none"
                  style={{ borderColor: 'var(--focus-border-color)' } as any}
                  placeholder="Type your custom instructions here..."
                  value={settings.customPrompt}
                  onChange={(e) => setSettings({...settings, customPrompt: e.target.value})}
                  onFocus={(e) => e.currentTarget.style.borderColor = activeThemeColor + '80'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <div className="flex justify-end gap-4">
                  <button 
                    onClick={() => setSettings({...settings, customPrompt: 'Default (Recommended)'})}
                    className="px-6 py-3 rounded-xl font-bold text-white/40 hover:text-white transition-colors"
                  >
                    Reset to Default
                  </button>
                  <button 
                    onClick={() => setIsPromptModalOpen(false)}
                    className="text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-all"
                    style={{ 
                      backgroundColor: activeThemeColor,
                      boxShadow: `0 10px 15px -3px ${activeThemeColor}33`
                    }}
                  >
                    Save Prompt
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-bg-card rounded-3xl border border-border-main shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border-main flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <History className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Generation History</h2>
                    <p className="text-xs text-white/40">View and download previous generations</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsHistoryOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-text-dim/20 mx-auto mb-4" />
                    <p className="text-text-dim">No history found</p>
                    <p className="text-xs text-text-dim/50">Generations will appear here after you export them</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id}
                      className="bg-bg-input border border-border-main rounded-2xl p-4 flex items-center justify-between group hover:border-border-main transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center font-bold text-white/20">
                          {item.filesCount}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">{item.platform} Generation</h3>
                          <p className="text-xs text-white/40">{item.timestamp}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => downloadHistoryItem(item)}
                          className="p-2 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-lg transition-all"
                          title="Download CSV"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteHistoryItem(item.id)}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 bg-white/5 border-t border-white/5 flex justify-end">
                <button 
                  onClick={() => setIsHistoryOpen(false)}
                  className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-bg-card rounded-2xl border border-border-main shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-xl font-bold">Manage AI Settings</h3>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/50 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Provider Tabs */}
                <div className="flex p-1 bg-white/5 rounded-xl overflow-x-auto custom-scrollbar">
                  {(['Google Gemini', 'Mistral AI', 'Groq Cloud', 'OpenAI'] as AIProvider[])
                    .filter(p => isAdmin || !adminSettings || adminSettings.allowedProviders.includes(p))
                    .map((provider) => (
                      <button
                        key={provider}
                        onClick={() => {
                          setActiveProvider(provider);
                          setSelectedModel(PROVIDER_MODELS[provider][0]);
                        }}
                        className={cn(
                          "flex-1 py-2 px-4 text-xs font-medium rounded-lg transition-all whitespace-nowrap",
                          activeProvider === provider 
                            ? "bg-white/10 text-white shadow-lg" 
                            : "text-white/30 hover:text-white/50"
                        )}
                      >
                        {provider}
                      </button>
                    ))}
                </div>

                {/* Model Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-white/60">Select Model ({activeProvider})</label>
                  <select 
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full bg-bg-input border border-border-main rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors appearance-none"
                    onFocus={(e) => e.currentTarget.style.borderColor = activeThemeColor + '80'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                  >
                    {PROVIDER_MODELS[activeProvider].map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>

                {/* Saved Keys */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-white/60">Saved {activeProvider} API Keys</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {savedKeys.filter(k => k.provider === activeProvider).map((k) => (
                      <div key={k.id} className="flex items-center gap-2 bg-bg-input border border-border-main rounded-xl px-4 py-3 group">
                        <span className="flex-1 font-mono text-sm text-white/60 truncate">
                          {k.visible ? k.key : maskKey(k.key)}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {k.status === 'valid' && (
                            <div className="p-1.5 text-green-500" title="Valid Key">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          )}
                          {k.status === 'invalid' && (
                            <div className="p-1.5 text-red-500" title="Invalid Key">
                              <AlertCircle className="w-4 h-4" />
                            </div>
                          )}
                          {k.status === 'testing' && (
                            <div className="p-1.5 text-blue-500 animate-spin" title="Testing Key...">
                              <RefreshCw className="w-4 h-4" />
                            </div>
                          )}
                          <button 
                            onClick={() => toggleKeyVisibility(k.id)}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/30 hover:text-white"
                          >
                            {k.visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => removeKey(k.id)}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-red-500/50 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {savedKeys.filter(k => k.provider === activeProvider).length === 0 && (
                      <div className="text-center py-4 text-white/20 text-sm italic">
                        No {activeProvider} keys saved yet
                      </div>
                    )}
                  </div>
                </div>

                {/* New Key Input */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-white/60">Enter new {activeProvider} API key(s)</label>
                  <p className="text-[10px] text-white/30 italic">Tip: You can paste multiple keys separated by newlines or commas.</p>
                  <div className="flex flex-col gap-2">
                    <textarea 
                      placeholder={`Paste ${activeProvider} API keys here...`}
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      rows={3}
                      className="w-full bg-bg-input border border-border-main rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors custom-scrollbar resize-none"
                      onFocus={(e) => e.currentTarget.style.borderColor = activeThemeColor + '80'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => testKey()}
                        disabled={testStatus === 'testing'}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                          testStatus === 'testing' ? "bg-white/10 text-white/30" :
                          testStatus === 'success' ? "bg-green-500 text-white" :
                          testStatus === 'error' ? "bg-red-500 text-white" :
                          "bg-[#3c4454] hover:bg-[#4c5464] text-white/80"
                        )}
                      >
                        {testStatus === 'testing' ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Testing...
                          </>
                        ) : testStatus === 'success' ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Valid!
                          </>
                        ) : testStatus === 'error' ? (
                          <>
                            <AlertCircle className="w-4 h-4" />
                            Invalid
                          </>
                        ) : 'Test First Key'}
                      </button>
                      <button 
                        onClick={saveKey}
                        className="flex-1 py-2 text-white rounded-xl text-sm font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                        style={{ 
                          backgroundColor: activeThemeColor,
                          boxShadow: `0 10px 15px -3px ${activeThemeColor}33`
                        }}
                      >
                        <Download className="w-4 h-4" />
                        Save All Keys
                      </button>
                    </div>
                  </div>
                  {testError && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400"
                    >
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold mb-1">Test Failed</p>
                          <p className="text-xs opacity-90 font-mono break-all">{testError}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Get Key Button */}
                {activeProvider === 'Google Gemini' && (
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full bg-[#c48c04] hover:bg-[#d49c14] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-yellow-600/20"
                  >
                    <Key className="w-5 h-5" /> Get Google Gemini API Key
                  </a>
                )}
                {activeProvider === 'Mistral AI' && (
                  <a 
                    href="https://console.mistral.ai/api-keys/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full bg-[#f15a24] hover:bg-[#ff6a34] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-600/20"
                  >
                    <Key className="w-5 h-5" /> Get Mistral AI API Key
                  </a>
                )}
                {activeProvider === 'Groq Cloud' && (
                  <a 
                    href="https://console.groq.com/keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full bg-[#f55036] hover:bg-[#ff6046] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/20"
                  >
                    <Key className="w-5 h-5" /> Get Groq Cloud API Key
                  </a>
                )}
                {activeProvider === 'OpenAI' && (
                  <a 
                    href="https://platform.openai.com/api-keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full bg-[#10a37f] hover:bg-[#1ab38f] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/20"
                  >
                    <Key className="w-5 h-5" /> Get OpenAI API Key
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Completion Modal */}
      <AnimatePresence>
        {isCompletionModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCompletionModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-bg-card rounded-[32px] border border-border-main shadow-2xl overflow-hidden p-8 text-center"
            >
              <button 
                onClick={() => setIsCompletionModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full transition-colors text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>

              <h3 className="text-3xl font-black text-white mb-2">Metadata Generated!</h3>
              <p className="text-white/60 mb-8">Successfully generated {files.filter(f => f.status === 'completed').length} items.</p>

              <div className="space-y-6">
                <div className="text-sm font-bold text-white/40 uppercase tracking-[0.2em] mb-4">Connect With Us</div>
                
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <a href="https://youtube.com/@tanbhirislamjihad" target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-2">
                    <div className="w-14 h-14 bg-[#ff0000] rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/20 group-hover:scale-110 transition-transform">
                      <Youtube className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-white uppercase tracking-wider">YouTube</span>
                    <span className="text-[8px] text-white/40 uppercase">Tanbhir Islam Jihad</span>
                  </a>
                  
                  <a href="https://facebook.com/tanbhirislamjihad.bd?mibextid=ZbWKwL" target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-2">
                    <div className="w-14 h-14 bg-[#1877f2] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform">
                      <Facebook className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-white uppercase tracking-wider">Facebook</span>
                    <span className="text-[8px] text-white/40 uppercase">My Account</span>
                  </a>
                  
                  <a href="https://wa.me/+8801738515733" target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-2">
                    <div className="w-14 h-14 bg-[#25d366] rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/20 group-hover:scale-110 transition-transform">
                      <MessageCircle className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-white uppercase tracking-wider">WhatsApp</span>
                    <span className="text-[8px] text-white/40 uppercase">Join Chat</span>
                  </a>
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={() => {
                      exportCSV();
                      setIsCompletionModalOpen(false);
                    }}
                    className="w-full py-4 bg-[#f97316] hover:bg-[#ea580c] text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-orange-600/20"
                  >
                    <Download className="w-5 h-5" /> Download CSV File
                  </button>
                  
                  <button 
                    onClick={() => {
                      downloadEmbeddedZip();
                      setIsCompletionModalOpen(false);
                    }}
                    className="w-full py-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-600/20"
                  >
                    <Download className="w-5 h-5" /> Download Embedded Images
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-black/95 backdrop-blur-sm"
            onClick={() => setPreviewFile(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-full max-h-full flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute -top-12 right-0 flex gap-4">
                <button 
                  onClick={() => setPreviewFile(null)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="bg-bg-card p-2 rounded-2xl border border-border-main shadow-2xl overflow-hidden">
                <img 
                  src={previewFile.thumbnail} 
                  alt={previewFile.fileName}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                />
                <div className="mt-4 p-4 border-t border-white/5 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">{previewFile.fileName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-white/40 uppercase tracking-widest">Format: {previewFile.type}</p>
                      <span className="text-white/20">•</span>
                      <p className="text-xs text-white/40 uppercase tracking-widest">
                        {previewFile.originalFile ? (previewFile.originalFile.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}
                      </p>
                    </div>
                  </div>
                  {previewFile.originalFile && (
                    <button 
                      onClick={() => {
                        const url = URL.createObjectURL(previewFile.originalFile!);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = previewFile.fileName;
                        link.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-all flex items-center gap-2"
                      title="Download Original File"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Download Original</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer / Status Bar */}
      <footer className="h-12 border-t border-border-main bg-bg-card flex items-center justify-between px-8 text-[11px] font-medium text-text-muted tracking-wide">
        <div className="flex-1" />
        <div className="flex-1 text-center">
          {adminSettings?.footerText || '© 2026 Tanbhir Islam Jihad. All rights reserved.'}
        </div>
        <div className="flex-1 flex justify-end gap-6 uppercase tracking-widest font-bold text-[10px]">
          <a 
            href={adminSettings?.facebookUrl || "https://facebook.com/tanbhirislamjihad.bd?mibextid=ZbWKwL"} 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Facebook
          </a>
          <a 
            href={adminSettings?.youtubeUrl || "https://youtube.com/@tanbhirislamjihad"} 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            YouTube
          </a>
        </div>
      </footer>
    </div>
  } />
  <Route path="/" element={<Navigate to="/user.html" replace />} />
</Routes>
  );
}
