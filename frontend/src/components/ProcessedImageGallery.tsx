import { Box, Button, Card, CardActions, CardContent, CardHeader, Grid, Stack, Typography } from '@mui/material';
import type { AnalysisImage, AnalysisResult } from '../types';

export type ProcessedImageGalleryProps = {
  results: AnalysisResult[] | undefined;
  onPreviewRequest?: (payload: { animalId: string; animalLabel: string; image: AnalysisImage }) => void;
};

export const ProcessedImageGallery = ({ results, onPreviewRequest }: ProcessedImageGalleryProps) => {
  if (!results?.length) {
    return null;
  }

  const animalIndexLookup = new Map<string, number>();
  results.forEach((result, index) => {
    animalIndexLookup.set(result.animal_id, index + 1);
  });

  const items = results.flatMap((result) =>
    result.images.map((image) => ({
      key: `${result.animal_id}-${image.image_id}`,
      animalLabel: `Animal ${animalIndexLookup.get(result.animal_id) ?? result.animal_id}`,
      imageNumber: image.image_number,
      imageName: image.name,
      averageMli: image.average_mli_um,
  processedBase64: image.processed_image_base64,
  thresholdBase64: image.threshold_image_base64,
      lineCount: image.lines.length,
      animalId: result.animal_id,
      data: image,
    })),
  );

  return (
    <Grid container spacing={3}>
      {items.map((item) => (
        <Grid item xs={12} md={6} lg={4} key={item.key}>
          <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
            <CardHeader title={`${item.animalLabel} – Image ${item.imageNumber}`} subheader={item.imageName} />
            <CardContent>
              <Stack spacing={2}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Original + overlay
                  </Typography>
                  <Box
                    component="img"
                    sx={{ width: '100%', maxHeight: 240, objectFit: 'contain', bgcolor: 'black', borderRadius: 1 }}
                    src={`data:image/png;base64,${item.processedBase64}`}
                    alt={`Processed grid overlay for ${item.animalLabel}, image ${item.imageNumber} (${item.imageName})`}
                  />
                </Stack>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Thresholded + overlay
                  </Typography>
                  <Box
                    component="img"
                    sx={{ width: '100%', maxHeight: 240, objectFit: 'contain', bgcolor: 'black', borderRadius: 1 }}
                    src={`data:image/png;base64,${item.thresholdBase64}`}
                    alt={`Threshold overlay for ${item.animalLabel}, image ${item.imageNumber} (${item.imageName})`}
                  />
                </Stack>
              </Stack>
              <Stack spacing={1} sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Overlay shows horizontal lines in orange, vertical lines in green, and intercept markers as bright crosshairs.
                </Typography>
                <Typography variant="subtitle2">
                  Lines processed: {item.lineCount} • Average MLI:{' '}
                  {typeof item.averageMli === 'number' ? `${item.averageMli.toFixed(2)} µm` : '—'}
                </Typography>
              </Stack>
            </CardContent>
            {onPreviewRequest ? (
              <CardActions>
                <Button size="small" onClick={() => onPreviewRequest({ animalId: item.animalId, animalLabel: item.animalLabel, image: item.data })}>
                  Tune Parameters
                </Button>
              </CardActions>
            ) : null}
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};
