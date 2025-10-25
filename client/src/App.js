import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';

import VoiceInterface from './components/VoiceInterface';
import ReportGenerator from './components/ReportGenerator';
import Navigation from './components/Navigation';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
  },
});

function App() {
  const [currentPage, setCurrentPage] = useState('voice');

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
          <Navigation currentPage={currentPage} setCurrentPage={setCurrentPage} />
          
          <Routes>
            <Route 
              path="/" 
              element={
                <VoiceInterface 
                  onPageChange={setCurrentPage}
                />
              } 
            />
            <Route 
              path="/report" 
              element={
                <ReportGenerator 
                  onPageChange={setCurrentPage}
                />
              } 
            />
          </Routes>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
