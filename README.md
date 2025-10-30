# Dementia Detection AI - Conversational AI for Early Dementia Detection

A comprehensive system for early dementia detection using conversational AI, featuring voice interaction, cognitive assessment, and automated report generation.

## 🏗️ Architecture

- **Frontend**: React with Material-UI
- **Backend**: FastAPI (Python)
- **Job Queue**: Redis with Celery
- **AI Services**: OpenAI GPT-4, Deepgram, ElevenLabs
- **Database**: PostgreSQL
- **Real-time**: WebSocket connections

### **Code Structure Walkthrough**
```
server/
├── main.py                 # FastAPI application
├── services/
│   ├── redis_client.py     # Redis connection
│   ├── celery_app.py       # Job queue configuration
│   └── websocket_manager.py # Real-time connections
├── tasks/
│   ├── audio_processing.py # Speech-to-text & TTS
│   └── ai_processing.py    # Cognitive assessment
└── routers/
    ├── auth.py            # User authentication
    ├── assessment.py      # Session management
    └── report.py          # Report generation

client/
├── src/
│   ├── App.js            # Main React app
│   └── components/
│       ├── VoiceInterface.js    # Voice interaction
│       ├── ReportGenerator.js   # Assessment reports
│       └── Navigation.js        # App navigation
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Redis server
- PostgreSQL (optional, can use Docker)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd dementia-detection-ai
```

### 2. Environment Configuration

```bash
# Copy environment template
cp env.example .env

# Edit .env with your API keys
OPENAI_API_KEY=your_openai_api_key_here
DEEPGRAM_API_KEY=your_deepgram_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
REDIS_URL=redis://localhost:6379
```

### 3. Start Redis Server

```bash
# Using Docker (recommended)
docker run -d -p 6379:6379 redis:7-alpine

# Or install Redis locally
# brew install redis (macOS)
# sudo apt-get install redis-server (Ubuntu)
```

### 4. Start Backend Services

```bash
# Install Python dependencies
pip install -r requirements.txt

# Start FastAPI server
cd server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# In another terminal, start Celery worker
celery -A server.services.celery_app worker --loglevel=info
```

### 5. Start Frontend

```bash
# Install dependencies
cd client
npm install

# Start React development server
npm start
```

### 6. Access the Application

- **Frontend**: http://localhost:3000
- **AI Doctor Avatar**: http://localhost:3000/doctor ⭐ NEW!
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Celery Flower**: http://localhost:5555 (if using Docker)

## 🐳 Docker Setup (Alternative)

```bash
# Start all services with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 🎯 Features

### 👨‍⚕️ AI Doctor Avatar (NEW!)
- **Elderly-Friendly Interface**: Large text, simple controls, high contrast design
- **Animated Doctor Avatar**: Professional doctor character with emotions and lip-sync
- **Empathetic Conversation**: Warm, caring AI doctor personality specialized in geriatric care
- **Natural Interaction**: Speak naturally with the AI doctor like a real consultation
- **Real-time Feedback**: Visual indicators for listening, speaking, and processing
- **Cognitive Assessment**: Gentle, conversational cognitive health evaluation
- **Compassionate Care**: Designed specifically for elderly patients with patience and respect

### Voice Interface
- **Real-time Speech-to-Text**: Using Deepgram API
- **AI Conversation**: GPT-4 powered natural dialogue
- **Text-to-Speech**: ElevenLabs for natural voice synthesis
- **Animated Avatar**: Visual feedback during conversation
- **WebSocket Communication**: Real-time audio streaming

### Report Generator
- **Transcript Upload**: Upload .txt files or paste text
- **AI Analysis**: Comprehensive cognitive assessment
- **Structured Reports**: Memory, language, attention, executive function scores
- **Risk Assessment**: Low/Medium/High risk classification
- **Recommendations**: Personalized care suggestions

### Redis Job Queue
- **Asynchronous Processing**: Non-blocking AI API calls
- **Priority Queuing**: Critical assessments processed first
- **Rate Limiting**: Respects API limits across providers
- **Error Handling**: Automatic retries with exponential backoff
- **Scalability**: Auto-scaling Celery workers

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### 👨‍⚕️ Doctor Avatar (NEW)
- `POST /api/doctor/start-session` - Start doctor conversation session
- `POST /api/doctor/conversation` - Process conversation with AI doctor
- `GET /api/doctor/session/{session_id}` - Get doctor session details
- `POST /api/doctor/session/{session_id}/end` - End session and generate assessment
- `GET /api/doctor/conversation-starters` - Get conversation prompts

### Assessment
- `POST /api/assessment/start` - Start new session
- `GET /api/assessment/session/{session_id}` - Get session status
- `WebSocket /ws/{session_id}` - Real-time audio communication

### Reports
- `POST /api/report/generate` - Generate assessment report
- `POST /api/report/upload-transcript` - Upload transcript file
- `GET /api/report/sample-transcript` - Get sample transcript

## 🧠 Cognitive Assessment Criteria

The system evaluates five key cognitive domains:

1. **Memory Assessment**
   - Short-term memory recall
   - Working memory capacity
   - Episodic memory details
   - Semantic memory accuracy

2. **Language Processing**
   - Word finding difficulties
   - Sentence construction
   - Comprehension accuracy
   - Fluency and coherence

3. **Attention & Executive Function**
   - Sustained attention
   - Task switching ability
   - Planning and organization
   - Problem-solving approach

4. **Spatial & Temporal Orientation**
   - Time awareness
   - Place orientation
   - Spatial reasoning

5. **Overall Risk Stratification**
   - Low Risk: Scores 8-10
   - Medium Risk: Scores 6-7
   - High Risk: Scores 1-5

## 🔒 Security & Privacy

- **End-to-End Encryption**: All audio data encrypted
- **HIPAA Compliance**: Healthcare data protection standards
- **Data Anonymization**: PII stripped before AI processing
- **Secure Storage**: Encrypted database with access controls
- **Audit Logging**: Comprehensive activity tracking

## 📊 Monitoring

- **Celery Flower**: Task queue monitoring
- **Redis Monitoring**: Queue depth and performance
- **API Health Checks**: Service availability monitoring
- **Error Tracking**: Failed task analysis

## 🧪 Testing

```bash
# Backend tests
cd server
pytest

# Frontend tests
cd client
npm test
```

## 📈 Performance Optimization

- **Redis Caching**: Multi-layer caching strategy
- **Connection Pooling**: Efficient database connections
- **CDN Integration**: Global content delivery
- **Auto-scaling**: Dynamic worker scaling based on load
- **Rate Limiting**: API quota management

## 🚀 Deployment

### Production Environment
- **Cloud**: AWS ECS Fargate
- **Database**: RDS PostgreSQL
- **Cache**: ElastiCache Redis
- **Storage**: S3 for file storage
- **Monitoring**: CloudWatch + DataDog

### Environment Variables
```bash
# Production configuration
REDIS_URL=redis://your-redis-cluster:6379
DATABASE_URL=postgresql://user:pass@host:5432/db
OPENAI_API_KEY=your_production_key
DEEPGRAM_API_KEY=your_production_key
ELEVENLABS_API_KEY=your_production_key
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔮 Future Enhancements

- **Multi-language Support**: International localization
- **Mobile App**: React Native implementation
- **Advanced Analytics**: Machine learning insights
- **Integration**: EHR system connectivity
- **Accessibility**: Enhanced accessibility features
