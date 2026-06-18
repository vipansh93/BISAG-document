"""
TERRA·WATCH — FastAPI Backend
All Earth Engine processing logic migrated from 2.py.
Run with: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import ee
import json
import requests
import io
from typing import Optional

# =====================================================================
# APP SETUP
# =====================================================================
app = FastAPI(title="GeoChronos API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================
# EARTH ENGINE INITIALIZATION
# =====================================================================
_ee_ready = False

def ensure_ee():
    global _ee_ready
    if not _ee_ready:
        try:
            ee.Initialize(project="cdbisag")
            _ee_ready = True
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Earth Engine init failed: {exc}")

@app.on_event("startup")
def startup():
    try:
        ee.Initialize(project="cdbisag")
        global _ee_ready
        _ee_ready = True
        print("[OK] Earth Engine initialized")
    except Exception as e:
        print(f"[WARN] Earth Engine startup init failed (will retry on first request): {e}")

# =====================================================================
# REQUEST MODELS
# =====================================================================
class TileRequest(BaseModel):
    aoi_geojson: dict
    start_year: int
    end_year: int

class AnalysisRequest(BaseModel):
    aoi_geojson: dict
    start_year: int
    end_year: int
    construction_thresh: float = 0.03
    demolition_thresh: float = -0.04
    min_patch_pixels: int = 2
    ndvi_veg_thresh: float = 0.40
    ensemble_votes: int = 1

# =====================================================================
# CORE SATELLITE UTILITIES  (unchanged from 2.py)
# =====================================================================
def mask_s2_clouds(image):
    scl = image.select("SCL")
    scl_mask = scl.neq(3).And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10))
    qa = image.select("QA60")
    qa_mask = qa.bitwiseAnd(1 << 10).eq(0).And(qa.bitwiseAnd(1 << 11).eq(0))
    return image.updateMask(scl_mask.And(qa_mask)).divide(10000)


def get_seasonal_composite(roi, year):
    def half(sm, em):
        return (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(roi)
            .filterDate(f"{year}-{sm:02d}-01", f"{year}-{em:02d}-28")
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
            .map(mask_s2_clouds)
        )

    full = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(roi)
        .filterDate(f"{year}-01-01", f"{year}-12-31")
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        .map(mask_s2_clouds)
    )
    merged = half(1, 6).merge(half(7, 12))
    size = merged.size()
    return ee.Algorithms.If(size.gt(0), merged.median(), full.median())


def get_year_tile_url(aoi_geojson: dict, year: int) -> Optional[str]:
    try:
        roi = ee.Geometry(aoi_geojson)
        composite = ee.Image(get_seasonal_composite(roi, year)).clip(roi)
        vis_image = composite.select(["B4", "B3", "B2"]).visualize(
            min=0.0, max=0.35, gamma=1.15
        )
        map_id = vis_image.getMapId()
        return map_id["tile_fetcher"].url_format
    except Exception:
        return None


def compute_indices(img):
    img = ee.Image(img)
    ndbi = img.normalizedDifference(["B11", "B8"]).rename("NDBI")
    ndvi = img.normalizedDifference(["B8", "B4"]).rename("NDVI")
    mndwi = img.normalizedDifference(["B3", "B11"]).rename("MNDWI")
    bsi = img.expression(
        "((B11+B4)-(B8+B2))/((B11+B4)+(B8+B2)+1e-9)",
        {
            "B11": img.select("B11"),
            "B4": img.select("B4"),
            "B8": img.select("B8"),
            "B2": img.select("B2"),
        },
    ).rename("BSI")
    return ee.Image([ndbi, ndvi, mndwi, bsi])


def lightweight_noise_filter(binary_image, min_pixels):
    if min_pixels <= 1:
        return binary_image.unmask(0)
    as_float = binary_image.toFloat()
    if min_pixels <= 3:
        smoothed = as_float.focal_median(radius=1, kernelType="square", units="pixels")
        return smoothed.gt(0.4).unmask(0)
    elif min_pixels <= 6:
        s1 = as_float.focal_median(radius=1, kernelType="square", units="pixels")
        s2 = s1.focal_median(radius=2, kernelType="square", units="pixels")
        return s2.gt(0.4).unmask(0)
    else:
        s1 = as_float.focal_median(radius=1, kernelType="square", units="pixels")
        s2 = s1.focal_median(radius=2, kernelType="square", units="pixels")
        s3 = s2.focal_median(radius=2, kernelType="square", units="pixels")
        return s3.gt(0.45).unmask(0)


def get_worldcover_urban(roi):
    try:
        wc = ee.ImageCollection("ESA/WorldCover/v200").first().clip(roi)
        return wc.eq(50).rename("wc_urban")
    except Exception:
        return None


# =====================================================================
# API ENDPOINTS
# =====================================================================

@app.get("/api/health")
def health():
    return {"status": "online", "ee_ready": _ee_ready}


@app.post("/api/tiles")
def get_tiles(req: TileRequest):
    """Return XYZ tile URLs for baseline and target years over the AOI."""
    ensure_ee()
    aoi_key = json.dumps(req.aoi_geojson, sort_keys=True)

    baseline_url = get_year_tile_url(req.aoi_geojson, req.start_year)
    target_url = get_year_tile_url(req.aoi_geojson, req.end_year)

    return {
        "baseline_url": baseline_url,
        "target_url": target_url,
        "start_year": req.start_year,
        "end_year": req.end_year,
    }


@app.post("/api/analyze")
def analyze(req: AnalysisRequest):
    """
    Full multi-index ensemble change detection pipeline — identical to 2.py logic.
    Returns metrics + construction/demolition GeoJSON + raster download URL.
    """
    ensure_ee()

    try:
        active_roi = ee.Geometry(req.aoi_geojson)
        start_year = req.start_year
        end_year = req.end_year
        construction_thresh = req.construction_thresh
        demolition_thresh = req.demolition_thresh
        min_patch_pixels = req.min_patch_pixels
        ndvi_veg_thresh = req.ndvi_veg_thresh
        ensemble_votes = req.ensemble_votes

        # ── Composites ──────────────────────────────────────────────
        img_baseline = ee.Image(get_seasonal_composite(active_roi, start_year)).clip(active_roi)
        img_target   = ee.Image(get_seasonal_composite(active_roi, end_year)).clip(active_roi)

        # ── Indices ─────────────────────────────────────────────────
        idx_base   = compute_indices(img_baseline)
        idx_target = compute_indices(img_target)

        ndbi_base  = idx_base.select("NDBI");   ndbi_tgt  = idx_target.select("NDBI")
        ndvi_base  = idx_base.select("NDVI");   ndvi_tgt  = idx_target.select("NDVI")
        mndwi_base = idx_base.select("MNDWI");  mndwi_tgt = idx_target.select("MNDWI")
        bsi_base   = idx_base.select("BSI");    bsi_tgt   = idx_target.select("BSI")

        d_ndbi  = ndbi_tgt.subtract(ndbi_base)
        d_ndvi  = ndvi_tgt.subtract(ndvi_base)
        d_mndwi = mndwi_tgt.subtract(mndwi_base)
        d_bsi   = bsi_tgt.subtract(bsi_base)

        not_vegetation = ndvi_tgt.lt(ndvi_veg_thresh)
        not_water      = mndwi_tgt.lt(0.15)

        # ── Ensemble voting ─────────────────────────────────────────
        vote_ndbi  = d_ndbi.gt(construction_thresh)
        vote_ndvi  = d_ndvi.lt(-construction_thresh * 0.7)
        vote_mndwi = d_mndwi.lt(-construction_thresh * 0.5)
        vote_bsi   = d_bsi.gt(construction_thresh * 0.6)

        ensemble_score   = vote_ndbi.add(vote_ndvi).add(vote_mndwi).add(vote_bsi)
        construction_raw = (
            ensemble_score.gte(ensemble_votes).And(not_vegetation).And(not_water)
        )
        demolition_raw = (
            d_ndbi.lt(demolition_thresh)
            .And(d_ndvi.gt(-demolition_thresh * 0.4))
            .And(not_water)
        )

        construction_clean = lightweight_noise_filter(
            construction_raw.unmask(0), min_patch_pixels
        ).rename("construction")
        demolition_clean = lightweight_noise_filter(
            demolition_raw.unmask(0), min_patch_pixels
        ).rename("demolition")

        total_change_raw   = construction_raw.Or(demolition_raw).unmask(0)
        total_change_clean = lightweight_noise_filter(total_change_raw, min_patch_pixels)
        predicted_raster   = total_change_clean.rename("predicted")

        # ── Ground truth / metrics ───────────────────────────────────
        wc_urban    = get_worldcover_urban(active_roi)
        gt_spectral = d_ndbi.abs().gt(0.02).And(img_target.select("B11").gt(0.05))
        if wc_urban is not None:
            ground_truth = (
                gt_spectral.And(wc_urban.eq(1).Or(d_ndbi.abs().gt(0.08)))
                .unmask(0).rename("actual")
            )
        else:
            gt_any = (
                d_ndbi.abs().gt(0.03)
                .Or(d_bsi.abs().gt(0.025))
                .Or(d_ndvi.abs().gt(0.05))
            )
            ground_truth = gt_spectral.And(gt_any).unmask(0).rename("actual")

        pixel_area         = ee.Image.pixelArea()
        predicted_named    = predicted_raster.rename("predicted")
        ground_truth_named = ground_truth.rename("actual")
        RR = dict(geometry=active_roi, scale=10, maxPixels=1e10, tileScale=4)

        total_detected_area = (
            predicted_named.gt(0).rename("area")
            .multiply(pixel_area)
            .reduceRegion(reducer=ee.Reducer.sum(), **RR)
            .get("area")
        )
        wrong_area = (
            predicted_named.eq(1).And(ground_truth_named.eq(0)).rename("fp")
            .multiply(pixel_area)
            .reduceRegion(reducer=ee.Reducer.sum(), **RR).get("fp")
        )
        undetected_area = (
            predicted_named.eq(0).And(ground_truth_named.eq(1)).rename("fn")
            .multiply(pixel_area)
            .reduceRegion(reducer=ee.Reducer.sum(), **RR).get("fn")
        )

        tp_c = float(predicted_named.eq(1).And(ground_truth_named.eq(1)).rename("tp")
                     .reduceRegion(reducer=ee.Reducer.sum(), **RR).getInfo().get("tp", 0) or 0)
        tn_c = float(predicted_named.eq(0).And(ground_truth_named.eq(0)).rename("tn")
                     .reduceRegion(reducer=ee.Reducer.sum(), **RR).getInfo().get("tn", 0) or 0)
        fp_c = float(predicted_named.eq(1).And(ground_truth_named.eq(0)).rename("fp")
                     .reduceRegion(reducer=ee.Reducer.sum(), **RR).getInfo().get("fp", 0) or 0)
        fn_c = float(predicted_named.eq(0).And(ground_truth_named.eq(1)).rename("fn")
                     .reduceRegion(reducer=ee.Reducer.sum(), **RR).getInfo().get("fn", 0) or 0)
        total_c = float(predicted_named.gte(0).rename("total")
                        .reduceRegion(reducer=ee.Reducer.sum(), **RR).getInfo().get("total", 1) or 1)

        accuracy_score = max(0.0, min(1.0, (tp_c + tn_c) / total_c if total_c > 0 else 0.0))
        precision      = tp_c / (tp_c + fp_c) if (tp_c + fp_c) > 0 else 0.0
        recall         = tp_c / (tp_c + fn_c) if (tp_c + fn_c) > 0 else 0.0
        f1_score       = (
            2 * precision * recall / (precision + recall)
            if (precision + recall) > 0 else 0.0
        )

        area_detected_ha   = round(float(ee.Number(total_detected_area or 0).divide(10000).getInfo()), 2)
        area_wrong_ha      = round(float(ee.Number(wrong_area or 0).divide(10000).getInfo()), 2)
        area_undetected_ha = round(float(ee.Number(undetected_area or 0).divide(10000).getInfo()), 2)

        _con_sum = (
            construction_clean.gt(0).rename("a")
            .multiply(pixel_area)
            .reduceRegion(reducer=ee.Reducer.sum(), **RR).get("a")
        )
        _dem_sum = (
            demolition_clean.gt(0).rename("a")
            .multiply(pixel_area)
            .reduceRegion(reducer=ee.Reducer.sum(), **RR).get("a")
        )
        construction_area_ha = round(float(ee.Number(_con_sum or 0).divide(10000).getInfo()), 2)
        demolition_area_ha   = round(float(ee.Number(_dem_sum or 0).divide(10000).getInfo()), 2)

        metrics = {
            "accuracy":              round(accuracy_score * 100, 2),
            "precision":             round(precision * 100, 2),
            "recall":                round(recall * 100, 2),
            "f1":                    round(f1_score * 100, 2),
            "total_area_ha":         area_detected_ha,
            "construction_area_ha":  construction_area_ha,
            "demolition_area_ha":    demolition_area_ha,
            "wrong_area_ha":         area_wrong_ha,
            "undetected_area_ha":    area_undetected_ha,
            "tp":                    int(tp_c),
            "tn":                    int(tn_c),
            "fp":                    int(fp_c),
            "fn":                    int(fn_c),
        }

        # ── GeoTIFF download URL ────────────────────────────────────
        geotiff_url = predicted_raster.updateMask(predicted_raster.gt(0)).getDownloadURL({
            "scale": 10, "crs": "EPSG:4326", "region": active_roi, "format": "GEO_TIFF"
        })

        # ── Vectorize CONSTRUCTION ──────────────────────────────────
        construction_vectors = (
            construction_clean.updateMask(construction_clean.gt(0))
            .reduceToVectors(
                geometry=active_roi, scale=10, geometryType="polygon",
                eightConnected=True, labelProperty="class",
                maxPixels=1e10, tileScale=4,
            )
        )
        construction_geojson = construction_vectors.getInfo()
        for feat in construction_geojson.get("features", []):
            feat.setdefault("properties", {})["change_type"] = "construction"

        # ── Vectorize DEMOLITION ────────────────────────────────────
        demolition_vectors = (
            demolition_clean.updateMask(demolition_clean.gt(0))
            .reduceToVectors(
                geometry=active_roi, scale=10, geometryType="polygon",
                eightConnected=True, labelProperty="class",
                maxPixels=1e10, tileScale=4,
            )
        )
        demolition_geojson = demolition_vectors.getInfo()
        for feat in demolition_geojson.get("features", []):
            feat.setdefault("properties", {})["change_type"] = "demolition"

        merged_features = (
            construction_geojson.get("features", []) +
            demolition_geojson.get("features", [])
        )
        detected_geojson = {"type": "FeatureCollection", "features": merged_features}

        # ── Tile URLs for overlay map ────────────────────────────────
        baseline_tile_url = get_year_tile_url(req.aoi_geojson, start_year)
        target_tile_url   = get_year_tile_url(req.aoi_geojson, end_year)

        return {
            "metrics":               metrics,
            "construction_geojson":  construction_geojson,
            "demolition_geojson":    demolition_geojson,
            "detected_geojson":      detected_geojson,
            "raster_download_url":   geotiff_url,
            "baseline_tile_url":     baseline_tile_url,
            "target_tile_url":       target_tile_url,
            "n_construction":        len(construction_geojson.get("features", [])),
            "n_demolition":          len(demolition_geojson.get("features", [])),
        }

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/download-geotiff")
def download_geotiff(url: str = Query(...)):
    """Proxy GeoTIFF download so the browser can fetch it from the same origin."""
    try:
        r = requests.get(url, timeout=120, stream=True)
        r.raise_for_status()
        return StreamingResponse(
            io.BytesIO(r.content),
            media_type="image/tiff",
            headers={"Content-Disposition": "attachment; filename=change_raster.tif"},
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"GeoTIFF fetch failed: {exc}")
