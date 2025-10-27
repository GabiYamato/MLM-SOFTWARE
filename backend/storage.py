from __future__ import annotations

import json
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class ImageRecord:
    image_id: str
    animal_id: str
    original_filename: str
    stored_path: str
    size: int
    uploaded_at: str


@dataclass
class AnimalRecord:
    animal_id: str
    created_at: str


@dataclass
class LineResult:
    line_number: int
    horizontal_intercepts: int
    vertical_intercepts: int
    horizontal_length_um: float
    vertical_length_um: float
    total_line_length_um: float
    mean_linear_intercept_um: float | None


@dataclass
class AnalysisImageResult:
    image_id: str
    image_number: int
    name: str
    average_mli_um: float | None
    processed_image_base64: str
    threshold_image_base64: str
    lines: List[LineResult] = field(default_factory=list)


@dataclass
class AnalysisResult:
    animal_id: str
    generated_at: str
    images: List[AnalysisImageResult]


class StateManager:
    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir
        self.state_path = self.base_dir / 'state.json'
        self.lock = threading.Lock()
        self._state = self._load()

    def _load(self) -> Dict[str, Dict[str, object]]:
        if not self.state_path.exists():
            return {'animals': {}, 'images': {}, 'results': {}}
        with self.state_path.open('r', encoding='utf-8') as handle:
            return json.load(handle)

    def _save(self) -> None:
        with self.state_path.open('w', encoding='utf-8') as handle:
            json.dump(self._state, handle, ensure_ascii=False, indent=2)

    def ensure_animal(self, animal_id: str) -> AnimalRecord:
        with self.lock:
            animals: Dict[str, Dict[str, str]] = self._state['animals']  # type: ignore[assignment]
            if animal_id not in animals:
                record = AnimalRecord(animal_id=animal_id, created_at=datetime.utcnow().isoformat())
                animals[animal_id] = asdict(record)
                self._save()
            return AnimalRecord(**animals[animal_id])

    def add_image(self, animal_id: str, filename: str, stored_path: Path, size: int) -> ImageRecord:
        with self.lock:
            images: Dict[str, Dict[str, object]] = self._state['images']  # type: ignore[assignment]
            image_id = uuid.uuid4().hex
            record = ImageRecord(
                image_id=image_id,
                animal_id=animal_id,
                original_filename=filename,
                stored_path=str(stored_path),
                size=size,
                uploaded_at=datetime.utcnow().isoformat(),
            )
            images[image_id] = asdict(record)
            self._save()
            return record

    def remove_image(self, image_id: str) -> Optional[ImageRecord]:
        with self.lock:
            images: Dict[str, Dict[str, object]] = self._state['images']  # type: ignore[assignment]
            record_dict = images.pop(image_id, None)
            if record_dict is None:
                return None
            self._save()
            return ImageRecord(**record_dict)  # type: ignore[arg-type]

    def move_image(self, image_id: str, to_animal_id: str) -> Optional[ImageRecord]:
        with self.lock:
            images: Dict[str, Dict[str, object]] = self._state['images']  # type: ignore[assignment]
            record_dict = images.get(image_id)
            if record_dict is None:
                return None
            record_dict['animal_id'] = to_animal_id
            record_dict['uploaded_at'] = record_dict.get('uploaded_at') or datetime.utcnow().isoformat()
            images[image_id] = record_dict
            self._save()
            return ImageRecord(**record_dict)  # type: ignore[arg-type]

    def get_images_for_animal(self, animal_id: str) -> List[ImageRecord]:
        with self.lock:
            images: Dict[str, Dict[str, object]] = self._state['images']  # type: ignore[assignment]
            relevant = [ImageRecord(**record) for record in images.values() if record['animal_id'] == animal_id]
            relevant.sort(key=lambda record: record.uploaded_at)
            return relevant

    def record_analysis(self, result: AnalysisResult) -> None:
        with self.lock:
            results: Dict[str, Dict[str, object]] = self._state['results']  # type: ignore[assignment]
            results[result.animal_id] = {
                'animal_id': result.animal_id,
                'generated_at': result.generated_at,
                'images': [asdict(image) for image in result.images],
            }
            self._save()

    def _coerce_line(self, data: Dict[str, object], default_number: int = 0) -> LineResult:
        horizontal_length = float(data.get('horizontal_length_um', 0.0) or 0.0)
        vertical_length = float(data.get('vertical_length_um', 0.0) or 0.0)
        total_length = data.get('total_line_length_um')
        total_length_um = float(total_length) if total_length is not None else horizontal_length + vertical_length
        return LineResult(
            line_number=int(data.get('line_number', default_number)),
            horizontal_intercepts=int(data.get('horizontal_intercepts', 0)),
            vertical_intercepts=int(data.get('vertical_intercepts', 0)),
            horizontal_length_um=horizontal_length,
            vertical_length_um=vertical_length,
            total_line_length_um=total_length_um,
            mean_linear_intercept_um=(
                float(data['mean_linear_intercept_um'])
                if data.get('mean_linear_intercept_um') is not None
                else None
            ),
        )

    def clear_results(self) -> None:
        with self.lock:
            self._state['results'] = {}
            self._save()

    def get_results(self) -> List[AnalysisResult]:
        with self.lock:
            results: Dict[str, Dict[str, object]] = self._state['results']  # type: ignore[assignment]
            return [
                AnalysisResult(
                    animal_id=record['animal_id'],
                    generated_at=record.get('generated_at', datetime.utcnow().isoformat()),
                    images=[
                        AnalysisImageResult(
                            image_id=image.get('image_id', ''),
                            image_number=int(image.get('image_number', index + 1)),
                            name=image.get('name', ''),
                            average_mli_um=(
                                float(image['average_mli_um'])
                                if image.get('average_mli_um') is not None
                                else None
                            ),
                            processed_image_base64=image.get('processed_image_base64', ''),
                            threshold_image_base64=(
                                image.get('threshold_image_base64')
                                or image.get('processed_image_base64', '')
                            ),
                            lines=[
                                self._coerce_line(line, line_index + 1)
                                for line_index, line in enumerate(image.get('lines', []))
                            ],
                        )
                        for index, image in enumerate(record.get('images', []))
                    ],
                )
                for record in results.values()
            ]

    def get_result_for_animal(self, animal_id: str) -> Optional[AnalysisResult]:
        with self.lock:
            results: Dict[str, Dict[str, object]] = self._state['results']  # type: ignore[assignment]
            record = results.get(animal_id)
            if not record:
                return None
            return AnalysisResult(
                animal_id=record['animal_id'],
                generated_at=record.get('generated_at', datetime.utcnow().isoformat()),
                images=[
                    AnalysisImageResult(
                        image_id=image.get('image_id', ''),
                        image_number=int(image.get('image_number', index + 1)),
                        name=image.get('name', ''),
                        average_mli_um=(
                            float(image['average_mli_um']) if image.get('average_mli_um') is not None else None
                        ),
                        processed_image_base64=image.get('processed_image_base64', ''),
                        threshold_image_base64=(
                            image.get('threshold_image_base64')
                            or image.get('processed_image_base64', '')
                        ),
                        lines=[
                            self._coerce_line(line, line_index + 1)
                            for line_index, line in enumerate(image.get('lines', []))
                        ],
                    )
                    for index, image in enumerate(record.get('images', []))
                ],
            )