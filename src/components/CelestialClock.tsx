/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Theme, LauncherConfig } from '../types';
import { 
  Sun, 
  Sunrise, 
  Sunset, 
  Moon, 
  MoonStar, 
  Sparkles, 
  Clock, 
  Calendar, 
  Compass, 
  X, 
  Maximize2, 
  Play, 
  RotateCcw,
  Layers
} from 'lucide-react';
import { soundManager } from '../utils/audio';

export type DayPeriod = 'morning' | 'noon' | 'evening' | 'night';

export interface CelestialPhaseInfo {
  period: DayPeriod;
  label: string;
  sublabel: string;
  badgeColor: string;
  glowColor: string;
  icon: React.ReactNode;
  asciiArt: string;
  description: string;
  hoursRange: string;
}

export function getDayPeriod(hours: number): DayPeriod {
  if (hours >= 5 && hours < 12) return 'morning';
  if (hours >= 12 && hours < 17) return 'noon';
  if (hours >= 17 && hours < 21) return 'evening';
  return 'night';
}

export function getCelestialInfo(period: DayPeriod): CelestialPhaseInfo {
  switch (period) {
    case 'morning':
      return {
        period: 'morning',
        label: 'Morning',
        sublabel: 'Dawn / Sunrise Ascent',
        badgeColor: '#f59e0b',
        glowColor: 'rgba(245, 158, 11, 0.4)',
        icon: <Sunrise size={15} className="text-amber-400" />,
        asciiArt: `
      \\   |   /     
       .-'''-.      [ MORNING : DAWN ASCENT ]
    --(  ☀️  )--   05:00 - 11:59
       .'-.-'.      Sun climbs eastern horizon
      /   |   \\     
~~~~~~~~~~~~~~~~~~~~ (Eastern Horizon)
`,
        description: 'Sun ascends in the East. Solar irradiance increasing, ambient temperature climbing.',
        hoursRange: '05:00 - 11:59',
      };
    case 'noon':
      return {
        period: 'noon',
        label: 'Noon',
        sublabel: 'Solar Zenith / Midday',
        badgeColor: '#eab308',
        glowColor: 'rgba(234, 179, 8, 0.5)',
        icon: <Sun size={15} className="text-yellow-400 animate-spin-slow" />,
        asciiArt: `
       \\  |  /      
     '-. | .-'     [ NOON : SOLAR ZENITH ]
    — ( 🌞 ) —     12:00 - 16:59
     .-' | '-.     Peak solar altitude at meridian
       /  |  \\      
==================== (Ground Level)
`,
        description: 'Sun reaches apex at solar meridian. Maximum UV exposure and peak daylight luminosity.',
        hoursRange: '12:00 - 16:59',
      };
    case 'evening':
      return {
        period: 'evening',
        label: 'Evening',
        sublabel: 'Dusk / Sunset Descent',
        badgeColor: '#f97316',
        glowColor: 'rgba(249, 115, 22, 0.4)',
        icon: <Sunset size={15} className="text-orange-400" />,
        asciiArt: `
       .---.        
     /       \\      [ EVENING : TWILIGHT DESCENT ]
    |   🌇    |     17:00 - 20:59
- - -\\-------/- - - Golden hour & twilight horizon
~~~~~~~~~~~~~~~~~~~~ (Western Horizon)
`,
        description: 'Sun dips below western horizon into twilight. Golden hour transitions into civil dusk.',
        hoursRange: '17:00 - 20:59',
      };
    case 'night':
    default:
      return {
        period: 'night',
        label: 'Night',
        sublabel: 'Starlit Nocturnal Orbit',
        badgeColor: '#818cf8',
        glowColor: 'rgba(129, 140, 248, 0.4)',
        icon: <MoonStar size={15} className="text-indigo-300" />,
        asciiArt: `
       .---.        *   .   *   .  ✨
      /   / \\       [ NIGHT : NOCTURNAL SKY ]
     |   |   |   .  21:00 - 04:59
      \\   \\ /       Lunar transit & stellar cosmos
       '---'   *    
.................... (Night Horizon)
`,
        description: 'Nocturnal sky illuminated by the Moon and constellation stars. Solar cycle in nadir.',
        hoursRange: '21:00 - 04:59',
      };
  }
}

interface StatusBarClockPillProps {
  theme: Theme;
  config: LauncherConfig;
  onOpenModal: () => void;
}

export interface CelestialDateTimeSectionProps {
  theme: Theme;
  config: LauncherConfig;
  onOpenModal: () => void;
}

/**
 * 24-Hour Date, Day & Time Bar
 * Styled at 90% width directly below the top Apps/Notifs/Term navigation.
 */
export const CelestialDateTimeSection: React.FC<CelestialDateTimeSectionProps> = ({
  theme,
  config,
  onOpenModal,
}) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // 24-hour format: HH:mm:ss
  const time24h = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  // Abbreviated 3-letter day of week (e.g. Wed) & date
  const dayAbbr = now.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum = String(now.getDate()).padStart(2, '0');
  const monthName = now.toLocaleDateString('en-US', { month: 'short' });
  const year = now.getFullYear();
  const dateFormatted = `${dayNum} ${monthName} ${year}`;

  const currentPeriod = getDayPeriod(hours);
  const activeInfo = getCelestialInfo(currentPeriod);

  return (
    <section
      id="celestial-datetime-section"
      aria-label="Date, Day and Time"
      onClick={onOpenModal}
      title="Click to open Chronometer & Calendar Tracker"
      className="w-[90%] max-w-6xl mx-auto my-1.5 sm:my-2 px-3 sm:px-4 py-2 rounded-xl border transition-all duration-300 shadow-sm hover:shadow-md font-mono select-none overflow-hidden shrink-0 cursor-pointer hover:bg-white/5 flex items-center justify-center sm:justify-between"
      style={{
        backgroundColor: theme.cardBg,
        borderColor: `${theme.borderColor}90`,
        color: theme.fg,
      }}
    >
      {/* Time, Date, and (Day) on the exact same line, with Day next to Date */}
      <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap sm:flex-nowrap font-mono justify-center">
        {/* 24h Time */}
        <span 
          className="text-base sm:text-lg md:text-xl font-black tracking-widest leading-none font-mono"
          style={{ color: theme.accentColor || activeInfo.badgeColor }}
        >
          {time24h}
        </span>

        {/* Date */}
        <span className="text-xs sm:text-sm md:text-base font-semibold opacity-90 tracking-tight whitespace-nowrap">
          {dateFormatted}
        </span>

        {/* Abbreviated Day next to Date in parenthesis, ex. (Wed) */}
        <span 
          className="text-xs sm:text-sm font-bold tracking-wide px-1.5 py-0.5 rounded border leading-none shrink-0"
          style={{
            backgroundColor: `${theme.accentColor || activeInfo.badgeColor}15`,
            borderColor: `${theme.accentColor || activeInfo.badgeColor}40`,
            color: theme.accentColor || activeInfo.badgeColor,
          }}
        >
          ({dayAbbr})
        </span>
      </div>

      {/* Subtle click hint on the right */}
      <div className="hidden sm:flex items-center gap-1 text-[11px] opacity-50 font-mono">
        <Clock size={12} />
        <span>CALENDAR</span>
      </div>
    </section>
  );
};

export const StatusBarClockPill: React.FC<StatusBarClockPillProps> = ({
  theme,
  config,
  onOpenModal,
}) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // Strict 24-hour format: HH:mm:ss
  const time24h = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  // Day and Date formatting
  const dayName = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dayNum = String(now.getDate()).padStart(2, '0');
  const monthName = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const year = now.getFullYear();
  const dateFormatted = `${dayName}, ${dayNum} ${monthName}`;

  const period = getDayPeriod(hours);
  const info = getCelestialInfo(period);

  return (
    <button
      id="btn-status-celestial-clock"
      onClick={onOpenModal}
      title={`24h Clock: ${time24h} • ${dayName}, ${dayNum} ${monthName} ${year} • Phase: ${info.label} (${info.sublabel})\nClick to open Celestial Solar/Lunar Clock Monitor`}
      className="group flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] font-mono cursor-pointer"
      style={{
        borderColor: `${info.badgeColor}60`,
        backgroundColor: `${info.badgeColor}12`,
        color: theme.fg,
        boxShadow: `0 0 10px ${info.glowColor}`,
      }}
    >
      {/* Small Celestial Icon Diagram */}
      <div 
        className="flex items-center justify-center w-4 h-4 rounded-full shrink-0 transition-transform group-hover:rotate-12"
        style={{
          backgroundColor: `${info.badgeColor}25`,
          border: `1px solid ${info.badgeColor}70`,
        }}
      >
        {info.icon}
      </div>

      {/* 24-Hour Time Readout */}
      <div className="flex items-baseline gap-1">
        <span 
          className="font-bold tracking-wider text-[11px] sm:text-xs" 
          style={{ color: info.badgeColor }}
        >
          {time24h}
        </span>
      </div>

      {/* Phase Badge */}
      <span 
        className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider hidden sm:inline"
        style={{
          backgroundColor: `${info.badgeColor}25`,
          color: info.badgeColor,
          border: `1px solid ${info.badgeColor}50`,
        }}
      >
        {info.label}
      </span>
    </button>
  );
};

interface CelestialClockModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  config: LauncherConfig;
}

export const CelestialClockModal: React.FC<CelestialClockModalProps> = ({
  isOpen,
  onClose,
  theme,
  config,
}) => {
  const [time, setTime] = useState(new Date());
  const [simulatedPeriod, setSimulatedPeriod] = useState<DayPeriod | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentHours = time.getHours();
  const currentMinutes = time.getMinutes();
  const currentSeconds = time.getSeconds();

  // Active period (either live or user simulation for previewing Morning/Noon/Evening/Night)
  const activePeriod = simulatedPeriod || getDayPeriod(currentHours);
  const activeInfo = getCelestialInfo(activePeriod);

  // Time calculations
  const time24h = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}:${String(currentSeconds).padStart(2, '0')}`;
  const fullDayName = time.toLocaleDateString('en-US', { weekday: 'long' });
  const fullDateStr = time.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Day of year calculation
  const startOfYear = new Date(time.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((time.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const totalDaysInYear = (time.getFullYear() % 4 === 0 && (time.getFullYear() % 100 !== 0 || time.getFullYear() % 400 === 0)) ? 366 : 365;

  // 24-Hour Solar Angle (0° = 00:00 midnight at bottom, 90° = 06:00 sunrise at left, 180° = 12:00 noon at top, 270° = 18:00 sunset at right)
  const totalMinutesInDay = currentHours * 60 + currentMinutes;
  const dayPct = (totalMinutesInDay / 1440) * 100;
  
  // Celestial orbit angle in radians (0 to 2PI)
  const sunAngleDeg = (totalMinutesInDay / 1440) * 360;

  const phases: { period: DayPeriod; timeRange: string; name: string; icon: React.ReactNode; color: string }[] = [
    { period: 'morning', timeRange: '05:00 - 11:59', name: 'Morning', icon: <Sunrise size={14} />, color: '#f59e0b' },
    { period: 'noon', timeRange: '12:00 - 16:59', name: 'Noon', icon: <Sun size={14} />, color: '#eab308' },
    { period: 'evening', timeRange: '17:00 - 20:59', name: 'Evening', icon: <Sunset size={14} />, color: '#f97316' },
    { period: 'night', timeRange: '21:00 - 04:59', name: 'Night', icon: <MoonStar size={14} />, color: '#818cf8' },
  ];

  return (
    <div 
      id="celestial-clock-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md font-mono select-none"
      onClick={onClose}
    >
      <div 
        id="celestial-clock-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.borderColor,
          color: theme.fg,
          boxShadow: `0 0 35px ${activeInfo.glowColor}`,
        }}
      >
        {/* Modal Header */}
        <div 
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ borderColor: theme.borderColor, backgroundColor: `${theme.cardBg}95` }}
        >
          <div className="flex items-center gap-2">
            <div 
              className="p-1.5 rounded-lg border"
              style={{ borderColor: `${activeInfo.badgeColor}70`, backgroundColor: `${activeInfo.badgeColor}20` }}
            >
              {activeInfo.icon}
            </div>
            <div>
              <div className="text-xs font-bold tracking-wider flex items-center gap-2" style={{ color: activeInfo.badgeColor }}>
                CELESTIAL CHRONOMETER & SOLAR/LUNAR TRACKER
              </div>
              <div className="text-[10px] opacity-70">
                24-Hour Hardware Real-Time Clock • {timezone}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              if (config.soundEnabled) soundManager.playKeyClick('mechanical', 0.2);
              onClose();
            }}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: theme.fg }}
            title="Close Clock (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Main 24-Hour Digital Clock Readout & Day/Date */}
          <div 
            className="flex flex-col items-center justify-center p-5 rounded-xl border text-center relative overflow-hidden"
            style={{
              borderColor: `${activeInfo.badgeColor}50`,
              backgroundColor: `${activeInfo.badgeColor}08`,
            }}
          >
            {/* Background Solar/Lunar Glow */}
            <div 
              className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20"
              style={{ backgroundColor: activeInfo.badgeColor }}
            />

            {/* Day and Full Date Banner */}
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-wide uppercase mb-1 opacity-90">
              <Calendar size={13} style={{ color: activeInfo.badgeColor }} />
              <span>{fullDayName}, {fullDateStr}</span>
            </div>

            {/* Big 24-Hour Digital Time Display */}
            <div 
              className="text-4xl sm:text-6xl font-black tracking-widest my-2 drop-shadow-md font-mono"
              style={{ color: activeInfo.badgeColor }}
            >
              {time24h}
            </div>

            {/* Active Period & Coordinates */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              <span 
                className="px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-sm"
                style={{
                  backgroundColor: `${activeInfo.badgeColor}25`,
                  borderColor: `${activeInfo.badgeColor}60`,
                  color: activeInfo.badgeColor,
                }}
              >
                {activeInfo.icon}
                <span>CURRENT PHASE: {activeInfo.label.toUpperCase()} ({activeInfo.hoursRange})</span>
              </span>
              <span className="text-[11px] opacity-75 border px-2 py-0.5 rounded" style={{ borderColor: theme.borderColor }}>
                DAY {dayOfYear} OF {totalDaysInYear} • {dayPct.toFixed(1)}% OF 24H CYCLE
              </span>
            </div>
          </div>

          {/* Small Visual Diagram of Sun / Moon Across the 4 Phases */}
          <div 
            className="p-4 rounded-xl border space-y-3"
            style={{ borderColor: theme.borderColor, backgroundColor: `${theme.cardBg}50` }}
          >
            <div className="flex items-center justify-between text-xs font-bold tracking-wide">
              <span className="flex items-center gap-1.5" style={{ color: theme.promptColor }}>
                <Compass size={13} />
                <span>SOLAR & LUNAR CELESTIAL SKY DIAGRAM</span>
              </span>
              <span className="text-[10px] opacity-60">
                {simulatedPeriod ? `[PREVIEWING: ${simulatedPeriod.toUpperCase()}]` : '[LIVE SOLAR ORBIT]'}
              </span>
            </div>

            {/* Visual SVG Celestial Arc showing Morning, Noon, Evening, Night */}
            <div className="w-full bg-black/40 rounded-lg p-3 border overflow-hidden relative" style={{ borderColor: theme.borderColor }}>
              <svg viewBox="0 0 600 160" className="w-full h-auto select-none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  {/* Sky Gradients */}
                  <linearGradient id="skyArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
                    <stop offset="25%" stopColor="#f59e0b" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#eab308" stopOpacity="0.9" />
                    <stop offset="75%" stopColor="#f97316" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#4338ca" stopOpacity="0.4" />
                  </linearGradient>

                  <linearGradient id="glowDawn" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.6" />
                  </linearGradient>

                  <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                    <stop offset="40%" stopColor="#fef08a" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Horizon Line */}
                <line x1="20" y1="125" x2="580" y2="125" stroke={theme.borderColor} strokeWidth="1.5" strokeDasharray="3 3" />
                <text x="25" y="140" fill={theme.fg} fontSize="9" opacity="0.6" fontFamily="monospace">EAST (Sunrise ~06:00)</text>
                <text x="300" y="140" fill={theme.fg} fontSize="9" opacity="0.8" textAnchor="middle" fontFamily="monospace">SOUTH (Meridian Zenith ~12:00)</text>
                <text x="575" y="140" fill={theme.fg} fontSize="9" opacity="0.6" textAnchor="end" fontFamily="monospace">WEST (Sunset ~18:00)</text>

                {/* Celestial Path Arc */}
                <path
                  d="M 50 125 Q 300 20 550 125"
                  fill="none"
                  stroke="url(#skyArcGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* 4 Quadrant Indicators */}
                {/* 1. Morning Node (X: 140, Y: 68) */}
                <g className="cursor-pointer" onClick={() => setSimulatedPeriod('morning')}>
                  <circle cx="140" cy="68" r={activePeriod === 'morning' ? "14" : "10"} fill="#f59e0b" fillOpacity={activePeriod === 'morning' ? "0.4" : "0.15"} stroke="#f59e0b" strokeWidth={activePeriod === 'morning' ? "2" : "1"} />
                  {/* Mini Sun Rising */}
                  <circle cx="140" cy="68" r="5" fill="#f59e0b" />
                  <text x="140" y="93" fill="#f59e0b" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">🌅 MORNING</text>
                  <text x="140" y="104" fill="#f59e0b" fontSize="7" opacity="0.75" textAnchor="middle" fontFamily="monospace">05:00-11:59</text>
                </g>

                {/* 2. Noon Node (X: 300, Y: 25) */}
                <g className="cursor-pointer" onClick={() => setSimulatedPeriod('noon')}>
                  <circle cx="300" cy="25" r={activePeriod === 'noon' ? "16" : "11"} fill="#eab308" fillOpacity={activePeriod === 'noon' ? "0.4" : "0.15"} stroke="#eab308" strokeWidth={activePeriod === 'noon' ? "2" : "1"} />
                  {/* High Sun */}
                  <circle cx="300" cy="25" r="6" fill="#facc15" />
                  <text x="300" y="48" fill="#eab308" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">☀️ NOON (ZENITH)</text>
                  <text x="300" y="59" fill="#eab308" fontSize="7" opacity="0.75" textAnchor="middle" fontFamily="monospace">12:00-16:59</text>
                </g>

                {/* 3. Evening Node (X: 460, Y: 68) */}
                <g className="cursor-pointer" onClick={() => setSimulatedPeriod('evening')}>
                  <circle cx="460" cy="68" r={activePeriod === 'evening' ? "14" : "10"} fill="#f97316" fillOpacity={activePeriod === 'evening' ? "0.4" : "0.15"} stroke="#f97316" strokeWidth={activePeriod === 'evening' ? "2" : "1"} />
                  {/* Setting Sun */}
                  <circle cx="460" cy="68" r="5" fill="#f97316" />
                  <text x="460" y="93" fill="#f97316" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">🌇 EVENING</text>
                  <text x="460" y="104" fill="#f97316" fontSize="7" opacity="0.75" textAnchor="middle" fontFamily="monospace">17:00-20:59</text>
                </g>

                {/* 4. Night Node (Below / Nadir - X: 300, Y: 148) */}
                <g className="cursor-pointer" onClick={() => setSimulatedPeriod('night')}>
                  <circle cx="300" cy="125" r={activePeriod === 'night' ? "14" : "9"} fill="#818cf8" fillOpacity={activePeriod === 'night' ? "0.4" : "0.15"} stroke="#818cf8" strokeWidth={activePeriod === 'night' ? "2" : "1"} />
                  <circle cx="300" cy="125" r="4.5" fill="#a5b4fc" />
                  <text x="300" y="112" fill="#818cf8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">🌙 NIGHT (21:00-04:59)</text>
                </g>

                {/* Live Position Marker (Interpolated along parabola Q 300 20 from 50 to 550) */}
                {(() => {
                  // For daytime 06:00 to 18:00 (360m to 1080m) map t from 0 to 1
                  // For nighttime, place near the base
                  let t = (totalMinutesInDay - 360) / 720;
                  if (t < 0) t = 0;
                  if (t > 1) t = 1;
                  
                  // Quadratic bezier formula: B(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
                  const p0x = 50, p0y = 125;
                  const p1x = 300, p1y = 20;
                  const p2x = 550, p2y = 125;
                  
                  const isDay = totalMinutesInDay >= 330 && totalMinutesInDay <= 1260;
                  const liveX = isDay 
                    ? Math.round((1 - t) * (1 - t) * p0x + 2 * (1 - t) * t * p1x + t * t * p2x)
                    : 300;
                  const liveY = isDay 
                    ? Math.round((1 - t) * (1 - t) * p0y + 2 * (1 - t) * t * p1y + t * t * p2y)
                    : 125;

                  return (
                    <g className="animate-pulse">
                      <circle cx={liveX} cy={liveY} r="9" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="2 2" />
                      <circle cx={liveX} cy={liveY} r="4" fill="#ffffff" />
                      <text x={liveX} y={liveY - 12} fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                        YOU ARE HERE ({time24h})
                      </text>
                    </g>
                  );
                })()}
              </svg>
            </div>

            {/* 4 Interactive Phase Selector Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {phases.map((ph) => {
                const isSelected = activePeriod === ph.period;
                return (
                  <button
                    key={ph.period}
                    type="button"
                    onClick={() => {
                      if (config.soundEnabled) soundManager.playKeyClick('modern', 0.2);
                      setSimulatedPeriod(simulatedPeriod === ph.period ? null : ph.period);
                    }}
                    className="flex flex-col items-center justify-center p-2.5 rounded-lg border transition-all hover:scale-105 active:scale-95 text-center"
                    style={{
                      borderColor: isSelected ? ph.color : `${theme.borderColor}80`,
                      backgroundColor: isSelected ? `${ph.color}25` : `${theme.cardBg}80`,
                      color: isSelected ? ph.color : theme.fg,
                      boxShadow: isSelected ? `0 0 12px ${ph.color}35` : 'none',
                    }}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      {ph.icon}
                      <span>{ph.name}</span>
                    </div>
                    <span className="text-[10px] opacity-75 mt-0.5">{ph.timeRange}</span>
                    {isSelected && (
                      <span className="text-[9px] font-bold mt-1 px-1.5 py-0.2 rounded" style={{ backgroundColor: `${ph.color}30` }}>
                        SELECTED
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Reset to live button if simulated */}
            {simulatedPeriod && (
              <div className="flex justify-center pt-1">
                <button
                  onClick={() => setSimulatedPeriod(null)}
                  className="px-3 py-1 rounded text-xs font-bold border flex items-center gap-1.5 hover:bg-white/10 transition-colors"
                  style={{ borderColor: theme.borderColor, color: theme.fg }}
                >
                  <RotateCcw size={12} />
                  <span>Reset to Live Real-Time Clock</span>
                </button>
              </div>
            )}
          </div>

          {/* ASCII Celestial Art & Phase Description */}
          <div 
            className="p-3.5 rounded-xl border font-mono text-xs space-y-2"
            style={{ borderColor: `${activeInfo.badgeColor}40`, backgroundColor: `${theme.bg}` }}
          >
            <div className="flex items-center justify-between text-[11px] font-bold" style={{ color: activeInfo.badgeColor }}>
              <span>ASCII CELESTIAL RENDERING: [{activeInfo.label.toUpperCase()}]</span>
              <span>{activeInfo.hoursRange}</span>
            </div>
            <pre className="text-[10px] sm:text-[11px] leading-tight overflow-x-auto whitespace-pre font-mono p-2 rounded bg-black/40 border border-white/5" style={{ color: activeInfo.badgeColor }}>
              {activeInfo.asciiArt.trim()}
            </pre>
            <p className="text-[11px] opacity-80 leading-relaxed">
              {activeInfo.description}
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div 
          className="flex items-center justify-between px-4 py-3 border-t shrink-0 text-xs"
          style={{ borderColor: theme.borderColor, backgroundColor: `${theme.cardBg}95` }}
        >
          <div className="text-[11px] opacity-70">
            Tip: Type <code className="px-1 py-0.5 rounded bg-white/10 font-bold" style={{ color: theme.promptColor }}>clock</code> or <code className="px-1 py-0.5 rounded bg-white/10 font-bold" style={{ color: theme.promptColor }}>date</code> in terminal.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs font-bold transition-all hover:scale-105 active:scale-95"
            style={{
              backgroundColor: theme.accentColor,
              color: theme.bg,
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
