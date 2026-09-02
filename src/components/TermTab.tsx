/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { TerminalLine, Theme, AndroidApp } from '../types';
import { OutputView } from './OutputView';
import { 
  Terminal, 
  Trash2, 
  HelpCircle, 
  Sparkles, 
  Cpu, 
  Bluetooth, 
  BatteryCharging, 
  CloudSun, 
  Activity,
  ArrowDownCircle,
  Clock
} from 'lucide-react';
import { soundManager } from '../utils/audio';

interface TermTabProps {
  lines: TerminalLine[];
  theme: Theme;
  onRunQuickCommand: (cmd: string) => void;
  onOpenApp: (app: AndroidApp) => void;
  onClearTerminal: () => void;
  apps: AndroidApp[];
  soundEnabled: boolean;
}

export const TermTab: React.FC<TermTabProps> = ({
  lines,
  theme,
  onRunQuickCommand,
  onOpenApp,
  onClearTerminal,
  apps,
  soundEnabled,
}) => {
  const quickActions = [
    { label: 'Clear', cmd: 'clear', icon: <Trash2 size={11} /> },
    { label: 'Clock', cmd: 'clock', icon: <Clock size={11} /> },
    { label: 'Help', cmd: 'help', icon: <HelpCircle size={11} /> },
    { label: 'Neofetch', cmd: 'neofetch', icon: <Cpu size={11} /> },
    { label: 'Bluetooth', cmd: 'bluetooth', icon: <Bluetooth size={11} /> },
    { label: 'Battery', cmd: 'battery monitor', icon: <BatteryCharging size={11} /> },
    { label: 'Weather', cmd: 'weather', icon: <CloudSun size={11} /> },
    { label: 'Top', cmd: 'top', icon: <Activity size={11} /> },
  ];

  const handleQuickCmd = (cmd: string) => {
    if (soundEnabled) soundManager.playKeyClick('mechanical', 0.2);
    if (cmd === 'clear') {
      onClearTerminal();
    } else {
      onRunQuickCommand(cmd);
    }
  };

  return (
    <div 
      id="term-tab-container"
      className="flex-1 flex flex-col h-full min-h-0 overflow-hidden font-mono select-none"
      style={{ color: theme.fg }}
    >
      {/* Terminal Sub-header Bar with Session Info & Quick Actions */}
      <div 
        className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b shrink-0 text-xs"
        style={{ borderColor: theme.borderColor, backgroundColor: `${theme.cardBg}70` }}
      >
        <div className="flex items-center gap-2">
          <span 
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: theme.successColor }}
          />
          <span className="font-bold text-[11px] tracking-wide" style={{ color: theme.promptColor }}>
            tty1 • pts/0
          </span>
          <span className="text-[10px] opacity-60 hidden sm:inline">
            (bash 5.2 • android-arm64)
          </span>
          <span 
            className="text-[10px] px-1.5 py-0.2 rounded font-mono border"
            style={{ borderColor: `${theme.borderColor}80`, color: theme.fg }}
          >
            {lines.length} lines
          </span>
        </div>

        {/* Quick Command Chips */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {quickActions.map((action) => (
            <button
              key={action.cmd}
              type="button"
              onClick={() => handleQuickCmd(action.cmd)}
              className="px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 hover:scale-105 active:scale-95 transition-all shrink-0"
              style={{
                borderColor: `${theme.borderColor}90`,
                backgroundColor: `${theme.bg}`,
                color: action.cmd === 'clear' ? theme.errorColor : theme.fg,
              }}
              title={`Run '${action.cmd}'`}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Terminal Output View */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <OutputView
          lines={lines}
          theme={theme}
          onRunQuickCommand={onRunQuickCommand}
          onOpenApp={onOpenApp}
          apps={apps}
        />
      </div>
    </div>
  );
};
