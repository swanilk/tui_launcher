/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Theme, LauncherConfig, AndroidApp, CustomScript, Alias, ContactItem, RecentCall, BluetoothDevice, BluetoothState } from '../types';
import { tokenizeCommand, KNOWN_COMMANDS } from '../utils/syntaxHighlight';
import { soundManager } from '../utils/audio';
import { virtualFS } from '../utils/fileSystem';
import { 
  Phone, 
  PhoneCall, 
  Terminal, 
  AppWindow, 
  User, 
  Sparkles, 
  Trash2, 
  Play, 
  CornerDownLeft, 
  ArrowRight, 
  Clock, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  BluetoothSearching,
  Power
} from 'lucide-react';

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 86400000);
  return `${days}d ago`;
}

export interface SuggestionItem {
  id: string;
  type: 'app' | 'command' | 'contact' | 'file' | 'theme' | 'uninstall' | 'subcommand' | 'bluetooth';
  label: string;
  value: string;
  fullReplacement?: string;
  subtitle?: string;
  phoneNumber?: string;
  appObj?: AndroidApp;
  bluetoothDevice?: BluetoothDevice;
  actionKind?: 'open' | 'uninstall' | 'call' | 'exec' | 'bluetooth_connect' | 'bluetooth_toggle';
}

interface CommandLineProps {
  theme: Theme;
  config: LauncherConfig;
  apps: AndroidApp[];
  scripts: CustomScript[];
  aliases: Alias[];
  contacts?: ContactItem[];
  recentCalls?: RecentCall[];
  bluetoothState?: BluetoothState;
  history: string[];
  onSubmit: (command: string) => void;
  onClear: () => void;
  onOpenHistorySearch: () => void;
  onOpenThemeModal: () => void;
}

export const CommandLine: React.FC<CommandLineProps> = ({
  theme,
  config,
  apps,
  scripts,
  aliases,
  contacts = [],
  recentCalls = [],
  bluetoothState,
  history,
  onSubmit,
  onClear,
  onOpenHistorySearch,
  onOpenThemeModal,
}) => {
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [savedDraft, setSavedDraft] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState<number>(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Custom alias names
  const aliasNames = useMemo(() => aliases.map((a) => a.name), [aliases]);

  // Generate tokens for syntax highlighting
  const tokens = useMemo(() => tokenizeCommand(input, aliasNames), [input, aliasNames]);

  // Keep input focused
  useEffect(() => {
    if (config.autoFocusInput) {
      inputRef.current?.focus();
    }
  }, [config.autoFocusInput]);

  // All possible autocomplete candidates for 1st word
  const allCandidates = useMemo(() => {
    const appNames = apps.map((a) => a.name.toLowerCase());
    const scriptNames = scripts.map((s) => s.name);
    const fsFiles = (virtualFS.listDir('.').files || []).map((f) => (f.type === 'dir' ? `${f.name}/` : f.name));
    const commandList = Array.from(KNOWN_COMMANDS);
    return Array.from(new Set([...commandList, ...aliasNames, ...appNames, ...scriptNames, ...fsFiles]));
  }, [apps, scripts, aliasNames]);

  // Calculate suggestions
  useEffect(() => {
    const trimmed = input.trimStart();
    if (!trimmed) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // 1. Check if user is typing an "open", "launch", or "start" command
    const openMatch = trimmed.match(/^(open|launch|start|app\s+open)\s*(.*)$/i);
    if (openMatch) {
      const query = (openMatch[2] || '').trim().toLowerCase();
      const matchedApps = query
        ? apps.filter(
            (a) =>
              a.name.toLowerCase().includes(query) ||
              a.packageName.toLowerCase().includes(query) ||
              a.category.toLowerCase().includes(query)
          )
        : apps;

      const items: SuggestionItem[] = matchedApps.slice(0, 8).map((a) => ({
        id: `app-open-${a.id}`,
        type: 'app',
        label: a.name,
        subtitle: `${a.packageName} • [${a.category}]`,
        value: a.name,
        fullReplacement: `open ${a.name}`,
        appObj: a,
        actionKind: 'open',
      }));

      // If user typed only "open" with no args yet
      if (!query) {
        items.unshift({
          id: 'cmd-open-help',
          type: 'command',
          label: 'open <app_name | url>',
          subtitle: 'Launch Android app or web URL',
          value: 'open ',
          fullReplacement: 'open ',
        });
      }

      setSuggestions(items);
      setSelectedSuggestionIdx(0);
      setShowSuggestions(items.length > 0);
      return;
    }

    // 2. Check if user is typing "uninstall", "remove-app", "pm uninstall", "pkg uninstall"
    const uninstallMatch = trimmed.match(/^(uninstall|remove-app|pm\s+uninstall|pkg\s+uninstall)\s*(.*)$/i);
    if (uninstallMatch) {
      const query = (uninstallMatch[2] || '').trim().toLowerCase();
      const matchedApps = query
        ? apps.filter(
            (a) =>
              a.name.toLowerCase().includes(query) ||
              a.packageName.toLowerCase().includes(query) ||
              a.category.toLowerCase().includes(query)
          )
        : apps;

      const items: SuggestionItem[] = matchedApps.slice(0, 8).map((a) => ({
        id: `app-uninstall-${a.id}`,
        type: 'uninstall',
        label: a.name,
        subtitle: `Remove ${a.packageName}`,
        value: a.name,
        fullReplacement: `uninstall ${a.name}`,
        appObj: a,
        actionKind: 'uninstall',
      }));

      if (!query) {
        items.unshift({
          id: 'cmd-uninstall-help',
          type: 'command',
          label: 'uninstall <app_name | package>',
          subtitle: 'Remove app package from launcher',
          value: 'uninstall ',
          fullReplacement: 'uninstall ',
        });
      }

      setSuggestions(items);
      setSelectedSuggestionIdx(0);
      setShowSuggestions(items.length > 0);
      return;
    }

    // 3. Check if user is typing a phone call or dial command: "call" or "dial"
    const callMatch = trimmed.match(/^(call|dial)(\s+(.*))?$/i);
    if (callMatch) {
      const query = (callMatch[3] ? callMatch[3].trim() : '').toLowerCase();
      const cleanDigits = query.replace(/\D/g, '');
      const items: SuggestionItem[] = [];

      if (!query) {
        // NO INPUT PROVIDED: The inline suggestions MUST start with the MOST RECENT CALLS!
        const sortedRecent = [...recentCalls].sort((a, b) => b.timestamp - a.timestamp);
        
        sortedRecent.slice(0, 7).forEach((rc) => {
          const typeBadge = rc.type === 'missed' ? 'MISSED' : rc.type === 'incoming' ? 'INCOMING' : 'OUTGOING';
          items.push({
            id: `recent-${rc.id}`,
            type: 'contact',
            label: rc.name,
            subtitle: `🕒 ${formatTimeAgo(rc.timestamp)} • ${rc.phone} [${typeBadge}${rc.duration ? ` • ${rc.duration}` : ''}]`,
            phoneNumber: rc.phone,
            value: rc.phone,
            fullReplacement: `call ${rc.phone}`,
            actionKind: 'call',
          });
        });

        // Add remaining contacts from directory not present in recent calls
        const recentPhones = new Set(sortedRecent.map((r) => r.phone.replace(/\D/g, '')));
        const otherContacts = contacts.filter((c) => !recentPhones.has(c.phone.replace(/\D/g, '')));
        otherContacts.slice(0, 4).forEach((c) => {
          items.push({
            id: `contact-${c.id}`,
            type: 'contact',
            label: c.name,
            subtitle: `${c.phone} • Directory`,
            phoneNumber: c.phone,
            value: c.phone,
            fullReplacement: `call ${c.phone}`,
            actionKind: 'call',
          });
        });

        // If typed exactly "call" with no trailing space, offer command helper at the top
        if (trimmed.toLowerCase() === 'call' || trimmed.toLowerCase() === 'dial') {
          items.unshift({
            id: 'cmd-call',
            type: 'command',
            label: `${trimmed.toLowerCase()} <number | name>`,
            subtitle: `Recent Calls & Dialer (${sortedRecent.length} recents available)`,
            value: `${trimmed.toLowerCase()} `,
            fullReplacement: `${trimmed.toLowerCase()} `,
          });
        }
      } else {
        // QUERY PROVIDED: Prioritize matching recent calls first, then contacts
        const sortedRecent = [...recentCalls].sort((a, b) => b.timestamp - a.timestamp);
        const matchingRecent = sortedRecent.filter((rc) => {
          const nameMatches = rc.name.toLowerCase().includes(query);
          const phoneClean = rc.phone.replace(/\D/g, '');
          const phoneMatches = cleanDigits.length > 0 && phoneClean.includes(cleanDigits);
          return nameMatches || phoneMatches;
        });

        const seenPhones = new Set<string>();

        matchingRecent.forEach((rc) => {
          seenPhones.add(rc.phone.replace(/\D/g, ''));
          const typeBadge = rc.type === 'missed' ? 'MISSED' : rc.type === 'incoming' ? 'INCOMING' : 'OUTGOING';
          items.push({
            id: `recent-match-${rc.id}`,
            type: 'contact',
            label: rc.name,
            subtitle: `🕒 Recent (${formatTimeAgo(rc.timestamp)}) • ${rc.phone} [${typeBadge}]`,
            phoneNumber: rc.phone,
            value: rc.phone,
            fullReplacement: `call ${rc.phone}`,
            actionKind: 'call',
          });
        });

        // Match remaining contacts
        const matchingContacts = contacts.filter((c) => {
          const phoneClean = c.phone.replace(/\D/g, '');
          if (seenPhones.has(phoneClean)) return false;
          const nameMatches = c.name.toLowerCase().includes(query);
          const phoneMatches = cleanDigits.length > 0 && phoneClean.includes(cleanDigits);
          const emailMatches = c.email.toLowerCase().includes(query);
          return nameMatches || phoneMatches || emailMatches;
        });

        matchingContacts.forEach((c) => {
          seenPhones.add(c.phone.replace(/\D/g, ''));
          items.push({
            id: `contact-match-${c.id}`,
            type: 'contact',
            label: c.name,
            subtitle: `${c.phone} • Directory`,
            phoneNumber: c.phone,
            value: c.phone,
            fullReplacement: `call ${c.phone}`,
            actionKind: 'call',
          });
        });

        // If user typed custom digits and not already an exact match
        if (cleanDigits.length >= 3 && !seenPhones.has(cleanDigits)) {
          items.unshift({
            id: `direct-dial-${cleanDigits}`,
            type: 'contact',
            label: `Dial ${query}`,
            subtitle: 'Direct Number',
            phoneNumber: query,
            value: query,
            fullReplacement: `call ${query}`,
            actionKind: 'call',
          });
        }
      }

      setSuggestions(items);
      setSelectedSuggestionIdx(0);
      setShowSuggestions(items.length > 0);
      return;
    }

    // 4. Check if user is typing a bluetooth command: "bluetooth", "bt", "bluetoothctl", "bluez"
    const btMatch = trimmed.match(/^(bluetooth|bt|bluetoothctl|bluez)(\s+(.*))?$/i);
    if (btMatch) {
      const btCmd = btMatch[1].toLowerCase();
      const rest = (btMatch[3] ? btMatch[3].trim() : '').toLowerCase();
      const devices = bluetoothState?.devices || [];
      const isEnabled = bluetoothState?.enabled ?? true;
      const items: SuggestionItem[] = [];

      const getDeviceSubtitle = (d: BluetoothDevice) => {
        const status = d.connected ? '● CONNECTED' : d.paired ? '○ PAIRED' : '◌ AVAILABLE';
        const typeStr = d.type.toUpperCase();
        const bat = d.battery !== undefined ? ` • 🔋${d.battery}%` : '';
        const codec = d.codec ? ` • ${d.codec}` : '';
        const rssi = ` • ${d.rssi}dBm`;
        return `${status} • ${d.mac} • ${typeStr}${bat}${codec}${rssi}`;
      };

      // Case 4A: User is typing "bluetooth connect" or "bt connect" (with or without a device search query)
      const connectMatch = trimmed.match(/^(bluetooth|bt|bluetoothctl|bluez)\s+connect(\s+(.*))?$/i);
      if (connectMatch) {
        const query = (connectMatch[3] ? connectMatch[3].trim() : '').toLowerCase();

        // Filter and sort: connected & paired devices first, then available nearby devices
        const matchedDevices = devices.filter((d) => {
          if (!query) return true;
          return (
            d.name.toLowerCase().includes(query) ||
            d.mac.toLowerCase().includes(query) ||
            d.type.toLowerCase().includes(query)
          );
        });

        // Sort: connected -> paired -> available
        const sorted = [...matchedDevices].sort((a, b) => {
          if (a.connected && !b.connected) return -1;
          if (!a.connected && b.connected) return 1;
          if (a.paired && !b.paired) return -1;
          if (!a.paired && b.paired) return 1;
          return 0;
        });

        sorted.forEach((d) => {
          const isQuoted = d.name.includes(' ') ? `"${d.name}"` : d.name;
          items.push({
            id: `bt-dev-${d.id}`,
            type: 'bluetooth',
            label: d.name,
            subtitle: getDeviceSubtitle(d),
            value: isQuoted,
            fullReplacement: `${btCmd} connect ${isQuoted}`,
            bluetoothDevice: d,
            actionKind: 'bluetooth_connect',
          });
        });

        if (!query) {
          items.unshift({
            id: 'cmd-bt-connect-help',
            type: 'command',
            label: `${btCmd} connect <device_name>`,
            subtitle: `Connect to Paired or Available Bluetooth Audio/Peripherals (${devices.length} devices)`,
            value: `${btCmd} connect `,
            fullReplacement: `${btCmd} connect `,
          });
        }

        setSuggestions(items);
        setSelectedSuggestionIdx(0);
        setShowSuggestions(items.length > 0);
        return;
      }

      // Case 4B: User is typing "bluetooth disconnect"
      const disconnectMatch = trimmed.match(/^(bluetooth|bt|bluetoothctl|bluez)\s+disconnect(\s+(.*))?$/i);
      if (disconnectMatch) {
        const query = (disconnectMatch[3] ? disconnectMatch[3].trim() : '').toLowerCase();
        const connectedDevices = devices.filter((d) => d.connected);

        connectedDevices
          .filter((d) => !query || d.name.toLowerCase().includes(query) || d.mac.toLowerCase().includes(query))
          .forEach((d) => {
            const isQuoted = d.name.includes(' ') ? `"${d.name}"` : d.name;
            items.push({
              id: `bt-disconn-${d.id}`,
              type: 'bluetooth',
              label: d.name,
              subtitle: `Active Link • ${d.mac} • ${d.battery !== undefined ? `🔋${d.battery}%` : 'Connected'}`,
              value: isQuoted,
              fullReplacement: `${btCmd} disconnect ${isQuoted}`,
              bluetoothDevice: d,
              actionKind: 'bluetooth_connect',
            });
          });

        items.unshift({
          id: 'cmd-bt-disconn-all',
          type: 'command',
          label: `${btCmd} disconnect`,
          subtitle: 'Disconnect all active Bluetooth links',
          value: `${btCmd} disconnect`,
          fullReplacement: `${btCmd} disconnect`,
        });

        setSuggestions(items);
        setSelectedSuggestionIdx(0);
        setShowSuggestions(items.length > 0);
        return;
      }

      // Case 4C: User typed "bluetooth" or "bt" alone (or with subcommands in progress)
      if (!rest || ['on', 'off', 'toggle', 'scan', 'devices', 'pair', 'unpair', 'status', 'connect', 'disconnect'].some((s) => s.startsWith(rest))) {
        // Quick toggle / on / off power
        items.push({
          id: 'bt-toggle',
          type: 'subcommand',
          label: `${btCmd} ${isEnabled ? 'off' : 'on'}`,
          subtitle: `Power ${isEnabled ? 'OFF' : 'ON'} Bluetooth Adapter (Radio is ${isEnabled ? 'ACTIVE / 2.4GHz' : 'SLEEP / DISABLED'})`,
          value: `${btCmd} ${isEnabled ? 'off' : 'on'}`,
          fullReplacement: `${btCmd} ${isEnabled ? 'off' : 'on'}`,
          actionKind: 'bluetooth_toggle',
        });

        // Connect subcommand with interactive device list
        items.push({
          id: 'bt-connect-sub',
          type: 'subcommand',
          label: `${btCmd} connect <device>`,
          subtitle: `Connect to paired/available devices (${devices.length} nearby)`,
          value: `${btCmd} connect `,
          fullReplacement: `${btCmd} connect `,
        });

        // Scan subcommand
        items.push({
          id: 'bt-scan-sub',
          type: 'subcommand',
          label: `${btCmd} scan`,
          subtitle: 'Discover nearby Bluetooth LE and Classic peripherals',
          value: `${btCmd} scan`,
          fullReplacement: `${btCmd} scan`,
        });

        // Disconnect subcommand
        items.push({
          id: 'bt-disconnect-sub',
          type: 'subcommand',
          label: `${btCmd} disconnect`,
          subtitle: 'Disconnect active Bluetooth audio or peripherals',
          value: `${btCmd} disconnect`,
          fullReplacement: `${btCmd} disconnect`,
        });

        // List devices subcommand
        items.push({
          id: 'bt-devices-sub',
          type: 'subcommand',
          label: `${btCmd} devices`,
          subtitle: 'View detailed device table, MACs, codecs, and battery levels',
          value: `${btCmd} devices`,
          fullReplacement: `${btCmd} devices`,
        });

        // Also append top paired/connected devices for single-click connect
        devices.slice(0, 4).forEach((d) => {
          const isQuoted = d.name.includes(' ') ? `"${d.name}"` : d.name;
          items.push({
            id: `bt-quick-${d.id}`,
            type: 'bluetooth',
            label: d.name,
            subtitle: `${d.connected ? '● Connected' : d.paired ? '○ Paired' : '◌ Available'} • ${d.mac}`,
            value: isQuoted,
            fullReplacement: `${btCmd} connect ${isQuoted}`,
            bluetoothDevice: d,
            actionKind: 'bluetooth_connect',
          });
        });

        const filteredItems = rest
          ? items.filter((item) => item.label.toLowerCase().includes(rest) || item.value.toLowerCase().includes(rest))
          : items;

        setSuggestions(filteredItems.length > 0 ? filteredItems : items);
        setSelectedSuggestionIdx(0);
        setShowSuggestions(true);
        return;
      }
    }

    const words = trimmed.split(/\s+/);
    const lastWord = words[words.length - 1];

    if (words.length === 1) {
      // Direct command or direct app name autocompletion
      const matches = allCandidates
        .filter((c) => c.toLowerCase().startsWith(lastWord.toLowerCase()) && c.toLowerCase() !== lastWord.toLowerCase())
        .slice(0, 8);

      const items: SuggestionItem[] = matches.map((m) => {
        const matchedApp = apps.find((a) => a.name.toLowerCase() === m.toLowerCase());
        let type: SuggestionItem['type'] = 'command';
        let actionKind: SuggestionItem['actionKind'] = undefined;
        let subtitle: string | undefined = undefined;

        if (matchedApp) {
          type = 'app';
          actionKind = 'open';
          subtitle = `${matchedApp.packageName} • [Launch Direct]`;
        } else if (scripts.some((s) => s.name === m)) {
          type = 'file';
          subtitle = 'Virtual Shell Script';
        }

        return {
          id: `cmd-${m}`,
          type,
          label: matchedApp ? matchedApp.name : m,
          subtitle,
          value: matchedApp ? matchedApp.name : m,
          fullReplacement: matchedApp ? `${matchedApp.name}` : `${m} `,
          appObj: matchedApp,
          actionKind,
        };
      });

      setSuggestions(items);
      setSelectedSuggestionIdx(0);
      setShowSuggestions(items.length > 0);
    } else {
      // Autocompleting arguments, files, or subcommands
      const prevWord = words[words.length - 2].toLowerCase();
      if (['cat', 'nano', 'vim', 'edit', 'run', 'rm', 'ls'].includes(prevWord)) {
        const fsFiles = (virtualFS.listDir('.').files || [])
          .map((f) => (f.type === 'dir' ? `${f.name}/` : f.name))
          .filter((f) => f.toLowerCase().startsWith(lastWord.toLowerCase()) && f !== lastWord)
          .map((f) => ({
            id: `file-${f}`,
            type: 'file' as const,
            label: f,
            value: f,
          }));
        setSuggestions(fsFiles);
        setShowSuggestions(fsFiles.length > 0);
      } else if (prevWord === 'theme') {
        const themeMatches = [
          'matrix-crt',
          'cyberpunk-2077',
          'termux-green',
          'dracula',
          'nord',
          'gruvbox-dark',
          'amber-phosphor',
          'catppuccin-mocha',
          'monokai-pro',
          'gameboy-retro',
        ]
          .filter((t) => t.startsWith(lastWord.toLowerCase()))
          .map((t) => ({
            id: `theme-${t}`,
            type: 'theme' as const,
            label: t,
            value: t,
            fullReplacement: `theme ${t}`,
          }));
        setSuggestions(themeMatches);
        setShowSuggestions(themeMatches.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }
  }, [input, allCandidates, apps, contacts, recentCalls, bluetoothState, scripts]);

  // Compute Inline Ghost Suggestion (Zsh/Fish style)
  const inlineGhostText = useMemo(() => {
    if (!input || !input.trim()) return '';

    // If we have active suggestions, use the top suggestion's replacement
    if (suggestions.length > 0) {
      const top = suggestions[selectedSuggestionIdx % suggestions.length] || suggestions[0];
      const targetStr = top.fullReplacement || top.value;

      if (targetStr && targetStr.toLowerCase().startsWith(input.toLowerCase())) {
        return targetStr.slice(input.length);
      }
    }

    // Fallback: check recent command history matching current input
    const historyMatch = history.slice().reverse().find((h) => h.toLowerCase().startsWith(input.toLowerCase()) && h !== input);
    if (historyMatch) {
      return historyMatch.slice(input.length);
    }

    // Fallback: check all candidates for prefix match
    const candMatch = allCandidates.find((c) => c.toLowerCase().startsWith(input.toLowerCase()) && c.toLowerCase() !== input.toLowerCase());
    if (candMatch) {
      return candMatch.slice(input.length);
    }

    return '';
  }, [input, suggestions, selectedSuggestionIdx, history, allCandidates]);

  // Apply chosen suggestion
  const applySuggestion = (item: SuggestionItem) => {
    let nextValue = '';
    if (item.fullReplacement) {
      nextValue = item.fullReplacement;
    } else {
      const words = input.split(/\s+/);
      if (words.length <= 1) {
        nextValue = item.value + ' ';
      } else {
        words[words.length - 1] = item.value;
        nextValue = words.join(' ') + ' ';
      }
    }

    setInput(nextValue);
    setShowSuggestions(false);
    inputRef.current?.focus();
    if (config.soundEnabled) soundManager.playKeyClick(config.soundType, config.soundVolume);
  };

  // Accept full inline ghost completion
  const acceptInlineGhost = () => {
    if (!inlineGhostText) return;
    const full = input + inlineGhostText;
    setInput(full.endsWith(' ') ? full : `${full} `);
    setShowSuggestions(false);
    inputRef.current?.focus();
    if (config.soundEnabled) soundManager.playKeyClick(config.soundType, config.soundVolume);
  };

  // Direct instant execution (for quick launch/call/uninstall tap)
  const directExecute = (cmd: string) => {
    setInput('');
    setShowSuggestions(false);
    setHistoryIndex(null);
    onSubmit(cmd);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Keystroke sound
    if (config.soundEnabled && e.key !== 'Enter') {
      soundManager.playKeyClick(config.soundType, config.soundVolume);
    }

    // Tab autocomplete
    if (e.key === 'Tab') {
      e.preventDefault();
      if (inlineGhostText) {
        acceptInlineGhost();
      } else if (suggestions.length > 0) {
        applySuggestion(suggestions[selectedSuggestionIdx % suggestions.length]);
      }
      return;
    }

    // ArrowRight at end of line accepts inline ghost completion
    if (e.key === 'ArrowRight' && inlineGhostText) {
      const isAtEnd = e.currentTarget.selectionStart === input.length;
      if (isAtEnd) {
        e.preventDefault();
        acceptInlineGhost();
        return;
      }
    }

    // Arrow Navigation inside suggestions dropdown
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === input.length && !inlineGhostText) {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === input.length) {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
    }

    // Command History traversal: Arrow Up / Down
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      if (historyIndex === null) {
        setSavedDraft(input);
        const newIndex = history.length - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex] || '');
      } else if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex] || '');
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === null) return;
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex] || '');
      } else {
        setHistoryIndex(null);
        setInput(savedDraft);
      }
      return;
    }

    // Ctrl Shortcuts
    if (e.ctrlKey) {
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        onClear();
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setInput('');
        setShowSuggestions(false);
        setHistoryIndex(null);
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        onOpenHistorySearch();
        return;
      }
    }

    // Alt Shortcuts
    if (e.altKey && (e.key === 't' || e.key === 'T')) {
      e.preventDefault();
      onOpenThemeModal();
      return;
    }

    // Submit on Enter
    if (e.key === 'Enter') {
      e.preventDefault();
      const toSend = input;
      if (config.soundEnabled) {
        soundManager.playEnter(config.soundType, config.soundVolume);
      }
      setInput('');
      setShowSuggestions(false);
      setHistoryIndex(null);
      onSubmit(toSend);
    }
  };

  // Color helper for token styling
  const getTokenColor = (tokenType: string) => {
    switch (tokenType) {
      case 'command':
        return theme.accentColor;
      case 'subcommand':
        return theme.infoColor;
      case 'flag':
        return theme.warningColor;
      case 'string':
        return theme.successColor;
      case 'variable':
        return theme.promptColor;
      case 'operator':
        return theme.errorColor;
      case 'number':
        return '#f97316';
      case 'path':
        return theme.infoColor;
      default:
        return theme.fg;
    }
  };

  const currentDisplayPath = virtualFS.getDisplayPwd();
  const isCallActive = input.trimStart().toLowerCase().startsWith('call') || input.trimStart().toLowerCase().startsWith('dial');
  const isOpenActive = input.trimStart().toLowerCase().startsWith('open') || input.trimStart().toLowerCase().startsWith('launch');
  const isUninstallActive = input.trimStart().toLowerCase().startsWith('uninstall') || input.trimStart().toLowerCase().startsWith('remove-app');
  const isBtActive = input.trimStart().toLowerCase().startsWith('bluetooth') || input.trimStart().toLowerCase().startsWith('bt') || input.trimStart().toLowerCase().startsWith('bluetoothctl') || input.trimStart().toLowerCase().startsWith('bluez');

  return (
    <div className="relative w-full shrink-0 font-mono text-sm">
      {/* Suggestions & Interactive Action Popover */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          id="autocomplete-suggestions"
          className="absolute bottom-full left-0 right-0 sm:left-4 sm:right-auto max-h-64 overflow-y-auto mb-2 sm:max-w-xl bg-opacity-95 backdrop-blur-md rounded border shadow-2xl p-2 z-30 flex flex-col gap-1.5"
          style={{
            backgroundColor: theme.cardBg,
            borderColor: theme.borderColor,
            color: theme.fg,
          }}
        >
          {/* Header */}
          <div
            className="w-full text-[10px] uppercase font-bold opacity-75 px-1 flex items-center justify-between border-b pb-1 mb-0.5"
            style={{ borderColor: theme.borderColor }}
          >
            <span className="flex items-center gap-1.5">
              {isOpenActive ? (
                <AppWindow size={11} className="text-cyan-400" />
              ) : isUninstallActive ? (
                <Trash2 size={11} className="text-red-400" />
              ) : isCallActive ? (
                <Phone size={11} className="text-emerald-400" />
              ) : isBtActive ? (
                <Bluetooth size={11} className="text-blue-400 animate-pulse" />
              ) : (
                <Sparkles size={11} />
              )}
              <span>
                {isOpenActive
                  ? 'Application Launcher • [Tab] Complete or Tap [Launch]'
                  : isUninstallActive
                  ? 'Package Uninstaller • Tap [Uninstall] or [Tab]'
                  : isCallActive
                  ? 'Dialer & Recent Calls • [Tab] Complete or Tap [Call]'
                  : isBtActive
                  ? 'Bluetooth Manager • [Tab] Complete or Tap [Connect]'
                  : 'Inline Suggestions'}
              </span>
            </span>
            <span className="text-[9px] opacity-60 font-mono">[Tab] / [→] autocomplete • [Enter] run</span>
          </div>

          {/* Suggestions List */}
          <div className="flex flex-wrap sm:flex-col gap-1.5 max-h-52 overflow-y-auto">
            {suggestions.map((item, idx) => {
              const isSelected = idx === selectedSuggestionIdx;
              const isRecent = item.id.startsWith('recent-') || (item.subtitle && item.subtitle.includes('🕒'));
              const isContact = item.type === 'contact';
              const isApp = item.type === 'app';
              const isUninstall = item.type === 'uninstall';
              const isBluetooth = item.type === 'bluetooth';
              const isSubcommand = item.type === 'subcommand';

              return (
                <div
                  key={item.id}
                  id={`suggestion-${item.id}`}
                  onClick={() => applySuggestion(item)}
                  className={`group px-2.5 py-1.5 text-xs rounded border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected ? 'ring-1' : ''
                  }`}
                  style={{
                    backgroundColor: isSelected ? `${theme.accentColor}25` : `${theme.bg}bb`,
                    borderColor: isSelected ? theme.accentColor : `${theme.borderColor}60`,
                    color: theme.fg,
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-[10px]"
                      style={{
                        backgroundColor: isUninstall
                          ? `${theme.errorColor}25`
                          : isRecent
                          ? `${theme.successColor}35`
                          : isContact
                          ? `${theme.successColor}25`
                          : isApp
                          ? `${theme.infoColor}25`
                          : isBluetooth
                          ? (item.bluetoothDevice?.connected ? `${theme.infoColor}35` : '#3b82f625')
                          : `${theme.accentColor}25`,
                        color: isUninstall
                          ? theme.errorColor
                          : isRecent
                          ? theme.successColor
                          : isContact
                          ? theme.successColor
                          : isApp
                          ? theme.infoColor
                          : isBluetooth
                          ? (item.bluetoothDevice?.connected ? theme.infoColor : '#60a5fa')
                          : theme.accentColor,
                      }}
                    >
                      {isUninstall ? (
                        <Trash2 size={11} />
                      ) : isRecent ? (
                        <Clock size={11} />
                      ) : isContact ? (
                        <User size={11} />
                      ) : isApp ? (
                        <AppWindow size={11} />
                      ) : isBluetooth ? (
                        item.bluetoothDevice?.connected ? (
                          <BluetoothConnected size={11} />
                        ) : (
                          <Bluetooth size={11} />
                        )
                      ) : (
                        <Terminal size={11} />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span
                        className="font-bold truncate text-xs"
                        style={{ color: isSelected ? theme.accentColor : theme.fg }}
                      >
                        {item.label}
                      </span>
                      {item.subtitle && (
                        <span className="text-[10px] opacity-65 truncate font-mono">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side quick action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isApp && item.appObj && (
                      <button
                        type="button"
                        title={`Launch ${item.appObj.name} directly`}
                        onClick={(e) => {
                          e.stopPropagation();
                          directExecute(`open ${item.appObj!.name}`);
                        }}
                        className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border hover:scale-105 active:scale-95 transition-all"
                        style={{
                          backgroundColor: `${theme.accentColor}25`,
                          borderColor: theme.accentColor,
                          color: theme.accentColor,
                        }}
                      >
                        <Play size={9} />
                        <span>Launch</span>
                      </button>
                    )}

                    {isUninstall && item.appObj && (
                      <button
                        type="button"
                        title={`Uninstall ${item.appObj.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          directExecute(`uninstall ${item.appObj!.name}`);
                        }}
                        className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border hover:scale-105 active:scale-95 transition-all"
                        style={{
                          backgroundColor: `${theme.errorColor}25`,
                          borderColor: theme.errorColor,
                          color: theme.errorColor,
                        }}
                      >
                        <Trash2 size={9} />
                        <span>Uninstall</span>
                      </button>
                    )}

                    {isContact && item.phoneNumber && (
                      <button
                        type="button"
                        title={`Call ${item.phoneNumber} immediately`}
                        onClick={(e) => {
                          e.stopPropagation();
                          directExecute(item.fullReplacement || `call ${item.phoneNumber}`);
                        }}
                        className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border hover:scale-105 active:scale-95 transition-all"
                        style={{
                          backgroundColor: `${theme.successColor}25`,
                          borderColor: theme.successColor,
                          color: theme.successColor,
                        }}
                      >
                        <PhoneCall size={9} />
                        <span>Call</span>
                      </button>
                    )}

                    {isBluetooth && item.bluetoothDevice && (
                      <button
                        type="button"
                        title={item.bluetoothDevice.connected ? `Disconnect ${item.bluetoothDevice.name}` : `Connect to ${item.bluetoothDevice.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const cmd = item.bluetoothDevice?.connected
                            ? `bluetooth disconnect "${item.bluetoothDevice.name}"`
                            : `bluetooth connect "${item.bluetoothDevice?.name}"`;
                          directExecute(cmd);
                        }}
                        className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border hover:scale-105 active:scale-95 transition-all"
                        style={{
                          backgroundColor: item.bluetoothDevice.connected ? `${theme.errorColor}20` : '#3b82f625',
                          borderColor: item.bluetoothDevice.connected ? theme.errorColor : '#3b82f6',
                          color: item.bluetoothDevice.connected ? theme.errorColor : '#60a5fa',
                        }}
                      >
                        {item.bluetoothDevice.connected ? (
                          <>
                            <BluetoothOff size={9} />
                            <span>Disconnect</span>
                          </>
                        ) : (
                          <>
                            <BluetoothConnected size={9} />
                            <span>Connect</span>
                          </>
                        )}
                      </button>
                    )}

                    {item.actionKind === 'bluetooth_toggle' && (
                      <button
                        type="button"
                        title="Toggle Bluetooth Radio Power"
                        onClick={(e) => {
                          e.stopPropagation();
                          directExecute(item.fullReplacement || 'bluetooth toggle');
                        }}
                        className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border hover:scale-105 active:scale-95 transition-all"
                        style={{
                          backgroundColor: `${theme.accentColor}25`,
                          borderColor: theme.accentColor,
                          color: theme.accentColor,
                        }}
                      >
                        <Power size={9} />
                        <span>Toggle</span>
                      </button>
                    )}

                    <span className="text-[9px] opacity-40 font-mono hidden sm:inline">[Tab]</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Command Input Box */}
      <div
        id="command-line-box"
        onClick={() => inputRef.current?.focus()}
        className="w-full flex items-center gap-2 sm:gap-3 px-3 py-2.5 sm:py-3 border cursor-text transition-colors shadow-lg shrink-0"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.borderColor,
        }}
      >
        {/* Android Prompt Prefix: ~/directory ❯ */}
        <div className="flex items-center gap-1.5 shrink-0 font-bold select-none text-xs md:text-sm">
          <span style={{ color: theme.promptColor }}>
            {currentDisplayPath.startsWith('~') ? currentDisplayPath : `~/${currentDisplayPath}`}
          </span>
          <span className="text-white">❯</span>
        </div>

        {/* Input Wrapper with live syntax highlighting & Ghost Text layer */}
        <div className="relative flex-1 min-h-[22px] flex items-center overflow-hidden">
          {/* Syntax Highlighting & Inline Ghost Completion Layer */}
          <div
            className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-all select-none flex items-center"
            aria-hidden="true"
          >
            {tokens.length === 0 ? (
              <span className="opacity-40 italic text-xs">
                type 'open camera', 'uninstall spotify', 'call 9614044766', 'help'...
              </span>
            ) : (
              <>
                {tokens.map((token, i) => (
                  <span
                    key={i}
                    style={{
                      color: getTokenColor(token.type),
                      fontWeight: token.type === 'command' || token.type === 'operator' ? '600' : '400',
                    }}
                  >
                    {token.text}
                  </span>
                ))}

                {/* Pulsing cursor block */}
                <span
                  className="inline-block w-2 h-4.5 animate-pulse ml-0.5 shrink-0"
                  style={{ backgroundColor: theme.cursorColor }}
                />

                {/* Inline Ghost Suggestion (Fish / Zsh autosuggestion style) */}
                {inlineGhostText && (
                  <span
                    className="opacity-40 italic ml-0.5 select-none font-mono"
                    style={{ color: theme.fg }}
                  >
                    {inlineGhostText}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Actual transparent HTML input for seamless typing */}
          <input
            id="terminal-main-input"
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setCursorPosition(e.target.selectionStart || 0);
            }}
            onKeyDown={handleKeyDown}
            onClick={(e) => setCursorPosition(e.currentTarget.selectionStart || 0)}
            onKeyUp={(e) => setCursorPosition(e.currentTarget.selectionStart || 0)}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            className="w-full bg-transparent text-transparent caret-transparent focus:outline-none border-none p-0 font-mono text-sm leading-normal z-10"
            style={{
              caretColor: 'transparent',
            }}
          />
        </div>

        {/* Right side inline completion badge hint */}
        {inlineGhostText && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              acceptInlineGhost();
            }}
            className="text-[10px] px-1.5 py-0.5 rounded border border-dashed opacity-75 hover:opacity-100 flex items-center gap-1 font-mono transition-opacity shrink-0"
            style={{
              borderColor: theme.borderColor,
              backgroundColor: `${theme.accentColor}15`,
              color: theme.accentColor,
            }}
            title="Press [Tab] or [→] to complete"
          >
            <span>[Tab]</span>
            <ArrowRight size={10} />
          </button>
        )}

        {/* Line/Col Indicator */}
        <span className="text-[10px] opacity-40 shrink-0 font-mono hidden sm:inline select-none">
          L:{history.length + 1} C:{input.length}
        </span>
      </div>
    </div>
  );
};
