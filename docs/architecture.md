# 🏛️ System Architecture & Engineering Design

This document details the photogrammetric, computer vision, and software engineering architecture of the **Chandrayaan-2 Multi-Modal Lunar Image Registration Engine**.

---

## 1. High-Level Modular Design

The system is partitioned into five distinct modular subsystems:

```mermaid
graph TD
    classDef inputStyle fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef procStyle fill:#0f172a,stroke:#818cf8,stroke-width:2px,color:#f8fafc;
    classDef verifyStyle fill:#312e81,stroke:#a855f7,stroke-width:2px,color:#f8fafc;
    classDef appStyle fill:#14532d,stroke:#22c55e,stroke-width:2px,color:#f8fafc;

    subgraph DATA_LAYER["Data & Ingestion Subsystem"]
        PDS4["PDS4 XML Metadata Reader"]:::inputStyle
        VICAR["VICAR / LRO PDS3 Reader"]:::inputStyle
        ODE["LRO ODE REST Automated Client"]:::inputStyle
    end

    subgraph ENGINE_LAYER["Core Photogrammetry Engine"]
        PC["Log-Gabor Phase Congruency"]:::procStyle
        CFOG["CFOG 3D Feature Tensor"]:::procStyle
        RELIEF["DEM Ray-Intersection Warper"]:::procStyle
        STEREO["TMC-2 Triplet Disparity Stereo"]:::procStyle
    end

    subgraph QA_LAYER["Verification & Quality Control"]
        RF["Random Forest Gate 3 Verifier"]:::verifyStyle
        MAGSAC["MAGSAC++ Sub-Pixel Homography"]:::verifyStyle
        GATES["4-Tier Photogrammetric Quality Gates"]:::verifyStyle
    end

    subgraph APP_LAYER["Application & Presentation Layer"]
        FASTAPI["FastAPI High-Performance Backend"]:::appStyle
        NEXTJS["Next.js 14 Astralynx Mission Console"]:::appStyle
        GLOBE["Three.js 3D Lunar Visualization"]:::appStyle
    end

    DATA_LAYER --> ENGINE_LAYER
    ENGINE_LAYER --> QA_LAYER
    QA_LAYER --> APP_LAYER
```

---

## 2. Ingestion & Preprocessing Subsystem

The ingestion engine handles raw ISRO PDS4 XML product labels and NASA PDS3 Vicar headers:

```mermaid
flowchart LR
    XML["PDS4 XML Product Label"] --> PARSER["pds4_reader.py"]
    PARSER --> GEOM["Observation Telemetry<br/>- Solar Azimuth & Elevation<br/>- Sensor Emission Angle<br/>- Target Coordinate Lat/Lon<br/>- Ground Sample Distance (GSD)"]
    
    IMG_OHRC["OHRC Raster (0.25 m/px)"] --> RESAMPLE["Common-GSD Area Averaging"]
    IMG_TMC["TMC-2 Raster (5.0 m/px)"] --> RESAMPLE
    GEOM --> RESAMPLE
    RESAMPLE --> NORMALIZED["Normalized 5.0m Optical Pair"]
```

---

## 3. Illumination-Invariant Matching Subsystem

Under low sun elevation ($10^\circ - 30^\circ$) and opposing solar azimuth ($\Delta\theta_{\text{sun}} \approx 160^\circ$), raw intensity gradients flip direction ($180^\circ$).

```mermaid
graph TB
    NORM["Normalized Image Pair"] --> GABOR["Multi-Scale Log-Gabor Filter Bank<br/>(6 Orientations &times; 4 Scales)"]
    GABOR --> PC["Frequency-Domain Phase Congruency<br/>(Structure independent of illumination magnitude)"]
    PC --> ORIENT["Directional Gradients with Cosine Weighting"]
    ORIENT --> TENSOR["CFOG 3D Feature Descriptor Volume<br/>(H &times; W &times; 8 Angular Channels)"]
    TENSOR --> NMS["Dynamic 10x10 Grid NMS<br/>(Prevents tie-point clustering on high-contrast crater rims)"]
```

---

## 4. Quality Gate State Machine

```mermaid
stateDiagram-v2
    [*] --> IngestCandidates
    IngestCandidates --> Gate1_CountCheck: Raw Match Generation
    
    Gate1_CountCheck --> FailedInsufficient: N < 4
    Gate1_CountCheck --> Gate2_GeometricFit: N >= 4
    
    Gate2_GeometricFit --> FailedGeometric: Inliers < 4 or Residual > 5.0px
    Gate2_GeometricFit --> Gate3_MatrixStability: Consensus Inliers Found
    
    Gate3_MatrixStability --> FailedDistortion: cond(H) >= 1e7 or det(H) <= 1e-4
    Gate3_MatrixStability --> Gate4_SpatialSpread: Stable Matrix
    
    Gate4_SpatialSpread --> FailedClustering: < 3 Cells or Max Cell > 60%
    Gate4_SpatialSpread --> ApprovedRegistration: Multi-Quadrant Distribution
    
    ApprovedRegistration --> [*]
    FailedInsufficient --> Rejected
    FailedGeometric --> Rejected
    FailedDistortion --> Rejected
    FailedClustering --> Rejected
    Rejected --> [*]
```
