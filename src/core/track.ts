/**
 * Analytics hook. A deliberate NO-OP: no network, no storage, no service.
 * The loop and launcher call it for session lifecycle and sim events so a future
 * opt-in analytics build (see ROADMAP.md) has somewhere to plug in.
 * Props stay numeric/enumerated; never pass personal or device identifiers.
 */
export type TrackProps = Record<string, number | string | boolean>;

let sink: ((event: string, props?: TrackProps) => void) | null = null;

export function track(event: string, props?: TrackProps): void {
  if (sink) sink(event, props);
}

/** Test hook only: observe calls. Production code never sets this. */
export function __setTrackSink(fn: typeof sink): void {
  sink = fn;
}
