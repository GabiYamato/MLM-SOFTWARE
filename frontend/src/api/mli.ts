import { apiClient } from './client';
import type { AnalysisConfig, AnalysisImage, AnalysisResult, ImageUploadResponse } from '../types';

export const uploadImages = async (params: {
  animalId: string;
  files: File[];
  config: AnalysisConfig;
}) => {
  const formData = new FormData();
  formData.append('animal_id', params.animalId);
  params.files.forEach((file) => formData.append('images', file));

  const entries: Array<[keyof AnalysisConfig, string]> = [
    ['scaleUmPerPixel', params.config.scaleUmPerPixel.toString()],
    ['horizontalLineLengthUm', params.config.horizontalLineLengthUm.toString()],
    ['verticalLineLengthUm', params.config.verticalLineLengthUm.toString()],
    ['nLinesHorizontal', params.config.nLinesHorizontal.toString()],
    ['nLinesVertical', params.config.nLinesVertical.toString()],
    ['sigmaDenoise', params.config.sigmaDenoise.toString()],
    ['minArea', params.config.minArea.toString()],
    ['magnification', params.config.magnification],
  ];

  entries.forEach(([key, value]) => formData.append(key, value));

  const { data } = await apiClient.post<{ uploads: ImageUploadResponse[] }>('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return data.uploads;
};

export const analyzeAnimal = async (animalId: string, config: AnalysisConfig) => {
  const payload = {
    animal_id: animalId,
    config: {
      scale_um_per_pixel: config.scaleUmPerPixel,
      line_length_um_horizontal: config.horizontalLineLengthUm,
      line_length_um_vertical: config.verticalLineLengthUm,
      n_lines_horizontal: config.nLinesHorizontal,
      n_lines_vertical: config.nLinesVertical,
      sigma_denoise: config.sigmaDenoise,
      min_area: config.minArea,
      magnification: config.magnification,
    },
  };

  const { data } = await apiClient.post<AnalysisResult>('/analyze', payload);
  return data;
};

export const fetchResults = async () => {
  const { data } = await apiClient.get<AnalysisResult[]>('/results');
  return data;
};

export const clearResults = async () => {
  const { data } = await apiClient.post<{ success: boolean }>('/results/clear');
  return data;
};

export const exportExcel = async () => {
  const response = await apiClient.get('/export', {
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const previewAnalysis = async (params: { animalId: string; imageId: string; config: AnalysisConfig }) => {
  const payload = {
    animal_id: params.animalId,
    image_id: params.imageId,
    config: {
      scale_um_per_pixel: params.config.scaleUmPerPixel,
      line_length_um_horizontal: params.config.horizontalLineLengthUm,
      line_length_um_vertical: params.config.verticalLineLengthUm,
      n_lines_horizontal: params.config.nLinesHorizontal,
      n_lines_vertical: params.config.nLinesVertical,
      sigma_denoise: params.config.sigmaDenoise,
      min_area: params.config.minArea,
      magnification: params.config.magnification,
    },
  };

  const { data } = await apiClient.post<AnalysisImage>('/analyze/preview', payload);
  return data;
};

export const moveImage = async (params: { imageId: string; fromAnimalId: string; toAnimalId: string }) => {
  const { data } = await apiClient.patch<{ success: boolean; image_id: string; animal_id: string }>(
    '/images/move',
    {
      image_id: params.imageId,
      from_animal_id: params.fromAnimalId,
      to_animal_id: params.toAnimalId,
    },
  );

  return data;
};

export const deleteImage = async (imageId: string) => {
  const { data } = await apiClient.delete<{ success: boolean; image_id: string }>(`/images/${imageId}`);
  return data;
};
