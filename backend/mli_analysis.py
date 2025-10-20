from __future__ import annotations

import base64
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

import cv2
import numpy as np
from skimage import filters, morphology
from skimage.draw import line as draw_line


@dataclass
class AnalysisConfigData:
    scale_um_per_pixel: float
    line_length_um_horizontal: float
    line_length_um_vertical: float
    n_lines_horizontal: int
    n_lines_vertical: int
    sigma_denoise: float
    min_area: int
    magnification: str


@dataclass
class LineMetrics:
    line_number: int
    horizontal_intercepts: int
    vertical_intercepts: int
    horizontal_length_um: float
    vertical_length_um: float
    total_line_length_um: float
    mean_linear_intercept_um: float | None


@dataclass
class MLIImageMetrics:
    lines: List[LineMetrics]
    average_mli_um: float | None
    processed_image_base64: str
    threshold_image_base64: str


class ImageProcessingError(Exception):
    """Raised when an image cannot be processed."""


def _load_image_and_mask(path: Path, config: AnalysisConfigData) -> Tuple[np.ndarray, np.ndarray]:
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise ImageProcessingError(f'Unable to read image at {path}')

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    if config.sigma_denoise > 0:
        gray = cv2.GaussianBlur(gray, (0, 0), config.sigma_denoise)

    threshold = filters.threshold_otsu(gray)
    tissue_mask = gray < threshold

    if config.min_area > 0:
        tissue_mask = morphology.remove_small_objects(tissue_mask, min_size=config.min_area)

    return image, tissue_mask.astype(np.uint8)


def _auto_positions(length: int, count: int) -> List[int]:
    if count <= 0:
        return []
    step = length / (count + 1)
    return [int(round(step * (index + 1))) for index in range(count)]


def _count_intercepts(samples: np.ndarray) -> Tuple[int, np.ndarray]:
    if samples.size == 0:
        return 0, np.array([], dtype=np.int32)
    active = samples > 0
    transitions = np.diff(active.astype(np.int8))
    indices = np.where(transitions != 0)[0] + 1
    return int(indices.size), indices


def _encode_image_to_base64(image: np.ndarray) -> str:
    success, buffer = cv2.imencode('.png', image)
    if not success:
        raise ImageProcessingError('Unable to encode processed image to PNG')
    return base64.b64encode(buffer).decode('ascii')


def _draw_intercept_marker(canvas: np.ndarray, point: Tuple[int, int]) -> None:
    cv2.circle(canvas, point, 8, (40, 40, 40), 3, lineType=cv2.LINE_AA)
    cv2.drawMarker(
        canvas,
        point,
        (0, 255, 255),
        markerType=cv2.MARKER_TILTED_CROSS,
        markerSize=30,
        thickness=3,
        line_type=cv2.LINE_AA,
    )
    cv2.circle(canvas, point, 4, (255, 0, 255), -1, lineType=cv2.LINE_AA)


def run_mli_analysis(path: Path, config: AnalysisConfigData) -> MLIImageMetrics:
    image, mask = _load_image_and_mask(path, config)
    height, width = mask.shape

    horizontal_positions = _auto_positions(height, config.n_lines_horizontal)
    vertical_positions = _auto_positions(width, config.n_lines_vertical)

    original_overlay = image.copy()
    mask_visual = (mask * 255).astype(np.uint8)
    threshold_overlay = cv2.cvtColor(mask_visual, cv2.COLOR_GRAY2BGR)

    horizontal_data: List[dict] = []
    for y in horizontal_positions:
        start_x = 0
        end_x = width - 1
        rr, cc = draw_line(y, start_x, y, end_x)
        intercepts, intercept_indices = _count_intercepts(mask[rr, cc])
        length_um = config.line_length_um_horizontal
        points = [(int(cc[i]), int(rr[i])) for i in intercept_indices]
        cv2.line(original_overlay, (start_x, y), (end_x, y), (0, 176, 255), 3, cv2.LINE_AA)
        cv2.line(threshold_overlay, (start_x, y), (end_x, y), (0, 176, 255), 3, cv2.LINE_AA)
        for point in points:
            _draw_intercept_marker(original_overlay, point)
            _draw_intercept_marker(threshold_overlay, point)
        horizontal_data.append({'intercepts': intercepts, 'length_um': length_um})

    vertical_data: List[dict] = []
    for x in vertical_positions:
        start_y = 0
        end_y = height - 1
        rr, cc = draw_line(start_y, x, end_y, x)
        intercepts, intercept_indices = _count_intercepts(mask[rr, cc])
        length_um = config.line_length_um_vertical
        points = [(int(cc[i]), int(rr[i])) for i in intercept_indices]
        cv2.line(original_overlay, (x, start_y), (x, end_y), (76, 255, 0), 3, cv2.LINE_AA)
        cv2.line(threshold_overlay, (x, start_y), (x, end_y), (76, 255, 0), 3, cv2.LINE_AA)
        for point in points:
            _draw_intercept_marker(original_overlay, point)
            _draw_intercept_marker(threshold_overlay, point)
        vertical_data.append({'intercepts': intercepts, 'length_um': length_um})

    lines: List[LineMetrics] = []
    line_count = max(len(horizontal_data), len(vertical_data))
    for idx in range(line_count):
        horizontal = horizontal_data[idx] if idx < len(horizontal_data) else None
        vertical = vertical_data[idx] if idx < len(vertical_data) else None

        horizontal_intercepts = horizontal['intercepts'] if horizontal else 0
        vertical_intercepts = vertical['intercepts'] if vertical else 0
        horizontal_length_um = horizontal['length_um'] if horizontal else 0.0
        vertical_length_um = vertical['length_um'] if vertical else 0.0

        total_line_length_um = horizontal_length_um + vertical_length_um
        total_intercepts = horizontal_intercepts + vertical_intercepts
        line_mli = total_line_length_um / total_intercepts if total_intercepts else None

        lines.append(
            LineMetrics(
                line_number=idx + 1,
                horizontal_intercepts=horizontal_intercepts,
                vertical_intercepts=vertical_intercepts,
                horizontal_length_um=horizontal_length_um,
                vertical_length_um=vertical_length_um,
                total_line_length_um=total_line_length_um,
                mean_linear_intercept_um=line_mli,
            )
        )

    valid_mli = [line.mean_linear_intercept_um for line in lines if line.mean_linear_intercept_um is not None]
    average_mli = float(np.mean(valid_mli)) if valid_mli else None

    processed_image_base64 = _encode_image_to_base64(original_overlay)
    threshold_image_base64 = _encode_image_to_base64(threshold_overlay)

    return MLIImageMetrics(
        lines=lines,
        average_mli_um=average_mli,
        processed_image_base64=processed_image_base64,
        threshold_image_base64=threshold_image_base64,
    )
