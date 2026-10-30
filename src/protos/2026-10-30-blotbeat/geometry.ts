// Shared board geometry (pure): the faux-isometric diamond tabletop. Four lanes run from the diamond's corners
// into a ring at the centre. Lane 0 = north (Y), 1 = east (B), 2 = south (A), 3 = west (X).
export const CX = 640;
export const CY = 440;
export const HW = 470; // half width of the diamond
export const HH = 235; // half height (2:1, isometric feel)
export const RING_RX = 150;
export const RING_RY = 75;

export const LANE_DIR: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];
export const LANE_NAMES = ['north', 'east', 'south', 'west'] as const;
/** Face button that strikes each lane (diamond layout, like the pad). */
export const LANE_BUTTON = ['y', 'b', 'a', 'x'] as const;

/** Where lane `lane` starts at the board corner. */
export function laneStart(lane: number): { x: number; y: number } {
  const d = LANE_DIR[lane]!;
  return { x: CX + d.x * HW, y: CY + d.y * HH };
}

/** The strike point of a lane on the ring. */
export function laneRing(lane: number): { x: number; y: number } {
  const d = LANE_DIR[lane]!;
  return { x: CX + d.x * RING_RX, y: CY + d.y * RING_RY };
}

/** Position along a lane for progress p (0 = corner, 1 = ring). */
export function lanePoint(lane: number, p: number): { x: number; y: number } {
  const a = laneStart(lane);
  const b = laneRing(lane);
  return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
}
