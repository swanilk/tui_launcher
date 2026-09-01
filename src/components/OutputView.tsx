/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { TerminalLine, Theme, AndroidApp } from '../types';
import { Sparkles, Terminal, CheckCircle2, AlertCircle, Play, Info } from 'lucide-react';

interface OutputViewProps {
  lines: TerminalLine[];
  theme: Theme;
  onRunQuickCommand: (cmd: string) => void;
  onOpenApp: (app: AndroidApp) => void;
  apps: AndroidApp[];
}

export const OutputView: React.FC<OutputViewProps> = ({
  lines,
  theme,
  onRunQuickCommand,
  onOpenApp,
  apps,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when lines change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  const renderLineContent = (line: TerminalLine) => {
    switch (line.type) {
      case 'input':
        return (
          <div className="flex items-center gap-2 font-mono mt-3 mb-1 text-xs md:text-sm">
            <span style={{ color: theme.promptColor }} className="font-bold">
              {line.prompt ? (line.prompt.includes(':') ? line.prompt.split(':')[1].replace('$', '') : '~/launcher') : '~/launcher'}
            </span>
            <span className="text-white font-bold">$</span>
            <span className="font-bold tracking-wide" style={{ color: theme.warningColor || '#ffcc00' }}>
              {line.command}
            </span>
          </div>
        );

      case 'error':
        return (
          <div
            className="p-2 rounded border my-1 flex items-start gap-2 text-xs md:text-sm"
            style={{
              backgroundColor: `${theme.errorColor}15`,
              borderColor: `${theme.errorColor}50`,
              color: theme.errorColor,
            }}
          >
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <pre className="font-mono whitespace-pre-wrap break-all flex-1">{line.content}</pre>
          </div>
        );

      case 'success':
        return (
          <div
            className="p-2 rounded border my-1 flex items-start gap-2 text-xs md:text-sm"
            style={{
              backgroundColor: `${theme.successColor}15`,
              borderColor: `${theme.successColor}50`,
              color: theme.successColor,
            }}
          >
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
            <pre className="font-mono whitespace-pre-wrap break-all flex-1">{line.content}</pre>
          </div>
        );

      case 'help':
        return (
          <div
            className="p-3 rounded border my-1 text-xs md:text-sm font-mono leading-relaxed"
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.borderColor,
            }}
          >
            <pre className="whitespace-pre-wrap break-words">{line.content}</pre>
            <div className="mt-3 pt-2 border-t flex flex-wrap gap-1.5" style={{ borderColor: theme.borderColor }}>
              <span className="text-[11px] opacity-70 mr-1 flex items-center gap-1">
                <Sparkles size={11} /> Quick Launch:
              </span>
              {['apps -f', 'weather Tokyo', 'neofetch', 'themes', 'calc 50*12/3', 'notes', 'matrix'].map((cmd) => (
                <button
                  key={cmd}
                  id={`quick-cmd-${cmd.replace(/\s+/g, '-')}`}
                  onClick={() => onRunQuickCommand(cmd)}
                  className="px-2 py-0.5 rounded text-[11px] border hover:opacity-80 transition-opacity flex items-center gap-1"
                  style={{
                    borderColor: theme.borderColor,
                    backgroundColor: `${theme.accentColor}18`,
                    color: theme.accentColor,
                  }}
                >
                  <Play size={9} />
                  <span>{cmd}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 'app_list':
        return (
          <div
            className="p-3 rounded border my-1 text-xs md:text-sm font-mono"
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.borderColor,
            }}
          >
            <pre className="whitespace-pre-wrap break-words mb-3">{line.content}</pre>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-2 border-t" style={{ borderColor: theme.borderColor }}>
              {apps.map((app) => (
                <button
                  key={app.id}
                  id={`app-btn-${app.id}`}
                  onClick={() => onOpenApp(app)}
                  className="p-2 rounded border text-left hover:opacity-80 transition-all flex items-center gap-2 group"
                  style={{
                    backgroundColor: `${theme.bg}`,
                    borderColor: theme.borderColor,
                  }}
                >
                  <div
                    className="w-7 h-7 rounded flex items-center justify-center font-bold text-xs shrink-0"
                    style={{ backgroundColor: `${theme.accentColor}25`, color: theme.accentColor }}
                  >
                    {app.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-bold text-xs truncate" style={{ color: theme.fg }}>{app.name}</div>
                    <div className="text-[10px] opacity-60 truncate">{app.category}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 'ascii':
      case 'weather':
        return (
          <pre
            className="font-mono text-xs md:text-sm whitespace-pre-wrap break-words p-2 rounded my-1 overflow-x-auto"
            style={{
              color: line.type === 'ascii' ? theme.promptColor : theme.accentColor,
              backgroundColor: `${theme.cardBg}88`,
            }}
          >
            {line.content}
          </pre>
        );

      case 'system':
      case 'output':
      default:
        return (
          <pre className="font-mono text-xs md:text-sm whitespace-pre-wrap break-words my-1 leading-relaxed opacity-95">
            {line.content}
          </pre>
        );
    }
  };

  return (
    <div
      id="terminal-output-container"
      ref={containerRef}
      className="flex-1 w-full overflow-y-auto px-3 py-2 space-y-1.5 font-mono select-text"
      style={{
        color: theme.fg,
      }}
    >
      {/* High Density Session History Header */}
      <div 
        className="opacity-80 text-[10px] uppercase tracking-widest border-b pb-1 flex justify-between items-center select-none sticky top-0 backdrop-blur-sm z-10"
        style={{ borderColor: `${theme.borderColor}80`, backgroundColor: `${theme.bg}cc` }}
      >
        <span className="flex items-center gap-1.5 font-bold" style={{ color: theme.promptColor }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.promptColor }}></span>
          Session History
        </span>
        <span className="opacity-50 text-[9px] font-mono">
          TTY: /dev/pts/0 • {lines.length} events
        </span>
      </div>

      {/* Welcome Banner if empty or on start */}
      {lines.length === 0 && (
        <div className="py-8 text-center opacity-70">
          <Terminal size={32} className="mx-auto mb-2 opacity-50" style={{ color: theme.promptColor }} />
          <p className="text-xs">Android Terminal TUI Initialized. Type <span className="underline font-bold" style={{ color: theme.promptColor }}>help</span> or press <span className="font-bold">[Tab]</span> for command list.</p>
        </div>
      )}

      {lines.map((line) => (
        <div key={line.id} id={`line-${line.id}`}>
          {renderLineContent(line)}
        </div>
      ))}
    </div>
  );
};
