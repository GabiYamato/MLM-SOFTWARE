import { Button, Stack, TextField, Typography } from '@mui/material';
import type { AnalysisConfig } from '../types';

export type ConfigPanelProps = {
  config: AnalysisConfig;
  onChange: <K extends keyof AnalysisConfig>(key: K, value: AnalysisConfig[K]) => void;
  onReset: () => void;
  disabled?: boolean;
  resetLabel?: string;
};

const numericFields: Array<{ key: keyof AnalysisConfig; label: string; type: 'number' | 'text'; step?: number }> = [
  { key: 'scaleUmPerPixel', label: 'Scale (µm/pixel)', type: 'number', step: 0.01 },
  { key: 'horizontalLineLengthUm', label: 'Horizontal Line Length (µm)', type: 'number', step: 1 },
  { key: 'verticalLineLengthUm', label: 'Vertical Line Length (µm)', type: 'number', step: 1 },
  { key: 'nLinesHorizontal', label: 'Horizontal Lines', type: 'number', step: 1 },
  { key: 'nLinesVertical', label: 'Vertical Lines', type: 'number', step: 1 },
  { key: 'sigmaDenoise', label: 'Gaussian Sigma', type: 'number', step: 0.1 },
  { key: 'minArea', label: 'Min Tissue Area (px²)', type: 'number', step: 10 },
  { key: 'magnification', label: 'Magnification', type: 'text' },
];

export const ConfigPanel = ({ config, onChange, onReset, disabled, resetLabel }: ConfigPanelProps) => (
  <Stack spacing={2} sx={{ width: '100%' }}>
    <Typography variant="h6" fontWeight={600}>
      Analysis Parameters
    </Typography>
    {numericFields.map(({ key, label, type, step }) => (
      <TextField
        key={key}
        label={label}
        type={type}
        size="small"
        value={config[key]}
        onChange={(event) => {
          const value = type === 'number' ? Number(event.target.value) : event.target.value;
          onChange(key, value as AnalysisConfig[typeof key]);
        }}
        inputProps={type === 'number' ? { step } : undefined}
        disabled={disabled}
      />
    ))}
    <Typography variant="caption" color="text.secondary">
      Grid spacing is now auto-calculated from image dimensions and line counts.
    </Typography>
    <Button variant="outlined" onClick={onReset} disabled={disabled}>
      {resetLabel ?? 'Reset to Defaults'}
    </Button>
  </Stack>
);
