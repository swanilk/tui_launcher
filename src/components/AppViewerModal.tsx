/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AndroidApp, Theme } from '../types';
import { 
  X, 
  Camera, 
  Calculator, 
  Globe, 
  Phone, 
  MessageSquare, 
  Folder, 
  Settings, 
  CloudSun, 
  Music, 
  FileText, 
  Image, 
  Users,
  Play,
  Pause,
  Send,
  Plus,
  Trash2,
  Maximize2
} from 'lucide-react';
import { virtualFS } from '../utils/fileSystem';

interface AppViewerModalProps {
  app: AndroidApp;
  theme: Theme;
  onClose: () => void;
  onRunTerminalCmd?: (cmd: string) => void;
}

export const AppViewerModal: React.FC<AppViewerModalProps> = ({
  app,
  theme,
  onClose,
  onRunTerminalCmd,
}) => {
  // App specific states
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [browserUrl, setBrowserUrl] = useState('https://developer.android.com');
  const [dialNumber, setDialNumber] = useState('');
  const [smsText, setSmsText] = useState('');
  const [smsHistory, setSmsHistory] = useState([
    { sender: 'System', text: 'Welcome to Android Terminal Launcher environment.' },
    { sender: 'Dev Ops', text: 'Kernel updated to Linux 6.6.21.' },
  ]);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);

  // Calculator helper
  const handleCalcPress = (btn: string) => {
    if (btn === 'C') {
      setCalcDisplay('0');
    } else if (btn === '=') {
      try {
        const res = Function(`"use strict"; return (${calcDisplay.replace(/×/g, '*').replace(/÷/g, '/')});`)();
        setCalcDisplay(String(res));
      } catch {
        setCalcDisplay('Error');
      }
    } else {
      setCalcDisplay((prev) => (prev === '0' || prev === 'Error' ? btn : prev + btn));
    }
  };

  // Dial pad helper
  const handleDialPress = (num: string) => {
    setDialNumber((prev) => prev + num);
  };

  const handleSendSms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsText.trim()) return;
    setSmsHistory((prev) => [...prev, { sender: 'You', text: smsText }]);
    setSmsText('');
  };

  return (
    <div
      id="app-viewer-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        id="app-viewer-window"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] rounded-lg border shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-mono"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.borderColor,
          color: theme.fg,
        }}
      >
        {/* App Title Bar */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{ backgroundColor: `${theme.bg}`, borderColor: theme.borderColor }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center font-bold text-xs"
              style={{ backgroundColor: `${theme.accentColor}30`, color: theme.accentColor }}
            >
              {app.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-sm leading-tight">{app.name}</h2>
              <span className="text-[10px] opacity-60">{app.packageName}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-neutral-800 transition-colors opacity-75 hover:opacity-100"
              title="Close Application (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* App Body Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 1. CALCULATOR */}
          {app.id === 'calculator' && (
            <div className="max-w-xs mx-auto space-y-3">
              <div
                className="p-4 rounded border text-right text-2xl font-bold font-mono overflow-x-auto"
                style={{ backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.accentColor }}
              >
                {calcDisplay}
              </div>
              <div className="grid grid-cols-4 gap-2 text-sm font-bold">
                {['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '%', '='].map((btn) => (
                  <button
                    key={btn}
                    onClick={() => handleCalcPress(btn)}
                    className="p-3 rounded border hover:opacity-80 active:scale-95 transition-all text-center"
                    style={{
                      backgroundColor: ['÷', '×', '-', '+', '='].includes(btn)
                        ? `${theme.accentColor}30`
                        : btn === 'C'
                        ? `${theme.errorColor}30`
                        : theme.bg,
                      borderColor: theme.borderColor,
                      color: btn === '=' ? theme.promptColor : theme.fg,
                    }}
                  >
                    {btn}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. CAMERA */}
          {app.id === 'camera' && (
            <div className="flex flex-col items-center justify-center space-y-4 py-6">
              <div
                className="w-full max-w-md aspect-video rounded-lg border flex flex-col items-center justify-center relative overflow-hidden"
                style={{ backgroundColor: '#050505', borderColor: theme.borderColor }}
              >
                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                  <Camera size={120} />
                </div>
                <div className="text-center z-10 space-y-2 p-4">
                  <div className="w-12 h-12 rounded-full border border-dashed animate-spin mx-auto flex items-center justify-center opacity-60" style={{ borderColor: theme.accentColor }}>
                    <Camera size={20} style={{ color: theme.accentColor }} />
                  </div>
                  <p className="text-xs font-bold" style={{ color: theme.promptColor }}>[ SIMULATED 50MP SONY IMX989 SENSOR ]</p>
                  <p className="text-[11px] opacity-60">ISO 100 | f/1.6 | 1/120s | RAW Mode</p>
                </div>
                {/* Viewfinder crosshairs */}
                <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2" style={{ borderColor: theme.accentColor }} />
                <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2" style={{ borderColor: theme.accentColor }} />
                <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2" style={{ borderColor: theme.accentColor }} />
                <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2" style={{ borderColor: theme.accentColor }} />
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => alert('Photo captured and saved to /sdcard/DCIM/IMG_20260901.jpg')}
                  className="w-14 h-14 rounded-full border-4 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg"
                  style={{ borderColor: theme.promptColor, backgroundColor: `${theme.promptColor}40` }}
                >
                  <div className="w-8 h-8 rounded-full" style={{ backgroundColor: theme.promptColor }} />
                </button>
              </div>
            </div>
          )}

          {/* 3. BROWSER */}
          {app.id === 'browser' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={browserUrl}
                  onChange={(e) => setBrowserUrl(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded border text-xs bg-transparent focus:outline-none"
                  style={{ borderColor: theme.borderColor, color: theme.fg }}
                />
                <button
                  onClick={() => window.open(browserUrl, '_blank')}
                  className="px-3 py-1.5 rounded text-xs font-bold border hover:opacity-80 flex items-center gap-1"
                  style={{ backgroundColor: `${theme.accentColor}25`, borderColor: theme.borderColor, color: theme.accentColor }}
                >
                  <Globe size={12} />
                  <span>Open URL</span>
                </button>
              </div>

              <div
                className="p-6 rounded border text-center space-y-3"
                style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
              >
                <Globe size={36} className="mx-auto opacity-60" style={{ color: theme.infoColor }} />
                <h3 className="font-bold text-sm">Android Web Engine Viewport</h3>
                <p className="text-xs opacity-75 max-w-sm mx-auto">
                  Type any URL in terminal using <code className="px-1.5 py-0.5 rounded bg-neutral-800" style={{ color: theme.promptColor }}>open https://...</code> or search with <code className="px-1.5 py-0.5 rounded bg-neutral-800" style={{ color: theme.accentColor }}>google &lt;query&gt;</code>.
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  {['GitHub', 'Termux Wiki', 'Arch Linux', 'Reddit', 'HackerNews'].map((site) => (
                    <button
                      key={site}
                      onClick={() => setBrowserUrl(`https://www.google.com/search?q=${site}`)}
                      className="px-2 py-1 rounded text-[11px] border hover:opacity-80"
                      style={{ borderColor: theme.borderColor }}
                    >
                      {site}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. PHONE DIALER */}
          {app.id === 'phone' && (
            <div className="max-w-xs mx-auto space-y-4">
              <div
                className="p-3 rounded border text-center text-xl font-bold font-mono min-h-[48px] flex items-center justify-center"
                style={{ backgroundColor: theme.bg, borderColor: theme.borderColor, color: theme.promptColor }}
              >
                {dialNumber || <span className="opacity-40 text-sm font-normal">Enter phone number...</span>}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                  <button
                    key={digit}
                    onClick={() => handleDialPress(digit)}
                    className="p-3 rounded border text-center font-bold text-base hover:opacity-80 active:scale-95 transition-all"
                    style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
                  >
                    {digit}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    alert(`Calling ${dialNumber}... Simulated 5G VoLTE.`);
                  }}
                  disabled={!dialNumber}
                  className="flex-1 py-2.5 rounded font-bold text-xs flex items-center justify-center gap-1.5 border hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: theme.successColor, color: '#000', borderColor: theme.successColor }}
                >
                  <Phone size={14} />
                  <span>Call Number</span>
                </button>
                <button
                  onClick={() => setDialNumber((prev) => prev.slice(0, -1))}
                  className="p-2.5 rounded border hover:opacity-80"
                  style={{ borderColor: theme.borderColor }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )}

          {/* 5. MESSAGES */}
          {app.id === 'messages' && (
            <div className="space-y-3 flex flex-col h-[340px]">
              <div className="flex-1 overflow-y-auto space-y-2 p-2 rounded border" style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}>
                {smsHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded max-w-[80%] text-xs ${
                      item.sender === 'You' ? 'ml-auto text-right' : 'mr-auto text-left'
                    }`}
                    style={{
                      backgroundColor: item.sender === 'You' ? `${theme.accentColor}30` : `${theme.cardBg}`,
                      borderColor: theme.borderColor,
                      borderWidth: 1,
                    }}
                  >
                    <div className="text-[10px] font-bold opacity-60">{item.sender}</div>
                    <div>{item.text}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendSms} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type an SMS message..."
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded border text-xs bg-transparent focus:outline-none"
                  style={{ borderColor: theme.borderColor, color: theme.fg }}
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded border text-xs font-bold flex items-center gap-1 hover:opacity-80"
                  style={{ backgroundColor: theme.promptColor, color: '#000', borderColor: theme.promptColor }}
                >
                  <Send size={12} />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}

          {/* 6. FILE MANAGER */}
          {app.id === 'files' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b" style={{ borderColor: theme.borderColor }}>
                <span>📁 Current Path: <strong>{virtualFS.getPwd()}</strong></span>
                <button
                  onClick={() => {
                    virtualFS.resetFS();
                    alert('Filesystem restored to initial state.');
                  }}
                  className="text-[10px] px-2 py-0.5 rounded border opacity-75 hover:opacity-100"
                  style={{ borderColor: theme.borderColor }}
                >
                  Reset FS
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(virtualFS.listDir('.').files || []).map((file) => (
                  <div
                    key={file.name}
                    className="p-2.5 rounded border flex items-center justify-between text-xs"
                    style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
                  >
                    <div className="flex items-center gap-2">
                      {file.type === 'dir' ? <Folder size={14} style={{ color: theme.accentColor }} /> : <FileText size={14} style={{ color: theme.infoColor }} />}
                      <span className="font-bold">{file.name}</span>
                    </div>
                    <span className="text-[10px] opacity-60">
                      {file.type === 'dir' ? `${file.children?.length || 0} items` : `${file.size || 0} B`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. MUSIC */}
          {app.id === 'music' && (
            <div className="p-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-full border-2 mx-auto flex items-center justify-center animate-pulse" style={{ borderColor: theme.accentColor, backgroundColor: `${theme.accentColor}20` }}>
                <Music size={32} style={{ color: theme.accentColor }} />
              </div>
              <div>
                <h3 className="font-bold text-sm">Retro Synth & Lo-Fi Chillwave</h3>
                <p className="text-xs opacity-60">Android TUI Audio Daemon</p>
              </div>
              <button
                onClick={() => setIsPlayingMusic(!isPlayingMusic)}
                className="px-4 py-2 rounded-full border text-xs font-bold inline-flex items-center gap-2 hover:opacity-80 transition-all"
                style={{ backgroundColor: theme.accentColor, color: '#000', borderColor: theme.accentColor }}
              >
                {isPlayingMusic ? <Pause size={14} /> : <Play size={14} />}
                <span>{isPlayingMusic ? 'Pause Ambient Synth' : 'Play Ambient Synth'}</span>
              </button>
            </div>
          )}

          {/* 8. SETTINGS & OTHER APPS */}
          {app.id === 'settings' && (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded border space-y-2" style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}>
                <h4 className="font-bold text-sm flex items-center gap-1.5" style={{ color: theme.promptColor }}>
                  <Settings size={14} />
                  <span>Android Subsystem Parameters</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 opacity-85">
                  <div><strong>Build:</strong> Android 15 TUI-6.6</div>
                  <div><strong>Architecture:</strong> aarch64 (ARMv9)</div>
                  <div><strong>Storage:</strong> 512 GB UFS 4.0</div>
                  <div><strong>RAM:</strong> 12 GB LPDDR5X</div>
                  <div><strong>Shell:</strong> Bash 5.2 (Termux)</div>
                  <div><strong>Security:</strong> SELinux Permissive</div>
                </div>
              </div>
            </div>
          )}

          {/* 9. DEFAULT FALLBACK FOR OTHER APPS */}
          {!['calculator', 'camera', 'browser', 'phone', 'messages', 'files', 'music', 'settings'].includes(app.id) && (
            <div className="p-8 text-center space-y-3">
              <div
                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center font-bold text-xl border"
                style={{ backgroundColor: `${theme.accentColor}25`, borderColor: theme.borderColor, color: theme.accentColor }}
              >
                {app.name.slice(0, 2).toUpperCase()}
              </div>
              <h3 className="font-bold text-base">{app.name}</h3>
              <p className="text-xs opacity-75 max-w-md mx-auto">{app.description}</p>
              <div className="text-[11px] opacity-60">Package: {app.packageName}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
