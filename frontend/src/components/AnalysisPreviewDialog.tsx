import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { ConfigPanel } from './ConfigPanel';
import type { AnalysisConfig, AnalysisImage } from '../types';
import { previewAnalysis } from '../api/mli';

export type AnalysisPreviewDialogProps = {
  open: boolean;
  onClose: () => void;
  animalLabel: string;
  animalId: string;
  image: AnalysisImage | undefined;
  baseConfig: AnalysisConfig;
};

export const AnalysisPreviewDialog = ({
  open,
  onClose,
  animalLabel,
  animalId,
  image,
  baseConfig,
}: AnalysisPreviewDialogProps) => {
  const [localConfig, setLocalConfig] = useState<AnalysisConfig>(baseConfig);

  const { mutate, data, isPending, reset } = useMutation({
    mutationFn: (config: AnalysisConfig) => {
      if (!image) {
        throw new Error('No image selected');
      }
      return previewAnalysis({ animalId, imageId: image.image_id, config });
    },
  });

  useEffect(() => {
    if (!open || !image) {
      return;
    }
    setLocalConfig(baseConfig);
    reset();
  }, [open, image?.image_id, baseConfig, reset]);

  useEffect(() => {
    if (!open || !image) {
      return;
    }
    const handle = window.setTimeout(() => {
      mutate(localConfig);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [open, image?.image_id, localConfig, mutate]);

  const preview = data ?? image;

  const averageMli = useMemo(() => {
    if (!preview?.average_mli_um || Number.isNaN(preview.average_mli_um)) {
      return '—';
    }
    return `${preview.average_mli_um.toFixed(2)} µm`;
  }, [preview]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{animalLabel ? `${animalLabel} – Parameter Tuning` : 'Parameter Tuning'}</DialogTitle>
      <DialogContent dividers>
        {image ? (
          <Grid container spacing={4} alignItems="flex-start">
            <Grid item xs={12} md={5}>
              <ConfigPanel
                config={localConfig}
                onChange={(key, value) => setLocalConfig((prev) => ({ ...prev, [key]: value }))}
                onReset={() => setLocalConfig(baseConfig)}
                disabled={isPending}
                resetLabel="Reset to Original Run"
              />
            </Grid>
            <Grid item xs={12} md={7}>
              <Stack spacing={2}>
                <Box sx={{ position: 'relative' }}>
                  {isPending && (
                    <Stack
                      spacing={1}
                      alignItems="center"
                      justifyContent="center"
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'rgba(0,0,0,0.5)',
                        zIndex: 1,
                        borderRadius: 2,
                      }}
                    >
                      <CircularProgress size={36} color="inherit" />
                      <Typography variant="body2" color="white">
                        Updating preview…
                      </Typography>
                    </Stack>
                  )}
                  <Stack spacing={2} sx={{ borderRadius: 2, p: 1, bgcolor: 'background.paper' }}>
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        Original + overlay
                      </Typography>
                      <Box
                        component="img"
                        src={`data:image/png;base64,${preview?.processed_image_base64 ?? ''}`}
                        alt={preview ? `Original overlay preview for ${animalLabel}` : 'Original overlay preview'}
                        sx={{ width: '100%', maxHeight: 260, objectFit: 'contain', bgcolor: 'black', borderRadius: 1 }}
                      />
                    </Stack>
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        Thresholded + overlay
                      </Typography>
                      <Box
                        component="img"
                        src={`data:image/png;base64,${preview?.threshold_image_base64 ?? ''}`}
                        alt={preview ? `Threshold overlay preview for ${animalLabel}` : 'Threshold overlay preview'}
                        sx={{ width: '100%', maxHeight: 260, objectFit: 'contain', bgcolor: 'black', borderRadius: 1 }}
                      />
                    </Stack>
                  </Stack>
                </Box>
                <Divider />
                <Typography variant="subtitle1">Average MLI: {averageMli}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Preview updates automatically as parameters change. Horizontal lines span the full width; vertical lines span the full height.
                </Typography>
              </Stack>
            </Grid>
          </Grid>
        ) : (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body1">No image selected for preview.</Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};
