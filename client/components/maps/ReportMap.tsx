'use client';

// Leaflet map implementation. Always imported via next/dynamic with ssr:false
// (see the *MapShell wrappers) because Leaflet touches `window` at import time.

import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import type { Report } from '@/lib/api';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  STATUS_COLOR,
  STATUS_LABEL,
} from '@/lib/constants';
import { shortAddress } from '@/lib/utils';

function pinIcon(color: string, size = 26): L.DivIcon {
  return L.divIcon({
    className: 'civiclens-pin-wrap',
    html: `<span class="civiclens-pin" style="width:${size}px;height:${size}px;background:${color}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function clusterIcon(count: number): L.DivIcon {
  const size = count >= 50 ? 46 : count >= 10 ? 40 : 34;
  return L.divIcon({
    className: 'civiclens-cluster-wrap',
    html: `<span class="civiclens-cluster" style="width:${size}px;height:${size}px">${count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface Cluster {
  key: string;
  lat: number;
  lng: number;
  reports: Report[];
}

/** Grid clustering whose cell size shrinks as you zoom in. */
function clusterReports(reports: Report[], zoom: number): Cluster[] {
  const cell = 1.4 / Math.pow(2, Math.max(0, zoom - 9)); // degrees per cell
  const cells = new Map<string, Report[]>();
  for (const r of reports) {
    const key = `${Math.floor(r.latitude / cell)}:${Math.floor(r.longitude / cell)}`;
    const list = cells.get(key);
    if (list) list.push(r);
    else cells.set(key, [r]);
  }
  return [...cells.entries()].map(([key, list]) => {
    const lat = list.reduce((s, r) => s + r.latitude, 0) / list.length;
    const lng = list.reduce((s, r) => s + r.longitude, 0) / list.length;
    return { key, lat, lng, reports: list };
  });
}

function FitToReports({ reports }: { reports: Report[] }) {
  const map = useMap();
  const fitted = useRef(false);
  const interacted = useRef(false);
  useMapEvents({
    movestart: () => {
      interacted.current = true;
    },
    zoomstart: () => {
      interacted.current = true;
    },
  });
  useEffect(() => {
    if (fitted.current || interacted.current || reports.length === 0) return;
    fitted.current = true;
    // invalidateSize first: the container may have been hidden or not yet laid
    // out when Leaflet measured it (wrong size => wrong fit).
    const t = setTimeout(() => {
      map.invalidateSize();
      const bounds = L.latLngBounds(reports.map((r) => [r.latitude, r.longitude] as [number, number]));
      map.fitBounds(bounds.pad(0.25), { animate: true });
    }, 60);
    return () => clearTimeout(t);
  }, [map, reports]);
  return null;
}

/** Fix tiles when the map mounts inside a hidden container (wizard steps). */
function FixHiddenMap() {
  const map = useMap();
  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 50);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);
  return null;
}

/** Click-to-place pin for the report wizard (in addition to drag). */
function PickClickHandler({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onPick?.(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

function RecenterOnPick({ position }: { position: [number, number] | null }) {
  const map = useMap();
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (!position) return;
    const key = position.join(',');
    if (prev.current !== key) {
      prev.current = key;
      map.setView(position, Math.max(map.getZoom(), 15), { animate: true });
    }
  }, [map, position]);
  return null;
}

function ClusterLayer({ reports }: { reports: Report[] }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });
  const clusters = useMemo(() => clusterReports(reports, zoom), [reports, zoom]);
  return (
    <>
      {clusters.map((c) =>
        c.reports.length === 1 ? (
          <Marker
            key={c.reports[0].id}
            position={[c.reports[0].latitude, c.reports[0].longitude]}
            icon={pinIcon(STATUS_COLOR[c.reports[0].status])}
          >
            <ReportPopup report={c.reports[0]} />
          </Marker>
        ) : (
          <Marker
            key={c.key}
            position={[c.lat, c.lng]}
            icon={clusterIcon(c.reports.length)}
            eventHandlers={{
              click: () => map.setView([c.lat, c.lng], Math.min(map.getZoom() + 2, 18), { animate: true }),
            }}
            title={`${c.reports.length} reports — click to zoom in`}
          />
        ),
      )}
    </>
  );
}

function ReportPopup({ report }: { report: Report }) {
  return (
    <Popup>
      <div className="min-w-[190px] max-w-[240px]">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: STATUS_COLOR[report.status] }}
          />
          <span style={{ color: STATUS_COLOR[report.status] }}>{STATUS_LABEL[report.status]}</span>
          {report.isSample && <span className="text-slate-400">· Sample</span>}
        </div>
        <p className="text-sm font-semibold leading-snug text-slate-900">{report.title}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{shortAddress(report.address)}</p>
        <a
          href={`/reports/${report.id}/`}
          className="mt-2 inline-block text-xs font-bold text-civic-600 hover:text-civic-700 hover:underline"
        >
          View report →
        </a>
      </div>
    </Popup>
  );
}

export interface ReportMapProps {
  reports?: Report[];
  /** Browse many reports, or pick a single location. */
  mode?: 'browse' | 'pick';
  pickPosition?: [number, number] | null;
  onPick?: (lat: number, lng: number) => void;
  center?: [number, number];
  zoom?: number;
  heightClass?: string;
  /** Auto-zoom to fit all pins on first load (browse mode). Default true. */
  fitToReports?: boolean;
  /** Show the "locate me" button is handled by parents; map just recenters. */
}

export default function ReportMap({
  reports = [],
  mode = 'browse',
  pickPosition = null,
  onPick,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  heightClass = 'h-[420px]',
  fitToReports = true,
}: ReportMapProps) {
  const pickIcon = useMemo(() => pinIcon('#1d4ed8', 34), []);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom
      className={`${heightClass} w-full rounded-2xl`}
      style={{ zIndex: 0 }}
    >
      <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} maxZoom={19} />
      {mode === 'browse' && (
        <>
          {fitToReports && <FitToReports reports={reports} />}
          <ClusterLayer reports={reports} />
        </>
      )}
      {mode === 'pick' && (
        <>
          <FixHiddenMap />
          <RecenterOnPick position={pickPosition} />
          <PickClickHandler onPick={onPick} />
          {pickPosition && (
            <Marker
              position={pickPosition}
              icon={pickIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const { lat, lng } = m.getLatLng();
                  onPick?.(lat, lng);
                },
              }}
            >
              <Popup>Drag me to the exact spot of the issue.</Popup>
            </Marker>
          )}
        </>
      )}
    </MapContainer>
  );
}
