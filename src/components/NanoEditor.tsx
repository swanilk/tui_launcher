/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Theme } from '../types';
import { virtualFS } from '../utils/fileSystem';
import { soundManager } from '../utils/audio';

interface NanoEditorProps {
  filename: string;
  initialContent: string;
  theme: Theme;
  onSave: (filename: string, content: string) => void;
  onClose: () => void;
  soundEnabled: boolean;
}

export const NanoEditor: React.FC<NanoEditorProps> = ({
  filename,
  initialContent,
  theme,
  onSave,
  onClose,
  soundEnabled,
}) => {
  const [content, setContent] = useState(initialContent);
  const [statusMessage, setStatusMessage] = useState(`[ Read ${initialContent.split('\n').length} lines ]`);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (soundEnabled) soundManager.playKeyClick('mechanical', 0.15);
    updateCursor(e.target);
  };

  const updateCursor = (el: HTMLTextAreaElement) => {
    const selStart = el.selectionStart;
    const textBefore = el.value.substring(0, selStart);
    const lines = textBefore.split('\n');
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    });
  };

  const handleSave = () => {
    virtualFS.writeFile(filename, content);
    onSave(filename, content);
    if (soundEnabled) soundManager.playSuccess(0.2);
    setStatusMessage(`[ Written ${content.length} bytes to ${filename} ]`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+O: WriteOut / Save
    if (e.ctrlKey && (e.key === 'o' || e.key === 'O')) {
      e.preventDefault();
      handleSave();
      return;
    }

    // Ctrl+X or Esc: Exit
    if ((e.ctrlKey && (e.key === 'x' || e.key === 'X')) || e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    // Tab key handling
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
        updateCursor(target);
      }, 0);
    }
  };

  const lines = content.split('\n');

  return (
    <div
      id="nano-editor-modal"
      className="fixed inset-0 z-50 flex flex-col font-mono text-xs md:text-sm select-none"
      style={{
        backgroundColor: theme.bg,
        color: theme.fg,
      }}
    >
      {/* Nano Header Bar */}
      <header
        className="w-full flex items-center justify-between px-3 py-1 text-xs font-bold border-b select-none shrink-0"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.borderColor,
        }}
      >
        <span style={{ color: theme.promptColor }}>GNU nano 8.0 (Android TUI)</span>
        <span className="font-bold">{filename}</span>
        <span className="opacity-70">{content.length} Bytes</span>
      </header>

      {/* Editor Body with Line Numbers */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Line numbers gutter */}
        <div
          className="py-2 px-2 text-right opacity-40 select-none border-r shrink-0 overflow-hidden font-mono text-xs"
          style={{
            backgroundColor: `${theme.cardBg}88`,
            borderColor: theme.borderColor,
            width: '48px',
          }}
        >
          {lines.map((_, idx) => (
            <div key={idx} className="leading-5">
              {idx + 1}
            </div>
          ))}
        </div>

        {/* Monospace Text Area */}
        <textarea
          id="nano-textarea"
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          onClick={(e) => updateCursor(e.currentTarget)}
          onKeyUp={(e) => updateCursor(e.currentTarget)}
          spellCheck="false"
          autoCapitalize="none"
          autoCorrect="off"
          className="flex-1 p-2 bg-transparent text-inherit font-mono text-xs md:text-sm leading-5 resize-none focus:outline-none overflow-y-auto whitespace-pre tab-size-2"
          style={{
            caretColor: theme.cursorColor,
          }}
        />
      </div>

      {/* Nano Status Line */}
      <div
        className="px-3 py-1 border-t text-xs font-mono flex items-center justify-between shrink-0"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.borderColor,
        }}
      >
        <span style={{ color: theme.accentColor }}>{statusMessage}</span>
        <span className="opacity-70">Line {cursorPos.line}, Col {cursorPos.col}</span>
      </div>

      {/* Nano Shortcuts Help Bar */}
      <footer
        className="grid grid-cols-3 sm:grid-cols-6 gap-1 p-1.5 border-t text-[11px] font-mono shrink-0 select-none"
        style={{
          backgroundColor: `${theme.cardBg}`,
          borderColor: theme.borderColor,
        }}
      >
        <button
          onClick={handleSave}
          className="p-1 rounded border hover:opacity-80 flex items-center gap-1 justify-center"
          style={{ borderColor: theme.borderColor, backgroundColor: `${theme.promptColor}20`, color: theme.promptColor }}
        >
          <strong className="font-bold">^O</strong> WriteOut
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded border hover:opacity-80 flex items-center gap-1 justify-center"
          style={{ borderColor: theme.borderColor, backgroundColor: `${theme.errorColor}20`, color: theme.errorColor }}
        >
          <strong className="font-bold">^X</strong> Exit
        </button>
        <button
          onClick={() => alert('Press Tab to indent. Scripts can be run with: run ' + filename)}
          className="p-1 rounded border hover:opacity-80 flex items-center gap-1 justify-center"
          style={{ borderColor: theme.borderColor }}
        >
          <strong className="font-bold">^G</strong> Help
        </button>
        <button
          onClick={() => setContent('')}
          className="p-1 rounded border hover:opacity-80 flex items-center gap-1 justify-center"
          style={{ borderColor: theme.borderColor }}
        >
          <strong className="font-bold">^K</strong> Clear All
        </button>
        <button
          onClick={() => {
            setContent((prev) => prev + '\necho "Script executed!"');
            setStatusMessage('[ Appended echo snippet ]');
          }}
          className="p-1 rounded border hover:opacity-80 flex items-center gap-1 justify-center"
          style={{ borderColor: theme.borderColor }}
        >
          <strong className="font-bold">+</strong> Add Line
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded border hover:opacity-80 flex items-center gap-1 justify-center"
          style={{ borderColor: theme.borderColor }}
        >
          <strong className="font-bold">Esc</strong> Back
        </button>
      </footer>
    </div>
  );
};
