/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Theme, AndroidApp, Alias } from '../types';
import { Cloud, Sun, CloudRain, Zap, Radio, Terminal, BatteryCharging, Battery, ExternalLink } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface HighDensityHudProps {
  theme: Theme;
  apps: AndroidApp[];
  aliases: Alias[];
  onOpenApp: (app: AndroidApp) => void;
  onRunCommand: (cmd: string) => void;
  onOpenApkModal?: () => void;
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
  onOpenApp,
  onRunCommand,
  onOpenApkModal,
  onOpenBatteryModal,
  batteryLevel = 84,
  isCharging = false,
  powerSaver = false,
  soundEnabled,
}) => {
  const [weatherData, setWeatherData] = useState({
    temp: '18°C',
    condition: 'Partly Cloudy',
    location: 'Android_Node',
  });

  // Fast access apps with hotkey labels
  const fastAccessKeys: { [appName: string]: string } = {
    'Chrome Browser': 'B',
    'Messages': 'M',
    'Settings': 'S',
    'Gallery Photos': 'G',
    'Camera App': 'C',
    'File Manager': 'F',
    'Calculator': 'K',
    'Weather Forecast': 'W',
  };

  const fastApps = apps.slice(0, 5);

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
      className="hidden lg:flex w-72 flex-col gap-5 border-l pl-5 py-1 text-xs font-mono shrink-0 select-none overflow-y-auto"
      style={{
        borderColor: theme.borderColor,
        color: theme.fg,
      }}
    >
      {/* 1. Fast Access Section */}
      <div>
        <div 
          className="text-[10px] uppercase tracking-widest mb-2.5 font-bold flex items-center justify-between"
          style={{ color: `${theme.promptColor}` }}
        >
          <span>Fast Access [Apps]</span>
          <span className="text-[9px] opacity-60">HOTKEYS</span>
        </div>
        <nav className="space-y-1.5">
          {fastApps.map((app) => {
            const hotkey = fastAccessKeys[app.name] || app.name.charAt(0).toUpperCase();
            return (
              <div
                key={app.id}
                id={`hud-app-${app.id}`}
                onClick={() => handleAppClick(app)}
                className="flex justify-between items-center px-2.5 py-1.5 border transition-all cursor-pointer group hover:scale-[1.01]"
                style={{
                  backgroundColor: `${theme.accentColor}0a`,
                  borderColor: `${theme.borderColor}`,
                }}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="font-bold text-xs group-hover:text-white truncate" style={{ color: theme.fg }}>
                    {app.name}
                  </span>
                </div>
                <span 
                  className="text-[10px] font-mono px-1 py-0.2 rounded shrink-0 border"
                  style={{ 
                    borderColor: `${theme.borderColor}`, 
                    color: theme.accentColor,
                    backgroundColor: `${theme.bg}`
                  }}
                >
                  [{hotkey}]
                </span>
              </div>
            );
          })}
        </nav>
      </div>

      {/* 2. Custom Aliases Section */}
      <div>
        <div 
          className="text-[10px] uppercase tracking-widest mb-2.5 font-bold flex items-center justify-between"
          style={{ color: `${theme.warningColor || '#ffcc00'}` }}
        >
          <span>Custom Aliases</span>
          <span className="text-[9px] opacity-60">CLICK TO RUN</span>
        </div>
        <div className="text-[11px] space-y-1.5">
          {aliases.slice(0, 5).map((alias) => (
            <div
              key={alias.name}
              id={`hud-alias-${alias.name}`}
              onClick={() => handleAliasClick(alias)}
              className="flex justify-between items-center px-2 py-1 border border-transparent hover:border-current hover:bg-white/5 transition-all cursor-pointer rounded-none group"
            >
              <span className="font-bold group-hover:underline" style={{ color: theme.warningColor || '#ffcc00' }}>
                {alias.name}
              </span>
              <span className="text-[10px] truncate max-w-[140px] opacity-60 font-mono text-right" style={{ color: theme.fg }}>
                {alias.command}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Android 16 APK Compiler & Packaging Card */}
      <div
        id="hud-apk-compiler-card"
        onClick={() => onOpenApkModal ? onOpenApkModal() : onRunCommand('apk build')}
        className="p-3 border cursor-pointer transition-all hover:scale-[1.02] group"
        style={{
          borderColor: theme.promptColor,
          backgroundColor: `${theme.promptColor}0a`,
        }}
      >
        <div className="text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center justify-between" style={{ color: theme.promptColor }}>
          <span className="flex items-center gap-1">
            <Terminal size={12} />
            APK BUILDER
          </span>
          <span className="text-[9px] px-1 py-0.2 rounded border font-bold" style={{ borderColor: theme.promptColor, color: theme.promptColor }}>
            API 36
          </span>
        </div>
        <p className="text-[10px] opacity-80 leading-tight mb-2">
          Compile source into Android 16 APK with V3 Signing.
        </p>
        <div 
          className="w-full py-1 text-center font-bold text-[10px] uppercase border tracking-wider transition-colors group-hover:bg-white/10"
          style={{ borderColor: theme.promptColor, color: theme.promptColor }}
        >
          [ COMPILE APK ]
        </div>
      </div>

      {/* 4. Hardware Battery & Power Diagnostics Card */}
      <div
        id="hud-battery-diagnostics-card"
        onClick={() => onOpenBatteryModal ? onOpenBatteryModal() : onRunCommand('battery monitor')}
        className="p-3 border cursor-pointer transition-all hover:scale-[1.02] group"
        style={{
          borderColor: isCharging ? theme.successColor : theme.accentColor,
          backgroundColor: `${theme.accentColor}0a`,
        }}
      >
        <div className="text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center justify-between" style={{ color: isCharging ? theme.successColor : theme.accentColor }}>
          <span className="flex items-center gap-1">
            {isCharging ? <BatteryCharging size={12} className="animate-pulse" /> : <Battery size={12} />}
            BATTERY MONITOR
          </span>
          <span 
            className="text-[9px] px-1 py-0.2 rounded border font-bold" 
            style={{ 
              borderColor: isCharging ? theme.successColor : theme.borderColor, 
              color: isCharging ? theme.successColor : theme.fg 
            }}
          >
            {batteryLevel}%
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] opacity-80 mb-2">
          <span>{isCharging ? '⚡ 45W Turbo PD' : 'Discharging'}</span>
          <span>{powerSaver ? 'Saver: ON' : 'Health: 98%'}</span>
        </div>
        <div 
          className="w-full py-1 text-center font-bold text-[10px] uppercase border tracking-wider transition-colors group-hover:bg-white/10"
          style={{ borderColor: isCharging ? theme.successColor : theme.accentColor, color: isCharging ? theme.successColor : theme.accentColor }}
        >
          [ BATTERY TELEMETRY ]
        </div>
      </div>

      {/* 4. Weather Service HUD Box */}
      <div
        id="hud-weather-service-box"
        onClick={() => onRunCommand('weather')}
        className="mt-auto p-3 border border-dashed cursor-pointer transition-all hover:bg-white/5"
        style={{
          borderColor: theme.borderColor,
          backgroundColor: `${theme.accentColor}08`,
        }}
        title="Click to view full terminal weather report"
      >
        <div className="text-[10px] uppercase font-bold tracking-wider mb-2 flex items-center justify-between" style={{ color: theme.promptColor }}>
          <span>WEATHER_SERVICE</span>
          <Radio size={12} className="animate-pulse" style={{ color: theme.successColor }} />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-2xl" style={{ color: theme.warningColor || '#ffcc00' }}>☁</div>
          <div>
            <div className="text-lg leading-none font-bold font-mono" style={{ color: theme.fg }}>
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
