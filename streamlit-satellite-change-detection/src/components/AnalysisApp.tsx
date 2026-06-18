/**
 * TERRA·WATCH — Interactive Analysis Interface
 * Wired to FastAPI backend (proxy /api → localhost:8000).
 * Mirrors the full 2.py Streamlit functionality inside the React design system.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────
declare const L: any; // Leaflet loaded via CDN in index.html

interface Metrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  total_area_ha: number;
  construction_area_ha: number;
  demolition_area_ha: number;
  wrong_area_ha: number;
  undetected_area_ha: number;
  tp: number;
  tn: number;
  fp: number;
  fn: number;
}

interface AnalysisResult {
  metrics: Metrics;
  construction_geojson: any;
  demolition_geojson: any;
  detected_geojson: any;
  raster_download_url: string;
  baseline_tile_url: string | null;
  target_tile_url: string | null;
  n_construction: number;
  n_demolition: number;
}

// ── Animated metric value ──────────────────────────────────────────────
function MetricCard({
  label,
  value,
  unit = "",
  color = "var(--accent)",
  delay = 0,
}: {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      style={{
        background:
          "linear-gradient(135deg,rgba(17,22,40,0.85) 0%,rgba(12,15,26,0.85) 100%)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "1rem 1.2rem",
        position: "relative",
        overflow: "hidden",
        transition: "border-color .3s,box-shadow .3s,transform .3s",
        cursor: "default",
      }}
      whileHover={{
        y: -4,
        borderColor: "var(--border-glow)",
        boxShadow: "0 8px 32px rgba(56,189,248,.12)",
      }}
    >
      <div
        style={{
          fontFamily: "'Space Mono',monospace",
          fontSize: "0.62rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-2)",
          marginBottom: "0.4rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'Space Grotesk',sans-serif",
          fontSize: "1.7rem",
          fontWeight: 700,
          color,
        }}
      >
        {value}
        {unit}
      </div>
    </motion.div>
  );
}

// ── Slider control matching 2.py sidebar style ─────────────────────────
function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.3rem",
        }}
      >
        <label
          title={hint}
          style={{
            fontFamily: "'Space Grotesk',sans-serif",
            fontSize: "0.8rem",
            color: "var(--text-2)",
            cursor: hint ? "help" : "default",
          }}
        >
          {label}
        </label>
        <span
          style={{
            fontFamily: "'Space Mono',monospace",
            fontSize: "0.72rem",
            color: "var(--accent)",
            background: "rgba(56,189,248,.08)",
            border: "1px solid rgba(56,189,248,.2)",
            borderRadius: "4px",
            padding: "2px 7px",
          }}
        >
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "var(--accent)" }}
      />
    </div>
  );
}

// ── Step header ────────────────────────────────────────────────────────
function StepHeader({
  num,
  title,
  visible,
}: {
  num: string;
  title: string;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div style={{ marginBottom: "0.8rem" }}>
      <div
        style={{
          height: "1px",
          background:
            "linear-gradient(90deg,transparent 0%,var(--accent) 40%,var(--accent-2) 60%,transparent 100%)",
          opacity: 0.4,
          margin: "1.8rem 0 1.2rem",
          animation: "scan-pulse 3s ease-in-out infinite alternate",
        }}
      />
      <div
        style={{
          fontFamily: "'Space Mono',monospace",
          fontSize: "0.66rem",
          letterSpacing: "0.26em",
          textTransform: "uppercase",
          color: "var(--accent)",
          display: "flex",
          alignItems: "center",
          gap: "0.7rem",
          marginBottom: "0.2rem",
        }}
      >
        <span
          style={{
            width: "20px",
            height: "1px",
            background: "linear-gradient(90deg,var(--accent),transparent)",
            display: "inline-block",
          }}
        />
        Step {num}
      </div>
      <div
        style={{
          fontFamily: "'Space Mono',monospace",
          fontSize: "0.72rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--accent)",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "0.4rem",
          marginBottom: "0.6rem",
        }}
      >
        {title}
      </div>
    </div>
  );
}

// ── Main Analysis App component ────────────────────────────────────────
export function AnalysisApp() {
  // ── Controls state ─────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(2021);
  const [endYear, setEndYear] = useState(2025);
  const [constructionThresh, setConstructionThresh] = useState(0.03);
  const [demolitionThresh, setDemolitionThresh] = useState(-0.04);
  const [minPatchPixels, setMinPatchPixels] = useState(2);
  const [ndviVegThresh, setNdviVegThresh] = useState(0.4);
  const [ensembleVotes, setEnsembleVotes] = useState(1);

  // ── AOI / analysis state ───────────────────────────────────────────
  const [aoiGeojson, setAoiGeojson] = useState<any>(null);
  const [swipeTiles, setSwipeTiles] = useState<{
    baseline: string | null;
    target: string | null;
  }>({ baseline: null, target: null });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [running, setRunning] = useState(false);
  const [loadingTiles, setLoadingTiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  // ── Map refs ───────────────────────────────────────────────────────
  const drawMapRef = useRef<any>(null);
  const drawMapContainer = useRef<HTMLDivElement>(null);
  const swipeMapRef = useRef<any>(null);
  const swipeMapContainer = useRef<HTMLDivElement>(null);
  const overlayMapRef = useRef<any>(null);
  const overlayMapContainer = useRef<HTMLDivElement>(null);

  // Swipe divider state
  const [swipePos, setSwipePos] = useState(50);
  const swipeDragging = useRef(false);
  const swipeContainerRef = useRef<HTMLDivElement>(null);

  // ── Check backend health on mount ─────────────────────────────────
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setBackendOnline(d.status === "online"))
      .catch(() => setBackendOnline(false));
  }, []);

  // ── Draw map (Step 1) ──────────────────────────────────────────────
  useEffect(() => {
    if (!drawMapContainer.current || drawMapRef.current) return;

    const map = L.map(drawMapContainer.current, {
      center: [23.1923, 72.6742],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer(
      "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      { attribution: "Google", maxZoom: 20 }
    ).addTo(map);

    // leaflet-draw rectangle tool
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      edit: { featureGroup: drawnItems },
      draw: {
        polyline: false,
        polygon: false,
        circle: false,
        marker: false,
        circlemarker: false,
        rectangle: {
          shapeOptions: {
            color: "#38bdf8",
            weight: 2,
            fillOpacity: 0.08,
            dashArray: "6 4",
          },
        },
      },
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e: any) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      const geojson = e.layer.toGeoJSON().geometry;
      setAoiGeojson(geojson);
    });

    drawMapRef.current = map;

    return () => {
      if (drawMapRef.current) {
        drawMapRef.current.remove();
        drawMapRef.current = null;
      }
    };
  }, []);

  // ── Fetch tile URLs when AOI or years change ───────────────────────
  useEffect(() => {
    if (!aoiGeojson) return;

    setSwipeTiles({ baseline: null, target: null });
    setLoadingTiles(true);
    setError(null);

    fetch("/api/tiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aoi_geojson: aoiGeojson,
        start_year: startYear,
        end_year: endYear,
      }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(d.detail));
        return r.json();
      })
      .then((d) => {
        setSwipeTiles({ baseline: d.baseline_url, target: d.target_url });
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoadingTiles(false));
  }, [aoiGeojson, startYear, endYear]);

  // ── Swipe map (Step 2) ─────────────────────────────────────────────
  useEffect(() => {
    if (!swipeMapContainer.current) return;
    if (!swipeTiles.baseline && !swipeTiles.target) {
      if (swipeMapRef.current) {
        swipeMapRef.current.remove();
        swipeMapRef.current = null;
      }
      return;
    }

    // Derive centre from AOI
    let center: [number, number] = [23.1923, 72.6742];
    if (aoiGeojson?.coordinates) {
      const coords = aoiGeojson.coordinates[0] as number[][];
      const lats = coords.map((c) => c[1]);
      const lons = coords.map((c) => c[0]);
      center = [
        (Math.min(...lats) + Math.max(...lats)) / 2,
        (Math.min(...lons) + Math.max(...lons)) / 2,
      ];
    }

    if (swipeMapRef.current) {
      swipeMapRef.current.remove();
      swipeMapRef.current = null;
    }

    const map = L.map(swipeMapContainer.current, {
      center,
      zoom: 16,
      zoomControl: true,
    });

    L.tileLayer(
      "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      { attribution: "Google", maxZoom: 20 }
    ).addTo(map);

    if (aoiGeojson) {
      L.geoJSON(
        { type: "Feature", geometry: aoiGeojson },
        {
          style: {
            color: "#38bdf8",
            weight: 2.5,
            fillOpacity: 0,
            dashArray: "6 4",
          },
        }
      ).addTo(map);
    }

    swipeMapRef.current = map;

    return () => {
      if (swipeMapRef.current) {
        swipeMapRef.current.remove();
        swipeMapRef.current = null;
      }
    };
  }, [swipeTiles, aoiGeojson]);

  // ── Overlay map (Step 3 — after analysis) ─────────────────────────
  useEffect(() => {
    if (!overlayMapContainer.current || !result) return;

    let center: [number, number] = [23.1923, 72.6742];
    if (aoiGeojson?.coordinates) {
      const coords = aoiGeojson.coordinates[0] as number[][];
      const lats = coords.map((c) => c[1]);
      const lons = coords.map((c) => c[0]);
      center = [
        (Math.min(...lats) + Math.max(...lats)) / 2,
        (Math.min(...lons) + Math.max(...lons)) / 2,
      ];
    }

    if (overlayMapRef.current) {
      overlayMapRef.current.remove();
      overlayMapRef.current = null;
    }

    const map = L.map(overlayMapContainer.current, {
      center,
      zoom: 16,
      zoomControl: true,
    });

    const googleSat = L.tileLayer(
      "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      { attribution: "Google", maxZoom: 20 }
    ).addTo(map);

    const layerControl: Record<string, any> = { "🌍 Google Satellite": googleSat };

    if (result.baseline_tile_url) {
      const bl = L.tileLayer(result.baseline_tile_url, {
        attribution: "GEE / Sentinel-2",
        maxZoom: 20,
        opacity: 0.9,
      });
      bl.addTo(map);
      layerControl[`📅 Baseline — ${startYear}`] = bl;
    }

    if (result.target_tile_url) {
      const tg = L.tileLayer(result.target_tile_url, {
        attribution: "GEE / Sentinel-2",
        maxZoom: 20,
        opacity: 0.9,
      });
      layerControl[`🎯 Target — ${endYear}`] = tg;
    }

    // Change polygons
    if (result.detected_geojson?.features?.length) {
      const changeLayer = L.geoJSON(result.detected_geojson, {
        style: (feature: any) => {
          const t = feature?.properties?.change_type;
          if (t === "construction")
            return {
              fillColor: "#ef4444",
              color: "#b91c1c",
              weight: 1.8,
              fillOpacity: 0.58,
            };
          return {
            fillColor: "#3b82f6",
            color: "#1d4ed8",
            weight: 1.8,
            fillOpacity: 0.58,
          };
        },
        onEachFeature: (feature: any, layer: any) => {
          const t = feature?.properties?.change_type || "change";
          layer.bindTooltip(
            `<span style="font-family:monospace;font-size:12px">${t}</span>`,
            { className: "terra-tooltip" }
          );
        },
      }).addTo(map);
      layerControl["🔴🔵 Change Detection"] = changeLayer;
    }

    if (aoiGeojson) {
      const aoiLayer = L.geoJSON(
        { type: "Feature", geometry: aoiGeojson },
        {
          style: {
            color: "#38bdf8",
            weight: 2,
            fillOpacity: 0,
            dashArray: "6 4",
          },
        }
      ).addTo(map);
      layerControl["📐 AOI Boundary"] = aoiLayer;
    }

    L.control.layers({}, layerControl, { collapsed: false, position: "topright" }).addTo(map);

    overlayMapRef.current = map;

    return () => {
      if (overlayMapRef.current) {
        overlayMapRef.current.remove();
        overlayMapRef.current = null;
      }
    };
  }, [result]);

  // ── Swipe divider mouse/touch events ──────────────────────────────
  const handleSwipeMove = useCallback((clientX: number) => {
    if (!swipeDragging.current || !swipeContainerRef.current) return;
    const rect = swipeContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    setSwipePos((x / rect.width) * 100);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!swipeDragging.current) return;
      const x = "touches" in e ? e.touches[0].clientX : e.clientX;
      handleSwipeMove(x);
    };
    const onUp = () => { swipeDragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [handleSwipeMove]);

  // ── Run analysis ──────────────────────────────────────────────────
  const runAnalysis = async () => {
    if (!aoiGeojson) return;
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aoi_geojson: aoiGeojson,
          start_year: startYear,
          end_year: endYear,
          construction_thresh: constructionThresh,
          demolition_thresh: demolitionThresh,
          min_patch_pixels: minPatchPixels,
          ndvi_veg_thresh: ndviVegThresh,
          ensemble_votes: ensembleVotes,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.detail || "Analysis failed");
      }
      const data = await r.json();
      setResult(data);
    } catch (err: any) {
      setError(String(err.message || err));
    } finally {
      setRunning(false);
    }
  };

  // ── GeoJSON download ──────────────────────────────────────────────
  const downloadGeoJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result.detected_geojson, null, 2)], {
      type: "application/geo+json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `change_${startYear}_to_${endYear}.geojson`;
    a.click();
  };

  // ── GeoTIFF download ──────────────────────────────────────────────
  const downloadGeoTiff = async () => {
    if (!result?.raster_download_url) return;
    const url = `/api/download-geotiff?url=${encodeURIComponent(result.raster_download_url)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `change_raster_${startYear}_to_${endYear}.tif`;
    a.click();
  };

  // ── Clear all ─────────────────────────────────────────────────────
  const clearAll = () => {
    setAoiGeojson(null);
    setSwipeTiles({ baseline: null, target: null });
    setResult(null);
    setError(null);

    // Re-init draw map so old AOI rectangle is removed
    if (drawMapRef.current) {
      drawMapRef.current.eachLayer((layer: any) => {
        if (!(layer instanceof L.TileLayer)) drawMapRef.current.removeLayer(layer);
      });
    }
  };

  const deltaYears = endYear - startYear;
  const yearError = startYear >= endYear;

  // ── Sidebar section header ─────────────────────────────────────────
  const SidebarHeader = ({ icon, label }: { icon: string; label: string }) => (
    <div
      style={{
        fontFamily: "'Space Mono',monospace",
        fontSize: "0.62rem",
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: "var(--accent)",
        borderBottom: "1px solid var(--border)",
        paddingBottom: "0.45rem",
        margin: "1.2rem 0 0.7rem",
      }}
    >
      {icon} {label}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <section
      id="app"
      style={{
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        padding: "3rem 0",
        position: "relative",
      }}
    >
      {/* Section header */}
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 2rem 2rem" }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          style={{ textAlign: "center", marginBottom: "2rem" }}
        >
          <div
            style={{
              fontFamily: "'Space Mono',monospace",
              fontSize: "0.66rem",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.8rem",
              marginBottom: "0.6rem",
            }}
          >
            <span
              style={{
                width: "24px",
                height: "1px",
                background: "linear-gradient(90deg,var(--accent),transparent)",
              }}
            />
            Live Analysis Interface
            <span
              style={{
                width: "24px",
                height: "1px",
                background: "linear-gradient(270deg,var(--accent),transparent)",
              }}
            />
          </div>
          <h2
            style={{
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: "clamp(1.8rem,3vw,2.6rem)",
              fontWeight: 700,
              margin: "0 0 0.6rem",
            }}
          >
            Run{" "}
            <span
              style={{
                background:
                  "linear-gradient(135deg,#e2e8f0 30%,#38bdf8 70%,#818cf8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 14px rgba(56,189,248,0.3))",
              }}
            >
              Change Detection
            </span>
          </h2>
          <p
            style={{
              color: "var(--text-2)",
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: "0.95rem",
              maxWidth: "580px",
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            Draw an area of interest, select your time window, adjust sensitivity
            and click{" "}
            <strong style={{ color: "var(--accent)" }}>Run Change Detection</strong>{" "}
            to get real satellite results.
          </p>

          {/* Backend status badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              marginTop: "1rem",
              fontFamily: "'Space Mono',monospace",
              fontSize: "0.66rem",
              letterSpacing: "0.1em",
              color:
                backendOnline === null
                  ? "var(--text-3)"
                  : backendOnline
                  ? "var(--success)"
                  : "var(--danger)",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background:
                  backendOnline === null
                    ? "var(--text-3)"
                    : backendOnline
                    ? "var(--success)"
                    : "var(--danger)",
                boxShadow: backendOnline
                  ? "0 0 8px var(--success)"
                  : undefined,
              }}
            />
            {backendOnline === null
              ? "Checking backend…"
              : backendOnline
              ? "Earth Engine Connected"
              : "Backend offline — start: uvicorn main:app --reload --port 8000"}
          </div>
        </motion.div>
      </div>

      {/* Layout: sidebar + main */}
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "0 2rem",
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: "1.6rem",
          alignItems: "start",
        }}
      >
        {/* ── SIDEBAR ─────────────────────────────────────────────── */}
        <aside
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "1.2rem 1rem",
            position: "sticky",
            top: "80px",
          }}
        >
          {/* Logo */}
          <div
            style={{
              textAlign: "center",
              paddingBottom: "0.8rem",
              borderBottom: "1px solid var(--border)",
              marginBottom: "0.4rem",
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
              <img 
                src="/bisag-logo.png" 
                alt="BISAG Logo" 
                style={{ height: '38px', objectFit: 'contain', background: 'white', borderRadius: '4px', padding: '3px' }} 
              />
              <div
                style={{
                  fontFamily: "'Space Mono',monospace",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  background:
                    "linear-gradient(90deg,var(--accent),var(--accent-2))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                GeoChronos
              </div>
            </div>
            <div
              style={{
                fontSize: "0.62rem",
                letterSpacing: "0.2em",
                color: "var(--text-3)",
                textTransform: "uppercase",
                marginTop: "0.15rem",
              }}
            >
              Change Detection Engine
            </div>
          </div>

          {/* Temporal Window */}
          <SidebarHeader icon="🗓️" label="Temporal Window" />
          <SliderControl
            label="Baseline Year"
            value={startYear}
            min={2015}
            max={currentYear - 1}
            step={1}
            onChange={setStartYear}
          />
          <SliderControl
            label="Target Year"
            value={endYear}
            min={2016}
            max={currentYear}
            step={1}
            onChange={setEndYear}
          />
          {yearError ? (
            <div
              style={{
                background: "rgba(248,113,113,.07)",
                borderLeft: "3px solid var(--danger)",
                color: "var(--danger)",
                borderRadius: "8px",
                padding: "0.5rem 0.8rem",
                fontSize: "0.8rem",
                marginBottom: "0.5rem",
              }}
            >
              Baseline must precede target year.
            </div>
          ) : (
            <div
              style={{
                fontFamily: "'Space Mono',monospace",
                fontSize: "0.68rem",
                color: "var(--accent)",
                opacity: 0.8,
                padding: "0.2rem 0 0.5rem",
                letterSpacing: "0.06em",
              }}
            >
              △ {deltaYears} year{deltaYears !== 1 ? "s" : ""} &nbsp;·&nbsp;{" "}
              {startYear} → {endYear}
            </div>
          )}

          {/* Sensitivity */}
          <SidebarHeader icon="🎛️" label="Sensitivity" />
          <SliderControl
            label="Construction Threshold"
            value={constructionThresh}
            min={0.01}
            max={0.2}
            step={0.01}
            onChange={setConstructionThresh}
            hint="NDBI change threshold. Lower = more detections."
          />
          <SliderControl
            label="Demolition Threshold"
            value={demolitionThresh}
            min={-0.2}
            max={-0.01}
            step={0.01}
            onChange={setDemolitionThresh}
            hint="NDBI drop to flag removed structures."
          />

          {/* Advanced Filters */}
          <SidebarHeader icon="🔬" label="Advanced Filters" />
          <SliderControl
            label="Min Patch Size (px)"
            value={minPatchPixels}
            min={1}
            max={10}
            step={1}
            onChange={setMinPatchPixels}
            hint="Minimum connected pixels. Keep 2–3 for small AOIs."
          />
          <SliderControl
            label="Vegetation Mask NDVI"
            value={ndviVegThresh}
            min={0.2}
            max={0.6}
            step={0.05}
            onChange={setNdviVegThresh}
            hint="Exclude pixels greener than this from construction."
          />
          <SliderControl
            label="Ensemble Votes (of 4)"
            value={ensembleVotes}
            min={1}
            max={4}
            step={1}
            onChange={setEnsembleVotes}
            hint="Indices that must agree. Use 1 for small AOIs."
          />

          <div style={{ borderTop: "1px solid var(--border)", marginTop: "1rem", paddingTop: "1rem" }} />

          {/* AOI status */}
          {aoiGeojson ? (
            <div
              style={{
                background: "rgba(52,211,153,.07)",
                borderLeft: "3px solid var(--success)",
                color: "var(--success)",
                borderRadius: "8px",
                padding: "0.5rem 0.8rem",
                fontSize: "0.8rem",
                fontFamily: "'Space Grotesk',sans-serif",
                marginBottom: "0.8rem",
              }}
            >
              ✅ AOI captured — ready to process
            </div>
          ) : null}

          {/* Run button */}
          <button
            disabled={!aoiGeojson || running || yearError || !backendOnline}
            onClick={runAnalysis}
            style={{
              width: "100%",
              background:
                aoiGeojson && !running && !yearError && backendOnline
                  ? "linear-gradient(135deg,#0f2d4d 0%,#0c1f36 100%)"
                  : "rgba(17,22,40,0.4)",
              border: `1px solid ${aoiGeojson && !running ? "var(--border-glow)" : "var(--border)"}`,
              color: aoiGeojson && !running ? "var(--accent)" : "var(--text-3)",
              fontFamily: "'Space Mono',monospace",
              fontSize: "0.75rem",
              letterSpacing: "0.06em",
              borderRadius: "10px",
              padding: "0.7rem 1rem",
              cursor:
                aoiGeojson && !running && !yearError && backendOnline
                  ? "pointer"
                  : "not-allowed",
              transition: "all 0.25s ease",
              marginBottom: "0.6rem",
            }}
          >
            {running ? "⏳ Computing…" : "🚀 Run Change Detection"}
          </button>

          {/* Clear button */}
          {(aoiGeojson || result) && (
            <button
              onClick={clearAll}
              style={{
                width: "100%",
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text-2)",
                fontFamily: "'Space Mono',monospace",
                fontSize: "0.72rem",
                borderRadius: "10px",
                padding: "0.55rem 1rem",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              🧹 Clear All Layers
            </button>
          )}

          {/* Tuning guide */}
          <details
            style={{
              marginTop: "1rem",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <summary
              style={{
                fontFamily: "'Space Mono',monospace",
                fontSize: "0.72rem",
                letterSpacing: "0.06em",
                color: "var(--text-2)",
                padding: "0.7rem 1rem",
                cursor: "pointer",
              }}
            >
              💡 Tuning Guide
            </summary>
            <div
              style={{
                padding: "0.8rem 1rem",
                fontSize: "0.78rem",
                color: "var(--text-2)",
                lineHeight: 1.65,
                fontFamily: "'Space Grotesk',sans-serif",
              }}
            >
              <strong style={{ color: "var(--accent)", display: "block", marginBottom: "0.3rem" }}>
                Nothing detected?
              </strong>
              Set Ensemble Votes to 1 · Lower threshold to 0.02 · Min Patch 1
              <strong
                style={{
                  color: "var(--accent)",
                  display: "block",
                  margin: "0.6rem 0 0.3rem",
                }}
              >
                Too many false alarms?
              </strong>
              Raise Ensemble Votes to 2–3 · Raise Min Patch to 4–6
              <strong
                style={{
                  color: "var(--accent)",
                  display: "block",
                  margin: "0.6rem 0 0.3rem",
                }}
              >
                Missing real changes?
              </strong>
              Lower Ensemble Votes to 1 · Lower threshold · Min Patch 1
            </div>
          </details>

          {/* EE status */}
          <div
            style={{
              marginTop: "1rem",
              fontSize: "0.72rem",
              color: "var(--text-3)",
              fontFamily: "'Space Mono',monospace",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: backendOnline ? "var(--success)" : "var(--danger)",
                boxShadow: backendOnline ? "0 0 8px var(--success)" : undefined,
              }}
            />
            Earth Engine {backendOnline ? "Connected" : "Offline"}
          </div>
        </aside>

        {/* ── MAIN CONTENT ────────────────────────────────────────── */}
        <div style={{ minWidth: 0 }}>
          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  background: "rgba(248,113,113,.07)",
                  borderLeft: "3px solid var(--danger)",
                  color: "var(--danger)",
                  borderRadius: "8px",
                  padding: "0.8rem 1.2rem",
                  fontSize: "0.85rem",
                  fontFamily: "'Space Grotesk',sans-serif",
                  marginBottom: "1rem",
                }}
              >
                ⚠️ {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Instruction box (no AOI yet) */}
          {!aoiGeojson && (
            <div
              style={{
                background:
                  "linear-gradient(135deg,rgba(56,189,248,.05) 0%,rgba(129,140,248,.04) 100%)",
                border: "1px solid rgba(56,189,248,.18)",
                borderLeft: "3px solid var(--accent)",
                borderRadius: "10px",
                padding: "1rem 1.2rem",
                fontSize: "0.88rem",
                color: "var(--text-2)",
                marginBottom: "1rem",
                lineHeight: 1.65,
                fontFamily: "'Space Grotesk',sans-serif",
              }}
            >
              Use the{" "}
              <strong style={{ color: "var(--accent)" }}>rectangle tool</strong>{" "}
              (top-left toolbar) to draw a box over your area of interest. The
              swipe comparison will load automatically, then click{" "}
              <strong style={{ color: "var(--accent)" }}>
                Run Change Detection
              </strong>{" "}
              in the sidebar. Start with a small area (&lt; 5 km²) for fastest
              results.
            </div>
          )}

          {/* ── Step 1: Draw AOI map ─────────────────────────────── */}
          <StepHeader num="1" title="📐 Draw Your Area of Interest" visible={true} />
          <div
            style={{
              borderRadius: "10px",
              overflow: "hidden",
              border: "1px solid var(--border)",
              boxShadow: "0 4px 24px rgba(0,0,0,.6)",
              marginBottom: "0.5rem",
            }}
          >
            <div ref={drawMapContainer} style={{ width: "100%", height: "420px" }} />
          </div>

          {aoiGeojson && (
            <div
              style={{
                background: "rgba(52,211,153,.07)",
                borderLeft: "3px solid var(--success)",
                color: "var(--success)",
                borderRadius: "8px",
                padding: "0.5rem 1rem",
                fontSize: "0.82rem",
                fontFamily: "'Space Grotesk',sans-serif",
                marginTop: "0.4rem",
              }}
            >
              ✅ AOI drawn — fetching{" "}
              {loadingTiles ? "tiles…" : "tiles complete"}
            </div>
          )}

          {/* ── Step 2: Swipe Compare ───────────────────────────── */}
          {aoiGeojson && (
            <>
              <StepHeader num="2" title="🔭 Swipe &amp; Compare Years" visible={true} />

              {/* Year labels */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1.4rem",
                  marginBottom: "0.9rem",
                  fontFamily: "'Space Mono',monospace",
                  fontSize: "0.72rem",
                }}
              >
                <span
                  style={{
                    color: "#38bdf8",
                    padding: "3px 10px",
                    border: "1px solid rgba(56,189,248,.3)",
                    borderRadius: "5px",
                    background: "rgba(56,189,248,.06)",
                  }}
                >
                  ← {startYear} BASELINE
                </span>
                <span style={{ color: "var(--text-3)" }}>
                  drag the divider to compare
                </span>
                <span
                  style={{
                    color: "#818cf8",
                    padding: "3px 10px",
                    border: "1px solid rgba(129,140,248,.3)",
                    borderRadius: "5px",
                    background: "rgba(129,140,248,.06)",
                  }}
                >
                  {endYear} TARGET →
                </span>
              </div>

              {loadingTiles ? (
                <div
                  style={{
                    height: "420px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    color: "var(--text-2)",
                    fontFamily: "'Space Mono',monospace",
                    fontSize: "0.8rem",
                    letterSpacing: "0.1em",
                    gap: "0.8rem",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 20,
                      height: 20,
                      border: "2px solid var(--accent)",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  Loading imagery…
                </div>
              ) : swipeTiles.baseline || swipeTiles.target ? (
                /* Swipe widget */
                <div style={{ position: "relative" }}>
                  {/* The Leaflet base map (Google Sat) */}
                  <div
                    style={{
                      borderRadius: "10px",
                      overflow: "hidden",
                      border: "1px solid var(--border)",
                      boxShadow: "0 0 40px rgba(56,189,248,.08),0 20px 60px rgba(0,0,0,.5)",
                      position: "relative",
                      height: "480px",
                    }}
                  >
                    <div ref={swipeMapContainer} style={{ width: "100%", height: "100%" }} />

                    {/* Left EE tile overlay — clipped by swipePos */}
                    {swipeTiles.baseline && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          pointerEvents: "none",
                          clipPath: `inset(0 ${100 - swipePos}% 0 0)`,
                          zIndex: 500,
                        }}
                      >
                        <iframe
                          title="baseline-layer"
                          src={`data:text/html,<style>body{margin:0}iframe{border:0}</style><div id='map' style='width:100%;height:100vh'></div><script src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'></script><link href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' rel='stylesheet'/><script>var m=L.map('map',{center:[${
                            aoiGeojson?.coordinates?.[0]
                              ? (Math.min(...aoiGeojson.coordinates[0].map((c: number[]) => c[1])) + Math.max(...aoiGeojson.coordinates[0].map((c: number[]) => c[1]))) / 2
                              : 23.1923
                          },${
                            aoiGeojson?.coordinates?.[0]
                              ? (Math.min(...aoiGeojson.coordinates[0].map((c: number[]) => c[0])) + Math.max(...aoiGeojson.coordinates[0].map((c: number[]) => c[0]))) / 2
                              : 72.6742
                          }],zoom:16,zoomControl:false,attributionControl:false});L.tileLayer('${swipeTiles.baseline}',{maxZoom:20}).addTo(m);</script>`}
                          style={{
                            width: "100%",
                            height: "100%",
                            border: "none",
                            pointerEvents: "none",
                          }}
                        />
                      </div>
                    )}

                    {/* Right EE tile overlay — clipped by swipePos */}
                    {swipeTiles.target && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          pointerEvents: "none",
                          clipPath: `inset(0 0 0 ${swipePos}%)`,
                          zIndex: 500,
                        }}
                      >
                        <iframe
                          title="target-layer"
                          src={`data:text/html,<style>body{margin:0}</style><div id='map' style='width:100%;height:100vh'></div><script src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'></script><link href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' rel='stylesheet'/><script>var m=L.map('map',{center:[${
                            aoiGeojson?.coordinates?.[0]
                              ? (Math.min(...aoiGeojson.coordinates[0].map((c: number[]) => c[1])) + Math.max(...aoiGeojson.coordinates[0].map((c: number[]) => c[1]))) / 2
                              : 23.1923
                          },${
                            aoiGeojson?.coordinates?.[0]
                              ? (Math.min(...aoiGeojson.coordinates[0].map((c: number[]) => c[0])) + Math.max(...aoiGeojson.coordinates[0].map((c: number[]) => c[0]))) / 2
                              : 72.6742
                          }],zoom:16,zoomControl:false,attributionControl:false});L.tileLayer('${swipeTiles.target}',{maxZoom:20}).addTo(m);</script>`}
                          style={{
                            width: "100%",
                            height: "100%",
                            border: "none",
                            pointerEvents: "none",
                          }}
                        />
                      </div>
                    )}

                    {/* Labels */}
                    <div
                      style={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        zIndex: 1000,
                        background: "rgba(6,8,16,0.82)",
                        border: "1px solid rgba(56,189,248,0.35)",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        fontFamily: "'Space Mono',monospace",
                        fontSize: "0.68rem",
                        letterSpacing: "0.1em",
                        color: "#38bdf8",
                        pointerEvents: "none",
                      }}
                    >
                      ← {startYear} BASELINE
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        zIndex: 1000,
                        background: "rgba(6,8,16,0.82)",
                        border: "1px solid rgba(129,140,248,0.35)",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        fontFamily: "'Space Mono',monospace",
                        fontSize: "0.68rem",
                        letterSpacing: "0.1em",
                        color: "#818cf8",
                        pointerEvents: "none",
                      }}
                    >
                      {endYear} TARGET →
                    </div>

                    {/* Draggable divider */}
                    <div
                      ref={swipeContainerRef}
                      onMouseDown={(e) => {
                        swipeDragging.current = true;
                        handleSwipeMove(e.clientX);
                      }}
                      onTouchStart={(e) => {
                        swipeDragging.current = true;
                        handleSwipeMove(e.touches[0].clientX);
                      }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 999,
                        cursor: "ew-resize",
                      }}
                    >
                      {/* Divider line */}
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          left: `${swipePos}%`,
                          width: 3,
                          transform: "translateX(-50%)",
                          background:
                            "linear-gradient(180deg,transparent 0%,rgba(56,189,248,0.7) 20%,rgba(56,189,248,1) 50%,rgba(56,189,248,0.7) 80%,transparent 100%)",
                          boxShadow:
                            "0 0 14px rgba(56,189,248,0.6),0 0 28px rgba(56,189,248,0.3)",
                          pointerEvents: "none",
                        }}
                      />
                      {/* Handle */}
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: `${swipePos}%`,
                          transform: "translate(-50%,-50%)",
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          background:
                            "radial-gradient(circle,#0c0f1a 0%,#16203a 100%)",
                          border: "2px solid var(--accent)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--accent)",
                          fontSize: "1.1rem",
                          boxShadow:
                            "0 0 20px rgba(56,189,248,0.6),0 0 40px rgba(56,189,248,0.2)",
                          pointerEvents: "none",
                          animation: "float-y 3s ease-in-out infinite",
                        }}
                      >
                        ↔
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background:
                      "rgba(248,113,113,.07)",
                    borderLeft: "3px solid var(--danger)",
                    color: "var(--danger)",
                    borderRadius: "8px",
                    padding: "0.8rem 1.2rem",
                    fontSize: "0.85rem",
                    fontFamily: "'Space Grotesk',sans-serif",
                  }}
                >
                  ⚠️ No cloud-free Sentinel-2 imagery found for this AOI and
                  year range. Try a different year or larger AOI.
                </div>
              )}
            </>
          )}

          {/* ── Analysis progress (Full screen translucent overlay) ── */}
          <AnimatePresence>
            {running && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(4, 7, 16, 0.8)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  zIndex: 99999,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "1.6rem",
                  fontFamily: "'Space Mono',monospace",
                  color: "var(--accent)",
                }}
              >
                {/* Glowing Spinner with pulsing outer ring */}
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div
                    style={{
                      position: "absolute",
                      width: 90,
                      height: 90,
                      borderRadius: "50%",
                      border: "1.5px solid rgba(56, 189, 248, 0.3)",
                      animation: "pulse-ring 2.4s cubic-bezier(0.215, 0.61, 0.355, 1) infinite",
                    }}
                  />
                  <span
                    style={{
                      display: "inline-block",
                      width: 54,
                      height: 54,
                      border: "4px solid var(--accent)",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                      boxShadow: "0 0 20px rgba(56, 189, 248, 0.35)",
                    }}
                  />
                </div>
                <div style={{ textAlign: "center", maxWidth: "460px", padding: "0 1.5rem" }}>
                  <div style={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "0.15em", marginBottom: "0.5rem", color: "var(--text-1)" }}>
                    RUNNING CHANGE DETECTION
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-2)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
                    Computing multi-index ensemble on Google Earth Engine...
                    <br />
                    This may take 30–60 seconds.
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Step 3 & 4: Results ─────────────────────────────── */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                {/* Overlay map */}
                <StepHeader
                  num="3"
                  title="🛰️ Imagery &amp; Change Overlay"
                  visible={true}
                />
                <div
                  style={{
                    color: "var(--text-2)",
                    fontSize: "0.85rem",
                    fontFamily: "'Space Grotesk',sans-serif",
                    marginBottom: "0.8rem",
                  }}
                >
                  Use the layer checkboxes (top-right) to toggle Baseline,
                  Target, and Change Detection results independently.
                </div>
                <div
                  style={{
                    borderRadius: "10px",
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    boxShadow: "0 4px 24px rgba(0,0,0,.6)",
                    marginBottom: "1.5rem",
                  }}
                >
                  <div
                    ref={overlayMapContainer}
                    style={{ width: "100%", height: "480px" }}
                  />
                </div>

                {/* Detection Performance */}
                <StepHeader num="4" title="📊 Detection Performance" visible={true} />

                {/* Primary metrics */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill,minmax(160px,1fr))",
                    gap: "0.9rem",
                    marginBottom: "1rem",
                  }}
                >
                  <MetricCard
                    label="Overall Accuracy"
                    value={`${result.metrics.accuracy}%`}
                    color="var(--accent)"
                    delay={0}
                  />
                  <MetricCard
                    label="Precision"
                    value={`${result.metrics.precision}%`}
                    color="var(--success)"
                    delay={0.08}
                  />
                  <MetricCard
                    label="Recall"
                    value={`${result.metrics.recall}%`}
                    color="var(--accent-2)"
                    delay={0.16}
                  />
                  <MetricCard
                    label="F1 Score"
                    value={`${result.metrics.f1}%`}
                    color="var(--accent-hot)"
                    delay={0.24}
                  />
                </div>

                {/* Area metrics */}
                <div
                  style={{
                    fontFamily: "'Space Mono',monospace",
                    fontSize: "0.66rem",
                    letterSpacing: "0.26em",
                    textTransform: "uppercase",
                    color: "var(--accent)",
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: "0.4rem",
                    marginBottom: "0.8rem",
                  }}
                >
                  📐 Area &amp; Confusion Matrix
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill,minmax(140px,1fr))",
                    gap: "0.7rem",
                    marginBottom: "1.2rem",
                  }}
                >
                  <MetricCard
                    label="🔴 Construction"
                    value={result.metrics.construction_area_ha}
                    unit=" ha"
                    color="#ef4444"
                    delay={0}
                  />
                  <MetricCard
                    label="🔵 Demolition"
                    value={result.metrics.demolition_area_ha}
                    unit=" ha"
                    color="#3b82f6"
                    delay={0.06}
                  />
                  <MetricCard
                    label="False Alarm Area"
                    value={result.metrics.wrong_area_ha}
                    unit=" ha"
                    color="var(--danger)"
                    delay={0.12}
                  />
                  <MetricCard
                    label="True Positives"
                    value={result.metrics.tp.toLocaleString()}
                    unit=" px"
                    color="var(--success)"
                    delay={0.18}
                  />
                  <MetricCard
                    label="False Positives"
                    value={result.metrics.fp.toLocaleString()}
                    unit=" px"
                    color="var(--danger)"
                    delay={0.24}
                  />
                  <MetricCard
                    label="False Negatives"
                    value={result.metrics.fn.toLocaleString()}
                    unit=" px"
                    color="var(--danger)"
                    delay={0.3}
                  />
                </div>

                {/* Polygon summary bar */}
                <div
                  style={{
                    display: "flex",
                    gap: "1.5rem",
                    alignItems: "center",
                    padding: "0.65rem 1rem",
                    marginBottom: "1rem",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    fontFamily: "'Space Mono',monospace",
                    fontSize: "0.72rem",
                    letterSpacing: "0.05em",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: "rgba(239,68,68,0.55)",
                        border: "2px solid #ef4444",
                      }}
                    />
                    <span style={{ color: "var(--text-2)" }}>CONSTRUCTION</span>
                    <span style={{ color: "#ef4444", fontWeight: 700 }}>
                      {result.n_construction} polygons
                    </span>
                  </span>
                  <span style={{ color: "var(--text-3)" }}>|</span>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: "rgba(59,130,246,0.55)",
                        border: "2px solid #3b82f6",
                      }}
                    />
                    <span style={{ color: "var(--text-2)" }}>DEMOLITION</span>
                    <span style={{ color: "#3b82f6", fontWeight: 700 }}>
                      {result.n_demolition} polygons
                    </span>
                  </span>
                </div>

                {/* Export */}
                <div
                  style={{
                    fontFamily: "'Space Mono',monospace",
                    fontSize: "0.66rem",
                    letterSpacing: "0.26em",
                    textTransform: "uppercase",
                    color: "var(--accent)",
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: "0.4rem",
                    marginBottom: "0.8rem",
                  }}
                >
                  💾 Export
                </div>
                <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
                  <button
                    onClick={downloadGeoJson}
                    style={{
                      flex: 1,
                      minWidth: 200,
                      background:
                        "linear-gradient(135deg,rgba(52,211,153,.08) 0%,rgba(56,189,248,.06) 100%)",
                      border: "1px solid rgba(52,211,153,.3)",
                      color: "var(--success)",
                      fontFamily: "'Space Mono',monospace",
                      fontSize: "0.75rem",
                      borderRadius: "10px",
                      padding: "0.65rem 1.2rem",
                      cursor: "pointer",
                      transition: "all 0.25s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        "var(--success)";
                      (e.currentTarget as HTMLButtonElement).style.boxShadow =
                        "0 0 16px rgba(52,211,153,.2)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        "rgba(52,211,153,.3)";
                      (e.currentTarget as HTMLButtonElement).style.boxShadow =
                        "none";
                    }}
                  >
                    📥 Download GeoJSON Vector
                  </button>
                  <button
                    onClick={downloadGeoTiff}
                    disabled={!result.raster_download_url}
                    style={{
                      flex: 1,
                      minWidth: 200,
                      background:
                        "linear-gradient(135deg,rgba(52,211,153,.08) 0%,rgba(56,189,248,.06) 100%)",
                      border: "1px solid rgba(52,211,153,.3)",
                      color: "var(--success)",
                      fontFamily: "'Space Mono',monospace",
                      fontSize: "0.75rem",
                      borderRadius: "10px",
                      padding: "0.65rem 1.2rem",
                      cursor: "pointer",
                      transition: "all 0.25s ease",
                    }}
                  >
                    📥 Download GeoTIFF Raster
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Keyframe for spinner */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float-y { 0%,100%{transform:translate(-50%,-50%);} 50%{transform:translate(-50%,calc(-50% - 6px));} }
        @keyframes pulse-ring { 0% { transform: scale(0.33); opacity: 0.8; } 80%,100% { transform: scale(1.2); opacity: 0; } }
        .leaflet-control-layers { background: var(--bg-card) !important; border: 1px solid var(--border) !important; border-radius: 8px !important; color: var(--text-1) !important; font-family: 'Space Grotesk',sans-serif !important; font-size: 0.8rem !important; }
        .leaflet-control-layers-toggle { background-color: var(--bg-elevated) !important; }
        .leaflet-bar a { background: var(--bg-card) !important; color: var(--accent) !important; border-color: var(--border) !important; }
        .leaflet-bar a:hover { background: var(--bg-elevated) !important; }
      `}</style>
    </section>
  );
}
