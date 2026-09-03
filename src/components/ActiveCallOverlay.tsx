import React, { useState, useEffect } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Grid,
  Minimize2,
  Maximize2,
  ExternalLink,
  Radio,
} from 'lucide-react';
import { ActiveCall, RecentCall, Theme } from '../types';
import { soundManager } from '../utils/audio';
import { dialNativePhoneNumber } from '../utils/nativeLauncher';

interface ActiveCallOverlayProps {
  activeCall: ActiveCall;
  theme: Theme;
  soundEnabled: boolean;
  soundVolume: number;
  onEndCall: () => void;
  onUpdateCall: (update: Partial<ActiveCall>) => void;
  onAddRecentCall: (call: RecentCall) => void;
}

export const ActiveCallOverlay: React.FC<ActiveCallOverlayProps> = ({
  activeCall,
  theme,
  soundEnabled,
  soundVolume,
  onEndCall,
  onUpdateCall,
  onAddRecentCall,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Auto transition: dialing -> ringing -> connected
  useEffect(() => {
    let t1: NodeJS.Timeout;
    let t2: NodeJS.Timeout;
    let ringInterval: NodeJS.Timeout;

    if (activeCall.status === 'dialing') {
      if (soundEnabled) {
        soundManager.playDialTone(soundVolume);
      }

      t1 = setTimeout(() => {
        onUpdateCall({ status: 'ringing' });
        if (soundEnabled) {
          soundManager.playRingback(soundVolume * 0.8);
        }
      }, 1400);
    } else if (activeCall.status === 'ringing') {
      ringInterval = setInterval(() => {
        if (soundEnabled) {
          soundManager.playRingback(soundVolume * 0.7);
        }
      }, 3000);

      t2 = setTimeout(() => {
        clearInterval(ringInterval);
        onUpdateCall({
          status: 'connected',
          connectedAt: Date.now(),
        });
        if (soundEnabled) {
          soundManager.playCallConnected(soundVolume);
        }
      }, 3500);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(ringInterval);
    };
  }, [activeCall.status]);

  // Duration timer when connected
  useEffect(() => {
    if (activeCall.status !== 'connected') return;

    const interval = setInterval(() => {
      if (activeCall.connectedAt) {
        const secs = Math.floor((Date.now() - activeCall.connectedAt) / 1000);
        setElapsedSeconds(secs);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall.status, activeCall.connectedAt]);

  const formatDuration = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleHangup = () => {
    if (soundEnabled) {
      soundManager.playCallEnded(soundVolume);
    }

    const durationStr = activeCall.status === 'connected' ? formatDuration(elapsedSeconds) : 'Cancelled';

    onAddRecentCall({
      id: `rc-${Date.now()}`,
      name: activeCall.name,
      phone: activeCall.phone,
      timestamp: Date.now(),
      type: 'outgoing',
      duration: durationStr,
    });

    onEndCall();
  };

  const handleKeypadPress = (digit: string) => {
    if (soundEnabled) {
      soundManager.playDtmfKey(digit, soundVolume);
    }
    const current = activeCall.dialedDigits || '';
    onUpdateCall({ dialedDigits: current + digit });
  };

  const handleNativeDial = () => {
    dialNativePhoneNumber(activeCall.phone);
  };

  // Compact floating pill when minimized
  if (isMinimized) {
    return (
      <div
        id="active-call-pill"
        className="fixed top-3 right-3 z-50 flex items-center gap-2.5 px-3.5 py-2 rounded-full border shadow-2xl font-mono text-xs animate-bounce-subtle backdrop-blur-md"
        style={{
          backgroundColor: `${theme.bg}ee`,
          borderColor: activeCall.status === 'connected' ? theme.successColor : theme.primaryColor,
          color: theme.fg,
        }}
      >
        <div
          className="w-2.5 h-2.5 rounded-full animate-ping"
          style={{
            backgroundColor: activeCall.status === 'connected' ? theme.successColor : theme.primaryColor,
          }}
        />
        <div className="flex flex-col">
          <span className="font-bold text-[11px] leading-tight flex items-center gap-1">
            <Phone size={10} className={activeCall.status === 'connected' ? 'text-green-500' : 'text-blue-400'} />
            {activeCall.name}
          </span>
          <span className="text-[9px] opacity-75 font-mono">
            {activeCall.status === 'connected' ? formatDuration(elapsedSeconds) : activeCall.status.toUpperCase()}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          title="Maximize In-Call Control"
          className="p-1 rounded hover:opacity-80 ml-1"
          style={{ color: theme.primaryColor }}
        >
          <Maximize2 size={13} />
        </button>

        <button
          type="button"
          onClick={handleHangup}
          title="End Call"
          className="px-2 py-1 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] flex items-center gap-1 transition-all active:scale-95 shadow"
        >
          <PhoneOff size={10} />
          <span>End</span>
        </button>
      </div>
    );
  }

  // Full in-call control card
  return (
    <div
      id="active-call-overlay"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-80 sm:w-96 rounded-xl border shadow-2xl font-mono overflow-hidden transition-all duration-200 backdrop-blur-lg"
      style={{
        backgroundColor: `${theme.bg}f6`,
        borderColor: activeCall.status === 'connected' ? `${theme.successColor}80` : `${theme.primaryColor}80`,
        color: theme.fg,
      }}
    >
      {/* Top Header */}
      <div
        className="px-3.5 py-2.5 flex items-center justify-between border-b text-xs"
        style={{
          borderColor: `${theme.borderColor}50`,
          backgroundColor: `${theme.cardBg}80`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{
              backgroundColor: activeCall.status === 'connected' ? theme.successColor : theme.primaryColor,
            }}
          />
          <span className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5" style={{ color: theme.primaryColor }}>
            <Radio size={12} className="animate-spin-slow" />
            VoLTE / Telephony Active
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleNativeDial}
            title="Open In Native Android Phone Dialer"
            className="p-1 rounded hover:opacity-80 transition-opacity"
            style={{ color: theme.primaryColor }}
          >
            <ExternalLink size={13} />
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            title="Minimize to Floating Bar"
            className="p-1 rounded hover:opacity-80 transition-opacity"
            style={{ color: theme.fg }}
          >
            <Minimize2 size={13} />
          </button>
        </div>
      </div>

      {/* Main Caller Profile */}
      <div className="p-4 flex flex-col items-center text-center gap-2">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center border-2 shadow-inner transition-all"
          style={{
            borderColor: activeCall.status === 'connected' ? theme.successColor : theme.primaryColor,
            backgroundColor: `${theme.cardBg}ee`,
            color: activeCall.status === 'connected' ? theme.successColor : theme.primaryColor,
          }}
        >
          <Phone size={28} className={activeCall.status === 'ringing' ? 'animate-bounce' : ''} />
        </div>

        <div>
          <h3 className="text-base font-bold tracking-tight">{activeCall.name}</h3>
          <p className="text-xs opacity-75 font-mono">{activeCall.phone}</p>
        </div>

        {/* Status & Timer */}
        <div className="mt-1 flex items-center gap-2">
          <span
            className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border"
            style={{
              borderColor: activeCall.status === 'connected' ? theme.successColor : theme.primaryColor,
              backgroundColor: activeCall.status === 'connected' ? `${theme.successColor}20` : `${theme.primaryColor}20`,
              color: activeCall.status === 'connected' ? theme.successColor : theme.primaryColor,
            }}
          >
            {activeCall.status === 'connected' ? 'Connected' : activeCall.status === 'ringing' ? 'Ringing...' : 'Dialing...'}
          </span>

          {activeCall.status === 'connected' && (
            <span className="text-sm font-bold tracking-wider font-mono" style={{ color: theme.successColor }}>
              {formatDuration(elapsedSeconds)}
            </span>
          )}
        </div>

        {activeCall.dialedDigits && (
          <div className="text-[11px] opacity-75 font-mono px-2 py-0.5 rounded bg-black/20 border border-white/10">
            DTMF: {activeCall.dialedDigits}
          </div>
        )}
      </div>

      {/* Optional Interactive DTMF Keypad */}
      {showKeypad && (
        <div
          className="px-4 py-3 border-t grid grid-cols-3 gap-2"
          style={{ borderColor: `${theme.borderColor}40`, backgroundColor: `${theme.cardBg}40` }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleKeypadPress(k)}
              className="py-1.5 rounded text-sm font-bold border hover:scale-105 active:scale-95 transition-all text-center font-mono"
              style={{
                borderColor: `${theme.borderColor}60`,
                backgroundColor: `${theme.bg}bb`,
                color: theme.fg,
              }}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      {/* In-Call Action Bar */}
      <div
        className="p-3 border-t flex items-center justify-around gap-2"
        style={{ borderColor: `${theme.borderColor}50`, backgroundColor: `${theme.cardBg}60` }}
      >
        {/* Mute toggle */}
        <button
          type="button"
          onClick={() => onUpdateCall({ isMuted: !activeCall.isMuted })}
          title={activeCall.isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          className="flex flex-col items-center gap-1 p-2 rounded-lg transition-transform active:scale-95"
          style={{
            color: activeCall.isMuted ? '#ef4444' : theme.fg,
            backgroundColor: activeCall.isMuted ? '#ef444420' : 'transparent',
          }}
        >
          {activeCall.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          <span className="text-[9px]">{activeCall.isMuted ? 'Muted' : 'Mute'}</span>
        </button>

        {/* Keypad toggle */}
        <button
          type="button"
          onClick={() => setShowKeypad(!showKeypad)}
          title="Toggle DTMF Dialpad"
          className="flex flex-col items-center gap-1 p-2 rounded-lg transition-transform active:scale-95"
          style={{
            color: showKeypad ? theme.primaryColor : theme.fg,
            backgroundColor: showKeypad ? `${theme.primaryColor}20` : 'transparent',
          }}
        >
          <Grid size={18} />
          <span className="text-[9px]">Keypad</span>
        </button>

        {/* Speaker toggle */}
        <button
          type="button"
          onClick={() => onUpdateCall({ isSpeaker: !activeCall.isSpeaker })}
          title={activeCall.isSpeaker ? 'Speaker Active' : 'Enable Speaker'}
          className="flex flex-col items-center gap-1 p-2 rounded-lg transition-transform active:scale-95"
          style={{
            color: activeCall.isSpeaker ? theme.primaryColor : theme.fg,
            backgroundColor: activeCall.isSpeaker ? `${theme.primaryColor}20` : 'transparent',
          }}
        >
          {activeCall.isSpeaker ? <Volume2 size={18} /> : <VolumeX size={18} />}
          <span className="text-[9px]">{activeCall.isSpeaker ? 'Speaker' : 'Earpiece'}</span>
        </button>

        {/* End Call Button */}
        <button
          type="button"
          onClick={handleHangup}
          title="End Call Now"
          className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center shadow-lg transition-all"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
};
