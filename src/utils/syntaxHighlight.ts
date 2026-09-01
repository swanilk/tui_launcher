/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SyntaxToken, SyntaxTokenType } from '../types';

export const KNOWN_COMMANDS = new Set([
  'help', '?', 'man',
  'apps', 'app', 'ls-apps',
  'open', 'launch', 'start',
  'call', 'sms', 'dial',
  'search', 'google', 'ddg', 'yt', 'youtube',
  'calc', 'eval',
  'weather', 'wttr',
  'wifi', 'battery', 'device', 'sysinfo', 'neofetch', 'fastfetch', 'info',
  'alias', 'unalias', 'aliases',
  'theme', 'themes', 'theme-edit', 'theme-custom',
  'history', 'hist',
  'notes', 'note',
  'todo', 'todos', 'task',
  'timer', 'alarm', 'clock',
  'echo', 'printf',
  'date', 'time', 'uptime',
  'clear', 'cls', 'reset',
  'script', 'scripts', 'run', 'bash', 'sh',
  'nano', 'vim', 'vi', 'edit',
  'matrix', 'rain',
  'ascii', 'banner', 'figlet',
  'contacts', 'contact',
  'torch', 'flashlight',
  'vol', 'volume',
  'config', 'settings', 'set',
  'env', 'export',
  'export-config', 'import-config', 'backup',
  'ping',
  'fortune', 'quote',
  'ls', 'll', 'dir',
  'cat', 'view', 'read',
  'cd', 'pwd',
  'mkdir', 'touch', 'rm', 'cp', 'mv',
  'grep', 'sort', 'head', 'tail', 'wc', 'count',
  'reboot', 'exit',
]);

export const KNOWN_SUBCOMMANDS = new Set([
  'add', 'rm', 'del', 'delete', 'remove',
  'ls', 'list', 'show', 'view',
  'create', 'new', 'edit', 'run', 'exec',
  'done', 'check', 'uncheck', 'toggle',
  'find', 'search', 'get', 'set',
  'enable', 'disable', 'toggle',
  'export', 'import', 'reset', 'clear',
]);

/**
 * Tokenizes a raw terminal input string into syntax-colored segments
 */
export function tokenizeCommand(input: string, customAliases: string[] = []): SyntaxToken[] {
  if (!input) return [];

  const tokens: SyntaxToken[] = [];
  let index = 0;
  const len = input.length;

  let isFirstWordInSegment = true;

  while (index < len) {
    const char = input[index];

    // 1. Whitespace
    if (/\s/.test(char)) {
      let ws = '';
      while (index < len && /\s/.test(input[index])) {
        ws += input[index];
        index++;
      }
      tokens.push({ text: ws, type: 'plain' });
      continue;
    }

    // 2. Comments starting with #
    if (char === '#') {
      const comment = input.slice(index);
      tokens.push({ text: comment, type: 'plain' });
      break;
    }

    // 3. Operators (|, &&, ;, >, >>)
    if (char === '|' || char === ';' || char === '&' || char === '>' || char === '<') {
      let op = char;
      if (
        (char === '&' && input[index + 1] === '&') ||
        (char === '|' && input[index + 1] === '|') ||
        (char === '>' && input[index + 1] === '>')
      ) {
        op += input[index + 1];
        index += 2;
      } else {
        index += 1;
      }
      tokens.push({ text: op, type: 'operator' });
      isFirstWordInSegment = true; // next word is command again
      continue;
    }

    // 4. Quoted strings ("..." or '...')
    if (char === '"' || char === "'") {
      const quoteType = char;
      let str = char;
      index++;
      let escaped = false;
      while (index < len) {
        const c = input[index];
        str += c;
        index++;
        if (c === '\\' && !escaped) {
          escaped = true;
        } else {
          if (c === quoteType && !escaped) {
            break;
          }
          escaped = false;
        }
      }
      tokens.push({ text: str, type: 'string' });
      isFirstWordInSegment = false;
      continue;
    }

    // 5. Variables ($VAR or ${VAR})
    if (char === '$') {
      let variable = '$';
      index++;
      while (index < len && /[a-zA-Z0-9_{}]/.test(input[index])) {
        variable += input[index];
        index++;
      }
      tokens.push({ text: variable, type: 'variable' });
      isFirstWordInSegment = false;
      continue;
    }

    // 6. Flags / Options (-a, --all, -la)
    if (char === '-' && index + 1 < len && /[a-zA-Z0-9-]/.test(input[index + 1])) {
      let flag = '-';
      index++;
      while (index < len && /[a-zA-Z0-9-_]/.test(input[index])) {
        flag += input[index];
        index++;
      }
      tokens.push({ text: flag, type: 'flag' });
      isFirstWordInSegment = false;
      continue;
    }

    // 7. Standard Word (command, subcommand, path, number, or arg)
    let word = '';
    while (index < len && !/\s|[|;&><"'#]/.test(input[index])) {
      word += input[index];
      index++;
    }

    if (isFirstWordInSegment) {
      const lower = word.toLowerCase();
      const isKnown = KNOWN_COMMANDS.has(lower) || customAliases.includes(lower) || word.startsWith('./') || word.endsWith('.sh');
      tokens.push({
        text: word,
        type: isKnown ? 'command' : 'command', // Styled as main command
      });
      isFirstWordInSegment = false;
    } else if (KNOWN_SUBCOMMANDS.has(word.toLowerCase())) {
      tokens.push({ text: word, type: 'subcommand' });
    } else if (/^-?\d+(\.\d+)?$/.test(word)) {
      tokens.push({ text: word, type: 'number' });
    } else if (word.includes('/') || word.startsWith('~') || word.startsWith('.')) {
      tokens.push({ text: word, type: 'path' });
    } else {
      tokens.push({ text: word, type: 'argument' });
    }
  }

  return tokens;
}
