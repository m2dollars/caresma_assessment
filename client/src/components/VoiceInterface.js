import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Avatar,
  Paper
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';

const VoiceInterface = ({ onPageChange }) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [ws, setWs] = useState(null);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);

  useEffect(() => {
    // Initialize session
    const newSessionId = `session_${Date.now()}`;
    setSessionId(newSessionId);
    
    // Connect to WebSocket
    const websocket = new WebSocket(`ws://localhost:8000/ws/${newSessionId}`);
    websocket.binaryType = 'arraybuffer';
    
    websocket.onopen = () => {
      setIsConnected(true);
      setError(null);
    };
    
    websocket.onmessage = (event) => {
      try {
        // Check if it's binary data (audio)
        if (event.data instanceof ArrayBuffer) {
          const audioData = new Uint8Array(event.data);
          playAudio(audioData);
          return;
        }
        
        // Handle text messages
        const data = JSON.parse(event.data);
        
        if (data.type === 'ai_response') {
          setConversation(prev => [...prev, {
            type: 'assistant',
            text: data.text,
            timestamp: new Date()
          }]);
          setIsProcessing(false);
        } else if (data.type === 'task_started') {
          setIsProcessing(true);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    };
    
    websocket.onerror = (error) => {
      setError('Connection error. Please try again.');
      setIsConnected(false);
    };
    
    websocket.onclose = () => {
      setIsConnected(false);
    };
    
    setWs(websocket);
    
    return () => {
      websocket.close();
    };
  }, []);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onload = () => {
          const arrayBuffer = reader.result;
          const audioData = new Uint8Array(arrayBuffer);
          ws.send(audioData);
        };
        reader.readAsArrayBuffer(audioBlob);
      };
      
      mediaRecorder.start();
      setIsListening(true);
      setError(null);
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access.');
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  const playAudio = (audioData) => {
    if (audioRef.current) {
      const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl;
      audioRef.current.play();
    }
  };

  const startConversation = () => {
    setConversation([{
      type: 'assistant',
      text: "Hello! I'm your AI assistant. I'm here to have a friendly conversation with you. How are you feeling today?",
      timestamp: new Date()
    }]);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Voice Assessment Interface
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Have a natural conversation with our AI assistant for cognitive assessment
        </Typography>
      </Box>

      {/* Connection Status */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
        <Chip
          label={isConnected ? "Connected" : "Disconnected"}
          color={isConnected ? "success" : "error"}
          size="small"
        />
        {isProcessing && (
          <Chip
            label="Processing..."
            color="primary"
            size="small"
            icon={<CircularProgress size={16} />}
          />
        )}
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Avatar and Voice Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <motion.div
            animate={{
              scale: isListening ? 1.1 : 1,
              rotate: isListening ? [0, 5, -5, 0] : 0
            }}
            transition={{ duration: 0.5 }}
          >
            <Avatar
              sx={{
                width: 120,
                height: 120,
                mx: 'auto',
                mb: 2,
                bgcolor: isListening ? 'primary.main' : 'grey.300',
                fontSize: '3rem'
              }}
            >
              🧠
            </Avatar>
          </motion.div>

          <Typography variant="h6" gutterBottom>
            {isListening ? "I'm listening..." : "Tap to speak"}
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={isListening ? <MicOffIcon /> : <MicIcon />}
              onClick={isListening ? stopListening : startListening}
              disabled={!isConnected || isProcessing}
              sx={{ minWidth: 150 }}
            >
              {isListening ? "Stop" : "Start Speaking"}
            </Button>

            {conversation.length === 0 && (
              <Button
                variant="outlined"
                onClick={startConversation}
                disabled={!isConnected}
              >
                Start Conversation
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Conversation Display */}
      <AnimatePresence>
        {conversation.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Conversation
                </Typography>
                <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                  {conversation.map((message, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: message.type === 'user' ? 50 : -50 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Paper
                        sx={{
                          p: 2,
                          mb: 2,
                          bgcolor: message.type === 'user' ? 'primary.light' : 'grey.100',
                          color: message.type === 'user' ? 'white' : 'text.primary',
                          ml: message.type === 'user' ? 'auto' : 0,
                          mr: message.type === 'assistant' ? 'auto' : 0,
                          maxWidth: '80%',
                          borderRadius: 2
                        }}
                      >
                        <Typography variant="body1">
                          {message.text}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          {message.timestamp.toLocaleTimeString()}
                        </Typography>
                      </Paper>
                    </motion.div>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden audio element for playback */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </Container>
  );
};

export default VoiceInterface;
