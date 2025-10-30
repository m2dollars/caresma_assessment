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
  Paper,
  Stack,
  Divider
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import FavoriteIcon from '@mui/icons-material/Favorite';
import PsychologyIcon from '@mui/icons-material/Psychology';

const DoctorAvatar = ({ onPageChange }) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [ws, setWs] = useState(null);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [doctorEmotion, setDoctorEmotion] = useState('neutral'); // neutral, happy, concerned, thoughtful
  const [avatarVideoUrl, setAvatarVideoUrl] = useState(null); // D-ID video URL
  const [useVideoAvatar, setUseVideoAvatar] = useState(true); // Toggle between video and cartoon
  const [avatarStatus, setAvatarStatus] = useState('initializing');
  const [heygenSessionId, setHeygenSessionId] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const conversationEndRef = useRef(null);
  const heygenInitializedRef = useRef(false);
  const videoStreamRef = useRef(null); // Store the MediaStream to survive re-renders

  // Auto-scroll to latest message
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Keep video stream attached through re-renders
  useEffect(() => {
    if (videoStreamRef.current && videoRef.current && !videoRef.current.srcObject) {
      console.log('🔧 Re-attaching video stream after re-render');
      videoRef.current.srcObject = videoStreamRef.current;
      
      // Try to play if we're supposed to be connected
      if (avatarStatus === 'connected' || videoRef.current.readyState >= 2) {
        videoRef.current.play().catch(e => console.log('Auto-play attempt:', e.name));
      }
    }
  });

  // Audio playback monitoring
  useEffect(() => {
    const audioElement = audioRef.current;
    if (audioElement) {
      const handlePlay = () => {
        console.log('Audio playing - avatar should talk');
        setIsSpeaking(true);
      };
      const handleEnded = () => {
        console.log('Audio ended - avatar should stop');
        setIsSpeaking(false);
      };
      const handlePause = () => {
        console.log('Audio paused - avatar should stop');
        setIsSpeaking(false);
      };
      
      audioElement.addEventListener('play', handlePlay);
      audioElement.addEventListener('ended', handleEnded);
      audioElement.addEventListener('pause', handlePause);
      
      return () => {
        audioElement.removeEventListener('play', handlePlay);
        audioElement.removeEventListener('ended', handleEnded);
        audioElement.removeEventListener('pause', handlePause);
      };
    }
  }, []);

  // Initialize HeyGen Avatar
  useEffect(() => {
    if (heygenInitializedRef.current || !sessionId || !videoRef.current) return;
    
    const initializeHeyGen = async () => {
      try {
        heygenInitializedRef.current = true;
        setAvatarStatus('connecting');
        console.log('Initializing HeyGen avatar...');
        setError(null);
        
        // Create HeyGen session
        const response = await fetch('http://localhost:8000/api/heygen/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to create HeyGen session:', errorText);
          setAvatarStatus('error');
          
          // Show detailed error in development
          try {
            const errorJson = JSON.parse(errorText);
            setError(`Avatar service error: ${errorJson.detail || errorText}. Using audio-only mode.`);
          } catch {
            setError(`Avatar service error (${response.status}). Using audio-only mode.`);
          }
          return;
        }
        
        const sessionData = await response.json();
        console.log('HeyGen session created:', sessionData);
        
        if (!sessionData.success) {
          console.error('HeyGen session creation failed:', sessionData.error);
          setAvatarStatus('error');
          setError(`Avatar initialization failed: ${sessionData.error}. Using audio-only mode.`);
          return;
        }
        
        setHeygenSessionId(sessionData.session_id);
        
        // Set up WebRTC connection
        console.log('🔌 Setting up WebRTC with ICE servers:', sessionData.ice_servers?.length);
        const pc = new RTCPeerConnection({
          iceServers: sessionData.ice_servers || [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        });
        
        // Handle incoming video stream
        pc.ontrack = (event) => {
          console.log('🎥 ===== TRACK RECEIVED =====');
          console.log('🎥 Track kind:', event.track.kind);
          console.log('🎥 Track id:', event.track.id);
          console.log('🎥 Track readyState:', event.track.readyState);
          console.log('🎥 Track enabled:', event.track.enabled);
          console.log('🎥 Streams count:', event.streams.length);
          console.log('🎥 ==========================');
          
          if (event.track.kind === 'video' && videoRef.current) {
            console.log('🎥 VIDEO TRACK - Setting srcObject');
            const stream = event.streams[0];
            const video = videoRef.current;
            
            // Store stream in ref to survive re-renders!
            videoStreamRef.current = stream;
            
            // Set srcObject - DO NOT call .load() for MediaStreams!
            video.srcObject = stream;
            console.log('✅ srcObject set, stream has', stream.getVideoTracks().length, 'video tracks');
            console.log('✅ Stream stored in ref for re-render protection');
            
            // Monitor track
            event.track.onended = () => console.log('Track ended');
            event.track.onmute = () => console.log('Track muted');
            event.track.onunmute = () => console.log('Track unmuted');
            
            // CRITICAL: Wait for video to be ready before playing
            // We need readyState >= 2 (HAVE_CURRENT_DATA) to avoid AbortError
            console.log('⏳ Waiting for video metadata to load...');
            
            let attempts = 0;
            const waitForVideoReady = () => {
              attempts++;
              const currentVideo = videoRef.current;
              if (!currentVideo || !document.contains(currentVideo)) {
                console.warn('⚠️ Video element not in DOM');
                return;
              }
              
              // Debug: Check if srcObject is still there
              const hasSrcObject = !!currentVideo.srcObject;
              const streamActive = currentVideo.srcObject ? currentVideo.srcObject.active : false;
              const videoTracks = currentVideo.srcObject ? currentVideo.srcObject.getVideoTracks() : [];
              const trackActive = videoTracks.length > 0 ? videoTracks[0].readyState : 'none';
              
              console.log('🔍 Attempt', attempts, '- readyState:', currentVideo.readyState, 
                'srcObject:', hasSrcObject, 'streamActive:', streamActive, 
                'trackState:', trackActive, 'videoWidth:', currentVideo.videoWidth);
              
              // readyState: 0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA
              if (currentVideo.readyState >= 2 && currentVideo.videoWidth > 0) {
                console.log('✅ Video is ready! Dimensions:', currentVideo.videoWidth, 'x', currentVideo.videoHeight);
                console.log('🎬 Calling play()...');
                
                currentVideo.play()
                  .then(() => {
                    console.log('🎉 VIDEO PLAYING SUCCESSFULLY!');
                    // Wait before updating state to avoid re-render during play
                    setTimeout(() => {
                      console.log('✅ Updating status to connected');
                      setAvatarStatus('connected');
                      setError(null);
                    }, 300);
                  })
                  .catch(err => {
                    console.error('❌ Play failed:', err.name, err.message);
                    if (err.name === 'NotAllowedError') {
                      setError('Click the avatar to start video');
                    }
                  });
              } else if (attempts > 50) {
                // After 5 seconds, give up and try alternative approach
                console.error('❌ Video never became ready after 5 seconds');
                console.log('💡 Trying alternative: just play() and hope for the best');
                currentVideo.play()
                  .then(() => {
                    console.log('✅ Play succeeded anyway!');
                    setAvatarStatus('connected');
                    setError(null);
                  })
                  .catch(err => {
                    console.error('❌ Alternative play failed:', err.name);
                    setAvatarStatus('error');
                    setError('Video stream failed to load. Using audio-only mode.');
                  });
              } else {
                // Not ready yet, wait a bit and check again
                setTimeout(waitForVideoReady, 100);
              }
            };
            
            // Start checking after a small delay
            setTimeout(waitForVideoReady, 100);
            
            // The video element has autoPlay attribute, so it will start automatically
            // We'll update status when the video actually starts playing via onPlay event
            
          } else if (event.track.kind === 'audio') {
            console.log('🎤 Audio track received (muted for ElevenLabs TTS)');
          }
        };
        
        // Handle ICE connection state
        pc.oniceconnectionstatechange = () => {
          console.log('🧊 ICE connection state:', pc.iceConnectionState);
        };
        
        pc.onconnectionstatechange = () => {
          console.log('🔗 Connection state:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            console.log('✅ WebRTC connection established!');
          } else if (pc.connectionState === 'failed') {
            console.error('❌ WebRTC connection failed!');
            console.error('ICE state:', pc.iceConnectionState);
            console.error('Signaling state:', pc.signalingState);
            // Don't immediately set error - sometimes it recovers
            setTimeout(() => {
              if (pc.connectionState === 'failed') {
                console.error('Connection still failed after delay, falling back');
                setAvatarStatus('error');
                setError('Avatar connection failed. Using audio-only mode.');
              }
            }, 2000);
          } else if (pc.connectionState === 'disconnected') {
            console.warn('⚠️ WebRTC disconnected, waiting for reconnection...');
          }
        };
        
        pc.onicegatheringstatechange = () => {
          console.log('🧊 ICE gathering state:', pc.iceGatheringState);
        };
        
        pc.onsignalingstatechange = () => {
          console.log('📡 Signaling state:', pc.signalingState);
        };
        
        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('🧊 ICE candidate:', event.candidate.type);
          } else {
            console.log('🧊 ICE gathering complete');
          }
        };
        
        // Set remote description (HeyGen's offer)
        console.log('📥 Setting remote description (HeyGen offer)');
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: 'offer',
          sdp: sessionData.sdp
        }));
        console.log('✅ Remote description set');
        
        // Create answer
        console.log('📤 Creating answer...');
        const answer = await pc.createAnswer();
        console.log('✅ Answer created');
        
        // Set local description
        await pc.setLocalDescription(answer);
        console.log('✅ Local description set');
        
        // Wait for ICE gathering to have some candidates
        await new Promise((resolve) => {
          if (pc.iceGatheringState === 'complete') {
            resolve();
          } else {
            const checkState = () => {
              if (pc.iceGatheringState === 'complete' || pc.iceGatheringState === 'gathering') {
                pc.removeEventListener('icegatheringstatechange', checkState);
                setTimeout(resolve, 100); // Give it a moment
              }
            };
            pc.addEventListener('icegatheringstatechange', checkState);
            setTimeout(resolve, 1000); // Don't wait forever
          }
        });
        
        // Send answer to HeyGen
        console.log('📤 Sending SDP answer to server...');
        const startResponse = await fetch('http://localhost:8000/api/heygen/start-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionData.session_id,
            sdp_answer: pc.localDescription.sdp,
            user_session_id: sessionId
          })
        });
        
        if (!startResponse.ok) {
          const errorText = await startResponse.text();
          console.error('❌ Failed to start HeyGen session:', errorText);
          setAvatarStatus('error');
          setError('Failed to start avatar session. Using audio-only mode.');
          return;
        }
        
        console.log('✅ HeyGen session started - waiting for video track...');
        setPeerConnection(pc);
        
        // Check video status after connection
        setTimeout(() => {
          if (videoRef.current && videoRef.current.srcObject) {
            console.log('✅ Video stream confirmed!');
            // Ensure it's playing
            if (videoRef.current.paused) {
              console.log('Video paused, attempting to play...');
              videoRef.current.play().catch(e => console.log('Play attempt:', e.name));
            }
          } else {
            console.warn('⚠️ No video stream after 15 seconds');
            setError('Video stream not available. Using audio-only mode.');
            setAvatarStatus('error');
          }
        }, 15000);
        
      } catch (error) {
        console.error('HeyGen initialization error:', error);
        setAvatarStatus('error');
        setError(`Avatar error: ${error.message}. Using fallback mode.`);
        heygenInitializedRef.current = false;
      }
    };
    
    // Add a small delay to ensure video ref is ready
    const timer = setTimeout(initializeHeyGen, 100);
    
    return () => {
      clearTimeout(timer);
      if (peerConnection) {
        peerConnection.close();
      }
    };
  }, [sessionId]);

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
      console.log('Connected to AI Doctor');
    };
    
    websocket.onmessage = (event) => {
      try {
        // Check if it's binary data (audio)
        if (event.data instanceof ArrayBuffer) {
          const audioData = new Uint8Array(event.data);
          playAudioBuffer(audioData);
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
          
          // Update doctor emotion based on keywords
          updateDoctorEmotion(data.text);
        } else if (data.type === 'ai_audio') {
          // Handle audio response from ElevenLabs
          playAudioBase64(data.audio);
        } else if (data.type === 'ai_video') {
          // Handle D-ID talking avatar video
          setAvatarVideoUrl(data.video_url);
          if (videoRef.current) {
            videoRef.current.src = data.video_url;
            videoRef.current.play().catch(err => console.error('Video play error:', err));
          }
        } else if (data.type === 'task_started') {
          setIsProcessing(true);
          setDoctorEmotion('thoughtful');
        } else if (data.type === 'assessment_complete') {
          // Assessment complete - diagnosis coming
          setIsProcessing(true);
          setDoctorEmotion('concerned');
          console.log('📋 Assessment complete - generating diagnosis...');
        } else if (data.type === 'user_transcript') {
          setConversation(prev => [...prev, {
            type: 'user',
            text: data.text,
            timestamp: new Date()
          }]);
        } else if (data.type === 'processing') {
          setIsProcessing(true);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    };
    
    websocket.onerror = (error) => {
      setError('Connection error. Please check if the server is running.');
      setIsConnected(false);
    };
    
    websocket.onclose = () => {
      setIsConnected(false);
      console.log('Disconnected from AI Doctor');
    };
    
    setWs(websocket);
    
    return () => {
      websocket.close();
    };
  }, []);

  const updateDoctorEmotion = (text) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('great') || lowerText.includes('excellent') || lowerText.includes('wonderful')) {
      setDoctorEmotion('happy');
    } else if (lowerText.includes('concern') || lowerText.includes('difficult') || lowerText.includes('trouble')) {
      setDoctorEmotion('concerned');
    } else if (lowerText.includes('think') || lowerText.includes('remember') || lowerText.includes('recall')) {
      setDoctorEmotion('thoughtful');
    } else {
      setDoctorEmotion('neutral');
    }
    
    // Reset to neutral after 5 seconds
    setTimeout(() => setDoctorEmotion('neutral'), 5000);
  };

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
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(audioData);
            setIsProcessing(true);
          }
        };
        reader.readAsArrayBuffer(audioBlob);
      };
      
      mediaRecorder.start();
      setIsListening(true);
      setError(null);
    } catch (err) {
      setError('Please allow microphone access to speak with the doctor.');
      console.error('Microphone error:', err);
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsListening(false);
    }
  };

  const playAudioBuffer = (audioData) => {
    if (audioRef.current) {
      const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl;
      audioRef.current.play().catch(err => {
        console.error('Audio playback error:', err);
      });
    }
  };

  const playAudioBase64 = (base64Audio) => {
    if (audioRef.current) {
      // Convert base64 to audio blob
      const binaryString = window.atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl;
      audioRef.current.play().catch(err => {
        console.error('Audio playback error:', err);
      });
    }
  };

  const startConversation = () => {
    const welcomeMessage = "Hello! I'm Dr. Smith, your friendly AI doctor. I'm here to chat with you today. How are you feeling? Is there anything you'd like to talk about?";
    
    // Wait for avatar to be connected (allow error state for fallback mode)
    if (avatarStatus !== 'connected' && avatarStatus !== 'error') {
      setError('Avatar is still connecting... Please wait a moment.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    setConversation([{
      type: 'assistant',
      text: welcomeMessage,
      timestamp: new Date()
    }]);
    
    setDoctorEmotion('happy');
    setError(null);
    
    // Speak the welcome message
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('Sending welcome message to server...');
      ws.send(JSON.stringify({
        type: 'speak_text',
        text: welcomeMessage
      }));
    } else {
      setError('Not connected to server. Please refresh the page.');
    }
  };

  // HeyGen Real-Time Streaming Avatar
  const HeyGenAvatar = () => {
    return (
      <Box
        sx={{
          width: { xs: 320, md: 400 },
          height: { xs: 420, md: 500 },
          borderRadius: '20px',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #00bcd4 0%, #0097a7 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          boxShadow: isSpeaking 
            ? '0 0 80px rgba(0, 188, 212, 0.8), 0 25px 70px rgba(0,0,0,0.4)' 
            : '0 25px 70px rgba(0,0,0,0.3)',
          transition: 'all 0.3s ease',
          mx: 'auto',
          border: isSpeaking ? '8px solid #4caf50' : '8px solid white',
          animation: isSpeaking ? 'avatarPulse 1s ease-in-out infinite' : 'none',
          '@keyframes avatarPulse': {
            '0%, 100%': { 
              transform: 'scale(1)',
              borderColor: '#4caf50'
            },
            '50%': { 
              transform: 'scale(1.02)',
              borderColor: '#81c784'
            }
          }
        }}
      >
        {/* Real-time video stream from HeyGen */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={(e) => {
            console.log('✅ Video metadata loaded:', e.target.videoWidth, 'x', e.target.videoHeight);
          }}
          onLoadedData={(e) => {
            console.log('✅ Video data loaded - first frame ready');
          }}
          onCanPlay={(e) => {
            console.log('✅ Video can play');
          }}
          onPlay={() => {
            console.log('✅ Video onPlay event fired!');
            // Update status now that video is actually playing
            setTimeout(() => {
              setAvatarStatus('connected');
              setError(null);
            }, 200);
          }}
          onTimeUpdate={(e) => {
            // Log occasionally to confirm video is progressing
            if (Math.floor(e.target.currentTime) % 5 === 0) {
              console.log('⏱️ Video time:', e.target.currentTime.toFixed(1), 's');
            }
          }}
          onError={(e) => {
            console.error('❌ Video error event:', e);
            console.error('Video error details:', e.target.error);
          }}
          onClick={(e) => {
            // Allow user to manually play video if autoplay fails
            console.log('🖱️ Video clicked');
            console.log('Video state:', {
              paused: e.target.paused,
              readyState: e.target.readyState,
              srcObject: e.target.srcObject,
              videoWidth: e.target.videoWidth,
              videoHeight: e.target.videoHeight
            });
            
            if (e.target.paused || e.target.readyState === 0) {
              console.log('🎥 Attempting to play video from click...');
              e.target.play()
                .then(() => {
                  console.log('✅ Video playing after user click');
                  setAvatarStatus('connected');
                  setError(null);
                })
                .catch(err => {
                  console.error('❌ Click play failed:', err);
                  setError(`Cannot play video: ${err.message}`);
                });
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: '#000',
            cursor: 'pointer',
            display: 'block',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1,
            border: '3px solid red' // DEBUG: Make video element visible
          }}
        />
        
        {/* Status Overlay - Only show when not connected */}
        {(avatarStatus === 'initializing' || avatarStatus === 'connecting') && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #00bcd4 0%, #0097a7 100%)',
              color: 'white',
              zIndex: 2,
              pointerEvents: 'none'
            }}
          >
            {avatarStatus === 'initializing' && (
              <>
                <CircularProgress size={60} sx={{ color: 'white', mb: 3 }} />
                <Typography variant="h6" sx={{ fontSize: '1.3rem' }}>Initializing Dr. Smith...</Typography>
              </>
            )}
            {avatarStatus === 'connecting' && (
              <>
                <CircularProgress size={60} sx={{ color: 'white', mb: 3 }} />
                <Typography variant="h6" sx={{ fontSize: '1.3rem' }}>Connecting to Dr. Smith...</Typography>
                <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>Preparing AI avatar video...</Typography>
              </>
            )}
          </Box>
        )}
        
        {/* Error Fallback - Show emoji avatar */}
        {avatarStatus === 'error' && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #00bcd4 0%, #0097a7 100%)',
              color: 'white',
              zIndex: 1
            }}
          >
            <Typography variant="h1" sx={{ fontSize: '8rem', mb: 2 }}>👩‍⚕️</Typography>
            <Typography variant="h6" sx={{ fontSize: '1.5rem' }}>Dr. Smith</Typography>
            <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
              Audio-only mode
            </Typography>
          </Box>
        )}
        
        {/* Debug Overlay - Shows video stream status */}
        {videoRef.current && (
          <Box
            sx={{
              position: 'absolute',
              top: 10,
              left: 10,
              background: 'rgba(0, 0, 0, 0.9)',
              color: '#0f0',
              padding: '8px 12px',
              borderRadius: '5px',
              fontSize: '11px',
              fontFamily: 'monospace',
              zIndex: 100,
              pointerEvents: 'none',
              border: '1px solid #0f0'
            }}
          >
            <div>Status: {avatarStatus}</div>
            <div>Stream: {videoRef.current.srcObject ? '✅' : '❌'}</div>
            <div>Size: {videoRef.current.videoWidth}x{videoRef.current.videoHeight}</div>
            <div>Ready: {videoRef.current.readyState}/4</div>
            <div>Playing: {videoRef.current.paused ? '❌' : '✅'}</div>
          </Box>
        )}
        
        {/* Click to Play Hint - Show if video needs user interaction */}
        {avatarStatus === 'connected' && error && error.includes('Click') && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '20px 30px',
              borderRadius: '15px',
              textAlign: 'center',
              zIndex: 10,
              cursor: 'pointer',
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
                '50%': { opacity: 0.7, transform: 'translate(-50%, -50%) scale(1.05)' }
              }
            }}
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.play()
                  .then(() => {
                    setError(null);
                    setAvatarStatus('connected');
                  })
                  .catch(err => console.error('Play failed:', err));
              }
            }}
          >
            <Typography variant="h6" sx={{ mb: 1 }}>🎬 Click to Start Video</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Tap anywhere to begin
            </Typography>
          </Box>
        )}
        
        {/* Professional Info Badge */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '8px 16px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: avatarStatus === 'connected' ? '#4caf50' : '#ff9800',
              animation: avatarStatus === 'connected' ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 }
              }
            }}
          />
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#333', fontSize: '0.9rem' }}>
            {avatarStatus === 'connected' ? 'Live' : 'Connecting...'}
          </Typography>
        </Box>
        
        {/* Speaking Indicator - Shows when audio is playing */}
        {isSpeaking && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 30,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              background: 'rgba(76, 175, 80, 0.9)',
              padding: '8px 16px',
              borderRadius: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          >
            <VolumeUpIcon sx={{ color: 'white', fontSize: 20 }} />
            {/* Sound wave animation */}
            {[0, 1, 2, 3].map((i) => (
              <Box
                key={i}
                sx={{
                  width: 3,
                  height: 8,
                  borderRadius: 2,
                  backgroundColor: 'white',
                  animation: 'soundWave 0.6s infinite',
                  animationDelay: `${i * 0.1}s`,
                  '@keyframes soundWave': {
                    '0%, 100%': { height: '8px' },
                    '50%': { height: '20px' }
                  }
                }}
              />
            ))}
            <Typography variant="caption" sx={{ color: 'white', fontWeight: 600, ml: 1 }}>
              Speaking
            </Typography>
          </Box>
        )}
        
        {/* Listening Indicator */}
        {isListening && (
          <>
            <Box
              sx={{
                position: 'absolute',
                top: 20,
                right: 20,
                width: 60,
                height: 60,
                borderRadius: '50%',
                backgroundColor: '#f44336',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'listeningPulse 1.5s infinite',
                zIndex: 10,
                boxShadow: '0 0 30px rgba(244, 67, 54, 0.8)',
                '@keyframes listeningPulse': {
                  '0%, 100%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.15)' }
                }
              }}
            >
              <MicIcon sx={{ color: 'white', fontSize: 32 }} />
            </Box>
            <Box
              sx={{
                position: 'absolute',
                top: 20,
                right: 20,
                width: 60,
                height: 60,
                borderRadius: '50%',
                border: '4px solid #f44336',
                animation: 'pulseRing 1.5s infinite',
                '@keyframes pulseRing': {
                  '0%': { transform: 'scale(1)', opacity: 1 },
                  '100%': { transform: 'scale(2)', opacity: 0 }
                }
              }}
            />
          </>
        )}
      </Box>
    );
  };

  // Realistic AI Avatar with Lip-Sync and Gestures (Fallback)
  const DoctorFace = () => {
    return (
      <Box
        sx={{
          animation: isSpeaking 
            ? 'avatarSpeak 0.3s ease-in-out infinite' 
            : isProcessing 
            ? 'avatarThinking 2s ease-in-out infinite'
            : 'avatarIdle 4s ease-in-out infinite',
          '@keyframes avatarSpeak': {
            '0%, 100%': { transform: 'scale(1) translateY(0) rotate(0deg)' },
            '25%': { transform: 'scale(1.02) translateY(-2px) rotate(-1deg)' },
            '75%': { transform: 'scale(1.02) translateY(-2px) rotate(1deg)' }
          },
          '@keyframes avatarThinking': {
            '0%, 100%': { transform: 'rotate(0deg) translateY(0)' },
            '25%': { transform: 'rotate(-3deg) translateY(-3px)' },
            '75%': { transform: 'rotate(3deg) translateY(-3px)' }
          },
          '@keyframes avatarIdle': {
            '0%, 100%': { transform: 'translateY(0px) scale(1)' },
            '50%': { transform: 'translateY(-8px) scale(1.01)' }
          }
        }}
      >
        <Box
          sx={{
            width: { xs: 280, md: 350 },
            height: { xs: 380, md: 450 },
            borderRadius: '20px',
            background: isSpeaking 
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : 'linear-gradient(135deg, #e3f2fd 0%, #90caf9 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            boxShadow: isSpeaking 
              ? '0 0 60px rgba(102, 126, 234, 0.8), 0 20px 60px rgba(0,0,0,0.3)' 
              : '0 20px 60px rgba(0,0,0,0.2)',
            transition: 'all 0.4s ease',
            mx: 'auto',
            border: '6px solid white',
            overflow: 'visible'
          }}
        >
          {/* Avatar Head Container */}
          <Box
            sx={{
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              background: '#ffd699',
              position: 'relative',
              mt: 3,
              animation: isSpeaking ? 'headNod 0.6s ease-in-out infinite' : 'none',
              '@keyframes headNod': {
                '0%, 100%': { transform: 'translateY(0)' },
                '50%': { transform: 'translateY(-5px)' }
              }
            }}
          >
            {/* Hair */}
            <Box
              sx={{
                position: 'absolute',
                top: -10,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '160px',
                height: '80px',
                borderRadius: '50% 50% 0 0',
                background: 'linear-gradient(135deg, #8b7355 0%, #6b5742 100%)',
                zIndex: 0
              }}
            />
            
            {/* Face */}
            <Box
              sx={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ffd699 0%, #ffb366 100%)',
                position: 'relative',
                zIndex: 1,
                border: '3px solid #d4a574'
              }}
            >
              {/* Eyes */}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mt: 6 }}>
                {/* Left Eye */}
                <Box
                  sx={{
                    width: 16,
                    height: 20,
                    borderRadius: '50%',
                    background: 'white',
                    border: '2px solid #333',
                    position: 'relative',
                    animation: isProcessing ? 'eyeBlink 3s infinite' : 'none',
                    '@keyframes eyeBlink': {
                      '0%, 96%, 100%': { height: '20px' },
                      '98%': { height: '2px' }
                    }
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#2c3e50',
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                </Box>
                
                {/* Right Eye */}
                <Box
                  sx={{
                    width: 16,
                    height: 20,
                    borderRadius: '50%',
                    background: 'white',
                    border: '2px solid #333',
                    position: 'relative',
                    animation: isProcessing ? 'eyeBlink 3s infinite' : 'none'
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#2c3e50',
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                </Box>
              </Box>
              
              {/* Nose */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -20%)',
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '12px solid #d4a574'
                }}
              />
              
              {/* Mouth - Animated Lip Sync */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 40,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: isSpeaking ? 40 : 30,
                  height: isSpeaking ? 25 : 3,
                  borderRadius: isSpeaking ? '50%' : '50px',
                  background: '#c67b5c',
                  border: '2px solid #a6634a',
                  transition: 'all 0.15s ease',
                  animation: isSpeaking ? 'lipSync 0.2s ease-in-out infinite' : 'none',
                  '@keyframes lipSync': {
                    '0%, 100%': { 
                      height: '20px',
                      width: '35px',
                      borderRadius: '50%'
                    },
                    '50%': { 
                      height: '12px',
                      width: '40px',
                      borderRadius: '50% 50% 50% 50%'
                    }
                  }
                }}
              >
                {/* Teeth when speaking */}
                {isSpeaking && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 2,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '60%',
                      height: '40%',
                      background: 'white',
                      borderRadius: '3px'
                    }}
                  />
                )}
              </Box>
              
              {/* Smile lines */}
              {!isSpeaking && (
                <>
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 45,
                      left: 40,
                      width: 15,
                      height: 15,
                      borderBottom: '2px solid #d4a574',
                      borderRight: '2px solid #d4a574',
                      borderRadius: '0 0 100% 0',
                      transform: 'rotate(-15deg)'
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 45,
                      right: 40,
                      width: 15,
                      height: 15,
                      borderBottom: '2px solid #d4a574',
                      borderLeft: '2px solid #d4a574',
                      borderRadius: '0 0 0 100%',
                      transform: 'rotate(15deg)'
                    }}
                  />
                </>
              )}
            </Box>
          </Box>
          
          {/* Stethoscope */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 60,
              height: 60,
              borderRadius: '50%',
              border: '4px solid #4a90e2',
              background: 'linear-gradient(135deg, #e3f2fd 0%, #90caf9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: isSpeaking ? 'stethoscopePulse 0.6s infinite' : 'none',
              '@keyframes stethoscopePulse': {
                '0%, 100%': { transform: 'translateX(-50%) scale(1)' },
                '50%': { transform: 'translateX(-50%) scale(1.1)' }
              }
            }}
          >
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: '#1976d2'
              }}
            />
          </Box>
          
          {/* Lab Coat */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              width: '100%',
              height: '180px',
              background: 'linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%)',
              borderRadius: '0 0 14px 14px',
              borderTop: '4px solid #e0e0e0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              pt: 2
            }}
          >
            {/* Collar */}
            <Box
              sx={{
                width: 80,
                height: 30,
                background: '#4a90e2',
                borderRadius: '0 0 50% 50%',
                mb: 1
              }}
            />
            
            {/* Buttons */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              {[0, 1, 2].map((i) => (
                <Box
                  key={i}
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#2196f3',
                    border: '2px solid #1976d2'
                  }}
                />
              ))}
            </Box>
            
            {/* Hands/Gestures */}
            {isSpeaking && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 20,
                  display: 'flex',
                  gap: 8,
                  animation: 'handGesture 1.2s ease-in-out infinite',
                  '@keyframes handGesture': {
                    '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
                    '50%': { transform: 'translateY(-10px) rotate(5deg)' }
                  }
                }}
              >
                <Typography sx={{ fontSize: '2.5rem' }}>👋</Typography>
              </Box>
            )}
          </Box>
          
          {/* Speaking Wave Visualization */}
          {isSpeaking && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: 1,
                alignItems: 'center'
              }}
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <Box
                  key={i}
                  sx={{
                    width: 4,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: '#4caf50',
                    animation: 'soundWave 0.6s infinite',
                    animationDelay: `${i * 0.1}s`,
                    '@keyframes soundWave': {
                      '0%, 100%': { height: '10px', backgroundColor: '#4caf50' },
                      '50%': { height: '30px', backgroundColor: '#81c784' }
                    }
                  }}
                />
              ))}
            </Box>
          )}
          
          {/* Listening Pulse Indicator */}
          {isListening && (
            <>
              <Box
                sx={{
                  position: 'absolute',
                  top: -15,
                  right: -15,
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  backgroundColor: '#f44336',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'listeningPulse 1.5s infinite',
                  zIndex: 10,
                  boxShadow: '0 0 20px rgba(244, 67, 54, 0.6)',
                  '@keyframes listeningPulse': {
                    '0%, 100%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.15)' }
                  }
                }}
              >
                <MicIcon sx={{ color: 'white', fontSize: 28 }} />
              </Box>
              {/* Outer pulse ring */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -15,
                  right: -15,
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  border: '3px solid #f44336',
                  animation: 'pulseRing 1.5s infinite',
                  '@keyframes pulseRing': {
                    '0%': { transform: 'scale(1)', opacity: 1 },
                    '100%': { transform: 'scale(1.8)', opacity: 0 }
                  }
                }}
              />
            </>
          )}
          
          {/* Processing Indicator */}
          {isProcessing && !isListening && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '80%',
                height: '80%',
                borderRadius: '50%',
                border: '4px dashed rgba(255,255,255,0.5)',
                animation: 'thinkingRotate 3s linear infinite',
                '@keyframes thinkingRotate': {
                  '0%': { transform: 'translate(-50%, -50%) rotate(0deg)' },
                  '100%': { transform: 'translate(-50%, -50%) rotate(360deg)' }
                }
              }}
            />
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mb: 2 }}>
          <FavoriteIcon sx={{ color: '#e91e63', fontSize: 40 }} />
          <Typography variant="h3" component="h1" sx={{ fontSize: { xs: '2rem', md: '3rem' }, fontWeight: 700 }}>
            AI Doctor Assistant
          </Typography>
        </Stack>
        <Typography variant="h6" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.3rem' } }}>
          Your friendly virtual doctor for a caring conversation
        </Typography>
      </Box>

      {/* Status Indicators */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Chip
          label={isConnected ? "Server Connected" : "Connecting to Server..."}
          color={isConnected ? "success" : "default"}
          size="medium"
          sx={{ fontSize: '1rem', py: 2.5, px: 1 }}
        />
        <Chip
          label={
            avatarStatus === 'connected' ? "Avatar Ready" : 
            avatarStatus === 'connecting' ? "Avatar Connecting..." : 
            avatarStatus === 'error' ? "Avatar Error (Using Fallback)" :
            "Avatar Initializing..."
          }
          color={
            avatarStatus === 'connected' ? "success" : 
            avatarStatus === 'error' ? "warning" : 
            "default"
          }
          size="medium"
          icon={avatarStatus === 'connecting' || avatarStatus === 'initializing' ? 
            <CircularProgress size={16} sx={{ color: 'white' }} /> : undefined}
          sx={{ fontSize: '1rem', py: 2.5, px: 1 }}
        />
        {isProcessing && (
          <Chip
            label="Doctor is thinking..."
            color="primary"
            size="medium"
            icon={<CircularProgress size={20} sx={{ color: 'white' }} />}
            sx={{ fontSize: '1rem', py: 2.5, px: 1 }}
          />
        )}
        {isSpeaking && (
          <Chip
            label="Doctor is speaking"
            color="secondary"
            size="medium"
            icon={<VolumeUpIcon />}
            sx={{ fontSize: '1rem', py: 2.5, px: 1 }}
          />
        )}
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, fontSize: '1.1rem' }}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        {/* Doctor Avatar Card */}
        <Card sx={{ flex: 1, minWidth: { xs: '100%', md: 350 } }}>
          <CardContent sx={{ textAlign: 'center', py: { xs: 3, md: 5 } }}>
            {/* Avatar - HeyGen Real-Time or Fallback */}
            <HeyGenAvatar />

            {/* Doctor Name and Title */}
            <Box sx={{ mt: 3, mb: 4 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, fontSize: { xs: '1.5rem', md: '1.8rem' } }}>
                Dr. Smith
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.2rem' } }}>
                AI Healthcare Assistant
              </Typography>
              <Chip 
                icon={<PsychologyIcon />}
                label="Cognitive Care Specialist"
                color="primary"
                sx={{ mt: 2, fontSize: '0.9rem' }}
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Voice Controls */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3 }}>
              {conversation.length === 0 ? (
                <Button
                  variant="contained"
                  size="large"
                  onClick={startConversation}
                  disabled={!isConnected || (avatarStatus !== 'connected' && avatarStatus !== 'error')}
                  sx={{
                    fontSize: { xs: '1.2rem', md: '1.4rem' },
                    py: { xs: 2, md: 2.5 },
                    borderRadius: 3,
                    textTransform: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)'
                    },
                    '&:disabled': {
                      background: '#ccc',
                      color: '#666'
                    }
                  }}
                >
                  {avatarStatus === 'connecting' ? 'Connecting Avatar...' : 'Start Conversation with Doctor'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  size="large"
                  startIcon={isListening ? <MicOffIcon sx={{ fontSize: 30 }} /> : <MicIcon sx={{ fontSize: 30 }} />}
                  onClick={isListening ? stopListening : startListening}
                  disabled={!isConnected || isProcessing || isSpeaking}
                  color={isListening ? "error" : "primary"}
                  sx={{
                    fontSize: { xs: '1.2rem', md: '1.4rem' },
                    py: { xs: 2, md: 2.5 },
                    borderRadius: 3,
                    textTransform: 'none',
                    boxShadow: isListening ? '0 0 20px rgba(244, 67, 54, 0.5)' : 'none'
                  }}
                >
                  {isListening ? "Stop Speaking" : "Tap to Speak"}
                </Button>
              )}

              {/* Instructions */}
              <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                <Typography variant="body2" sx={{ fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.6 }}>
                  {isListening 
                    ? "🎤 I'm listening to you. Speak clearly and press 'Stop' when done."
                    : isSpeaking
                    ? "🔊 Please listen to the doctor's response."
                    : isProcessing
                    ? "⏳ The doctor is thinking about your response..."
                    : "👆 Press the button above to talk to the doctor."
                  }
                </Typography>
              </Paper>
            </Box>
          </CardContent>
        </Card>

        {/* Conversation Display */}
        <Card sx={{ flex: 2, minHeight: { xs: 400, md: 600 } }}>
          <CardContent>
            <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.3rem', md: '1.5rem' }, fontWeight: 600 }}>
              💬 Conversation
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {conversation.length === 0 ? (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center', 
                minHeight: 300,
                textAlign: 'center'
              }}>
                <Typography variant="h6" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', md: '1.3rem' }, mb: 2 }}>
                  Welcome! 👋
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '1rem', md: '1.1rem' } }}>
                  Press "Start Conversation" to begin talking with Dr. Smith.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ 
                maxHeight: { xs: 350, md: 520 }, 
                overflowY: 'auto',
                pr: 1
              }}>
                {conversation.map((message, index) => (
                  <Box
                    key={index}
                    sx={{
                      animation: 'fadeIn 0.3s ease-in',
                      '@keyframes fadeIn': {
                        from: { opacity: 0, transform: 'translateY(20px)' },
                        to: { opacity: 1, transform: 'translateY(0)' }
                      }
                    }}
                  >
                    <Paper
                      elevation={2}
                      sx={{
                        p: { xs: 2, md: 2.5 },
                        mb: 2,
                        bgcolor: message.type === 'user' ? '#e3f2fd' : '#f3e5f5',
                        borderLeft: message.type === 'user' 
                          ? '4px solid #2196f3' 
                          : '4px solid #9c27b0',
                        borderRadius: 2
                      }}
                    >
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          fontWeight: 600,
                          color: message.type === 'user' ? '#1976d2' : '#7b1fa2',
                          fontSize: { xs: '0.9rem', md: '1rem' },
                          textTransform: 'uppercase',
                          letterSpacing: 0.5
                        }}
                      >
                        {message.type === 'user' ? '👤 You' : '👨‍⚕️ Dr. Smith'}
                      </Typography>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          mt: 1,
                          fontSize: { xs: '1.1rem', md: '1.2rem' },
                          lineHeight: 1.6
                        }}
                      >
                        {message.text}
                      </Typography>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          opacity: 0.6,
                          fontSize: { xs: '0.85rem', md: '0.9rem' },
                          display: 'block',
                          mt: 1
                        }}
                      >
                        {message.timestamp.toLocaleTimeString()}
                      </Typography>
                    </Paper>
                  </Box>
                ))}
                <div ref={conversationEndRef} />
              </Box>
            )}
          </CardContent>
        </Card>
      </Stack>

      {/* Hidden audio element for playback */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </Container>
  );
};

export default DoctorAvatar;

