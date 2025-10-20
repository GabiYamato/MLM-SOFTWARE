from __future__ import annotations

import shutil
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import List

if __package__ is None or __package__ == '':
    import sys

    current_dir = Path(__file__).resolve().parent
    parent_dir = current_dir.parent
    if str(parent_dir) not in sys.path:
        sys.path.insert(0, str(parent_dir))
    __package__ = current_dir.name

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .excel_export import export_results_to_excel
from .mli_analysis import AnalysisConfigData, ImageProcessingError, run_mli_analysis
from .models import (
    AnalysisConfigModel,
    AnalysisImageResultModel,
    AnalysisResultModel,
    AnalyzeRequestModel,
    ClearResultsResponseModel,
    DeleteImageResponseModel,
    ImageUploadResponseModel,
    LineResultModel,
    MoveImageRequestModel,
    MoveImageResponseModel,
    PreviewAnalysisRequestModel,
    UploadResponseModel,
)
from .storage import AnalysisImageResult, AnalysisResult, LineResult, StateManager

BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / 'uploads'
RESULTS_DIR = BASE_DIR / 'results'

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title='MLI Analysis API', version='1.0.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

state_manager = StateManager(RESULTS_DIR)


def parse_analysis_config(
    scaleUmPerPixel: float = Form(...),
    horizontalLineLengthUm: float = Form(...),
    verticalLineLengthUm: float = Form(...),
    nLinesHorizontal: int = Form(...),
    nLinesVertical: int = Form(...),
    sigmaDenoise: float = Form(0),
    minArea: int = Form(0),
    magnification: str = Form(...),
) -> AnalysisConfigModel:
    return AnalysisConfigModel(
        scale_um_per_pixel=scaleUmPerPixel,
        line_length_um_horizontal=horizontalLineLengthUm,
        line_length_um_vertical=verticalLineLengthUm,
        n_lines_horizontal=nLinesHorizontal,
        n_lines_vertical=nLinesVertical,
        sigma_denoise=sigmaDenoise,
        min_area=minArea,
        magnification=magnification,
    )


@app.get('/health')
async def health_check() -> dict[str, str]:
    return {'status': 'ok', 'timestamp': datetime.utcnow().isoformat() + 'Z'}


@app.post('/upload', response_model=UploadResponseModel)
async def upload_images(
    animal_id: str = Form(...),
    images: List[UploadFile] = File(...),
    _config: AnalysisConfigModel = Depends(parse_analysis_config),
) -> UploadResponseModel:
    if not images:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='No images provided')

    state_manager.ensure_animal(animal_id)

    uploads: List[ImageUploadResponseModel] = []
    for upload in images:
        target_dir = UPLOADS_DIR / animal_id
        target_dir.mkdir(parents=True, exist_ok=True)
        file_identifier = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_{upload.filename}"
        destination = target_dir / file_identifier
        with destination.open('wb') as destination_file:
            shutil.copyfileobj(upload.file, destination_file)
        upload.file.close()
        size = destination.stat().st_size
        record = state_manager.add_image(animal_id, upload.filename, destination, size)
        uploads.append(
            ImageUploadResponseModel(
                image_id=record.image_id,
                filename=record.original_filename,
                size=record.size,
                stored_path=str(destination.relative_to(BASE_DIR)),
                animal_id=animal_id,
            )
        )

    return UploadResponseModel(uploads=uploads)


@app.post('/analyze', response_model=AnalysisResultModel)
async def analyze(request: AnalyzeRequestModel) -> AnalysisResultModel:
    images = state_manager.get_images_for_animal(request.animal_id)
    if not images:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='No images found for this animal')

    config = request.config
    config_data = AnalysisConfigData(**config.dict())

    image_results: List[AnalysisImageResult] = []
    for index, image in enumerate(images):
        image_path = Path(image.stored_path)
        if not image_path.is_absolute():
            image_path = BASE_DIR / image_path
        if not image_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f'Image not found on disk: {image_path}')

        try:
            metrics = run_mli_analysis(image_path, config_data)
        except ImageProcessingError as error:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error

        image_results.append(
            AnalysisImageResult(
                image_id=image.image_id,
                image_number=index + 1,
                name=image.original_filename,
                average_mli_um=metrics.average_mli_um,
                processed_image_base64=metrics.processed_image_base64,
                threshold_image_base64=metrics.threshold_image_base64,
                lines=[
                    LineResult(
                        line_number=line.line_number,
                        horizontal_intercepts=line.horizontal_intercepts,
                        vertical_intercepts=line.vertical_intercepts,
                        horizontal_length_um=line.horizontal_length_um,
                        vertical_length_um=line.vertical_length_um,
                        total_line_length_um=line.total_line_length_um,
                        mean_linear_intercept_um=line.mean_linear_intercept_um,
                    )
                    for line in metrics.lines
                ],
            )
        )

    analysis_result = AnalysisResult(
        animal_id=request.animal_id,
        generated_at=datetime.utcnow().isoformat() + 'Z',
        images=image_results,
    )
    state_manager.record_analysis(analysis_result)

    return AnalysisResultModel.model_validate(asdict(analysis_result))


@app.get('/results', response_model=List[AnalysisResultModel])
async def get_results() -> List[AnalysisResultModel]:
    results = state_manager.get_results()
    return [AnalysisResultModel.model_validate(asdict(result)) for result in results]


@app.post('/results/clear', response_model=ClearResultsResponseModel)
async def clear_results_endpoint() -> ClearResultsResponseModel:
    state_manager.clear_results()
    return ClearResultsResponseModel(success=True)


@app.get('/export')
async def export_results() -> StreamingResponse:
    results = state_manager.get_results()
    workbook_stream = export_results_to_excel(results)
    filename = f'mli-results-{datetime.utcnow().strftime("%Y%m%d-%H%M%S")}.xlsx'
    response = StreamingResponse(
        workbook_stream,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@app.patch('/images/move', response_model=MoveImageResponseModel)
async def move_image(request: MoveImageRequestModel) -> MoveImageResponseModel:
    if request.from_animal_id == request.to_animal_id:
        return MoveImageResponseModel(success=True, image_id=request.image_id, animal_id=request.to_animal_id)

    state_manager.ensure_animal(request.to_animal_id)
    record = state_manager.move_image(request.image_id, request.to_animal_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Image not found')
    return MoveImageResponseModel(success=True, image_id=record.image_id, animal_id=record.animal_id)


@app.delete('/images/{image_id}', response_model=DeleteImageResponseModel)
async def delete_image(image_id: str) -> DeleteImageResponseModel:
    record = state_manager.remove_image(image_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Image not found')

    path = Path(record.stored_path)
    if not path.is_absolute():
        path = BASE_DIR / path
    path.unlink(missing_ok=True)

    return DeleteImageResponseModel(success=True, image_id=image_id)


@app.post('/analyze/preview', response_model=AnalysisImageResultModel)
async def analyze_preview(request: PreviewAnalysisRequestModel) -> AnalysisImageResultModel:
    images = state_manager.get_images_for_animal(request.animal_id)
    if not images:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='No images found for this animal')

    image_lookup = {image.image_id: (index, image) for index, image in enumerate(images)}
    lookup_entry = image_lookup.get(request.image_id)
    if lookup_entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Image not found for this animal')

    image_index, image_record = lookup_entry
    image_path = Path(image_record.stored_path)
    if not image_path.is_absolute():
        image_path = BASE_DIR / image_path
    if not image_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f'Image not found on disk: {image_path}')

    config_data = AnalysisConfigData(**request.config.dict())

    try:
        metrics = run_mli_analysis(image_path, config_data)
    except ImageProcessingError as error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error

    return AnalysisImageResultModel(
        image_id=image_record.image_id,
        image_number=image_index + 1,
        name=image_record.original_filename,
        average_mli_um=metrics.average_mli_um,
        processed_image_base64=metrics.processed_image_base64,
        threshold_image_base64=metrics.threshold_image_base64,
        lines=[
            LineResultModel(
                line_number=line.line_number,
                horizontal_intercepts=line.horizontal_intercepts,
                vertical_intercepts=line.vertical_intercepts,
                horizontal_length_um=line.horizontal_length_um,
                vertical_length_um=line.vertical_length_um,
                total_line_length_um=line.total_line_length_um,
                mean_linear_intercept_um=line.mean_linear_intercept_um,
            )
            for line in metrics.lines
        ],
    )
