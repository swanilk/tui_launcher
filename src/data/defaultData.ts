/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Alias, CustomScript, LauncherConfig, NoteItem, TodoItem, ContactItem, VirtualFile, AppNotification } from '../types';

export const DEFAULT_CONFIG: LauncherConfig = {
  promptUser: 'u0_a284',
  promptHost: 'android',
  promptSymbol: '$',
  fontSize: 'sm',
  fontFamily: 'JetBrains Mono',
  activeThemeId: 'high-density',
  showStatusBar: true,
  showToolbar: true,
  crtEffect: false,
  crtGlow: false,
  soundEnabled: true,
  soundVolume: 0.25,
  soundType: 'mechanical',
  clock24h: true,
  cursorStyle: 'block',
  cursorBlink: true,
  autoFocusInput: true,
  historyLimit: 200,
};

export const DEFAULT_ALIASES: Alias[] = [
  { name: 'll', command: 'ls -la' },
  { name: 'cls', command: 'clear' },
  { name: 'fetch', command: 'neofetch' },
  { name: 'favs', command: 'apps -f' },
  { name: 'matrix', command: 'matrix' },
  { name: 'sys', command: 'sysinfo' },
  { name: 'calc', command: 'calc' },
];

export const DEFAULT_SCRIPTS: CustomScript[] = [
  {
    id: 'script-morning',
    name: 'morning.sh',
    description: 'Displays system status, daily greeting, weather, and active todos',
    content: `# Morning briefing script
echo "=== 🌅 GOOD MORNING SYSTEM REPORT ==="
date
weather Tokyo
todo ls
battery`,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'script-diag',
    name: 'diag.sh',
    description: 'Diagnose network, battery, memory, and devices',
    content: `# Android System Diagnostics
echo "[*] Checking Android subsystem..."
wifi
battery
sysinfo
echo "[+] Diagnostic checks passed (0 errors)"`,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'script-clean',
    name: 'clean.sh',
    description: 'Clean cache and display memory freed',
    content: `# Cache cleaner simulation
echo "[*] Clearing cached dalvik bytecode..."
echo "[*] Dropping unlinked inodes..."
echo "[✓] Cache cleared. 428 MB freed!"`,
    createdAt: Date.now() - 3600000 * 5,
    updatedAt: Date.now() - 3600000 * 5,
  },
];

export const DEFAULT_NOTES: NoteItem[] = [
  {
    id: 'note-1',
    title: 'Terminal Launcher Shortcuts',
    content: 'Press Tab for autocomplete, Up/Down for command history, Ctrl+R to reverse search history, Alt+T for themes!',
    timestamp: Date.now() - 3600000 * 12,
  },
  {
    id: 'note-2',
    title: 'Termux Packages',
    content: 'pkg install git zsh neovim clang rust nodejs python tmux fzf',
    timestamp: Date.now() - 3600000 * 48,
  },
];

export const DEFAULT_TODOS: TodoItem[] = [
  { id: 'todo-1', text: 'Customize terminal prompt style in config', completed: true, createdAt: Date.now() - 86400000 },
  { id: 'todo-2', text: 'Try out Cyberpunk Neon and Matrix CRT themes', completed: false, createdAt: Date.now() - 43200000 },
  { id: 'todo-3', text: 'Create custom shell script using nano editor', completed: false, createdAt: Date.now() - 10800000 },
];

export const DEFAULT_CONTACTS: ContactItem[] = [
  { id: 'c-1', name: 'Alex Rivera (Dev Lead)', phone: '+1-555-0192', email: 'alex@techcorp.io' },
  { id: 'c-2', name: 'Dr. Sarah Connor', phone: '+1-555-8392', email: 'sarah@cyberdyne.org' },
  { id: 'c-3', name: 'Elena Rostova', phone: '+44-20-7946-0912', email: 'elena@matrix.net' },
  { id: 'c-4', name: 'Emergency Support Hotline', phone: '9614044766', email: 'support@android-tui.dev' },
  { id: 'c-5', name: 'DevOps On-Call', phone: '+1-800-555-0199', email: 'ops@terminal.local' },
];

export const INITIAL_FILESYSTEM: VirtualFile[] = [
  {
    name: 'home',
    type: 'dir',
    updatedAt: Date.now(),
    children: [
      {
        name: 'u0_a284',
        type: 'dir',
        updatedAt: Date.now(),
        children: [
          {
            name: 'scripts',
            type: 'dir',
            updatedAt: Date.now(),
            children: [
              {
                name: 'morning.sh',
                type: 'file',
                content: '# Morning briefing\necho "Good morning!"\nweather\ntodo ls',
                size: 58,
                updatedAt: Date.now(),
              },
              {
                name: 'diag.sh',
                type: 'file',
                content: '# Diagnostics\nwifi\nbattery\nsysinfo',
                size: 38,
                updatedAt: Date.now(),
              }
            ]
          },
          {
            name: 'dist',
            type: 'dir',
            updatedAt: Date.now(),
            children: [
              {
                name: 'AndroidTerminalLauncher-v16.0.0-release.apk',
                type: 'file',
                content: '[Android 16 APK Binary Package (API 36 Baklava, V3 Signed, 16KB Page Aligned)]',
                size: 894200,
                updatedAt: Date.now(),
              }
            ]
          },
          {
            name: 'notes.txt',
            type: 'file',
            content: 'Terminal Launcher features:\n- Full TUI navigation\n- Syntax highlighting\n- Persistent history\n- Custom scripts & themes',
            size: 112,
            updatedAt: Date.now(),
          },
          {
            name: 'readme.md',
            type: 'file',
            content: '# Android Terminal Launcher TUI\nWelcome to your keyboard-driven mobile environment!\nType `help` to see all available commands.',
            size: 135,
            updatedAt: Date.now(),
          },
          {
            name: '.bashrc',
            type: 'file',
            content: '# User environment config\nexport PS1="u0_a284@android:~$ "\nalias ll="ls -la"\nalias cls="clear"',
            size: 89,
            updatedAt: Date.now(),
          }
        ]
      }
    ]
  },
  {
    name: 'sdcard',
    type: 'dir',
    updatedAt: Date.now(),
    children: [
      {
        name: 'Download',
        type: 'dir',
        updatedAt: Date.now(),
        children: [
          {
            name: 'AndroidTerminalLauncher-v16.0.0-release.apk',
            type: 'file',
            content: '[Android 16 APK Sideload Package (API 36 Baklava, V3 Signed, 16KB Page Aligned)]',
            size: 894200,
            updatedAt: Date.now(),
          },
          {
            name: 'wallpaper.png',
            type: 'file',
            content: '[Binary PNG Image Data]',
            size: 2048500,
            updatedAt: Date.now(),
          }
        ]
      },
      {
        name: 'DCIM',
        type: 'dir',
        updatedAt: Date.now(),
        children: []
      }
    ]
  }
];

export const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-battery-1',
    appId: 'settings',
    appName: 'Battery & Power',
    packageName: 'com.android.settings.fuelgauge',
    title: 'Adaptive Battery Optimizer',
    message: 'Background power restriction applied to 4 idle tasks. +1h 45m battery saved.',
    timestamp: Date.now() - 1000 * 60 * 42,
    priority: 'low',
    actionCommand: 'battery monitor',
    actionLabel: 'Battery Telemetry',
  },
  {
    id: 'notif-system-1',
    appId: 'settings',
    appName: 'Android Settings',
    packageName: 'com.android.settings',
    title: 'Security Patch Level',
    message: 'September 2026 Android 16 Baklava security bulletin verified (0 vulnerabilities).',
    timestamp: Date.now() - 1000 * 60 * 25,
    priority: 'normal',
    actionCommand: 'open settings',
    actionLabel: 'Settings',
  },
  {
    id: 'notif-phone-1',
    appId: 'phone',
    appName: 'Phone',
    packageName: 'com.android.dialer',
    title: 'Missed Call',
    message: 'Alex Rivera (+1-555-0192) - 2 rings (VoLTE HD Voice)',
    timestamp: Date.now() - 1000 * 60 * 18,
    priority: 'high',
    actionCommand: 'call Alex',
    actionLabel: 'Call Back',
  },
  {
    id: 'notif-terminal-1',
    appId: 'terminal',
    appName: 'Termux TUI Core',
    packageName: 'com.termux',
    title: 'Cron Job Completed',
    message: 'Scheduled backup synced /home/u0_a284/scripts (3 files, 0 errors).',
    timestamp: Date.now() - 1000 * 60 * 12,
    priority: 'normal',
    actionCommand: 'open terminal',
    actionLabel: 'View Shell',
  },
  {
    id: 'notif-weather-1',
    appId: 'weather',
    appName: 'Weather',
    packageName: 'com.android.weather',
    title: 'Precipitation Alert',
    message: 'Scattered light showers expected in 45 minutes (18°C / 64°F, 65% humidity).',
    timestamp: Date.now() - 1000 * 60 * 6,
    priority: 'normal',
    actionCommand: 'weather Tokyo',
    actionLabel: 'Radar Map',
  },
  {
    id: 'notif-msg-1',
    appId: 'messages',
    appName: 'Messages',
    packageName: 'com.android.mms',
    title: 'Dr. Sarah Connor',
    message: 'Server migration completed. Ready for security audit on port 3000.',
    timestamp: Date.now() - 1000 * 60 * 2,
    priority: 'urgent',
    actionCommand: 'open messages',
    actionLabel: 'Open Chat',
  },
];
