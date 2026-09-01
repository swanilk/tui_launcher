/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Theme, LauncherConfig } from '../types';
import { DEFAULT_THEMES } from '../data/themes';
import { Palette, Sparkles, Check, X, Sliders, Volume2, Type } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface ThemeSelectorModalProps {
  currentTheme: Theme;
  config: LauncherConfig;
  onSelectTheme: (themeId: string) => void;
  onUpdateConfig: (fn: (prev: LauncherConfig) => LauncherConfig) => void;
  onClose: () => void;
  soundEnabled: boolean;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  currentTheme,
  config,
  onSelectTheme,
  onUpdateConfig,
  onClose,
  soundEnabled,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCustomizer, setShowCustomizer] = useState<boolean>(false);

  const categories = ['all', 'modern', 'crt', 'cyberpunk', 'retro', 'light'];

  const filteredThemes = DEFAULT_THEMES.filter(
    (t) => selectedCategory === 'all' || t.category === selectedCategory
  );

  const handlePickTheme = (id: string) => {
    if (soundEnabled) soundManager.playSuccess(0.2);
    onSelectTheme(id);
  };

  return (
    <div
      id="theme-selector-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        id="theme-selector-window"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[88vh] rounded-lg border shadow-2xl flex flex-col overflow-hidden font-mono text-xs md:text-sm"
        style={{
          backgroundColor: currentTheme.cardBg,
          borderColor: currentTheme.borderColor,
          color: currentTheme.fg,
        }}
      >
        {/* Header Bar */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ backgroundColor: currentTheme.bg, borderColor: currentTheme.borderColor }}
        >
          <div className="flex items-center gap-2">
            <Palette size={18} style={{ color: currentTheme.promptColor }} />
            <h2 className="font-bold text-sm">Themes & Terminal Appearance</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCustomizer(!showCustomizer)}
              className="px-2.5 py-1 rounded border flex items-center gap-1 hover:opacity-80 text-xs"
              style={{ borderColor: currentTheme.borderColor }}
            >
              <Sliders size={12} />
              <span>{showCustomizer ? 'Theme Grid' : 'Display & Font'}</span>
            </button>
            <button onClick={onClose} className="p-1 rounded hover:opacity-75">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!showCustomizer ? (
            <>
              {/* Category Filter Chips */}
              <div className="flex flex-wrap gap-1.5 pb-2 border-b" style={{ borderColor: currentTheme.borderColor }}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className="px-2.5 py-1 rounded-full text-xs uppercase font-bold transition-all"
                    style={{
                      backgroundColor: selectedCategory === cat ? currentTheme.promptColor : `${currentTheme.bg}`,
                      color: selectedCategory === cat ? '#000' : currentTheme.fg,
                      borderWidth: 1,
                      borderColor: currentTheme.borderColor,
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Theme Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredThemes.map((theme) => {
                  const isActive = theme.id === currentTheme.id;
                  return (
                    <div
                      key={theme.id}
                      id={`theme-card-${theme.id}`}
                      onClick={() => handlePickTheme(theme.id)}
                      className="p-3 rounded-lg border cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden group shadow-md"
                      style={{
                        backgroundColor: theme.bg,
                        borderColor: isActive ? theme.promptColor : theme.borderColor,
                        borderWidth: isActive ? 2 : 1,
                      }}
                    >
                      {/* Top row */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs" style={{ color: theme.promptColor }}>
                          {theme.name}
                        </span>
                        {isActive && (
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{ backgroundColor: theme.promptColor, color: '#000' }}
                          >
                            <Check size={10} />
                          </div>
                        )}
                      </div>

                      {/* Color Palette Palette Swatches */}
                      <div className="flex items-center gap-1.5 mb-2.5">
                        {[theme.bg, theme.cardBg, theme.promptColor, theme.accentColor, theme.errorColor, theme.successColor].map((col, i) => (
                          <div
                            key={i}
                            className="w-4 h-4 rounded-full border border-black/20"
                            style={{ backgroundColor: col }}
                          />
                        ))}
                      </div>

                      {/* Mini Terminal Preview */}
                      <div
                        className="p-2 rounded text-[10px] font-mono leading-tight border opacity-90"
                        style={{
                          backgroundColor: theme.cardBg,
                          borderColor: theme.borderColor,
                          color: theme.fg,
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <span style={{ color: theme.promptColor }}>u0@android:~$</span>
                          <span style={{ color: theme.accentColor }}>apps</span>
                        </div>
                        <div className="opacity-70 text-[9px] truncate">14 packages loaded.</div>
                      </div>

                      {/* Features badges */}
                      <div className="flex items-center gap-1 mt-2 text-[9px] opacity-60">
                        <span>{theme.fontFamily}</span>
                        {theme.crtScanlines && <span>• CRT Scanlines</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Terminal Display & Sound Options */
            <div className="space-y-4 max-w-lg mx-auto">
              <div className="p-3 rounded border space-y-3" style={{ backgroundColor: currentTheme.bg, borderColor: currentTheme.borderColor }}>
                <h3 className="font-bold text-xs flex items-center gap-1.5" style={{ color: currentTheme.promptColor }}>
                  <Type size={14} />
                  <span>Typography & Font Family</span>
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {(['JetBrains Mono', 'Fira Code', 'Share Tech Mono', 'VT323'] as const).map((font) => (
                    <button
                      key={font}
                      onClick={() => onUpdateConfig((prev) => ({ ...prev, fontFamily: font }))}
                      className="p-2 rounded border text-left text-xs transition-all"
                      style={{
                        borderColor: config.fontFamily === font ? currentTheme.accentColor : currentTheme.borderColor,
                        backgroundColor: config.fontFamily === font ? `${currentTheme.accentColor}20` : 'transparent',
                        fontFamily: font,
                      }}
                    >
                      {font}
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: currentTheme.borderColor }}>
                  <span className="text-xs">Font Size:</span>
                  <div className="flex gap-1">
                    {(['xs', 'sm', 'base', 'lg'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => onUpdateConfig((prev) => ({ ...prev, fontSize: size }))}
                        className="px-2 py-0.5 rounded border text-xs uppercase"
                        style={{
                          borderColor: config.fontSize === size ? currentTheme.promptColor : currentTheme.borderColor,
                          backgroundColor: config.fontSize === size ? `${currentTheme.promptColor}20` : 'transparent',
                        }}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sound & Feedback */}
              <div className="p-3 rounded border space-y-3" style={{ backgroundColor: currentTheme.bg, borderColor: currentTheme.borderColor }}>
                <h3 className="font-bold text-xs flex items-center gap-1.5" style={{ color: currentTheme.accentColor }}>
                  <Volume2 size={14} />
                  <span>Keystroke Sound & Audio Profile</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['mechanical', 'beep', 'modern', 'silent'] as const).map((sType) => (
                    <button
                      key={sType}
                      onClick={() => {
                        onUpdateConfig((prev) => ({ ...prev, soundType: sType, soundEnabled: sType !== 'silent' }));
                        soundManager.playKeyClick(sType, 0.2);
                      }}
                      className="p-2 rounded border text-center text-xs capitalize transition-all"
                      style={{
                        borderColor: config.soundType === sType ? currentTheme.promptColor : currentTheme.borderColor,
                        backgroundColor: config.soundType === sType ? `${currentTheme.promptColor}20` : 'transparent',
                      }}
                    >
                      {sType}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual Effects */}
              <div className="p-3 rounded border space-y-2" style={{ backgroundColor: currentTheme.bg, borderColor: currentTheme.borderColor }}>
                <h3 className="font-bold text-xs flex items-center gap-1.5" style={{ color: currentTheme.infoColor }}>
                  <Sparkles size={14} />
                  <span>Retro Visual FX</span>
                </h3>
                <div className="space-y-2">
                  <label className="flex items-center justify-between cursor-pointer text-xs">
                    <span>CRT Scanlines Filter</span>
                    <input
                      type="checkbox"
                      checked={config.crtEffect}
                      onChange={(e) => onUpdateConfig((prev) => ({ ...prev, crtEffect: e.target.checked }))}
                      className="rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer text-xs">
                    <span>Phosphor Bloom Glow</span>
                    <input
                      type="checkbox"
                      checked={config.crtGlow}
                      onChange={(e) => onUpdateConfig((prev) => ({ ...prev, crtGlow: e.target.checked }))}
                      className="rounded"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-3 border-t flex items-center justify-between text-xs"
          style={{ backgroundColor: currentTheme.bg, borderColor: currentTheme.borderColor }}
        >
          <span className="opacity-70">Tip: Change themes anytime with `theme &lt;name&gt;` or Alt+T.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded font-bold border hover:opacity-80"
            style={{ backgroundColor: currentTheme.promptColor, color: '#000', borderColor: currentTheme.promptColor }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
