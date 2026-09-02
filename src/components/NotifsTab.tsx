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
  ExternalLink, 
  Sparkles, 
  PlusCircle, 
  RotateCcw,
  ShieldCheck,
  Check,
  Filter
} from 'lucide-react';
import { soundManager } from '../utils/audio';

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
}) => {
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

  const uniqueApps = useMemo(() => {
    const set = new Set(notifications.map((n) => n.appName));
    return Array.from(set);
  }, [notifications]);

  const filteredNotifs = useMemo(() => {
    return notifications.filter((n) => {
      if (filterPriority !== 'all' && n.priority !== filterPriority) return false;
      if (selectedApp !== 'all' && n.appName !== selectedApp) return false;
      return true;
    });
  }, [notifications, filterPriority, selectedApp]);

  const handleSimulateNewNotification = () => {
    if (soundEnabled) soundManager.playKeyClick('modern', 0.4);
    const sampleNotifs = [
      {
        appName: 'Slack',
        packageName: 'com.slack',
        title: '#deployments: Build Successful',
        message: 'Production release v2.4.0 deployed to 12 clusters across US/EU regions.',
        priority: 'high' as const,
        actionCommand: 'term',
        actionLabel: 'View Logs',
      },
      {
        appName: 'Messages',
        packageName: 'com.google.android.apps.messaging',
        title: 'Alex Rivera',
        message: 'Hey, are you able to test the new terminal emulator release today?',
        priority: 'normal' as const,
        actionCommand: 'call Alex',
        actionLabel: 'Call Back',
      },
      {
        appName: 'Battery Monitor',
        packageName: 'com.android.system.battery',
        title: 'Battery Telemetry Alert',
        message: 'Fast charging active at 45W. Estimated 18 minutes to 100% full.',
        priority: 'low' as const,
        actionCommand: 'battery',
        actionLabel: 'View Graph',
      },
      {
        appName: 'GitHub',
        packageName: 'com.github.android',
        title: 'PR #142 Merged',
        message: 'feat: add dedicated terminal tabs and real-time output router.',
        priority: 'normal' as const,
        actionCommand: 'git status',
        actionLabel: 'Check Status',
      },
    ];

    const pick = sampleNotifs[Math.floor(Math.random() * sampleNotifs.length)];
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}`,
      appId: pick.packageName,
      appName: pick.appName,
      packageName: pick.packageName,
      title: pick.title,
      message: pick.message,
      timestamp: Date.now(),
      priority: pick.priority,
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
    if (notif.actionCommand) {
      onRunCommand(notif.actionCommand);
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
              <span>Android Notification Listener Active</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSimulateNewNotification}
            className="px-2.5 py-1 text-xs font-bold rounded border flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
            style={{
              backgroundColor: `${theme.accentColor}20`,
              borderColor: theme.accentColor,
              color: theme.accentColor,
            }}
            title="Simulate incoming push notification"
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
              className="px-2.5 py-1 text-xs font-bold rounded border flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
              style={{
                backgroundColor: `${theme.errorColor}15`,
                borderColor: `${theme.errorColor}60`,
                color: theme.errorColor,
              }}
              title="Clear and dismiss all notifications"
            >
              <Trash2 size={12} />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div 
        className="flex items-center gap-1.5 px-2.5 py-2 border-b overflow-x-auto no-scrollbar shrink-0 text-xs"
        style={{ borderColor: `${theme.borderColor}60`, backgroundColor: theme.bg }}
      >
        <span className="text-[10px] opacity-60 uppercase font-bold mr-1 shrink-0 flex items-center gap-1">
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
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all border shrink-0"
              style={{
                borderColor: isActive ? theme.accentColor : `${theme.borderColor}70`,
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
            <span className="text-[10px] opacity-40 mx-1">|</span>
            <span className="text-[10px] opacity-60 uppercase font-bold mr-1 shrink-0">App:</span>
            <button
              onClick={() => setSelectedApp('all')}
              className="px-2 py-0.5 rounded text-[10px] font-bold transition-all border shrink-0"
              style={{
                borderColor: selectedApp === 'all' ? theme.promptColor : `${theme.borderColor}70`,
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
                  className="px-2 py-0.5 rounded text-[10px] font-bold transition-all border shrink-0"
                  style={{
                    borderColor: isActive ? theme.promptColor : `${theme.borderColor}70`,
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
              {notifications.length === 0 ? 'All Caught Up! No Active Notifications' : 'No notifications match this filter'}
            </div>
            <p className="text-xs opacity-60 max-w-md mx-auto">
              {notifications.length === 0
                ? 'Your notification feed is clear. Any new system alerts, push messages, or status events will appear here in real time.'
                : 'Try changing the priority or app filter to view other notifications.'}
            </p>
            <button
              type="button"
              onClick={handleSimulateNewNotification}
              className="mt-2 px-3 py-1.5 text-xs font-bold rounded border inline-flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all"
              style={{ borderColor: theme.accentColor, backgroundColor: `${theme.accentColor}20`, color: theme.accentColor }}
            >
              <PlusCircle size={12} />
              <span>Simulate Incoming Alert</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredNotifs.map((notif) => {
              const priStyle = getPriorityStyle(notif.priority);
              return (
                <div
                  key={notif.id}
                  id={`notification-card-${notif.id}`}
                  className="p-3.5 rounded border flex flex-col gap-2 transition-all hover:scale-[1.005] group shadow-sm"
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: priStyle.border,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-6 h-6 rounded flex items-center justify-center font-bold text-[10px] border"
                        style={{ backgroundColor: priStyle.bg, borderColor: priStyle.border, color: priStyle.text }}
                      >
                        {notif.appName.charAt(0)}
                      </span>
                      <div>
                        <div className="font-bold text-xs flex items-center gap-2" style={{ color: theme.fg }}>
                          <span>{notif.appName}</span>
                          <span 
                            className="text-[9px] px-1.5 py-0.2 rounded font-bold border"
                            style={{ backgroundColor: priStyle.bg, borderColor: priStyle.border, color: priStyle.text }}
                          >
                            {priStyle.label}
                          </span>
                        </div>
                        <div className="text-[10px] opacity-60 font-mono">
                          {notif.packageName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] opacity-60 flex items-center gap-1 font-mono">
                        <Clock size={10} />
                        {formatTime(notif.timestamp)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDismiss(notif.id)}
                        className="p-1 rounded opacity-60 hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Dismiss notification"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 pl-8">
                    <div className="font-bold text-xs" style={{ color: theme.fg }}>
                      {notif.title}
                    </div>
                    <div className="text-xs opacity-80 leading-relaxed font-sans" style={{ color: theme.fg }}>
                      {notif.message}
                    </div>
                  </div>

                  {/* Notification Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t mt-1 pl-8" style={{ borderColor: `${theme.borderColor}50` }}>
                    <button
                      type="button"
                      onClick={() => handleDismiss(notif.id)}
                      className="px-2 py-1 rounded text-[11px] font-medium opacity-70 hover:opacity-100 transition-all"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(notif)}
                      className="px-3 py-1 rounded text-xs font-bold border flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all"
                      style={{
                        backgroundColor: priStyle.bg,
                        borderColor: priStyle.border,
                        color: priStyle.text,
                      }}
                    >
                      <Sparkles size={11} />
                      <span>{notif.actionLabel || 'Open'}</span>
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
