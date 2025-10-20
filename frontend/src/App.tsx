import { useCallback, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Container, Divider, Snackbar, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfigPanel } from './components/ConfigPanel';
import { AnimalSection } from './components/AnimalSection';
import { ResultsTable } from './components/ResultsTable';
import { ProcessedImageGallery } from './components/ProcessedImageGallery';
import { AnalysisPreviewDialog } from './components/AnalysisPreviewDialog';
import { useAnalysisConfig } from './hooks/useAnalysisConfig';
import type { AnalysisImage, Animal, UploadedImage } from './types';
import { analyzeAnimal, clearResults, deleteImage, exportExcel, fetchResults, moveImage, uploadImages } from './api/mli';

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11);

type SnackbarState = { message: string; severity: 'success' | 'error' | 'info' } | null;

const createAnimal = (index: number): Animal => ({
  id: `animal-${generateId()}`,
  label: `Animal #${index}`,
  createdAt: new Date().toISOString(),
});

const App = () => {
  const queryClient = useQueryClient();
  const [animals, setAnimals] = useState<Animal[]>(() => [createAnimal(1)]);
  const [imagesByAnimal, setImagesByAnimal] = useState<Record<string, UploadedImage[]>>(() => ({}));
  const [snackbar, setSnackbar] = useState<SnackbarState>(null);
  const [previewTarget, setPreviewTarget] = useState<
    | {
        animalId: string;
        animalLabel: string;
        image: AnalysisImage;
      }
    | null
  >(null);

  const { config, updateConfig, resetConfig } = useAnalysisConfig();

  const { data: results, isPending: resultsLoading } = useQuery({
    queryKey: ['results'],
    queryFn: fetchResults,
    refetchOnWindowFocus: false,
  });

  const analysisMutation = useMutation({
    mutationFn: async (animalIds: string[]) => {
      for (const animalId of animalIds) {
        await analyzeAnimal(animalId, config);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['results'] });
      setSnackbar({ message: 'MLI analysis complete.', severity: 'success' });
    },
    onError: () => {
      setSnackbar({ message: 'Analysis failed. Check server logs for details.', severity: 'error' });
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: clearResults,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['results'] });
      setSnackbar({ message: 'Analysis history cleared.', severity: 'info' });
    },
    onError: () => {
      setSnackbar({ message: 'Failed to clear history.', severity: 'error' });
    },
  });

  const handleAddAnimal = () => {
    setAnimals((prev) => {
      const nextIndex = prev.length + 1;
      const nextAnimal = createAnimal(nextIndex);
      return [...prev, nextAnimal];
    });
  };

  const handleUpload = useCallback(
    async (animalId: string, files: File[]) => {
      if (!files.length) {
        return;
      }

      const tempEntries = files.map<UploadedImage>((file) => ({
        id: generateId(),
        name: file.name,
        size: file.size,
        status: 'uploading',
        animalId,
      }));

      setImagesByAnimal((prev) => {
        const current = prev[animalId] ?? [];
        return { ...prev, [animalId]: [...current, ...tempEntries] };
      });

      try {
        const uploads = await uploadImages({ animalId, files, config });
        setImagesByAnimal((prev) => {
          const current = prev[animalId] ?? [];
          const updated = current.map((image) => {
            const tempIndex = tempEntries.findIndex((entry) => entry.id === image.id);
            if (tempIndex === -1) {
              return image;
            }
            const upload = uploads[tempIndex];
            return {
              id: upload.image_id,
              name: upload.filename,
              size: upload.size,
              status: 'uploaded',
              animalId: upload.animal_id,
              uploadedAt: new Date().toISOString(),
            } satisfies UploadedImage;
          });
          return { ...prev, [animalId]: updated };
        });
        setSnackbar({ message: `${files.length} file(s) uploaded`, severity: 'success' });
      } catch (error) {
        console.error(error);
        setImagesByAnimal((prev) => {
          const current = prev[animalId] ?? [];
          const updated = current.map((image) =>
            tempEntries.some((entry) => entry.id === image.id)
              ? ({ ...image, status: 'failed', errorMessage: 'Upload failed' } as UploadedImage)
              : image,
          );
          return { ...prev, [animalId]: updated };
        });
        setSnackbar({ message: 'Upload failed. Try again.', severity: 'error' });
      }
    },
    [config],
  );

  const handleDeleteImage = useCallback(async (animalId: string, imageId: string) => {
    let removedImage: UploadedImage | undefined;
    setImagesByAnimal((prev) => {
      const current = prev[animalId] ?? [];
      removedImage = current.find((image) => image.id === imageId);
      return { ...prev, [animalId]: current.filter((image) => image.id !== imageId) };
    });

    try {
      await deleteImage(imageId);
      setSnackbar({ message: 'Image removed.', severity: 'info' });
    } catch (error) {
      console.error(error);
      if (removedImage) {
        const restored = removedImage;
        setImagesByAnimal((prev) => {
          const current = prev[animalId] ?? [];
          return { ...prev, [animalId]: [...current, restored] };
        });
      }
      setSnackbar({ message: 'Unable to delete image on server.', severity: 'error' });
    }
  }, []);

  const handleMoveImage = useCallback(
    async (imageId: string, fromAnimalId: string, toAnimalId: string) => {
      if (fromAnimalId === toAnimalId) {
        return;
      }
      let movedImage: UploadedImage | undefined;
      setImagesByAnimal((prev) => {
        const source = prev[fromAnimalId] ?? [];
        const destination = prev[toAnimalId] ?? [];
        movedImage = source.find((image) => image.id === imageId);
        if (!movedImage) {
          return prev;
        }
        return {
          ...prev,
          [fromAnimalId]: source.filter((image) => image.id !== imageId),
          [toAnimalId]: [...destination, { ...movedImage, animalId: toAnimalId }],
        };
      });

      try {
        await moveImage({ imageId, fromAnimalId, toAnimalId });
        setSnackbar({ message: 'Image reassigned.', severity: 'success' });
      } catch (error) {
        console.error(error);
        if (movedImage) {
          const imageToRestore = movedImage;
          setImagesByAnimal((prev) => {
            const destination = prev[toAnimalId] ?? [];
            const source = prev[fromAnimalId] ?? [];
            return {
              ...prev,
              [toAnimalId]: destination.filter((image) => image.id !== imageId),
              [fromAnimalId]: [...source, imageToRestore],
            };
          });
        }
        setSnackbar({ message: 'Unable to move image on server.', severity: 'error' });
      }
    },
    [],
  );

  const handleRunAnalysis = useCallback(() => {
    const animalIds = animals
      .filter((animal) => (imagesByAnimal[animal.id]?.length ?? 0) > 0)
      .map((animal) => animal.id);
    if (!animalIds.length) {
      setSnackbar({ message: 'Upload at least one image before running analysis.', severity: 'info' });
      return;
    }
    analysisMutation.mutate(animalIds);
  }, [analysisMutation, animals, imagesByAnimal]);

  const handleExportExcel = useCallback(async () => {
    try {
      const blob = await exportExcel();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `mli-results-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSnackbar({ message: 'Excel exported.', severity: 'success' });
    } catch (error) {
      console.error(error);
      setSnackbar({ message: 'Excel export failed.', severity: 'error' });
    }
  }, []);

  const displayedAnimals = useMemo(() => animals.map((animal, index) => ({ ...animal, label: `Animal #${index + 1}` })), [animals]);
  const snackbarContent = snackbar ? <Alert severity={snackbar.severity}>{snackbar.message}</Alert> : undefined;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Mean Linear Intercept Analysis
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Upload lung histology images per specimen, configure analysis parameters, run the MLI computation, and export results.
          </Typography>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4} lg={3}>
            <ConfigPanel config={config} onChange={updateConfig} onReset={resetConfig} disabled={analysisMutation.isPending} />
            <Button variant="contained" fullWidth sx={{ mt: 3 }} onClick={handleAddAnimal} disabled={analysisMutation.isPending}>
              Add Animal
            </Button>
          </Grid>
          <Grid item xs={12} md={8} lg={9}>
            <Stack spacing={2}>
              {displayedAnimals.map((animal) => (
                <AnimalSection
                  key={animal.id}
                  animal={animal}
                  allAnimals={displayedAnimals}
                  images={imagesByAnimal[animal.id] ?? []}
                  onUpload={(files) => handleUpload(animal.id, files)}
                  onDeleteImage={(imageId) => handleDeleteImage(animal.id, imageId)}
                  onMoveImage={(imageId, newAnimalId) => handleMoveImage(imageId, animal.id, newAnimalId)}
                />
              ))}
              {!animals.length && (
                <Typography variant="body2" color="text.secondary">
                  Add an animal to start uploading images.
                </Typography>
              )}
            </Stack>
          </Grid>
        </Grid>

        <Divider />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleRunAnalysis}
            disabled={analysisMutation.isPending}
            startIcon={analysisMutation.isPending ? <CircularProgress size={18} /> : undefined}
          >
            {analysisMutation.isPending ? 'Analyzing…' : 'Run MLI Analysis'}
          </Button>
          <Button variant="outlined" onClick={handleExportExcel} disabled={analysisMutation.isPending}>
            Export Excel
          </Button>
          <Button
            variant="text"
            color="error"
            onClick={() => clearHistoryMutation.mutate()}
            disabled={analysisMutation.isPending || clearHistoryMutation.isPending}
          >
            {clearHistoryMutation.isPending ? 'Clearing…' : 'Clear History'}
          </Button>
        </Stack>

        <ResultsTable results={results} isLoading={resultsLoading} />

        {results?.length ? (
          <Stack spacing={1}>
            <Typography variant="h6">Processed Overlays</Typography>
            <ProcessedImageGallery
              results={results}
              onPreviewRequest={(payload) => setPreviewTarget(payload)}
            />
          </Stack>
        ) : null}
      </Stack>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbarContent}
      </Snackbar>

      <AnalysisPreviewDialog
        open={Boolean(previewTarget)}
        animalLabel={previewTarget?.animalLabel ?? ''}
        animalId={previewTarget?.animalId ?? ''}
        image={previewTarget?.image}
        baseConfig={config}
        onClose={() => setPreviewTarget(null)}
      />
    </Container>
  );
};

export default App;
