/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  AppNotification,
  BluetoothState,
  HotspotState
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
  DEFAULT_NOTIFICATIONS,
  DEFAULT_BLUETOOTH_STATE,
  DEFAULT_HOTSPOT_STATE
} from './data/defaultData';
import { StatusBar, MainTabType } from './components/StatusBar';
import { CommandLine } from './components/CommandLine';
import { OutputView } from './components/OutputView';
import { TouchToolbar } from './components/TouchToolbar';
import { AppsTab } from './components/AppsTab';
import { NotifsTab } from './components/NotifsTab';
import { TermTab } from './components/TermTab';
import { NanoEditor } from './components/NanoEditor';
import { HistorySearchModal } from './components/HistorySearchModal';
import { ThemeSelectorModal } from './components/ThemeSelectorModal';
import { BatteryMonitorModal } from './components/BatteryMonitorModal';
import { CelestialClockModal, CelestialDateTimeSection } from './components/CelestialClock';
import { DefaultLauncherModal } from './components/DefaultLauncherModal';
import { MatrixScreen } from './components/MatrixScreen';
import { useSwipeGesture } from './hooks/useSwipeGesture';
import { CommandParser, CommandContext } from './utils/commandParser';
import { virtualFS } from './utils/fileSystem';
import { soundManager } from './utils/audio';
import { 
  getNativeInstalledApps, 
  launchNativeAndroidApp, 
  isNativeAndroidApp,
  getNativeActiveNotifications,
  isNativeNotificationAccessGranted,
  openNativeNotificationAccessSettings,
  dismissNativeNotification,
  subscribeToNativeNotifications
} from './utils/nativeLauncher';

export default function App() {
  // Active Main Tab: 'apps' | 'notifs' | 'term'
  const [activeTab, setActiveTab] = useState<MainTabType>('term');

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

  function deduplicateApps(appList: AndroidApp[]): AndroidApp[] {
  const seen = new Set<string>();
  const result: AndroidApp[] = [];
  for (const app of appList) {
    const pkg = (app.packageName || '').toLowerCase().trim();
    const id = (app.id || '').toLowerCase().trim();
    const name = (app.name || '').toLowerCase().trim();
    const key = pkg ? `pkg:${pkg}` : (id ? `id:${id}` : `name:${name}`);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(app);
  }
  return result;
}

  // 3. Persistent Apps
  const [apps, setApps] = useState<AndroidApp[]>(() => {
    try {
      const stored = localStorage.getItem('android_tui_apps');
      const list = stored ? JSON.parse(stored) : DEFAULT_APPS;
      return deduplicateApps(Array.isArray(list) ? list : DEFAULT_APPS);
    } catch {
      return DEFAULT_APPS;
    }
  });

  const [isSyncingApps, setIsSyncingApps] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('android_tui_apps', JSON.stringify(apps));
    } catch {}
  }, [apps]);

  // Synchronize real phone apps installed on device via Android PackageManager
  const handleSyncNativeApps = useCallback(async () => {
    setIsSyncingApps(true);
    try {
      const nativeApps = await getNativeInstalledApps();
      if (nativeApps && nativeApps.length > 0) {
        setApps((prev) => {
          const favoritePkgs = new Set(prev.filter((a) => a.favorite).map((a) => a.packageName));
          const merged = nativeApps.map((na) => ({
            ...na,
            favorite: favoritePkgs.has(na.packageName),
          }));
          return deduplicateApps(merged);
        });
        setLines((prev) => [
          ...prev,
          {
            id: `sync-${Date.now()}`,
            timestamp: Date.now(),
            type: 'success',
            content: `[✓] Successfully synchronized ${nativeApps.length} installed applications from Android device.`,
          },
        ]);
        return { success: true, count: nativeApps.length, message: `Synchronized ${nativeApps.length} apps.` };
      } else {
        if (!isNativeAndroidApp()) {
          setLines((prev) => [
            ...prev,
            {
              id: `sync-${Date.now()}`,
              timestamp: Date.now(),
              type: 'system',
              content: `[ℹ] Browser Sandbox Notice: Web browsers cannot query private phone applications.\nCompile and install the native Android APK via GitHub Actions to display 100% of your real phone apps!`,
            },
          ]);
        }
        return { success: false, count: 0, message: 'Web environment: use compiled APK on phone.' };
      }
    } catch (err: any) {
      console.warn('Native apps scan error:', err);
      return { success: false, count: 0, message: err?.message || 'Error scanning apps' };
    } finally {
      setIsSyncingApps(false);
    }
  }, []);

  // Auto-scan real phone apps when running inside the native APK
  useEffect(() => {
    if (isNativeAndroidApp()) {
      handleSyncNativeApps();
    }
  }, [handleSyncNativeApps]);

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

  const [isNotificationAccessGranted, setIsNotificationAccessGranted] = useState(true);
  const [isSyncingNotifications, setIsSyncingNotifications] = useState(false);

  // Synchronize notifications from native Android NotificationListenerService
  const handleSyncNotifications = useCallback(async () => {
    setIsSyncingNotifications(true);
    try {
      if (isNativeAndroidApp()) {
        const granted = await isNativeNotificationAccessGranted();
        setIsNotificationAccessGranted(granted);

        const nativeNotifs = await getNativeActiveNotifications();
        if (nativeNotifs && nativeNotifs.length > 0) {
          setNotifications((prev) => {
            const incomingIds = new Set(nativeNotifs.map((n) => n.id));
            const retained = prev.filter((n) => !incomingIds.has(n.id));
            return [...nativeNotifs, ...retained];
          });
        }
      }
    } catch (err) {
      console.warn('handleSyncNotifications error:', err);
    } finally {
      setIsSyncingNotifications(false);
    }
  }, []);

  // Real-time Android notification listener subscription
  useEffect(() => {
    if (isNativeAndroidApp()) {
      handleSyncNotifications();

      const unsubscribe = subscribeToNativeNotifications(
        (newNotif) => {
          setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
        },
        (removedId) => {
          setNotifications((prev) => prev.filter((n) => n.id !== removedId));
        }
      );

      return () => {
        unsubscribe();
      };
    }
  }, [handleSyncNotifications]);

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

  // 8c. Persistent Bluetooth State
  const [bluetoothState, setBluetoothState] = useState<BluetoothState>(() => {
    try {
      const stored = localStorage.getItem('android_tui_bluetooth');
      return stored ? JSON.parse(stored) : DEFAULT_BLUETOOTH_STATE;
    } catch {
      return DEFAULT_BLUETOOTH_STATE;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('android_tui_bluetooth', JSON.stringify(bluetoothState));
    } catch {}
  }, [bluetoothState]);

  // 8d. Persistent Hotspot State
  const [hotspotState, setHotspotState] = useState<HotspotState>(() => {
    try {
      const stored = localStorage.getItem('android_tui_hotspot');
      return stored ? JSON.parse(stored) : DEFAULT_HOTSPOT_STATE;
    } catch {
      return DEFAULT_HOTSPOT_STATE;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('android_tui_hotspot', JSON.stringify(hotspotState));
    } catch {}
  }, [hotspotState]);

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
      content: `[  OK  ] Mounted Android 15 Storage Subsystem (aarch64)\n[  OK  ] Initialized Termux TUI Shell Environment\n[  OK  ] Loaded 14 applications & 7 shell aliases`,
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
  const [activeNanoModal, setActiveNanoModal] = useState<{ filename: string; content: string } | null>(null);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isBatteryModalOpen, setIsBatteryModalOpen] = useState(false);
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);
  const [isDefaultLauncherModalOpen, setIsDefaultLauncherModalOpen] = useState(false);
  const [isMatrixActive, setIsMatrixActive] = useState(false);

  // 13. Telemetry: Battery and Wifi
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [isCharging, setIsCharging] = useState(false);
  const [powerSaver, setPowerSaver] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<{ isOnline: boolean; type: string }>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    type: typeof navigator !== 'undefined' && (navigator as any).connection?.effectiveType
      ? (navigator as any).connection.effectiveType.toUpperCase()
      : 'Broadband/Wi-Fi',
  });

  useEffect(() => {
    const updateNet = () => {
      const conn = (navigator as any).connection;
      const typeStr = conn?.effectiveType ? conn.effectiveType.toUpperCase() : (navigator.onLine ? 'Broadband/Wi-Fi' : 'Offline');
      setNetworkInfo({
        isOnline: navigator.onLine,
        type: typeStr,
      });
    };
    window.addEventListener('online', updateNet);
    window.addEventListener('offline', updateNet);
    if ((navigator as any).connection) {
      (navigator as any).connection.addEventListener('change', updateNet);
    }
    return () => {
      window.removeEventListener('online', updateNet);
      window.removeEventListener('offline', updateNet);
    };
  }, []);

  const wifiSsid = networkInfo.isOnline ? `Online (${networkInfo.type})` : 'Offline (No Connection)';

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

  // Global keyboard shortcuts for tab navigation (Ctrl+1, Ctrl+2, Ctrl+3)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.altKey) && e.key === '1') {
        e.preventDefault();
        setActiveTab('apps');
      } else if ((e.ctrlKey || e.altKey) && e.key === '2') {
        e.preventDefault();
        setActiveTab('notifs');
      } else if ((e.ctrlKey || e.altKey) && e.key === '3') {
        e.preventDefault();
        setActiveTab('term');
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  const executeCommandRef = useRef<(cmd: string) => void>(() => {});

  // Handle launching an application directly on the Android phone
  const handleLaunchApp = useCallback(
    async (app: AndroidApp) => {
      if (app.launchAction === 'command' && app.commandToRun) {
        executeCommandRef.current(app.commandToRun);
        return;
      }
      // Update lastUsed timestamp
      setApps((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, lastUsed: Date.now() } : a))
      );

      const res = await launchNativeAndroidApp(app);
      setLines((prev) => [
        ...prev,
        {
          id: `launch-${Date.now()}`,
          timestamp: Date.now(),
          type: res.success ? 'success' : 'system',
          content: `[✓] Launching ${app.name} (${app.packageName})...\n    Method: ${res.method} • ${res.message}`,
        },
      ]);
    },
    []
  );

  // 15. Command Execution Callback
  const handleExecuteCommand = useCallback(
    async (rawCommand: string) => {
      const trimmed = rawCommand.trim();
      if (!trimmed) return;

      // Automatically route tab view based on command:
      const cmdFirst = trimmed.split(' ')[0].toLowerCase();
      if (cmdFirst === 'apps' || cmdFirst === 'drawer' || (cmdFirst === 'tab' && trimmed.toLowerCase().includes('app'))) {
        setActiveTab('apps');
      } else if (cmdFirst === 'notifications' || cmdFirst === 'notifs' || cmdFirst === 'notif' || (cmdFirst === 'tab' && trimmed.toLowerCase().includes('notif'))) {
        setActiveTab('notifs');
      } else {
        // "All command output should appear in that tab." -> automatically switch to 'term' tab!
        setActiveTab('term');
      }

      // Append command to persistent history
      setHistory((prev) => {
        const filtered = prev.filter((cmd) => cmd !== trimmed);
        return [...filtered, trimmed].slice(-config.historyLimit);
      });

      // Prompt line entry
      const promptStr = `${config.promptUser}@${config.promptHost}:${virtualFS.getDisplayPwd()}${config.promptSymbol}`;
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
        bluetoothState,
        setBluetoothState,
        hotspotState,
        setHotspotState,
        timers,
        setTimers,
        notifications,
        setNotifications,
        history,
        clearHistory: () => setHistory([]),
        clearTerminal: () => setLines([]),
        openAppModal: handleLaunchApp,
        openNanoModal: (filename: string, content: string) => setActiveNanoModal({ filename, content }),
        openThemeModal: () => setIsThemeModalOpen(true),
        openHistoryModal: () => setIsHistoryModalOpen(true),
        openBatteryModal: () => setIsBatteryModalOpen(true),
        openClockModal: () => setIsClockModalOpen(true),
        openDefaultLauncherModal: () => setIsDefaultLauncherModalOpen(true),
        togglePowerSaver: () => setPowerSaver((p) => !p),
        setMatrixActive: (active: boolean) => setIsMatrixActive(active),
        activeTab,
        setActiveTab,
        batteryLevel,
        isCharging,
        batteryData: batteryTelemetry,
        wifiSsid,
        syncNativeApps: handleSyncNativeApps,
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
    [config, currentTheme, apps, aliases, scripts, notes, todos, contacts, recentCalls, bluetoothState, timers, history, batteryLevel, isCharging, wifiSsid, batteryTelemetry]
  );

  useEffect(() => {
    executeCommandRef.current = handleExecuteCommand;
  }, [handleExecuteCommand]);

  // 16. Touch Bar Key Injection
  const handleTouchKeyPress = (key: string) => {
    if (key === 'Escape') {
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
  }[config.fontSize] || 'text-sm';

  // Main tab order for horizontal swipe gestures: Apps <-> Notifs <-> Term
  const MAIN_TABS: MainTabType[] = ['apps', 'notifs', 'term'];

  const [swipeIndicator, setSwipeIndicator] = useState<{
    visible: boolean;
    label: string;
    direction: 'left' | 'right';
  }>({
    visible: false,
    label: '',
    direction: 'left',
  });
  const swipeIndicatorTimer = useRef<NodeJS.Timeout | null>(null);

  const showSwipeFeedback = useCallback((targetTab: MainTabType, direction: 'left' | 'right') => {
    const labelMap: Record<MainTabType, string> = {
      apps: 'APPS',
      notifs: 'NOTIFICATIONS',
      term: 'TERMINAL',
    };
    if (swipeIndicatorTimer.current) clearTimeout(swipeIndicatorTimer.current);
    setSwipeIndicator({
      visible: true,
      label: labelMap[targetTab],
      direction,
    });
    swipeIndicatorTimer.current = setTimeout(() => {
      setSwipeIndicator((prev) => ({ ...prev, visible: false }));
    }, 850);
  }, []);

  const handleSwipeLeft = useCallback(() => {
    setActiveTab((current) => {
      const idx = MAIN_TABS.indexOf(current);
      const nextIdx = (idx + 1) % MAIN_TABS.length;
      const nextTab = MAIN_TABS[nextIdx];
      if (config.soundEnabled) {
        soundManager.playKeyClick('mechanical', 0.2);
      }
      showSwipeFeedback(nextTab, 'left');
      return nextTab;
    });
  }, [config.soundEnabled, showSwipeFeedback]);

  const handleSwipeRight = useCallback(() => {
    setActiveTab((current) => {
      const idx = MAIN_TABS.indexOf(current);
      const nextIdx = (idx - 1 + MAIN_TABS.length) % MAIN_TABS.length;
      const nextTab = MAIN_TABS[nextIdx];
      if (config.soundEnabled) {
        soundManager.playKeyClick('mechanical', 0.2);
      }
      showSwipeFeedback(nextTab, 'right');
      return nextTab;
    });
  }, [config.soundEnabled, showSwipeFeedback]);

  const isAnyModalOpen =
    isThemeModalOpen ||
    isHistoryModalOpen ||
    isBatteryModalOpen ||
    isClockModalOpen ||
    isDefaultLauncherModalOpen ||
    isMatrixActive ||
    Boolean(activeNanoModal);

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 40,
    disabled: isAnyModalOpen,
  });

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

      {/* Top Android Status Bar with Apps, Notifs, and Term Tabs */}
      {config.showStatusBar && (
        <StatusBar
          theme={currentTheme}
          config={config}
          batteryLevel={batteryLevel}
          isCharging={isCharging}
          powerSaver={powerSaver}
          wifiSsid={wifiSsid}
          bluetoothState={bluetoothState}
          hotspotState={hotspotState}
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          appsCount={apps.length}
          notifsCount={notifications.length}
          termLinesCount={lines.length}
          onToggleSound={() => setConfig((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
          onToggleCrt={() => setConfig((prev) => ({ ...prev, crtEffect: !prev.crtEffect }))}
          onOpenThemeModal={() => setIsThemeModalOpen(true)}
          onOpenBatteryModal={() => setIsBatteryModalOpen(true)}
          onOpenClockModal={() => setIsClockModalOpen(true)}
          onOpenDefaultLauncherModal={() => setIsDefaultLauncherModalOpen(true)}
        />
      )}

      {/* 24-Hour Date, Time & Celestial Solar/Lunar Phase Section (90% Width) */}
      <CelestialDateTimeSection
        theme={currentTheme}
        config={config}
        onOpenModal={() => setIsClockModalOpen(true)}
      />

      {/* Main Tab Content View: Apps, Notifs, Term (Swipe left/right to navigate) */}
      <main
        {...swipeHandlers}
        className="flex-1 min-h-0 overflow-hidden px-2 sm:px-3 py-1 flex flex-col relative touch-pan-y"
      >
        {/* Floating Swipe Tab Switch Indicator */}
        {swipeIndicator.visible && (
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-3 py-1 rounded-full border text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-all animate-bounce"
            style={{
              borderColor: currentTheme.promptColor,
              backgroundColor: `${currentTheme.bg}f0`,
              color: currentTheme.promptColor,
              boxShadow: `0 0 12px ${currentTheme.promptColor}40`,
            }}
          >
            <span className="text-[10px] opacity-75">{swipeIndicator.direction === 'left' ? 'SWIPE ➔' : '◀ SWIPE'}</span>
            <span className="tracking-wider">{swipeIndicator.label}</span>
          </div>
        )}
        {activeTab === 'apps' && (
          <AppsTab
            theme={currentTheme}
            apps={apps}
            onOpenApp={handleLaunchApp}
            onRunCommand={handleExecuteCommand}
            onSyncApps={() => { handleSyncNativeApps(); }}
            isSyncing={isSyncingApps}
            onToggleFavorite={(appId) => {
              setApps((prev) =>
                prev.map((a) => (a.id === appId ? { ...a, favorite: !a.favorite } : a))
              );
            }}
            onUninstallApp={(app) => {
              handleExecuteCommand(`uninstall "${app.name}"`);
            }}
            onOpenDefaultLauncherModal={() => setIsDefaultLauncherModalOpen(true)}
            soundEnabled={config.soundEnabled}
          />
        )}

        {activeTab === 'notifs' && (
          <NotifsTab
            theme={currentTheme}
            notifications={notifications}
            onDismissNotification={(id) => {
              dismissNativeNotification(id);
              setNotifications((prev) => prev.filter((n) => n.id !== id));
            }}
            onClearAllNotifications={() => {
              setNotifications([]);
            }}
            onAddNotification={(notif) => {
              setNotifications((prev) => [notif, ...prev]);
            }}
            onRunCommand={handleExecuteCommand}
            onOpenApp={handleLaunchApp}
            apps={apps}
            soundEnabled={config.soundEnabled}
            onSyncNotifications={handleSyncNotifications}
            isSyncing={isSyncingNotifications}
            isAccessGranted={isNotificationAccessGranted}
            onOpenAccessSettings={openNativeNotificationAccessSettings}
          />
        )}

        {activeTab === 'term' && (
          <TermTab
            lines={lines}
            theme={currentTheme}
            onRunQuickCommand={handleExecuteCommand}
            onOpenApp={handleLaunchApp}
            onClearTerminal={() => setLines([])}
            apps={apps}
            soundEnabled={config.soundEnabled}
          />
        )}
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
          bluetoothState={bluetoothState}
          hotspotState={hotspotState}
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
            onOpenApps={() => setActiveTab('apps')}
            onOpenThemes={() => setIsThemeModalOpen(true)}
            onOpenHelp={() => handleExecuteCommand('help')}
            onOpenNotifications={() => setActiveTab('notifs')}
            onOpenBattery={() => setIsBatteryModalOpen(true)}
            onOpenDefaultLauncher={() => setIsDefaultLauncherModalOpen(true)}
          />
        )}
      </div>

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
          batteryData={batteryTelemetry}
          theme={currentTheme}
          onClose={() => setIsBatteryModalOpen(false)}
          onTogglePowerSaver={() => setPowerSaver((p) => !p)}
          onRunDiagnostic={() => {}}
          soundEnabled={config.soundEnabled}
        />
      )}

      {/* 24-Hour Celestial Clock, Calendar & Solar/Lunar Tracker Modal */}
      {isClockModalOpen && (
        <CelestialClockModal
          isOpen={isClockModalOpen}
          onClose={() => setIsClockModalOpen(false)}
          theme={currentTheme}
          config={config}
        />
      )}

      {/* Default Launcher Setup Wizard & PWA Home App Modal */}
      <DefaultLauncherModal
        isOpen={isDefaultLauncherModalOpen}
        onClose={() => setIsDefaultLauncherModalOpen(false)}
        theme={currentTheme}
        config={config}
        onUpdateConfig={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
        soundEnabled={config.soundEnabled}
      />

      {/* Matrix Digital Rain Screensaver */}
      {isMatrixActive && <MatrixScreen onExit={() => setIsMatrixActive(false)} />}
    </div>
  );
}
