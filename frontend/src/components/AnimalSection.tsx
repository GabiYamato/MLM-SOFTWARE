import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import type { Animal, UploadedImage } from '../types';

export type AnimalSectionProps = {
  animal: Animal;
  images: UploadedImage[];
  allAnimals: Animal[];
  onUpload: (files: File[]) => void;
  onDeleteImage: (imageId: string) => void;
  onMoveImage: (imageId: string, newAnimalId: string) => void;
};

const getStatusColor = (status: UploadedImage['status']) => {
  switch (status) {
    case 'uploaded':
      return 'success';
    case 'uploading':
      return 'info';
    case 'failed':
      return 'error';
    default:
      return 'default';
  }
};

export const AnimalSection = ({ animal, images, allAnimals, onUpload, onDeleteImage, onMoveImage }: AnimalSectionProps) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) {
        return;
      }
      onUpload(acceptedFiles);
    },
    [onUpload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardHeader title={animal.label} subheader={new Date(animal.createdAt).toLocaleString()} />
      <CardContent>
        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'divider',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: isDragActive ? 'action.hover' : 'background.paper',
            transition: 'border-color 0.2s ease',
          }}
        >
          <input {...getInputProps()} />
          <CloudUploadIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
          <Typography variant="body1" sx={{ mt: 1 }}>
            Drag & drop histology images here, or click to browse
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Supports JPEG, PNG, and TIFF formats
          </Typography>
        </Box>

        <List dense sx={{ mt: 2 }}>
          {images.map((image) => (
            <ListItem key={image.id} sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', mb: 1 }}>
              <ListItemText
                primary={image.name}
                secondary={`Size: ${(image.size / 1024).toFixed(1)} KB • Status: ${image.status}`}
              />
              <Chip
                label={image.status}
                color={getStatusColor(image.status)}
                variant={image.status === 'pending' ? 'outlined' : 'filled'}
                size="small"
                sx={{ mr: 2, textTransform: 'capitalize' }}
              />
              <Select
                size="small"
                value={image.animalId}
                onChange={(event) => onMoveImage(image.id, event.target.value)}
                sx={{ mr: 2, width: 140 }}
              >
                {allAnimals.map((candidate) => (
                  <MenuItem key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </MenuItem>
                ))}
              </Select>
              <ListItemSecondaryAction>
                <Tooltip title="Remove image">
                  <IconButton edge="end" onClick={() => onDeleteImage(image.id)}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
          {!images.length && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No images uploaded yet.
            </Typography>
          )}
        </List>
      </CardContent>
    </Card>
  );
};
