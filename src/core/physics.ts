/**
 * Optional Rapier 2D physics, loaded lazily so prototypes that skip physics pay nothing
 * (the WASM is bundled only when a prototype imports this function).
 *
 *   const RAPIER = await loadPhysics();
 *   const world = new RAPIER.World({ x: 0, y: 980 });
 *
 * Physics must be stepped from `step()` with the fixed DT to stay deterministic
 * (call `world.step()` once per sim step; set `world.timestep = DT` after creation).
 */
export type RapierModule = (typeof import('@dimforge/rapier2d-compat'))['default'];

let cached: Promise<RapierModule> | null = null;

export function loadPhysics(): Promise<RapierModule> {
  cached ??= import('@dimforge/rapier2d-compat').then(async (m) => {
    await m.default.init();
    return m.default;
  });
  return cached;
}
