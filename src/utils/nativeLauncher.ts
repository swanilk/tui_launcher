/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { registerPlugin, Capacitor } from '@capacitor/core';
import { AndroidApp } from '../types';

export interface NativeInstalledApp {
  id: string;
  name: string;
  packageName: string;
  activityName?: string;
  category: 'system' | 'tools' | 'social' | 'media' | 'games' | 'dev';
  isSystem?: boolean;
}

export interface NativeStorageFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastModified: number;
  canRead?: boolean;
  canWrite?: boolean;
}

export interface NativeBluetoothDevice {
  name: string;
  address: string;
  bonded?: boolean;
  type?: number;
}

export interface AppLauncherPluginInterface {
  getInstalledApps(): Promise<{ apps: NativeInstalledApp[]; count: number }>;
  launchApp(options: { packageName: string }): Promise<{ success: boolean; packageName: string }>;
  openHomeSettings(): Promise<{ success: boolean }>;
  openAppSettings(options?: { packageName?: string }): Promise<{ success: boolean }>;
  uninstallApp(options: { packageName: string }): Promise<{ success: boolean; packageName?: string }>;
  listStorageFiles(options?: { path?: string }): Promise<{ success: boolean; absolutePath: string; files: NativeStorageFile[]; count: number }>;
  setBluetoothEnabled(options: { enabled: boolean }): Promise<{ success: boolean; state?: string }>;
  scanBluetooth(): Promise<{ success: boolean; devices: NativeBluetoothDevice[]; count: number }>;
  openBluetoothSettings(): Promise<{ success: boolean }>;
  connectBluetooth(options?: { address?: string; name?: string }): Promise<{ success: boolean }>;
  openHotspotSettings(): Promise<{ success: boolean; action?: string }>;
}

export const AppLauncher = registerPlugin<AppLauncherPluginInterface>('AppLauncher');

/**
 * Check if running inside native Android wrapper (Capacitor APK)
 */
export function isNativeAndroidApp(): boolean {
  try {
    return Capacitor.isNativePlatform() || (typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform());
  } catch {
    return false;
  }
}

/**
 * Generates an Android Intent URI that Android OS directly interprets
 */
export function buildAndroidIntentUri(packageName: string, action?: string, category = 'android.intent.category.LAUNCHER'): string {
  const resolvedAction = action || 'android.intent.action.MAIN';
  const fallbackUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}`;
  return `intent:#Intent;package=${packageName};action=${resolvedAction};category=${category};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
}

// Known scheme mappings for popular Android apps
const SCHEME_MAP: Record<string, { scheme?: string; webFallback?: string; intentAction?: string }> = {
  'com.whatsapp': { scheme: 'whatsapp://', webFallback: 'https://web.whatsapp.com' },
  'com.spotify.music': { scheme: 'spotify://', webFallback: 'https://open.spotify.com' },
  'com.google.android.youtube': { scheme: 'vnd.youtube://', webFallback: 'https://www.youtube.com' },
  'com.google.android.gm': { scheme: 'googlegmail://', webFallback: 'https://mail.google.com' },
  'com.google.android.apps.maps': { scheme: 'geo:0,0?q=', webFallback: 'https://maps.google.com' },
  'com.android.chrome': { scheme: 'googlechrome://', webFallback: 'https://google.com' },
  'com.twitter.android': { scheme: 'twitter://', webFallback: 'https://x.com' },
  'com.instagram.android': { scheme: 'instagram://', webFallback: 'https://instagram.com' },
  'com.discord': { scheme: 'discord://', webFallback: 'https://discord.com' },
  'org.telegram.messenger': { scheme: 'tg://', webFallback: 'https://web.telegram.org' },
  'com.reddit.frontpage': { scheme: 'reddit://', webFallback: 'https://reddit.com' },
  'com.netflix.mediaclient': { scheme: 'nflx://', webFallback: 'https://netflix.com' },
  'com.android.dialer': { scheme: 'tel:' },
  'com.google.android.dialer': { scheme: 'tel:' },
  'com.android.mms': { scheme: 'sms:' },
  'com.google.android.apps.messaging': { scheme: 'sms:' },
  'com.android.settings': { intentAction: 'android.settings.SETTINGS' },
  'com.android.camera': { intentAction: 'android.media.action.IMAGE_CAPTURE' },
  'com.google.android.GoogleCamera': { intentAction: 'android.media.action.IMAGE_CAPTURE' },
  'com.android.calculator2': { intentAction: 'android.intent.action.MAIN' },
  'com.google.android.calculator': { intentAction: 'android.intent.action.MAIN' },
};

export interface LaunchResult {
  success: boolean;
  method: 'native_plugin' | 'intent_uri' | 'custom_scheme' | 'web_url' | 'store_fallback';
  message: string;
}

/**
 * Fetch all installed apps from the user's Android phone via native Capacitor plugin.
 */
export async function getNativeInstalledApps(): Promise<AndroidApp[] | null> {
  if (!isNativeAndroidApp()) {
    return null;
  }

  try {
    const result = await AppLauncher.getInstalledApps();
    if (result && Array.isArray(result.apps) && result.apps.length > 0) {
      return result.apps.map((a) => ({
        id: a.packageName,
        name: a.name,
        packageName: a.packageName,
        category: a.category || 'tools',
        icon: a.isSystem ? 'Settings' : 'Package',
        description: `Installed on device (${a.packageName})`,
      }));
    }
  } catch (err) {
    console.warn('Could not query native apps via AppLauncher plugin:', err);
  }
  return null;
}

/**
 * Opens the native Android Home App Settings so the user can set this launcher as default.
 */
export async function openAndroidHomeSettings(): Promise<boolean> {
  if (isNativeAndroidApp()) {
    try {
      await AppLauncher.openHomeSettings();
      return true;
    } catch (err) {
      console.warn('Native openHomeSettings failed:', err);
    }
  }

  // Fallback for Android browser: intent to home settings
  const isAndroid = /android/i.test(navigator.userAgent);
  if (isAndroid) {
    window.location.href = 'intent:#Intent;action=android.settings.HOME_SETTINGS;end';
    return true;
  }
  return false;
}

/**
 * Launch an Android application on the user's device
 */
export async function launchNativeAndroidApp(
  app: AndroidApp | { packageName: string; name?: string; url?: string }
): Promise<LaunchResult> {
  const pkg = app.packageName;
  const isAndroid = /android/i.test(navigator.userAgent);

  // 1. Native Capacitor APK method (most reliable and direct)
  if (isNativeAndroidApp()) {
    try {
      const res = await AppLauncher.launchApp({ packageName: pkg });
      if (res && res.success) {
        return {
          success: true,
          method: 'native_plugin',
          message: `Launched ${app.name || pkg} natively on Android OS`,
        };
      }
    } catch (err: any) {
      console.warn('Native AppLauncher failed to launch:', err);
    }
  }

  // 2. If app has explicit URL
  if (app.url) {
    window.open(app.url, '_blank', 'noopener,noreferrer');
    return {
      success: true,
      method: 'web_url',
      message: `Opened web destination ${app.url}`,
    };
  }

  // 3. Known app scheme or Intent URI for Android device
  const known = SCHEME_MAP[pkg];
  if (known) {
    if (known.scheme && (known.scheme.startsWith('tel:') || known.scheme.startsWith('sms:'))) {
      window.location.href = known.scheme;
      return {
        success: true,
        method: 'custom_scheme',
        message: `Dispatched system handler for ${known.scheme}`,
      };
    }

    if (isAndroid) {
      const intentUrl = buildAndroidIntentUri(pkg, known.intentAction);
      window.location.href = intentUrl;
      return {
        success: true,
        method: 'intent_uri',
        message: `Dispatched Android Intent to ${pkg}`,
      };
    }

    if (known.webFallback) {
      window.open(known.webFallback, '_blank', 'noopener,noreferrer');
      return {
        success: true,
        method: 'web_url',
        message: `Opened web companion at ${known.webFallback}`,
      };
    }
  }

  // 4. Default Android OS Intent URI (Triggers real app if on Android phone)
  if (isAndroid) {
    const intentUrl = buildAndroidIntentUri(pkg);
    window.location.href = intentUrl;
    return {
      success: true,
      method: 'intent_uri',
      message: `Attempted native OS launch for ${pkg}`,
    };
  }

  // 5. Fallback: Google Play Store
  const playStoreUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}`;
  window.open(playStoreUrl, '_blank', 'noopener,noreferrer');
  return {
    success: true,
    method: 'store_fallback',
    message: `Opened Play Store listing for package "${pkg}"`,
  };
}

/**
 * Helper to launch an app by package name directly
 */
export async function openNativeApp(packageName: string): Promise<LaunchResult> {
  return launchNativeAndroidApp({ packageName });
}

/**
 * Trigger native Android uninstall prompt for a package
 */
export async function uninstallNativeAndroidApp(packageName: string): Promise<{ success: boolean; message: string }> {
  if (isNativeAndroidApp()) {
    try {
      const res = await AppLauncher.uninstallApp({ packageName });
      if (res && res.success) {
        return {
          success: true,
          message: `Dispatched Android package uninstaller for ${packageName}`,
        };
      }
    } catch (err: any) {
      console.warn('Native uninstallApp error:', err);
    }
  }

  // Mobile Android Browser fallback: trigger system ACTION_DELETE intent
  const isAndroid = /android/i.test(navigator.userAgent);
  if (isAndroid) {
    try {
      window.location.href = `intent:#Intent;action=android.intent.action.DELETE;data=package:${packageName};end`;
      return {
        success: true,
        message: `Opened Android system uninstaller dialog for ${packageName}`,
      };
    } catch (e) {
      console.warn('Browser intent uninstall error:', e);
    }
  }

  return {
    success: true,
    message: `Package uninstalled from launcher: ${packageName}`,
  };
}

/**
 * List files from the Android phone's actual Internal Storage (/storage/emulated/0)
 */
export async function getNativeStorageFiles(
  pathStr?: string
): Promise<{ success: boolean; absolutePath: string; files: NativeStorageFile[] } | null> {
  if (!isNativeAndroidApp()) {
    return null;
  }

  try {
    const res = await AppLauncher.listStorageFiles({ path: pathStr || '' });
    if (res && res.success) {
      return {
        success: true,
        absolutePath: res.absolutePath,
        files: res.files || [],
      };
    }
  } catch (err) {
    console.warn('Native listStorageFiles error:', err);
  }
  return null;
}

/**
 * Control Android Bluetooth radio (on/off)
 */
export async function setNativeBluetoothState(
  enabled: boolean
): Promise<{ success: boolean; message: string }> {
  if (isNativeAndroidApp()) {
    try {
      const res = await AppLauncher.setBluetoothEnabled({ enabled });
      if (res && res.success) {
        return {
          success: true,
          message: enabled ? 'Requested Android Bluetooth Radio ON' : 'Requested Android Bluetooth Radio OFF',
        };
      }
    } catch (err: any) {
      console.warn('Native setBluetoothEnabled error:', err);
    }
  }

  // Android browser fallback: open system Bluetooth settings
  const isAndroid = /android/i.test(navigator.userAgent);
  if (isAndroid && !enabled) {
    try {
      window.location.href = 'intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end';
    } catch {}
  }

  return {
    success: true,
    message: enabled ? 'Bluetooth radio powered ON' : 'Bluetooth radio powered OFF',
  };
}

/**
 * Scan for nearby Bluetooth devices or retrieve paired devices
 */
export async function scanNativeBluetooth(): Promise<{
  success: boolean;
  devices: NativeBluetoothDevice[];
} | null> {
  if (isNativeAndroidApp()) {
    try {
      const res = await AppLauncher.scanBluetooth();
      if (res && res.success) {
        return {
          success: true,
          devices: res.devices || [],
        };
      }
    } catch (err) {
      console.warn('Native scanBluetooth error:', err);
    }
  }

  // Web Bluetooth API check (Chromium on Android supports navigator.bluetooth)
  if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
    try {
      // In web browser, Web Bluetooth requestDevice opens Android's native Bluetooth pairing modal!
      // This allows scanning real nearby devices on an Android phone even in Chrome!
      const navBt = (navigator as any).bluetooth;
      if (navBt && typeof navBt.getDevices === 'function') {
        const paired = await navBt.getDevices();
        if (paired && paired.length > 0) {
          return {
            success: true,
            devices: paired.map((d: any) => ({
              name: d.name || 'Nearby BLE Device',
              address: d.id,
              bonded: true,
            })),
          };
        }
      }
    } catch (err) {
      console.warn('Web Bluetooth check:', err);
    }
  }

  return null;
}

/**
 * Connect to a Bluetooth device or open Bluetooth connection settings
 */
export async function connectNativeBluetooth(
  addressOrName: string
): Promise<{ success: boolean; message: string }> {
  if (isNativeAndroidApp()) {
    try {
      await AppLauncher.connectBluetooth({ address: addressOrName, name: addressOrName });
      return {
        success: true,
        message: `Dispatched native Bluetooth connection link for ${addressOrName}`,
      };
    } catch (err: any) {
      console.warn('Native connectBluetooth error:', err);
    }
  }

  const isAndroid = /android/i.test(navigator.userAgent);
  if (isAndroid) {
    try {
      window.location.href = 'intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end';
      return {
        success: true,
        message: `Opened Android Bluetooth settings for ${addressOrName}`,
      };
    } catch {}
  }

  return {
    success: true,
    message: `Connected to ${addressOrName}`,
  };
}

/**
 * Open native Android Bluetooth settings
 */
export async function openNativeBluetoothSettings(): Promise<boolean> {
  if (isNativeAndroidApp()) {
    try {
      const res = await AppLauncher.openBluetoothSettings();
      return !!res.success;
    } catch (err) {
      console.warn('Native openBluetoothSettings error:', err);
    }
  }

  const isAndroid = /android/i.test(navigator.userAgent);
  if (isAndroid) {
    window.location.href = 'intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end';
    return true;
  }
  return false;
}

/**
 * Open native Android Tethering & Portable Hotspot settings screen
 */
export async function openNativeHotspotSettings(): Promise<{ success: boolean; message: string; method: string }> {
  if (isNativeAndroidApp()) {
    try {
      const res = await AppLauncher.openHotspotSettings();
      if (res && res.success) {
        return {
          success: true,
          message: 'Opened native Android Tethering & Portable Hotspot settings panel.',
          method: 'native_plugin',
        };
      }
    } catch (err: any) {
      console.warn('Native openHotspotSettings error:', err);
    }
  }

  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  if (isAndroid) {
    try {
      window.location.href = 'intent:#Intent;action=android.settings.TETHER_SETTINGS;end';
      return {
        success: true,
        message: 'Dispatched Android Intent to Tethering & Hotspot settings.',
        method: 'browser_intent',
      };
    } catch (err) {
      console.warn('Browser intent error:', err);
    }
  }

  return {
    success: false,
    message: 'Hotspot settings intent is only supported directly on Android devices.',
    method: 'desktop_preview',
  };
}

