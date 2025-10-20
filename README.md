# Mean Linear Intercept Analysis App

A full-stack toolkit that streamlines Mean Linear Intercept (MLI) measurement from lung histology imagery. The frontend is built with React + Vite + TypeScript, and the backend is powered by FastAPI with NumPy, OpenCV, and scikit-image providing the image-processing core.

## Project Structure

```
.
├── backend/
│   ├── main.py
│   ├── mli_analysis.py
│   ├── models.py
│   ├── storage.py
│   ├── excel_export.py
│   ├── requirements.txt
│   └── uploads/ / results/
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── vite.config.ts
├── docker-compose.yml
└── run_app.bat
```

## Quick Start (Local Development)

1. **Backend**
   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r backend\requirements.txt
   uvicorn backend.main:app --reload --app-dir .
   ```

2. **Frontend** (in a second terminal)
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

The React dev server runs on <http://localhost:5173> by default and proxies API calls to the FastAPI backend at <http://localhost:8000> (configure `VITE_API_URL` if needed).

## One-Command Launch (Windows)

Run `run_app.bat` from the project root. It provisions a Python virtual environment, installs dependencies, starts the FastAPI backend (from the project root so the `backend` package resolves), and launches the Vite development server.

## Docker Deployment

Ensure Docker Desktop is running, then from the project root execute:

```powershell
docker compose up --build
```

- Frontend served at <http://localhost:3000>
- Backend API available at <http://localhost:8000>

Modify `VITE_API_URL` inside `docker-compose.yml` if deploying to different hosts or ports.

## Key Features

- **Animal management**: Add multiple specimens, upload images per animal, and reassign images between animals.
- **Configurable analysis**: Adjust scale, independent horizontal/vertical line lengths, line counts, smoothing, and tissue filtering directly from the UI with persistence in local storage.
- **MLI computation**: FastAPI service handles segmentation, auto-spaces the grid based on image dimensions, counts horizontal/vertical intercepts, and calculates per-line plus per-image statistics.
- **Results dashboard**: Inspect per-line intercept tables matching the lab reporting format, preview processed overlays, trigger batch analyses, and receive real-time status feedback.
- **Visual overlays**: Processed images (PNG) display the measurement grid and detected intercept points so reviewers can quickly validate each run.
- **Excel export**: Download a structured workbook matching laboratory reporting conventions.
- **Docker ready**: Build and ship with the included backend and frontend Dockerfiles, orchestrated via `docker-compose.yml`.

## Testing Notes

- For reproducible analysis, use consistent scale parameters and ensure uploaded images share the same magnification.
- Large images should be processed on machines with sufficient memory; tune `sigma_denoise` and `min_area` to reduce noise.
- When exporting results, any lines without intercepts are omitted from the mean calculation (marked as `None` in raw data).

## Next Steps

- Add authentication and role-based access if data must be restricted.
- Persist metadata in a database (SQLite/PostgreSQL) for collaborative studies.
- Extend the Excel export with charts or additional statistical summaries.
- Integrate cloud object storage for resilient image archiving.
