/**
 * Placement of timed items in one day column of the week view: vertical
 * position from the clock, and side-by-side lanes when items overlap.
 */

export interface Timed {
  key: string;
  start: string; // HH:mm
  end?: string; // HH:mm
}

export interface Placed<T extends Timed> {
  item: T;
  /** Minutes from midnight. */
  top: number;
  /** Minutes long, never shorter than MIN_MINUTES so the title fits. */
  height: number;
  /** Lane index within its overlap cluster, and how many lanes it has. */
  lane: number;
  lanes: number;
}

export const MIN_MINUTES = 30;
const DEFAULT_MINUTES = 60;

export function minutesOf(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function layoutDay<T extends Timed>(items: T[]): Placed<T>[] {
  const spans = items
    .map((item) => {
      const top = minutesOf(item.start);
      const rawEnd = item.end ? minutesOf(item.end) : top + DEFAULT_MINUTES;
      // An end at or before the start (bad data, or past midnight) still
      // gets a visible block.
      const end = Math.max(rawEnd, top + MIN_MINUTES);
      return { item, top, end: Math.min(end, 24 * 60) };
    })
    .sort((a, b) => a.top - b.top || b.end - a.end);

  const placed: Placed<T>[] = [];
  let cluster: typeof placed = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];

  const closeCluster = () => {
    const lanes = laneEnds.length;
    for (const p of cluster) p.lanes = lanes;
    cluster = [];
    laneEnds = [];
  };

  for (const span of spans) {
    // A new cluster starts when nothing open overlaps this item.
    if (span.top >= clusterEnd) {
      closeCluster();
      clusterEnd = span.end;
    } else {
      clusterEnd = Math.max(clusterEnd, span.end);
    }
    // First lane that is free by the time this item starts.
    let lane = laneEnds.findIndex((end) => end <= span.top);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(span.end);
    } else {
      laneEnds[lane] = span.end;
    }
    const entry: Placed<T> = {
      item: span.item,
      top: span.top,
      height: span.end - span.top,
      lane,
      lanes: 1,
    };
    cluster.push(entry);
    placed.push(entry);
  }
  closeCluster();

  return placed;
}
