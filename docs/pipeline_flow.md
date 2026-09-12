# ⚡ Pipeline Execution & Data Flow

This document details the data lifecycle, execution pathways, and product generation mechanisms across the registration pipeline.

---

## 1. End-to-End Pipeline Data Flow

```mermaid
flowchart TD
    subgraph INPUTS["Input Datasets (sample_data/ & processed_triplets/)"]
        SRC["OHRC Source Image (0.25m)"]
        REF["TMC-2 Reference Image (5.0m)"]
        DEM["Terrain Elevation DEM"]
        XML["PDS4 Metadata XML"]
    end

    subgraph RUNNER["Pipeline Orchestrator (run_demo.py)"]
        PARSE["Metadata & Incidence Extractor"]
        RESCALE["Common-GSD Area Averaging"]
        WARP["Terrain Parallax Compensation"]
        MATCH["CFOG Feature Extraction & Matching"]
        VERIFY["AI Verification & Quality Gates"]
    end

    subgraph PRODUCTS["Product Exporter (results/)"]
        TIF["registered_source.tif (GeoTIFF)"]
        PNG_CHECK["registered_checkerboard.png"]
        PNG_BLEND["registered_preview.png"]
        JSON_PTS["matches.json (Sub-pixel tie-points)"]
        JSON_METRICS["metrics.json (RMSE, inliers, status)"]
        MD_REPORT["summary_report.md"]
    end

    SRC & REF & DEM & XML --> PARSE
    PARSE --> RESCALE --> WARP --> MATCH --> VERIFY
    VERIFY --> TIF & PNG_CHECK & PNG_BLEND & JSON_PTS & JSON_METRICS & MD_REPORT
```

---

## 2. Dynamic Regional Ingestion Flow

For new user-uploaded or bulk PDS4 zip packages, the backend executes an asynchronous background worker flow:

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Mission Operator
    participant UI as Ingest Dashboard (/ingest)
    participant API as FastAPI Ingest Router
    participant Worker as Background Ingest Thread
    participant Storage as Regional Datasets

    Operator->>UI: Drop PDS4 ZIP archives (OHRC, TMC-2, IIRS)
    UI->>API: POST /api/ingest/upload (multipart files)
    API->>API: Validate ZIP contents & extract XML manifests
    API-->>UI: Return job_id & status: queued
    UI->>API: Poll GET /api/ingest/status/{job_id}
    API->>Worker: Dispatch Ingest Pipeline Job
    Worker->>Worker: Unpack & Calculate Orbit Footprint Intersections
    Worker->>Worker: Crop Shared 512x512 Regional Triplets
    Worker->>Storage: Store input triplets (dem, iirs, ohrc, tmc, manifest.json)
    Worker-->>API: Job Status: Completed
    API-->>UI: Return Discovered Triplets & Overlap Geometry
    Operator->>UI: Click 'Launch Image Registration Console'
```

---

## 3. Composed Hyperspectral (IIRS) Registration Pathway

Because IIRS is an ~70–80 m/px spectrometer, direct sub-meter tie-points between OHRC and IIRS are physically ill-posed. The pipeline computes an honest **composed geometric chain**:

```mermaid
graph LR
    OHRC["OHRC (0.25 m/px)"] -->|H_OT (Measured Inliers >= 4)| TMC["TMC-2 (5.0 m/px)"]
    TMC -->|H_TI (Spectral Continuum Anchor)| IIRS["IIRS (70-80 m/px)"]
    OHRC -.->|Composed Transform: H_OI = H_TI &times; H_OT| IIRS

    style OHRC fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#fff
    style TMC fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#fff
    style IIRS fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#fff
```

> **Notice**: Composed OHRC&rarr;IIRS tie-points are recorded strictly as derived context overlays and are never falsely reported as direct sub-pixel optical matches.
