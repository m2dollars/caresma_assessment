import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Navigation = ({ currentPage, setCurrentPage }) => {
  const navigate = useNavigate();

  const handleNavigation = (page) => {
    setCurrentPage(page);
    navigate(page === 'voice' ? '/' : `/${page}`);
  };

  return (
    <AppBar position="static" sx={{ mb: 4 }}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          🧠 Dementia Detection AI
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            color="inherit"
            onClick={() => handleNavigation('voice')}
            variant={currentPage === 'voice' ? 'outlined' : 'text'}
          >
            Voice Assessment
          </Button>
          <Button
            color="inherit"
            onClick={() => handleNavigation('doctor')}
            variant={currentPage === 'doctor' ? 'outlined' : 'text'}
          >
            👨‍⚕️ AI Doctor
          </Button>
          <Button
            color="inherit"
            onClick={() => handleNavigation('report')}
            variant={currentPage === 'report' ? 'outlined' : 'text'}
          >
            Report Generator
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navigation;
