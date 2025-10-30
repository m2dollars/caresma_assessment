import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Chip,
  Paper,
  Divider,
  LinearProgress
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AssessmentIcon from '@mui/icons-material/Assessment';
import axios from 'axios';

const ReportGenerator = ({ onPageChange }) => {
  const [transcript, setTranscript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/plain') {
      setUploadedFile(file);
      const content = await file.text();
      setTranscript(content);
    } else {
      setError('Please upload a .txt file');
    }
  };

  const loadSampleTranscript = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/report/sample-transcript');
      setTranscript(response.data.transcript);
      setError(null);
    } catch (err) {
      setError('Failed to load sample transcript');
    }
  };

  const generateReport = async () => {
    if (!transcript.trim()) {
      setError('Please enter or upload a transcript');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:8000/api/report/generate', {
        transcript: transcript,
        session_id: `report_${Date.now()}`
      });

      setReport(response.data);
    } catch (err) {
      setError('Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8) return 'success';
    if (score >= 6) return 'warning';
    return 'error';
  };

  const getRiskColor = (risk) => {
    switch (risk.toLowerCase()) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      default: return 'default';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dementia Assessment Report Generator
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Upload a conversation transcript or enter text manually to generate a cognitive assessment report
        </Typography>
      </Box>

      {/* Input Section */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Input Transcript
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              component="label"
              sx={{ mr: 2 }}
            >
              Upload .txt File
              <input
                type="file"
                hidden
                accept=".txt"
                onChange={handleFileUpload}
              />
            </Button>
            
            <Button
              variant="outlined"
              onClick={loadSampleTranscript}
            >
              Load Sample Transcript
            </Button>
          </Box>

          {uploadedFile && (
            <Alert severity="success" sx={{ mb: 2 }}>
              File uploaded: {uploadedFile.name}
            </Alert>
          )}

          <TextField
            fullWidth
            multiline
            rows={8}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste your conversation transcript here, or upload a .txt file..."
            variant="outlined"
            sx={{ mb: 3 }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<AssessmentIcon />}
              onClick={generateReport}
              disabled={!transcript.trim() || isGenerating}
            >
              {isGenerating ? 'Generating Report...' : 'Generate Assessment Report'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading Indicator */}
      {isGenerating && (
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Analyzing Transcript...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Our AI is processing the conversation for cognitive indicators
            </Typography>
            <LinearProgress sx={{ mt: 2 }} />
          </CardContent>
        </Card>
      )}

      {/* Report Display */}
      {report && (
        <Box
          sx={{
            animation: 'reportFadeIn 0.5s ease-out',
            '@keyframes reportFadeIn': {
              from: { opacity: 0, transform: 'translateY(20px)' },
              to: { opacity: 1, transform: 'translateY(0)' }
            }
          }}
        >
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssessmentIcon />
                Cognitive Assessment Report
              </Typography>

              {/* Overall Risk Level */}
              <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
                <Typography variant="h6" gutterBottom>
                  Overall Risk Assessment
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip
                    label={`Risk Level: ${report.overall_risk}`}
                    color={getRiskColor(report.overall_risk)}
                    size="large"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Based on comprehensive cognitive analysis
                  </Typography>
                </Box>
              </Paper>

              {/* Individual Scores */}
              <Typography variant="h6" gutterBottom>
                Cognitive Domain Scores
              </Typography>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                {[
                  { name: 'Memory', score: report.memory_score, icon: '🧠' },
                  { name: 'Language', score: report.language_score, icon: '💬' },
                  { name: 'Attention', score: report.attention_score, icon: '👁️' },
                  { name: 'Executive Function', score: report.executive_score, icon: '⚙️' },
                  { name: 'Orientation', score: report.orientation_score, icon: '🧭' }
                ].map((domain, index) => (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ mb: 1 }}>
                        {domain.icon}
                      </Typography>
                      <Typography variant="h6" gutterBottom>
                        {domain.name}
                      </Typography>
                      <Chip
                        label={`${domain.score}/10`}
                        color={getScoreColor(domain.score)}
                        size="large"
                      />
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              <Divider sx={{ my: 3 }} />

              {/* Detailed Analysis */}
              <Typography variant="h6" gutterBottom>
                Detailed Analysis
              </Typography>
              <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {report.detailed_analysis}
                </Typography>
              </Paper>

              {/* Recommendations */}
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Recommendations
              </Typography>
              <Paper sx={{ p: 3, bgcolor: 'primary.light', color: 'white' }}>
                <Typography variant="body1">
                  {report.recommendations}
                </Typography>
              </Paper>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  onClick={() => window.print()}
                >
                  Print Report
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setReport(null);
                    setTranscript('');
                    setUploadedFile(null);
                  }}
                >
                  Generate New Report
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}
    </Container>
  );
};

export default ReportGenerator;
