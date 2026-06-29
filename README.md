
# BrainBytes AI Tutoring Platform

[![BrainBytes
CI/CD](https://github.com/Resulex/BrainBytes-AI-Tutoring-Platform/actions/workflows/main.yml/badge.svg)](https://github.com/Resulex/BrainBytes-AI-Tutoring-Platform/actions/workflows/main.yml)

[![CI
Status](https://github.com/Resulex/BrainBytes-AI-Tutoring-Platform/actions/workflows/ci.yml/badge.svg)](https://github.com/Resulex/BrainBytes-AI-Tutoring-Platform/actions/workflows/ci.yml)

[![Deploy
Status](https://github.com/Resulex/BrainBytes-AI-Tutoring-Platform/actions/workflows/deploy.yml/badge.svg)](https://github.com/Resulex/BrainBytes-AI-Tutoring-Platform/actions/workflows/deploy.yml)

## Cloud Deployment Link
https://brainbytesaitutor.up.railway.app/

## Project Overview
BrainBytes is an AI-powered tutoring platform designed to provide accessible academic assistance to Filipino students. This project implements the platform using modern DevOps practices and containerization.

## Team Members
- Alex Resurreccion - Team Lead - lr.alresurreccion@mmdc.mcl.edu.ph
- christenne jsele herrera - Backend Developer - 
lr.cjherrera@mmdc.mcl.edu.ph
- Harty Joy Villegas - Frontend Developer - 
lr.hjvillegas@mmdc.mcl.edu.ph
- Broose Henrik Membreve - DevOps Engineer - 
lr.bhmembreve@mmdc.mcl.edu.ph

## Project Goals
- Implement a containerized application with proper networking
- Create an automated CI/CD pipeline using GitHub Actions
- Deploy the application to Oracle Cloud Free Tier
- Set up monitoring and observability tools

## Technology Stack
- Frontend: Next.js
- Backend: Node.js
- Database: MongoDB Atlas
- Containerization: Docker
- CI/CD: GitHub Actions
- Cloud Provider: Oracle Cloud Free Tier
- Monitoring: Prometheus & Grafana

## Project Structure

```
brainbytes-multi-container/
├── backend/                        # Node.js Express API Server
│   ├── middleware/                 # Custom Express middlewares
│   ├── models/                     # Mongoose/Database schemas
│   ├── node_modules/               # Backend dependencies (container-mapped)
│   ├── public/
│   │   └── icons/                  # Static asset icons
│   ├── routes/                     # API route endpoints
│   ├── scripts/                    # Automation or seeding scripts
│   ├── socket/                     # WebSockets implementation (Real-time features)
│   ├── tests/                      # Backend test suites
│   ├── utils/                      # Helper & utility functions
│   ├── .env                        # Local backend environment variables
│   ├── aiService.js                # AI integration logic
│   ├── Dockerfile                  # Backend container configuration
│   ├── jest.config.js              # Jest testing configuration
│   ├── package-lock.json
│   ├── package.json
│   └── server.js                   # Application entry point
├── frontend/                       # Next.js Frontend Application
│   ├── .next/                      # Next.js build cache directory
│   ├── context/                    # React Context providers (State management)
│   ├── hooks/                      # Custom React hooks
│   ├── node_modules/               # Frontend dependencies (container-mapped)
│   ├── pages/                      # Next.js Pages (Routing)
│   │   ├── _app.js                 # Global Application wrapper
│   │   ├── _document.js            # Custom Document structuring
│   │   ├── dashboard.js            # Student Learning Analytics dashboard
│   │   ├── index.js                # Landing / Login / Main Workspace page
│   │   └── profile.js              # Student Profile settings page
│   ├── public/                     # Static frontend assets
│   ├── utils/                      # Frontend utilities
│   ├── Dockerfile                  # Frontend container configuration
│   ├── next.config.js              # Next.js configuration settings
│   ├── package-lock.json
│   ├── package.json
│   └── .env                        # Local frontend environment variables
├── .gitignore                      # Specified files to ignore in Git
├── docker-compose.yml              # Multi-container multi-service orchestrator
└── README.md                       # Main project documentation documentation

```


---

## Instructions for Running the Application

### Prerequisites
- Docker and Docker Compose installed
- Git installed
- Node.js 18+ (for local development)
- MongoDB Atlas account (or local MongoDB instance)

### Running with Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/Resulex/BrainBytes-AI-Tutoring-Platform.git
   cd BrainBytes-AI-Tutoring-Platform
   ```

2. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/brainbytes
   PORT=3000
   NEXT_PUBLIC_API_URL=http://localhost:3000/api
   ```

3. **Build and start the containers**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3000/api
   - MongoDB: localhost:27017 (if using local MongoDB)

5. **Stop the application**
   ```bash
   docker-compose down
   ```

### Running Locally (Development)

1. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install
   ```

2. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```

3. **Start the frontend development server**
   ```bash
   cd frontend
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3001/api

---

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### User Endpoints

#### Get All Users
```http
GET /api/users
```
**Response:** Array of user objects
```json
[
  {
    "_id": "string",
    "name": "string",
    "email": "string",
    "preferredSubjects": ["string"],
    "bio": "string",
    "avatarUrl": "string",
    "createdAt": "date",
    "updatedAt": "date"
  }
]
```

#### Get Single User
```http
GET /api/users/:id
```

#### Create User
```http
POST /api/users
Content-Type: application/json

{
  "name": "Juan Dela Cruz",
  "email": "juan@example.com",
  "preferredSubjects": ["math", "science"]
}
```

#### Update User
```http
PUT /api/users/:id
Content-Type: application/json

{
  "name": "Juan Updated",
  "preferredSubjects": ["math", "history"]
}
```

#### Delete User
```http
DELETE /api/users/:id
```

### Learning Materials Endpoints

#### Get All Materials
```http
GET /api/materials?subject=math&topic=algebra&page=1&limit=10
```
**Query Parameters:**
- `subject` (optional): Filter by subject
- `topic` (optional): Filter by topic
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**
```json
{
  "materials": [
    {
      "_id": "string",
      "subject": "math",
      "topic": "algebra",
      "content": "string",
      "tags": ["string"],
      "references": [
        { "title": "string", "url": "string" }
      ],
      "isPublished": true,
      "createdBy": "user_id",
      "createdAt": "date"
    }
  ],
  "pagination": {
    "totalItems": 50,
    "totalPages": 5,
    "currentPage": 1,
    "itemsPerPage": 10
  }
}
```

#### Create Learning Material
```http
POST /api/materials
Content-Type: application/json

{
  "subject": "math",
  "topic": "algebra",
  "content": "Algebra is a branch of mathematics...",
  "tags": ["algebra", "equations"],
  "references": [
    { "title": "Khan Academy", "url": "https://khanacademy.org/math/algebra" }
  ],
  "isPublished": true,
  "createdBy": "user_id"
}
```

#### Get Single Material
```http
GET /api/materials/:id
```

### Chat/Messages Endpoints

#### Send Message
```http
POST /api/messages
Content-Type: application/json

{
  "text": "What is the quadratic formula?",
  "subject": "math"
}
```
**Response:**
```json
{
  "userMessage": {
    "_id": "string",
    "text": "What is the quadratic formula?",
    "isUser": true,
    "subject": "math",
    "createdAt": "date"
  },
  "aiResponse": {
    "_id": "string",
    "text": "The quadratic formula is x = (-b ± √(b² - 4ac)) / 2a...",
    "isUser": false,
    "category": "math",
    "sentiment": "neutral",
    "createdAt": "date"
  }
}
```

#### Get Message History
```http
GET /api/messages?limit=50&page=1
```

---

## Database Schema Design

### User Collection
```javascript
{
  _id: ObjectId,
  role: String,              // User role definition (e.g., "student")
  preferredSubjects: [       // Array of tracked academic subjects
    String                   // e.g., "Mathematics", "Science", "History", "Computer Science"
  ],
  bio: String,               // Student biography description
  avatarUrl: String,         // Profile picture path or URL string
  name: String,              // User's full name
  email: String,             // Academic email address (unique)
  password: String,          // BCrypt-hashed password string
  createdAt: Date,           // ISO registration timestamp
  updatedAt: Date,           // ISO profile modification timestamp
  __v: Number                // MongoDB internal document version key
}
```

### Sessions Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,          // Reference to the active User (null if guest/anonymous)
  subject: String,           // Active subject scope / session channel (e.g., "general")
  isActive: Boolean,         // Live state flag tracking active connectivity
  deviceInfo: String,        // Browser user-agent client information string
  ipAddress: String,         // Operational IPv6 / IPv4 networking string
  messageCount: Number,      // Metrics aggregation tracking total entries inside session
  endedAt: Date,             // ISO termination timestamp (null if active)
  lastActivity: Date,        // ISO timestamp logging most recent user interaction
  startedAt: Date,           // ISO initialization session timestamp
  __v: Number                // MongoDB internal document version key
}
```

### Messages Collection
```javascript
{
  _id: ObjectId,
  isUser: Boolean,           // true if message from user, false if AI response
  sessionId: ObjectId,       // Reference linking message to parent Sessions document
  userId: ObjectId,          // Reference linking message back to the core Users collection
  category: String,          // Algorithmic / UI class category designation (e.g., "general")
  followUps: [               // Array storing dynamic context follow-up options
    String
  ],
  formattedContent: String,  // Rich parsing markdown / LaTeX target strings (null if unprocessed)
  readAt: Date,              // ISO read verification timestamp (null if unread)
  text: String,              // Raw input or generated message string
  createdAt: Date,           // ISO historical message entry timestamp
  __v: Number                // MongoDB internal document version key
}
```

### LearningMaterial Collection
```javascript
{
  _id: ObjectId,
  subject: String,           // Subject category (Mathematics, Science, History, etc.)
  topic: String,             // Specific topic within the subject scope
  content: String,           // Main instructional learning content
  tags: [String],            // Array of tags for search categorization
  references: [{             // External source reference links
    title: String,           // Reference title
    url: String              // Reference target URL
  }],
  isPublished: Boolean,      // Draft state representation toggle
  createdBy: ObjectId,       // Reference back to authoring Administrative / Faculty User
  createdAt: Date,           // ISO creation timestamp
  updatedAt: Date            // ISO last-modified configuration timestamp
}
```

### Schema Design Decisions

1. **Embedded vs Referenced Data**: We use referenced data (ObjectId) for `createdBy` in LearningMaterial to maintain data integrity and allow user profile updates without affecting materials.

2. **Indexing Strategy**: Indexes are created on `subject`, `topic`, and `createdAt` fields for efficient querying and pagination.

3. **Flexible Schema**: MongoDB's schema-less nature allows us to add fields like `references` and `isPublished` without migrations.

4. **Sentiment Tracking**: The Message collection stores sentiment analysis results directly for quick retrieval and dashboard analytics.

---

## AI Enhancements Implemented

### 1. Question Type Detection

The AI service can now identify and respond to different types of questions:

- **Definitions**: Questions starting with "What is", "Define", "Meaning of"
- **Explanations**: Questions containing "Explain", "How does", "Why"
- **Examples**: Requests for "Example", "Give me an example"

**Implementation:**
```javascript
function detectQuestionType(question) {
  const lower = question.toLowerCase();
  const isDefinition = /^what (is|are|does)|define|meaning\b/.test(lower);
  const isExplanation = /explain|how (does|do|can)|why/.test(lower);
  const isExample = /example|give (me )?an example|show me/.test(lower);
  
  if (isDefinition) return 'definition';
  if (isExplanation) return 'explanation';
  if (isExample) return 'example';
  return 'general';
}
```

### 2. Subject Prioritization

Users can select a subject filter in the chat interface. The AI prioritizes this selection when generating responses:

- If a subject is selected (e.g., "Math"), responses are tailored to that subject
- If no subject is selected, the AI automatically detects the subject from keywords
- The subject filter overrides automatic detection for more accurate responses

### 3. Sentiment Analysis

Basic sentiment detection identifies when users might be frustrated or confused:

- **Keywords monitored**: "not working", "wrong", "bad", "stupid", "help", "confused", "don't understand"
- **Response**: When frustration is detected, the AI provides empathetic responses and offers alternative explanations
- **Storage**: Sentiment data is stored with each message for dashboard analytics

### 4. Expanded Training Data

The fallback response system has been expanded with:
- Subject-specific definitions for math, science, and history
- Pre-written examples for common topics
- Category-based explanation templates
- Support for all three question types across multiple subjects

### 5. Response Generation Flow

```
User Question
    ↓
Subject Filter (if selected) → Prioritize subject
    ↓
Question Type Detection → definition | explanation | example | general
    ↓
Sentiment Analysis → neutral | frustrated | confused
    ↓
Response Generation → Tailored response based on:
                      - Subject category
                      - Question type
                      - User sentiment
    ↓
Store in Database → Message with metadata
    ↓
Return to Frontend → Display with appropriate formatting
```

---

## Development Environment Setup Verification

| Team Member | Docker Installed | Git Installed | VS Code Installed | Can Run Hello World Container |
|----------------|-------------------|--------------|---------------------|-----------------------------------|
| Alex            | ✓                           | ✓                  | ✓                               | ✓                                                   |
| Christenne            |            ✓                |     ✓              |       ✓                         |       ✓                                            |
| Harty Joy            | ✓                           | ✓                  | ✓                               |  ✓                                                  |
| Broose            |                             |                   |                                 |                                                   |

## Docker Version Information
Docker version 29.4.1, build 055a478

## Project Architecture
<img width="4013" height="2850" alt="BrainBytes Architecture Diagram" src="https://github.com/user-attachments/assets/c939e60f-9898-4db6-8e14-171451e41c83" />


## Documentation Files

- [Architecture Diagram](https://drive.google.com/file/d/11QP2jqDVXsBLLMMCiTFbeMw0eiq_ycfp/view?usp=sharing)
- [E2E User Interaction Testing](https://docs.google.com/spreadsheets/d/11AKRJcJ8q2Z3knwf53ejf_MmZq9q4_V4XCyABT1eGJU/edit?usp=sharing)
- [Container Testing Documentation](https://docs.google.com/document/d/1chN7DcMxNebOnh7OlpZjb83M5D8fXrQuqKF9jb_Sq4c/edit?usp=drive_link)
- [Task Distribution Plan](https://docs.google.com/spreadsheets/d/1e3JSPDEwzf6VswULflVIxrk0AFxl5QTjwNTdBPtG3K0/edit?usp=sharing)
- [MS1 Documentation](https://docs.google.com/document/d/1os4GjEnvPh2NJy3gVD3GweAF0FtgzfEw44r5U_Jr198/edit?usp=sharing)
- [Project Demo Video](https://drive.google.com/file/d/1i2-2BdyJ_BdnI3FpEa1sVns4dLYddgXv/view?usp=sharing)
- [CI/CD Implementation and Testing Documentation](https://docs.google.com/document/d/15Xo--sSDzwhhLpeyZmdhPw-qLuAiU1n-eYFgr0FbFkY/edit?usp=sharing)
- [Deployment Plan Documentation](https://docs.google.com/document/d/15uaHOPKM--08Mhd5ZjJibSCVzGSw3QeDIC_z69zGdeM/edit?usp=sharing)
- [Milestone 2 Documentation](https://docs.google.com/document/d/1JGmgXinJhcwiIrOKrD6c6GpZu-I6txaua_B3yKzxFrA/edit?usp=sharing)

### Implemented and Addressed Items

**1a – Automated Docker Builds**
Removed continue-on-error: true from Docker build steps – image build failures now stop the pipeline immediately.
Consolidated redundant workflow files (build.yml, test.yml, lint.yml have been removed), leaving ci.yml and main.yml with clearly separated, non‑duplicating stages.

**1b – Automated Testing**
Removed continue-on-error: true from frontend unit test steps – test failures now block the pipeline.
Hooked docker-compose.e2e.yml into the active deployment pipeline. The e2e-gate job runs full end‑to‑end tests **before** the build-and-push stage in deploy.yml.

**1c – Code Quality and Security**
Added a Container Vulnerability Scanner (Trivy) that runs on both backend and frontend images after they are built.
Integrated Static Application Security Testing (SAST) with **CodeQL** in main.yml for deep code analysis.
npm audit now **fails the pipeline** if high/critical vulnerabilities are detected (no longer ignored via continue-on-error).

**1d – Deployment Automation**
Implemented **automatic rollback** via the rollback job in deploy.yml. If the post‑deployment verification fails, the pipeline automatically re‑deploys the last stable images (.last-stable-backend / .last-stable-frontend).

**2a – Cloud Configuration**
Defined **replication and autoscaling** in railway.json: numReplicas: 2, CPU threshold 70%, memory threshold 80%, min‑max replicas 2–5. (Resource alerting via Railway’s built‑in monitoring can be configured as a follow‑up.)

**2b – Environment Variables**
Removed hardcoded fallback secrets from docker-compose.yml; the application now **crashes on startup** if critical variables like JWT_SECRET are missing, instead of using insecure defaults.  
  (CI injects secrets securely through GitHub Actions secrets.)

**2c – Deployment Environment**
Added a **Production** target in deploy.yml, protected by a **manual approval‑gate** (approval-gate job) that requires explicit sign‑off before production releases.

**2d – Networking**
MongoDB service has **no ports exposed** in docker-compose.yml – it is strictly internal‑network only. Only the backend container can reach the database.

**3a - Project Overview**
Added Missing information: Added technical project constraints, scope boundaries, or expected traffic load metrics.

**3c - Cloud Deployment**
Revised Diagram Sufficiency: Added conceptual system architecture diagram, visual drawing, flow explanation.

**3e - Testing and Validation**
Added documentation and configuration for active performance monitoring / live production system observability.

**3f - Operational Guide**
Added Database restoration steps/ disaster recovery procedures if data corruption occurs.


