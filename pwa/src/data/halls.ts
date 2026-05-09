// Hall positions on the cropped Tuttofood 2026 plan (hall-plan-padiglioni.png),
// expressed as percentages so the overlay scales with the image at any size.
// Coordinates measured visually from the official plan.
export interface HallBox {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export const HALL_BOXES: HallBox[] = [
  { id: "12", left: 22.5, top: 18.5, width: 16.5, height: 19.5 },
  { id: "8",  left: 39.0, top: 18.5, width: 18.5, height: 19.5 },
  { id: "4",  left: 60.0, top: 19.0, width: 11.5, height: 14.5 },
  { id: "2",  left: 71.5, top: 19.0, width: 17.5, height: 26.0 },
  { id: "10", left: 22.5, top: 32.5, width: 26.0, height: 17.0 },
  { id: "6",  left: 48.5, top: 32.5, width: 11.5, height: 17.0 },
  { id: "7",  left: 35.0, top: 60.0, width: 13.5, height: 25.0 },
  { id: "5",  left: 48.5, top: 60.0, width: 14.0, height: 25.0 },
  { id: "3",  left: 67.5, top: 60.0, width: 9.5,  height: 25.0 },
  { id: "1",  left: 77.0, top: 60.0, width: 12.0, height: 25.0 },
];

export interface Point {
  x: number;
  y: number;
}

export function hallCentroid(box: HallBox): Point {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

export const HALL_CENTROIDS: Record<string, Point> = Object.fromEntries(
  HALL_BOXES.map((b) => [b.id, hallCentroid(b)]),
);

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
