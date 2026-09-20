/** Shared pointer/touch gesture helpers for Bit Drop. */

/** Finger/mouse travel below this is still a tap (rotate), not a drag. */
export const TAP_SLOP_PX = 14;

/**
 * Ignore a synthesized click that follows a pointer/touch we already handled.
 * Reddit's webview (and iOS) often fire a delayed compat click ~300ms later.
 */
export const CLICK_SUPPRESS_MS = 650;

/** Collapse duplicate rotate from pointer + touch firing on the same gesture. */
export const ROTATE_DEBOUNCE_MS = 50;

export type PointerTrack = {
  active: boolean;
  sx: number;
  sy: number;
  rx: number;
  moved: boolean;
  t0: number;
  holdDir: number;
  holdNext: number;
  dropped: boolean;
};

export function idlePointerTrack(): PointerTrack {
  return {
    active: false,
    sx: 0,
    sy: 0,
    rx: 0,
    moved: false,
    t0: 0,
    holdDir: 0,
    holdNext: 0,
    dropped: false,
  };
}

export function beginPointerTrack(x: number, y: number, now: number): PointerTrack {
  return {
    active: true,
    sx: x,
    sy: y,
    rx: x,
    moved: false,
    t0: now,
    holdDir: 0,
    holdNext: 0,
    dropped: false,
  };
}

/**
 * Unmoved finger/mouse release → rotate.
 * Horizontal drag and a hard-drop swipe must not rotate.
 */
export function isTapRelease(
  track: Pick<PointerTrack, 'moved' | 'dropped' | 'sx' | 'sy'>,
  endX: number,
  endY: number,
  slop = TAP_SLOP_PX,
): boolean {
  if (track.moved || track.dropped) return false;
  return Math.hypot(endX - track.sx, endY - track.sy) < slop;
}

/** Ghost click after a pointer/touch gesture we already consumed. */
export function shouldIgnoreCompatClick(
  now: number,
  gestureHandledAt: number,
  windowMs = CLICK_SUPPRESS_MS,
): boolean {
  return gestureHandledAt > 0 && now - gestureHandledAt < windowMs;
}

export function shouldDebounceRotate(
  now: number,
  lastRotateAt: number,
  windowMs = ROTATE_DEBOUNCE_MS,
): boolean {
  return lastRotateAt > 0 && now - lastRotateAt < windowMs;
}

/**
 * Drag / rotate / drop may call preventDefault. Only do that during active play.
 * Menu, splash, and other overlays must leave wheel / touchmove alone so a
 * Reddit inline post does not trap feed scroll.
 */
export function shouldCapturePlayGestures(screen: string): boolean {
  return screen === 'play';
}
