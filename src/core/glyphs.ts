import type { ButtonName } from './types.ts';

/** Which input device the player used last. Drives the button labels shown in menus and hints. */
export type Device = 'keyboard' | 'gamepad';

/** Debug keyboard fallback. One source of truth for both the input layer and the labels. */
export const KEY_BUTTONS: Record<string, ButtonName> = {
  Space: 'a', Enter: 'a', KeyZ: 'a',
  KeyX: 'b', Backspace: 'b',
  KeyC: 'x', KeyV: 'y', KeyQ: 'lb', KeyE: 'rb',
  Escape: 'start',
  ShiftLeft: 'select', ShiftRight: 'select',
};

const PAD_LABELS: Record<ButtonName, string> = {
  a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT',
  select: 'Select', start: 'Start', ls: 'L3', rs: 'R3',
  up: 'D-pad Up', down: 'D-pad Down', left: 'D-pad Left', right: 'D-pad Right',
};

const KEY_LABELS: Partial<Record<ButtonName, string>> = {
  a: 'Space', b: 'X', x: 'C', y: 'V', lb: 'Q', rb: 'E', start: 'Esc', select: 'Shift',
  up: 'Up', down: 'Down', left: 'Left', right: 'Right',
};

const STORE_KEY = 'mgb.device.v1';

function loadDevice(): Device {
  try {
    return localStorage.getItem(STORE_KEY) === 'gamepad' ? 'gamepad' : 'keyboard';
  } catch {
    return 'keyboard';
  }
}

// Remembered across page loads so a player coming from the launcher on a gamepad keeps seeing gamepad labels.
let current: Device = loadDevice();
const listeners = new Set<(d: Device) => void>();

export function getDevice(): Device {
  return current;
}

export function setDevice(d: Device): void {
  if (d === current) return;
  current = d;
  try {
    localStorage.setItem(STORE_KEY, d);
  } catch {
    /* labels still work without storage */
  }
  listeners.forEach((fn) => fn(d));
}

/** Subscribe to device changes. Returns an unsubscribe. */
export function onDeviceChange(fn: (d: Device) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Label for a button on the active device: `glyph('a')` is "A" on a gamepad and "Space" on a keyboard. */
export function glyph(button: ButtonName, device: Device = current): string {
  if (device === 'gamepad') return PAD_LABELS[button];
  return KEY_LABELS[button] ?? `(${PAD_LABELS[button]} not mapped)`;
}

/** Label for a stick: "Left stick" on a gamepad, "WASD" on a keyboard (the right stick has no key mapping). */
export function stickGlyph(stick: 'left' | 'right' = 'left', device: Device = current): string {
  if (device === 'gamepad') return stick === 'left' ? 'Left stick' : 'Right stick';
  return stick === 'left' ? 'WASD / arrows' : '(no key)';
}
