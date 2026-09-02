/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Theme, 
  TerminalLine, 
  LauncherConfig, 
  AndroidApp, 
  Alias, 
  CustomScript, 
  NoteItem, 
  TodoItem, 
  ContactItem, 
  RecentCall,
  ActiveTimer,
  BatteryTelemetry,
  AppNotification
} from './types';
import { DEFAULT_THEMES } from './data/themes';
import { DEFAULT_APPS } from './data/defaultApps';
import { 
  DEFAULT_CONFIG, 
  DEFAULT_ALIASES, 
  DEFAULT_SCRIPTS, 
  DEFAULT_NOTES, 
  DEFAULT_TODOS, 
  DEFAULT_CONTACTS,
  DEFAULT_RECENT_CALLS,
  DEFAULT_NOTIFICATIONS
} from './data/defaultData';
import { StatusBar } from './components/StatusBar';
import { CommandLine } from './components/CommandLine';
import { OutputView } from './components/OutputView';
import { TouchToolbar } from './components/TouchToolbar';
import { AppViewerModal } from './components/AppViewerModal';
import { NanoEditor } from './components/NanoEditor';
import { HistorySearchModal } from './components/HistorySearchModal';
import { ThemeSelectorModal } from './components/ThemeSelectorModal';
import { BatteryMonitorModal } from './components/BatteryMonitorModal';
import { MatrixScreen } from './components/MatrixScreen';
import { HighDensityHud } from './components/HighDensityHud';
import { CommandParser, CommandContext } from './utils/commandParser';
import { soundManager } from './utils/audio';

export default function App() {
  // 1. Persistent Launcher Configurations
  const [config, setConfig] = useState<LauncherConfig>(() => {
    try {
      const stored = localStorage.getItem('android_tui_config');
      return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('android_tui_config', JSON.stringify(config));
    } catch {}
  }, [config]);

  // 2. Persistent Command History
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('android_tui_history');
      return stored ? JSON.parse(stored) : ['neofetch', 'apps -f', 'weather', 'help'];
    } catch {
      return ['neofetch', 'apps -f', 'weather', 'help'];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('android_tui_history', JSON.stringify(history));
    } catch {}
  }, [history]);

  // 3. Persistent Apps
  const [apps, setApps] = useState<AndroidApp[]>(() => {
    try {
      const stored = localStorage.getItem('android_tui_apps');
      return stored ? JSON.parse(stored) : DEFAULT_APPS;
    } catch {
      return DEFAULT_APPS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('android_tui_apps', JSON.stringify(apps));
    } catch {}
  }, [apps]);

  // Persistent Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const stored = localStorage.getItem('android_tui_notifications');
      return stored ? JSON.parse(stored) : DEFAULT_NOTIFICATIONS;
    } catch {
      return DEFAULT_NOTIFICATIONS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('android_tui_notifications', JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  // 4. Persistent Aliases
  const [aliases, setAliases] = useState<Alias[]>(() => {
    try {
      const stored = localStorage.getItem('android_tui_aliases');
      return stored ? JSON.parse(stored) : DEFAULT_ALIASES;
    } catch {
      return DEFAULT_ALIASES;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('android_tui_aliases', JSON.stringify(aliases));
    } catch {}
  }, [aliases]);

  // 5. Persistent Custom Scripts
  const [scripts, setScripts] = useState<CustomScript[]>(() => {
    try {
      const stored = localStorage.getItem('android_tui_scripts');
      return stored ? JSON.parse(stored) : DEFAULT_SCRIPTS;
    } catch {
      return DEFAULT_SCRIPTS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('android_tui_scripts', JSON.stringify(scripts));
    } catch {}
  }, [scripts]);

  // 6. Persistent Notes
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const stored = localStorage.getItem('android_tui_notes');
      return stored ? JSON.parse(stored) : DEFAULT_NOTES;
    } catch {
      return DEFAULT_NOTES;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('android_tui_notes', JSON.stringify(notes));
    } catch {}
  }, [notes]);

  // 7. Persistent Todos
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    try {
      const stored = localStorage.getItem('android_tui_todos');
      return stored ? JSON.parse(stored) : DEFAULT_TODOS;
    } catch {
      return DEFAULT_TODOS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('android_tui_todos', JSON.stringify(todos));
    } catch {}
  }, [todos]);

  // 8. Persistent Contacts
  const [contacts, setContacts] = useState<ContactItem[]>(() => {
    try {
      const stored = localStorage.getItem('android_tui_contacts');
      return stored ? JSON.parse(stored) : DEFAULT_CONTACTS;
    } catch {
      return DEFAULT_CONTACTS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('android_tui_contacts', JSON.stringify(contacts));
    } catch {}
  }, [contacts]);

  // 8b. Persistent Recent Calls
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>(() => {
    try {
      const stored = localStorage.getItem('android_tui_recent_calls');
      return stored ? JSON.parse(stored) : DEFAULT_RECENT_CALLS;
    } catch {
      return DEFAULT_RECENT_CALLS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('android_tui_recent_calls', JSON.stringify(recentCalls));
    } catch {}
  }, [recentCalls]);

  // 9. Active Timers
  const [timers, setTimers] = useState<ActiveTimer[]>([]);

  // 10. Active Theme Object
  const currentTheme = useMemo(() => {
    const found = DEFAULT_THEMES.find((t) => t.id === config.activeThemeId);
    return found || DEFAULT_THEMES[0];
  }, [config.activeThemeId]);

  // 11. Terminal Output Lines
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'boot-1',
      timestamp: Date.now() - 3000,
      type: 'system',
      content: `[  OK  ] Mounted Android 15 Virtual Subsystem (aarch64)\n[  OK  ] Initialized Termux TUI Shell Environment\n[  OK  ] Loaded 14 applications & 7 shell aliases`,
    },
    {
      id: 'boot-2',
      timestamp: Date.now() - 2000,
      type: 'ascii',
      content: `
   ___           _           _     _   _____ _   _ _____ 
  / _ \\ _ __  __| |_ __ ___ (_) __| | |_   _| | | |_   _|
 / /_\\ \\ '_ \\/ _\` | '__/ _ \\| |/ _\` |   | | | | | | | |  
|  _  | | | | (_| | | | (_) | | (_| |   | | | |_| | | |  
|_| |_|_| |_|\\__,_|_|  \\___/|_|\\__,_|   |_|  \\___/  |_|  
`,
    },
    {
      id: 'boot-3',
      timestamp: Date.now() - 1000,
      type: 'help',
      content: `Type 'help' for available commands, 'apps' to explore applications, 'themes' to change visual style, or 'neofetch' for system info.
Press [Tab] anytime for auto-completion.`,
    },
  ]);

  // 12. Modal & View States
  const [activeAppModal, setActiveAppModal] = useState<AndroidApp | null>(null);
  const [activeNanoModal, setActiveNanoModal] = useState<{ filename: string; content: string } | null>(null);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isBatteryModalOpen, setIsBatteryModalOpen] = useState(false);
  const [isMatrixActive, setIsMatrixActive] = useState(false);

  // 13. Telemetry: Battery and Wifi
  const [batteryLevel, setBatteryLevel] = useState(87);
  const [isCharging, setIsCharging] = useState(false);
  const [powerSaver, setPowerSaver] = useState(false);
  const wifiSsid = 'AndroidNet_5GHz';

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        setIsCharging(battery.charging);

        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
        battery.addEventListener('chargingchange', () => {
          setIsCharging(battery.charging);
        });
      }).catch(() => {});
    }
  }, []);

  // Reactive Battery Telemetry Model for Monitor UI & CLI
  const batteryTelemetry: BatteryTelemetry = useMemo(() => ({
    level: batteryLevel,
    isCharging,
    chargingTime: isCharging ? Math.max(300, (100 - batteryLevel) * 27) : null,
    dischargingTime: !isCharging ? Math.floor((batteryLevel / 100) * 22 * 3600) : null,
    health: 'Good',
    temperatureC: isCharging ? 34.2 : 29.8,
    voltageMv: Math.round(3700 + (batteryLevel / 100) * 520),
    technology: 'Li-Polymer',
    designCapacityMah: 5000,
    currentCapacityMah: 4920,
    cycleCount: 148,
    currentMa: isCharging ? 4200 : (powerSaver ? -190 : -380),
    powerWatts: isCharging ? 18.5 : (powerSaver ? 0.78 : 1.6),
    chargingProtocol: isCharging ? 'USB-PD 3.1 PPS (45W Fast Turbo)' : 'None (Discharging)',
    powerSaver,
    history: [
      { time: '00:00', level: 98, power: 1.1 },
      { time: '04:00', level: 94, power: 0.9 },
      { time: '08:00', level: 88, power: 1.8 },
      { time: '12:00', level: 75, power: 2.3 },
      { time: '16:00', level: batteryLevel, power: isCharging ? 18.5 : (powerSaver ? 0.78 : 1.6) },
    ],
    appDrain: [
      { name: 'Display (165Hz HDR)', category: 'Hardware', percentage: powerSaver ? 14.2 : 28.5, mah: powerSaver ? 420 : 840 },
      { name: 'Android Terminal Launcher', category: 'App', percentage: 18.2, mah: 536 },
      { name: 'Wi-Fi 7 / 5G Radio', category: 'Hardware', percentage: 14.1, mah: 415 },
      { name: 'Snapdragon NPU / CPU', category: 'Hardware', percentage: 11.4, mah: 335 },
      { name: 'Audio Engine & Sensors', category: 'System', percentage: 6.8, mah: 200 },
    ],
  }), [batteryLevel, isCharging, powerSaver]);

  // 14. Timer countdown worker loop
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prevTimers) => {
        if (prevTimers.length === 0) return prevTimers;
        let changed = false;
        const next = prevTimers.map((timer) => {
          if (timer.isRunning && timer.remainingSeconds > 0) {
            changed = true;
            const updatedSec = timer.remainingSeconds - 1;
            if (updatedSec === 0) {
              soundManager.playAlarm(0.3);
              setLines((l) => [
                ...l,
                {
                  id: `alarm-${Date.now()}`,
                  timestamp: Date.now(),
                  type: 'success',
                  content: `🔔 TIMER COMPLETED: "${timer.label}" (${timer.totalSeconds}s)!`,
                },
              ]);
            }
            return { ...timer, remainingSeconds: updatedSec, isRunning: updatedSec > 0 };
          }
          return timer;
        });
        return changed ? next : prevTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 15. Command Execution Callback
  const handleExecuteCommand = useCallback(
    async (rawCommand: string) => {
      const trimmed = rawCommand.trim();
      if (!trimmed) return;

      // Append command to persistent history
      setHistory((prev) => {
        const filtered = prev.filter((cmd) => cmd !== trimmed);
        return [...filtered, trimmed].slice(-config.historyLimit);
      });

      // Prompt line entry
      const promptStr = `${config.promptUser}@${config.promptHost}:${config.promptSymbol}`;
      const inputLineId = `line-input-${Date.now()}`;

      setLines((prev) => [
        ...prev,
        {
          id: inputLineId,
          timestamp: Date.now(),
          type: 'input',
          prompt: promptStr,
          command: trimmed,
          content: trimmed,
        },
      ]);

      const commandContext: CommandContext = {
        config,
        setConfig,
        themes: DEFAULT_THEMES,
        currentTheme,
        setThemeId: (id: string) => setConfig((prev) => ({ ...prev, activeThemeId: id })),
        apps,
        setApps,
        aliases,
        setAliases,
        scripts,
        setScripts,
        notes,
        setNotes,
        todos,
        setTodos,
        contacts,
        setContacts,
        recentCalls,
        setRecentCalls,
        timers,
        setTimers,
        notifications,
        setNotifications,
        history,
        clearHistory: () => setHistory([]),
        clearTerminal: () => setLines([]),
        openAppModal: (app: AndroidApp) => setActiveAppModal(app),
        openNanoModal: (filename: string, content: string) => setActiveNanoModal({ filename, content }),
        openThemeModal: () => setIsThemeModalOpen(true),
        openHistoryModal: () => setIsHistoryModalOpen(true),
        openBatteryModal: () => setIsBatteryModalOpen(true),
        togglePowerSaver: () => setPowerSaver((p) => !p),
        setMatrixActive: (active: boolean) => setIsMatrixActive(active),
        batteryLevel,
        isCharging,
        batteryData: batteryTelemetry,
        wifiSsid,
      };

      try {
        const result = await CommandParser.execute(trimmed, commandContext);
        if (result) {
          if (result.clearScreen) {
            setLines([]);
          } else {
            setLines((prev) => [
              ...prev,
              {
                id: `res-${Date.now()}`,
                timestamp: Date.now(),
                type: result.type,
                content: result.content,
                metadata: result.metadata,
              },
            ]);
          }
        }
      } catch (err: any) {
        setLines((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            timestamp: Date.now(),
            type: 'error',
            content: `Execution error: ${err.message || String(err)}`,
          },
        ]);
      }
    },
    [config, currentTheme, apps, aliases, scripts, notes, todos, contacts, timers, history, batteryLevel, isCharging, wifiSsid, batteryTelemetry]
  );

  // 16. Touch Bar Key Injection
  const handleTouchKeyPress = (key: string) => {
    if (key === 'Escape') {
      setActiveAppModal(null);
      setActiveNanoModal(null);
      setIsThemeModalOpen(false);
      setIsHistoryModalOpen(false);
      setIsBatteryModalOpen(false);
      setIsMatrixActive(false);
      return;
    }

    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Tab') {
      const inputEl = document.getElementById('terminal-main-input') as HTMLInputElement | null;
      if (inputEl) {
        inputEl.focus();
        inputEl.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      }
      return;
    }

    // Insert character
    const inputEl = document.getElementById('terminal-main-input') as HTMLInputElement | null;
    if (inputEl) {
      inputEl.focus();
      const current = inputEl.value;
      inputEl.value = current + key;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  // Font class & size
  const fontStyleObj = {
    fontFamily: `${config.fontFamily}, monospace`,
  };

  const fontSizeClass = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  }[config.fontSize];

  return (
    <div
      id="android-terminal-launcher-root"
      className={`relative w-screen h-screen flex flex-col overflow-hidden select-none transition-colors ${fontSizeClass} ${
        config.crtGlow || currentTheme.crtGlow ? 'phosphor-glow' : ''
      }`}
      style={{
        backgroundColor: currentTheme.bg,
        color: currentTheme.fg,
        ...fontStyleObj,
      }}
    >
      {/* Optional CRT Scanlines Effect Overlay */}
      {(config.crtEffect || currentTheme.crtScanlines) && (
        <div className="absolute inset-0 crt-scanlines crt-vignette z-40 pointer-events-none" />
      )}

      {/* Top Android Status Bar */}
      {config.showStatusBar && (
        <StatusBar
          theme={currentTheme}
          config={config}
          batteryLevel={batteryLevel}
          isCharging={isCharging}
          powerSaver={powerSaver}
          wifiSsid={wifiSsid}
          onToggleSound={() => setConfig((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
          onToggleCrt={() => setConfig((prev) => ({ ...prev, crtEffect: !prev.crtEffect }))}
          onOpenThemeModal={() => setIsThemeModalOpen(true)}
          onOpenAppLauncher={() => handleExecuteCommand('apps')}
          onOpenNotifications={() => handleExecuteCommand('notifications')}
          onOpenBatteryModal={() => setIsBatteryModalOpen(true)}
        />
      )}

      {/* Main Terminal Output & High Density Aside HUD */}
      <main className="flex-1 flex gap-3 sm:gap-5 min-h-0 overflow-hidden px-2.5 sm:px-4 py-2">
        <section className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <OutputView
            lines={lines}
            theme={currentTheme}
            onRunQuickCommand={handleExecuteCommand}
            onOpenApp={(app) => {
              if (app.launchAction === 'command' && app.commandToRun) {
                handleExecuteCommand(app.commandToRun);
              } else {
                setActiveAppModal(app);
              }
            }}
            apps={apps}
          />
        </section>

        {/* High Density Aside HUD */}
        <HighDensityHud
          theme={currentTheme}
          apps={apps}
          aliases={aliases}
          notifications={notifications}
          onOpenApp={(app) => {
            if (app.launchAction === 'command' && app.commandToRun) {
              handleExecuteCommand(app.commandToRun);
            } else {
              setActiveAppModal(app);
            }
          }}
          onRunCommand={handleExecuteCommand}
          onOpenBatteryModal={() => setIsBatteryModalOpen(true)}
          batteryLevel={batteryLevel}
          isCharging={isCharging}
          powerSaver={powerSaver}
          soundEnabled={config.soundEnabled}
        />
      </main>

      {/* Footer Command Line and Mobile Touch Toolbar */}
      <div className="px-2.5 sm:px-4 pb-2.5 sm:pb-3 flex flex-col gap-1.5 shrink-0">
        <CommandLine
          theme={currentTheme}
          config={config}
          apps={apps}
          scripts={scripts}
          aliases={aliases}
          contacts={contacts}
          recentCalls={recentCalls}
          history={history}
          onSubmit={handleExecuteCommand}
          onClear={() => setLines([])}
          onOpenHistorySearch={() => setIsHistoryModalOpen(true)}
          onOpenThemeModal={() => setIsThemeModalOpen(true)}
        />

        {/* Bottom Mobile / Touch Keyboard Bar */}
        {config.showToolbar && (
          <TouchToolbar
            theme={currentTheme}
            soundEnabled={config.soundEnabled}
            onKeyPress={handleTouchKeyPress}
            onClear={() => setLines([])}
            onOpenApps={() => handleExecuteCommand('apps')}
            onOpenThemes={() => setIsThemeModalOpen(true)}
            onOpenHelp={() => handleExecuteCommand('help')}
            onOpenNotifications={() => handleExecuteCommand('notifications')}
            onOpenBattery={() => setIsBatteryModalOpen(true)}
          />
        )}
      </div>

      {/* App Viewer Modal */}
      {activeAppModal && (
        <AppViewerModal
          app={activeAppModal}
          theme={currentTheme}
          onClose={() => setActiveAppModal(null)}
          onRunTerminalCmd={handleExecuteCommand}
        />
      )}

      {/* Micro TUI Nano/Vim Text Editor Modal */}
      {activeNanoModal && (
        <NanoEditor
          filename={activeNanoModal.filename}
          initialContent={activeNanoModal.content}
          theme={currentTheme}
          soundEnabled={config.soundEnabled}
          onSave={(filename, newContent) => {
            // Update custom scripts if applicable
            setScripts((prev) => {
              const idx = prev.findIndex((s) => s.name === filename);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], content: newContent, updatedAt: Date.now() };
                return copy;
              }
              return [
                ...prev,
                {
                  id: `script-${Date.now()}`,
                  name: filename,
                  description: 'Custom shell script',
                  content: newContent,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                },
              ];
            });
          }}
          onClose={() => setActiveNanoModal(null)}
        />
      )}

      {/* Reverse History Search Modal (Ctrl+R) */}
      {isHistoryModalOpen && (
        <HistorySearchModal
          history={history}
          theme={currentTheme}
          soundEnabled={config.soundEnabled}
          onSelectCommand={(cmd) => handleExecuteCommand(cmd)}
          onClearHistory={() => setHistory([])}
          onClose={() => setIsHistoryModalOpen(false)}
        />
      )}

      {/* Theme Selector & Appearance Modal (Alt+T) */}
      {isThemeModalOpen && (
        <ThemeSelectorModal
          currentTheme={currentTheme}
          config={config}
          soundEnabled={config.soundEnabled}
          onSelectTheme={(themeId) => setConfig((prev) => ({ ...prev, activeThemeId: themeId }))}
          onUpdateConfig={setConfig}
          onClose={() => setIsThemeModalOpen(false)}
        />
      )}

      {/* Hardware Battery Telemetry & Diagnostics Modal */}
      {isBatteryModalOpen && (
        <BatteryMonitorModal
          telemetry={batteryTelemetry}
          theme={currentTheme}
          onClose={() => setIsBatteryModalOpen(false)}
          onTogglePowerSaver={() => setPowerSaver((p) => !p)}
          soundEnabled={config.soundEnabled}
        />
      )}

      {/* Matrix Digital Rain Screensaver */}
      {isMatrixActive && <MatrixScreen onExit={() => setIsMatrixActive(false)} />}
    </div>
  );
}
