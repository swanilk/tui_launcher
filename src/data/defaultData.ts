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

export const DEFAULT_CONTACTS: ContactItem[] = [];

export const DEFAULT_RECENT_CALLS: RecentCall[] = [];

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

