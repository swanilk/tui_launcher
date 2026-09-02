/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AndroidApp, Alias, CustomScript, LauncherConfig, NoteItem, TodoItem, ContactItem, ActiveTimer, Theme, BatteryTelemetry, AppNotification } from '../types';
import { virtualFS } from './fileSystem';
import { soundManager } from './audio';

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
  togglePowerSaver?: () => void;
  setMatrixActive: (active: boolean) => void;
  batteryLevel: number;
  isCharging: boolean;
  batteryData?: BatteryTelemetry;
  wifiSsid: string;
}

export interface CommandResult {
  type: 'output' | 'error' | 'success' | 'system' | 'table' | 'ascii' | 'help' | 'weather' | 'app_list' | 'notifications_grouped';
  content: string;
  metadata?: Record<string, any>;
  clearScreen?: boolean;
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

        // Remove from apps list
        ctx.setApps((prev) => prev.filter((a) => a.id !== found.id));

        const freedMb = (Math.random() * 35 + 15).toFixed(1);
        return {
          type: 'success',
          content: `🗑️ UNINSTALL SUCCESSFUL:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Application:  ${found.name}
  Package:      ${found.packageName}
  Category:     ${found.category}
  Storage:      [✓] Reclaimed ${freedMb} MB app binaries and cache
  Status:       PACKAGE_REMOVED (Android Package Manager)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
App '${found.name}' has been uninstalled successfully.`,
          metadata: {
            action: 'uninstall',
            app: found,
          },
        };
      }

      // 3. PHONE CALL & SMS
      case 'call':
      case 'dial': {
        if (args.length === 0) {
          const contactHints = ctx.contacts.slice(0, 4).map((c) => `  • call "${c.name}" (${c.phone})`).join('\n');
          return {
            type: 'output',
            content: `📞 ANDROID PHONE CALL DIALER:
Usage: call <phone_number | contact_name>
Examples:
  • call 9614044766
  • call Alex
${contactHints}

Tip: Type 'call ' in the prompt to view contact autocompletion options.`,
          };
        }

        const rawQuery = args.join(' ').replace(/^["']|["']$/g, '').trim();
        const cleanQueryNum = rawQuery.replace(/[^\d+]/g, '');

        // Match contact by name or clean phone substring
        const matchedContact = ctx.contacts.find((c) => {
          const nameMatch = c.name.toLowerCase().includes(rawQuery.toLowerCase());
          const phoneClean = c.phone.replace(/[^\d+]/g, '');
          const phoneMatch = cleanQueryNum.length >= 3 && phoneClean.includes(cleanQueryNum);
          return nameMatch || phoneMatch;
        });

        const targetName = matchedContact ? matchedContact.name : 'Direct Dial';
        const targetPhone = matchedContact ? matchedContact.phone : rawQuery;
        const cleanPhone = targetPhone.replace(/[^\d+*#]/g, '');

        // Play dialer DTMF tone
        if (ctx.config.soundEnabled) {
          soundManager.playDialTone(ctx.config.soundVolume);
        }

        // Trigger native call intent (tel: scheme)
        if (typeof window !== 'undefined' && cleanPhone) {
          try {
            const telUri = `tel:${cleanPhone}`;
            const link = document.createElement('a');
            link.href = telUri;
            link.setAttribute('target', '_top');
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
              if (document.body.contains(link)) document.body.removeChild(link);
            }, 500);
          } catch {}
        }

        return {
          type: 'success',
          content: `📞 INITIATING OUTGOING CALL:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Target:       ${targetName}
  Phone Number: ${targetPhone}
  Protocol URI: tel:${cleanPhone}
  Telephony:    Android VoLTE / 5G Radio Interface Layer
  Status:       [✓] Dispatched to Device Phone Dialer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Connecting call... If dialer did not open automatically, tap below.`,
          metadata: {
            action: 'call',
            name: targetName,
            phone: targetPhone,
            cleanPhone,
            timestamp: Date.now(),
          },
        };
      }

      case 'sms':
      case 'msg': {
        if (args.length < 2) return { type: 'error', content: 'Usage: sms <contact_or_number> <message>' };
        const recipient = args[0];
        const msg = args.slice(1).join(' ');
        return {
          type: 'success',
          content: `✉️ SMS dispatched to ${recipient}:\n"${msg}"\n[Delivered via SMS Gateway]`,
        };
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

      case 'wifi': {
        return {
          type: 'output',
          content: `📶 Wi-Fi Status:\n  SSID:      ${ctx.wifiSsid}\n  Signal:    -48 dBm (Excellent, 98%)\n  Speed:     866 Mbps (Wi-Fi 6 802.11ax)\n  IP Addr:   192.168.1.142\n  Gateway:   192.168.1.1\n  DNS:       8.8.8.8, 1.1.1.1\n  Security:  WPA3-Personal`,
        };
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
          content: `🤖 Android OS Platform Version:
  Version:       Android 16 (Baklava)
  API Level:     36
  Build ID:      AP4A.260901.001.A1
  Kernel:        6.12.0-android16-aarch64
  Security Patch: 2026-09-01
  Architecture:  arm64-v8a (16KB page alignment)
  Features:      Predictive Back, Edge-to-Edge, 165Hz Display Sync, Hardware TUI`,
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
      case 'time': {
        const now = new Date();
        return {
          type: 'output',
          content: `📅 ${now.toDateString()} ${now.toLocaleTimeString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
        };
      }

      case 'uptime': {
        return {
          type: 'output',
          content: `⏱️ Uptime: 4 days, 18 hours, 32 mins | Load average: 0.42, 0.38, 0.35 | Tasks: 124 total`,
        };
      }

      case 'torch':
      case 'flashlight': {
        return { type: 'output', content: '🔦 Flashlight state toggled (Simulated LED ON)' };
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

      // 19. VIRTUAL FILESYSTEM (ls, cd, pwd, cat, touch, mkdir, rm)
      case 'pwd': {
        return { type: 'output', content: virtualFS.getPwd() };
      }

      case 'ls':
      case 'dir': {
        const showAll = args.includes('-a') || args.includes('-la') || args.includes('-al');
        const showLong = args.includes('-l') || args.includes('-la') || args.includes('-al');
        const targetPath = args.find((a) => !a.startsWith('-')) || '.';
        
        const res = virtualFS.listDir(targetPath);
        if (!res.success || !res.files) {
          return { type: 'error', content: res.error || 'ls: error' };
        }

        const items = res.files.filter((f) => showAll || !f.name.startsWith('.'));
        if (showLong) {
          const lines = items.map((f) => {
            const perm = f.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--';
            const size = (f.size || (f.children?.length || 0) * 4096).toString().padStart(6, ' ');
            const dateStr = new Date(f.updatedAt).toLocaleDateString();
            const colorName = f.type === 'dir' ? `📁 ${f.name}/` : `📄 ${f.name}`;
            return `${perm}  u0_a284 u0_a284  ${size}  ${dateStr}  ${colorName}`;
          });
          return { type: 'output', content: `total ${items.length}\n` + lines.join('\n') };
        } else {
          const names = items.map((f) => (f.type === 'dir' ? `📁 ${f.name}/` : `📄 ${f.name}`)).join('   ');
          return { type: 'output', content: names || '(empty directory)' };
        }
      }

      case 'cd': {
        const target = args[0] || '~';
        const res = virtualFS.changeDir(target);
        if (!res.success) {
          return { type: 'error', content: res.error || 'cd error' };
        }
        return null; // silent on success like bash
      }

      case 'cat':
      case 'read': {
        if (args.length === 0) return { type: 'error', content: 'Usage: cat <filename>' };
        const res = virtualFS.readFile(args[0]);
        if (!res.success) return { type: 'error', content: res.error || 'cat error' };
        return { type: 'output', content: res.content || '' };
      }

      case 'touch': {
        if (args.length === 0) return { type: 'error', content: 'Usage: touch <filename>' };
        const res = virtualFS.writeFile(args[0], '', true);
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
        open: 'open <app_name | url | package>\nLaunch simulated Android applications or external web URLs. You can also type the app name directly (e.g. "camera", "spotify").',
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
  call <num|name>       Simulated phone dialer
  sms <num> <msg>       Send text message
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

📂 FILESYSTEM & TOOLS:
  ls [-la] [path]       List directory contents
  cd <dir>              Change working directory (e.g. cd ~, cd /sdcard)
  cat <file>            Display file content
  mkdir / touch / rm    Manage files and directories
  calc <expression>     Terminal arithmetic calculator
  weather [city]        ASCII weather conditions & forecast
  neofetch / sysinfo    Device hardware specs, RAM, and Android info
  wifi / battery        Network & power telemetry
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
    const art = `
      .---.       ${ctx.config.promptUser}@${ctx.config.promptHost}
     /     \\      -------------------
    | () () |     OS: Android 16 (Baklava API 36) Edge-to-Edge
     \\  -  /      Kernel: Linux 6.12.0-android16-aarch64
      '---'       Host: Google Pixel 10 Pro / Snapdragon 8 Gen 5
    /|     |\\     Uptime: 5d 14h 28m
   / |     | \\    Shell: termux-sh 5.3 (Android 16 TUI)
  /  |_____|  \\   Memory: 4.2 GiB / 16.0 GiB (26%)
     |     |      Page Size: 16 KB (Compliant)
     |  |  |      Predictive Back: Enabled (API 36)
     |  |  |      Display: 3120x1440 @ 165Hz HDR
     |__|__|      Storage: 184.2 GB / 512.0 GB (36%)
                  Battery: ${ctx.batteryLevel}% [${ctx.isCharging ? '⚡ Fast Charging 45W' : 'Discharging'}]
                  Wi-Fi: ${ctx.wifiSsid} (-42 dBm Wi-Fi 7)
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
