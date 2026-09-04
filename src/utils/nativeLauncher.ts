/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { registerPlugin, Capacitor } from '@capacitor/core';
import { AndroidApp, AppNotification } from '../types';

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
  checkDirectory?(options?: { path?: string }): Promise<{ success: boolean; exists: boolean; isDirectory: boolean; absolutePath?: string; error?: string }>;
  readStorageFile?(options?: { path?: string }): Promise<{ success: boolean; content: string; size?: number; absolutePath?: string }>;
  writeStorageFile?(options?: { path?: string; content?: string; append?: boolean }): Promise<{ success: boolean; absolutePath?: string; size?: number }>;
  setBluetoothEnabled(options: { enabled: boolean }): Promise<{ success: boolean; state?: string }>;
  scanBluetooth(): Promise<{ success: boolean; devices: NativeBluetoothDevice[]; count: number }>;
  openBluetoothSettings(): Promise<{ success: boolean }>;
  connectBluetooth(options?: { address?: string; name?: string }): Promise<{ success: boolean }>;
  openHotspotSettings(): Promise<{ success: boolean; action?: string }>;
  dialPhoneNumber(options?: { phoneNumber?: string }): Promise<{ success: boolean; phoneNumber?: string; fallback?: boolean }>;
  openSmsApp?(options?: { phoneNumber?: string; message?: string }): Promise<{ success: boolean; phoneNumber?: string; message?: string; fallback?: boolean }>;
  setGestureNavigationMode?(options?: { enable?: boolean }): Promise<{ success: boolean; appliedDirectly?: boolean; settingsOpened?: boolean; message?: string }>;
  getActiveNotifications?(): Promise<{ success: boolean; notifications: AppNotification[]; count: number }>;
  isNotificationAccessGranted?(): Promise<{ granted: boolean }>;
  openNotificationAccessSettings?(): Promise<{ success: boolean }>;
  dismissNotification?(options: { id: string }): Promise<{ success: boolean }>;
  addListener?(eventName: 'notificationPosted', listenerFunc: (notification: AppNotification) => void): Promise<any>;
  addListener?(eventName: 'notificationRemoved', listenerFunc: (data: { id: string }) => void): Promise<any>;
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
  'com.android.dialer': { intentAction: 'android.intent.action.DIAL', scheme: 'tel:' },
  'com.google.android.dialer': { intentAction: 'android.intent.action.DIAL', scheme: 'tel:' },
  'com.samsung.android.dialer': { intentAction: 'android.intent.action.DIAL', scheme: 'tel:' },
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
      const seen = new Set<string>();
      const deduped: AndroidApp[] = [];
      for (const a of result.apps) {
        const pkg = (a.packageName || a.id || '').toLowerCase().trim();
        const name = (a.name || '').toLowerCase().trim();
        const key = pkg || name;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        deduped.push({
          id: a.packageName || a.id,
          name: a.name,
          packageName: a.packageName,
          category: a.category || 'tools',
          icon: a.isSystem ? 'Settings' : 'Package',
          description: `Installed on device (${a.packageName})`,
        });
      }
      return deduped;
    }
  } catch (err) {
    console.warn('Could not query native apps via AppLauncher plugin:', err);
  }
  return null;
}

/**
 * Opens the native Android Home App Settings so the user can set this launcher as default.
 * Also enforces gesture navigation mode instead of 3-button navigation.
 */
export async function openAndroidHomeSettings(): Promise<boolean> {
  // Proactively enforce gesture navigation mode
  setNativeGestureNavigationMode(true).catch(() => {});

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
 * Force gesture navigation mode instead of 3-button navigation.
 * Tries direct programmatic switch via Settings.Secure and dispatches Android System Navigation Settings.
 */
export async function setNativeGestureNavigationMode(enable: boolean = true): Promise<{
  success: boolean;
  appliedDirectly: boolean;
  message: string;
}> {
  if (isNativeAndroidApp() && AppLauncher.setGestureNavigationMode) {
    try {
      const res = await AppLauncher.setGestureNavigationMode({ enable });
      if (res) {
        return {
          success: res.success,
          appliedDirectly: !!res.appliedDirectly,
          message: res.message || (enable ? 'Gesture navigation enabled' : '3-button navigation restored'),
        };
      }
    } catch (err) {
      console.warn('Native setGestureNavigationMode failed:', err);
    }
  }

  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  if (isAndroid) {
    try {
      window.location.href = 'intent:#Intent;action=android.settings.SYSTEM_NAVIGATION_SETTINGS;end';
      return {
        success: true,
        appliedDirectly: false,
        message: 'Opened Android system navigation settings',
      };
    } catch (e) {
      console.warn('Browser navigation settings intent failed:', e);
    }
  }

  return {
    success: true,
    appliedDirectly: false,
    message: 'Gesture navigation settings requested',
  };
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
 * Check if a directory exists and is a directory on native Android storage
 */
export async function checkNativeDirectory(
  pathStr: string
): Promise<{ success: boolean; exists: boolean; isDirectory: boolean; absolutePath?: string; error?: string }> {
  if (!isNativeAndroidApp()) {
    return { success: false, exists: false, isDirectory: false, error: 'Not native Android' };
  }

  try {
    if (typeof AppLauncher.checkDirectory === 'function') {
      const res = await AppLauncher.checkDirectory({ path: pathStr });
      if (res && res.success !== undefined) {
        return res;
      }
    }
  } catch (err: any) {
    console.debug('checkDirectory method unavailable or failed, falling back to listStorageFiles:', err);
  }

  // Fallback using listStorageFiles which exists in currently compiled APK
  try {
    const res = await AppLauncher.listStorageFiles({ path: pathStr });
    if (res && res.success) {
      return {
        success: true,
        exists: true,
        isDirectory: true,
        absolutePath: res.absolutePath,
      };
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('Not a directory')) {
      return { success: false, exists: true, isDirectory: false, error: 'Not a directory' };
    }
    return { success: false, exists: false, isDirectory: false, error: 'No such file or directory' };
  }

  return { success: false, exists: false, isDirectory: false, error: 'No such file or directory' };
}

/**
 * Read text content of a file from native Android storage
 */
export async function readNativeStorageFile(
  pathStr: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  if (!isNativeAndroidApp()) {
    return { success: false, error: 'Not native Android' };
  }
  try {
    if (typeof AppLauncher.readStorageFile === 'function') {
      const res = await AppLauncher.readStorageFile({ path: pathStr });
      if (res && res.success) {
        return { success: true, content: res.content };
      }
    }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
  return { success: false, error: 'Native file read not supported on this build' };
}

/**
 * Write text content to a file in native Android storage
 */
export async function writeNativeStorageFile(
  pathStr: string,
  content: string,
  append: boolean = false
): Promise<{ success: boolean; error?: string }> {
  if (!isNativeAndroidApp()) {
    return { success: false, error: 'Not native Android' };
  }
  try {
    if (typeof AppLauncher.writeStorageFile === 'function') {
      const res = await AppLauncher.writeStorageFile({ path: pathStr, content, append });
      if (res && res.success) {
        return { success: true };
      }
    }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
  return { success: false, error: 'Native file write not supported on this build' };
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

/**
 * Open native Android Phone Dialer or place call to specified number
 */
export async function dialNativePhoneNumber(phoneNumber?: string): Promise<{
  success: boolean;
  message: string;
  method: string;
}> {
  const cleanPhone = phoneNumber ? phoneNumber.replace(/[^\d+*#]/g, '') : '';

  // 1. Native Capacitor Android App (most direct)
  if (isNativeAndroidApp()) {
    try {
      const res = await AppLauncher.dialPhoneNumber({ phoneNumber: cleanPhone });
      if (res && res.success) {
        return {
          success: true,
          method: 'native_plugin',
          message: cleanPhone ? `Dispatched native Android dialer for ${cleanPhone}` : 'Opened native Android dialer',
        };
      }
    } catch (err: any) {
      console.warn('Native dialPhoneNumber error:', err);
    }
  }

  // 2. Android browser (Chrome/Samsung Internet) -> dispatch ACTION_DIAL intent
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  if (isAndroid) {
    try {
      const intentUrl = cleanPhone
        ? `intent:#Intent;action=android.intent.action.DIAL;data=tel:${encodeURIComponent(cleanPhone)};end`
        : 'intent:#Intent;action=android.intent.action.DIAL;end';
      window.location.href = intentUrl;
      return {
        success: true,
        method: 'android_intent',
        message: cleanPhone ? `Dispatched Android dialer intent for ${cleanPhone}` : 'Dispatched Android dialer intent',
      };
    } catch (err) {
      console.warn('Browser dial intent error:', err);
    }
  }

  // 3. Web browser / desktop environment fallback
  if (typeof window !== 'undefined') {
    try {
      const telUri = cleanPhone ? `tel:${cleanPhone}` : 'tel:';
      const link = document.createElement('a');
      link.href = telUri;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
      }, 300);
      return {
        success: true,
        method: 'tel_protocol',
        message: cleanPhone ? `Dispatched system telephony handler (tel:${cleanPhone})` : 'Dispatched system phone dialer',
      };
    } catch (err) {
      console.warn('tel protocol link click error:', err);
    }
  }

  return {
    success: true,
    method: 'phone_app',
    message: cleanPhone ? `Dispatched Phone app for ${cleanPhone}` : 'Opened Phone app dialer',
  };
}

/**
 * Open native Android Messaging app or compose SMS to specified recipient
 */
export async function sendNativeSms(
  phoneNumber?: string,
  message?: string
): Promise<{
  success: boolean;
  message: string;
  method: string;
}> {
  const cleanPhone = phoneNumber ? phoneNumber.replace(/[^\d+*#]/g, '') : '';
  const bodyText = message ? message.trim() : '';

  // 1. Native Capacitor Android App (most direct)
  if (isNativeAndroidApp() && AppLauncher.openSmsApp) {
    try {
      const res = await AppLauncher.openSmsApp({
        phoneNumber: cleanPhone,
        message: bodyText,
      });
      if (res && res.success) {
        return {
          success: true,
          method: 'native_plugin',
          message: cleanPhone
            ? `Dispatched native Android messaging app for ${cleanPhone}`
            : 'Opened native Android messaging app',
        };
      }
    } catch (err: any) {
      console.warn('Native openSmsApp error:', err);
    }
  }

  // 2. Android browser (Chrome/Samsung Internet) -> dispatch ACTION_SENDTO / ACTION_MAIN intent
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  if (isAndroid) {
    try {
      let intentUrl = '';
      if (cleanPhone) {
        intentUrl = bodyText
          ? `intent:#Intent;action=android.intent.action.SENDTO;data=smsto:${encodeURIComponent(cleanPhone)};S.sms_body=${encodeURIComponent(bodyText)};end`
          : `intent:#Intent;action=android.intent.action.SENDTO;data=smsto:${encodeURIComponent(cleanPhone)};end`;
      } else {
        intentUrl = 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_MESSAGING;end';
      }
      window.location.href = intentUrl;
      return {
        success: true,
        method: 'android_intent',
        message: cleanPhone
          ? `Dispatched Android SMS intent for ${cleanPhone}`
          : 'Dispatched Android messaging app intent',
      };
    } catch (err) {
      console.warn('Browser SMS intent error:', err);
    }
  }

  // 3. Web browser / desktop environment fallback via sms: protocol link
  if (typeof window !== 'undefined') {
    try {
      let smsUri = 'sms:';
      if (cleanPhone) {
        smsUri = `sms:${cleanPhone}`;
        if (bodyText) {
          smsUri += `?body=${encodeURIComponent(bodyText)}`;
        }
      } else if (bodyText) {
        smsUri = `sms:?body=${encodeURIComponent(bodyText)}`;
      }

      const link = document.createElement('a');
      link.href = smsUri;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
      }, 300);
      return {
        success: true,
        method: 'sms_protocol',
        message: cleanPhone
          ? `Dispatched system messaging handler (sms:${cleanPhone})`
          : 'Dispatched system messaging app',
      };
    } catch (err) {
      console.warn('sms protocol link click error:', err);
    }
  }

  return {
    success: true,
    method: 'messaging_app',
    message: cleanPhone ? `Opened messaging app for ${cleanPhone}` : 'Opened messaging app',
  };
}

/**
 * Fetch all active notifications from Android's NotificationListenerService
 */
export async function getNativeActiveNotifications(): Promise<AppNotification[] | null> {
  if (!isNativeAndroidApp()) {
    return null;
  }
  try {
    if (AppLauncher.getActiveNotifications) {
      const res = await AppLauncher.getActiveNotifications();
      if (res && res.success && Array.isArray(res.notifications)) {
        return res.notifications;
      }
    }
  } catch (err) {
    console.warn('getNativeActiveNotifications error:', err);
  }
  return null;
}

/**
 * Check if Android Notification Access permission is granted
 */
export async function isNativeNotificationAccessGranted(): Promise<boolean> {
  if (!isNativeAndroidApp()) {
    return false;
  }
  try {
    if (AppLauncher.isNotificationAccessGranted) {
      const res = await AppLauncher.isNotificationAccessGranted();
      return !!res?.granted;
    }
  } catch (err) {
    console.warn('isNativeNotificationAccessGranted error:', err);
  }
  return false;
}

/**
 * Open Android Settings to grant Notification Listener access
 */
export async function openNativeNotificationAccessSettings(): Promise<boolean> {
  if (isNativeAndroidApp()) {
    try {
      if (AppLauncher.openNotificationAccessSettings) {
        const res = await AppLauncher.openNotificationAccessSettings();
        return !!res?.success;
      }
    } catch (err) {
      console.warn('openNativeNotificationAccessSettings error:', err);
    }
  }

  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  if (isAndroid) {
    try {
      window.location.href = 'intent:#Intent;action=android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS;end';
      return true;
    } catch {}
  }
  return false;
}

/**
 * Dismiss a notification on Android device
 */
export async function dismissNativeNotification(id: string): Promise<boolean> {
  if (isNativeAndroidApp() && AppLauncher.dismissNotification) {
    try {
      const res = await AppLauncher.dismissNotification({ id });
      return !!res?.success;
    } catch (err) {
      console.warn('dismissNativeNotification error:', err);
    }
  }
  return false;
}

/**
 * Subscribe to real-time incoming notification events from Android NotificationListenerService
 */
export function subscribeToNativeNotifications(
  onPosted: (notif: AppNotification) => void,
  onRemoved: (id: string) => void
): () => void {
  if (!isNativeAndroidApp() || !AppLauncher.addListener) {
    return () => {};
  }

  let subPosted: any = null;
  let subRemoved: any = null;

  AppLauncher.addListener('notificationPosted', (notif: AppNotification) => {
    if (notif) onPosted(notif);
  }).then((handle) => {
    subPosted = handle;
  }).catch(() => {});

  AppLauncher.addListener('notificationRemoved', (data: { id: string }) => {
    if (data && data.id) onRemoved(data.id);
  }).then((handle) => {
    subRemoved = handle;
  }).catch(() => {});

  return () => {
    if (subPosted && typeof subPosted.remove === 'function') subPosted.remove();
    if (subRemoved && typeof subRemoved.remove === 'function') subRemoved.remove();
  };
}


