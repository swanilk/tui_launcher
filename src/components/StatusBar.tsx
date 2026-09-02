/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Theme, LauncherConfig, BluetoothState, HotspotState } from '../types';
import { 
  Wifi, 
  Battery, 
  BatteryCharging, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Palette, 
  Terminal,
  Grid,
  Bell,
  Clock,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  Flame,
  Radio
} from 'lucide-react';

export type MainTabType = 'apps' | 'notifs' | 'term';

interface StatusBarProps {
  theme: Theme;
  config: LauncherConfig;
  batteryLevel: number;
  isCharging: boolean;
  powerSaver?: boolean;
  wifiSsid: string;
  bluetoothState?: BluetoothState;
  hotspotState?: HotspotState;
  activeTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
  appsCount?: number;
  notifsCount?: number;
  termLinesCount?: number;
  onToggleSound: () => void;
  onToggleCrt: () => void;
  onOpenThemeModal: () => void;
  onOpenAppLauncher?: () => void;
  onOpenNotifications?: () => void;
  onOpenBatteryModal?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  theme,
  config,
  batteryLevel,
  isCharging,
  powerSaver,
  wifiSsid,
  bluetoothState,
  hotspotState,
  activeTab,
  onSelectTab,
  appsCount = 0,
  notifsCount = 0,
  termLinesCount = 0,
  onToggleSound,
  onToggleCrt,
  onOpenThemeModal,
  onOpenAppLauncher,
  onOpenNotifications,
  onOpenBatteryModal,
}) => {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: !config.clock24h,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [config.clock24h]);

  return (
    <header
      id="tui-status-bar"
      className="w-full flex items-center justify-between px-3 py-2 border-b text-xs transition-colors shrink-0 select-none z-10 font-mono"
      style={{
        backgroundColor: theme.cardBg,
        borderColor: theme.borderColor,
        color: theme.fg,
      }}
    >
      {/* Left side: High Density Device & OS Telemetry */}
      <div className="flex items-center gap-2 sm:gap-3 text-[11px] overflow-hidden">
        <span className="font-bold tracking-tight shrink-0" style={{ color: theme.promptColor }}>
          [ DEVICE: ANDROID-16 ]
        </span>
        <span className="hidden md:inline opacity-70 shrink-0">
          [ OS: BAKLAVA-API36 ]
        </span>
        <span className="hidden sm:inline opacity-80 shrink-0" style={{ color: theme.accentColor }}>
          [ 16KB-PAGE: ALIGNED ]
        </span>
      </div>

      {/* Center: Quick interactive Top Tabs (Apps, Notifs, Term) */}
      <div className="flex items-center gap-1 sm:gap-1.5 mx-1 sm:mx-2">
        {/* Apps Tab Button */}
        <button
          id="btn-quick-apps"
          onClick={() => onSelectTab('apps')}
          title="Switch to Apps Tab (Ctrl+1)"
          className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded transition-all border hover:scale-105 active:scale-95"
          style={{
            borderColor: activeTab === 'apps' ? theme.accentColor : theme.borderColor,
            backgroundColor: activeTab === 'apps' ? `${theme.accentColor}30` : `${theme.accentColor}10`,
            color: activeTab === 'apps' ? theme.accentColor : theme.fg,
            boxShadow: activeTab === 'apps' ? `0 0 8px ${theme.accentColor}40` : 'none',
          }}
        >
          <Grid size={11} />
          <span>Apps</span>
          {appsCount > 0 && (
            <span 
              className="text-[9px] px-1 py-0.1 rounded hidden sm:inline"
              style={{ backgroundColor: `${theme.accentColor}25` }}
            >
              {appsCount}
            </span>
          )}
        </button>

        {/* Notifs Tab Button */}
        <button
          id="btn-quick-notifs"
          onClick={() => onSelectTab('notifs')}
          title="Switch to Notifications Tab (Ctrl+2)"
          className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded transition-all border hover:scale-105 active:scale-95"
          style={{
            borderColor: activeTab === 'notifs' ? (theme.warningColor || '#ffcc00') : (notifsCount > 0 ? `${theme.warningColor || '#ffcc00'}80` : theme.borderColor),
            backgroundColor: activeTab === 'notifs' ? `${theme.warningColor || '#ffcc00'}30` : (notifsCount > 0 ? `${theme.warningColor || '#ffcc00'}15` : 'transparent'),
            color: activeTab === 'notifs' ? (theme.warningColor || '#ffcc00') : (notifsCount > 0 ? (theme.warningColor || '#ffcc00') : theme.fg),
            boxShadow: activeTab === 'notifs' ? `0 0 8px ${(theme.warningColor || '#ffcc00')}40` : 'none',
          }}
        >
          <Bell size={11} className={notifsCount > 0 ? 'animate-pulse' : ''} />
          <span>Notifs</span>
          {notifsCount > 0 && (
            <span 
              className="text-[9px] px-1 py-0.1 rounded font-bold"
              style={{ backgroundColor: `${theme.warningColor || '#ffcc00'}30` }}
            >
              {notifsCount}
            </span>
          )}
        </button>

        {/* Term Tab Button */}
        <button
          id="btn-quick-term"
          onClick={() => onSelectTab('term')}
          title="Switch to Terminal Output Tab (Ctrl+3)"
          className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded transition-all border hover:scale-105 active:scale-95"
          style={{
            borderColor: activeTab === 'term' ? theme.promptColor : theme.borderColor,
            backgroundColor: activeTab === 'term' ? `${theme.promptColor}30` : `${theme.promptColor}10`,
            color: activeTab === 'term' ? theme.promptColor : theme.fg,
            boxShadow: activeTab === 'term' ? `0 0 8px ${theme.promptColor}40` : 'none',
          }}
        >
          <Terminal size={11} className={activeTab === 'term' ? 'text-emerald-400' : ''} />
          <span>Term</span>
          {termLinesCount > 0 && (
            <span 
              className="text-[9px] px-1 py-0.1 rounded font-mono hidden sm:inline"
              style={{ backgroundColor: `${theme.promptColor}20` }}
            >
              {termLinesCount}
            </span>
          )}
        </button>

        {/* Theme switcher */}
        <button
          id="btn-quick-themes"
          onClick={onOpenThemeModal}
          title="Switch Theme (Alt+T)"
          className="flex items-center gap-1 px-2 py-0.5 text-[11px] hover:bg-white/10 transition-colors border rounded"
          style={{ borderColor: theme.borderColor, color: theme.fg }}
        >
          <Palette size={11} />
          <span className="hidden md:inline">{theme.name.split(' ')[0]}</span>
        </button>
      </div>

      {/* Right side: High Density System Metrics (MEM, BAT, CONNECTED) */}
      <div className="flex items-center gap-2 sm:gap-3 text-[11px] font-mono shrink-0">
        <span className="hidden xl:inline opacity-70 text-[10px]">
          MEM: 4.2GB / 8GB
        </span>

        {/* Bluetooth Telemetry Indicator */}
        {bluetoothState && (
          <div 
            id="btn-status-bluetooth"
            className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold rounded border"
            style={{
              borderColor: bluetoothState.enabled 
                ? (bluetoothState.devices.some(d => d.connected) ? `${theme.infoColor}60` : `${theme.borderColor}`)
                : `${theme.errorColor}40`,
              backgroundColor: bluetoothState.enabled 
                ? (bluetoothState.devices.some(d => d.connected) ? `${theme.infoColor}15` : 'transparent')
                : `${theme.errorColor}10`,
              color: bluetoothState.enabled 
                ? (bluetoothState.devices.some(d => d.connected) ? theme.infoColor : theme.fg)
                : theme.errorColor,
            }}
            title={bluetoothState.enabled 
              ? `Bluetooth Enabled • ${bluetoothState.devices.filter(d => d.connected).length} Connected`
              : 'Bluetooth Disabled'}
          >
            {!bluetoothState.enabled ? (
              <>
                <BluetoothOff size={11} className="opacity-70" />
                <span>BT: OFF</span>
              </>
            ) : bluetoothState.devices.some(d => d.connected) ? (
              <>
                <BluetoothConnected size={11} className="text-cyan-400 animate-pulse" />
                <span className="truncate max-w-[90px]">
                  {bluetoothState.devices.find(d => d.connected)?.name.split(' ')[0] || 'BT: ON'}
                </span>
              </>
            ) : (
              <>
                <Bluetooth size={11} />
                <span>BT: ON</span>
              </>
            )}
          </div>
        )}

        {/* Hotspot Indicator */}
        {hotspotState?.enabled && (
          <div
            id="btn-status-hotspot"
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold rounded border bg-amber-500/15 border-amber-500/50 text-amber-400 animate-pulse"
            title={`Hotspot Broadcasting (${hotspotState.ssid}) • ${hotspotState.clients.length} Clients • ${hotspotState.band}`}
          >
            <Flame size={11} className="text-amber-400" />
            <span className="hidden md:inline">AP: {hotspotState.ssid} ({hotspotState.clients.length})</span>
            <span className="md:hidden">AP: ON</span>
          </div>
        )}

        {/* Battery Telemetry (Interactive Monitor Trigger) */}
        <button
          id="btn-status-battery-monitor"
          onClick={onOpenBatteryModal}
          className="flex items-center gap-1 px-1.5 py-0.5 font-bold text-[10px] sm:text-[11px] rounded border border-transparent hover:border-current hover:bg-white/5 transition-all cursor-pointer"
          style={{
            color: isCharging ? theme.successColor : (batteryLevel <= 20 ? theme.errorColor : theme.fg),
          }}
          title="Click to open Hardware Battery Monitor & Diagnostics"
        >
          {isCharging ? <BatteryCharging size={12} className="animate-pulse" /> : <Battery size={12} />}
          <span>BAT: {batteryLevel}% {isCharging ? '(CHG)' : '(DIS)'}</span>
          {powerSaver && (
            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              SAVER
            </span>
          )}
        </button>

        {/* Connected Indicator */}
        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold" style={{ color: theme.successColor }}>
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.successColor }}></span>
          <span className="hidden sm:inline">CONNECTED</span>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-1 border-l pl-2" style={{ borderColor: theme.borderColor }}>
          <button
            id="toggle-crt-effect"
            onClick={onToggleCrt}
            title={`CRT Scanlines: ${config.crtEffect ? 'Enabled' : 'Disabled'}`}
            className="p-1 hover:opacity-75 transition-opacity"
            style={{ color: config.crtEffect ? theme.promptColor : theme.fg, opacity: config.crtEffect ? 1 : 0.4 }}
          >
            <Sparkles size={12} />
          </button>

          <button
            id="toggle-sound-effect"
            onClick={onToggleSound}
            title={`Keystroke Sound: ${config.soundEnabled ? 'Enabled' : 'Muted'}`}
            className="p-1 hover:opacity-75 transition-opacity"
            style={{ color: config.soundEnabled ? theme.accentColor : theme.fg, opacity: config.soundEnabled ? 1 : 0.4 }}
          >
            {config.soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
          </button>
        </div>
      </div>
    </header>
  );
};
