/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Theme, AndroidApp, Alias, AppNotification } from '../types';
import { 
  Zap, 
  Radio, 
  BatteryCharging, 
  Battery, 
  Clock, 
  Grid, 
  Terminal, 
  Bell, 
  Search,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { soundManager } from '../utils/audio';

interface HighDensityHudProps {
  theme: Theme;
  apps: AndroidApp[];
  aliases: Alias[];
  notifications?: AppNotification[];
  onOpenApp: (app: AndroidApp) => void;
  onRunCommand: (cmd: string) => void;
  onOpenBatteryModal?: () => void;
  batteryLevel?: number;
  isCharging?: boolean;
  powerSaver?: boolean;
  soundEnabled: boolean;
}

export const HighDensityHud: React.FC<HighDensityHudProps> = ({
  theme,
  apps,
  aliases,
  notifications = [],
  onOpenApp,
  onRunCommand,
  onOpenBatteryModal,
  batteryLevel = 84,
  isCharging = false,
  powerSaver = false,
  soundEnabled,
}) => {
  const [activeTab, setActiveTab] = useState<'apps' | 'aliases' | 'notifs'>('apps');
  const [appSearch, setAppSearch] = useState('');

  const notificationCount = notifications.length;

  const [weatherData] = useState({
    temp: '18°C',
    condition: 'Partly Cloudy',
    location: 'Android_Node',
  });

  // Hotkey mapping for quick keyboard mental cues
  const fastAccessKeys: { [appName: string]: string } = {
    'Chrome Browser': 'B',
    'Messages': 'M',
    'Settings': 'S',
    'Gallery Photos': 'G',
    'Camera App': 'C',
    'File Manager': 'F',
    'Calculator': 'K',
    'Weather Forecast': 'W',
    'Phone': 'P',
    'Termux TUI Core': 'T',
  };

  // 1. Recently used apps (Top-most in the Apps tab)
  const recentApps = useMemo(() => {
    const sorted = [...apps].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
    // If no explicit lastUsed yet, fall back to favorites
    return sorted.filter((a) => (a.lastUsed && a.lastUsed > 0) || a.favorite).slice(0, 4);
  }, [apps]);

  // 2. Filtered list of all installed apps
  const filteredApps = useMemo(() => {
    if (!appSearch.trim()) return apps;
    const query = appSearch.toLowerCase();
    return apps.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.packageName.toLowerCase().includes(query) ||
        a.category.toLowerCase().includes(query)
    );
  }, [apps, appSearch]);

  const handleAppClick = (app: AndroidApp) => {
    if (soundEnabled) soundManager.playKeyClick('mechanical', 0.2);
    if (app.launchAction === 'command' && app.commandToRun) {
      onRunCommand(app.commandToRun);
    } else {
      onOpenApp(app);
    }
  };

  const handleAliasClick = (alias: Alias) => {
    if (soundEnabled) soundManager.playKeyClick('mechanical', 0.2);
    onRunCommand(alias.name);
  };

  return (
    <aside
      id="high-density-aside-hud"
      className="hidden lg:flex w-72 flex-col gap-3.5 border-l pl-4 py-1 text-xs font-mono shrink-0 select-none overflow-y-auto"
      style={{
        borderColor: theme.borderColor,
        color: theme.fg,
      }}
    >
      {/* Tab Navigation Controls */}
      <div className="flex items-center border p-0.5 rounded-none" style={{ borderColor: theme.borderColor, backgroundColor: `${theme.bg}` }}>
        <button
          type="button"
          onClick={() => {
            if (soundEnabled) soundManager.playKeyClick('mechanical', 0.15);
            setActiveTab('apps');
          }}
          className="flex-1 py-1 text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
          style={{
            backgroundColor: activeTab === 'apps' ? `${theme.accentColor}25` : 'transparent',
            color: activeTab === 'apps' ? theme.accentColor : theme.fg,
          }}
        >
          <Grid size={11} />
          <span>Apps ({apps.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (soundEnabled) soundManager.playKeyClick('mechanical', 0.15);
            setActiveTab('aliases');
          }}
          className="flex-1 py-1 text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
          style={{
            backgroundColor: activeTab === 'aliases' ? `${theme.warningColor || '#ffcc00'}25` : 'transparent',
            color: activeTab === 'aliases' ? (theme.warningColor || '#ffcc00') : theme.fg,
          }}
        >
          <Terminal size={11} />
          <span>Aliases</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (soundEnabled) soundManager.playKeyClick('mechanical', 0.15);
            onRunCommand('notifications');
          }}
          className="px-2 py-1 text-[11px] font-bold flex items-center justify-center gap-1 transition-all hover:bg-white/10"
          style={{
            color: theme.promptColor,
          }}
          title="Open Notifications in Terminal"
        >
          <Bell size={11} />
          <span className="text-[10px] px-1 rounded-full font-bold" style={{ backgroundColor: `${theme.promptColor}30`, color: theme.promptColor }}>
            {notificationCount}
          </span>
        </button>
      </div>

      {/* TAB 1: APPS TAB (With Recent Apps at the Top Most & Inbuilt Scrolling) */}
      {activeTab === 'apps' && (
        <div className="flex flex-col gap-2.5">
          {/* Quick App Filter Bar */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 border text-xs"
            style={{ borderColor: theme.borderColor, backgroundColor: `${theme.cardBg}` }}
          >
            <Search size={11} className="opacity-50 shrink-0" />
            <input
              type="text"
              value={appSearch}
              onChange={(e) => setAppSearch(e.target.value)}
              placeholder="Search apps..."
              className="bg-transparent border-none outline-none w-full text-[11px] font-mono"
              style={{ color: theme.fg }}
            />
            {appSearch && (
              <button
                type="button"
                onClick={() => setAppSearch('')}
                className="text-[10px] opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            )}
          </div>

          {/* Inbuilt Scrollable Apps Container */}
          <div 
            className="max-h-[300px] overflow-y-auto space-y-3 pr-1"
            style={{ scrollbarWidth: 'thin' }}
          >
            {/* Topmost Section: Recently Used Apps */}
            {!appSearch && recentApps.length > 0 && (
              <div>
                <div
                  className="text-[10px] uppercase tracking-widest mb-1.5 font-bold flex items-center justify-between"
                  style={{ color: theme.promptColor }}
                >
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    RECENTLY USED [TOP]
                  </span>
                  <span className="text-[9px] opacity-60">RESUME</span>
                </div>
                <nav className="space-y-1">
                  {recentApps.map((app) => {
                    const hotkey = fastAccessKeys[app.name] || app.name.charAt(0).toUpperCase();
                    return (
                      <div
                        key={`hud-rec-${app.id}`}
                        id={`hud-recent-app-${app.id}`}
                        onClick={() => handleAppClick(app)}
                        className="flex justify-between items-center px-2 py-1 border transition-all cursor-pointer group hover:scale-[1.01]"
                        style={{
                          backgroundColor: `${theme.accentColor}12`,
                          borderColor: `${theme.accentColor}50`,
                        }}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0"
                            style={{ backgroundColor: `${theme.accentColor}30`, color: theme.accentColor }}
                          >
                            {app.name.charAt(0)}
                          </span>
                          <span className="font-bold text-xs truncate" style={{ color: theme.fg }}>
                            {app.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[9px] font-bold" style={{ color: theme.accentColor }}>
                            [RECENT]
                          </span>
                          <span
                            className="text-[10px] font-mono px-1 py-0.2 rounded border"
                            style={{
                              borderColor: theme.borderColor,
                              color: theme.accentColor,
                              backgroundColor: `${theme.bg}`,
                            }}
                          >
                            [{hotkey}]
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </nav>
              </div>
            )}

            {/* All Installed Applications Section */}
            <div>
              <div
                className="text-[10px] uppercase tracking-widest mb-1.5 font-bold flex items-center justify-between"
                style={{ color: theme.fg }}
              >
                <span>ALL INSTALLED APPS ({filteredApps.length})</span>
                <span className="text-[9px] opacity-60">SCROLLABLE</span>
              </div>
              <nav className="space-y-1">
                {filteredApps.map((app) => {
                  const hotkey = fastAccessKeys[app.name] || app.name.charAt(0).toUpperCase();
                  return (
                    <div
                      key={`hud-all-${app.id}`}
                      id={`hud-app-${app.id}`}
                      onClick={() => handleAppClick(app)}
                      className="flex justify-between items-center px-2 py-1 border transition-all cursor-pointer group hover:bg-white/5"
                      style={{
                        backgroundColor: `${theme.bg}`,
                        borderColor: theme.borderColor,
                      }}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0"
                          style={{ backgroundColor: `${theme.borderColor}40`, color: theme.fg }}
                        >
                          {app.name.charAt(0)}
                        </span>
                        <div className="truncate">
                          <div className="font-bold text-xs truncate" style={{ color: theme.fg }}>
                            {app.name}
                          </div>
                          <div className="text-[9px] opacity-60 truncate">{app.category}</div>
                        </div>
                      </div>
                      <span
                        className="text-[10px] font-mono px-1 py-0.2 rounded shrink-0 border"
                        style={{
                          borderColor: theme.borderColor,
                          color: theme.promptColor,
                          backgroundColor: `${theme.cardBg}`,
                        }}
                      >
                        [{hotkey}]
                      </span>
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALIASES TAB */}
      {activeTab === 'aliases' && (
        <div>
          <div
            className="text-[10px] uppercase tracking-widest mb-2 font-bold flex items-center justify-between"
            style={{ color: theme.warningColor || '#ffcc00' }}
          >
            <span>Custom Shell Aliases</span>
            <span className="text-[9px] opacity-60">CLICK TO EXEC</span>
          </div>
          <div className="text-[11px] space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
            {aliases.map((alias) => (
              <div
                key={alias.name}
                id={`hud-alias-${alias.name}`}
                onClick={() => handleAliasClick(alias)}
                className="flex justify-between items-center px-2 py-1.5 border border-transparent hover:border-current hover:bg-white/5 transition-all cursor-pointer group"
                style={{ borderColor: `${theme.borderColor}50`, backgroundColor: `${theme.cardBg}` }}
              >
                <span className="font-bold group-hover:underline" style={{ color: theme.warningColor || '#ffcc00' }}>
                  {alias.name}
                </span>
                <span className="text-[10px] truncate max-w-[130px] opacity-60 font-mono text-right" style={{ color: theme.fg }}>
                  {alias.command}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: NOTIFICATIONS TAB (TABULAR, SEGREGATED BY APP, RECENT AT BOTTOM) */}
      {activeTab === 'notifs' && (
        <div className="space-y-2">
          <div
            className="text-[10px] uppercase tracking-widest font-bold flex items-center justify-between"
            style={{ color: theme.promptColor }}
          >
            <span className="flex items-center gap-1.5">
              <Bell size={12} style={{ color: theme.accentColor }} />
              <span>NOTIFICATIONS ({notifications.length})</span>
            </span>
            <button
              onClick={() => onRunCommand('notifications clear')}
              className="text-[9px] px-1 py-0.5 border hover:bg-white/10 transition-colors uppercase font-mono"
              style={{ borderColor: theme.borderColor, color: theme.warningColor || '#ffcc00' }}
              title="Clear all notifications"
            >
              Clear
            </button>
          </div>

          {notifications.length === 0 ? (
            <div
              className="p-3 text-center text-xs opacity-60 border border-dashed"
              style={{ borderColor: theme.borderColor, color: theme.fg }}
            >
              <div>No active notifications</div>
              <button
                onClick={() => onRunCommand('notify test')}
                className="mt-2 text-[10px] px-2 py-1 border hover:bg-white/10 font-mono"
                style={{ borderColor: theme.borderColor, color: theme.accentColor }}
              >
                + Dispatch Test Alert
              </button>
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {(() => {
                // Group by app
                const groupMap: { [appId: string]: { appName: string; packageName: string; items: AppNotification[]; latestTime: number } } = {};
                for (const notif of notifications) {
                  const key = notif.appId || notif.appName.toLowerCase();
                  if (!groupMap[key]) {
                    groupMap[key] = {
                      appName: notif.appName,
                      packageName: notif.packageName,
                      items: [],
                      latestTime: notif.timestamp,
                    };
                  }
                  groupMap[key].items.push(notif);
                  if (notif.timestamp > groupMap[key].latestTime) {
                    groupMap[key].latestTime = notif.timestamp;
                  }
                }

                // Sort app groups so that the app with the most recent notification is at the BOTTOM-MOST
                const sortedGroups = Object.values(groupMap).sort((a, b) => a.latestTime - b.latestTime);

                return sortedGroups.map((group) => (
                  <div
                    key={group.appName}
                    className="border overflow-hidden"
                    style={{
                      borderColor: theme.borderColor,
                      backgroundColor: `${theme.cardBg}`,
                    }}
                  >
                    {/* App Header */}
                    <div
                      className="px-2 py-1 text-[10px] font-bold flex items-center justify-between border-b"
                      style={{
                        backgroundColor: `${theme.accentColor}15`,
                        borderColor: theme.borderColor,
                        color: theme.accentColor,
                      }}
                    >
                      <span className="truncate">{group.appName}</span>
                      <span className="text-[9px] opacity-75 font-mono">
                        {group.items.length} {group.items.length === 1 ? 'alert' : 'alerts'}
                      </span>
                    </div>

                    {/* Notification single-line rows in tabular format */}
                    <div className="divide-y" style={{ borderColor: `${theme.borderColor}30` }}>
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (item.actionCommand) {
                              onRunCommand(item.actionCommand);
                            } else {
                              onRunCommand(`open ${item.appName}`);
                            }
                          }}
                          className="px-2 py-1.5 text-[10px] flex items-center justify-between gap-1.5 hover:bg-white/10 cursor-pointer transition-colors group"
                          title="Click to launch application"
                        >
                          <div className="truncate flex-1">
                            <span className="font-semibold mr-1" style={{ color: theme.fg }}>
                              {item.title}:
                            </span>
                            <span className="opacity-75" style={{ color: theme.fg }}>
                              {item.message}
                            </span>
                          </div>
                          <span className="text-[9px] font-mono shrink-0 opacity-50" style={{ color: theme.fg }}>
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* Hardware Battery & Power Diagnostics Card */}
      <div
        id="hud-battery-diagnostics-card"
        onClick={() => (onOpenBatteryModal ? onOpenBatteryModal() : onRunCommand('battery monitor'))}
        className="p-2.5 border cursor-pointer transition-all hover:scale-[1.01] group mt-auto"
        style={{
          borderColor: isCharging ? theme.successColor : theme.accentColor,
          backgroundColor: `${theme.accentColor}0a`,
        }}
      >
        <div
          className="text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center justify-between"
          style={{ color: isCharging ? theme.successColor : theme.accentColor }}
        >
          <span className="flex items-center gap-1">
            {isCharging ? <BatteryCharging size={12} className="animate-pulse" /> : <Battery size={12} />}
            BATTERY MONITOR
          </span>
          <span
            className="text-[9px] px-1 py-0.2 rounded border font-bold"
            style={{
              borderColor: isCharging ? theme.successColor : theme.borderColor,
              color: isCharging ? theme.successColor : theme.fg,
            }}
          >
            {batteryLevel}%
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] opacity-80 mb-1.5">
          <span>{isCharging ? '⚡ 45W Turbo PD' : 'Discharging'}</span>
          <span>{powerSaver ? 'Saver: ON' : 'Health: 98%'}</span>
        </div>
        <div
          className="w-full py-1 text-center font-bold text-[10px] uppercase border tracking-wider transition-colors group-hover:bg-white/10"
          style={{
            borderColor: isCharging ? theme.successColor : theme.accentColor,
            color: isCharging ? theme.successColor : theme.accentColor,
          }}
        >
          [ BATTERY TELEMETRY ]
        </div>
      </div>

      {/* Weather Service HUD Box */}
      <div
        id="hud-weather-service-box"
        onClick={() => onRunCommand('weather')}
        className="p-2.5 border border-dashed cursor-pointer transition-all hover:bg-white/5"
        style={{
          borderColor: theme.borderColor,
          backgroundColor: `${theme.accentColor}08`,
        }}
        title="Click to view full terminal weather report"
      >
        <div className="text-[10px] uppercase font-bold tracking-wider mb-1.5 flex items-center justify-between" style={{ color: theme.promptColor }}>
          <span>WEATHER_SERVICE</span>
          <Radio size={12} className="animate-pulse" style={{ color: theme.successColor }} />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-2xl" style={{ color: theme.warningColor || '#ffcc00' }}>☁</div>
          <div>
            <div className="text-base leading-none font-bold font-mono" style={{ color: theme.fg }}>
              {weatherData.temp}
            </div>
            <div className="text-[9px] uppercase opacity-70 tracking-tight mt-0.5">
              {weatherData.location} / {weatherData.condition}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

