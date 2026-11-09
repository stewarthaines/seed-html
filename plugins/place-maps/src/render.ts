/**
 * The two-level locator map (process/PLACE_MAPS.md, Visual design): the
 * country, the state or nation tinted, a dot for the place. Shapes and class
 * names only — every colour comes from the book's family.css — so the file
 * follows the reading system's theme once inlined.
 *
 * The view box is cropped to the country's projected outline (plus padding),
 * so a wide country is a wide map rather than a square with empty bands.
 */
import { geoAzimuthalEqualArea, geoCentroid, geoPath, type GeoProjection } from 'd3-geo';
import type { Geometry } from 'geojson';

export interface MapInput {
  /** The country outline (frame). */
  outline: Geometry;
  /** The state or nation to tint; null for none. */
  region: Geometry | null;
  /** [lon, lat] of the place; null for a country-and-state map (no dot). */
  point: [number, number] | null;
  /** The full resolved place, for the file's own <title>. */
  name: string;
}

/** The longer side of the view box, in user units the CSS dot size is set in. */
const SIZE = 200;
const PAD = 10;

/** Drop projected points closer than `tol` user units to the last one kept. */
function thinned(projection: GeoProjection, tol: number) {
  return {
    stream(sink: d3StreamLike) {
      let last: [number, number] | null = null;
      return projection.stream({
        point(x: number, y: number) {
          if (last && Math.hypot(x - last[0], y - last[1]) < tol) return;
          last = [x, y];
          sink.point(x, y);
        },
        lineStart() {
          last = null;
          sink.lineStart();
        },
        lineEnd() {
          sink.lineEnd();
        },
        polygonStart() {
          sink.polygonStart();
        },
        polygonEnd() {
          sink.polygonEnd();
        },
        sphere() {
          // Never drawn: the map has no globe outline.
        },
      });
    },
  };
}

interface d3StreamLike {
  point(x: number, y: number): void;
  lineStart(): void;
  lineEnd(): void;
  polygonStart(): void;
  polygonEnd(): void;
}

/** Polygons of a geometry smaller than `minArea` square user units, dropped (islands). */
function withoutSpecks(projection: GeoProjection, geometry: Geometry, minArea: number): Geometry {
  if (geometry.type !== 'MultiPolygon') return geometry;
  const area = geoPath(projection).area;
  const keep = geometry.coordinates.filter(rings => area({ type: 'Polygon', coordinates: rings }) >= minArea);
  return { type: 'MultiPolygon', coordinates: keep.length ? keep : geometry.coordinates.slice(0, 1) };
}

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const round = (n: number) => Math.round(n * 10) / 10;

const extent: [[number, number], [number, number]] = [
  [PAD, PAD],
  [SIZE - PAD, SIZE - PAD],
];

export function renderMap(input: MapInput): string {
  // Fit twice: specks too small to draw (Macquarie Island off Australia) would
  // otherwise stretch the frame, so the second fit is to what is drawn.
  const first = geoAzimuthalEqualArea().fitExtent(extent, input.outline);
  const outline = withoutSpecks(first, input.outline, 2);
  const centre = geoCentroid(outline);
  const projection = geoAzimuthalEqualArea().rotate([-centre[0], -centre[1]]).fitExtent(extent, outline);
  const draw = (geometry: Geometry, minArea: number) =>
    geoPath(thinned(projection, 0.6) as never).digits(1)(withoutSpecks(projection, geometry, minArea)) ?? '';

  const land = draw(outline, 6);
  const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(withoutSpecks(projection, outline, 6));
  const vx = Math.max(0, Math.floor(x0 - PAD));
  const vy = Math.max(0, Math.floor(y0 - PAD));
  const vw = Math.min(SIZE, Math.ceil(x1 + PAD)) - vx;
  const vh = Math.min(SIZE, Math.ceil(y1 + PAD)) - vy;

  const parts = [`<path class="pm-land" d="${land}"/>`];
  if (input.region) parts.push(`<path class="pm-region" d="${draw(input.region, 0)}"/>`);
  if (input.point) {
    const projected = projection(input.point);
    if (projected) {
      const [x, y] = projected.map(round);
      parts.push(`<circle class="pm-halo" cx="${x}" cy="${y}" r="6"/>`);
      parts.push(`<circle class="pm-dot" cx="${x}" cy="${y}" r="3.6"/>`);
    }
  }
  const title = escapeXml(`Map: ${input.name}`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="place-map" viewBox="${vx} ${vy} ${vw} ${vh}">` +
    `<title>${title}</title>${parts.join('')}</svg>\n`
  );
}
