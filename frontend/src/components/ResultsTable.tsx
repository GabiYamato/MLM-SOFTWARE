import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { AnalysisResult } from '../types';

export type ResultsTableProps = {
  results: AnalysisResult[] | undefined;
  isLoading: boolean;
};

type TableRow = {
  id: string;
  animalId: string;
  imageNumber: number;
  lineNumber: number | string;
  horizontalIntercepts: number | null;
  verticalIntercepts: number | null;
  totalLineLengthUm: number | null;
  meanLinearInterceptUm: number | null;
  isAverage: boolean;
};

export const ResultsTable = ({ results, isLoading }: ResultsTableProps) => {
  if (isLoading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1">Loading results...</Typography>
      </Paper>
    );
  }

  if (!results?.length) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1">No analysis results yet. Run the analysis to populate this table.</Typography>
      </Paper>
    );
  }

  const animalIndexLookup = new Map<string, number>();
  results.forEach((result, index) => {
    animalIndexLookup.set(result.animal_id, index + 1);
  });

  const rows: TableRow[] = results.flatMap((result) =>
    result.images.flatMap((image) => [
      ...image.lines.map((line) => ({
        id: `${result.animal_id}-${image.image_id}-line-${line.line_number}`,
        animalId: `Animal ${animalIndexLookup.get(result.animal_id) ?? result.animal_id}`,
        imageNumber: image.image_number,
        lineNumber: line.line_number,
        horizontalIntercepts: line.horizontal_intercepts,
        verticalIntercepts: line.vertical_intercepts,
        totalLineLengthUm: line.total_line_length_um,
        meanLinearInterceptUm: line.mean_linear_intercept_um,
        isAverage: false,
      })),
      {
        id: `${result.animal_id}-${image.image_id}-average`,
        animalId: `Animal ${animalIndexLookup.get(result.animal_id) ?? result.animal_id}`,
        imageNumber: image.image_number,
        lineNumber: 'Avg',
        horizontalIntercepts: null,
        verticalIntercepts: null,
        totalLineLengthUm: null,
        meanLinearInterceptUm: image.average_mli_um,
        isAverage: true,
      },
    ]),
  );

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Animal</TableCell>
            <TableCell align="right">Image #</TableCell>
            <TableCell align="right">Line #</TableCell>
            <TableCell align="right">Horizontal Intercepts</TableCell>
            <TableCell align="right">Vertical Intercepts</TableCell>
            <TableCell align="right">Total Line Length (µm)</TableCell>
            <TableCell align="right">MLI (µm)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} hover>
              <TableCell>{row.animalId}</TableCell>
              <TableCell align="right">{row.imageNumber}</TableCell>
              <TableCell align="right">{row.lineNumber}</TableCell>
              <TableCell align="right">
                {row.horizontalIntercepts !== null ? row.horizontalIntercepts : row.isAverage ? '—' : 0}
              </TableCell>
              <TableCell align="right">
                {row.verticalIntercepts !== null ? row.verticalIntercepts : row.isAverage ? '—' : 0}
              </TableCell>
              <TableCell align="right">
                {typeof row.totalLineLengthUm === 'number' ? row.totalLineLengthUm.toFixed(2) : row.isAverage ? '—' : '0.00'}
              </TableCell>
              <TableCell align="right">
                {typeof row.meanLinearInterceptUm === 'number' ? row.meanLinearInterceptUm.toFixed(2) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Box sx={{ p: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Each row captures a horizontal/vertical pair for one grid line. Use the Excel export for archiving or additional statistics.
        </Typography>
      </Box>
    </TableContainer>
  );
};
