/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Theme, LauncherConfig, AndroidApp, CustomScript, Alias } from '../types';
import { tokenizeCommand, KNOWN_COMMANDS } from '../utils/syntaxHighlight';
import { soundManager } from '../utils/audio';
import { virtualFS } from '../utils/fileSystem';

interface CommandLineProps {
  theme: Theme;
  config: LauncherConfig;
  apps: AndroidApp[];
  scripts: CustomScript[];
  aliases: Alias[];
  history: string[];
  onSubmit: (command: string) => void;
  onClear: () => void;
  onOpenHistorySearch: () => void;
  onOpenThemeModal: () => void;
}

export const CommandLine: React.FC<CommandLineProps> = ({
  theme,
  config,
  apps,
  scripts,
  aliases,
  history,
  onSubmit,
  onClear,
  onOpenHistorySearch,
  onOpenThemeModal,
}) => {
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [savedDraft, setSavedDraft] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState<number>(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Custom alias names
  const aliasNames = useMemo(() => aliases.map((a) => a.name), [aliases]);

  // Generate tokens for syntax highlighting
  const tokens = useMemo(() => tokenizeCommand(input, aliasNames), [input, aliasNames]);

  // Keep input focused
  useEffect(() => {
    if (config.autoFocusInput) {
      inputRef.current?.focus();
    }
  }, [config.autoFocusInput]);

  // All possible autocomplete candidates
  const allCandidates = useMemo(() => {
    const appNames = apps.map((a) => a.name.toLowerCase());
    const scriptNames = scripts.map((s) => s.name);
    const fsFiles = (virtualFS.listDir('.').files || []).map((f) => (f.type === 'dir' ? `${f.name}/` : f.name));
    const commandList = Array.from(KNOWN_COMMANDS);
    return Array.from(new Set([...commandList, ...aliasNames, ...appNames, ...scriptNames, ...fsFiles]));
  }, [apps, scripts, aliasNames]);

  // Calculate suggestions
  useEffect(() => {
    const trimmed = input.trimStart();
    if (!trimmed) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const words = trimmed.split(/\s+/);
    const lastWord = words[words.length - 1];

    if (words.length === 1) {
      // Autocompleting command or app name
      const matches = allCandidates
        .filter((c) => c.toLowerCase().startsWith(lastWord.toLowerCase()) && c.toLowerCase() !== lastWord.toLowerCase())
        .slice(0, 8);
      setSuggestions(matches);
      setSelectedSuggestionIdx(0);
      setShowSuggestions(matches.length > 0);
    } else {
      // Autocompleting arguments, files, or subcommands
      const prevWord = words[words.length - 2].toLowerCase();
      if (['open', 'launch', 'app'].includes(prevWord)) {
        const appMatches = apps
          .map((a) => a.name.toLowerCase())
          .filter((name) => name.startsWith(lastWord.toLowerCase()) && name !== lastWord.toLowerCase());
        setSuggestions(appMatches);
        setShowSuggestions(appMatches.length > 0);
      } else if (['cat', 'nano', 'vim', 'edit', 'run', 'rm', 'ls'].includes(prevWord)) {
        const fsFiles = (virtualFS.listDir('.').files || [])
          .map((f) => (f.type === 'dir' ? `${f.name}/` : f.name))
          .filter((f) => f.toLowerCase().startsWith(lastWord.toLowerCase()) && f !== lastWord);
        setSuggestions(fsFiles);
        setShowSuggestions(fsFiles.length > 0);
      } else if (prevWord === 'theme') {
        const themeMatches = ['matrix-crt', 'cyberpunk-2077', 'termux-green', 'dracula', 'nord', 'gruvbox-dark', 'amber-phosphor', 'catppuccin-mocha', 'monokai-pro', 'gameboy-retro']
          .filter((t) => t.startsWith(lastWord.toLowerCase()));
        setSuggestions(themeMatches);
        setShowSuggestions(themeMatches.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }
  }, [input, allCandidates, apps]);

  // Apply chosen suggestion
  const applySuggestion = (suggestion: string) => {
    const words = input.split(/\s+/);
    if (words.length <= 1) {
      setInput(suggestion + ' ');
    } else {
      words[words.length - 1] = suggestion;
      setInput(words.join(' ') + ' ');
    }
    setShowSuggestions(false);
    inputRef.current?.focus();
    if (config.soundEnabled) soundManager.playKeyClick(config.soundType, config.soundVolume);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Keystroke sound
    if (config.soundEnabled && e.key !== 'Enter') {
      soundManager.playKeyClick(config.soundType, config.soundVolume);
    }

    // Tab autocomplete
    if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length > 0) {
        applySuggestion(suggestions[selectedSuggestionIdx % suggestions.length]);
      }
      return;
    }

    // Arrow Navigation inside suggestions dropdown
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === input.length) {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === input.length) {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
    }

    // Command History traversal: Arrow Up / Down
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      if (historyIndex === null) {
        setSavedDraft(input);
        const newIndex = history.length - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex] || '');
      } else if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex] || '');
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === null) return;
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex] || '');
      } else {
        setHistoryIndex(null);
        setInput(savedDraft);
      }
      return;
    }

    // Ctrl Shortcuts
    if (e.ctrlKey) {
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        onClear();
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setInput('');
        setShowSuggestions(false);
        setHistoryIndex(null);
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        onOpenHistorySearch();
        return;
      }
    }

    // Alt Shortcuts
    if (e.altKey && (e.key === 't' || e.key === 'T')) {
      e.preventDefault();
      onOpenThemeModal();
      return;
    }

    // Submit on Enter
    if (e.key === 'Enter') {
      e.preventDefault();
      const toSend = input;
      if (config.soundEnabled) {
        soundManager.playEnter(config.soundType, config.soundVolume);
      }
      setInput('');
      setShowSuggestions(false);
      setHistoryIndex(null);
      onSubmit(toSend);
    }
  };

  // Color helper for token styling
  const getTokenColor = (tokenType: string) => {
    switch (tokenType) {
      case 'command':
        return theme.accentColor;
      case 'subcommand':
        return theme.infoColor;
      case 'flag':
        return theme.warningColor;
      case 'string':
        return theme.successColor;
      case 'variable':
        return theme.promptColor;
      case 'operator':
        return theme.errorColor;
      case 'number':
        return '#f97316'; // orange
      case 'path':
        return theme.infoColor;
      default:
        return theme.fg;
    }
  };

  const currentDisplayPath = virtualFS.getDisplayPwd();

  return (
    <div className="relative w-full shrink-0 font-mono text-sm">
      {/* Suggestions Autocomplete popup */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          id="autocomplete-suggestions"
          className="absolute bottom-full left-4 mb-2 max-w-md bg-opacity-95 backdrop-blur-md rounded border shadow-xl p-1.5 flex flex-wrap gap-1.5 z-30"
          style={{
            backgroundColor: theme.cardBg,
            borderColor: theme.borderColor,
            color: theme.fg,
          }}
        >
          <div className="w-full text-[10px] uppercase font-bold opacity-60 px-1 flex items-center justify-between border-b pb-1 mb-1" style={{ borderColor: theme.borderColor }}>
            <span>Tab Suggestions</span>
            <span>[Tab] to complete</span>
          </div>
          {suggestions.map((s, idx) => {
            const isSelected = idx === selectedSuggestionIdx;
            return (
              <button
                key={s}
                id={`suggestion-${s}`}
                onClick={() => applySuggestion(s)}
                className="px-2 py-0.5 text-xs rounded transition-all flex items-center gap-1"
                style={{
                  backgroundColor: isSelected ? theme.accentColor : `${theme.borderColor}40`,
                  color: isSelected ? theme.bg : theme.fg,
                  fontWeight: isSelected ? 'bold' : 'normal',
                }}
              >
                <span>{s}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Command Input Box - High Density Style */}
      <div
        id="command-line-box"
        onClick={() => inputRef.current?.focus()}
        className="w-full flex items-center gap-2 sm:gap-3 px-3 py-2.5 sm:py-3 border cursor-text transition-colors shadow-lg shrink-0"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.borderColor,
        }}
      >
        {/* Android Prompt Prefix: ~/directory ❯ or user@android:$ */}
        <div className="flex items-center gap-1.5 shrink-0 font-bold select-none text-xs md:text-sm">
          <span style={{ color: theme.promptColor }}>{currentDisplayPath.startsWith('~') ? currentDisplayPath : `~/${currentDisplayPath}`}</span>
          <span className="text-white">❯</span>
        </div>

        {/* Input Wrapper with live syntax highlighting layer */}
        <div className="relative flex-1 min-h-[22px] flex items-center overflow-hidden">
          {/* Syntax Highlighting Token Layer */}
          <div
            className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-all select-none flex items-center"
            aria-hidden="true"
          >
            {tokens.length === 0 ? (
              <span className="opacity-40 italic text-xs">type 'help', 'apps', 'weather', or command...</span>
            ) : (
              tokens.map((token, i) => (
                <span
                  key={i}
                  style={{
                    color: getTokenColor(token.type),
                    fontWeight: token.type === 'command' || token.type === 'operator' ? '600' : '400',
                  }}
                >
                  {token.text}
                </span>
              ))
            )}
            {/* Pulsing cursor block for High Density look */}
            <span
              className="inline-block w-2 h-4.5 animate-pulse ml-0.5"
              style={{ backgroundColor: theme.cursorColor }}
            />
          </div>

          {/* Actual transparent HTML input for seamless typing */}
          <input
            id="terminal-main-input"
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            className="w-full bg-transparent text-transparent caret-transparent focus:outline-none border-none p-0 font-mono text-sm leading-normal z-10"
            style={{
              caretColor: 'transparent',
            }}
          />
        </div>

        {/* Right side Line/Col Indicator */}
        <span className="text-[10px] opacity-40 shrink-0 font-mono hidden sm:inline select-none">
          L:{history.length + 1} C:{input.length}
        </span>
      </div>
    </div>
  );
};
