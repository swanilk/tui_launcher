/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Theme } from '../types';
import { Search, X, Trash2, ArrowRight, Clock } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface HistorySearchModalProps {
  history: string[];
  theme: Theme;
  onSelectCommand: (cmd: string) => void;
  onClearHistory: () => void;
  onClose: () => void;
  soundEnabled: boolean;
}

export const HistorySearchModal: React.FC<HistorySearchModalProps> = ({
  history,
  theme,
  onSelectCommand,
  onClearHistory,
  onClose,
  soundEnabled,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredHistory = history
    .map((cmd, originalIndex) => ({ cmd, originalIndex }))
    .filter((item) => item.cmd.toLowerCase().includes(query.toLowerCase()))
    .reverse();

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (soundEnabled) soundManager.playKeyClick('mechanical', 0.15);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredHistory.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredHistory[selectedIndex]) {
        onSelectCommand(filteredHistory[selectedIndex].cmd);
        onClose();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      id="history-search-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        id="history-search-window"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[80vh] rounded-lg border shadow-2xl flex flex-col overflow-hidden font-mono text-xs md:text-sm"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.borderColor,
          color: theme.fg,
        }}
      >
        {/* Header Search Input */}
        <div className="p-3 border-b flex items-center gap-2" style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}>
          <Search size={16} style={{ color: theme.promptColor }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="(reverse-i-search)`': type command query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-inherit font-mono focus:outline-none"
            style={{ caretColor: theme.cursorColor }}
          />
          <button onClick={onClose} className="p-1 rounded hover:opacity-75">
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredHistory.length === 0 ? (
            <div className="p-6 text-center opacity-50">
              <Clock size={24} className="mx-auto mb-2 opacity-50" />
              <span>No matching command history found</span>
            </div>
          ) : (
            filteredHistory.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${item.originalIndex}-${item.cmd}`}
                  onClick={() => {
                    onSelectCommand(item.cmd);
                    onClose();
                  }}
                  className="px-3 py-2 rounded border flex items-center justify-between cursor-pointer transition-all"
                  style={{
                    backgroundColor: isSelected ? `${theme.accentColor}25` : theme.bg,
                    borderColor: isSelected ? theme.accentColor : theme.borderColor,
                    color: isSelected ? theme.accentColor : theme.fg,
                  }}
                >
                  <div className="flex items-center gap-2 font-mono truncate">
                    <span className="opacity-40 text-[10px]">#{item.originalIndex + 1}</span>
                    <span className="font-bold truncate">{item.cmd}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-70">
                    <ArrowRight size={12} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info & Clear button */}
        <div
          className="p-2 border-t flex items-center justify-between text-[11px] opacity-80 select-none"
          style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
        >
          <span>Use [↑/↓] to navigate, [Enter] to run, [Esc] to exit</span>
          <button
            onClick={() => {
              onClearHistory();
              onClose();
            }}
            className="flex items-center gap-1 text-rose-400 hover:opacity-80"
          >
            <Trash2 size={11} />
            <span>Clear History</span>
          </button>
        </div>
      </div>
    </div>
  );
};
