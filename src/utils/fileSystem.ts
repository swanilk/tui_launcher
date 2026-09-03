/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VirtualFile } from '../types';
import { INITIAL_FILESYSTEM } from '../data/defaultData';

const FS_STORAGE_KEY = 'android_storage_system_v3';

export class VirtualFS {
  private root: VirtualFile[];
  private currentPath: string = '/storage/emulated/0';
  private mountedDirectoryHandle: any = null;
  private mountedDirName: string = '';

  constructor() {
    // Clear legacy simulated filesystem cache
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('android_tui_filesystem_v2');
      }
    } catch {}

    this.root = this.loadFileSystem();
  }

  private loadFileSystem(): VirtualFile[] {
    try {
      const stored = localStorage.getItem(FS_STORAGE_KEY);
      if (stored) {
        const parsed: VirtualFile[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return JSON.parse(JSON.stringify(INITIAL_FILESYSTEM));
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
    if (this.currentPath === '/storage/emulated/0') return '~/storage';
    if (this.currentPath.startsWith('/storage/emulated/0/')) {
      return '~/storage/' + this.currentPath.slice('/storage/emulated/0/'.length);
    }
    return this.currentPath;
  }

  public setMountedDirectoryHandle(handle: any): void {
    this.mountedDirectoryHandle = handle;
    this.mountedDirName = handle?.name || 'Selected Storage Folder';
  }

  public getMountedDirectoryHandle(): any {
    return this.mountedDirectoryHandle;
  }

  public getMountedDirName(): string {
    return this.mountedDirName;
  }

  public clearMountedDirectory(): void {
    this.mountedDirectoryHandle = null;
    this.mountedDirName = '';
  }

  public resolvePath(target: string): string {
    if (!target || target === '.') return this.currentPath;
    if (target === '~' || target === '~/storage' || target === 'storage') return '/storage/emulated/0';
    if (target.startsWith('~/')) return '/storage/emulated/0/' + target.slice(2);
    if (target === 'shared' || target === '/sdcard') return '/storage/emulated/0';

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

    const full = '/' + resolved.join('/');
    if (full === '/sdcard') return '/storage/emulated/0';
    if (full.startsWith('/sdcard/')) {
      return '/storage/emulated/0/' + full.slice('/sdcard/'.length);
    }

    return full;
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
      if (!currentChildren) break;
      const found = currentChildren.find((c) => c.name.toLowerCase() === part.toLowerCase());
      if (!found) {
        currentNode = null;
        break;
      }
      currentNode = found;
      currentChildren = found.children;
    }

    if (currentNode) {
      return currentNode;
    }

    return null;
  }

  /**
   * List files asynchronously with support for mounted Storage Access Framework directory handle
   */
  public async listStorageEntries(pathStr: string = '.'): Promise<{
    success: boolean;
    files: Array<{ name: string; isDirectory: boolean; size: number; lastModified: number }>;
    source: 'mounted_saf' | 'internal';
    resolvedPath: string;
  }> {
    const resolved = this.resolvePath(pathStr);

    if (this.mountedDirectoryHandle) {
      try {
        const entries: Array<{ name: string; isDirectory: boolean; size: number; lastModified: number }> = [];
        for await (const [name, handle] of (this.mountedDirectoryHandle as any).entries()) {
          const isDir = handle.kind === 'directory';
          let size = 0;
          let lastModified = Date.now();
          if (!isDir && typeof handle.getFile === 'function') {
            try {
              const file = await handle.getFile();
              size = file.size;
              lastModified = file.lastModified;
            } catch {}
          }
          entries.push({
            name,
            isDirectory: isDir,
            size,
            lastModified,
          });
        }
        return {
          success: true,
          files: entries,
          source: 'mounted_saf',
          resolvedPath: `[SAF Mounted: ${this.mountedDirName}]`,
        };
      } catch (err) {
        console.warn('Mounted SAF read error:', err);
      }
    }

    const node = this.getNode(pathStr);
    if (!node) {
      return {
        success: false,
        files: [],
        source: 'internal',
        resolvedPath: resolved,
      };
    }

    const children = node.type === 'dir' ? node.children || [] : [node];
    return {
      success: true,
      files: children.map((c) => ({
        name: c.name,
        isDirectory: c.type === 'dir',
        size: c.size || 0,
        lastModified: c.updatedAt,
      })),
      source: 'internal',
      resolvedPath: resolved,
    };
  }

  public listDir(pathStr: string = '.'): { success: boolean; files?: VirtualFile[]; error?: string; resolvedPath?: string } {
    const node = this.getNode(pathStr);
    const resolved = this.resolvePath(pathStr);
    if (!node) {
      return { success: false, error: `ls: cannot access '${pathStr}': No such file or directory` };
    }
    if (node.type !== 'dir') {
      return { success: true, files: [node], resolvedPath: resolved };
    }
    return { success: true, files: node.children || [], resolvedPath: resolved };
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

  public async writeStorageFile(pathStr: string, content: string): Promise<{ success: boolean; error?: string }> {
    if (this.mountedDirectoryHandle) {
      try {
        const fileHandle = await (this.mountedDirectoryHandle as any).getFileHandle(pathStr, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
      } catch (err: any) {
        console.warn('SAF file write note:', err);
      }
    }
    return this.writeFile(pathStr, content);
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
    this.currentPath = '/storage/emulated/0';
    this.saveFileSystem();
  }
}

export const virtualFS = new VirtualFS();
export const androidStorage = virtualFS;
