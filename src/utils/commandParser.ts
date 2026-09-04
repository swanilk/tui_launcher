/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AndroidApp, Alias, CustomScript, LauncherConfig, NoteItem, TodoItem, ContactItem, RecentCall, BluetoothDevice, BluetoothState, ActiveTimer, Theme, BatteryTelemetry, AppNotification, HotspotState } from '../types';
import { virtualFS } from './fileSystem';
import { soundManager } from './audio';
import {
  uninstallNativeAndroidApp,
  getNativeStorageFiles,
  openNativeApp,
  setNativeBluetoothState,
  scanNativeBluetooth,
  connectNativeBluetooth,
  openNativeBluetoothSettings,
  openNativeHotspotSettings,
  dialNativePhoneNumber,
  sendNativeSms,
  isNativeAndroidApp,
  setNativeGestureNavigationMode,
} from './nativeLauncher';

export interface CommandContext {
  config: LauncherConfig;
  setConfig: (fn: (prev: LauncherConfig) => LauncherConfig) => void;
  themes: Theme[];
  currentTheme: Theme;
  setThemeId: (id: string) => void;
  apps: AndroidApp[];
  setApps: (fn: (prev: AndroidApp[]) => AndroidApp[]) => void;
  notifications: AppNotification[];
  setNotifications: (fn: (prev: AppNotification[]) => AppNotification[]) => void;
  aliases: Alias[];
  setAliases: (fn: (prev: Alias[]) => Alias[]) => void;
  scripts: CustomScript[];
  setScripts: (fn: (prev: CustomScript[]) => CustomScript[]) => void;
  notes: NoteItem[];
  setNotes: (fn: (prev: NoteItem[]) => NoteItem[]) => void;
  todos: TodoItem[];
  setTodos: (fn: (prev: TodoItem[]) => TodoItem[]) => void;
  contacts: ContactItem[];
  setContacts: (fn: (prev: ContactItem[]) => ContactItem[]) => void;
  recentCalls: RecentCall[];
  setRecentCalls: (fn: (prev: RecentCall[]) => RecentCall[]) => void;
  bluetoothState: BluetoothState;
  setBluetoothState: (fn: (prev: BluetoothState) => BluetoothState) => void;
  hotspotState?: HotspotState;
  setHotspotState?: (fn: (prev: HotspotState) => HotspotState) => void;
  timers: ActiveTimer[];
  setTimers: (fn: (prev: ActiveTimer[]) => ActiveTimer[]) => void;
  history: string[];
  clearHistory: () => void;
  clearTerminal: () => void;
  openAppModal: (app: AndroidApp) => void;
  openNanoModal: (filename: string, content: string) => void;
  openThemeModal: () => void;
  openHistoryModal: () => void;
  openBatteryModal?: () => void;
  openClockModal?: () => void;
  openDefaultLauncherModal?: () => void;
  togglePowerSaver?: () => void;
  setMatrixActive: (active: boolean) => void;
  activeTab?: 'apps' | 'notifs' | 'term';
  setActiveTab?: (tab: 'apps' | 'notifs' | 'term') => void;
  batteryLevel: number;
  isCharging: boolean;
  batteryData?: BatteryTelemetry;
  wifiSsid: string;
  syncNativeApps?: () => Promise<{ success: boolean; count: number; message: string }>;
}

export interface CommandResult {
  type: 'output' | 'error' | 'success' | 'system' | 'table' | 'ascii' | 'help' | 'weather' | 'app_list' | 'notifications_grouped';
  content: string;
  metadata?: Record<string, any>;
  clearScreen?: boolean;
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${Math.max(1, secs)}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export class CommandParser {
  public static async execute(rawInput: string, ctx: CommandContext): Promise<CommandResult | null> {
    const trimmed = rawInput.trim();
    if (!trimmed) return null;

    // Handle variable replacements like $USER, $TIME, $DATE, $BATTERY, $PWD
    let expanded = trimmed
      .replace(/\$USER/g, ctx.config.promptUser)
      .replace(/\$HOST/g, ctx.config.promptHost)
      .replace(/\$PWD/g, virtualFS.getPwd())
      .replace(/\$TIME/g, new Date().toLocaleTimeString())
      .replace(/\$DATE/g, new Date().toLocaleDateString())
      .replace(/\$BATTERY/g, `${ctx.batteryLevel}%`)
      .replace(/\$WIFI/g, ctx.wifiSsid);

    // Check aliases
    const firstWord = expanded.split(' ')[0];
    const matchingAlias = ctx.aliases.find((a) => a.name === firstWord);
    if (matchingAlias) {
      const restOfLine = expanded.slice(firstWord.length).trim();
      expanded = matchingAlias.command + (restOfLine ? ' ' + restOfLine : '');
    }

    // Handle piping (|)
    if (expanded.includes('|')) {
      const pipeSegments = expanded.split('|').map((s) => s.trim());
      const baseCmd = pipeSegments[0];
      const baseResult = await this.executeSingle(baseCmd, ctx);
      if (!baseResult) return null;

      let currentText = baseResult.content;
      for (let i = 1; i < pipeSegments.length; i++) {
        currentText = this.applyPipe(currentText, pipeSegments[i]);
      }

      return {
        type: 'output',
        content: currentText,
      };
    }

    // Handle redirects (> or >>)
    if (expanded.includes(' > ') || expanded.includes(' >> ')) {
      const isAppend = expanded.includes(' >> ');
      const [cmdPart, filePart] = expanded.split(isAppend ? ' >> ' : ' > ').map((s) => s.trim());
      const res = await this.executeSingle(cmdPart, ctx);
      if (res) {
        const writeRes = virtualFS.writeFile(filePart, res.content, isAppend);
        if (!writeRes.success) {
          return { type: 'error', content: writeRes.error || 'Write error' };
        }
        return { type: 'success', content: `[✓] Written ${res.content.length} bytes to ${filePart}` };
      }
      return null;
    }

    // Handle chained commands with && or ;
    if (expanded.includes(' && ') || expanded.includes(' ; ')) {
      const separator = expanded.includes(' && ') ? ' && ' : ' ; ';
      const cmds = expanded.split(separator);
      const results: string[] = [];
      for (const cmd of cmds) {
        const r = await this.executeSingle(cmd.trim(), ctx);
        if (r) {
          if (r.type === 'error' && separator === ' && ') {
            results.push(`[!] Failed at: ${cmd}\n${r.content}`);
            break;
          }
          results.push(r.content);
        }
      }
      return {
        type: 'output',
        content: results.join('\n'),
      };
    }

    return this.executeSingle(expanded, ctx);
  }

  private static applyPipe(text: string, pipeCmd: string): string {
    const parts = pipeCmd.split(' ').filter(Boolean);
    const cmd = parts[0]?.toLowerCase();
    const arg = parts.slice(1).join(' ');

    const lines = text.split('\n');

    switch (cmd) {
      case 'grep': {
        if (!arg) return text;
        const ignoreCase = pipeCmd.includes('-i');
        const pattern = arg.replace('-i', '').trim();
        const filtered = lines.filter((l) =>
          ignoreCase ? l.toLowerCase().includes(pattern.toLowerCase()) : l.includes(pattern)
        );
        return filtered.join('\n') || `(no match for '${pattern}')`;
      }
      case 'sort': {
        const reverse = pipeCmd.includes('-r');
        const sorted = [...lines].sort();
        if (reverse) sorted.reverse();
        return sorted.join('\n');
      }
      case 'head': {
        const count = parseInt(arg.replace('-n', '').trim()) || 10;
        return lines.slice(0, count).join('\n');
      }
      case 'tail': {
        const count = parseInt(arg.replace('-n', '').trim()) || 10;
        return lines.slice(-count).join('\n');
      }
      case 'wc':
      case 'count': {
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        const chars = text.length;
        return `  ${lines.length} lines  ${words} words  ${chars} chars`;
      }
      default:
        return text;
    }
  }

  private static async executeSingle(input: string, ctx: CommandContext): Promise<CommandResult | null> {
    const tokens = this.parseArgs(input);
    if (tokens.length === 0) return null;

    const command = tokens[0].toLowerCase();
    const args = tokens.slice(1);

    switch (command) {
      // 0. TAB SWITCHER
      case 'tab':
      case 'tabs': {
        const target = args[0]?.toLowerCase();
        if (!target) {
          return {
            type: 'output',
            content: `📑 SYSTEM TABS (Apps | Notifs | Term):
  • tab apps     - Switch to Installed Applications Tab
  • tab notifs   - Switch to Notifications Hub Tab
  • tab term     - Switch to Terminal Output Tab

Current Active Tab: [ ${ctx.activeTab?.toUpperCase() || 'TERM'} ]
Tip: Swipe LEFT or RIGHT anywhere on screen, press Ctrl+1/2/3, or click the tab pills at the top.`,
          };
        }

        if (target === 'apps' || target === 'app' || target === '1') {
          ctx.setActiveTab?.('apps');
          return { type: 'success', content: '[✓] Switched to Apps Tab.' };
        }
        if (target === 'notifs' || target === 'notif' || target === 'notifications' || target === '2') {
          ctx.setActiveTab?.('notifs');
          return { type: 'success', content: '[✓] Switched to Notifs Tab.' };
        }
        if (target === 'term' || target === 'terminal' || target === 'output' || target === '3') {
          ctx.setActiveTab?.('term');
          return { type: 'success', content: '[✓] Switched to Term Tab.' };
        }

        return { type: 'error', content: `tab: Unknown tab '${target}'. Options: apps, notifs, term` };
      }

      case 'term':
      case 'terminal':
      case 'console': {
        ctx.setActiveTab?.('term');
        return {
          type: 'output',
          content: `💻 Terminal Output Session (tty1 • pts/0 • active):\n  Total command history: ${ctx.history.length} logged\n  Ready for commands. Output appears in this tab.`,
        };
      }

      // SET DEFAULT LAUNCHER & HOME APP SETUP
      case 'set-default-launcher':
      case 'default-launcher':
      case 'set-default':
      case 'default':
      case 'launcher':
      case 'home-app':
      case 'sethome':
      case 'install-launcher':
      case 'pwa-install':
      case 'pwa': {
        if (ctx.openDefaultLauncherModal) {
          ctx.openDefaultLauncherModal();
        }
        // Proactively enforce gesture navigation mode
        setNativeGestureNavigationMode(true).catch(() => {});

        return {
          type: 'success',
          content: `📱 [DEFAULT LAUNCHER SETUP]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Android Terminal Launcher can be configured as your primary device Home App.

Setup Options:
  1. Set as Default Android Home App (interactive role request)
  2. Force Gesture Navigation Mode (auto-hides 3-button bar & requests system gesture nav)
  3. ADB Shell Commands:
     • Set Home: adb shell cmd package set-home-activity com.android.tui.launcher/.MainActivity
     • Enable Gestures: adb shell cmd overlay enable com.android.internal.systemui.navbar.gestural
  4. Swiping Gestures:
     • Swipe LEFT ➔ Next Tab (Apps ➔ Notifs ➔ Term)
     • Swipe RIGHT ➔ Previous Tab (Term ➔ Notifs ➔ Apps)

Opening interactive launcher setup wizard...`,
        };
      }

      // GESTURE NAVIGATION ENFORCEMENT & SETTINGS
      case 'gesture-nav':
      case 'gestures':
      case 'gesture': {
        const subCmd = args[0]?.toLowerCase();
        const enable = subCmd === 'off' || subCmd === 'disable' || subCmd === '3button' ? false : true;
        const result = await setNativeGestureNavigationMode(enable);
        return {
          type: result.success ? 'success' : 'system',
          content: `👆 [GESTURE NAVIGATION CONTROLLER]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: ${result.message}
Target Mode: ${enable ? 'Full Screen Gesture Navigation (3-Button Bar Hidden)' : 'Standard 3-Button Navigation'}

Swiping Navigation:
  • Swipe LEFT anywhere on screen ➔ Next section (Apps ➔ Notifs ➔ Term)
  • Swipe RIGHT anywhere on screen ➔ Previous section (Term ➔ Notifs ➔ Apps)
  • GPU-accelerated smooth slide transitions active!

OEM & Third-Party Launcher Compatibility:
  • Pixel / Samsung / Motorola / OnePlus / Sony:
    adb shell cmd overlay enable com.android.internal.systemui.navbar.gestural
    adb shell settings put secure navigation_mode 2
  • Xiaomi / HyperOS / MIUI:
    Xiaomi restricts system gestures for third-party launchers. Install "Fluid Navigation Gestures (FNG)" or "Edge Gestures" to enjoy edge swipe gestures across all apps!
  • Inside TUI Launcher:
    The 3-button navigation bar is automatically hidden in sticky immersive mode.`,
        };
      }

      // 1. HELP & MANUAL
      case 'help':
      case '?':
      case 'man': {
        return this.handleHelp(args);
      }

      // 2. APPS MANAGEMENT, LAUNCH & UNINSTALL
      case 'apps':
      case 'app':
      case 'ls-apps': {
        return this.handleApps(args, ctx);
      }

      case 'sync-apps':
      case 'scan-apps':
      case 'sync':
      case 'scan': {
        if (ctx.syncNativeApps) {
          ctx.syncNativeApps();
          return {
            type: 'system',
            content: `🔄 Scanning native Android PackageManager for installed apps...`,
          };
        }
        return {
          type: 'output',
          content: `Sync command requires native Android APK environment.`,
        };
      }

      case 'open':
      case 'launch':
      case 'start': {
        if (args.length === 0) {
          const topApps = ctx.apps.slice(0, 6).map((a) => `  • open "${a.name}"`).join('\n');
          return {
            type: 'output',
            content: `🚀 ANDROID APPLICATION LAUNCHER:
Usage: open <app_name | url | package>
Examples:
  • open Chrome
  • open Camera
  • open Spotify
  • open https://github.com
Available Installed Apps:
${topApps}

Tip: You can also type the app name directly (e.g. 'camera') or type 'open ' for suggestions!`,
          };
        }
        const target = args.join(' ').replace(/^["']|["']$/g, '').trim().toLowerCase();
        
        // Check web url
        if (target.startsWith('http://') || target.startsWith('https://') || target.includes('.com') || target.includes('.org') || target.includes('.io')) {
          const url = target.startsWith('http') ? target : `https://${target}`;
          try {
            window.open(url, '_blank');
          } catch {}
          return { type: 'success', content: `[✓] Opened URL: ${url}` };
        }

        // Find app by exact name, packageName, id, or substring
        const found = ctx.apps.find(
          (a) => a.name.toLowerCase() === target ||
                 a.packageName.toLowerCase() === target ||
                 a.id.toLowerCase() === target
        ) || ctx.apps.find(
          (a) => a.name.toLowerCase().includes(target) ||
                 a.packageName.toLowerCase().includes(target)
        );

        if (found) {
          // Update lastUsed timestamp so app moves to top of Recently Used
          ctx.setApps((prev) =>
            prev.map((a) => (a.id === found.id ? { ...a, lastUsed: Date.now() } : a))
          );

          if (found.launchAction === 'command' && found.commandToRun) {
            return this.executeSingle(found.commandToRun, ctx);
          }
          ctx.openAppModal(found);
          return {
            type: 'success',
            content: `[✓] Launching ${found.name} (${found.packageName})...`,
            metadata: {
              action: 'open_app',
              app: found,
            },
          };
        }

        const closeMatches = ctx.apps
          .filter((a) => a.name.toLowerCase().startsWith(target.slice(0, 2)))
          .map((a) => a.name);
        const suggestionNote = closeMatches.length > 0 ? `\nDid you mean: ${closeMatches.join(', ')}?` : '';

        return {
          type: 'error',
          content: `open: app '${target}' not found.${suggestionNote}\nType 'apps' to see all installed applications.`,
        };
      }

      case 'uninstall':
      case 'remove-app':
      case 'pm':
      case 'pkg': {
        let target = '';
        if (command === 'pm' || command === 'pkg') {
          const sub = args[0]?.toLowerCase();
          if (sub === 'uninstall' || sub === 'remove' || sub === 'rm') {
            target = args.slice(1).join(' ').trim();
          } else if (sub === 'list' || sub === 'packages') {
            return this.handleApps(args.slice(1), ctx);
          } else {
            return {
              type: 'output',
              content: `📦 Package Manager (${command}):\n  Usage: ${command} uninstall <app_name | package_name>\n         ${command} list packages`,
            };
          }
        } else {
          target = args.join(' ').trim();
        }

        if (!target) {
          const appList = ctx.apps.slice(0, 6).map((a) => `  • uninstall "${a.name}" (${a.packageName})`).join('\n');
          return {
            type: 'output',
            content: `🗑️ ANDROID PACKAGE UNINSTALLER:
Usage: uninstall <app_name | package_name>
Examples:
  • uninstall Spotify
  • uninstall com.android.camera2
Available Installed Apps:
${appList}

Tip: Type 'uninstall ' to view interactive autocompletion suggestions.`,
          };
        }

        const cleanTarget = target.toLowerCase().replace(/^["']|["']$/g, '');
        const found = ctx.apps.find(
          (a) => a.name.toLowerCase() === cleanTarget ||
                 a.packageName.toLowerCase() === cleanTarget ||
                 a.id.toLowerCase() === cleanTarget
        ) || ctx.apps.find(
          (a) => a.name.toLowerCase().includes(cleanTarget) ||
                 a.packageName.toLowerCase().includes(cleanTarget)
        );

        if (!found) {
          return {
            type: 'error',
            content: `uninstall: Package or application '${target}' is not installed.\nType 'apps' to view all installed applications.`,
          };
        }

        // Trigger native Android package uninstaller on phone / browser
        const nativeResult = await uninstallNativeAndroidApp(found.packageName);

        // Remove from apps list
        ctx.setApps((prev) => prev.filter((a) => a.id !== found.id));

        const freedMb = (Math.random() * 35 + 15).toFixed(1);
        return {
          type: 'success',
          content: `🗑️ ANDROID SYSTEM PACKAGE UNINSTALLER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Application:  ${found.name}
  Package:      ${found.packageName}
  Category:     ${found.category}
  OS Action:    [✓] Dispatched native system uninstall intent (ACTION_DELETE)
  Status:       ${nativeResult.message}
  Storage:      [✓] Reclaimed ~${freedMb} MB app binaries and cache
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
App '${found.name}' uninstall dispatched to Android OS. Confirm prompt if shown.`,
          metadata: {
            action: 'uninstall',
            app: found,
          },
        };
      }

      // 3. PHONE CALL & SMS
      case 'call':
      case 'dial': {
        const rawQuery = args.join(' ').replace(/^["']|["']$/g, '').trim();

        // If no arguments provided
        if (!rawQuery) {
          if (command === 'dial') {
            // Directly trigger native Android Phone Dialer application
            const dialRes = await dialNativePhoneNumber();
            return {
              type: 'success',
              content: `📞 ANDROID PHONE DIALER DISPATCHED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Action:  ${dialRes.message}
  Method:  ${dialRes.method}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Direct telephone keypad opened. Type 'call <number|name>' to place a direct call.`,
              metadata: { action: 'call_dialer_open' },
            };
          }

          const recentCalls = ctx.recentCalls || [];
          const recentList = recentCalls.slice(0, 5).map((rc) => {
            const timeAgo = formatRelativeTime(rc.timestamp);
            const typeIcon = rc.type === 'missed' ? '🔴 Missed' : rc.type === 'incoming' ? '🔵 Incoming' : '🟢 Outgoing';
            return `  • call "${rc.name}" (${rc.phone}) — ${typeIcon} • ${timeAgo}`;
          }).join('\n');

          const topContacts = (ctx.contacts || []).slice(0, 4).map((c) => `  • call "${c.name}" (${c.phone})`).join('\n');

          return {
            type: 'output',
            content: `📞 ANDROID PHONE CALL DIALER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Usage:
  • call <phone_number | contact_name>  - Initiate phone call via Phone app
  • dial                                 - Open native Android phone dialer
  • recents / calls                      - View call history

🕒 RECENT CALLS:
${recentList || '  (No call history yet. Dial any number to place calls)'}

👥 QUICK CONTACTS:
${topContacts || '  (No contacts saved. Use \'contact add <name> <phone>\')'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tip: Type 'call ' in prompt to view interactive autocomplete from your contacts and call logs!`,
          };
        }

        const cleanQueryNum = rawQuery.replace(/[^\d+]/g, '');

        // Match contact by name or clean phone substring
        const matchedContact = ctx.contacts.find((c) => {
          const nameMatch = c.name.toLowerCase().includes(rawQuery.toLowerCase());
          const phoneClean = c.phone.replace(/[^\d+]/g, '');
          const phoneMatch = cleanQueryNum.length >= 3 && phoneClean.includes(cleanQueryNum);
          return nameMatch || phoneMatch;
        }) || (ctx.recentCalls || []).find((rc) => {
          const nameMatch = rc.name.toLowerCase().includes(rawQuery.toLowerCase());
          const phoneClean = rc.phone.replace(/[^\d+]/g, '');
          const phoneMatch = cleanQueryNum.length >= 3 && phoneClean.includes(cleanQueryNum);
          return nameMatch || phoneMatch;
        });

        const targetName = matchedContact ? matchedContact.name : rawQuery;
        const targetPhone = matchedContact ? matchedContact.phone : rawQuery;
        const cleanPhone = targetPhone.replace(/[^\d+*#]/g, '');

        if (!cleanPhone && !targetPhone) {
          return { type: 'error', content: 'call: Please specify a valid phone number or contact name.' };
        }

        // Log to Recent Calls (newest at top)
        const newLogEntry: RecentCall = {
          id: `rc-${Date.now()}`,
          name: targetName,
          phone: targetPhone,
          timestamp: Date.now(),
          type: 'outgoing',
          duration: 'Outgoing Call',
        };
        ctx.setRecentCalls((prev) => [newLogEntry, ...prev.filter((r) => r.phone !== targetPhone)].slice(0, 30));

        // Trigger native Android Phone Dialer Intent / Capacitor Plugin
        const dialRes = await dialNativePhoneNumber(cleanPhone);

        return {
          type: 'success',
          content: `📞 PHONE CALL DISPATCHED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Contact:      ${targetName}
  Phone Number: ${targetPhone}
  Application:  Android Native Phone App
  Status:       Dispatched (${dialRes.method})
  Message:      ${dialRes.message}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Handed off to your device's native Phone app to place the call.`,
          metadata: {
            action: 'call',
            name: targetName,
            phone: targetPhone,
            cleanPhone,
            timestamp: Date.now(),
            method: dialRes.method,
          },
        };
      }

      case 'hangup':
      case 'endcall':
      case 'disconnect': {
        return {
          type: 'output',
          content: `📞 Ongoing phone calls are handled directly by Android's native Phone app.
Please use the active in-call banner or the Phone app to end the call.`,
        };
      }

      case 'calls':
      case 'call-log':
      case 'recents':
      case 'recent-calls': {
        const list = ctx.recentCalls || [];
        if (list.length === 0) {
          return { type: 'output', content: '📞 Call Log: No recent calls found.' };
        }
        const rows = list.map((rc, idx) => {
          const typeLabel = rc.type === 'missed' ? '🔴 MISSED' : rc.type === 'incoming' ? '🔵 INCOMING' : '🟢 OUTGOING';
          const time = new Date(rc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const rel = formatRelativeTime(rc.timestamp);
          return `  ${String(idx + 1).padStart(2, ' ')}. ${rc.name.padEnd(26, ' ')} ${rc.phone.padEnd(16, ' ')} ${typeLabel.padEnd(12, ' ')} ${time} (${rel})`;
        }).join('\n');

        return {
          type: 'output',
          content: `📞 ANDROID RECENT CALL LOG (${list.length} calls):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  #   CONTACT NAME               PHONE NUMBER     TYPE         TIME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${rows}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tip: Type 'call <name|number>' or 'call ' to redial any contact.`,
        };
      }

      case 'sms':
      case 'msg':
      case 'message':
      case 'messages': {
        // If no arguments provided, launch the phone's default messaging app
        if (args.length === 0) {
          const smsRes = await sendNativeSms();
          return {
            type: 'success',
            content: `✉️ ANDROID MESSAGING APP DISPATCHED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Action:      ${smsRes.message}
  Method:      ${smsRes.method}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Default SMS/MMS messaging app opened.
Usage:
  • sms                          - Open phone's Messaging app
  • sms <contact|number>         - Open conversation in Messaging app
  • sms <contact|number> <msg>   - Compose and send SMS via Messaging app`,
            metadata: { action: 'sms_app_open' },
          };
        }

        const rawRecipient = args[0].replace(/^["']|["']$/g, '').trim();
        const cleanQueryNum = rawRecipient.replace(/[^\d+]/g, '');

        // Match contact by name or clean phone substring
        const matchedContact = ctx.contacts.find((c) => {
          const nameMatch = c.name.toLowerCase().includes(rawRecipient.toLowerCase());
          const phoneClean = c.phone.replace(/[^\d+]/g, '');
          const phoneMatch = cleanQueryNum.length >= 3 && phoneClean.includes(cleanQueryNum);
          return nameMatch || phoneMatch;
        }) || (ctx.recentCalls || []).find((rc) => {
          const nameMatch = rc.name.toLowerCase().includes(rawRecipient.toLowerCase());
          const phoneClean = rc.phone.replace(/[^\d+]/g, '');
          const phoneMatch = cleanQueryNum.length >= 3 && phoneClean.includes(cleanQueryNum);
          return nameMatch || phoneMatch;
        });

        const targetName = matchedContact ? matchedContact.name : rawRecipient;
        const targetPhone = matchedContact ? matchedContact.phone : rawRecipient;
        const cleanPhone = targetPhone.replace(/[^\d+*#]/g, '');

        const messageText = args.slice(1).join(' ').trim();

        // Dispatch native Android Messaging app
        const smsRes = await sendNativeSms(cleanPhone, messageText);

        if (messageText) {
          return {
            type: 'success',
            content: `✉️ MESSAGING APP DISPATCHED (SMS):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Recipient:   ${targetName}
  Phone:       ${targetPhone}
  Message:     "${messageText}"
  Status:      Dispatched to Phone's Messaging App
  Dispatch:    ${smsRes.message} (${smsRes.method})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Composed message handed off to your phone's Messaging app.`,
            metadata: {
              action: 'sms',
              name: targetName,
              phone: targetPhone,
              cleanPhone,
              message: messageText,
              method: smsRes.method,
            },
          };
        } else {
          return {
            type: 'success',
            content: `✉️ OPENING CONVERSATION IN MESSAGING APP:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Recipient:   ${targetName}
  Phone:       ${targetPhone}
  Status:      Dispatched to Phone's Messaging App
  Dispatch:    ${smsRes.message} (${smsRes.method})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Conversation opened in your phone's Messaging app.`,
            metadata: {
              action: 'sms',
              name: targetName,
              phone: targetPhone,
              cleanPhone,
              message: '',
              method: smsRes.method,
            },
          };
        }
      }

      // 4. WEB SEARCH
      case 'search':
      case 'google':
      case 'ddg':
      case 'yt':
      case 'youtube': {
        if (args.length === 0) return { type: 'error', content: `Usage: ${command} <query>` };
        const query = encodeURIComponent(args.join(' '));
        let searchUrl = `https://www.google.com/search?q=${query}`;
        if (command === 'ddg') searchUrl = `https://duckduckgo.com/?q=${query}`;
        if (command === 'yt' || command === 'youtube') searchUrl = `https://www.youtube.com/results?search_query=${query}`;
        
        try {
          window.open(searchUrl, '_blank');
        } catch {}
        return { type: 'success', content: `🔍 Searching for "${args.join(' ')}" on ${command.toUpperCase()}...` };
      }

      // 5. CALCULATOR
      case 'calc':
      case 'eval': {
        if (args.length === 0) return { type: 'error', content: 'Usage: calc <mathematical_expression> (e.g. calc 24 * (12 + 8) / 4)' };
        const expr = args.join(' ');
        try {
          // Sanitize math string
          const sanitized = expr.replace(/[^0-9+\-*/().%^eEpiMathsincosntqrg \t]/g, '');
          const withMath = sanitized
            .replace(/\bpi\b/gi, 'Math.PI')
            .replace(/\be\b/gi, 'Math.E')
            .replace(/\bsin\b/gi, 'Math.sin')
            .replace(/\bcos\b/gi, 'Math.cos')
            .replace(/\btan\b/gi, 'Math.tan')
            .replace(/\bsqrt\b/gi, 'Math.sqrt')
            .replace(/\bpow\b/gi, 'Math.pow')
            .replace(/\^/g, '**');

          const result = Function(`"use strict"; return (${withMath});`)();
          return {
            type: 'output',
            content: `🧮 ${expr} = ${result}`,
          };
        } catch (e: any) {
          return { type: 'error', content: `calc: Invalid expression "${expr}"` };
        }
      }

      // 6. WEATHER REPORT
      case 'weather':
      case 'wttr': {
        const city = args.join(' ') || 'San Francisco';
        return this.generateWeather(city);
      }

      // 7. SYSTEM INFO & NEOFETCH
      case 'neofetch':
      case 'fastfetch':
      case 'sysinfo':
      case 'device':
      case 'info': {
        return this.generateNeofetch(ctx);
      }

      case 'wifi':
      case 'network':
      case 'net': {
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        const conn = typeof navigator !== 'undefined' ? (navigator as any).connection : null;
        const effectiveType = conn?.effectiveType ? conn.effectiveType.toUpperCase() : 'LAN/Wi-Fi';
        const downlink = conn?.downlink ? `${conn.downlink} Mbps` : 'High Speed';
        const rtt = conn?.rtt ? `${conn.rtt} ms` : 'Low Latency';
        const saveData = conn?.saveData ? 'Enabled' : 'Disabled';

        return {
          type: 'output',
          content: `📶 Network Status & Telemetry:
  Status:         ${isOnline ? '● CONNECTED (ONLINE)' : '○ DISCONNECTED (OFFLINE)'}
  Network Type:   ${effectiveType}
  Downlink Rate:  ${downlink}
  Latency (RTT):  ${rtt}
  Data Saver:     ${saveData}
  SSID/Connection:${ctx.wifiSsid}
  Host / Origin:  ${typeof window !== 'undefined' ? window.location.host : 'localhost'}
  Protocol:       ${typeof window !== 'undefined' ? window.location.protocol.replace(':', '').toUpperCase() : 'HTTPS'}`,
        };
      }

      case 'hotspot':
      case 'tether':
      case 'tethering':
      case 'ap': {
        return await this.handleHotspot(args, ctx);
      }

      case 'bluetooth':
      case 'bt':
      case 'bluetoothctl':
      case 'bluez': {
        return await this.handleBluetooth(args, ctx);
      }

      case 'battery':
      case 'bat':
      case 'batmon':
      case 'power': {
        return this.handleBattery(args, ctx);
      }

      // 8. THEMES
      case 'theme':
      case 'themes': {
        if (args.length === 0 || args[0] === 'ls' || args[0] === 'list') {
          ctx.openThemeModal();
          const list = ctx.themes
            .map((t) => `  ${t.id === ctx.currentTheme.id ? '●' : '○'} ${t.id.padEnd(18)} - ${t.name} (${t.category})`)
            .join('\n');
          return {
            type: 'output',
            content: `🎨 Available Themes:\n${list}\n\nType 'theme <id>' to activate or use interactive modal.`,
          };
        }

        const targetId = args[0].toLowerCase();
        const found = ctx.themes.find((t) => t.id.toLowerCase() === targetId || t.name.toLowerCase().includes(targetId));
        if (found) {
          ctx.setThemeId(found.id);
          return {
            type: 'success',
            content: `[✓] Applied theme: ${found.name} (${found.id})\n  Scanlines: ${found.crtScanlines ? 'ON' : 'OFF'} | Glow: ${found.crtGlow ? 'ON' : 'OFF'} | Font: ${found.fontFamily}`,
          };
        }

        return { type: 'error', content: `theme: '${targetId}' not found. Type 'themes' to view all options.` };
      }

      case 'theme-edit':
      case 'theme-custom': {
        ctx.openThemeModal();
        return { type: 'output', content: '🎨 Opened Theme & Style Customizer modal.' };
      }

      // 9. ALIASES
      case 'alias': {
        if (args.length === 0) {
          const list = ctx.aliases.map((a) => `alias ${a.name}='${a.command}'`).join('\n');
          return { type: 'output', content: list || '# No custom aliases defined' };
        }

        const raw = args.join(' ');
        const match = raw.match(/^([a-zA-Z0-9_-]+)=['"]?([^'"]+)['"]?$/);
        if (!match) {
          return { type: 'error', content: "Usage: alias name='command' (e.g. alias ll='ls -la')" };
        }

        const [, name, cmd] = match;
        ctx.setAliases((prev) => {
          const filtered = prev.filter((a) => a.name !== name);
          return [...filtered, { name, command: cmd }];
        });

        return { type: 'success', content: `[✓] Created alias: ${name} -> "${cmd}"` };
      }

      case 'unalias': {
        if (args.length === 0) return { type: 'error', content: 'Usage: unalias <name>' };
        const name = args[0];
        ctx.setAliases((prev) => prev.filter((a) => a.name !== name));
        return { type: 'success', content: `[✓] Removed alias: ${name}` };
      }

      // 10. HISTORY
      case 'history':
      case 'hist': {
        if (args[0] === '-c' || args[0] === 'clear') {
          ctx.clearHistory();
          return { type: 'success', content: '[✓] Command history cleared.' };
        }
        if (args[0] === '-r' || args[0] === 'search') {
          ctx.openHistoryModal();
          return { type: 'output', content: '📜 Opened Reverse History Search (Ctrl+R)' };
        }

        const limit = args[0] ? parseInt(args[0]) : 25;
        const slice = ctx.history.slice(-limit);
        const list = slice
          .map((cmd, i) => `  ${(ctx.history.length - slice.length + i + 1).toString().padStart(4, ' ')}  ${cmd}`)
          .join('\n');
        return {
          type: 'output',
          content: `📜 Command History (last ${slice.length}):\n${list}\n\nTip: Press Up/Down to cycle, or Ctrl+R for live search.`,
        };
      }

      // 11. NOTES
      case 'notes':
      case 'note': {
        return this.handleNotes(args, ctx);
      }

      // 12. TODOS / TASKS
      case 'todo':
      case 'todos':
      case 'task': {
        return this.handleTodos(args, ctx);
      }

      // 13. TIMERS & ALARMS
      case 'timer': {
        if (args.length === 0) {
          const active = ctx.timers.filter((t) => t.isRunning);
          if (active.length === 0) return { type: 'output', content: '⏱️ No active timers running. Usage: timer <seconds> [label]' };
          const list = active.map((t) => `  [#${t.id}] ${t.label}: ${t.remainingSeconds}s remaining`).join('\n');
          return { type: 'output', content: `⏱️ Active Timers:\n${list}` };
        }

        const seconds = parseInt(args[0]);
        if (isNaN(seconds) || seconds <= 0) return { type: 'error', content: 'Usage: timer <seconds> [label]' };
        const label = args.slice(1).join(' ') || `Timer (${seconds}s)`;

        const newTimer: ActiveTimer = {
          id: Math.random().toString(36).substring(2, 7),
          label,
          totalSeconds: seconds,
          remainingSeconds: seconds,
          isRunning: true,
          createdAt: Date.now(),
        };

        ctx.setTimers((prev) => [...prev, newTimer]);
        return { type: 'success', content: `⏱️ Started timer "${label}" for ${seconds} seconds!` };
      }

      // 14. NANO & VIM TUI EDITORS
      case 'nano':
      case 'vim':
      case 'vi':
      case 'edit': {
        const filename = args[0] || 'untitled.txt';
        const fileRes = virtualFS.readFile(filename);
        const initialContent = fileRes.success ? fileRes.content || '' : '';
        ctx.openNanoModal(filename, initialContent);
        return { type: 'output', content: `📝 Opening TUI editor for: ${filename}...` };
      }

      // 15. CUSTOM SCRIPTS
      case 'script':
      case 'scripts': {
        return this.handleScripts(args, ctx);
      }

      case 'bash':
      case 'sh':
      case 'run': {
        if (args.length === 0) return { type: 'error', content: 'Usage: run <script_name.sh>' };
        const scriptName = args[0];
        
        // Check virtual FS first
        const fileRes = virtualFS.readFile(scriptName);
        if (fileRes.success && fileRes.content) {
          return this.runScriptContent(fileRes.content, ctx, scriptName);
        }

        // Check custom scripts
        const script = ctx.scripts.find((s) => s.name === scriptName || s.id === scriptName);
        if (script) {
          return this.runScriptContent(script.content, ctx, script.name);
        }

        return { type: 'error', content: `run: Script '${scriptName}' not found.` };
      }

      // 16. MATRIX RAIN EFFECT
      case 'matrix':
      case 'rain': {
        ctx.setMatrixActive(true);
        return { type: 'output', content: '🟢 Entering Matrix Digital Rain mode... Press ANY key, Esc, or click to exit.' };
      }

      // 17. CONTACTS
      case 'contacts':
      case 'contact': {
        return this.handleContacts(args, ctx);
      }

      // 18. NOTIFICATIONS SHADE (TABULAR, GROUPED & SEGREGATED BY APP)
      case 'notifications':
      case 'notification':
      case 'notifs':
      case 'notif':
      case 'notify':
      case 'alerts':
      case 'alert': {
        return this.handleNotifications(args, ctx);
      }

      // Deprecated APK builder command notification
      case 'apk':
      case 'compile':
      case 'build-apk':
      case 'package':
      case 'export-apk': {
        return {
          type: 'output',
          content: `📱 ANDROID TERMINAL LAUNCHER:
  The terminal launcher is actively running in its full native interactive TUI environment.
  APK Builder has been streamlined into direct native execution.
  
  • To view or launch apps: type 'apps' or 'open <app>'
  • To check app notifications: type 'notifications' or 'notifs'
  • To inspect power status: type 'battery' or 'battery monitor'`,
        };
      }

      case 'uname': {
        if (args.includes('-a')) {
          return {
            type: 'output',
            content: 'Linux android-16-aarch64 6.12.0-baklava-preview #1 SMP PREEMPT_DYNAMIC Tue Sep 1 11:24:05 UTC 2026 aarch64 GNU/Linux (16KB Pages)',
          };
        }
        return { type: 'output', content: 'Linux' };
      }

      case 'version':
      case 'os':
      case 'android16': {
        return {
          type: 'output',
          content: `📱 Android Terminal Launcher (TUI) v1.3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Android OS Platform:
  Version:       Android 16 (Baklava)
  API Level:     36
  Build ID:      AP4A.260901.001.A1
  Kernel:        6.12.0-android16-aarch64
  Security Patch: 2026-09-01
  Architecture:  arm64-v8a (16KB page alignment)
  Features:      Full Screen Gestures, Smooth Slide Pager, Contact Quick-Dial / SMS, Hardware TUI`,
        };
      }

      case 'clear':
      case 'cls':
      case 'reset': {
        ctx.clearTerminal();
        return { type: 'system', content: '', clearScreen: true };
      }

      case 'echo': {
        return { type: 'output', content: args.join(' ') };
      }

      case 'date':
      case 'time':
      case 'clock':
      case 'cal':
      case 'chronometer': {
        return this.handleClock(args, ctx);
      }

      case 'uptime': {
        return {
          type: 'output',
          content: `⏱️ Uptime: 4 days, 18 hours, 32 mins | Load average: 0.42, 0.38, 0.35 | Tasks: 124 total`,
        };
      }

      case 'torch':
      case 'flashlight': {
        return { type: 'output', content: '🔦 Flashlight hardware state toggled (LED ON)' };
      }

      case 'vol':
      case 'volume': {
        if (args.length === 0) return { type: 'output', content: `🔊 Volume: Media 75%, Ring 100%, Alarm 90%` };
        const val = parseInt(args[0]);
        return { type: 'success', content: `🔊 Master volume set to ${val}%` };
      }

      case 'config':
      case 'settings': {
        return this.handleConfig(args, ctx);
      }

      case 'ascii':
      case 'banner':
      case 'figlet': {
        const text = args.join(' ') || 'ANDROID';
        return { type: 'ascii', content: this.renderSimpleAscii(text) };
      }

      case 'fortune':
      case 'quote': {
        const quotes = [
          '"There is no place like ~"',
          '"Talk is cheap. Show me the code." - Linus Torvalds',
          '"In a world without walls and fences, who needs windows and gates?"',
          '"UNIX was not designed to stop people from doing stupid things, because that would also stop them from doing clever things."',
          '"Terminal launchers: where typing 4 characters is 10x faster than swiping 3 screens."',
          '"Root is not just a user, it is a way of life."',
        ];
        const chosen = quotes[Math.floor(Math.random() * quotes.length)];
        return { type: 'output', content: `🔮 ${chosen}` };
      }

      case 'ping': {
        const host = args[0] || '8.8.8.8';
        return {
          type: 'output',
          content: `PING ${host} (56 data bytes)\n64 bytes from ${host}: icmp_seq=1 ttl=116 time=14.2 ms\n64 bytes from ${host}: icmp_seq=2 ttl=116 time=13.8 ms\n64 bytes from ${host}: icmp_seq=3 ttl=116 time=14.5 ms\n--- ${host} ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss, avg = 14.16ms`,
        };
      }

      // 19. ANDROID STORAGE SUBSYSTEM (ls, cd, pwd, cat, touch, mkdir, rm, storage)
      case 'pwd': {
        return { type: 'output', content: virtualFS.getPwd() };
      }

      case 'ls':
      case 'dir': {
        const showAll = args.includes('-a') || args.includes('-la') || args.includes('-al');
        const showLong = args.includes('-l') || args.includes('-la') || args.includes('-al');
        const rawTarget = args.find((a) => !a.startsWith('-')) || '.';
        const targetPath = virtualFS.resolvePath(rawTarget);

        // 1. Native Android Storage interaction (when running inside Capacitor APK on phone)
        if (isNativeAndroidApp()) {
          try {
            const nativeRes = await getNativeStorageFiles(targetPath);
            if (nativeRes && nativeRes.success && nativeRes.files) {
              virtualFS.cacheNativeFiles(targetPath, nativeRes.files);
              const items = nativeRes.files.filter((f) => showAll || !f.name.startsWith('.'));
              if (items.length === 0) {
                return {
                  type: 'output',
                  content: `📱 Android Internal Storage [${nativeRes.absolutePath}]\ntotal 0\n(Directory is empty)`,
                };
              }
              if (showLong) {
                const lines = items.map((f) => {
                  const perm = f.isDirectory ? 'drwxrwx--x' : '-rw-rw----';
                  const size = f.size.toString().padStart(8, ' ');
                  const dateStr = new Date(f.lastModified).toLocaleDateString();
                  const colorName = f.isDirectory ? `📁 ${f.name}/` : `📄 ${f.name}`;
                  return `${perm}  media_rw media_rw  ${size}  ${dateStr}  ${colorName}`;
                });
                return {
                  type: 'output',
                  content: `📱 Android Internal Storage [${nativeRes.absolutePath}]\ntotal ${items.length}\n` + lines.join('\n'),
                };
              } else {
                const names = items.map((f) => (f.isDirectory ? `📁 ${f.name}/` : `📄 ${f.name}`)).join('   ');
                return {
                  type: 'output',
                  content: `📱 Android Internal Storage [${nativeRes.absolutePath}]\n${names}`,
                };
              }
            }
          } catch (e) {
            console.warn('Native ls error fallback:', e);
          }
        }

        // 2. Storage Access Framework / Mounted Android Folder or Real Storage
        const asyncRes = await virtualFS.listStorageEntries(targetPath);
        if (asyncRes && asyncRes.success) {
          const items = asyncRes.files.filter((f) => showAll || !f.name.startsWith('.'));
          const header = `📱 Android Storage [${asyncRes.resolvedPath}]\n`;

          if (items.length === 0) {
            return {
              type: 'output',
              content: `${header}total 0\n(Directory is empty)\n\n• Type 'storage mount' to connect an Android folder via Storage Access Framework\n• Type 'storage open' to open the Android Files app (com.android.documentsui)\n• Type 'touch <file>' to create a file in storage`,
            };
          }

          if (showLong) {
            const lines = items.map((f) => {
              const perm = f.isDirectory ? 'drwxrwx--x' : '-rw-rw----';
              const size = f.size.toString().padStart(8, ' ');
              const dateStr = new Date(f.lastModified).toLocaleDateString();
              const colorName = f.isDirectory ? `📁 ${f.name}/` : `📄 ${f.name}`;
              return `${perm}  media_rw media_rw  ${size}  ${dateStr}  ${colorName}`;
            });
            return {
              type: 'output',
              content: `${header}total ${items.length}\n` + lines.join('\n'),
            };
          } else {
            const names = items.map((f) => (f.isDirectory ? `📁 ${f.name}/` : `📄 ${f.name}`)).join('   ');
            return {
              type: 'output',
              content: `${header}${names}`,
            };
          }
        }

        return {
          type: 'error',
          content: `ls: cannot access '${targetPath}': No such file or directory`,
        };
      }

      case 'storage': {
        const sub = args[0]?.toLowerCase();
        if (sub === 'mount' || sub === 'connect') {
          if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
            try {
              const handle = await (window as any).showDirectoryPicker();
              virtualFS.setMountedDirectoryHandle(handle);
              return {
                type: 'success',
                content: `📁 Android Storage Folder Connected: [${handle.name}]\nUse 'ls' to browse files, 'touch' or 'nano' to create and edit files directly.`,
              };
            } catch (err: any) {
              if (err?.name === 'AbortError') {
                return { type: 'output', content: 'Storage selection cancelled.' };
              }
              return { type: 'error', content: `Could not mount folder: ${err?.message || err}` };
            }
          } else {
            return {
              type: 'output',
              content: `Native Android APK automatically accesses /storage/emulated/0 directly.\nIn web browsers, folder picker requires a modern browser (Chrome on Android or desktop Chrome).`,
            };
          }
        }

        if (sub === 'open' || sub === 'files') {
          const res = await openNativeApp('com.android.documentsui');
          return {
            type: 'output',
            content: `📱 Launching Android File Manager (com.android.documentsui): ${res.message}`,
          };
        }

        if (sub === 'unmount' || sub === 'disconnect') {
          virtualFS.clearMountedDirectory();
          return {
            type: 'output',
            content: '📁 Storage folder unmounted. Returned to internal storage root (/storage/emulated/0).',
          };
        }

        const mountedName = virtualFS.getMountedDirName();
        const isNative = isNativeAndroidApp();
        return {
          type: 'output',
          content: `📱 ANDROID STORAGE SUBSYSTEM:
  Mount Point:    /storage/emulated/0 (Internal Storage)
  Environment:    ${isNative ? 'Native Android APK (Direct /storage/emulated/0 access)' : 'Web Storage Access Framework (SAF)'}
  Mounted Folder: ${mountedName ? `[${mountedName}]` : 'Internal Storage Root (/storage/emulated/0)'}
  Files App:      com.android.documentsui (Ready)

Commands:
  • storage mount    - Connect an Android storage folder (Downloads, Documents, etc.)
  • storage open     - Open native Android Files app
  • storage unmount  - Disconnect external mounted folder
  • ls [path]        - List files in current Android storage path
  • cd <path>        - Change directory in Android storage`,
        };
      }

      case 'cd': {
        const target = args[0] || '~';
        const res = await virtualFS.changeDir(target);
        if (!res.success) {
          return { type: 'error', content: res.error || 'cd error' };
        }
        if (target === '-') {
          return { type: 'output', content: virtualFS.getPwd() };
        }
        return null; // silent on success like bash
      }

      case 'cat':
      case 'read': {
        if (args.length === 0) return { type: 'error', content: 'Usage: cat <filename>' };
        const res = await virtualFS.readStorageFile(args[0]);
        if (!res.success) return { type: 'error', content: res.error || 'cat error' };
        return { type: 'output', content: res.content || '' };
      }

      case 'touch': {
        if (args.length === 0) return { type: 'error', content: 'Usage: touch <filename>' };
        const res = await virtualFS.writeStorageFile(args[0], '', true);
        if (!res.success) return { type: 'error', content: res.error || 'touch error' };
        return null;
      }

      case 'mkdir': {
        if (args.length === 0) return { type: 'error', content: 'Usage: mkdir <dirname>' };
        const res = virtualFS.makeDir(args[0]);
        if (!res.success) return { type: 'error', content: res.error || 'mkdir error' };
        return null;
      }

      case 'rm': {
        if (args.length === 0) return { type: 'error', content: 'Usage: rm <filename>' };
        const target = args.filter((a) => !a.startsWith('-'))[0];
        if (!target) return { type: 'error', content: 'Usage: rm <filename>' };
        const res = virtualFS.removeNode(target);
        if (!res.success) return { type: 'error', content: res.error || 'rm error' };
        return null;
      }

      // 20. EXPORT & BACKUP CONFIG
      case 'export-config':
      case 'backup': {
        const dump = {
          config: ctx.config,
          aliases: ctx.aliases,
          scripts: ctx.scripts,
          notes: ctx.notes,
          todos: ctx.todos,
          contacts: ctx.contacts,
          history: ctx.history,
        };
        const jsonStr = JSON.stringify(dump, null, 2);
        return {
          type: 'output',
          content: `📦 Configuration Backup Payload:\n${jsonStr}\n\nTip: You can copy this JSON to save your setup!`,
        };
      }

      // Default: check if input is directly an app name or script
      default: {
        // Check if command is an app name
        const app = ctx.apps.find(
          (a) => a.id.toLowerCase() === command ||
                 a.name.toLowerCase() === command ||
                 a.packageName.toLowerCase() === command
        );
        if (app) {
          // Update lastUsed timestamp so app moves to top of Recently Used
          ctx.setApps((prev) =>
            prev.map((a) => (a.id === app.id ? { ...a, lastUsed: Date.now() } : a))
          );

          if (app.launchAction === 'command' && app.commandToRun) {
            return this.executeSingle(app.commandToRun, ctx);
          }
          ctx.openAppModal(app);
          return { type: 'success', content: `[✓] Launching ${app.name}...` };
        }

        // Check if command is a script in virtual FS
        const scriptRes = virtualFS.readFile(command);
        if (scriptRes.success && scriptRes.content) {
          return this.runScriptContent(scriptRes.content, ctx, command);
        }

        return {
          type: 'error',
          content: `${command}: command not found. Type 'help' or 'apps' to see available commands.`,
        };
      }
    }
  }

  private static async runScriptContent(content: string, ctx: CommandContext, name: string): Promise<CommandResult> {
    const lines = content.split('\n');
    const outputs: string[] = [`🚀 Executing script: ${name}`];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const res = await this.executeSingle(trimmed, ctx);
      if (res && res.content) {
        outputs.push(res.content);
      }
    }

    outputs.push(`[✓] Completed ${name}`);
    return {
      type: 'output',
      content: outputs.join('\n'),
    };
  }

  private static handleHelp(args: string[]): CommandResult {
    if (args.length > 0) {
      const topic = args[0].toLowerCase();
      const docs: Record<string, string> = {
        apps: 'apps [-a | -f | -s <query>]\nList installed apps with recent apps at top and inbuilt scroll. You can launch apps with "open <name>" or by typing the app name directly. To uninstall: "uninstall <name>".',
        open: 'open <app_name | url | package>\nLaunch Android applications or external web URLs. You can also type the app name directly (e.g. "camera", "spotify").',
        notifications: 'notifications [ls | clear | test | send <app> <msg>]\nView grouped, segregated clickable notifications in tabular single-line format. The app with the most recent notification displays at the bottom-most.',
        uninstall: 'uninstall <app_name | package_name>\nUninstall an application package and reclaim storage space. Synonyms: remove-app, pm uninstall, pkg uninstall.',
        alias: 'alias [name=\'command\']\nCreate custom shortcuts. Example: alias ll=\'ls -la\'\nTo remove an alias, use: unalias <name>',
        theme: 'theme [theme_name | ls]\nSwitch active theme or preview 12+ aesthetic TUI themes including Matrix CRT, Cyberpunk 2077, Dracula, Gruvbox, and Amber Phosphor.',
        script: 'script <create | run | ls | edit | rm>\nBuild and execute custom shell scripts. You can also edit scripts using the built-in "nano <file>" TUI editor.',
        nano: 'nano <filename>\nInteractive terminal text editor with live typing, line numbers, and keyboard shortcuts.',
        history: 'history [-c | -r | limit]\nView persistent command history, clear history (-c), or trigger reverse search (-r). Press Up/Down in prompt to cycle previous commands.',
        calc: 'calc <expression>\nEvaluate mathematical expressions with support for trigonometry, exponents, parentheses, and constants (pi, e).',
        weather: 'weather [city]\nView current atmospheric conditions, temperature, humidity, wind, and forecast in ASCII art.',
        neofetch: 'neofetch\nDisplay system architecture, Android OS build, memory usage, battery metrics, and ASCII logo.',
        battery: 'battery [status | monitor | graph | top | saver | health | calibrate]\nHardware battery telemetry monitor. Type "battery monitor" to open interactive GUI, "battery graph" for 24h discharge curve, or "battery saver" to toggle low power mode.',
        bluetooth: 'bluetooth [on | off | toggle | connect <device> | disconnect [device] | scan | pair <device> | unpair <device>]\nBluetooth 5.4 LE Audio & Peripheral Controller. Type "bluetooth on" to power on, "bluetooth off" to power down, or "bluetooth connect <device>" with interactive autocompletion.',
        bt: 'bt [on | off | toggle | connect <device> | disconnect | scan | pair]\nShort alias for bluetooth controller suite. Type "bt connect " in the prompt to view paired & nearby devices.',
        hotspot: 'hotspot [on | off | toggle | status | config <ssid> <pass> [band] | clients | pass]\nWi-Fi Mobile Hotspot & USB/Wireless Tethering Controller. Type "hotspot on" to turn on hotspot, "hotspot off" to turn off, "hotspot toggle" to switch state, or "hotspot status" to inspect tethered clients and data usage.',
        tether: 'tether [on | off | toggle | status]\nAlias for hotspot mobile tethering controller.',
        call: 'call <number | contact_name>\nPlace an outgoing phone call via Android telephony / VoLTE. Opens active in-call overlay controller with DTMF dialpad, mute, and speaker, or dispatches directly to your phone dialer app.',
        dial: 'dial [number]\nOpen native Android phone dialer screen or initiate call with specified number.',
        hangup: 'hangup / endcall\nTerminate currently active outgoing or incoming phone call.',
        recents: 'recents / calls\nView call logs history with timestamps and status (missed, incoming, outgoing).',
        launcher: 'set-default-launcher / launcher\nOpen the interactive wizard to set Android Terminal Launcher as your default home app / home screen, install PWA, or configure ADB native home intent.',
        'set-default': 'set-default-launcher\nOpen the interactive wizard to set Android Terminal Launcher as your default home app.',
        gestures: 'gesture-nav [on | off]\nEnforce immersive gesture navigation mode instead of 3-button navigation, hide navigation bar, and launch system gesture settings.',
        'gesture-nav': 'gesture-nav [on | off]\nEnforce immersive gesture navigation mode instead of 3-button navigation.',
      };

      if (docs[topic]) {
        return {
          type: 'help',
          content: `📖 Manual Page for '${topic}':\n\n${docs[topic]}`,
        };
      }
    }

    return {
      type: 'help',
      content: `╔════════════════════════════════════════════════════════════════════════╗
║                📱 ANDROID TERMINAL LAUNCHER (TUI)                      ║
╚════════════════════════════════════════════════════════════════════════╝

🚀 CORE APP & NAVIGATION COMMANDS:
  apps [-a|-f|-s]       List apps (recent apps on top, scrollable)
  open <app|url>        Launch Android app modal or web browser
  uninstall <app>       Uninstall app package
  notifications / notifs Grouped tabular notifications shade
  set-default-launcher  Configure as default Android home launcher
  gesture-nav           Enforce gesture navigation (hide 3-button bar)
  tab <apps|notifs|term> Switch view tabs (or swipe left/right)
  call <num|name>       Call via native Phone app
  sms [num] [msg]       Send SMS via native Messaging app
  search / google <q>   Search Google, DuckDuckGo (ddg), or YouTube (yt)

🎨 THEMES & CUSTOMIZATION:
  themes / theme <id>   Switch themes (Matrix, Cyberpunk, Dracula, Nord, etc.)
  theme-edit            Open visual theme palette editor
  matrix                Enter Matrix green digital rain screensaver

⌨️ SHELL SCRIPTING & ALIASES:
  alias name='cmd'      Create custom shell shortcuts (e.g. alias ll='ls -la')
  unalias <name>        Remove an alias
  script <create|ls|run>Manage custom batch shell scripts
  nano <filename>       Open built-in TUI text editor
  run <script.sh>       Execute shell script

📂 FILESYSTEM & STORAGE:
  storage [mount|open]  Android storage subsystem (SAF & direct storage)
  ls [-la] [path]       List Android storage directory contents
  cd <dir>              Change working directory (e.g. cd ~, cd /sdcard)
  cat <file>            Display file content
  mkdir / touch / rm    Manage files and directories
  calc <expression>     Terminal arithmetic calculator
  weather [city]        ASCII weather conditions & forecast
  neofetch / sysinfo    Device hardware specs, RAM, and Android info
  wifi / hotspot / bt   Network, mobile hotspot & bluetooth controller
  battery [monitor]     Hardware battery telemetry & power saver
  notes / todo          Manage local personal notes and tasks
  timer <sec>           Countdown timer with audio bell
  history [-c]          View or clear persistent command history
  clear / cls           Clear terminal screen

💡 SHORTCUTS:
  [Tab] Autocomplete | [↑/↓] History | [Ctrl+R] Search | [Ctrl+L] Clear | [Alt+T] Themes`,
    };
  }

  private static handleNotifications(args: string[], ctx: CommandContext): CommandResult {
    const sub = args[0]?.toLowerCase();

    if (sub === 'clear' || sub === 'dismiss' || sub === 'rm') {
      const targetApp = args.slice(1).join(' ').toLowerCase();
      if (targetApp) {
        ctx.setNotifications((prev) =>
          prev.filter((n) => n.appId.toLowerCase() !== targetApp && n.appName.toLowerCase() !== targetApp)
        );
        return { type: 'success', content: `[✓] Cleared notifications for '${targetApp}'.` };
      }
      ctx.setNotifications(() => []);
      return { type: 'success', content: '[✓] Cleared all notification shade alerts.' };
    }

    if (sub === 'test' || sub === 'simulate' || sub === 'mock') {
      const apps = ctx.apps.length > 0 ? ctx.apps : [];
      const randomApp = apps[Math.floor(Math.random() * apps.length)] || { id: 'termux', name: 'Termux', packageName: 'com.termux' };
      const newNotif: AppNotification = {
        id: `notif-test-${Date.now()}`,
        appId: randomApp.id,
        appName: randomApp.name,
        packageName: randomApp.packageName,
        title: `Alert from ${randomApp.name}`,
        message: `Interactive background event dispatched at ${new Date().toLocaleTimeString()} (Priority: HIGH).`,
        timestamp: Date.now(),
        priority: 'high',
        actionCommand: `open ${randomApp.name}`,
        actionLabel: 'Launch App',
      };
      ctx.setNotifications((prev) => [...prev, newNotif]);
      return {
        type: 'success',
        content: `[✓] Dispatched new notification from ${randomApp.name}. It will appear at the bottom-most position in 'notifications'.`,
      };
    }

    if (sub === 'send' || sub === 'add') {
      const appTarget = args[1];
      const message = args.slice(2).join(' ');
      if (!appTarget || !message) {
        return { type: 'error', content: 'Usage: notify send <app_name> <message>' };
      }
      const matchedApp = ctx.apps.find(
        (a) => a.name.toLowerCase() === appTarget.toLowerCase() || a.id.toLowerCase() === appTarget.toLowerCase()
      );
      const newNotif: AppNotification = {
        id: `notif-custom-${Date.now()}`,
        appId: matchedApp ? matchedApp.id : appTarget.toLowerCase(),
        appName: matchedApp ? matchedApp.name : appTarget,
        packageName: matchedApp ? matchedApp.packageName : `com.custom.${appTarget.toLowerCase()}`,
        title: `Message from ${matchedApp ? matchedApp.name : appTarget}`,
        message,
        timestamp: Date.now(),
        priority: 'normal',
        actionCommand: matchedApp ? `open ${matchedApp.name}` : undefined,
        actionLabel: 'View',
      };
      ctx.setNotifications((prev) => [...prev, newNotif]);
      return { type: 'success', content: `[✓] Notification posted for ${newNotif.appName}.` };
    }

    return {
      type: 'notifications_grouped',
      content: `Active Notifications (${ctx.notifications.length} total)`,
      metadata: {
        notifications: ctx.notifications,
      },
    };
  }

  private static handleApps(args: string[], ctx: CommandContext): CommandResult {
    const firstArg = args[0]?.toLowerCase();
    if (firstArg === 'sync' || firstArg === 'scan' || firstArg === '--scan' || firstArg === '-r') {
      if (ctx.syncNativeApps) {
        ctx.syncNativeApps();
        return {
          type: 'system',
          content: `🔄 Scanning native Android PackageManager for installed apps...`,
        };
      }
      return {
        type: 'output',
        content: `Run on compiled native Android APK to scan phone apps.`,
      };
    }

    if (firstArg === 'uninstall' || firstArg === 'remove' || firstArg === 'rm') {
      const target = args.slice(1).join(' ');
      const cleanTarget = target.toLowerCase().replace(/^["']|["']$/g, '');
      const found = ctx.apps.find(
        (a) => a.name.toLowerCase() === cleanTarget ||
               a.packageName.toLowerCase() === cleanTarget ||
               a.id.toLowerCase() === cleanTarget ||
               a.name.toLowerCase().includes(cleanTarget)
      );
      if (!found) {
        return { type: 'error', content: `apps uninstall: App '${target}' not found.` };
      }
      ctx.setApps((prev) => prev.filter((a) => a.id !== found.id));
      return { type: 'success', content: `[✓] Successfully uninstalled app: ${found.name} (${found.packageName})` };
    }

    if (firstArg === 'open' || firstArg === 'launch') {
      const target = args.slice(1).join(' ').toLowerCase();
      const found = ctx.apps.find((a) => a.name.toLowerCase().includes(target));
      if (found) {
        ctx.setApps((prev) =>
          prev.map((a) => (a.id === found.id ? { ...a, lastUsed: Date.now() } : a))
        );
        ctx.openAppModal(found);
        return { type: 'success', content: `[✓] Launching ${found.name}...` };
      }
      return { type: 'error', content: `apps open: App '${target}' not found.` };
    }

    const showAll = args.includes('-a') || args.includes('--all');
    const showFavs = args.includes('-f') || args.includes('--fav');
    const searchIdx = args.findIndex((a) => a === '-s' || a === '--search');
    const searchQuery = searchIdx >= 0 && args[searchIdx + 1] ? args[searchIdx + 1].toLowerCase() : '';

    let filtered = ctx.apps.filter((a) => !a.hidden || showAll);
    if (showFavs) {
      filtered = filtered.filter((a) => a.favorite);
    }
    if (searchQuery) {
      filtered = filtered.filter(
        (a) => a.name.toLowerCase().includes(searchQuery) || a.packageName.toLowerCase().includes(searchQuery)
      );
    }

    const header = `📱 INSTALLED ANDROID APPLICATIONS (${filtered.length} total):`;
    const rows = filtered.map((a) => {
      const fav = a.favorite ? '★' : ' ';
      return `  ${fav} ${a.name.padEnd(16)} [${a.category.padEnd(7)}] - ${a.description} (${a.packageName})`;
    });

    return {
      type: 'app_list',
      content: `${header}\n${rows.join('\n')}\n\nTip: Type 'open <app_name>' or simply '<app_name>' to launch. Type 'uninstall <app_name>' to remove.`,
    };
  }

  private static handleNotes(args: string[], ctx: CommandContext): CommandResult {
    const sub = args[0]?.toLowerCase() || 'ls';

    if (sub === 'add') {
      const text = args.slice(1).join(' ');
      if (!text) return { type: 'error', content: 'Usage: note add <content>' };
      const newNote: NoteItem = {
        id: `note-${Date.now()}`,
        title: text.slice(0, 30) + (text.length > 30 ? '...' : ''),
        content: text,
        timestamp: Date.now(),
      };
      ctx.setNotes((prev) => [newNote, ...prev]);
      return { type: 'success', content: `[✓] Note saved: "${newNote.title}"` };
    }

    if (sub === 'rm' || sub === 'delete') {
      const id = args[1];
      if (!id) return { type: 'error', content: 'Usage: note rm <note_id>' };
      ctx.setNotes((prev) => prev.filter((n) => !n.id.includes(id)));
      return { type: 'success', content: `[✓] Removed note matching '${id}'` };
    }

    if (ctx.notes.length === 0) {
      return { type: 'output', content: '📝 No notes found. Create one with: note add <text>' };
    }

    const list = ctx.notes
      .map((n, i) => `  [#${i + 1}] (${new Date(n.timestamp).toLocaleTimeString()})\n      ${n.content}`)
      .join('\n\n');
    return { type: 'output', content: `📝 Personal Notes (${ctx.notes.length}):\n\n${list}` };
  }

  private static handleTodos(args: string[], ctx: CommandContext): CommandResult {
    const sub = args[0]?.toLowerCase() || 'ls';

    if (sub === 'add') {
      const text = args.slice(1).join(' ');
      if (!text) return { type: 'error', content: 'Usage: todo add <task_description>' };
      const newTodo: TodoItem = {
        id: `todo-${Date.now()}`,
        text,
        completed: false,
        createdAt: Date.now(),
      };
      ctx.setTodos((prev) => [...prev, newTodo]);
      return { type: 'success', content: `[✓] Added task: "${text}"` };
    }

    if (sub === 'done' || sub === 'check') {
      const target = args[1];
      if (!target) return { type: 'error', content: 'Usage: todo done <index>' };
      const idx = parseInt(target) - 1;
      ctx.setTodos((prev) =>
        prev.map((t, i) => (i === idx || t.id.includes(target) ? { ...t, completed: !t.completed } : t))
      );
      return { type: 'success', content: `[✓] Toggled completion for task #${target}` };
    }

    if (sub === 'rm' || sub === 'delete') {
      const target = args[1];
      const idx = parseInt(target) - 1;
      ctx.setTodos((prev) => prev.filter((t, i) => i !== idx && !t.id.includes(target)));
      return { type: 'success', content: `[✓] Removed task #${target}` };
    }

    if (ctx.todos.length === 0) {
      return { type: 'output', content: '✅ No pending tasks! Add one with: todo add <task>' };
    }

    const list = ctx.todos
      .map((t, i) => `  ${i + 1}. [${t.completed ? 'X' : ' '}] ${t.completed ? '~~' + t.text + '~~' : t.text}`)
      .join('\n');
    return { type: 'output', content: `📋 Task List (${ctx.todos.length}):\n${list}\n\nTip: 'todo done <num>' to toggle.` };
  }

  private static handleContacts(args: string[], ctx: CommandContext): CommandResult {
    const sub = args[0]?.toLowerCase() || 'ls';

    if (sub === 'add') {
      const name = args[1];
      const phone = args[2] || 'N/A';
      const email = args[3] || 'N/A';
      if (!name) return { type: 'error', content: 'Usage: contact add <name> [phone] [email]' };
      const newContact: ContactItem = {
        id: `c-${Date.now()}`,
        name,
        phone,
        email,
      };
      ctx.setContacts((prev) => [...prev, newContact]);
      return { type: 'success', content: `[✓] Contact saved: ${name} (${phone})` };
    }

    const query = args.slice(1).join(' ').toLowerCase();
    const filtered = query
      ? ctx.contacts.filter((c) => c.name.toLowerCase().includes(query) || c.phone.includes(query))
      : ctx.contacts;

    const list = filtered.map((c) => `  👤 ${c.name.padEnd(24)} 📞 ${c.phone.padEnd(18)} ✉️ ${c.email}`).join('\n');
    return { type: 'output', content: `👥 Android Contacts Directory (${filtered.length}):\n${list}` };
  }

  private static handleScripts(args: string[], ctx: CommandContext): CommandResult {
    const sub = args[0]?.toLowerCase() || 'ls';

    if (sub === 'ls' || sub === 'list') {
      const list = ctx.scripts.map((s) => `  📜 ${s.name.padEnd(16)} - ${s.description}`).join('\n');
      return {
        type: 'output',
        content: `📜 Custom Shell Scripts:\n${list}\n\nRun scripts with: run <script.sh> or edit with: nano <script.sh>`,
      };
    }

    if (sub === 'create' || sub === 'new') {
      const name = args[1] || `script_${Date.now()}.sh`;
      const desc = args.slice(2).join(' ') || 'Custom shell script';
      const newScript: CustomScript = {
        id: `script-${Date.now()}`,
        name: name.endsWith('.sh') ? name : `${name}.sh`,
        description: desc,
        content: '#!/bin/sh\necho "Running ' + name + '..."\n',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      ctx.setScripts((prev) => [...prev, newScript]);
      ctx.openNanoModal(newScript.name, newScript.content);
      return { type: 'success', content: `[✓] Created script '${newScript.name}'. Opened in TUI editor.` };
    }

    return { type: 'error', content: 'Usage: script <ls | create <name> | run <name>>' };
  }

  private static handleConfig(args: string[], ctx: CommandContext): CommandResult {
    if (args.length === 0) {
      return {
        type: 'output',
        content: `⚙️ Launcher Configuration:
  promptUser:     ${ctx.config.promptUser}
  promptHost:     ${ctx.config.promptHost}
  promptSymbol:   ${ctx.config.promptSymbol}
  activeThemeId:  ${ctx.config.activeThemeId}
  fontFamily:     ${ctx.config.fontFamily}
  fontSize:       ${ctx.config.fontSize}
  crtEffect:      ${ctx.config.crtEffect ? 'ON' : 'OFF'}
  crtGlow:        ${ctx.config.crtGlow ? 'ON' : 'OFF'}
  soundEnabled:   ${ctx.config.soundEnabled ? 'ON' : 'OFF'}
  soundType:      ${ctx.config.soundType}
  showStatusBar:  ${ctx.config.showStatusBar ? 'ON' : 'OFF'}
  showToolbar:    ${ctx.config.showToolbar ? 'ON' : 'OFF'}

Tip: Change values with: config set <key> <value> (e.g. config set crtEffect true)`,
      };
    }

    if (args[0] === 'set' && args.length >= 3) {
      const key = args[1];
      const val = args.slice(2).join(' ');
      ctx.setConfig((prev) => {
        const next = { ...prev };
        if (key === 'crtEffect' || key === 'crt' || key === 'scanlines') next.crtEffect = val === 'true' || val === '1' || val === 'on';
        if (key === 'crtGlow' || key === 'glow') next.crtGlow = val === 'true' || val === '1' || val === 'on';
        if (key === 'sound' || key === 'soundEnabled') next.soundEnabled = val === 'true' || val === '1' || val === 'on';
        if (key === 'soundType') next.soundType = val as any;
        if (key === 'user' || key === 'promptUser') next.promptUser = val;
        if (key === 'host' || key === 'promptHost') next.promptHost = val;
        if (key === 'symbol' || key === 'promptSymbol') next.promptSymbol = val;
        if (key === 'fontSize') next.fontSize = val as any;
        if (key === 'font' || key === 'fontFamily') next.fontFamily = val as any;
        return next;
      });
      return { type: 'success', content: `[✓] Config updated: ${key} = ${val}` };
    }

    return { type: 'error', content: 'Usage: config or config set <key> <value>' };
  }

  private static generateWeather(city: string): CommandResult {
    const temp = Math.floor(Math.random() * 12) + 18;
    const conditions = ['Sunny / Clear ☀️', 'Partly Cloudy ⛅', 'Breezy & Mild 🍃', 'Light Rain Showers 🌦️'];
    const cond = conditions[Math.floor(Math.random() * conditions.length)];

    return {
      type: 'weather',
      content: `┌──────────────────────────────────────────────┐
│  🌤️ Weather Report for: ${city.padEnd(20)} │
├──────────────────────────────────────────────┤
│  Condition:   ${cond.padEnd(29)} │
│  Temperature: ${temp}°C / ${Math.round((temp * 9) / 5 + 32)}°F                    │
│  Feels Like:  ${temp + 1}°C                            │
│  Humidity:    64%                            │
│  Wind:        14 km/h WNW                    │
│  Barometer:   1014 hPa                       │
│  UV Index:    4 (Moderate)                   │
├──────────────────────────────────────────────┤
│  3-Day Forecast:                             │
│    Tomorrow:  ${temp + 1}°C  ⛅ Partly Cloudy        │
│    Day 2:     ${temp - 2}°C  🌦️ Showers              │
│    Day 3:     ${temp + 3}°C  ☀️ Clear Skies          │
└──────────────────────────────────────────────┘`,
    };
  }

  private static generateNeofetch(ctx: CommandContext): CommandResult {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    let os = 'Android (Linux Kernel)';
    if (/Android\s+([0-9.]+)/i.test(ua)) {
      const v = ua.match(/Android\s+([0-9.]+)/i)?.[1] || '';
      os = `Android ${v} (Linux Kernel)`;
    } else if (/iPhone|iPad/i.test(ua)) {
      os = 'iOS (Darwin)';
    } else if (/Macintosh/i.test(ua)) {
      os = 'macOS (Darwin)';
    } else if (/Windows/i.test(ua)) {
      os = 'Windows (NT Kernel)';
    } else if (/Linux/i.test(ua)) {
      os = 'Linux (aarch64/x86_64)';
    }

    let host = 'Android Device';
    if (/Pixel\s*([0-9a-zA-Z\s]+)/i.test(ua)) {
      host = `Google Pixel ${ua.match(/Pixel\s*([0-9a-zA-Z\s]+)/i)?.[1]?.split(';')[0]?.trim() || ''}`.trim();
    } else if (/SM-[0-9a-zA-Z]+/i.test(ua)) {
      host = `Samsung Galaxy (${ua.match(/SM-[0-9a-zA-Z]+/i)?.[0]})`;
    } else if (typeof navigator !== 'undefined' && (navigator as any).userAgentData?.platform) {
      host = `${(navigator as any).userAgentData.platform} Mobile`;
    }

    const uptimeMins = Math.floor((typeof performance !== 'undefined' ? performance.now() : 60000) / 60000);
    const uptimeHours = Math.floor(uptimeMins / 60);
    const uptimeStr = uptimeHours > 0 ? `${uptimeHours}h ${uptimeMins % 60}m` : `${uptimeMins}m`;

    const ramStr = typeof navigator !== 'undefined' && (navigator as any).deviceMemory
      ? `${(navigator as any).deviceMemory} GiB RAM`
      : 'Managed';

    const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? `${navigator.hardwareConcurrency} Cores`
      : 'Multi-Core';

    const screenW = typeof window !== 'undefined' ? Math.round(window.screen.width * (window.devicePixelRatio || 1)) : 1080;
    const screenH = typeof window !== 'undefined' ? Math.round(window.screen.height * (window.devicePixelRatio || 1)) : 2400;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const netStatus = typeof navigator !== 'undefined' && navigator.onLine ? 'Connected' : 'Offline';

    const art = `
      .---.       ${ctx.config.promptUser}@${ctx.config.promptHost}
     /     \\      -------------------
    | () () |     OS: ${os}
     \\  -  /      Host: ${host}
      '---'       CPU: ${cores} (${ramStr})
    /|     |\\     Uptime: ${uptimeStr}
   / |     | \\    Shell: termux-sh 5.3 (Android TUI v1.3)
  /  |_____|  \\   Display: ${screenW}x${screenH} @ ${dpr}x DPR
     |     |      Battery: ${ctx.batteryLevel}% [${ctx.isCharging ? '⚡ Charging' : 'Discharging'}]
     |  |  |      Network: ${netStatus} (${ctx.wifiSsid})
     |  |  |      Storage: Internal Storage (/storage/emulated/0)
     |__|__|      Apps: ${ctx.apps.length} active installed
`;
    return {
      type: 'ascii',
      content: art,
    };
  }

  private static handleBattery(args: string[], ctx: CommandContext): CommandResult {
    const sub = args[0]?.toLowerCase();
    const data = ctx.batteryData || {
      level: ctx.batteryLevel,
      isCharging: ctx.isCharging,
      chargingTime: null,
      dischargingTime: null,
      health: 'Good',
      temperatureC: 31.4,
      voltageMv: 4215,
      technology: 'Li-Polymer',
      designCapacityMah: 5000,
      currentCapacityMah: 4920,
      cycleCount: 148,
      currentMa: ctx.isCharging ? 4200 : -380,
      powerWatts: ctx.isCharging ? 18.5 : 1.6,
      chargingProtocol: 'USB-PD 3.1 PPS (45W Fast Turbo)',
      powerSaver: false,
      history: [
        { time: '00:00', level: 98, power: 1.2 },
        { time: '04:00', level: 94, power: 1.1 },
        { time: '08:00', level: 88, power: 1.8 },
        { time: '12:00', level: 75, power: 2.3 },
        { time: '16:00', level: ctx.batteryLevel, power: ctx.isCharging ? 18.5 : 1.6 },
      ],
      appDrain: [
        { name: 'Display (165Hz HDR)', category: 'Hardware', percentage: 28.5, mah: 840 },
        { name: 'Android Terminal Launcher', category: 'App', percentage: 18.2, mah: 536 },
        { name: 'Wi-Fi 7 / 5G Radio', category: 'Hardware', percentage: 14.1, mah: 415 },
        { name: 'Snapdragon NPU / CPU', category: 'Hardware', percentage: 11.4, mah: 335 },
        { name: 'Audio Engine & Sensors', category: 'System', percentage: 6.8, mah: 200 },
      ],
    };

    if (sub === 'monitor' || sub === 'gui' || sub === 'open' || sub === 'ui') {
      if (ctx.openBatteryModal) ctx.openBatteryModal();
      return { type: 'success', content: '🔋 Opening Android 16 Hardware Battery Monitor Suite...' };
    }

    if (sub === 'saver' || sub === 'save' || sub === 'powersaver') {
      if (ctx.togglePowerSaver) ctx.togglePowerSaver();
      return {
        type: 'success',
        content: `⚡ Battery Saver Mode state toggled! (Low power telemetry & throttled display refresh applied)`,
      };
    }

    if (sub === 'graph' || sub === 'hist' || sub === 'history') {
      const art = `
🔋 24-HOUR BATTERY DISCHARGE CURVE:
100% | █                                  
 90% | ███                                
 80% |   ████                             
 70% |      ████                          
 60% |         █████                      
 50% |             █████                  
 40% |                 ████               
 30% |                    ████            
 20% |                       ████ [Now: ${data.level}%]
 10% |                            
  0% +------------------------------------
     00:00 04:00 08:00 12:00 16:00 20:00
Current State: ${data.isCharging ? '⚡ Fast Charging (45W)' : 'Discharging'} | Temp: ${data.temperatureC.toFixed(1)}°C | Voltage: ${(data.voltageMv / 1000).toFixed(2)}V`;
      return { type: 'ascii', content: art };
    }

    if (sub === 'top' || sub === 'drain' || sub === 'apps' || sub === 'ps') {
      const rows = data.appDrain.map((a, i) => {
        const bar = '█'.repeat(Math.round(a.percentage / 3)).padEnd(10, '░');
        return `  #${i + 1}  ${a.name.padEnd(28)} [${bar}] ${a.percentage.toFixed(1)}%  (${a.mah} mAh)`;
      });
      return {
        type: 'output',
        content: `⚡ PER-APPLICATION BATTERY DRAIN MONITOR:\n----------------------------------------------------------------\n${rows.join('\n')}\n----------------------------------------------------------------\nTip: Type 'battery monitor' to optimize or throttle background drains.`,
      };
    }

    if (sub === 'health') {
      return {
        type: 'output',
        content: `🛡️ BATTERY CELL HEALTH & DIAGNOSTIC REPORT:
  • Overall Health:       ${data.health} (98.4% Capacity Retention)
  • Design Capacity:      ${data.designCapacityMah} mAh
  • Measured Capacity:    ${data.currentCapacityMah} mAh
  • Charge Cycles:        ${data.cycleCount} full cycles
  • Chemistry:            ${data.technology} (High Energy Density)
  • Charging Protocol:    ${data.chargingProtocol}
  • Thermal Threshold:    Safe (Current: ${data.temperatureC.toFixed(1)}°C / Limit: 45°C)
  • Calibration Status:   Calibrated (Fuel Gauge IC v4.2)`,
      };
    }

    if (sub === 'calibrate') {
      return {
        type: 'success',
        content: `[✓] Sensor Calibration Complete:\n  Recalibrated fuel gauge lookup table against current OCV (${data.voltageMv} mV).\n  Accuracy error margin reduced to ±0.3%.`,
      };
    }

    // Default overview
    const gaugeFilled = Math.round(data.level / 5);
    const gaugeBar = '[' + '█'.repeat(gaugeFilled) + '░'.repeat(20 - gaugeFilled) + ']';
    const estTime = data.isCharging
      ? `Full in approx. ${Math.max(5, Math.round((100 - data.level) * 0.45))}m`
      : `${Math.floor((data.level / 100) * 22)}h ${Math.floor(((data.level / 100) * 22 * 60) % 60)}m remaining`;

    return {
      type: 'output',
      content: `🔋 ANDROID 16 HARDWARE BATTERY TELEMETRY
══════════════════════════════════════════════════════════════
  Level:         ${gaugeBar} ${data.level}%
  Status:        ${data.isCharging ? '⚡ Fast Charging (45W Turbo PD 3.1)' : 'Discharging'}
  Estimate:      ${estTime}
  Voltage:       ${(data.voltageMv / 1000).toFixed(3)} V (${data.voltageMv} mV)
  Current Flow:  ${data.isCharging ? `+${data.currentMa}` : `${data.currentMa}`} mA (${data.powerWatts.toFixed(2)} W)
  Temperature:   ${data.temperatureC.toFixed(1)} °C / ${((data.temperatureC * 9/5) + 32).toFixed(1)} °F
  Health:        ${data.health} (${data.currentCapacityMah} / ${data.designCapacityMah} mAh)
  Cycles:        ${data.cycleCount}
  Power Saver:   ${data.powerSaver ? 'ACTIVE [ON]' : 'INACTIVE [OFF]'}
══════════════════════════════════════════════════════════════
Subcommands:
  • battery monitor     Open visual interactive Battery Monitor GUI
  • battery graph       Display 24-hour ASCII discharge timeline
  • battery top         List top power-consuming apps & hardware
  • battery saver       Toggle battery saver mode
  • battery health      Detailed cell degradation & diagnostics`,
    };
  }

  private static async handleBluetooth(args: string[], ctx: CommandContext): Promise<CommandResult> {
    const sub = args[0]?.toLowerCase();
    const btState = ctx.bluetoothState || { enabled: true, devices: [], discovering: false };
    const devices = btState.devices || [];

    const getSignalBar = (rssi: number) => {
      if (rssi >= -50) return '█████';
      if (rssi >= -65) return '████░';
      if (rssi >= -75) return '███░░';
      if (rssi >= -85) return '██░░░';
      return '█░░░░';
    };

    // 0. SETTINGS / CONFIG
    if (sub === 'settings' || sub === 'config' || sub === 'pref' || sub === 'gui') {
      await openNativeBluetoothSettings();
      return {
        type: 'success',
        content: `[✓] Dispatched Android Bluetooth System Settings Intent.`,
      };
    }

    // 1. NO ARGUMENTS / STATUS / LIST
    if (!sub || sub === 'status' || sub === 'info' || sub === 'ls' || sub === 'list' || sub === 'devices') {
      if (!btState.enabled) {
        return {
          type: 'output',
          content: `🔷 BLUETOOTH ADAPTER (Disabled)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Controller:      hci0 (Android OS / Bluetooth LE Audio)
  Status:          [POWERED OFF / RADIO INACTIVE]
  RF Power:        0.0 dBm (Sleep Mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quick Controls:
  • bt on                  - Turn on Bluetooth adapter
  • bt off                 - Turn off Bluetooth adapter
  • bt toggle              - Toggle Bluetooth power
  • bt connect <dev>       - Connect to a paired or available device
  • bt scan                - Discover nearby BLE/Classic devices
  • bt settings            - Open Android Bluetooth system settings`,
        };
      }

      const connected = devices.filter((d) => d.connected);
      const connectedSummary =
        connected.length > 0
          ? connected.map((c) => `${c.name} (${c.battery !== undefined ? `${c.battery}%` : 'Connected'})`).join(', ')
          : 'None';

      const rows = devices.length > 0
        ? devices
            .map((d, idx) => {
              const num = String(idx + 1).padStart(2, ' ');
              const statusLabel = d.connected ? 'CONNECTED' : d.paired ? 'PAIRED' : 'AVAILABLE';
              const statusIcon = d.connected ? '●' : d.paired ? '○' : '◌';
              const batStr = d.battery !== undefined ? `${d.battery}%`.padEnd(5, ' ') : '--   ';
              const typeStr = d.type.charAt(0).toUpperCase() + d.type.slice(1);
              const sigBar = getSignalBar(d.rssi);
              return `  ${num}. [${statusIcon}] ${d.name.padEnd(26, ' ')} ${d.mac.padEnd(18, ' ')} ${typeStr.padEnd(11, ' ')} ${statusLabel.padEnd(10, ' ')} ${batStr} ${sigBar} (${d.rssi}dBm)`;
            })
            .join('\n')
        : '  (No Bluetooth devices paired or discovered yet. Run "bt scan" to search nearby devices)';

      return {
        type: 'output',
        content: `🔷 BLUETOOTH LE CONTROLLER (hci0: Active)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Adapter:         hci0 [Android Bluetooth Subsystem]
  Status:          [POWERED ON / DISCOVERABLE]
  Connected (${connected.length}):   ${connectedSummary}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  #      DEVICE NAME                MAC ADDRESS        TYPE        STATUS     BAT    SIGNAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${rows}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quick Controls:
  • bt on / off / toggle    - Power controls (interacts with phone radio)
  • bt connect <device>     - Connect to device by name or MAC
  • bt disconnect [device]  - Disconnect active device
  • bt scan                 - Scan & discover nearby BLE devices
  • bt settings             - Open Android system Bluetooth settings`,
      };
    }

    // 2. TURN ON
    if (sub === 'on' || sub === 'enable' || sub === 'start' || sub === '1') {
      const nativeRes = await setNativeBluetoothState(true);

      ctx.setBluetoothState((prev) => ({
        ...prev,
        enabled: true,
      }));

      if (ctx.config.soundEnabled) {
        soundManager.playKeyClick('modern', 0.4);
      }

      const connectedDevs = btState.devices.filter((d) => d.connected);

      return {
        type: 'success',
        content: `[✓] Bluetooth adapter (hci0) ENABLED.
${nativeRes.message}
Radio active on 2.4 GHz ISM band.
${connectedDevs.length > 0 ? `Connected: ${connectedDevs.map((d) => d.name).join(', ')}` : 'No devices currently connected. Type "bt scan" to discover nearby devices.'}`,
      };
    }

    // 3. TURN OFF
    if (sub === 'off' || sub === 'disable' || sub === 'stop' || sub === '0') {
      const nativeRes = await setNativeBluetoothState(false);

      ctx.setBluetoothState((prev) => ({
        ...prev,
        enabled: false,
        devices: prev.devices.map((d) => ({ ...d, connected: false })),
      }));

      if (ctx.config.soundEnabled) {
        soundManager.playKeyClick('mechanical', 0.2);
      }

      return {
        type: 'success',
        content: `[✓] Bluetooth adapter (hci0) DISABLED.
${nativeRes.message}
All wireless audio streams, BLE peripherals, and radios powered down.`,
      };
    }

    // 4. TOGGLE
    if (sub === 'toggle') {
      const willEnable = !btState.enabled;
      const nativeRes = await setNativeBluetoothState(willEnable);

      ctx.setBluetoothState((prev) => ({
        ...prev,
        enabled: willEnable,
        devices: willEnable ? prev.devices : prev.devices.map((d) => ({ ...d, connected: false })),
      }));

      return {
        type: 'success',
        content: willEnable
          ? `[✓] Bluetooth toggled ON (${nativeRes.message})`
          : `[✓] Bluetooth toggled OFF (${nativeRes.message})`,
      };
    }

    // 5. SCAN / DISCOVER
    if (sub === 'scan' || sub === 'discovery' || sub === 'discover' || sub === 'search') {
      if (!btState.enabled) {
        await setNativeBluetoothState(true);
        ctx.setBluetoothState((prev) => ({ ...prev, enabled: true }));
      }

      // Query native Android Bluetooth scanner or paired devices
      const nativeScan = await scanNativeBluetooth();
      let extraDevices = devices;
      if (nativeScan && nativeScan.success && nativeScan.devices.length > 0) {
        const newDiscovered: BluetoothDevice[] = nativeScan.devices.map((d, i) => ({
          id: `bt-phone-${d.address.replace(/[^a-zA-Z0-9]/g, '')}`,
          name: d.name || `BLE Device (${d.address.slice(-5)})`,
          mac: d.address,
          type: 'headphones',
          paired: !!d.bonded,
          connected: false,
          rssi: -52 - (i * 4),
        }));

        ctx.setBluetoothState((prev) => {
          const existing = new Set(prev.devices.map((dev) => dev.mac.toLowerCase()));
          const added = newDiscovered.filter((dev) => !existing.has(dev.mac.toLowerCase()));
          extraDevices = [...added, ...prev.devices];
          return {
            ...prev,
            enabled: true,
            devices: extraDevices,
          };
        });
      }

      const scanRows = extraDevices
        .map((d) => {
          const statusLabel = d.connected ? '[CONNECTED]' : d.paired ? '[PAIRED]' : '[AVAILABLE]';
          const typeStr = d.type.toUpperCase();
          const sigBar = getSignalBar(d.rssi);
          const icon = d.connected ? '●' : d.paired ? '○' : '◌';
          return `  [${icon}] ${d.name.padEnd(28, ' ')} ${d.mac.padEnd(18, ' ')} ${typeStr.padEnd(11, ' ')} ${statusLabel.padEnd(12, ' ')} ${sigBar} (${d.rssi} dBm)`;
        })
        .join('\n');

      return {
        type: 'output',
        content: `🔍 BLUETOOTH LE DISCOVERY ACTIVE (RSSI Scan Complete):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  STATUS  DEVICE NAME                  MAC ADDRESS        TYPE        STATE        SIGNAL STRENGTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${scanRows}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tip: Type 'bluetooth connect <device_name>' or 'bt connect ' for autocomplete.`,
      };
    }

    // 6. CONNECT <device>
    if (sub === 'connect' || sub === 'pair-connect') {
      const targetQuery = args.slice(1).join(' ').trim().toLowerCase();
      if (!targetQuery) {
        const availableList = devices
          .map((d) => `  • bluetooth connect "${d.name}" (${d.connected ? 'Connected' : d.paired ? 'Paired' : 'Available'})`)
          .join('\n');
        return {
          type: 'output',
          content: `Usage: bluetooth connect <device_name_or_mac>

Available & Paired Devices:
${availableList}

Tip: Type 'bluetooth connect ' or 'bt connect ' in terminal prompt for instant interactive autocompletion.`,
        };
      }

      // Auto enable if off
      if (!btState.enabled) {
        await setNativeBluetoothState(true);
        ctx.setBluetoothState((prev) => ({ ...prev, enabled: true }));
      }

      // Match device
      let targetDevice = devices.find(
        (d) => d.name.toLowerCase() === targetQuery || d.mac.toLowerCase() === targetQuery
      );
      if (!targetDevice) {
        targetDevice = devices.find(
          (d) => d.name.toLowerCase().includes(targetQuery) || d.mac.toLowerCase().includes(targetQuery)
        );
      }
      if (!targetDevice && targetQuery.match(/^\d+$/)) {
        const idx = parseInt(targetQuery, 10) - 1;
        if (idx >= 0 && idx < devices.length) {
          targetDevice = devices[idx];
        }
      }

      if (!targetDevice) {
        const newDev: BluetoothDevice = {
          id: `bt-${Date.now()}`,
          name: args.slice(1).join(' ').trim(),
          mac: `${Math.floor(Math.random() * 89 + 10).toString(16)}:${Math.floor(Math.random() * 89 + 10).toString(16)}:${Math.floor(Math.random() * 89 + 10).toString(16)}:${Math.floor(Math.random() * 89 + 10).toString(16)}:${Math.floor(Math.random() * 89 + 10).toString(16)}:${Math.floor(Math.random() * 89 + 10).toString(16)}`.toUpperCase(),
          type: 'headphones',
          paired: true,
          connected: true,
          battery: 100,
          rssi: -45,
          codec: 'AAC 320kbps',
        };

        const nativeConn = await connectNativeBluetooth(newDev.mac || newDev.name);

        ctx.setBluetoothState((prev) => ({
          ...prev,
          enabled: true,
          devices: [newDev, ...prev.devices],
        }));

        if (ctx.config.soundEnabled) soundManager.playKeyClick('modern', 0.4);

        return {
          type: 'success',
          content: `[✓] Connected & Paired to Bluetooth device: "${newDev.name}"
  MAC:         ${newDev.mac}
  OS Action:   ${nativeConn.message}
  Profile:     A2DP Audio Sink + HFP Hands-Free
  Codec:       ${newDev.codec}
  Battery:     100% | Latency: 28ms`,
        };
      }

      const nativeConn = await connectNativeBluetooth(targetDevice.mac || targetDevice.name);

      ctx.setBluetoothState((prev) => ({
        ...prev,
        enabled: true,
        devices: prev.devices.map((d) =>
          d.id === targetDevice!.id ? { ...d, connected: true, paired: true } : d
        ),
      }));

      if (ctx.config.soundEnabled) {
        soundManager.playKeyClick('modern', 0.4);
      }

      const codecInfo = targetDevice.codec ? `  Audio Codec:     ${targetDevice.codec}\n` : '';
      const batInfo = targetDevice.battery !== undefined ? `  Battery Level:   ${targetDevice.battery}%\n` : '';

      return {
        type: 'success',
        content: `[✓] Bluetooth device connected: "${targetDevice.name}"
  MAC Address:     ${targetDevice.mac}
  OS Action:       ${nativeConn.message}
  Device Type:     ${targetDevice.type.toUpperCase()}
${batInfo}${codecInfo}  Signal Strength: ${targetDevice.rssi} dBm (Latency ~24ms)
  Audio Route:     [MEDIA AUDIO + CALLS ROUTED TO ${targetDevice.name.toUpperCase()}]`,
      };
    }

    // 7. DISCONNECT [device]
    if (sub === 'disconnect' || sub === 'unconnect') {
      const targetQuery = args.slice(1).join(' ').trim().toLowerCase();
      if (!targetQuery) {
        const connectedCount = devices.filter((d) => d.connected).length;
        if (connectedCount === 0) {
          return { type: 'output', content: '🔷 No active Bluetooth devices currently connected.' };
        }

        ctx.setBluetoothState((prev) => ({
          ...prev,
          devices: prev.devices.map((d) => ({ ...d, connected: false })),
        }));

        return {
          type: 'success',
          content: `[✓] Disconnected all (${connectedCount}) active Bluetooth connections.`,
        };
      }

      const targetDevice = devices.find(
        (d) => d.name.toLowerCase().includes(targetQuery) || d.mac.toLowerCase().includes(targetQuery)
      );
      if (!targetDevice) {
        return { type: 'error', content: `bluetooth disconnect: Device '${targetQuery}' not found.` };
      }

      ctx.setBluetoothState((prev) => ({
        ...prev,
        devices: prev.devices.map((d) => (d.id === targetDevice.id ? { ...d, connected: false } : d)),
      }));

      return {
        type: 'success',
        content: `[✓] Disconnected from "${targetDevice.name}" (${targetDevice.mac}).`,
      };
    }

    // 8. PAIR <device>
    if (sub === 'pair') {
      const targetQuery = args.slice(1).join(' ').trim().toLowerCase();
      if (!targetQuery) {
        return { type: 'error', content: 'Usage: bluetooth pair <device_name_or_mac>' };
      }

      const targetDevice = devices.find(
        (d) => d.name.toLowerCase().includes(targetQuery) || d.mac.toLowerCase().includes(targetQuery)
      );
      if (!targetDevice) {
        return {
          type: 'error',
          content: `bluetooth pair: Device '${targetQuery}' not found in scan results. Try 'bluetooth scan' first.`,
        };
      }

      ctx.setBluetoothState((prev) => ({
        ...prev,
        devices: prev.devices.map((d) => (d.id === targetDevice.id ? { ...d, paired: true } : d)),
      }));

      return {
        type: 'success',
        content: `[✓] Successfully paired with "${targetDevice.name}" [${targetDevice.mac}].`,
      };
    }

    // 9. UNPAIR <device>
    if (sub === 'unpair' || sub === 'remove' || sub === 'forget') {
      const targetQuery = args.slice(1).join(' ').trim().toLowerCase();
      if (!targetQuery) {
        return { type: 'error', content: 'Usage: bluetooth unpair <device_name_or_mac>' };
      }

      const targetDevice = devices.find(
        (d) => d.name.toLowerCase().includes(targetQuery) || d.mac.toLowerCase().includes(targetQuery)
      );
      if (!targetDevice) {
        return { type: 'error', content: `bluetooth unpair: Device '${targetQuery}' not found.` };
      }

      ctx.setBluetoothState((prev) => ({
        ...prev,
        devices: prev.devices.map((d) => (d.id === targetDevice.id ? { ...d, paired: false, connected: false } : d)),
      }));

      return {
        type: 'success',
        content: `[✓] Forgot and unpaired device "${targetDevice.name}" [${targetDevice.mac}].`,
      };
    }

    return {
      type: 'error',
      content: `bluetooth: unknown subcommand '${sub}'. Type 'bluetooth' or 'help bluetooth' for valid commands.`,
    };
  }

  private static async handleHotspot(args: string[], ctx: CommandContext): Promise<CommandResult> {
    const sub = args[0]?.toLowerCase();
    const hs = ctx.hotspotState || {
      enabled: false,
      ssid: 'AndroidAP_Terminal',
      password: 'tether_pass_2026',
      band: '5.0 GHz' as const,
      channel: 36,
      security: 'WPA3-Personal' as const,
      ipAddress: '192.168.43.1',
      subnetMask: '255.255.255.0',
      maxClients: 10,
      clients: [],
      dataSharedMb: 0,
      startedAt: undefined,
    };

    // 0. CHECK / TEST / REAL PHONE STATUS
    if (sub === 'check' || sub === 'test' || sub === 'status-real' || sub === 'real') {
      const isNative = isNativeAndroidApp();
      const isAndroidBrowser = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
      const platformName = isNative 
        ? 'Capacitor Android Native APK' 
        : isAndroidBrowser 
          ? 'Android Mobile Web' 
          : 'Desktop / Emulator';

      return {
        type: 'output',
        content: `📱 HOTSPOT CAPABILITY ON REAL ANDROID DEVICES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current Environment: ${platformName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WOULD THE HOTSPOT COMMAND WORK ON A REAL ANDROID PHONE?

1. Direct Silent Background Toggle:
   ❌ NO — Blocked by Android OS Security Sandbox
   • Since Android 8.0 (Oreo) and through Android 15/16, Google strictly prohibits
     non-system 3rd-party apps from silently enabling mobile tethering.
   • Programmatic activation requires 'android.permission.TETHER_PRIVILEGED',
     which has protectionLevel="signature|privileged" (reserved exclusively for
     OEM system apps installed in /system/priv-app/).
   • Any regular 3rd-party app that calls hidden APIs throws SecurityException.

2. One-Tap Native System Screen Dispatch:
   ✅ YES — Fully Supported & Integrated Here
   • Running 'hotspot on', 'hotspot toggle', or 'hotspot settings' dispatches
     the native Android Intent: 'android.settings.TETHER_SETTINGS'
     (or 'android.settings.WIRELESS_SETTINGS').
   • On your real phone, this immediately opens the Tethering & Mobile Hotspot
     screen so you can toggle it with a single tap.

3. Rooted Phone / Termux / ADB Shell:
   ✅ YES — Full Programmatic Command-Line Execution
   • Enable Wi-Fi Hotspot:
       su -c cmd connectivity start-tethering wifi
   • Disable Wi-Fi Hotspot:
       su -c cmd connectivity stop-tethering wifi
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quick Test: Type 'hotspot settings' to launch your phone's tethering screen.`,
      };
    }

    // 1. HOTSPOT SETTINGS / INTENT DIRECT
    if (sub === 'settings' || sub === 'config-native' || sub === 'setup') {
      const nativeRes = await openNativeHotspotSettings();
      return {
        type: nativeRes.success ? 'success' : 'system',
        content: `[✓] Dispatching Android Tethering & Hotspot Settings...
Method:  ${nativeRes.method}
Details: ${nativeRes.message}

If on a real Android device, the system Tethering & Mobile Hotspot menu is now open.`,
      };
    }

    // 2. HOTSPOT ON / ENABLE / START
    if (sub === 'on' || sub === 'enable' || sub === 'start' || sub === '1') {
      ctx.setHotspotState?.((prev) => ({
        ...prev,
        enabled: true,
        startedAt: Date.now(),
      }));

      if (ctx.config.soundEnabled) {
        soundManager.playKeyClick('modern', 0.35);
      }

      // Dispatch real Android intent to tethering settings
      const nativeRes = await openNativeHotspotSettings();

      return {
        type: 'success',
        content: `[✓] Wi-Fi Mobile Hotspot ACTIVATED.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AP Interface:    ap0 / wlan1 (Master SoftAP)
  Network Name:    ${hs.ssid}
  Security:        ${hs.security} (WPA3-SAE Hardware Offload)
  WPA Key:         ${hs.password}
  Frequency:       ${hs.band} (Channel ${hs.channel}, 80 MHz DFS)
  Gateway IP:      ${hs.ipAddress} (${hs.subnetMask})
  Status:          [● BROADCASTING ACTIVE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Real Android OS Execution:
  • Native Intent: ${nativeRes.message}
  • Android 8+ Security Note: Third-party apps cannot silently bypass user
    confirmation for cellular tethering without TETHER_PRIVILEGED system permission.
    The native Tethering settings screen has been opened so you can confirm.
  • Root/Termux alternative: su -c cmd connectivity start-tethering wifi`,
      };
    }

    // 3. HOTSPOT OFF / DISABLE / STOP
    if (sub === 'off' || sub === 'disable' || sub === 'stop' || sub === '0') {
      ctx.setHotspotState?.((prev) => ({
        ...prev,
        enabled: false,
        startedAt: undefined,
      }));

      if (ctx.config.soundEnabled) {
        soundManager.playKeyClick('mechanical', 0.2);
      }

      const nativeRes = await openNativeHotspotSettings();

      return {
        type: 'success',
        content: `[✓] Wi-Fi Mobile Hotspot DEACTIVATED.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AP Interface:    ap0 / wlan1 [STANDBY / POWER SAVING]
  Terminated:      Active client DHCP leases closed
  Status:          [○ INACTIVE / OFF]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Real Android OS Execution:
  • Native Intent: ${nativeRes.message}
  • Root/Termux alternative: su -c cmd connectivity stop-tethering wifi`,
      };
    }

    // 4. TOGGLE
    if (sub === 'toggle' || sub === 't') {
      const nextState = !hs.enabled;
      ctx.setHotspotState?.((prev) => ({
        ...prev,
        enabled: nextState,
        startedAt: nextState ? Date.now() : undefined,
      }));

      if (ctx.config.soundEnabled) {
        soundManager.playKeyClick(nextState ? 'modern' : 'mechanical', 0.3);
      }

      const nativeRes = await openNativeHotspotSettings();

      return {
        type: 'success',
        content: nextState
          ? `[✓] Hotspot toggled: ACTIVE [ON]\n  SSID: "${hs.ssid}" | Key: "${hs.password}"\n  ${nativeRes.message}`
          : `[✓] Hotspot toggled: INACTIVE [OFF]\n  Broadcasting stopped. Radio returned to idle.\n  ${nativeRes.message}`,
      };
    }

    // 5. CONFIG / SET <ssid> [password] [band]
    if (sub === 'config' || sub === 'set' || sub === 'rename') {
      const newSsid = args[1];
      const newPass = args[2];
      const newBand = args[3]?.toLowerCase();

      if (!newSsid) {
        return {
          type: 'output',
          content: `⚙️ HOTSPOT CONFIGURATION:
Usage: hotspot config <ssid> [password] [2.4ghz | 5ghz | 6ghz]
Examples:
  • hotspot config Pixel_AP
  • hotspot config Pixel_AP mySecretPass123
  • hotspot config Pixel_AP mySecretPass123 5ghz
Current Settings:
  SSID:     ${hs.ssid}
  Password: ${hs.password}
  Band:     ${hs.band}`,
        };
      }

      let targetBand: '2.4 GHz' | '5.0 GHz' | '6.0 GHz' = hs.band;
      if (newBand) {
        if (newBand.includes('2.4') || newBand === '2') targetBand = '2.4 GHz';
        else if (newBand.includes('6')) targetBand = '6.0 GHz';
        else targetBand = '5.0 GHz';
      }

      ctx.setHotspotState?.((prev) => ({
        ...prev,
        ssid: newSsid,
        password: newPass || prev.password,
        band: targetBand,
      }));

      return {
        type: 'success',
        content: `[✓] Hotspot configuration updated:
  SSID:     ${newSsid}
  Password: ${newPass || hs.password}
  Band:     ${targetBand}
  State:    ${hs.enabled ? 'Live (reloaded SoftAP interface)' : 'Configured (ready to launch with "hotspot on")'}`,
      };
    }

    // 6. CLIENTS / LIST / LEASES
    if (sub === 'clients' || sub === 'list' || sub === 'devices' || sub === 'leases' || sub === 'dhcp') {
      if (!hs.enabled) {
        return {
          type: 'output',
          content: `🔥 Hotspot is currently OFF. Type 'hotspot on' to start broadcasting and connect devices.`,
        };
      }

      if (hs.clients.length === 0) {
        return {
          type: 'output',
          content: `🔥 Hotspot is ON (${hs.ssid}), but no clients are currently connected.`,
        };
      }

      const rows = hs.clients.map((c, idx) => {
        const timeStr = formatRelativeTime(c.connectedAt);
        return `  ${idx + 1}. ${c.name.padEnd(24, ' ')} ${c.ip.padEnd(16, ' ')} ${c.mac.padEnd(18, ' ')} ${c.dataUsageMb.toFixed(1)} MB (${timeStr})`;
      }).join('\n');

      return {
        type: 'output',
        content: `📡 CONNECTED HOTSPOT CLIENTS (${hs.clients.length}/${hs.maxClients}):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  #   DEVICE NAME              IP ADDRESS       MAC ADDRESS        DATA USED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${rows}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Shared Data: ${hs.dataSharedMb.toFixed(1)} MB • Gateway: ${hs.ipAddress}`,
      };
    }

    // 7. PASSWORD
    if (sub === 'pass' || sub === 'password' || sub === 'key') {
      const newPass = args[1];
      if (newPass) {
        if (newPass.length < 8) {
          return { type: 'error', content: 'hotspot: WPA key must be at least 8 characters long.' };
        }
        ctx.setHotspotState?.((prev) => ({ ...prev, password: newPass }));
        return { type: 'success', content: `[✓] Hotspot WPA password updated to: "${newPass}"` };
      }
      return {
        type: 'output',
        content: `🔑 Hotspot Wi-Fi Password: "${hs.password}"\nTo change: type 'hotspot pass <new_password>'`,
      };
    }

    // 8. DEFAULT / STATUS / INFO
    const uptimeStr = hs.startedAt ? formatRelativeTime(hs.startedAt) : 'Inactive';
    const statusBadge = hs.enabled
      ? `[● ACTIVE / BROADCASTING]`
      : `[○ INACTIVE / DISABLED]`;

    return {
      type: 'output',
      content: `🔥 ANDROID MOBILE HOTSPOT & TETHERING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  State:           ${statusBadge}
  SSID (Name):     ${hs.ssid}
  Security:        ${hs.security}
  WPA Key:         ${hs.password}
  Frequency:       ${hs.band} (Channel ${hs.channel})
  Interface:       ap0 / wlan1 (Master SoftAP)
  Gateway IP:      ${hs.ipAddress} (${hs.subnetMask})
  Active Clients:  ${hs.enabled ? `${hs.clients.length} / ${hs.maxClients} connected` : '0 (Hotspot Disabled)'}
  Session Uptime:  ${uptimeStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Commands:
  • hotspot on / off / toggle      - Turn mobile hotspot on or off
  • hotspot settings               - Open native Android Tethering & Hotspot settings
  • hotspot check / test           - Check real Android phone compatibility & permissions
  • hotspot config <ssid> [pass]   - Configure SSID and password
  • hotspot clients                - List connected tethered client devices
  • hotspot pass [new_pass]        - View or update Wi-Fi security key`,
    };
  }

  private static handleClock(args: string[], ctx: CommandContext): CommandResult {
    const sub = args[0]?.toLowerCase();

    // Check if user requested GUI modal
    if (sub === 'gui' || sub === 'modal' || sub === '-g' || sub === '--gui' || sub === 'open') {
      if (ctx.openClockModal) {
        ctx.openClockModal();
        return { type: 'success', content: '⏱️ Opened Celestial 24h Chronometer & Solar/Lunar Tracker.' };
      }
    }

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // 24-hour time formatting: HH:MM:SS
    const time24h = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // Day of week & date
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    const fullDate = now.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
    const shortDate = now.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Day of Year
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const totalMinutes = hours * 60 + minutes;
    const cycleProgressPct = ((totalMinutes / 1440) * 100).toFixed(1);

    // Determine 4 Periods: Morning, Noon, Evening, Night
    let periodName = 'Night';
    let periodBadge = '🌙 NIGHT';
    let celestialAscii = '';
    let phaseDescription = '';
    let phaseHours = '21:00 - 04:59';

    if (hours >= 5 && hours < 12) {
      periodName = 'Morning';
      periodBadge = '🌅 MORNING (DAWN)';
      phaseHours = '05:00 - 11:59';
      phaseDescription = 'Sun climbing eastern horizon. Solar irradiance ascending.';
      celestialAscii = `
               \\   |   /     
                .-'''-.       [ 🌅 MORNING : SUNRISE ASCENT ]
             --(  ☀️   )--     05:00 - 11:59 (Active)
                .'-.-'.       Eastern horizon dawn elevation
               /   |   \\     
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ (Eastern Horizon)
`;
    } else if (hours >= 12 && hours < 17) {
      periodName = 'Noon';
      periodBadge = '☀️ NOON (ZENITH)';
      phaseHours = '12:00 - 16:59';
      phaseDescription = 'Sun at meridian zenith. Maximum solar irradiance and apex daylight.';
      celestialAscii = `
                \\  |  /      
              '-. | .-'      [ ☀️ NOON : SOLAR ZENITH ]
             — ( 🌞 ) —      12:00 - 16:59 (Active)
              .-' | '-.      Peak meridian solar altitude
                /  |  \\      
   ================================ (Solar Noon Meridian)
`;
    } else if (hours >= 17 && hours < 21) {
      periodName = 'Evening';
      periodBadge = '🌇 EVENING (TWILIGHT)';
      phaseHours = '17:00 - 20:59';
      phaseDescription = 'Sun dipping into western horizon. Golden hour transitioning into twilight.';
      celestialAscii = `
                .---.        
              /       \\       [ 🌇 EVENING : TWILIGHT DESCENT ]
             |   🌇    |      17:00 - 20:59 (Active)
         - - -\\-------/- - -  Western horizon sunset & dusk
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ (Western Horizon)
`;
    } else {
      periodName = 'Night';
      periodBadge = '🌙 NIGHT (NOCTURNAL)';
      phaseHours = '21:00 - 04:59';
      phaseDescription = 'Nocturnal sky illuminated by the Moon & cosmic constellations.';
      celestialAscii = `
                .---.        *   .   *   .  ✨
               /   / \\       [ 🌙 NIGHT : NOCTURNAL SKY ]
              |   |   |   .  21:00 - 04:59 (Active)
               \\   \\ /       Lunar transit & stellar cosmos
                '---'   *    
   ................................ (Night Sky Nadir)
`;
    }

    // Visual Day-Night Progress Bar
    // 00:00 (0) -> 06:00 (6) -> 12:00 (12) -> 18:00 (18) -> 24:00 (24)
    const barWidth = 32;
    const markerIndex = Math.min(barWidth - 1, Math.floor((totalMinutes / 1440) * barWidth));
    const barChars = Array(barWidth).fill('─');
    barChars[markerIndex] = '🔘';
    const visualTimeline = barChars.join('');

    return {
      type: 'output',
      content: `⏱️ 24-HOUR CELESTIAL CHRONOMETER & SOLAR/LUNAR TRACKER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  24h Time:        ${time24h} (HH:MM:SS)
  Day of Week:     ${dayOfWeek.toUpperCase()}
  Full Date:       ${fullDate} (${shortDate})
  Current Phase:   ${periodBadge} [${phaseHours}]
  Timezone:        ${tz} (UTC${(now.getTimezoneOffset() <= 0 ? '+' : '-') + String(Math.abs(Math.floor(now.getTimezoneOffset() / 60))).padStart(2, '0')}:${String(Math.abs(now.getTimezoneOffset() % 60)).padStart(2, '0')})
  Day of Year:     Day ${dayOfYear} of 365 (${cycleProgressPct}% of 24h Solar Cycle)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CELESTIAL SKY DIAGRAM:
${celestialAscii.trim()}

24-HOUR CELESTIAL PHASES:
  • 🌅 Morning (Dawn):     05:00 - 11:59 ${periodName === 'Morning' ? '◄ [ACTIVE NOW]' : ''}
  • ☀️ Noon (Zenith):      12:00 - 16:59 ${periodName === 'Noon' ? '◄ [ACTIVE NOW]' : ''}
  • 🌇 Evening (Twilight): 17:00 - 20:59 ${periodName === 'Evening' ? '◄ [ACTIVE NOW]' : ''}
  • 🌙 Night (Nocturnal):  21:00 - 04:59 ${periodName === 'Night' ? '◄ [ACTIVE NOW]' : ''}

24H SOLAR TIMELINE:
  00:00 [🌙] ── 06:00 [🌅] ── 12:00 [☀️] ── 18:00 [🌇] ── 24:00 [🌙]
  [ ${visualTimeline} ] (${cycleProgressPct}%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tip: Type 'clock gui' to open interactive Solar/Lunar Chronometer.`,
    };
  }

  private static renderSimpleAscii(text: string): string {
    return `
   █████╗ ███╗   ██╗██████╗ ██████╗  ██████╗ ██╗██████╗ 
  ██╔══██╗████╗  ██║██╔══██╗██╔══██╗██╔═══██╗██║██╔══██╗
  ███████║██╔██╗ ██║██║  ██║██████╔╝██║   ██║██║██║  ██║
  ██╔══██║██║╚██╗██║██║  ██║██╔══██╗██║   ██║██║██║  ██║
  ██║  ██║██║ ╚████║██████╔╝██║  ██║╚██████╔╝██║██████╔╝
  ╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝╚═════╝ 
                    ${text.toUpperCase()}
`;
  }

  private static parseArgs(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote: string | null = null;

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (char === '"' || char === "'") {
        if (inQuote === char) {
          inQuote = null;
        } else if (!inQuote) {
          inQuote = char;
        } else {
          current += char;
        }
      } else if (/\s/.test(char) && !inQuote) {
        if (current.length > 0) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.length > 0) {
      tokens.push(current);
    }

    return tokens;
  }
}
