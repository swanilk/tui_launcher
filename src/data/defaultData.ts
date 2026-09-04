/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Alias, CustomScript, LauncherConfig, NoteItem, TodoItem, ContactItem, RecentCall, BluetoothDevice, BluetoothState, VirtualFile, AppNotification, HotspotState } from '../types';

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

export const DEFAULT_SCRIPTS: CustomScript[] = [];

export const DEFAULT_NOTES: NoteItem[] = [];

export const DEFAULT_TODOS: TodoItem[] = [];

export const DEFAULT_CONTACTS: ContactItem[] = [
  { id: 'c-mom', name: 'Mom', phone: '+1-555-0100', email: 'mom@family.local' },
  { id: 'c-alice', name: 'Alice Walker', phone: '+1-555-0142', email: 'alice.walker@example.com' },
  { id: 'c-bob', name: 'Bob Martin', phone: '+1-555-0189', email: 'bob.martin@example.com' },
  { id: 'c-charlie', name: 'Charlie Davis', phone: '+1-555-0234', email: 'charlie.d@example.com' },
  { id: 'c-david', name: 'David Miller', phone: '+1-555-0378', email: 'david.m@example.com' },
  { id: 'c-emma', name: 'Emma Wilson', phone: '+1-555-0491', email: 'emma.w@example.com' },
  { id: 'c-work', name: 'Work Support', phone: '+1-555-0999', email: 'support@work.internal' },
  { id: 'c-emergency', name: 'Emergency Services', phone: '112', email: 'emergency@public.service' },
];

export const DEFAULT_RECENT_CALLS: RecentCall[] = [
  {
    id: 'rc-1',
    name: 'Mom',
    phone: '+1-555-0100',
    timestamp: Date.now() - 1000 * 60 * 15,
    type: 'incoming',
    duration: '4m 12s',
  },
  {
    id: 'rc-2',
    name: 'Alice Walker',
    phone: '+1-555-0142',
    timestamp: Date.now() - 1000 * 60 * 55,
    type: 'outgoing',
    duration: '2m 30s',
  },
  {
    id: 'rc-3',
    name: 'Bob Martin',
    phone: '+1-555-0189',
    timestamp: Date.now() - 1000 * 60 * 180,
    type: 'missed',
  },
  {
    id: 'rc-4',
    name: 'Charlie Davis',
    phone: '+1-555-0234',
    timestamp: Date.now() - 1000 * 60 * 60 * 20,
    type: 'outgoing',
    duration: '1m 15s',
  },
];

export const DEFAULT_BLUETOOTH_DEVICES: BluetoothDevice[] = [];

export const DEFAULT_BLUETOOTH_STATE: BluetoothState = {
  enabled: true,
  devices: [],
  discovering: false,
};

export const INITIAL_FILESYSTEM: VirtualFile[] = [
  {
    name: 'storage',
    type: 'dir',
    updatedAt: Date.now(),
    children: [
      {
        name: 'emulated',
        type: 'dir',
        updatedAt: Date.now(),
        children: [
          {
            name: '0',
            type: 'dir',
            updatedAt: Date.now(),
            children: [],
          },
        ],
      },
    ],
  },
];

export const DEFAULT_NOTIFICATIONS: AppNotification[] = [];

export const DEFAULT_HOTSPOT_STATE: HotspotState = {
  enabled: false,
  ssid: 'AndroidAP',
  password: '',
  band: '5.0 GHz',
  channel: 36,
  security: 'WPA3-Personal',
  ipAddress: '192.168.43.1',
  subnetMask: '255.255.255.0',
  maxClients: 10,
  clients: [],
  dataSharedMb: 0,
  startedAt: undefined,
};

