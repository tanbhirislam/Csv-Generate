import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  BarChart3, 
  X, 
  FileText, 
  Settings,
  ChevronLeft,
  LogOut,
  Palette,
  Type,
  Image as ImageIcon,
  Globe
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { db, auth, logout, UserProfile, AppSetting, UsageLog } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface AdminPageProps {
  isAdmin: boolean;
  user: any;
}

export default function AdminPage({ isAdmin, user }: AdminPageProps) {
  const navigate = useNavigate();
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [adminLogs, setAdminLogs] = useState<UsageLog[]>([]);
  const [adminSettings, setAdminSettings] = useState<AppSetting | null>(null);
  const [brandingSettings, setBrandingSettings] = useState<Partial<AppSetting>>({});
  const [systemSettings, setSystemSettings] = useState<Partial<AppSetting>>({});
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [isSavingSystem, setIsSavingSystem] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin || user?.email !== 'businessonline.6251@gmail.com' || !user?.emailVerified) {
      window.location.href = '/user.html';
    }
  }, [isAdmin, user]);

  const fetchAdminData = async () => {
    if (!isAdmin) return;
    
    try {
      setIsLoading(true);
      // Fetch users
      const usersSnap = await getDocs(collection(db, 'users'));
      setAdminUsers(usersSnap.docs.map(d => d.data() as UserProfile));
      
      // Fetch logs
      const logsSnap = await getDocs(collection(db, 'usage_logs'));
      const logs = logsSnap.docs.map(d => d.data() as UsageLog);
      setAdminLogs(logs.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)));
      
      // Fetch settings
      const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
      let settings: AppSetting;
      
      if (settingsSnap.exists()) {
        settings = settingsSnap.data() as AppSetting;
      } else {
        // Default settings if not exists
        settings = {
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
      }

      setAdminSettings(settings);
      setBrandingSettings({
        siteName: settings.siteName,
        siteDescription: settings.siteDescription,
        logoUrl: settings.logoUrl,
        faviconUrl: settings.faviconUrl,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        accentColor: settings.accentColor,
        heroTitle: settings.heroTitle,
        heroSubtitle: settings.heroSubtitle,
        heroTitleColor: settings.heroTitleColor || '#ffffff',
        heroSubtitleColor: settings.heroSubtitleColor || 'rgba(255, 255, 255, 0.4)',
        footerText: settings.footerText,
        settingsTitle: settings.settingsTitle,
        tutorialText: settings.tutorialText,
        tutorialUrl: settings.tutorialUrl,
        facebookUrl: settings.facebookUrl,
        youtubeUrl: settings.youtubeUrl,
      });
      setSystemSettings({
        maintenanceMode: settings.maintenanceMode,
        defaultRPM: settings.defaultRPM,
        allowedProviders: settings.allowedProviders,
      });
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    } else {
      window.location.href = '/user.html';
    }
  }, [isAdmin]);

  const updateAdminSettings = async (newSettings: Partial<AppSetting>) => {
    if (!isAdmin) return;
    try {
      const currentSettings = adminSettings || {
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
        settingsTitle: 'GIG SEO SETTINGS',
        tutorialText: 'Tutorial',
        tutorialUrl: 'https://youtube.com/@tanbhirislamjihad',
        facebookUrl: 'https://facebook.com/tanbhirislamjihad.bd?mibextid=ZbWKwL',
        youtubeUrl: 'https://youtube.com/@tanbhirislamjihad'
      };
      const updated = { ...currentSettings, ...newSettings };
      await setDoc(doc(db, 'settings', 'global'), updated);
      setAdminSettings(updated);
      return true;
    } catch (error) {
      console.error('Error updating admin settings:', error);
      alert('Failed to save settings. Please check your connection.');
      return false;
    }
  };

  const handleSaveBranding = async () => {
    if (!isAdmin) return;
    try {
      setIsSavingBranding(true);
      const success = await updateAdminSettings(brandingSettings);
      if (success) {
        alert('Branding settings saved successfully!');
      }
    } catch (error) {
      console.error('Error saving branding:', error);
    } finally {
      setIsSavingBranding(false);
    }
  };

  const handleSaveSystem = async () => {
    if (!isAdmin) return;
    try {
      setIsSavingSystem(true);
      const success = await updateAdminSettings(systemSettings);
      if (success) {
        alert('System settings saved successfully!');
      }
    } catch (error) {
      console.error('Error saving system settings:', error);
    } finally {
      setIsSavingSystem(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-bg-main text-text-main font-sans p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between bg-bg-card border border-border-main p-6 rounded-3xl shadow-xl">
          <div className="flex items-center gap-4">
            <a 
              href="/user.html"
              className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </a>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <Shield className="w-8 h-8 text-purple-400" />
                Admin Control Center
              </h1>
              <p className="text-text-dim">Manage users, settings, and monitor system usage</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm font-bold">{user?.displayName}</p>
              <p className="text-xs text-text-dim uppercase tracking-wider">Super Admin</p>
            </div>
            <img src={user?.photoURL} alt="" className="w-12 h-12 rounded-2xl border border-border-main" />
            <button 
              onClick={async () => {
                await logout();
                window.location.href = '/login.html';
              }}
              className="w-12 h-12 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-all"
              title="Logout"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-bg-card border border-border-main rounded-3xl p-8 shadow-lg"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-sm font-bold uppercase tracking-widest text-text-dim">Total Users</span>
            </div>
            <p className="text-5xl font-bold">{adminUsers.length}</p>
          </motion.div>

          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-bg-card border border-border-main rounded-3xl p-8 shadow-lg"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-green-400" />
              </div>
              <span className="text-sm font-bold uppercase tracking-widest text-text-dim">Total Generations</span>
            </div>
            <p className="text-5xl font-bold">{adminLogs.reduce((acc, log) => acc + (log.fileCount || 0), 0)}</p>
          </motion.div>

          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-bg-card border border-border-main rounded-3xl p-8 shadow-lg"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
              <span className="text-sm font-bold uppercase tracking-widest text-text-dim">Active Admins</span>
            </div>
            <p className="text-5xl font-bold">{adminUsers.filter(u => u.role === 'admin').length}</p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* User Management */}
          <section className="bg-bg-card border border-border-main rounded-3xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-border-main flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-400" />
                User Management
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-border-main">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-dim">User</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-dim">Role</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-dim text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-main">
                  {adminUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={u.photoURL} alt="" className="w-10 h-10 rounded-xl" />
                          <div>
                            <p className="text-sm font-bold text-text-main">{u.displayName}</p>
                            <p className="text-xs text-text-dim">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                          u.role === 'admin' ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                        )}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {u.email !== 'businessonline.6251@gmail.com' && (
                          <button 
                            onClick={async () => {
                              const newRole = u.role === 'admin' ? 'user' : 'admin';
                              await updateDoc(doc(db, 'users', u.uid), { role: newRole });
                              fetchAdminData();
                            }}
                            className="text-xs font-bold text-blue-400 hover:underline"
                          >
                            Make {u.role === 'admin' ? 'User' : 'Admin'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="space-y-8">
            {/* System Settings */}
            <section className="bg-bg-card border border-border-main rounded-3xl p-8 shadow-xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Settings className="w-6 h-6 text-orange-400" />
                  System Settings
                </h3>
                <button
                  onClick={handleSaveSystem}
                  disabled={isSavingSystem}
                  className={cn(
                    "px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center gap-2",
                    isSavingSystem ? "bg-white/10 text-text-dim cursor-not-allowed" : "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20"
                  )}
                >
                  {isSavingSystem ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
              <div className="space-y-8">
                <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-border-main">
                  <div>
                    <p className="text-lg font-bold text-text-main">Maintenance Mode</p>
                    <p className="text-sm text-text-dim">Restrict access to non-admin users</p>
                  </div>
                  <button
                    onClick={() => setSystemSettings(prev => ({ ...prev, maintenanceMode: !prev.maintenanceMode }))}
                    className={cn(
                      "w-14 h-7 rounded-full transition-all relative",
                      systemSettings.maintenanceMode ? "bg-red-500" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-5 h-5 rounded-full bg-white transition-all",
                      systemSettings.maintenanceMode ? "left-8" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="p-6 bg-white/5 rounded-2xl border border-border-main">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-lg font-bold text-text-main">Default RPM Limit</p>
                    <span className="text-xs font-mono text-text-dim bg-white/5 px-2 py-1 rounded">{systemSettings.defaultRPM} RPM</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <input 
                      type="range" 
                      min="1" 
                      max="120" 
                      value={systemSettings.defaultRPM || 60}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, defaultRPM: parseInt(e.target.value) }))}
                      className="flex-1 accent-blue-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="p-6 bg-white/5 rounded-2xl border border-border-main">
                  <p className="text-lg font-bold text-text-main mb-4">Allowed Providers</p>
                  <div className="grid grid-cols-2 gap-3">
                    {['Google Gemini', 'Mistral AI', 'Groq Cloud', 'OpenAI'].map((provider) => (
                      <button
                        key={provider}
                        onClick={() => {
                          const current = systemSettings.allowedProviders || [];
                          const updated = current.includes(provider)
                            ? current.filter(p => p !== provider)
                            : [...current, provider];
                          setSystemSettings(prev => ({ ...prev, allowedProviders: updated }));
                        }}
                        className={cn(
                          "px-4 py-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between",
                          systemSettings.allowedProviders?.includes(provider)
                            ? "bg-blue-500/10 border-blue-500/50 text-blue-400"
                            : "bg-white/5 border-border-main text-text-dim hover:border-white/20"
                        )}
                      >
                        {provider}
                        {systemSettings.allowedProviders?.includes(provider) && (
                          <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-text-dim mt-4 italic">
                    * Non-admin users will only see the selected providers.
                  </p>
                </div>
              </div>
            </section>

            {/* Site Branding & Content */}
            <section className="bg-bg-card border border-border-main rounded-3xl p-8 shadow-xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Palette className="w-6 h-6 text-pink-400" />
                  Branding & Content
                </h3>
                <button
                  onClick={handleSaveBranding}
                  disabled={isSavingBranding}
                  className={cn(
                    "px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center gap-2",
                    isSavingBranding ? "bg-white/10 text-text-dim cursor-not-allowed" : "bg-pink-500 hover:bg-pink-600 text-white shadow-pink-500/20"
                  )}
                >
                  {isSavingBranding ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
              <div className="space-y-6">
                {/* Site Identity */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Site Name</label>
                    <input 
                      type="text" 
                      value={brandingSettings.siteName || ''}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, siteName: e.target.value }))}
                      className="w-full bg-bg-main border border-border-main p-3 rounded-xl text-text-main focus:border-pink-500 outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Site Description</label>
                    <input 
                      type="text" 
                      value={brandingSettings.siteDescription || ''}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, siteDescription: e.target.value }))}
                      className="w-full bg-bg-main border border-border-main p-3 rounded-xl text-text-main focus:border-pink-500 outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Assets */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Logo URL</label>
                    <input 
                      type="text" 
                      placeholder="https://..."
                      value={brandingSettings.logoUrl || ''}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, logoUrl: e.target.value }))}
                      className="w-full bg-bg-main border border-border-main p-3 rounded-xl text-text-main focus:border-pink-500 outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Favicon URL</label>
                    <input 
                      type="text" 
                      placeholder="https://..."
                      value={brandingSettings.faviconUrl || ''}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, faviconUrl: e.target.value }))}
                      className="w-full bg-bg-main border border-border-main p-3 rounded-xl text-text-main focus:border-pink-500 outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Primary Color</label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={brandingSettings.primaryColor || '#3b82f6'}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-10 h-10 rounded-lg cursor-pointer border border-border-main"
                      />
                      <input 
                        type="text" 
                        value={brandingSettings.primaryColor || '#3b82f6'}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="flex-1 bg-bg-main border border-border-main p-2 rounded-xl text-[10px] text-text-main uppercase"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Secondary Color</label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={brandingSettings.secondaryColor || '#1e293b'}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        className="w-10 h-10 rounded-lg cursor-pointer border border-border-main"
                      />
                      <input 
                        type="text" 
                        value={brandingSettings.secondaryColor || '#1e293b'}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        className="flex-1 bg-bg-main border border-border-main p-2 rounded-xl text-[10px] text-text-main uppercase"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Accent Color</label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={brandingSettings.accentColor || '#8b5cf6'}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                        className="w-10 h-10 rounded-lg cursor-pointer border border-border-main"
                      />
                      <input 
                        type="text" 
                        value={brandingSettings.accentColor || '#8b5cf6'}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                        className="flex-1 bg-bg-main border border-border-main p-2 rounded-xl text-[10px] text-text-main uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-4 pt-4 border-t border-border-main">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Hero Title</label>
                    <div className="flex gap-4">
                      <input 
                        type="text" 
                        value={brandingSettings.heroTitle || ''}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, heroTitle: e.target.value }))}
                        className="flex-1 bg-bg-main border border-border-main p-3 rounded-xl text-text-main focus:border-pink-500 outline-none text-sm"
                      />
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] uppercase text-text-dim">Color</label>
                        <input 
                          type="color" 
                          value={brandingSettings.heroTitleColor || '#ffffff'}
                          onChange={(e) => setBrandingSettings(prev => ({ ...prev, heroTitleColor: e.target.value }))}
                          className="w-10 h-10 rounded-lg cursor-pointer border border-border-main"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Hero Subtitle</label>
                    <div className="flex gap-4">
                      <textarea 
                        value={brandingSettings.heroSubtitle || ''}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, heroSubtitle: e.target.value }))}
                        className="flex-1 bg-bg-main border border-border-main p-3 rounded-xl text-text-main focus:border-pink-500 outline-none h-20 resize-none text-sm"
                      />
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] uppercase text-text-dim">Color</label>
                        <input 
                          type="color" 
                          value={brandingSettings.heroSubtitleColor || 'rgba(255, 255, 255, 0.4)'}
                          onChange={(e) => setBrandingSettings(prev => ({ ...prev, heroSubtitleColor: e.target.value }))}
                          className="w-10 h-10 rounded-lg cursor-pointer border border-border-main"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Footer Text</label>
                    <input 
                      type="text" 
                      value={brandingSettings.footerText || ''}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, footerText: e.target.value }))}
                      className="w-full bg-bg-main border border-border-main p-3 rounded-xl text-text-main focus:border-pink-500 outline-none text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Settings Title</label>
                      <input 
                        type="text" 
                        value={brandingSettings.settingsTitle || ''}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, settingsTitle: e.target.value }))}
                        className="w-full bg-bg-main border border-border-main p-3 rounded-xl text-text-main focus:border-pink-500 outline-none text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Tutorial Text</label>
                      <input 
                        type="text" 
                        value={brandingSettings.tutorialText || ''}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, tutorialText: e.target.value }))}
                        className="w-full bg-bg-main border border-border-main p-3 rounded-xl text-text-main focus:border-pink-500 outline-none text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Tutorial URL</label>
                    <input 
                      type="text" 
                      value={brandingSettings.tutorialUrl || ''}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, tutorialUrl: e.target.value }))}
                      className="w-full bg-bg-main border border-border-main p-3 rounded-xl text-text-main focus:border-pink-500 outline-none text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Facebook URL</label>
                      <input 
                        type="text" 
                        value={brandingSettings.facebookUrl || ''}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, facebookUrl: e.target.value }))}
                        className="w-full bg-bg-main border border-border-main p-3 rounded-xl text-text-main focus:border-pink-500 outline-none text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim">YouTube URL</label>
                      <input 
                        type="text" 
                        value={brandingSettings.youtubeUrl || ''}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                        className="w-full bg-bg-main border border-border-main p-3 rounded-xl text-text-main focus:border-pink-500 outline-none text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Recent Activity */}
            <section className="bg-bg-card border border-border-main rounded-3xl p-8 shadow-xl">
              <h3 className="text-xl font-bold flex items-center gap-2 mb-8">
                <BarChart3 className="w-6 h-6 text-green-400" />
                Recent Activity
              </h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {adminLogs.slice(0, 20).map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-border-main">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-text-dim" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-main">
                          {adminUsers.find(u => u.uid === log.userId)?.displayName || 'Unknown User'}
                        </p>
                        <p className="text-xs text-text-dim">Processed {log.fileCount} files for {log.platform}</p>
                      </div>
                    </div>
                    <span className="text-xs text-text-dim font-mono">
                      {log.timestamp?.toDate().toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
