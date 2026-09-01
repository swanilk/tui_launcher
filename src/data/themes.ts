/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Theme } from '../types';

export const DEFAULT_THEMES: Theme[] = [
  {
    id: 'high-density',
    name: 'High Density (Obsidian Void)',
    category: 'modern',
    bg: '#0c0c0c',
    fg: '#00ff66',
    cardBg: '#111111',
    promptColor: '#3399ff', // electric blue
    accentColor: '#00ff66', // phosphor green
    errorColor: '#ff3366', // crimson neon
    successColor: '#00ff66', // crisp terminal green
    warningColor: '#ffcc00', // terminal yellow / alias gold
    infoColor: '#3399ff', // electric sky blue
    selectionBg: '#003319',
    borderColor: 'rgba(0, 255, 102, 0.25)',
    cursorColor: '#00ff66',
    fontFamily: 'JetBrains Mono',
    crtScanlines: false,
    crtGlow: false,
  },
  {
    id: 'termux-green',
    name: 'Termux Classic',
    category: 'modern',
    bg: '#0c0f12',
    fg: '#d1d5db',
    cardBg: '#15191e',
    promptColor: '#10b981', // emerald green
    accentColor: '#38bdf8', // sky blue
    errorColor: '#f43f5e', // rose
    successColor: '#34d399',
    warningColor: '#fbbf24',
    infoColor: '#60a5fa',
    selectionBg: '#1e293b',
    borderColor: '#334155',
    cursorColor: '#10b981',
    fontFamily: 'JetBrains Mono',
    crtScanlines: false,
    crtGlow: false,
  },
  {
    id: 'matrix-crt',
    name: 'Matrix CRT',
    category: 'crt',
    bg: '#040b04',
    fg: '#00ff66',
    cardBg: '#081708',
    promptColor: '#22c55e',
    accentColor: '#4ade80',
    errorColor: '#ef4444',
    successColor: '#16a34a',
    warningColor: '#eab308',
    infoColor: '#86efac',
    selectionBg: '#052e16',
    borderColor: '#14532d',
    cursorColor: '#00ff66',
    fontFamily: 'Share Tech Mono',
    crtScanlines: true,
    crtGlow: true,
  },
  {
    id: 'amber-phosphor',
    name: 'Amber Phosphor VT220',
    category: 'crt',
    bg: '#0c0903',
    fg: '#ffb000',
    cardBg: '#1b1404',
    promptColor: '#ff9800',
    accentColor: '#ffc107',
    errorColor: '#ff5252',
    successColor: '#ffd54f',
    warningColor: '#ffb74d',
    infoColor: '#ffe082',
    selectionBg: '#3e2723',
    borderColor: '#795548',
    cursorColor: '#ffb000',
    fontFamily: 'VT323',
    crtScanlines: true,
    crtGlow: true,
  },
  {
    id: 'cyberpunk-2077',
    name: 'Cyberpunk Neon',
    category: 'cyberpunk',
    bg: '#080811',
    fg: '#e0e7ff',
    cardBg: '#121124',
    promptColor: '#fcee0a', // cyberpunk yellow
    accentColor: '#00f0ff', // electric cyan
    errorColor: '#ff0055', // hot pink red
    successColor: '#00ff9f',
    warningColor: '#fcee0a',
    infoColor: '#00f0ff',
    selectionBg: '#2a1b4e',
    borderColor: '#3b2d54',
    cursorColor: '#fcee0a',
    fontFamily: 'Fira Code',
    crtScanlines: true,
    crtGlow: true,
  },
  {
    id: 'dracula',
    name: 'Dracula Dark',
    category: 'modern',
    bg: '#282a36',
    fg: '#f8f8f2',
    cardBg: '#21222c',
    promptColor: '#bd93f9', // purple
    accentColor: '#ff79c6', // pink
    errorColor: '#ff5555', // red
    successColor: '#50fa7b', // green
    warningColor: '#f1fa8c', // yellow
    infoColor: '#8be9fd', // cyan
    selectionBg: '#44475a',
    borderColor: '#6272a4',
    cursorColor: '#ff79c6',
    fontFamily: 'JetBrains Mono',
    crtScanlines: false,
    crtGlow: false,
  },
  {
    id: 'nord',
    name: 'Nordic Frost',
    category: 'modern',
    bg: '#2e3440',
    fg: '#eceff4',
    cardBg: '#3b4252',
    promptColor: '#88c0d0', // frost cyan
    accentColor: '#81a1c1', // blue
    errorColor: '#bf616a', // red
    successColor: '#a3be8c', // green
    warningColor: '#ebcb8b', // yellow
    infoColor: '#b48ead', // magenta
    selectionBg: '#434c5e',
    borderColor: '#4c566a',
    cursorColor: '#88c0d0',
    fontFamily: 'JetBrains Mono',
    crtScanlines: false,
    crtGlow: false,
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Retro',
    category: 'retro',
    bg: '#1d2021',
    fg: '#ebdbb2',
    cardBg: '#282828',
    promptColor: '#fabd2f', // yellow
    accentColor: '#fe8019', // orange
    errorColor: '#fb4934', // red
    successColor: '#b8bb26', // green
    warningColor: '#fabd2f', // yellow
    infoColor: '#83a598', // blue
    selectionBg: '#3c3836',
    borderColor: '#504945',
    cursorColor: '#ebdbb2',
    fontFamily: 'Fira Code',
    crtScanlines: false,
    crtGlow: false,
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    category: 'modern',
    bg: '#181825',
    fg: '#cdd6f4',
    cardBg: '#1e1e2e',
    promptColor: '#cba6f7', // mauve
    accentColor: '#89b4fa', // blue
    errorColor: '#f38ba8', // red
    successColor: '#a6e3a1', // green
    warningColor: '#f9e2af', // yellow
    infoColor: '#94e2d5', // teal
    selectionBg: '#313244',
    borderColor: '#45475a',
    cursorColor: '#f5c2e7',
    fontFamily: 'JetBrains Mono',
    crtScanlines: false,
    crtGlow: false,
  },
  {
    id: 'monokai-pro',
    name: 'Monokai Pro',
    category: 'modern',
    bg: '#222222',
    fg: '#fcfcfa',
    cardBg: '#2d2a2e',
    promptColor: '#ffd866', // yellow
    accentColor: '#78dce8', // cyan
    errorColor: '#ff6188', // rose
    successColor: '#a9dc76', // green
    warningColor: '#fc9867', // orange
    infoColor: '#ab9df2', // violet
    selectionBg: '#403e41',
    borderColor: '#5b595c',
    cursorColor: '#ffd866',
    fontFamily: 'JetBrains Mono',
    crtScanlines: false,
    crtGlow: false,
  },
  {
    id: 'hacker-crimson',
    name: 'Hacker Crimson',
    category: 'modern',
    bg: '#0d0204',
    fg: '#ff4d6d',
    cardBg: '#1a0509',
    promptColor: '#ff0033',
    accentColor: '#ff758f',
    errorColor: '#ff0a54',
    successColor: '#ff85a1',
    warningColor: '#ffb3c1',
    infoColor: '#c9184a',
    selectionBg: '#3c0919',
    borderColor: '#590d22',
    cursorColor: '#ff0033',
    fontFamily: 'Share Tech Mono',
    crtScanlines: true,
    crtGlow: true,
  },
  {
    id: 'gameboy-retro',
    name: 'GameBoy 1989',
    category: 'retro',
    bg: '#0f380f',
    fg: '#9bbc0f',
    cardBg: '#306230',
    promptColor: '#8bac0f',
    accentColor: '#9bbc0f',
    errorColor: '#9bbc0f',
    successColor: '#8bac0f',
    warningColor: '#8bac0f',
    infoColor: '#8bac0f',
    selectionBg: '#306230',
    borderColor: '#8bac0f',
    cursorColor: '#9bbc0f',
    fontFamily: 'VT323',
    crtScanlines: true,
    crtGlow: false,
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    category: 'light',
    bg: '#fdf6e3',
    fg: '#586e75',
    cardBg: '#eee8d5',
    promptColor: '#268bd2', // blue
    accentColor: '#2aa198', // cyan
    errorColor: '#dc322f', // red
    successColor: '#859900', // green
    warningColor: '#b58900', // yellow
    infoColor: '#6c71c4', // violet
    selectionBg: '#e0d8be',
    borderColor: '#93a1a1',
    cursorColor: '#268bd2',
    fontFamily: 'JetBrains Mono',
    crtScanlines: false,
    crtGlow: false,
  },
];
