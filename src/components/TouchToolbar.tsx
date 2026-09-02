/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Theme } from '../types';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CornerDownLeft, Sparkles, Grid, HelpCircle, X, Home } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface TouchToolbarProps {
  theme: Theme;
  soundEnabled: boolean;
  onKeyPress: (key: string) => void;
  onClear: () => void;
  onOpenApps: () => void;
  onOpenThemes: () => void;
  onOpenHelp: () => void;
  onOpenNotifications?: () => void;
  onOpenBattery?: () => void;
  onOpenDefaultLauncher?: () => void;
}

export const TouchToolbar: React.FC<TouchToolbarProps> = ({
  theme,
  soundEnabled,
  onKeyPress,
  onClear,
  onOpenApps,
  onOpenThemes,
  onOpenHelp,
  onOpenNotifications,
  onOpenBattery,
  onOpenDefaultLauncher,
}) => {
  const handleKeyClick = (keyVal: string) => {
    if (soundEnabled) {
      soundManager.playKeyClick('mechanical', 0.2);
    }
    onKeyPress(keyVal);
  };

  const quickKeys = [
    { label: 'ESC', action: () => handleKeyClick('Escape') },
    { label: 'TAB', action: () => handleKeyClick('Tab'), highlight: true },
    { label: 'Home', action: onOpenDefaultLauncher || (() => onKeyPress('set-default-launcher')), icon: <Home size={11} />, highlight: true },
    { label: 'Notif', action: onOpenNotifications || (() => onKeyPress('notifications')), highlight: false },
    { label: 'BAT', action: onOpenBattery || (() => onKeyPress('battery monitor')), highlight: false },
    { label: '↑', action: () => handleKeyClick('ArrowUp'), icon: <ArrowUp size={12} /> },
    { label: '↓', action: () => handleKeyClick('ArrowDown'), icon: <ArrowDown size={12} /> },
    { label: '|', action: () => handleKeyClick('|') },
    { label: '-', action: () => handleKeyClick('-') },
    { label: '/', action: () => handleKeyClick('/') },
    { label: '~', action: () => handleKeyClick('~') },
    { label: 'Apps', action: onOpenApps, icon: <Grid size={11} /> },
    { label: 'Themes', action: onOpenThemes, icon: <Sparkles size={11} /> },
    { label: 'Help', action: onOpenHelp, icon: <HelpCircle size={11} /> },
    { label: 'Clear', action: onClear, icon: <X size={11} /> },
  ];

  return (
    <div
      id="tui-touch-toolbar"
      className="w-full flex items-center overflow-x-auto no-scrollbar px-1 py-1 gap-1 border shrink-0 select-none font-mono"
      style={{
        backgroundColor: theme.cardBg,
        borderColor: theme.borderColor,
      }}
    >
      {quickKeys.map((item, i) => (
        <button
          key={i}
          id={`touch-key-${item.label.toLowerCase()}`}
          onClick={item.action}
          className="px-2 py-1 text-xs font-mono font-medium border flex items-center justify-center gap-1 shrink-0 active:scale-95 transition-all"
          style={{
            borderColor: theme.borderColor,
            backgroundColor: item.highlight ? `${theme.accentColor}20` : `${theme.bg}`,
            color: item.highlight ? theme.accentColor : theme.fg,
          }}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};
