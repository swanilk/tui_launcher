/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Theme {
  id: string;
  name: string;
  category: 'cyberpunk' | 'crt' | 'modern' | 'retro' | 'light';
  bg: string;
  fg: string;
  cardBg: string;
  promptColor: string;
  accentColor: string;
  errorColor: string;
  successColor: string;
  warningColor: string;
  infoColor: string;
  selectionBg: string;
  borderColor: string;
  cursorColor: string;
  fontFamily: string;
  crtScanlines: boolean;
  crtGlow: boolean;
  crtFlicker?: boolean;
}

export interface AppNotification {
  id: string;
  appId: string;
  appName: string;
  packageName: string;
  title: string;
  message: string;
  timestamp: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  actionCommand?: string;
  actionLabel?: string;
  read?: boolean;
}

export interface TerminalLine {
  id: string;
  timestamp: number;
  type: 'input' | 'output' | 'error' | 'success' | 'system' | 'table' | 'ascii' | 'help' | 'weather' | 'app_list' | 'notifications_grouped';
  prompt?: string;
  command?: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface CommandHistoryEntry {
  id: string;
  command: string;
  timestamp: number;
  exitCode?: number;
}

export interface AndroidApp {
  id: string;
  name: string;
  packageName: string;
  category: 'system' | 'tools' | 'social' | 'media' | 'games' | 'dev';
  icon: string; // Lucide icon name or emoji
  description: string;
  launchAction?: 'simulated' | 'url' | 'command';
  url?: string;
  commandToRun?: string;
  favorite?: boolean;
  hidden?: boolean;
  lastUsed?: number;
}

export interface CustomScript {
  id: string;
  name: string; // e.g. "morning.sh" or "check"
  description: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Alias {
  name: string;
  command: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  timestamp: number;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface ContactItem {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export interface ActiveTimer {
  id: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  createdAt: number;
}

export interface VirtualFile {
  name: string;
  type: 'file' | 'dir';
  content?: string;
  size?: number;
  updatedAt: number;
  children?: VirtualFile[];
}

export interface LauncherConfig {
  promptUser: string;
  promptHost: string;
  promptSymbol: string;
  fontSize: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  fontFamily: 'JetBrains Mono' | 'Fira Code' | 'Share Tech Mono' | 'VT323';
  activeThemeId: string;
  showStatusBar: boolean;
  showToolbar: boolean;
  crtEffect: boolean;
  crtGlow: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  soundType: 'mechanical' | 'beep' | 'modern' | 'silent';
  clock24h: boolean;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  autoFocusInput: boolean;
  historyLimit: number;
}

export interface AppDrainItem {
  name: string;
  category: string;
  percentage: number;
  mah: number;
}

export interface BatteryTelemetry {
  level: number;
  isCharging: boolean;
  chargingTime: number | null;
  dischargingTime: number | null;
  health: 'Good' | 'Fair' | 'Overheat' | 'Degraded';
  temperatureC: number;
  voltageMv: number;
  technology: string;
  designCapacityMah: number;
  currentCapacityMah: number;
  cycleCount: number;
  currentMa: number;
  powerWatts: number;
  chargingProtocol: string;
  powerSaver: boolean;
  history: Array<{ time: string; level: number; power: number }>;
  appDrain: AppDrainItem[];
}

export type SyntaxTokenType =
  | 'command'
  | 'subcommand'
  | 'flag'
  | 'string'
  | 'variable'
  | 'operator'
  | 'number'
  | 'argument'
  | 'path'
  | 'invalid'
  | 'plain';

export interface SyntaxToken {
  text: string;
  type: SyntaxTokenType;
}
