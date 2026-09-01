/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Theme } from '../types';
import { 
  Android16ApkCompiler, 
  ApkBuildProgress, 
  ApkBuildResult 
} from '../utils/apkGenerator';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { soundManager } from '../utils/audio';
import { 
  CheckCircle2, 
  Download, 
  Layers, 
  Smartphone, 
  Terminal, 
  X, 
  ShieldCheck, 
  Cpu, 
  FileCode, 
  Package, 
  Copy, 
  ExternalLink 
} from 'lucide-react';

interface ApkCompilerModalProps {
  theme: Theme;
  onClose: () => void;
  soundEnabled: boolean;
}

export const ApkCompilerModal: React.FC<ApkCompilerModalProps> = ({
  theme,
  onClose,
  soundEnabled,
}) => {
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [currentProgress, setCurrentProgress] = useState<ApkBuildProgress | null>(null);
  const [buildResult, setBuildResult] = useState<ApkBuildResult | null>(null);
  const [copiedAdb, setCopiedAdb] = useState(false);
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Auto-start build on open
  useEffect(() => {
    handleStartBuild();
  }, []);

  const handleStartBuild = async () => {
    setIsBuilding(true);
    setBuildResult(null);
    if (soundEnabled) soundManager.playKeyClick('mechanical', 0.2);

    try {
      const result = await Android16ApkCompiler.compileAndPackage((prog) => {
        setCurrentProgress(prog);
      });
      setBuildResult(result);
      if (soundEnabled) soundManager.playSuccess(0.3);
    } catch (err) {
      console.error(err);
    } finally {
      setIsBuilding(false);
    }
  };

  const handleDownloadApk = () => {
    if (!buildResult) return;
    if (soundEnabled) soundManager.playKeyClick('mechanical', 0.25);

    const url = URL.createObjectURL(buildResult.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildResult.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyAdb = () => {
    const cmd = 'adb install -r AndroidTerminalLauncher-v16.0.0-release.apk';
    navigator.clipboard.writeText(cmd);
    setCopiedAdb(true);
    setTimeout(() => setCopiedAdb(false), 2000);
  };

  return (
    <div
      id="apk-compiler-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md font-mono"
      onClick={onClose}
    >
      <div
        id="apk-compiler-window"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] rounded-lg border shadow-2xl flex flex-col overflow-hidden text-xs md:text-sm"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.borderColor,
          color: theme.fg,
        }}
      >
        {/* Header Bar */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b shrink-0 select-none"
          style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
        >
          <div className="flex items-center gap-2">
            <Smartphone size={18} style={{ color: theme.promptColor }} />
            <div className="flex items-center gap-2">
              <span className="font-bold">Android 16 APK Compiler & Packaging Suite</span>
              <span 
                className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
                style={{ backgroundColor: `${theme.accentColor}20`, color: theme.accentColor }}
              >
                API 36 BAKLAVA
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:opacity-75">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Target Spec Badges */}
          <div 
            className="p-3 rounded border grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]"
            style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
          >
            <div>
              <span className="opacity-50 block text-[9px] uppercase">Target Platform</span>
              <span className="font-bold text-white">Android 16 (API 36)</span>
            </div>
            <div>
              <span className="opacity-50 block text-[9px] uppercase">Architecture</span>
              <span className="font-bold" style={{ color: theme.promptColor }}>arm64-v8a / 16KB</span>
            </div>
            <div>
              <span className="opacity-50 block text-[9px] uppercase">Package ID</span>
              <span className="font-bold truncate block" style={{ color: theme.accentColor }}>com.android.terminal</span>
            </div>
            <div>
              <span className="opacity-50 block text-[9px] uppercase">Signing Scheme</span>
              <span className="font-bold" style={{ color: theme.warningColor || '#ffcc00' }}>APK V3 Scheme</span>
            </div>
          </div>

          {/* Build Pipeline Status Bar */}
          <div 
            className="p-3.5 rounded border space-y-3"
            style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Cpu size={14} className={isBuilding ? 'animate-spin' : ''} style={{ color: theme.promptColor }} />
                <span className="font-bold">
                  {isBuilding ? 'Compiling Android 16 Native Binary...' : 'Compilation & Build Status'}
                </span>
              </div>
              <span className="opacity-70 text-[11px]">
                {currentProgress ? `${currentProgress.step} / ${currentProgress.totalSteps} steps` : ''}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded bg-black/40 overflow-hidden border border-white/10">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: currentProgress ? `${(currentProgress.step / currentProgress.totalSteps) * 100}%` : '0%',
                  backgroundColor: currentProgress?.status === 'success' ? theme.successColor : theme.promptColor,
                }}
              />
            </div>

            {/* Current Log / Progress Detail */}
            <div 
              className="p-2.5 rounded bg-black/50 border text-[11px] font-mono leading-relaxed"
              style={{ borderColor: `${theme.borderColor}60` }}
            >
              <div className="flex items-center gap-1.5" style={{ color: currentProgress?.status === 'success' ? theme.successColor : theme.promptColor }}>
                {currentProgress?.status === 'success' ? <CheckCircle2 size={13} /> : <Terminal size={13} />}
                <span className="font-bold">{currentProgress?.message || 'Initializing toolchain...'}</span>
              </div>
              {currentProgress?.detail && (
                <div className="opacity-70 text-[10px] mt-1 pl-4">
                  {currentProgress.detail}
                </div>
              )}
            </div>
          </div>

          {/* When Build is complete: APK artifact card & action buttons */}
          {buildResult && (
            <div 
              className="p-4 rounded border space-y-3.5 transition-all"
              style={{ backgroundColor: `${theme.accentColor}0c`, borderColor: theme.accentColor }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3" style={{ borderColor: `${theme.borderColor}80` }}>
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-10 h-10 rounded border flex items-center justify-center font-bold"
                    style={{ backgroundColor: theme.bg, borderColor: theme.accentColor, color: theme.accentColor }}
                  >
                    <Package size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-white">{buildResult.filename}</h4>
                    <span className="text-[10px] opacity-70">
                      Target SDK: {buildResult.targetSdk} (Android 16) • Size: {Math.round(buildResult.size / 1024)} KB
                    </span>
                  </div>
                </div>

                {/* Direct Download Button */}
                <button
                  id="btn-download-apk-binary"
                  onClick={handleDownloadApk}
                  className="px-4 py-2 rounded font-bold flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95"
                  style={{
                    backgroundColor: theme.accentColor,
                    color: '#000',
                  }}
                >
                  <Download size={15} />
                  <span>Download APK Bundle</span>
                </button>
              </div>

              {/* Install PWA directly if supported */}
              {isInstallable && (
                <div 
                  className="p-2.5 rounded border flex items-center justify-between"
                  style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
                >
                  <div className="text-[11px]">
                    <span className="font-bold text-white block">Instant Android 16 WebAPK Install</span>
                    <span className="opacity-60 text-[10px]">Install standalone launcher directly to home screen</span>
                  </div>
                  <button
                    onClick={install}
                    className="px-3 py-1.5 rounded font-bold border text-xs flex items-center gap-1.5 hover:opacity-80"
                    style={{ backgroundColor: `${theme.promptColor}20`, borderColor: theme.promptColor, color: theme.promptColor }}
                  >
                    <ExternalLink size={12} />
                    <span>Install Now</span>
                  </button>
                </div>
              )}

              {/* Sideload ADB instruction */}
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between opacity-80 text-[10px]">
                  <span>INSTALL VIA ADB / SIDELOAD:</span>
                  <button 
                    onClick={handleCopyAdb}
                    className="flex items-center gap-1 hover:underline text-xs"
                    style={{ color: theme.promptColor }}
                  >
                    <Copy size={11} />
                    <span>{copiedAdb ? 'Copied!' : 'Copy Command'}</span>
                  </button>
                </div>
                <div 
                  className="p-2 rounded bg-black/70 border font-mono text-[11px] select-all flex items-center justify-between"
                  style={{ borderColor: theme.borderColor, color: theme.warningColor || '#ffcc00' }}
                >
                  <code>adb install -r {buildResult.filename}</code>
                </div>
              </div>
            </div>
          )}

          {/* Android 16 Features Included */}
          <div 
            className="p-3 rounded border space-y-2 text-[11px]"
            style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
          >
            <h4 className="font-bold text-xs flex items-center gap-1.5" style={{ color: theme.promptColor }}>
              <ShieldCheck size={14} />
              <span>Android 16 (API 36 Baklava) Native Specifications</span>
            </h4>
            <ul className="space-y-1 opacity-80 text-[11px] list-disc list-inside">
              <li><strong className="text-white">Edge-to-Edge by Default:</strong> Transparent status bar and system navigation bar with zero letterboxing.</li>
              <li><strong className="text-white">16 KB Memory Page Alignment:</strong> Fully compliant with Android 15 & 16 16KB physical memory page size requirements.</li>
              <li><strong className="text-white">Predictive Back Gestures:</strong> Native <code className="text-amber-300">android:enableOnBackInvokedCallback="true"</code> integration.</li>
              <li><strong className="text-white">Standalone Home Launcher:</strong> Includes <code className="text-sky-300">android.intent.category.HOME</code> intent-filter to run as default launcher.</li>
              <li><strong className="text-white">V3 APK Signing Scheme:</strong> Embedded SHA-256 signature block for direct sideloading.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div
          className="p-3 border-t flex items-center justify-between text-xs select-none"
          style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
        >
          <button
            onClick={handleStartBuild}
            disabled={isBuilding}
            className="px-3 py-1.5 rounded border text-xs hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: theme.borderColor }}
          >
            {isBuilding ? 'Building...' : 'Re-compile Source'}
          </button>
          
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded font-bold border hover:opacity-80"
            style={{ backgroundColor: theme.promptColor, color: '#000', borderColor: theme.promptColor }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
