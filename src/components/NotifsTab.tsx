/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Theme, AppNotification, AndroidApp } from '../types';
import { 
  Bell, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  MessageSquare, 
  Phone,
  PhoneCall,
  PhoneMissed,
  Sparkles, 
  PlusCircle, 
  ShieldCheck, 
  Filter,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { isNativeAndroidApp } from '../utils/nativeLauncher';

interface NotifsTabProps {
  theme: Theme;
  notifications: AppNotification[];
  onDismissNotification: (id: string) => void;
  onClearAllNotifications: () => void;
  onAddNotification?: (notif: AppNotification) => void;
  onRunCommand: (cmd: string) => void;
  onOpenApp?: (app: AndroidApp) => void;
  apps?: AndroidApp[];
  soundEnabled: boolean;
  onSyncNotifications?: () => Promise<void> | void;
  isSyncing?: boolean;
  isAccessGranted?: boolean;
  onOpenAccessSettings?: () => void;
}

export const NotifsTab: React.FC<NotifsTabProps> = ({
  theme,
  notifications,
  onDismissNotification,
  onClearAllNotifications,
  onAddNotification,
  onRunCommand,
  onOpenApp,
  apps = [],
  soundEnabled,
  onSyncNotifications,
  isSyncing = false,
  isAccessGranted = true,
  onOpenAccessSettings,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'whatsapp' | 'sms' | 'call' | 'general'>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<string>('all');

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getPriorityStyle = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return { bg: '#ef444420', border: '#ef4444', text: '#ef4444', label: 'URGENT' };
      case 'high':
        return { bg: '#f59e0b20', border: '#f59e0b', text: '#f59e0b', label: 'HIGH' };
      case 'low':
        return { bg: '#6b728020', border: '#6b7280', text: '#9ca3af', label: 'LOW' };
      default:
        return { bg: `${theme.accentColor}20`, border: theme.accentColor, text: theme.accentColor, label: 'NORMAL' };
    }
  };

  // Helper to categorize notification
  const resolveCategory = (n: AppNotification): 'whatsapp' | 'sms' | 'call' | 'general' => {
    if (n.category) return n.category;
    const pkg = (n.packageName || '').toLowerCase();
    const title = (n.title || '').toLowerCase();
    const msg = (n.message || '').toLowerCase();

    if (pkg.includes('whatsapp')) return 'whatsapp';
    if (pkg.includes('mms') || pkg.includes('messaging') || pkg.includes('sms')) return 'sms';
    if (pkg.includes('dialer') || pkg.includes('phone') || pkg.includes('telecom') || title.includes('missed call') || msg.includes('missed call')) {
      return 'call';
    }
    return 'general';
  };

  const getCategoryMeta = (notif: AppNotification) => {
    const cat = resolveCategory(notif);
    if (cat === 'whatsapp') {
      return {
        key: 'whatsapp',
        label: 'WhatsApp',
        badgeColor: '#25D366',
        badgeBg: '#25D36618',
        borderColor: '#25D36670',
        Icon: MessageSquare,
        actionLabel: 'Open WhatsApp',
        actionCommand: 'open WhatsApp',
      };
    }
    if (cat === 'sms') {
      return {
        key: 'sms',
        label: 'SMS Message',
        badgeColor: '#38bdf8',
        badgeBg: '#38bdf818',
        borderColor: '#38bdf870',
        Icon: MessageSquare,
        actionLabel: 'Open Messages',
        actionCommand: 'open Messages',
      };
    }
    if (cat === 'call') {
      const isMissed = (notif.title || '').toLowerCase().includes('missed') || (notif.message || '').toLowerCase().includes('missed');
      return {
        key: 'call',
        label: isMissed ? 'Missed Call' : 'Phone Call',
        badgeColor: isMissed ? '#ef4444' : '#10b981',
        badgeBg: isMissed ? '#ef444418' : '#10b98118',
        borderColor: isMissed ? '#ef444470' : '#10b98170',
        Icon: isMissed ? PhoneMissed : PhoneCall,
        actionLabel: 'Call Back',
        actionCommand: `call "${notif.title || notif.sender || ''}"`,
      };
    }
    return {
      key: 'general',
      label: notif.appName || 'Alert',
      badgeColor: theme.promptColor,
      badgeBg: `${theme.promptColor}18`,
      borderColor: `${theme.borderColor}70`,
      Icon: Bell,
      actionLabel: 'Open App',
      actionCommand: `open "${notif.appName}"`,
    };
  };

  // Badge counts for category tabs
  const categoryCounts = useMemo(() => {
    let whatsapp = 0;
    let sms = 0;
    let call = 0;
    let general = 0;

    for (const n of notifications) {
      const cat = resolveCategory(n);
      if (cat === 'whatsapp') whatsapp++;
      else if (cat === 'sms') sms++;
      else if (cat === 'call') call++;
      else general++;
    }

    return { all: notifications.length, whatsapp, sms, call, general };
  }, [notifications]);

  const uniqueApps = useMemo(() => {
    const set = new Set(notifications.map((n) => n.appName));
    return Array.from(set);
  }, [notifications]);

  const filteredNotifs = useMemo(() => {
    return notifications.filter((n) => {
      const cat = resolveCategory(n);
      if (selectedCategory !== 'all' && cat !== selectedCategory) return false;
      if (filterPriority !== 'all' && n.priority !== filterPriority) return false;
      if (selectedApp !== 'all' && n.appName !== selectedApp) return false;
      return true;
    });
  }, [notifications, selectedCategory, filterPriority, selectedApp]);

  const handleSimulateNewNotification = () => {
    if (soundEnabled) soundManager.playKeyClick('modern', 0.4);
    const sampleNotifs: Partial<AppNotification>[] = [
      {
        appName: 'WhatsApp',
        packageName: 'com.whatsapp',
        title: 'Sarah Jenkins',
        message: 'Hey! Are we still reviewing the deployment code tonight at 8 PM?',
        category: 'whatsapp',
        priority: 'high',
        actionCommand: 'open WhatsApp',
        actionLabel: 'Open WhatsApp',
      },
      {
        appName: 'WhatsApp',
        packageName: 'com.whatsapp',
        title: 'Dev Core Team (WhatsApp)',
        message: 'Marcus: Linux kernel telemetry updates pushed to staging repository.',
        category: 'whatsapp',
        priority: 'normal',
        actionCommand: 'open WhatsApp',
        actionLabel: 'Open WhatsApp',
      },
      {
        appName: 'Battery Monitor',
        packageName: 'com.android.system.battery',
        title: 'Fast Charging Active',
        message: 'USB-PD fast charging at 45W. Battery temperature 31°C.',
        category: 'general',
        priority: 'low',
        actionCommand: 'battery',
        actionLabel: 'View Battery',
      },
      {
        appName: 'System',
        packageName: 'com.android.systemui',
        title: 'System Update Ready',
        message: 'Android security patch and system performance enhancements ready to install.',
        category: 'general',
        priority: 'normal',
        actionCommand: 'settings',
        actionLabel: 'Settings',
      },
    ];

    const pick = sampleNotifs[Math.floor(Math.random() * sampleNotifs.length)];
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      appId: pick.packageName || 'app',
      appName: pick.appName || 'App',
      packageName: pick.packageName || 'com.example.app',
      title: pick.title || 'Notification',
      message: pick.message || '',
      timestamp: Date.now(),
      priority: pick.priority || 'normal',
      category: pick.category || 'general',
      actionCommand: pick.actionCommand,
      actionLabel: pick.actionLabel,
      read: false,
    };

    if (onAddNotification) {
      onAddNotification(newNotif);
    }
  };

  const handleDismiss = (id: string) => {
    if (soundEnabled) soundManager.playKeyClick('mechanical', 0.2);
    onDismissNotification(id);
  };

  const handleAction = (notif: AppNotification) => {
    if (soundEnabled) soundManager.playKeyClick('modern', 0.3);
    const meta = getCategoryMeta(notif);
    const cmd = notif.actionCommand || meta.actionCommand;

    if (cmd) {
      onRunCommand(cmd);
    } else {
      const foundApp = apps.find((a) => a.packageName === notif.packageName || a.name === notif.appName);
      if (foundApp && onOpenApp) {
        onOpenApp(foundApp);
      } else {
        onRunCommand(`open "${notif.appName}"`);
      }
    }
  };

  return (
    <div 
      id="notifs-tab-container"
      className="flex-1 flex flex-col h-full min-h-0 overflow-hidden font-mono select-none"
      style={{ color: theme.fg }}
    >
      {/* Top Controls Header */}
      <div 
        className="flex flex-wrap items-center justify-between gap-2 p-2.5 border-b shrink-0"
        style={{ borderColor: theme.borderColor, backgroundColor: `${theme.cardBg}80` }}
      >
        <div className="flex items-center gap-2">
          <div 
            className="w-7 h-7 rounded flex items-center justify-center border"
            style={{ backgroundColor: `${theme.promptColor}20`, borderColor: `${theme.promptColor}50`, color: theme.promptColor }}
          >
            <Bell size={14} />
          </div>
          <div>
            <div className="font-bold text-xs flex items-center gap-1.5" style={{ color: theme.fg }}>
              <span>Notification Hub</span>
              <span 
                className="text-[10px] px-1.5 py-0.2 rounded font-bold"
                style={{ backgroundColor: `${theme.promptColor}25`, color: theme.promptColor }}
              >
                {notifications.length} Active
              </span>
            </div>
            <div className="text-[10px] opacity-60 flex items-center gap-1">
              <ShieldCheck size={10} className="text-emerald-400" />
              <span>WhatsApp • SMS • Call Listener Active</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSyncNotifications && (
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) soundManager.playKeyClick('mechanical', 0.15);
                onSyncNotifications();
              }}
              disabled={isSyncing}
              className="px-2.5 py-1 text-xs font-bold rounded border flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              style={{
                backgroundColor: `${theme.promptColor}18`,
                borderColor: `${theme.promptColor}60`,
                color: theme.promptColor,
              }}
              title="Sync phone notifications from Android NotificationListener"
            >
              <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Phone'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSimulateNewNotification}
            className="px-2.5 py-1 text-xs font-bold rounded border flex items-center gap-1 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            style={{
              backgroundColor: `${theme.accentColor}20`,
              borderColor: theme.accentColor,
              color: theme.accentColor,
            }}
            title="Generate test notification"
          >
            <PlusCircle size={12} />
            <span className="hidden sm:inline">Simulate Push</span>
          </button>

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) soundManager.playKeyClick('mechanical', 0.2);
                onClearAllNotifications();
              }}
              className="px-2.5 py-1 text-xs font-bold rounded border flex items-center gap-1 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              style={{
                backgroundColor: `${theme.errorColor}15`,
                borderColor: `${theme.errorColor}60`,
                color: theme.errorColor,
              }}
              title="Clear all notifications"
            >
              <Trash2 size={12} />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Android Notification Access Permission Banner */}
      {isNativeAndroidApp() && !isAccessGranted && (
        <div 
          className="mx-3 mt-2 p-2.5 rounded border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs animate-pulse"
          style={{
            borderColor: '#f59e0b',
            backgroundColor: '#f59e0b15',
            color: '#f59e0b',
          }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-amber-400" />
            <div>
              <span className="font-bold">Android Notification Access Required:</span>
              <span className="opacity-90 ml-1">
                Enable notification listener in Android settings to capture real-time WhatsApp, SMS, and Call alerts.
              </span>
            </div>
          </div>
          {onOpenAccessSettings && (
            <button
              type="button"
              onClick={() => {
                if (soundEnabled) soundManager.playKeyClick('mechanical', 0.2);
                onOpenAccessSettings();
              }}
              className="px-2.5 py-1 rounded border font-bold text-[10px] whitespace-nowrap cursor-pointer hover:scale-105 active:scale-95 transition-all shrink-0"
              style={{
                borderColor: '#f59e0b',
                backgroundColor: '#f59e0b30',
                color: '#f59e0b',
              }}
            >
              ★ ENABLE NOTIFICATION ACCESS
            </button>
          )}
        </div>
      )}

      {/* Primary Category Selector Bar (WhatsApp, SMS, Calls, All) */}
      <div 
        className="flex items-center gap-1.5 px-2.5 py-2 border-b overflow-x-auto no-scrollbar shrink-0 text-xs"
        style={{ borderColor: `${theme.borderColor}60`, backgroundColor: `${theme.cardBg}40` }}
      >
        <span className="text-[10px] opacity-60 uppercase font-bold mr-0.5 shrink-0">
          Feed:
        </span>

        {/* All Tab */}
        <button
          onClick={() => {
            if (soundEnabled) soundManager.playKeyClick('mechanical', 0.1);
            setSelectedCategory('all');
          }}
          className="px-2.5 py-1 rounded text-[11px] font-bold transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer"
          style={{
            borderColor: selectedCategory === 'all' ? theme.accentColor : `${theme.borderColor}70`,
            backgroundColor: selectedCategory === 'all' ? `${theme.accentColor}25` : 'transparent',
            color: selectedCategory === 'all' ? theme.accentColor : theme.fg,
          }}
        >
          <Bell size={12} />
          <span>All</span>
          <span className="text-[9px] opacity-80 px-1 py-0.2 rounded font-mono" style={{ backgroundColor: `${theme.accentColor}20` }}>
            {categoryCounts.all}
          </span>
        </button>

        {/* WhatsApp Tab */}
        <button
          onClick={() => {
            if (soundEnabled) soundManager.playKeyClick('mechanical', 0.1);
            setSelectedCategory('whatsapp');
          }}
          className="px-2.5 py-1 rounded text-[11px] font-bold transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer"
          style={{
            borderColor: selectedCategory === 'whatsapp' ? '#25D366' : `${theme.borderColor}70`,
            backgroundColor: selectedCategory === 'whatsapp' ? '#25D36625' : 'transparent',
            color: selectedCategory === 'whatsapp' ? '#25D366' : theme.fg,
          }}
        >
          <MessageSquare size={12} className="text-[#25D366]" />
          <span>WhatsApp</span>
          <span className="text-[9px] px-1 py-0.2 rounded font-mono" style={{ backgroundColor: '#25D36620', color: '#25D366' }}>
            {categoryCounts.whatsapp}
          </span>
        </button>

        {/* SMS Messages Tab */}
        <button
          onClick={() => {
            if (soundEnabled) soundManager.playKeyClick('mechanical', 0.1);
            setSelectedCategory('sms');
          }}
          className="px-2.5 py-1 rounded text-[11px] font-bold transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer"
          style={{
            borderColor: selectedCategory === 'sms' ? '#38bdf8' : `${theme.borderColor}70`,
            backgroundColor: selectedCategory === 'sms' ? '#38bdf825' : 'transparent',
            color: selectedCategory === 'sms' ? '#38bdf8' : theme.fg,
          }}
        >
          <MessageSquare size={12} className="text-sky-400" />
          <span>SMS</span>
          <span className="text-[9px] px-1 py-0.2 rounded font-mono" style={{ backgroundColor: '#38bdf820', color: '#38bdf8' }}>
            {categoryCounts.sms}
          </span>
        </button>

        {/* Calls / Missed Calls Tab */}
        <button
          onClick={() => {
            if (soundEnabled) soundManager.playKeyClick('mechanical', 0.1);
            setSelectedCategory('call');
          }}
          className="px-2.5 py-1 rounded text-[11px] font-bold transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer"
          style={{
            borderColor: selectedCategory === 'call' ? '#ef4444' : `${theme.borderColor}70`,
            backgroundColor: selectedCategory === 'call' ? '#ef444425' : 'transparent',
            color: selectedCategory === 'call' ? '#ef4444' : theme.fg,
          }}
        >
          <PhoneCall size={12} className="text-rose-400" />
          <span>Calls</span>
          <span className="text-[9px] px-1 py-0.2 rounded font-mono" style={{ backgroundColor: '#ef444420', color: '#ef4444' }}>
            {categoryCounts.call}
          </span>
        </button>

        {/* General / System Alerts Tab */}
        {categoryCounts.general > 0 && (
          <button
            onClick={() => {
              if (soundEnabled) soundManager.playKeyClick('mechanical', 0.1);
              setSelectedCategory('general');
            }}
            className="px-2.5 py-1 rounded text-[11px] font-bold transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer"
            style={{
              borderColor: selectedCategory === 'general' ? theme.promptColor : `${theme.borderColor}70`,
              backgroundColor: selectedCategory === 'general' ? `${theme.promptColor}25` : 'transparent',
              color: selectedCategory === 'general' ? theme.promptColor : theme.fg,
            }}
          >
            <span>Other</span>
            <span className="text-[9px] opacity-80 px-1 py-0.2 rounded font-mono" style={{ backgroundColor: `${theme.promptColor}20` }}>
              {categoryCounts.general}
            </span>
          </button>
        )}
      </div>

      {/* Secondary Priority Filter Bar */}
      <div 
        className="flex items-center gap-1.5 px-2.5 py-1.5 border-b overflow-x-auto no-scrollbar shrink-0 text-xs"
        style={{ borderColor: `${theme.borderColor}40`, backgroundColor: theme.bg }}
      >
        <span className="text-[10px] opacity-50 uppercase font-bold mr-1 shrink-0 flex items-center gap-1">
          <Filter size={10} />
          Priority:
        </span>
        {['all', 'urgent', 'high', 'normal', 'low'].map((p) => {
          const isActive = filterPriority === p;
          return (
            <button
              key={`pri-${p}`}
              onClick={() => {
                if (soundEnabled) soundManager.playKeyClick('mechanical', 0.1);
                setFilterPriority(p);
              }}
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all border shrink-0 cursor-pointer"
              style={{
                borderColor: isActive ? theme.accentColor : `${theme.borderColor}50`,
                backgroundColor: isActive ? `${theme.accentColor}25` : 'transparent',
                color: isActive ? theme.accentColor : theme.fg,
              }}
            >
              {p}
            </button>
          );
        })}

        {uniqueApps.length > 1 && (
          <>
            <span className="text-[10px] opacity-30 mx-1">|</span>
            <span className="text-[10px] opacity-50 uppercase font-bold mr-1 shrink-0">App:</span>
            <button
              onClick={() => setSelectedApp('all')}
              className="px-2 py-0.5 rounded text-[10px] font-bold transition-all border shrink-0 cursor-pointer"
              style={{
                borderColor: selectedApp === 'all' ? theme.promptColor : `${theme.borderColor}50`,
                backgroundColor: selectedApp === 'all' ? `${theme.promptColor}25` : 'transparent',
                color: selectedApp === 'all' ? theme.promptColor : theme.fg,
              }}
            >
              All
            </button>
            {uniqueApps.map((appName) => {
              const isActive = selectedApp === appName;
              return (
                <button
                  key={`app-filter-${appName}`}
                  onClick={() => {
                    if (soundEnabled) soundManager.playKeyClick('mechanical', 0.1);
                    setSelectedApp(appName);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-bold transition-all border shrink-0 cursor-pointer"
                  style={{
                    borderColor: isActive ? theme.promptColor : `${theme.borderColor}50`,
                    backgroundColor: isActive ? `${theme.promptColor}25` : 'transparent',
                    color: isActive ? theme.promptColor : theme.fg,
                  }}
                >
                  {appName}
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Notifications List Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3" style={{ scrollbarWidth: 'thin' }}>
        {filteredNotifs.length === 0 ? (
          <div 
            className="p-8 rounded border text-center font-mono space-y-3 my-4"
            style={{ borderColor: theme.borderColor, backgroundColor: `${theme.cardBg}40` }}
          >
            <div 
              className="w-12 h-12 rounded-full mx-auto flex items-center justify-center border"
              style={{ borderColor: `${theme.accentColor}40`, backgroundColor: `${theme.accentColor}15`, color: theme.accentColor }}
            >
              <CheckCircle2 size={24} />
            </div>
            <div className="text-sm font-bold" style={{ color: theme.fg }}>
              {notifications.length === 0 
                ? 'All Caught Up! No Active Notifications' 
                : `No ${selectedCategory !== 'all' ? selectedCategory.toUpperCase() : ''} notifications match this filter`}
            </div>
            <p className="text-xs opacity-60 max-w-md mx-auto">
              {notifications.length === 0
                ? 'Your notification feed is clear. Real-time WhatsApp messages, SMS alerts, and phone calls will appear here automatically.'
                : 'Try switching categories or resetting priority filters to view other alerts.'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSimulateNewNotification}
                className="px-3 py-1.5 text-xs font-bold rounded border inline-flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                style={{ borderColor: theme.accentColor, backgroundColor: `${theme.accentColor}20`, color: theme.accentColor }}
              >
                <PlusCircle size={12} />
                <span>Simulate Push Alert</span>
              </button>
              {selectedCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setFilterPriority('all');
                    setSelectedApp('all');
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded border inline-flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  style={{ borderColor: theme.borderColor, color: theme.fg }}
                >
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredNotifs.map((notif) => {
              const priStyle = getPriorityStyle(notif.priority);
              const meta = getCategoryMeta(notif);
              const CategoryIcon = meta.Icon;

              return (
                <div
                  key={notif.id}
                  id={`notification-card-${notif.id}`}
                  className="p-3.5 rounded-lg border flex flex-col gap-2 transition-all hover:scale-[1.005] group shadow-sm"
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: meta.borderColor || priStyle.border,
                  }}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Category Icon Badge */}
                      <span 
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border"
                        style={{ 
                          backgroundColor: meta.badgeBg, 
                          borderColor: meta.borderColor, 
                          color: meta.badgeColor 
                        }}
                      >
                        <CategoryIcon size={14} />
                      </span>

                      <div className="min-w-0">
                        <div className="font-bold text-xs flex items-center gap-2 truncate" style={{ color: theme.fg }}>
                          <span className="truncate">{notif.appName}</span>
                          <span 
                            className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider shrink-0 border"
                            style={{ 
                              backgroundColor: meta.badgeBg, 
                              borderColor: meta.borderColor, 
                              color: meta.badgeColor 
                            }}
                          >
                            {meta.label}
                          </span>
                          {notif.priority === 'urgent' && (
                            <span 
                              className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0 border"
                              style={{ backgroundColor: '#ef444425', borderColor: '#ef4444', color: '#ef4444' }}
                            >
                              URGENT
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] opacity-60 font-mono truncate">
                          {notif.packageName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] opacity-60 flex items-center gap-1 font-mono">
                        <Clock size={10} />
                        {formatTime(notif.timestamp)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDismiss(notif.id)}
                        className="p-1 rounded opacity-60 hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                        title="Dismiss notification"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Card Body: Title / Sender and Message */}
                  <div className="space-y-1 pl-9">
                    <div className="font-bold text-xs flex items-center gap-1.5" style={{ color: theme.fg }}>
                      <span>{notif.title}</span>
                    </div>
                    {notif.message && (
                      <div className="text-xs opacity-85 leading-relaxed font-sans" style={{ color: theme.fg }}>
                        {notif.message}
                      </div>
                    )}
                  </div>

                  {/* Notification Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t mt-1 pl-9" style={{ borderColor: `${theme.borderColor}40` }}>
                    <button
                      type="button"
                      onClick={() => handleDismiss(notif.id)}
                      className="px-2 py-1 rounded text-[11px] font-medium opacity-70 hover:opacity-100 transition-all cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(notif)}
                      className="px-3 py-1 rounded text-xs font-bold border flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      style={{
                        backgroundColor: meta.badgeBg,
                        borderColor: meta.borderColor,
                        color: meta.badgeColor,
                      }}
                    >
                      <CategoryIcon size={11} />
                      <span>{notif.actionLabel || meta.actionLabel}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
