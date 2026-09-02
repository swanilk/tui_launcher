/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { TerminalLine, Theme, AndroidApp } from '../types';
import { Sparkles, Terminal, CheckCircle2, AlertCircle, Play, Info, Phone, PhoneCall, PhoneOutgoing, MessageSquare, RotateCw, Trash2, AppWindow } from 'lucide-react';

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

      case 'success': {
        if (line.metadata?.action === 'call') {
          const dialNumber = line.metadata.cleanPhone || line.metadata.phone;
          return (
            <div
              className="p-3 rounded border my-2 text-xs md:text-sm shadow-md font-mono flex flex-col gap-2.5"
              style={{
                backgroundColor: `${theme.successColor}12`,
                borderColor: `${theme.successColor}60`,
                color: theme.fg,
              }}
            >
              <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: `${theme.successColor}30` }}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center animate-pulse"
                    style={{ backgroundColor: `${theme.successColor}25`, color: theme.successColor }}
                  >
                    <PhoneOutgoing size={15} />
                  </div>
                  <div>
                    <div className="font-bold text-sm" style={{ color: theme.successColor }}>
                      {line.metadata.name || 'Direct Number'}
                    </div>
                    <div className="text-[11px] opacity-75 font-mono">
                      📞 {line.metadata.phone}
                    </div>
                  </div>
                </div>

                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${theme.successColor}25`, color: theme.successColor }}
                >
                  Calling...
                </span>
              </div>

              <pre className="font-mono whitespace-pre-wrap break-all text-[11px] opacity-85 leading-relaxed">
                {line.content}
              </pre>

              {/* Interactive Telephony Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-1 border-t" style={{ borderColor: `${theme.successColor}20` }}>
                <a
                  id={`dial-link-${line.id}`}
                  href={`tel:${dialNumber}`}
                  target="_top"
                  className="px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 border transition-transform hover:scale-105 active:scale-95 shadow-sm"
                  style={{
                    backgroundColor: theme.successColor,
                    borderColor: theme.successColor,
                    color: theme.bg,
                  }}
                >
                  <PhoneCall size={13} />
                  <span>Open Phone Dialer ({dialNumber})</span>
                </a>

                <button
                  type="button"
                  onClick={() => onRunQuickCommand(`call ${dialNumber}`)}
                  className="px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1 border hover:opacity-80 transition-opacity"
                  style={{
                    borderColor: `${theme.borderColor}80`,
                    backgroundColor: `${theme.cardBg}bb`,
                    color: theme.fg,
                  }}
                >
                  <RotateCw size={12} />
                  <span>Redial</span>
                </button>

                <button
                  type="button"
                  onClick={() => onRunQuickCommand(`sms ${dialNumber} `)}
                  className="px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1 border hover:opacity-80 transition-opacity"
                  style={{
                    borderColor: `${theme.borderColor}80`,
                    backgroundColor: `${theme.cardBg}bb`,
                    color: theme.fg,
                  }}
                >
                  <MessageSquare size={12} />
                  <span>Send SMS</span>
                </button>
              </div>
            </div>
          );
        }

        if (line.metadata?.action === 'uninstall') {
          const app = line.metadata.app as AndroidApp | undefined;
          return (
            <div
              className="p-3 rounded border my-2 text-xs md:text-sm shadow-md font-mono flex flex-col gap-2"
              style={{
                backgroundColor: `${theme.errorColor}10`,
                borderColor: `${theme.errorColor}50`,
                color: theme.fg,
              }}
            >
              <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: `${theme.errorColor}30` }}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${theme.errorColor}25`, color: theme.errorColor }}
                  >
                    <Trash2 size={15} />
                  </div>
                  <div>
                    <div className="font-bold text-sm" style={{ color: theme.errorColor }}>
                      {app?.name || 'Package Uninstalled'}
                    </div>
                    <div className="text-[11px] opacity-75 font-mono">
                      {app?.packageName || 'Android Package Manager'}
                    </div>
                  </div>
                </div>

                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${theme.errorColor}25`, color: theme.errorColor }}
                >
                  Removed
                </span>
              </div>

              <pre className="font-mono whitespace-pre-wrap break-all text-[11px] opacity-90 leading-relaxed">
                {line.content}
              </pre>

              <div className="flex flex-wrap gap-2 pt-1 border-t" style={{ borderColor: `${theme.errorColor}20` }}>
                <button
                  type="button"
                  onClick={() => onRunQuickCommand('apps')}
                  className="px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1 border hover:opacity-80 transition-opacity"
                  style={{
                    borderColor: `${theme.borderColor}80`,
                    backgroundColor: `${theme.cardBg}bb`,
                    color: theme.fg,
                  }}
                >
                  <AppWindow size={12} />
                  <span>View Installed Apps</span>
                </button>
              </div>
            </div>
          );
        }

        if (line.metadata?.action === 'open_app') {
          const app = line.metadata.app as AndroidApp | undefined;
          return (
            <div
              className="p-2.5 rounded border my-1.5 text-xs md:text-sm shadow-sm font-mono flex items-center justify-between gap-3"
              style={{
                backgroundColor: `${theme.accentColor}12`,
                borderColor: `${theme.accentColor}50`,
                color: theme.fg,
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-7 h-7 rounded flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${theme.accentColor}25`, color: theme.accentColor }}
                >
                  <Play size={14} />
                </div>
                <div className="min-w-0">
                  <div className="font-bold truncate" style={{ color: theme.accentColor }}>
                    Launching {app?.name || 'Application'}
                  </div>
                  <div className="text-[11px] opacity-75 truncate font-mono">
                    {app?.packageName || 'com.android.app'}
                  </div>
                </div>
              </div>

              {app && (
                <button
                  type="button"
                  onClick={() => onOpenApp(app)}
                  className="px-2.5 py-1 rounded text-xs font-mono shrink-0 flex items-center gap-1 border hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: theme.accentColor,
                    borderColor: theme.accentColor,
                    color: theme.bg,
                  }}
                >
                  <Play size={11} />
                  <span>Reopen</span>
                </button>
              )}
            </div>
          );
        }

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
      }

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
