/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Theme, BatteryTelemetry } from '../types';
import { soundManager } from '../utils/audio';
import { 
  Battery, 
  BatteryCharging, 
  BatteryLow, 
  BatteryMedium, 
  Zap, 
  X, 
  ShieldCheck, 
  Activity, 
  Sliders, 
  Flame, 
  Clock, 
  Cpu, 
  Power, 
  RefreshCw, 
  CheckCircle2, 
  FileText,
  AlertTriangle
} from 'lucide-react';

interface BatteryMonitorModalProps {
  theme: Theme;
  batteryData: BatteryTelemetry;
  onClose: () => void;
  onTogglePowerSaver: () => void;
  onRunDiagnostic: () => void;
  soundEnabled: boolean;
}

export const BatteryMonitorModal: React.FC<BatteryMonitorModalProps> = ({
  theme,
  batteryData,
  onClose,
  onTogglePowerSaver,
  onRunDiagnostic,
  soundEnabled,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'apps' | 'health'>('overview');
  const [optimizedApps, setOptimizedApps] = useState<string[]>([]);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationSuccess, setCalibrationSuccess] = useState(false);

  const getBatteryIcon = (level: number, isCharging: boolean) => {
    if (isCharging) return <BatteryCharging size={24} className="text-emerald-400 animate-pulse" />;
    if (level <= 20) return <BatteryLow size={24} className="text-rose-400 animate-bounce" />;
    if (level <= 60) return <BatteryMedium size={24} className="text-amber-400" />;
    return <Battery size={24} className="text-emerald-400" />;
  };

  const handleOptimizeApp = (appName: string) => {
    if (soundEnabled) soundManager.playKeyClick('mechanical', 0.2);
    setOptimizedApps((prev) => [...prev, appName]);
  };

  const handleOptimizeAll = () => {
    if (soundEnabled) soundManager.playSuccess(0.3);
    setOptimizedApps(batteryData.appDrain.map((a) => a.name));
  };

  const handleCalibrate = () => {
    if (soundEnabled) soundManager.playKeyClick('mechanical', 0.2);
    setIsCalibrating(true);
    setCalibrationSuccess(false);

    setTimeout(() => {
      setIsCalibrating(false);
      setCalibrationSuccess(true);
      if (soundEnabled) soundManager.playSuccess(0.3);
      onRunDiagnostic();
      setTimeout(() => setCalibrationSuccess(false), 4000);
    }, 1800);
  };

  const remainingHours = Math.floor((batteryData.level / 100) * 22);
  const remainingMins = Math.floor(((batteryData.level / 100) * 22 * 60) % 60);

  return (
    <div
      id="battery-monitor-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md font-mono"
      onClick={onClose}
    >
      <div
        id="battery-monitor-window"
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
          <div className="flex items-center gap-2.5">
            {getBatteryIcon(batteryData.level, batteryData.isCharging)}
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">Android 16 Hardware Battery Monitor</span>
              <span 
                className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
                style={{
                  backgroundColor: batteryData.isCharging ? `${theme.successColor}20` : `${theme.promptColor}20`,
                  color: batteryData.isCharging ? theme.successColor : theme.promptColor,
                }}
              >
                {batteryData.isCharging ? '⚡ CHARGING (45W)' : 'DISCHARGING'}
              </span>
              {batteryData.powerSaver && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  SAVER ON
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:opacity-75">
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div 
          className="flex border-b shrink-0 text-xs select-none"
          style={{ backgroundColor: `${theme.bg}80`, borderColor: theme.borderColor }}
        >
          <button
            id="tab-battery-overview"
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 text-center font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === 'overview' ? 'border-current' : 'border-transparent opacity-60 hover:opacity-90'
            }`}
            style={{ color: activeTab === 'overview' ? theme.promptColor : theme.fg }}
          >
            <Activity size={13} />
            <span>Overview & Stats</span>
          </button>
          <button
            id="tab-battery-apps"
            onClick={() => setActiveTab('apps')}
            className={`flex-1 py-2 text-center font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === 'apps' ? 'border-current' : 'border-transparent opacity-60 hover:opacity-90'
            }`}
            style={{ color: activeTab === 'apps' ? theme.promptColor : theme.fg }}
          >
            <Cpu size={13} />
            <span>Process Drain ({batteryData.appDrain.length})</span>
          </button>
          <button
            id="tab-battery-health"
            onClick={() => setActiveTab('health')}
            className={`flex-1 py-2 text-center font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === 'health' ? 'border-current' : 'border-transparent opacity-60 hover:opacity-90'
            }`}
            style={{ color: activeTab === 'health' ? theme.promptColor : theme.fg }}
          >
            <ShieldCheck size={13} />
            <span>Health & Diagnostics</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'overview' && (
            <>
              {/* Primary Gauge & Telemetry Box */}
              <div
                className="p-4 rounded border space-y-4"
                style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
              >
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center font-bold shadow-inner"
                         style={{ 
                           borderColor: batteryData.level > 20 ? (batteryData.isCharging ? theme.successColor : theme.promptColor) : theme.errorColor,
                           backgroundColor: `${theme.cardBg}`
                         }}>
                      <span className="text-2xl">{batteryData.level}%</span>
                      <span className="text-[9px] opacity-70 uppercase tracking-tight">
                        {batteryData.isCharging ? 'Charging' : 'Remaining'}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                        {batteryData.isCharging ? (
                          <>
                            <Zap size={16} className="text-emerald-400" />
                            <span>Fast Charging (45W PPS)</span>
                          </>
                        ) : (
                          <>
                            <Clock size={16} style={{ color: theme.promptColor }} />
                            <span>Estimated {remainingHours}h {remainingMins}m</span>
                          </>
                        )}
                      </h3>
                      <p className="text-xs opacity-75 mt-0.5">
                        {batteryData.isCharging 
                          ? `Estimated 100% full in approx. ${Math.max(5, Math.round((100 - batteryData.level) * 0.45))} mins`
                          : `Active power consumption: ${batteryData.powerWatts.toFixed(1)} Watts`
                        }
                      </p>
                    </div>
                  </div>

                  {/* Power Saver Quick Toggle */}
                  <button
                    id="btn-toggle-power-saver"
                    onClick={onTogglePowerSaver}
                    className="px-3.5 py-2 rounded font-bold border flex items-center gap-2 transition-all hover:scale-105 active:scale-95 text-xs shadow-sm"
                    style={{
                      backgroundColor: batteryData.powerSaver ? `${theme.warningColor || '#ffb300'}25` : `${theme.cardBg}`,
                      borderColor: batteryData.powerSaver ? (theme.warningColor || '#ffb300') : theme.borderColor,
                      color: batteryData.powerSaver ? (theme.warningColor || '#ffb300') : theme.fg,
                    }}
                  >
                    <Power size={14} />
                    <span>{batteryData.powerSaver ? 'Disable Power Saver' : 'Enable Power Saver'}</span>
                  </button>
                </div>

                {/* Progress bar visual */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] opacity-70">
                    <span>0%</span>
                    <span>CHARGE LEVEL GAUGE</span>
                    <span>100%</span>
                  </div>
                  <div className="w-full h-3 rounded bg-black/50 border border-white/10 overflow-hidden flex">
                    <div
                      className="h-full transition-all duration-500 relative"
                      style={{
                        width: `${batteryData.level}%`,
                        backgroundColor: batteryData.level > 20 ? (batteryData.isCharging ? theme.successColor : theme.promptColor) : theme.errorColor,
                      }}
                    >
                      {batteryData.isCharging && (
                        <div className="absolute inset-0 bg-white/30 animate-pulse" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Hardware Telemetry 4-Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div 
                  className="p-3 rounded border"
                  style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
                >
                  <span className="opacity-60 block text-[10px] uppercase flex items-center gap-1">
                    <Zap size={11} /> Voltage
                  </span>
                  <span className="text-sm font-bold text-white mt-1 block">
                    {(batteryData.voltageMv / 1000).toFixed(3)} V
                  </span>
                  <span className="text-[9px] opacity-60">{batteryData.voltageMv} mV</span>
                </div>

                <div 
                  className="p-3 rounded border"
                  style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
                >
                  <span className="opacity-60 block text-[10px] uppercase flex items-center gap-1">
                    <Flame size={11} /> Temp
                  </span>
                  <span className="text-sm font-bold text-white mt-1 block">
                    {batteryData.temperatureC.toFixed(1)}°C
                  </span>
                  <span className="text-[9px] opacity-60">
                    {((batteryData.temperatureC * 9/5) + 32).toFixed(1)}°F (Normal)
                  </span>
                </div>

                <div 
                  className="p-3 rounded border"
                  style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
                >
                  <span className="opacity-60 block text-[10px] uppercase flex items-center gap-1">
                    <Activity size={11} /> Current
                  </span>
                  <span className="text-sm font-bold mt-1 block" style={{ color: batteryData.isCharging ? theme.successColor : theme.promptColor }}>
                    {batteryData.isCharging ? `+${batteryData.currentMa}` : `${batteryData.currentMa}`} mA
                  </span>
                  <span className="text-[9px] opacity-60">{batteryData.powerWatts.toFixed(2)} W flow</span>
                </div>

                <div 
                  className="p-3 rounded border"
                  style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
                >
                  <span className="opacity-60 block text-[10px] uppercase flex items-center gap-1">
                    <ShieldCheck size={11} /> Health
                  </span>
                  <span className="text-sm font-bold text-emerald-400 mt-1 block">
                    {batteryData.health} (98.4%)
                  </span>
                  <span className="text-[9px] opacity-60">{batteryData.cycleCount} cycles</span>
                </div>
              </div>

              {/* 24-Hour Discharge Curve History */}
              <div 
                className="p-3.5 rounded border space-y-2.5"
                style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold flex items-center gap-1.5" style={{ color: theme.promptColor }}>
                    <Activity size={14} />
                    <span>24-Hour Power Discharge & Usage History</span>
                  </span>
                  <span className="text-[10px] opacity-60">Sample rate: 10 mins</span>
                </div>

                {/* Graph bars */}
                <div className="h-24 flex items-end gap-1.5 pt-2 pb-1 border-b border-white/10">
                  {batteryData.history.map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                      {/* Tooltip on hover */}
                      <div className="hidden group-hover:block absolute -top-8 px-1.5 py-0.5 bg-black text-[9px] rounded border border-white/20 z-10 whitespace-nowrap">
                        {h.time}: {h.level}% ({h.power}W)
                      </div>
                      <div 
                        className="w-full rounded-t transition-all duration-300 group-hover:brightness-125"
                        style={{
                          height: `${Math.max(12, h.level)}%`,
                          backgroundColor: h.level > 50 ? theme.promptColor : (h.level > 20 ? (theme.warningColor || '#ffb300') : theme.errorColor),
                          opacity: 0.75 + (i * 0.02)
                        }}
                      />
                      <span className="text-[8px] opacity-50 font-mono scale-90">{h.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'apps' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-xs">Application & Hardware Power Consumption</h4>
                  <p className="text-[11px] opacity-70">Ranked by mA drain since last full charge</p>
                </div>
                <button
                  onClick={handleOptimizeAll}
                  disabled={optimizedApps.length === batteryData.appDrain.length}
                  className="px-3 py-1.5 rounded font-bold border text-xs flex items-center gap-1.5 hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: `${theme.promptColor}20`, borderColor: theme.promptColor, color: theme.promptColor }}
                >
                  <Zap size={12} />
                  <span>Optimize All</span>
                </button>
              </div>

              <div className="space-y-2">
                {batteryData.appDrain.map((app) => {
                  const isOptimized = optimizedApps.includes(app.name);
                  return (
                    <div
                      key={app.name}
                      className="p-3 rounded border flex items-center justify-between gap-3 transition-colors"
                      style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs truncate text-white">{app.name}</span>
                          <span className="text-[11px] font-bold" style={{ color: theme.promptColor }}>
                            {isOptimized ? '0.0% (Suspended)' : `${app.percentage.toFixed(1)}%`}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded bg-black/40 overflow-hidden">
                          <div
                            className="h-full transition-all duration-300"
                            style={{
                              width: isOptimized ? '0%' : `${(app.percentage / 35) * 100}%`,
                              backgroundColor: isOptimized ? theme.successColor : theme.accentColor,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] opacity-60 mt-1">
                          <span>{app.category}</span>
                          <span>{isOptimized ? '0 mAh' : `${app.mah} mAh`}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleOptimizeApp(app.name)}
                        disabled={isOptimized}
                        className="px-2.5 py-1 rounded border text-[10px] font-bold shrink-0 transition-opacity hover:opacity-80 disabled:opacity-40"
                        style={{
                          borderColor: isOptimized ? theme.successColor : theme.borderColor,
                          color: isOptimized ? theme.successColor : theme.fg,
                          backgroundColor: isOptimized ? `${theme.successColor}15` : 'transparent'
                        }}
                      >
                        {isOptimized ? '✓ Throttled' : 'Throttle'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'health' && (
            <div className="space-y-3.5">
              <div 
                className="p-3.5 rounded border space-y-2.5"
                style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
              >
                <h4 className="font-bold text-xs flex items-center gap-1.5" style={{ color: theme.promptColor }}>
                  <ShieldCheck size={14} />
                  <span>Battery Cell Health & Chemistry Diagnostic</span>
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="opacity-70">Design Capacity:</span>
                    <span className="font-bold">{batteryData.designCapacityMah} mAh</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="opacity-70">Estimated Real Capacity:</span>
                    <span className="font-bold text-emerald-400">{batteryData.currentCapacityMah} mAh (98.4%)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="opacity-70">Battery Chemistry:</span>
                    <span className="font-bold">{batteryData.technology}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="opacity-70">Completed Charge Cycles:</span>
                    <span className="font-bold">{batteryData.cycleCount} cycles</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="opacity-70">Charging Protocol:</span>
                    <span className="font-bold text-sky-400">{batteryData.chargingProtocol}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="opacity-70">Thermal Status:</span>
                    <span className="font-bold text-emerald-400">Normal (Safe operating temp &lt; 42°C)</span>
                  </div>
                </div>
              </div>

              {/* Calibration & Diagnostic Action */}
              <div 
                className="p-3.5 rounded border flex flex-col sm:flex-row items-center justify-between gap-3"
                style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
              >
                <div>
                  <h5 className="font-bold text-white text-xs">Run Sensor Recalibration</h5>
                  <p className="text-[11px] opacity-70">Recalibrate battery fuel gauge IC & voltage lookup table</p>
                </div>

                <button
                  id="btn-calibrate-battery"
                  onClick={handleCalibrate}
                  disabled={isCalibrating}
                  className="px-4 py-2 rounded font-bold border text-xs flex items-center gap-2 hover:opacity-80 disabled:opacity-50 shadow-md"
                  style={{
                    backgroundColor: theme.promptColor,
                    borderColor: theme.promptColor,
                    color: '#000',
                  }}
                >
                  <RefreshCw size={13} className={isCalibrating ? 'animate-spin' : ''} />
                  <span>{isCalibrating ? 'Calibrating Sensors...' : 'Run Calibration'}</span>
                </button>
              </div>

              {calibrationSuccess && (
                <div className="p-3 rounded bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Battery fuel gauge successfully calibrated! Voltage curve updated.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-3 border-t flex items-center justify-between text-xs select-none"
          style={{ backgroundColor: theme.bg, borderColor: theme.borderColor }}
        >
          <div className="text-[11px] opacity-60 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Real-time polling active (sys/class/power_supply)</span>
          </div>
          
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
