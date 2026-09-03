/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VirtualFile } from '../types';
import { INITIAL_FILESYSTEM } from '../data/defaultData';
import {
  isNativeAndroidApp,
  getNativeStorageFiles,
  checkNativeDirectory,
  readNativeStorageFile,
  writeNativeStorageFile,
} from './nativeLauncher';

const FS_STORAGE_KEY = 'android_storage_system_v3';

export class VirtualFS {
  private root: VirtualFile[];
  private currentPath: string = '/storage/emulated/0';
  private previousPath: string = '/storage/emulated/0';
  private mountedDirectoryHandle: any = null;
  private mountedDirName: string = '';
  private listeners: Set<(path: string, displayPath: string) => void> = new Set();

  constructor() {
    // Clear legacy simulated filesystem cache
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('android_tui_filesystem_v2');
      }
    } catch {}

    this.root = this.loadFileSystem();

    // Auto-cache native Android files in background if running as mobile APK
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        if (isNativeAndroidApp()) {
          getNativeStorageFiles('/storage/emulated/0')
            .then((res) => {
              if (res && res.files && res.files.length > 0) {
                this.cacheNativeFiles('/storage/emulated/0', res.files);
              }
            })
            .catch(() => {});
        }
      }, 500);
    }
  }

  public subscribe(listener: (path: string, displayPath: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const pwd = this.getPwd();
    const displayPwd = this.getDisplayPwd();
    this.listeners.forEach((l) => {
      try {
        l(pwd, displayPwd);
      } catch (err) {
        console.error('VirtualFS listener error:', err);
      }
    });
  }

  public cacheNativeFiles(
    dirPath: string,
    files: Array<{ name: string; isDirectory: boolean; size: number; lastModified?: number }>
  ): void {
    const resolved = this.resolvePath(dirPath);
    const parts = resolved.split('/').filter(Boolean);

    let currentChildren = this.root;
    let currentNode: VirtualFile | null = null;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let found = currentChildren.find((c) => c.name.toLowerCase() === part.toLowerCase());
      if (!found) {
        found = {
          name: part,
          type: 'dir',
          updatedAt: Date.now(),
          children: [],
        };
        currentChildren.push(found);
      }
      if (!found.children) {
        found.children = [];
      }
      currentNode = found;
      currentChildren = found.children;
    }

    if (currentNode) {
      currentNode.children = files.map((f) => {
        const existing = (currentNode!.children || []).find(
          (c) => c.name.toLowerCase() === f.name.toLowerCase()
        );
        return {
          name: f.name,
          type: (f.isDirectory ? 'dir' : 'file') as 'dir' | 'file',
          size: f.size || 0,
          updatedAt: f.lastModified || Date.now(),
          content: existing?.content,
          children: existing?.children || (f.isDirectory ? [] : undefined),
        };
      });
      this.saveFileSystem();
    }
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

  public async changeDir(target: string): Promise<{ success: boolean; error?: string; newPath?: string }> {
    // 1. Home and aliases
    if (!target || target === '~' || target === '~/storage' || target === 'storage' || target === '/sdcard') {
      const resolved = '/storage/emulated/0';
      this.previousPath = this.currentPath;
      this.currentPath = resolved;
      this.notify();
      return { success: true, newPath: resolved };
    }

    // 2. Previous directory (cd -)
    if (target === '-') {
      const targetPath = this.previousPath || '/storage/emulated/0';
      this.previousPath = this.currentPath;
      this.currentPath = targetPath;
      this.notify();
      return { success: true, newPath: targetPath };
    }

    const resolved = this.resolvePath(target);

    // 3. Root and standard parent directories
    if (resolved === '/' || resolved === '/storage' || resolved === '/storage/emulated' || resolved === '/storage/emulated/0') {
      this.previousPath = this.currentPath;
      this.currentPath = resolved;
      this.notify();
      return { success: true, newPath: resolved };
    }

    // 4. Native Android Storage check (running on mobile phone APK)
    if (isNativeAndroidApp()) {
      try {
        const checkRes = await checkNativeDirectory(resolved);
        if (checkRes.success && checkRes.isDirectory) {
          this.previousPath = this.currentPath;
          this.currentPath = resolved;
          // Background populate child files cache so autocompletion has access to real entries
          getNativeStorageFiles(resolved)
            .then((res) => {
              if (res && res.files) {
                this.cacheNativeFiles(resolved, res.files);
              }
            })
            .catch(() => {});
          this.notify();
          return { success: true, newPath: resolved };
        } else if (checkRes.exists && !checkRes.isDirectory) {
          return { success: false, error: `cd: not a directory: ${target}` };
        }
      } catch (err) {
        console.warn('Native checkNativeDirectory fallback to virtual node:', err);
      }
    }

    // 5. In-memory / SAF virtual tree check
    const node = this.getNode(resolved);
    if (!node) {
      return { success: false, error: `cd: ${target}: No such file or directory` };
    }
    if (node.type !== 'dir') {
      return { success: false, error: `cd: not a directory: ${target}` };
    }

    this.previousPath = this.currentPath;
    this.currentPath = resolved;
    this.notify();
    return { success: true, newPath: resolved };
  }

  public async readStorageFile(pathStr: string): Promise<{ success: boolean; content?: string; error?: string }> {
    const resolved = this.resolvePath(pathStr);
    if (isNativeAndroidApp()) {
      try {
        const nativeRes = await readNativeStorageFile(resolved);
        if (nativeRes.success && nativeRes.content !== undefined) {
          return { success: true, content: nativeRes.content };
        }
      } catch (err) {
        console.warn('Native readStorageFile fallback:', err);
      }
    }
    return this.readFile(pathStr);
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

  public async writeStorageFile(pathStr: string, content: string, append = false): Promise<{ success: boolean; error?: string }> {
    const resolved = this.resolvePath(pathStr);
    if (isNativeAndroidApp()) {
      try {
        const nativeRes = await writeNativeStorageFile(resolved, content, append);
        if (nativeRes.success) {
          this.writeFile(pathStr, content, append);
          return { success: true };
        }
      } catch (err) {
        console.warn('Native writeStorageFile fallback:', err);
      }
    }
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
    return this.writeFile(pathStr, content, append);
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
    this.previousPath = '/storage/emulated/0';
    this.saveFileSystem();
    this.notify();
  }
}

export const virtualFS = new VirtualFS();
export const androidStorage = virtualFS;
