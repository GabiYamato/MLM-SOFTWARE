export type AnalysisConfig = {
  scaleUmPerPixel: number;
  horizontalLineLengthUm: number;
  verticalLineLengthUm: number;
  nLinesHorizontal: number;
  nLinesVertical: number;
  sigmaDenoise: number;
  minArea: number;
  magnification: string;
};

export const defaultAnalysisConfig: AnalysisConfig = {
  scaleUmPerPixel: 0.5,
  horizontalLineLengthUm: 432,
  verticalLineLengthUm: 571,
  nLinesHorizontal: 5,
  nLinesVertical: 5,
  sigmaDenoise: 1.0,
  minArea: 450,
  magnification: '200X',
};

export type Animal = {
  id: string;
  label: string;
  createdAt: string;
};

export type UploadedImage = {
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  animalId: string;
  uploadedAt?: string;
  errorMessage?: string;
};

export type ImageUploadResponse = {
  image_id: string;
  filename: string;
  size: number;
  stored_path: string;
  animal_id: string;
};

export type LineResult = {
  line_number: number;
  horizontal_intercepts: number;
  vertical_intercepts: number;
  horizontal_length_um: number;
  vertical_length_um: number;
  total_line_length_um: number;
  mean_linear_intercept_um: number | null;
};

export type AnalysisImage = {
  image_id: string;
  image_number: number;
  name: string;
  average_mli_um: number | null;
  processed_image_base64: string;
  threshold_image_base64: string;
  lines: LineResult[];
};

export type AnalysisResult = {
  animal_id: string;
  generated_at?: string;
  images: AnalysisImage[];
};
