from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field, validator


class AnalysisConfigModel(BaseModel):
    scale_um_per_pixel: float = Field(..., gt=0)
    line_length_um_horizontal: float = Field(..., gt=0)
    line_length_um_vertical: float = Field(..., gt=0)
    n_lines_horizontal: int = Field(..., ge=1)
    n_lines_vertical: int = Field(..., ge=1)
    sigma_denoise: float = Field(0, ge=0)
    min_area: int = Field(0, ge=0)
    magnification: str = Field(..., min_length=1, max_length=20)

    @validator('magnification')
    def strip_whitespace(cls, value: str) -> str:
        return value.strip()


class AnalyzeRequestModel(BaseModel):
    animal_id: str = Field(..., min_length=1)
    image_id: Optional[str] = Field(None, min_length=1)
    config: AnalysisConfigModel


class PreviewAnalysisRequestModel(BaseModel):
    animal_id: str = Field(..., min_length=1)
    image_id: str = Field(..., min_length=1)
    config: AnalysisConfigModel


class ImageUploadResponseModel(BaseModel):
    image_id: str
    filename: str
    size: int
    stored_path: str
    animal_id: str


class UploadResponseModel(BaseModel):
    uploads: List[ImageUploadResponseModel]


class LineResultModel(BaseModel):
    line_number: int
    horizontal_intercepts: int
    vertical_intercepts: int
    horizontal_length_um: float
    vertical_length_um: float
    total_line_length_um: float
    mean_linear_intercept_um: Optional[float]


class AnalysisImageResultModel(BaseModel):
    image_id: str
    image_number: int
    name: str
    average_mli_um: Optional[float]
    processed_image_base64: str
    threshold_image_base64: str
    lines: List[LineResultModel]


class AnalysisResultModel(BaseModel):
    animal_id: str
    generated_at: str
    images: List[AnalysisImageResultModel]


class MoveImageRequestModel(BaseModel):
    image_id: str
    from_animal_id: str
    to_animal_id: str


class DeleteImageResponseModel(BaseModel):
    success: bool
    image_id: str


class MoveImageResponseModel(BaseModel):
    success: bool
    image_id: str
    animal_id: str


class ClearResultsResponseModel(BaseModel):
    success: bool
