/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Theme, LauncherConfig } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { 
  Home, 
  Download, 
  Smartphone, 
  Settings, 
  CheckCircle2, 
  Copy, 
  Check, 
  ExternalLink, 
  Monitor, 
  Terminal, 
  ShieldCheck, 
  Maximize2, 
  Layers, 
  Sparkles,
  X,
  Radio,
  Zap,
  HelpCircle,
  Share2,
  GitBranch,
  Box,
  Cpu
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { openAndroidHomeSettings, setNativeGestureNavigationMode, isNativeAndroidApp } from '../utils/nativeLauncher';

interface DefaultLauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  config: LauncherConfig;
  onUpdateConfig: (newConfig: Partial<LauncherConfig>) => void;
  soundEnabled: boolean;
}

export const DefaultLauncherModal: React.FC<DefaultLauncherModalProps> = ({
  isOpen,
  onClose,
  theme,
  config,
  onUpdateConfig,
  soundEnabled,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'github' | 'phone_settings' | 'adb' | 'pwa' | 'desktop' | 'kiosk'>('github');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockSentinel, setWakeLockSentinel] = useState<any>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (!isOpen) return null;

  const playClick = () => {
    if (soundEnabled) soundManager.playKeyClick('mechanical', 0.2);
  };

  const copyToClipboard = (text: string, id: string) => {
    playClick();
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const toggleFullscreen = async () => {
    playClick();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen request failed:', err);
    }
  };

  const toggleWakeLock = async () => {
    playClick();
    if ('wakeLock' in navigator) {
      if (!wakeLockActive) {
        try {
          const sentinel = await (navigator as any).wakeLock.request('screen');
          setWakeLockSentinel(sentinel);
          setWakeLockActive(true);
          sentinel.addEventListener('release', () => {
            setWakeLockActive(false);
            setWakeLockSentinel(null);
          });
        } catch (e) {
          console.error('WakeLock failed:', e);
        }
      } else if (wakeLockSentinel) {
        wakeLockSentinel.release();
        setWakeLockSentinel(null);
        setWakeLockActive(false);
      }
    }
  };

  const handleOpenAndroidHomeSettings = async () => {
    playClick();
    await openAndroidHomeSettings();
  };

  const manifestSnippet = `<activity
    android:name=".MainActivity"
    android:launchMode="singleTask"
    android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.HOME" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
</activity>`;

  const adbCommand = `adb shell cmd package set-home-activity com.android.terminal.launcher/.MainActivity`;

  return (
    <div
      id="modal-default-launcher-setup"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 font-mono select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.borderColor,
          color: theme.fg,
          boxShadow: `0 0 35px ${theme.accentColor}30`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{
            borderColor: theme.borderColor,
            backgroundColor: `${theme.accentColor}12`,
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg border"
              style={{
                borderColor: `${theme.accentColor}80`,
                backgroundColor: `${theme.accentColor}25`,
                color: theme.accentColor,
              }}
            >
              <Home size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-wide flex items-center gap-2">
                <span>SET AS DEFAULT LAUNCHER</span>
                <span
                  className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase"
                  style={{
                    backgroundColor: `${theme.promptColor}20`,
                    color: theme.promptColor,
                    border: `1px solid ${theme.promptColor}40`,
                  }}
                >
                  SYSTEM SETUP
                </span>
              </h2>
              <p className="text-[11px] opacity-70">
                Configure Android Terminal Launcher as your primary home screen
              </p>
            </div>
          </div>

          <button
            id="btn-close-launcher-modal"
            onClick={() => {
              playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg border hover:bg-white/10 transition-colors"
            style={{ borderColor: theme.borderColor }}
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Quick Diagnostic Status Bar */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b text-[11px] gap-2 overflow-x-auto no-scrollbar shrink-0"
          style={{
            borderColor: `${theme.borderColor}80`,
            backgroundColor: `${theme.bg}`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="opacity-60">STATUS:</span>
            <span
              className="px-2 py-0.5 rounded font-bold flex items-center gap-1"
              style={{
                backgroundColor: isInstalled ? `${theme.successColor}25` : `${theme.warningColor}20`,
                color: isInstalled ? theme.successColor : theme.warningColor,
                border: `1px solid ${isInstalled ? theme.successColor : theme.warningColor}50`,
              }}
            >
              {isInstalled ? <CheckCircle2 size={12} /> : <Radio size={12} className="animate-pulse" />}
              {isInstalled ? 'STANDALONE HOME APP' : 'WEB CLIENT MODE'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="px-2 py-0.5 rounded border text-[10px] font-semibold flex items-center gap-1 hover:bg-white/5 active:scale-95 transition-all"
              style={{
                borderColor: isFullscreen ? theme.accentColor : theme.borderColor,
                color: isFullscreen ? theme.accentColor : theme.fg,
              }}
            >
              <Maximize2 size={11} />
              <span>{isFullscreen ? 'FULLSCREEN ACTIVE' : 'TOGGLE FULLSCREEN'}</span>
            </button>

            {'wakeLock' in navigator && (
              <button
                onClick={toggleWakeLock}
                className="px-2 py-0.5 rounded border text-[10px] font-semibold flex items-center gap-1 hover:bg-white/5 active:scale-95 transition-all"
                style={{
                  borderColor: wakeLockActive ? theme.successColor : theme.borderColor,
                  color: wakeLockActive ? theme.successColor : theme.fg,
                  backgroundColor: wakeLockActive ? `${theme.successColor}15` : 'transparent',
                }}
              >
                <Zap size={11} />
                <span>{wakeLockActive ? 'ALWAYS-ON ACTIVE' : 'ALWAYS-ON DISPLAY'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          className="flex border-b text-xs shrink-0 overflow-x-auto no-scrollbar"
          style={{ borderColor: theme.borderColor, backgroundColor: `${theme.cardBg}` }}
        >
          {[
            { id: 'github', label: '1. Compile APK on GitHub', icon: <GitBranch size={13} /> },
            { id: 'phone_settings', label: '2. Set as Default on Phone', icon: <Smartphone size={13} /> },
            { id: 'adb', label: '3. ADB & Manifest', icon: <Terminal size={13} /> },
            { id: 'pwa', label: '4. Web / PWA Info', icon: <Monitor size={13} /> },
            { id: 'kiosk', label: '5. Launcher Options', icon: <Settings size={13} /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-launcher-setup-${tab.id}`}
                onClick={() => {
                  playClick();
                  setActiveTab(tab.id as any);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer"
                style={{
                  borderColor: isActive ? theme.accentColor : 'transparent',
                  color: isActive ? theme.accentColor : theme.fg,
                  backgroundColor: isActive ? `${theme.accentColor}12` : 'transparent',
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* TAB 1: GITHUB APK COMPILATION (DIRECT ANSWER TO USER) */}
          {activeTab === 'github' && (
            <div className="space-y-4">
              {/* Critical Clarification Banner */}
              <div
                className="p-3.5 rounded-xl border space-y-2"
                style={{
                  borderColor: `${theme.accentColor}80`,
                  backgroundColor: `${theme.accentColor}15`,
                }}
              >
                <div className="flex items-center gap-2 font-bold text-sm" style={{ color: theme.accentColor }}>
                  <Cpu size={16} />
                  <span>HOW TO GET REAL PHONE APPS & SET AS DEFAULT LAUNCHER</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  Android OS <strong>strictly blocks</strong> websites and browser PWAs from being selected as the phone's default Home App and forbids web pages from reading your private installed apps. 
                  To show <strong>all apps installed on your phone</strong> and set it as your <strong>real default launcher</strong>, you must install the native <strong>.apk</strong>!
                </p>
              </div>

              {/* GitHub Actions Build Guide */}
              <div
                className="p-4 rounded-xl border space-y-3"
                style={{ borderColor: theme.borderColor, backgroundColor: theme.bg }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm" style={{ color: theme.promptColor }}>
                    <GitBranch size={16} />
                    <span>CAN YOU COMPILE ON GITHUB? YES!</span>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-mono border"
                    style={{ borderColor: `${theme.successColor}50`, color: theme.successColor, backgroundColor: `${theme.successColor}15` }}
                  >
                    READY TO BUILD
                  </span>
                </div>

                <p className="text-[11px] opacity-80">
                  We have included an automated GitHub Actions workflow (<code className="px-1 py-0.5 rounded bg-black/40 text-emerald-400">.github/workflows/build-apk.yml</code>) and native Android source code (<code className="px-1 py-0.5 rounded bg-black/40 text-emerald-400">AppLauncherPlugin.java</code>).
                </p>

                <div className="space-y-2.5 pt-1">
                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5"
                      style={{ backgroundColor: `${theme.accentColor}30`, color: theme.accentColor }}
                    >
                      1
                    </div>
                    <div>
                      <div className="font-bold text-xs">Push / Export this repository to GitHub</div>
                      <p className="text-[11px] opacity-75 mt-0.5">
                        In AI Studio or your git client, push all files including the <code className="font-mono">android/</code> directory and <code className="font-mono">.github/</code> folder to your GitHub repo.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5"
                      style={{ backgroundColor: `${theme.accentColor}30`, color: theme.accentColor }}
                    >
                      2
                    </div>
                    <div>
                      <div className="font-bold text-xs">Go to the "Actions" tab on GitHub</div>
                      <p className="text-[11px] opacity-75 mt-0.5">
                        Open your repository in your browser and click on the <strong>Actions</strong> tab in the top navigation bar.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5"
                      style={{ backgroundColor: `${theme.accentColor}30`, color: theme.accentColor }}
                    >
                      3
                    </div>
                    <div>
                      <div className="font-bold text-xs">Trigger "Build Android APK" workflow</div>
                      <p className="text-[11px] opacity-75 mt-0.5">
                        In the left sidebar, click <strong>"Build Android APK"</strong>, then click the <strong>"Run workflow"</strong> dropdown button and press <strong>"Run workflow"</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5"
                      style={{ backgroundColor: `${theme.accentColor}30`, color: theme.accentColor }}
                    >
                      4
                    </div>
                    <div>
                      <div className="font-bold text-xs">Download APK from Artifacts & Install</div>
                      <p className="text-[11px] opacity-75 mt-0.5">
                        Once the GitHub runner finishes (~2-3 min), click on the completed run. Scroll down to <strong>Artifacts</strong>, click <strong>AndroidTerminalLauncher-Debug-APK</strong> to download <code className="font-mono">app-debug.apk</code>, and install it on your phone!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Native Capabilities info */}
              <div
                className="p-3 rounded-lg border text-[11px] space-y-1.5"
                style={{ borderColor: theme.borderColor, backgroundColor: `${theme.cardBg}80` }}
              >
                <div className="font-bold flex items-center gap-1.5" style={{ color: theme.accentColor }}>
                  <Box size={14} />
                  <span>What happens once the APK is installed on your phone?</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 opacity-80 text-[11px]">
                  <li>It automatically queries Android's native <code className="font-mono">PackageManager</code> for all user and system apps installed on your device.</li>
                  <li>Clicking an app or typing <code className="font-mono">open &lt;app&gt;</code> launches the real application on your phone (no simulated modal).</li>
                  <li>You can select it in <strong>Settings ➔ Default apps ➔ Home app</strong> as your phone's permanent launcher!</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: SET AS DEFAULT ON PHONE */}
          {activeTab === 'phone_settings' && (
            <div className="space-y-4">
              <div
                className="p-3.5 rounded-xl border space-y-3"
                style={{ borderColor: theme.borderColor, backgroundColor: theme.bg }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm" style={{ color: theme.promptColor }}>
                    <Smartphone size={16} />
                    <span>SET AS DEFAULT HOME APP IN ANDROID SETTINGS</span>
                  </div>
                  <button
                    onClick={handleOpenAndroidHomeSettings}
                    className="px-3 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md"
                    style={{
                      borderColor: theme.promptColor,
                      color: theme.bg,
                      backgroundColor: theme.promptColor,
                    }}
                  >
                    <ExternalLink size={12} />
                    <span>Open Phone Home Settings</span>
                  </button>
                </div>

                <p className="text-[11px] opacity-80 leading-relaxed">
                  After installing the compiled APK, follow these steps to make this terminal your primary phone launcher:
                </p>

                <ol className="space-y-2.5 text-[11px] opacity-90 pl-1 pt-1">
                  <li className="flex items-start gap-2">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5"
                      style={{ backgroundColor: `${theme.accentColor}30`, color: theme.accentColor }}
                    >
                      1
                    </span>
                    <span>
                      Open your phone's <strong>Settings (⚙️)</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5"
                      style={{ backgroundColor: `${theme.accentColor}30`, color: theme.accentColor }}
                    >
                      2
                    </span>
                    <span>
                      Navigate to <strong>Apps</strong> (or <strong>Apps & Notifications</strong>) ➔ <strong>Default apps</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5"
                      style={{ backgroundColor: `${theme.accentColor}30`, color: theme.accentColor }}
                    >
                      3
                    </span>
                    <span>
                      Tap on <strong>Home app</strong> (or <strong>Default launcher</strong>).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5"
                      style={{ backgroundColor: `${theme.accentColor}30`, color: theme.accentColor }}
                    >
                      4
                    </span>
                    <span>
                      Select <strong>Android Terminal Launcher</strong> from the list.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5"
                      style={{ backgroundColor: `${theme.successColor}30`, color: theme.successColor }}
                    >
                      ✓
                    </span>
                    <span>
                      Pressing the hardware <strong>Home button</strong> or swiping up will now always open this terminal!
                    </span>
                  </li>
                </ol>
              </div>

              {/* Force Gesture Navigation Card */}
              <div
                className="p-3.5 rounded-xl border space-y-3"
                style={{ borderColor: `${theme.accentColor}70`, backgroundColor: `${theme.accentColor}10` }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-sm" style={{ color: theme.accentColor }}>
                    <Sparkles size={16} />
                    <span>FORCE GESTURE NAVIGATION (RECOMMENDED)</span>
                  </div>
                  <button
                    onClick={async () => {
                      playClick();
                      await setNativeGestureNavigationMode(true);
                    }}
                    className="px-3 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md self-start sm:self-auto"
                    style={{
                      borderColor: theme.accentColor,
                      color: theme.bg,
                      backgroundColor: theme.accentColor,
                    }}
                  >
                    <ExternalLink size={12} />
                    <span>Switch to Gesture Navigation</span>
                  </button>
                </div>

                <p className="text-[11px] opacity-90 leading-relaxed">
                  For the cleanest full-screen terminal experience, <strong>Gesture Navigation</strong> is recommended over 3-button navigation. This removes the navigation bar, maximizing vertical screen real estate for your terminal prompt and tabs.
                </p>

                {/* Third-party Launcher OEM Restriction Note & Solutions */}
                <div
                  className="p-3 rounded-lg border text-[11px] space-y-2 font-mono"
                  style={{ borderColor: theme.borderColor, backgroundColor: `${theme.bg}ee` }}
                >
                  <div className="font-bold text-xs flex items-center gap-1.5" style={{ color: theme.accentColor }}>
                    <span>📱 WHY DO GESTURES DISABLE ON SOME PHONES?</span>
                  </div>
                  <p className="text-[10px] opacity-80 leading-relaxed">
                    Certain OEM skins (especially <strong>Xiaomi HyperOS / MIUI</strong>, <strong>Huawei EMUI</strong>, and older <strong>OneUI</strong> builds) intentionally restrict native gestures when selecting any 3rd-party launcher, reverting to 3 buttons.
                  </p>

                  <div className="space-y-1 text-[10px]">
                    <div className="font-bold text-emerald-400">Solution 1: Force System Gestures via ADB (Pixel, Samsung, Moto, OnePlus)</div>
                    <code className="block p-1.5 rounded bg-black/60 border border-neutral-800 text-neutral-200 select-all break-all">
                      adb shell cmd overlay enable com.android.internal.systemui.navbar.gestural<br />
                      adb shell settings put secure navigation_mode 2
                    </code>
                  </div>

                  <div className="space-y-1 text-[10px]">
                    <div className="font-bold text-amber-400">Solution 2: Xiaomi / HyperOS / OEM-Locked ROMs</div>
                    <p className="opacity-80">
                      • <strong>In TUI Launcher:</strong> The 3 buttons are automatically hidden via sticky immersive mode, giving you a full-screen view inside this launcher.<br />
                      • <strong>System-wide Gestures:</strong> Install <strong className="text-white">Fluid Navigation Gestures (FNG)</strong> or <strong className="text-white">Edge Gestures</strong> from the Play Store. These apps provide full edge gestures across all apps, completely bypassing Xiaomi's launcher lock!
                    </p>
                  </div>
                </div>

                <div className="text-[11px] opacity-80 space-y-1">
                  <p>• <strong>Smooth Tab Transitions:</strong> Swipe horizontally anywhere across the screen to glide between <strong>Apps</strong>, <strong>Notifications</strong>, and <strong>Terminal</strong> sections.</p>
                  <p>• <strong>Permission Grant via ADB:</strong> <code className="text-emerald-400 bg-black/40 px-1 py-0.5 rounded font-mono">adb shell pm grant com.android.terminal.launcher android.permission.WRITE_SECURE_SETTINGS</code></p>
                </div>
              </div>

              {/* Note about Web Mode vs Native APK */}
              <div
                className="p-3 rounded-lg border text-[11px] space-y-1"
                style={{ borderColor: `${theme.warningColor}50`, backgroundColor: `${theme.warningColor}15`, color: theme.warningColor }}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <HelpCircle size={14} />
                  <span>Don't see "Android Terminal Launcher" in the Home app list?</span>
                </div>
                <p className="opacity-90 leading-relaxed text-[11px]">
                  If you are currently viewing this in Chrome, Brave, or as an "Add to Home Screen" shortcut, Android will not list it as a Home app. You must build and install the native <strong>.apk</strong> via GitHub Actions (see Tab 1) or compile with Android Studio!
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: ADB COMMAND & MANIFEST */}
          {activeTab === 'adb' && (
            <div className="space-y-4">
              {/* In-App Direct Install Trigger Card */}
              <div
                className="p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                style={{
                  borderColor: `${theme.accentColor}60`,
                  backgroundColor: `${theme.accentColor}10`,
                }}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-sm" style={{ color: theme.accentColor }}>
                    <Download size={16} />
                    <span>STEP 1: INSTALL TO ANDROID HOME SCREEN</span>
                  </div>
                  <p className="text-[11px] opacity-80 leading-relaxed">
                    Installs the high-density APK-ready PWA directly into Android OS as a standalone launcher app.
                  </p>
                </div>

                {isInstallable ? (
                  <button
                    id="btn-trigger-pwa-install"
                    onClick={async () => {
                      playClick();
                      await install();
                    }}
                    className="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shrink-0 transition-transform hover:scale-105 active:scale-95 shadow-md"
                    style={{
                      backgroundColor: theme.accentColor,
                      color: theme.bg,
                    }}
                  >
                    <Download size={14} />
                    <span>Install App Now</span>
                  </button>
                ) : isInstalled ? (
                  <div
                    className="px-3 py-1.5 rounded-lg border font-bold text-[11px] flex items-center gap-1.5 shrink-0"
                    style={{
                      borderColor: theme.successColor,
                      color: theme.successColor,
                      backgroundColor: `${theme.successColor}15`,
                    }}
                  >
                    <CheckCircle2 size={14} />
                    <span>App Installed</span>
                  </div>
                ) : (
                  <div className="text-[10px] opacity-75 font-semibold shrink-0">
                    Use browser menu: <strong>Add to Home Screen</strong>
                  </div>
                )}
              </div>

              {/* Step 2: Set as Default Home App in Android Settings */}
              <div
                className="p-3.5 rounded-xl border space-y-3"
                style={{
                  borderColor: theme.borderColor,
                  backgroundColor: `${theme.bg}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-sm" style={{ color: theme.promptColor }}>
                    <Settings size={15} />
                    <span>STEP 2: SELECT AS DEFAULT HOME APP</span>
                  </div>
                  <button
                    onClick={handleOpenAndroidHomeSettings}
                    className="px-2.5 py-1 rounded border text-[10px] font-bold flex items-center gap-1 hover:bg-white/10 active:scale-95 transition-all"
                    style={{
                      borderColor: theme.promptColor,
                      color: theme.promptColor,
                      backgroundColor: `${theme.promptColor}15`,
                    }}
                    title="Launch Android Home App Settings Intent"
                  >
                    <ExternalLink size={11} />
                    <span>Open Android Settings</span>
                  </button>
                </div>

                <ol className="space-y-2 text-[11px] opacity-90 pl-1">
                  <li className="flex items-start gap-2">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5"
                      style={{ backgroundColor: `${theme.accentColor}30`, color: theme.accentColor }}
                    >
                      1
                    </span>
                    <span>
                      Open your Android device's <strong>Settings (⚙️)</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5"
                      style={{ backgroundColor: `${theme.accentColor}30`, color: theme.accentColor }}
                    >
                      2
                    </span>
                    <span>
                      Tap on <strong>Apps</strong> (or <strong>Application Manager</strong>) ➔ <strong>Default apps</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5"
                      style={{ backgroundColor: `${theme.accentColor}30`, color: theme.accentColor }}
                    >
                      3
                    </span>
                    <span>
                      Select <strong>Home app</strong> (or <strong>Default launcher</strong>).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5"
                      style={{ backgroundColor: `${theme.accentColor}30`, color: theme.accentColor }}
                    >
                      4
                    </span>
                    <span>
                      Choose <strong>Android Terminal Launcher</strong> (or the installed Chrome/Brave PWA icon).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5"
                      style={{ backgroundColor: `${theme.successColor}30`, color: theme.successColor }}
                    >
                      ✓
                    </span>
                    <span>
                      Pressing the hardware <strong>Home button</strong> or swiping up now brings you directly to this terminal!
                    </span>
                  </li>
                </ol>
              </div>

              {/* Pro Tip */}
              <div
                className="p-3 rounded-lg border text-[11px] flex items-start gap-2.5 opacity-90"
                style={{
                  borderColor: `${theme.infoColor}40`,
                  backgroundColor: `${theme.infoColor}10`,
                  color: theme.infoColor,
                }}
              >
                <HelpCircle size={15} className="shrink-0 mt-0.5" />
                <div>
                  <strong>Home Gesture Tip:</strong> You can keep this terminal open permanently in immersive mode by toggling <strong>FULLSCREEN</strong> at the top bar.
                </div>
              </div>
            </div>
          )}

          {/* TAB 3 (cont): Native Android / ADB Command & Manifest Snippet */}
          {activeTab === 'adb' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="font-bold text-sm" style={{ color: theme.promptColor }}>
                  Native APK / Capacitor Android Home Intent
                </h3>
                <p className="text-[11px] opacity-75">
                  When building the native Android APK via Android Studio or Capacitor, ensure the HOME intent filter is declared in your <code>AndroidManifest.xml</code>:
                </p>
              </div>

              {/* Code Snippet: AndroidManifest.xml */}
              <div
                className="rounded-lg border overflow-hidden"
                style={{ borderColor: theme.borderColor, backgroundColor: theme.bg }}
              >
                <div
                  className="flex items-center justify-between px-3 py-1.5 border-b text-[10px] opacity-80"
                  style={{ borderColor: theme.borderColor, backgroundColor: `${theme.cardBg}` }}
                >
                  <span className="font-mono">android/app/src/main/AndroidManifest.xml</span>
                  <button
                    onClick={() => copyToClipboard(manifestSnippet, 'manifest')}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    {copiedCode === 'manifest' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiedCode === 'manifest' ? 'COPIED!' : 'COPY'}</span>
                  </button>
                </div>
                <pre className="p-3 text-[10px] sm:text-[11px] font-mono overflow-x-auto text-emerald-400 leading-tight">
                  {manifestSnippet}
                </pre>
              </div>

              {/* ADB Command to Set Home Activity Directly */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold opacity-90">Set Home Launcher via ADB (Root / Developer Shell):</span>
                  <button
                    onClick={() => copyToClipboard(adbCommand, 'adb')}
                    className="flex items-center gap-1 text-[10px] opacity-80 hover:text-white"
                  >
                    {copiedCode === 'adb' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiedCode === 'adb' ? 'COPIED!' : 'COPY ADB'}</span>
                  </button>
                </div>
                <div
                  className="p-2.5 rounded-lg border font-mono text-[10px] sm:text-[11px] break-all select-all"
                  style={{ borderColor: theme.borderColor, backgroundColor: theme.bg, color: theme.promptColor }}
                >
                  {adbCommand}
                </div>
              </div>

              {/* ADB Clear Command */}
              <div className="space-y-1 text-[10px] opacity-75">
                <span>To revert to default launcher via ADB:</span>
                <code className="block p-1.5 rounded bg-black/40 border border-neutral-800 text-neutral-300">
                  adb shell cmd package set-home-activity --clear
                </code>
              </div>
            </div>
          )}

          {/* TAB 3: Desktop & iOS Setup */}
          {activeTab === 'desktop' && (
            <div className="space-y-3.5">
              {/* iOS Safari Guide */}
              <div
                className="p-3.5 rounded-xl border space-y-2"
                style={{ borderColor: theme.borderColor, backgroundColor: theme.bg }}
              >
                <div className="flex items-center gap-2 font-bold text-sm" style={{ color: theme.accentColor }}>
                  <Smartphone size={15} />
                  <span>iPhone / iPad (iOS Safari)</span>
                </div>
                <ol className="space-y-1.5 text-[11px] opacity-85 pl-1">
                  <li>1. Open this website in <strong>Safari</strong>.</li>
                  <li>2. Tap the <strong>Share button (□ with ↑)</strong> at the bottom bar.</li>
                  <li>3. Scroll down and tap <strong>Add to Home Screen (+)</strong>.</li>
                  <li>4. Tap <strong>Add</strong>. Launching from your home screen opens in full standalone launcher mode!</li>
                </ol>
              </div>

              {/* Desktop (Chrome / Edge / macOS / Linux / Windows) */}
              <div
                className="p-3.5 rounded-xl border space-y-2"
                style={{ borderColor: theme.borderColor, backgroundColor: theme.bg }}
              >
                <div className="flex items-center gap-2 font-bold text-sm" style={{ color: theme.promptColor }}>
                  <Monitor size={15} />
                  <span>Desktop (Windows / macOS / Linux / Chromebook)</span>
                </div>
                <ol className="space-y-1.5 text-[11px] opacity-85 pl-1">
                  <li>1. Click the <strong>Install icon (⊕)</strong> in your browser's address bar.</li>
                  <li>2. In Chrome/Edge settings, go to <code>chrome://apps</code> or <code>edge://apps</code>.</li>
                  <li>3. Right-click <strong>Android Terminal Launcher</strong> ➔ Check <strong>"Start app when you sign in"</strong>.</li>
                  <li>4. Enjoy a dedicated full-screen TUI desktop workstation shell!</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 4: Launcher Behavior Settings */}
          {activeTab === 'kiosk' && (
            <div className="space-y-3">
              <div className="font-bold text-sm pb-1 border-b" style={{ borderColor: theme.borderColor, color: theme.accentColor }}>
                Launcher Startup & Display Preferences
              </div>

              {/* Preference Item: Clock 24h */}
              <div
                className="flex items-center justify-between p-2.5 rounded-lg border"
                style={{ borderColor: theme.borderColor, backgroundColor: theme.bg }}
              >
                <div>
                  <div className="font-bold">24-Hour Digital Clock Format</div>
                  <div className="text-[10px] opacity-70">Enforce military/international 24H chronometer</div>
                </div>
                <button
                  onClick={() => {
                    playClick();
                    onUpdateConfig({ clock24h: !config.clock24h });
                  }}
                  className="px-3 py-1 rounded border text-[11px] font-bold transition-colors"
                  style={{
                    borderColor: config.clock24h ? theme.accentColor : theme.borderColor,
                    backgroundColor: config.clock24h ? `${theme.accentColor}25` : 'transparent',
                    color: config.clock24h ? theme.accentColor : theme.fg,
                  }}
                >
                  {config.clock24h ? 'ENABLED (24H)' : '12H (AM/PM)'}
                </button>
              </div>

              {/* Preference Item: Auto Focus Input */}
              <div
                className="flex items-center justify-between p-2.5 rounded-lg border"
                style={{ borderColor: theme.borderColor, backgroundColor: theme.bg }}
              >
                <div>
                  <div className="font-bold">Auto-Focus Terminal Prompt</div>
                  <div className="text-[10px] opacity-70">Focus command prompt instantly when launcher is opened</div>
                </div>
                <button
                  onClick={() => {
                    playClick();
                    onUpdateConfig({ autoFocusInput: !config.autoFocusInput });
                  }}
                  className="px-3 py-1 rounded border text-[11px] font-bold transition-colors"
                  style={{
                    borderColor: config.autoFocusInput ? theme.accentColor : theme.borderColor,
                    backgroundColor: config.autoFocusInput ? `${theme.accentColor}25` : 'transparent',
                    color: config.autoFocusInput ? theme.accentColor : theme.fg,
                  }}
                >
                  {config.autoFocusInput ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Preference Item: CRT Scanlines */}
              <div
                className="flex items-center justify-between p-2.5 rounded-lg border"
                style={{ borderColor: theme.borderColor, backgroundColor: theme.bg }}
              >
                <div>
                  <div className="font-bold">CRT Retro Terminal Shader</div>
                  <div className="text-[10px] opacity-70">Phosphor tube scanlines and high-contrast bloom</div>
                </div>
                <button
                  onClick={() => {
                    playClick();
                    onUpdateConfig({ crtEffect: !config.crtEffect });
                  }}
                  className="px-3 py-1 rounded border text-[11px] font-bold transition-colors"
                  style={{
                    borderColor: config.crtEffect ? theme.accentColor : theme.borderColor,
                    backgroundColor: config.crtEffect ? `${theme.accentColor}25` : 'transparent',
                    color: config.crtEffect ? theme.accentColor : theme.fg,
                  }}
                >
                  {config.crtEffect ? 'ACTIVE' : 'OFF'}
                </button>
              </div>

              {/* Terminal commands quick trigger info */}
              <div className="p-2 rounded bg-black/40 border border-neutral-800 text-[10px] opacity-75">
                Tip: You can open this setup dialog anytime by typing <code className="text-emerald-400">set-default-launcher</code> or <code className="text-emerald-400">launcher</code> in the terminal.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-t shrink-0 text-xs"
          style={{
            borderColor: theme.borderColor,
            backgroundColor: `${theme.cardBg}`,
          }}
        >
          <div className="text-[10px] opacity-70 flex items-center gap-1.5">
            <Terminal size={11} style={{ color: theme.promptColor }} />
            <span>CLI: <code>set-default-launcher</code></span>
          </div>

          <button
            id="btn-close-launcher-modal-footer"
            onClick={() => {
              playClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg border font-bold hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            style={{
              borderColor: theme.accentColor,
              backgroundColor: `${theme.accentColor}20`,
              color: theme.accentColor,
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
