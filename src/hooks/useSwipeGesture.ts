/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef } from 'react';

export interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  maxDurationMs?: number;
  disabled?: boolean;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 45,
  maxDurationMs = 800,
  disabled = false,
}: SwipeGestureOptions) {
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const isTracking = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || e.touches.length !== 1) return;

    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.closest('input, textarea, select, [contenteditable="true"]') ||
        target.closest('.no-swipe'))
    ) {
      isTracking.current = false;
      return;
    }

    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    startTime.current = Date.now();
    isTracking.current = true;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isTracking.current || disabled || !e.changedTouches || e.changedTouches.length === 0) {
      isTracking.current = false;
      return;
    }
    isTracking.current = false;

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - startX.current;
    const deltaY = endY - startY.current;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const elapsed = Date.now() - startTime.current;

    // Must be predominantly horizontal and meet minimum distance
    if (absX >= threshold && absX > absY * 1.3 && elapsed <= maxDurationMs) {
      if (deltaX < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    }
  };

  const handleTouchCancel = () => {
    isTracking.current = false;
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  };
}
