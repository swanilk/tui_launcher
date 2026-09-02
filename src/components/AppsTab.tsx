/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Theme, AndroidApp } from '../types';
import { 
  Search, 
  Grid, 
  List, 
  Star, 
  Play, 
  Trash2, 
  Clock, 
  Terminal, 
  Camera,
  Calculator,
  Globe,
  Phone,
  MessageSquare,
  Folder,
  Settings,
  CloudSun,
  Music,
  FileText,
  Image,
  Users,
  Package,
  Layers,
  Sparkles
} from 'lucide-react';
import { soundManager } from '../utils/audio';

interface AppsTabProps {
  theme: Theme;
  apps: AndroidApp[];
  onOpenApp: (app: AndroidApp) => void;
  onRunCommand: (command: string) => void;
  onToggleFavorite?: (appId: string) => void;
  onUninstallApp?: (app: AndroidApp) => void;
  soundEnabled: boolean;
}

export const AppsTab: React.FC<AppsTabProps> = ({
  theme,
  apps,
  onOpenApp,
  onRunCommand,
  onToggleFavorite,
  onUninstallApp,
  soundEnabled,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'favorites', label: '★ Starred' },
    { id: 'system', label: 'System' },
    { id: 'tools', label: 'Tools' },
    { id: 'social', label: 'Social' },
    { id: 'media', label: 'Media' },
    { id: 'dev', label: 'Dev' },
    { id: 'games', label: 'Games' },
  ];

  // Helper to render distinct small icon
  const renderAppIcon = (app: AndroidApp, size: number = 16) => {
    const key = (app.icon || app.name || '').toLowerCase();
    if (key.includes('camera')) return <Camera size={size} />;
    if (key.includes('calc')) return <Calculator size={size} />;
    if (key.includes('browser') || key.includes('chrome') || key.includes('globe')) return <Globe size={size} />;
    if (key.includes('phone') || key.includes('call') || key.includes('dial')) return <Phone size={size} />;
    if (key.includes('message') || key.includes('sms') || key.includes('chat') || key.includes('mms')) return <MessageSquare size={size} />;
    if (key.includes('file') || key.includes('folder') || key.includes('document')) return <Folder size={size} />;
    if (key.includes('setting') || key.includes('config')) return <Settings size={size} />;
    if (key.includes('clock') || key.includes('timer')) return <Clock size={size} />;
    if (key.includes('weather') || key.includes('cloud') || key.includes('sun')) return <CloudSun size={size} />;
    if (key.includes('music') || key.includes('audio')) return <Music size={size} />;
    if (key.includes('note') || key.includes('text') || key.includes('doc')) return <FileText size={size} />;
    if (key.includes('term') || key.includes('shell') || key.includes('bash') || key.includes('linux')) return <Terminal size={size} />;
    if (key.includes('gallery') || key.includes('image') || key.includes('photo')) return <Image size={size} />;
    if (key.includes('contact') || key.includes('user') || key.includes('people')) return <Users size={size} />;
    return <Package size={size} />;
  };

  // Recently used apps
  const recentApps = useMemo(() => {
    return [...apps]
      .filter((a) => (a.lastUsed && a.lastUsed > 0) || a.favorite)
      .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
      .slice(0, 4);
  }, [apps]);

  // Filtered apps
  const filteredApps = useMemo(() => {
    let list = apps;

    if (selectedCategory === 'favorites') {
      list = list.filter((a) => a.favorite);
    } else if (selectedCategory !== 'all') {
      list = list.filter((a) => a.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.packageName.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      );
    }

    return list;
  }, [apps, selectedCategory, searchQuery]);

  const handleLaunch = (app: AndroidApp) => {
    if (soundEnabled) soundManager.playKeyClick('modern', 0.25);
    if (app.launchAction === 'command' && app.commandToRun) {
      onRunCommand(app.commandToRun);
    } else {
      onOpenApp(app);
    }
  };

  const handleUninstall = (e: React.MouseEvent, app: AndroidApp) => {
    e.stopPropagation();
    if (soundEnabled) soundManager.playKeyClick('mechanical', 0.2);
    if (onUninstallApp) {
      onUninstallApp(app);
    } else {
      onRunCommand(`uninstall "${app.name}"`);
    }
  };

  return (
    <div 
      id="apps-tab-container"
      className="flex-1 flex flex-col h-full min-h-0 overflow-hidden font-mono select-none"
      style={{ color: theme.fg }}
    >
      {/* Top Search & Filter Header */}
      <div 
        className="flex items-center gap-2 px-3 py-2 border-b shrink-0"
        style={{ borderColor: theme.borderColor, backgroundColor: `${theme.cardBg}80` }}
      >
        {/* Search Input */}
        <div 
          className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.bg }}
        >
          <Search size={13} className="opacity-60 shrink-0" style={{ color: theme.accentColor }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search apps..."
            className="w-full bg-transparent border-none outline-none text-xs font-mono"
            style={{ color: theme.fg }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs opacity-60 hover:opacity-100 px-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* View Mode Switcher & App Count */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] opacity-70 hidden sm:inline">
            {filteredApps.length} apps
          </span>

          <div 
            className="flex items-center border rounded p-0.5"
            style={{ borderColor: theme.borderColor, backgroundColor: theme.bg }}
          >
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) soundManager.playKeyClick('mechanical', 0.1);
                setViewMode('grid');
              }}
              className="p-1 rounded text-xs transition-all"
              style={{
                backgroundColor: viewMode === 'grid' ? `${theme.accentColor}30` : 'transparent',
                color: viewMode === 'grid' ? theme.accentColor : theme.fg,
              }}
              title="4-Column Grid View"
            >
              <Grid size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) soundManager.playKeyClick('mechanical', 0.1);
                setViewMode('list');
              }}
              className="p-1 rounded text-xs transition-all"
              style={{
                backgroundColor: viewMode === 'list' ? `${theme.accentColor}30` : 'transparent',
                color: viewMode === 'list' ? theme.accentColor : theme.fg,
              }}
              title="List View"
            >
              <List size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div 
        className="flex items-center gap-1 px-2.5 py-1.5 border-b overflow-x-auto no-scrollbar shrink-0 text-xs"
        style={{ borderColor: `${theme.borderColor}50`, backgroundColor: `${theme.bg}` }}
      >
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                if (soundEnabled) soundManager.playKeyClick('mechanical', 0.1);
                setSelectedCategory(cat.id);
              }}
              className="px-2.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold whitespace-nowrap transition-all border shrink-0"
              style={{
                borderColor: isActive ? theme.accentColor : `${theme.borderColor}60`,
                backgroundColor: isActive ? `${theme.accentColor}25` : 'transparent',
                color: isActive ? theme.accentColor : theme.fg,
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Main Apps Content Area */}
      <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
        {/* Recently Used Apps (4 icons in one line) */}
        {!searchQuery && selectedCategory === 'all' && recentApps.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold tracking-wider opacity-70 px-0.5" style={{ color: theme.promptColor }}>
              <span className="flex items-center gap-1">
                <Clock size={11} />
                <span>Recent</span>
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
              {recentApps.map((app) => (
                <button
                  key={`rec-${app.id}`}
                  type="button"
                  onClick={() => handleLaunch(app)}
                  className="p-2 rounded border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all hover:scale-[1.03] active:scale-95 text-center group"
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: `${theme.accentColor}40`,
                  }}
                  title={app.name}
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${theme.accentColor}20`, color: theme.accentColor }}
                  >
                    {renderAppIcon(app, 15)}
                  </div>
                  <span className="text-[11px] font-bold truncate w-full px-0.5" style={{ color: theme.fg }}>
                    {app.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All Installed Applications */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold tracking-wider opacity-70 px-0.5" style={{ color: theme.fg }}>
            <span className="flex items-center gap-1">
              <Layers size={11} style={{ color: theme.accentColor }} />
              <span>Applications ({filteredApps.length})</span>
            </span>
          </div>

          {filteredApps.length === 0 ? (
            <div 
              className="p-6 rounded border text-center font-mono space-y-2"
              style={{ borderColor: theme.borderColor, backgroundColor: `${theme.cardBg}40` }}
            >
              <Package size={24} className="mx-auto opacity-40" />
              <div className="text-xs font-bold opacity-80">No matching applications</div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="px-2.5 py-0.5 text-xs rounded border inline-block"
                style={{ borderColor: theme.accentColor, color: theme.accentColor }}
              >
                Reset Filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* 4 Icons per line Grid Layout with Small Icons, No com.*, No description */
            <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
              {filteredApps.map((app) => (
                <div
                  key={app.id}
                  id={`app-card-${app.id}`}
                  onClick={() => handleLaunch(app)}
                  className="p-2 sm:p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group relative shadow-xs"
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: app.favorite ? `${theme.accentColor}60` : theme.borderColor,
                  }}
                  title={app.name}
                >
                  {/* Star Favorite icon (small top right) */}
                  {onToggleFavorite && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (soundEnabled) soundManager.playKeyClick('mechanical', 0.15);
                        onToggleFavorite(app.id);
                      }}
                      className="absolute top-1 right-1 p-0.5 rounded opacity-50 hover:opacity-100 transition-opacity"
                      style={{ color: app.favorite ? '#eab308' : theme.fg }}
                      title={app.favorite ? 'Unstar' : 'Star'}
                    >
                      <Star size={10} fill={app.favorite ? '#eab308' : 'none'} />
                    </button>
                  )}

                  {/* Small App Icon */}
                  <div 
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: `${theme.accentColor}18`,
                      borderColor: `${theme.accentColor}35`,
                      color: theme.accentColor,
                    }}
                  >
                    {renderAppIcon(app, 16)}
                  </div>

                  {/* App Name Only */}
                  <span className="text-[11px] sm:text-xs font-semibold text-center truncate w-full px-0.5 leading-tight group-hover:text-amber-300 transition-colors" style={{ color: theme.fg }}>
                    {app.name}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            /* Detailed List Layout with com.* package name and description */
            <div className="space-y-1.5">
              {filteredApps.map((app) => (
                <div
                  key={app.id}
                  id={`app-list-${app.id}`}
                  onClick={() => handleLaunch(app)}
                  className="p-2.5 rounded border flex items-center justify-between gap-3 cursor-pointer transition-all hover:scale-[1.005] group"
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: app.favorite ? `${theme.accentColor}60` : theme.borderColor,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div 
                      className="w-8 h-8 rounded flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: `${theme.accentColor}20`,
                        borderColor: `${theme.accentColor}40`,
                        color: theme.accentColor,
                      }}
                    >
                      {renderAppIcon(app, 15)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs truncate" style={{ color: theme.fg }}>
                          {app.name}
                        </span>
                        <span 
                          className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase"
                          style={{ backgroundColor: `${theme.accentColor}15`, color: theme.accentColor }}
                        >
                          {app.category}
                        </span>
                        {app.favorite && (
                          <Star size={10} className="text-yellow-400 fill-yellow-400 shrink-0" />
                        )}
                      </div>
                      <div className="text-[10px] opacity-60 truncate font-mono mt-0.5" style={{ color: theme.fg }}>
                        <span className="text-emerald-400/90 font-semibold">{app.packageName}</span>
                        {app.description && (
                          <span className="opacity-75"> — {app.description}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleUninstall(e, app)}
                      className="p-1 rounded text-[10px] opacity-50 hover:opacity-100 hover:text-red-400 transition-all"
                      title={`Uninstall ${app.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLaunch(app);
                      }}
                      className="px-2.5 py-1 rounded text-[11px] font-bold border flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
                      style={{
                        backgroundColor: `${theme.accentColor}25`,
                        borderColor: theme.accentColor,
                        color: theme.accentColor,
                      }}
                    >
                      <Play size={10} />
                      <span>Open</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

