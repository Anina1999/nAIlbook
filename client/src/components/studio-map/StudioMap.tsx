import { useEffect, useEffectEvent, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import styles from './StudioMap.module.css';

/** One studio on the map. A `ManicuristSummary` or a `Manicurist` fits as it is. */
export type StudioMarker = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
};

type StudioMapProps = {
  /** Keep the array stable between renders: a new array draws the markers again and refits the view. */
  markers: StudioMarker[];
  /** The active marker: larger, plum, with the star, on top. */
  activeId?: number | null;
  /** The marker whose card has the hover or the focus. */
  highlightedId?: number | null;
  /** Without it the markers are pictures (`role="img"`), not buttons. */
  onMarkerSelect?: (id: number) => void;
  /** The accessible name of the map container. */
  label: string;
};

/** One tile URL, no `{s}` subdomains, as OpenStreetMap asks today. E2E routes it to a local image. */
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">сътрудниците на OpenStreetMap</a>';
/** Shown only when there is no marker at all: the centre of Bulgaria. */
const BULGARIA: L.LatLngTuple = [42.7, 25.3];
/** Zoom for a single studio, and the most `fitBounds` may zoom in for several. */
const SINGLE_ZOOM = 16;
const FIT_MAX_ZOOM = 15;
/** Keeps the markers off the map's edges after `fitBounds`. */
const FIT_PADDING: L.PointTuple = [40, 40];
/** The marker's target, with the dot centred in it. */
const TARGET_SIZE = 44;

/** The white four-point star of the card divider, shown on the active marker. */
const STAR_SVG =
  `<svg class="${styles.star}" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" focusable="false">` +
  '<path d="M12 1 Q13 11 23 12 Q13 13 12 23 Q11 13 1 12 Q11 11 12 1 Z" /></svg>';

function markerIcon(selectable: boolean): L.DivIcon {
  return L.divIcon({
    className: [styles.marker, selectable && styles.selectable].filter(Boolean).join(' '),
    html: `<span class="${styles.dot}">${STAR_SVG}</span>`,
    iconSize: [TARGET_SIZE, TARGET_SIZE],
    iconAnchor: [TARGET_SIZE / 2, TARGET_SIZE / 2],
  });
}

/**
 * A Leaflet map with a marker per studio (plain `leaflet`, best-code-practices §11).
 * One effect creates the map, one draws the markers and fits the view to them, one marks
 * the active and the highlighted marker, and one pans to the active marker when it is
 * outside the view. With `onMarkerSelect` every marker is a button named
 * «<име> на картата»: a click, Enter or Space chooses it and the focus stays on it.
 */
export default function StudioMap({
  markers,
  activeId = null,
  highlightedId = null,
  onMarkerSelect,
  label,
}: StudioMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [map, setMap] = useState<L.Map | null>(null);
  // The markers drawn on `map`, by id; state, so the effect that marks them runs after a redraw.
  const [drawn, setDrawn] = useState<Map<number, L.Marker> | null>(null);
  const selectable = onMarkerSelect !== undefined;
  // A new callback from the parent does not draw the markers again.
  const selectHandler = useEffectEvent((id: number) => onMarkerSelect?.(id));

  // Creates the map once (again only when reduced motion is switched) and removes it in the cleanup.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // On a touch screen one finger scrolls the page; pinch and the zoom buttons still work.
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const instance = L.map(container, {
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: !coarsePointer,
      zoomAnimation: !reducedMotion,
      fadeAnimation: !reducedMotion,
      markerZoomAnimation: !reducedMotion,
    });
    L.control.zoom({ zoomInTitle: 'Приближи', zoomOutTitle: 'Отдалечи' }).addTo(instance);
    // Only the OpenStreetMap credit, without Leaflet's own link before it.
    instance.attributionControl.setPrefix(false);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(instance);
    setMap(instance);
    return () => {
      instance.remove();
      setMap(null);
    };
  }, [reducedMotion]);

  // Fits the view to the markers and draws them. A new set of markers appears at once,
  // without an animation.
  useEffect(() => {
    if (!map) return;
    // The view comes first: Leaflet adds layers only once the map has one, and the
    // markers' elements are needed right away for their names.
    if (markers.length === 1) {
      map.setView([markers[0].latitude, markers[0].longitude], SINGLE_ZOOM, { animate: false });
    } else if (markers.length > 1) {
      const bounds = L.latLngBounds(markers.map((studio): L.LatLngTuple => [studio.latitude, studio.longitude]));
      map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM, animate: false });
    } else {
      map.setView(BULGARIA, 7, { animate: false });
    }

    const layer = L.layerGroup().addTo(map);
    const byId = new Map<number, L.Marker>();
    const icon = markerIcon(selectable);

    for (const studio of markers) {
      const marker = L.marker([studio.latitude, studio.longitude], {
        icon,
        // Leaflet makes a keyboard marker a Tab stop with role="button".
        keyboard: selectable,
        interactive: selectable,
      }).addTo(layer);
      const element = marker.getElement();
      if (element) {
        element.setAttribute('aria-label', `${studio.name} на картата`);
        if (selectable) {
          element.setAttribute('aria-pressed', 'false');
          element.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault(); // Space would scroll the page
            selectHandler(studio.id);
          });
        } else {
          element.setAttribute('role', 'img');
        }
      }
      if (selectable) marker.on('click', () => selectHandler(studio.id));
      byId.set(studio.id, marker);
    }
    setDrawn(byId);

    return () => {
      layer.remove();
      setDrawn(null);
    };
  }, [map, markers, selectable]);

  // Marks the active and the highlighted marker; the active one is on top.
  useEffect(() => {
    if (!drawn) return;
    for (const [id, marker] of drawn) {
      const active = id === activeId;
      const highlighted = id === highlightedId && !active;
      const element = marker.getElement();
      element?.classList.toggle(styles.active, active);
      element?.classList.toggle(styles.highlighted, highlighted);
      if (selectable) element?.setAttribute('aria-pressed', String(active));
      marker.setZIndexOffset(active ? 1000 : highlighted ? 500 : 0);
    }
  }, [drawn, activeId, highlightedId, selectable]);

  // When the active studio is outside the view (the user panned away, or it was chosen
  // from a card), the map moves to it.
  useEffect(() => {
    if (!map || !drawn) return;
    const active = activeId === null ? undefined : drawn.get(activeId);
    if (!active) return;
    const position = active.getLatLng();
    if (!map.getBounds().contains(position)) map.panTo(position, { animate: !reducedMotion });
  }, [map, drawn, activeId, reducedMotion]);

  // Leaflet makes the container focusable, for panning with the arrow keys; the role gives
  // it a name.
  return <div ref={containerRef} role="region" aria-label={label} className={styles.map} />;
}
