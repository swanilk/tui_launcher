/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VirtualFile } from '../types';
import { INITIAL_FILESYSTEM } from '../data/defaultData';

const FS_STORAGE_KEY = 'android_tui_filesystem_v1';

export class VirtualFS {
  private root: VirtualFile[];
  private currentPath: string = '/home/u0_a284';

  constructor() {
    this.root = this.loadFileSystem();
  }

  private loadFileSystem(): VirtualFile[] {
    try {
      const stored = localStorage.getItem(FS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return INITIAL_FILESYSTEM;
  }

  private saveFileSystem(): void {
    try {
      localStorage.setItem(FS_STORAGE_KEY, JSON.stringify(this.root));
    } catch {}
  }

  public getPwd(): string {
    return this.currentPath;
  }

  public getDisplayPwd(): string {
    if (this.currentPath === '/home/u0_a284') return '~';
    if (this.currentPath.startsWith('/home/u0_a284/')) {
      return '~' + this.currentPath.slice('/home/u0_a284'.length);
    }
    return this.currentPath;
  }

  public resolvePath(target: string): string {
    if (!target || target === '.') return this.currentPath;
    if (target === '~') return '/home/u0_a284';
    if (target.startsWith('~/')) return '/home/u0_a284/' + target.slice(2);

    let parts: string[];
    if (target.startsWith('/')) {
      parts = target.split('/').filter(Boolean);
    } else {
      parts = (this.currentPath + '/' + target).split('/').filter(Boolean);
    }

    const resolved: string[] = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        resolved.pop();
      } else {
        resolved.push(part);
      }
    }

    return '/' + resolved.join('/');
  }

  public getNode(pathStr: string): VirtualFile | null {
    const fullPath = this.resolvePath(pathStr);
    if (fullPath === '/' || fullPath === '') {
      return {
        name: '/',
        type: 'dir',
        updatedAt: Date.now(),
        children: this.root,
      };
    }

    const parts = fullPath.split('/').filter(Boolean);
    let currentChildren: VirtualFile[] | undefined = this.root;
    let currentNode: VirtualFile | null = null;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!currentChildren) return null;
      const found = currentChildren.find((c) => c.name === part);
      if (!found) return null;
      currentNode = found;
      currentChildren = found.children;
    }

    return currentNode;
  }

  public listDir(pathStr: string = '.'): { success: boolean; files?: VirtualFile[]; error?: string } {
    const node = this.getNode(pathStr);
    if (!node) {
      return { success: false, error: `ls: cannot access '${pathStr}': No such file or directory` };
    }
    if (node.type !== 'dir') {
      return { success: true, files: [node] };
    }
    return { success: true, files: node.children || [] };
  }

  public changeDir(target: string): { success: boolean; error?: string } {
    const resolved = this.resolvePath(target);
    const node = this.getNode(resolved);
    if (!node) {
      return { success: false, error: `cd: ${target}: No such file or directory` };
    }
    if (node.type !== 'dir') {
      return { success: false, error: `cd: not a directory: ${target}` };
    }
    this.currentPath = resolved;
    return { success: true };
  }

  public readFile(pathStr: string): { success: boolean; content?: string; error?: string } {
    const node = this.getNode(pathStr);
    if (!node) {
      return { success: false, error: `cat: ${pathStr}: No such file or directory` };
    }
    if (node.type === 'dir') {
      return { success: false, error: `cat: ${pathStr}: Is a directory` };
    }
    return { success: true, content: node.content || '' };
  }

  public writeFile(pathStr: string, content: string, append = false): { success: boolean; error?: string } {
    const fullPath = this.resolvePath(pathStr);
    const parts = fullPath.split('/').filter(Boolean);
    if (parts.length === 0) return { success: false, error: 'Cannot write to root' };

    const fileName = parts.pop()!;
    const parentPath = '/' + parts.join('/');
    const parentNode = this.getNode(parentPath);

    if (!parentNode || parentNode.type !== 'dir') {
      return { success: false, error: `Directory '${parentPath}' not found` };
    }

    if (!parentNode.children) parentNode.children = [];

    const existingIndex = parentNode.children.findIndex((c) => c.name === fileName);
    if (existingIndex >= 0) {
      const file = parentNode.children[existingIndex];
      if (file.type === 'dir') {
        return { success: false, error: `${fileName} is a directory` };
      }
      file.content = append ? (file.content || '') + '\n' + content : content;
      file.size = file.content.length;
      file.updatedAt = Date.now();
    } else {
      parentNode.children.push({
        name: fileName,
        type: 'file',
        content: content,
        size: content.length,
        updatedAt: Date.now(),
      });
    }

    this.saveFileSystem();
    return { success: true };
  }

  public makeDir(pathStr: string): { success: boolean; error?: string } {
    const fullPath = this.resolvePath(pathStr);
    const parts = fullPath.split('/').filter(Boolean);
    if (parts.length === 0) return { success: false, error: 'Invalid directory name' };

    const dirName = parts.pop()!;
    const parentPath = '/' + parts.join('/');
    const parentNode = this.getNode(parentPath);

    if (!parentNode || parentNode.type !== 'dir') {
      return { success: false, error: `mkdir: cannot create directory '${pathStr}': No such parent directory` };
    }

    if (!parentNode.children) parentNode.children = [];

    if (parentNode.children.some((c) => c.name === dirName)) {
      return { success: false, error: `mkdir: cannot create directory '${dirName}': File exists` };
    }

    parentNode.children.push({
      name: dirName,
      type: 'dir',
      updatedAt: Date.now(),
      children: [],
    });

    this.saveFileSystem();
    return { success: true };
  }

  public removeNode(pathStr: string): { success: boolean; error?: string } {
    const fullPath = this.resolvePath(pathStr);
    const parts = fullPath.split('/').filter(Boolean);
    if (parts.length === 0) return { success: false, error: 'Cannot remove root' };

    const targetName = parts.pop()!;
    const parentPath = '/' + parts.join('/');
    const parentNode = this.getNode(parentPath);

    if (!parentNode || !parentNode.children) {
      return { success: false, error: `rm: cannot remove '${pathStr}': No such file or directory` };
    }

    const idx = parentNode.children.findIndex((c) => c.name === targetName);
    if (idx === -1) {
      return { success: false, error: `rm: cannot remove '${pathStr}': No such file or directory` };
    }

    parentNode.children.splice(idx, 1);
    this.saveFileSystem();
    return { success: true };
  }

  public resetFS(): void {
    this.root = JSON.parse(JSON.stringify(INITIAL_FILESYSTEM));
    this.currentPath = '/home/u0_a284';
    this.saveFileSystem();
  }
}

export const virtualFS = new VirtualFS();
