# 🛰️ GeoChronos — Satellite Change Detection Platform

GeoChronos is a premium, high-performance web application designed for planetary intelligence and land transformation monitoring. Developed for the **Bhaskaracharya National Institute for Space Applications and Geo-informatics (BISAG-N)**, it is powered by **Google Earth Engine (GEE)** and **Sentinel-2 multispectral imagery**. The platform runs a robust 4-index ensemble algorithm to detect construction, demolition, and urban growth at 10-meter resolution in near real-time.

---

## 🌟 Key Features

* **Interactive AOI Sketching:** Draw your Area of Interest (AOI) directly on a Google Satellite basemap using Leaflet drawing tools.
* **Temporal Swipe Comparison:** Side-by-side interactive swipe map comparing Sentinel-2 seasonal median composites for any baseline and target years (2015–Present).
* **4-Index Ensemble Detection:** Votes from NDBI, NDVI, MNDWI, and BSI indices are aggregated to ensure resilience against seasonal and atmospheric variations.
* **Advanced Sensitivity Controls:** Fine-tune threshold parameters, minimum patch sizes, vegetation masks, and ensemble votes directly from the sidebar.
* **Granular Metrics Dashboard:** Accuracy, Precision, Recall, F1-score, and total construction/demolition area (in hectares) calculated per-pixel.
* **Planetary Export:** Download change detection vectors as a standard GeoJSON file or rasters as a GeoTIFF directly.

---

## 📁 Project Directory Structure

```
BISAG_LLMarena/
│
├── start_dev.bat                 ← Launcher (starts both backend + frontend)
├── requirements.txt              ← Unified Python dependencies
├── README.md                     ← Project documentation
│
├── backend/                      ← Python FastAPI REST API
│   └── main.py                   ← GEE image processing & analysis logic
│
├── streamlit-satellite-change-detection/  ← React + Vite + TypeScript Frontend
│   ├── index.html                
│   ├── package.json              
│   ├── vite.config.ts            ← Proxies API requests to localhost:8000
│   └── src/
│       ├── App.tsx               ← Main layout & dashboard shell
│       ├── index.css             ← Global custom glassmorphism styles
│       ├── components/
│       │   ├── AnalysisApp.tsx   ← Live interactive analysis dashboard
│       │   └── Earth3D.tsx       ← 3D rotating Earth hero component
│       └── utils/
│           └── cn.ts             ← Class merges
│
└── reference/
    └── 2.py                      ← Backup of the original Streamlit reference app
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
* **Node.js** (v18 or higher) & **npm**
* **Python** (v3.9 to v3.12)
* **Google Earth Engine account** authenticated on your machine (or a valid project ID like `cdbisag`).

---

### Setup & Installation

1. **Clone/Open the workspace** in VS Code.
2. **Create the Python Virtual Environment & Install Dependencies:**
   Open a terminal in the root folder and run:
   ```bash
   python -m venv .venv
   .venv\Scripts\pip install -r requirements.txt
   ```
3. **Install Frontend Dependencies:**
   Open another terminal, navigate to the frontend directory, and run:
   ```bash
   cd streamlit-satellite-change-detection
   npm install
   ```

---

## 🏃 Running the Application

### Method A: One-Click Startup (Easiest)
Simply double-click the **`start_dev.bat`** file in your project folder. This will automatically open separate command prompt windows to launch both the FastAPI backend and React frontend.

---

### Method B: Manual Startup (via Terminal)

1. **Start the FastAPI Backend:**
   In your first terminal, navigate to the backend folder and run uvicorn:
   ```bash
   cd backend
   ..\.venv\Scripts\python -m uvicorn main:app --reload --port 8000
   ```
   *The backend will boot up on `http://localhost:8000` and automatically verify its connection to Google Earth Engine.*

2. **Start the React Frontend:**
   In a second terminal, run:
   ```bash
   cd streamlit-satellite-change-detection
   npm run dev
   ```
   *The frontend dev server will launch on `http://localhost:5173` (or `http://localhost:5174` if occupied).*

3. **Open in Browser:**
   Navigate to the URL printed by Vite (usually **`http://localhost:5173`** or **`http://localhost:5174`**) to access the web application.

---

## 🔬 How the Change Detection Algorithm Works

The backend implements a multi-index ensemble voting classifier migrated from the original `2.py` Streamlit configuration:

1. **Seasonal Composites:** Sentinel-2 Surface Reflectance (SR) scenes are dual-filtered using SCL (Scene Classification Layer) and QA60 bands to mask out clouds/shadows. A seasonal median composite is calculated for both the baseline and target years.
2. **Spectral Indices:** The platform calculates four normalized differences:
   * **NDBI** (Normalized Difference Built-Up Index): Identifies artificial surfaces.
   * **NDVI** (Normalized Difference Vegetation Index): Identifies healthy plant life.
   * **MNDWI** (Modified Normalized Difference Water Index): Identifies open water bodies.
   * **BSI** (Bare Soil Index): Differentiates bare earth from urban surfaces.
3. **Ensemble Voting:** High-resolution change maps are computed based on NDBI growth (construction) or drops (demolition). Detections are masked by NDVI vegetation thresholds and MNDWI water masks to prevent false positives.
4. **Noise Filtering:** A focal median filter is applied to eliminate salt-and-pepper noise and isolate cohesive change patches based on your `Min Patch Size` setting.

---

## 💡 Troubleshooting

* **Backend Offline Warning:** If the header badge displays "Backend offline", ensure your uvicorn server is running on port `8000` and that the proxy target in `vite.config.ts` matches your backend URL.
* **Earth Engine Authentication:** If the backend log shows initialization errors, make sure you have run `earthengine authenticate` in your command line, or check that your GEE project ID in `backend/main.py` is set correctly:
  ```python
  ee.Initialize(project="YOUR_PROJECT_ID")
  ```
