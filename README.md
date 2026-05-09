# BrainBytes AI Tutoring Platform

## Project Overview
BrainBytes is an AI-powered tutoring platform designed to provide accessible academic assistance to Filipino students. This project implements the platform using modern DevOps practices and containerization.

## Team Members
- Alex Resurreccion - Team Lead - lr.alresurreccion@mmdc.mcl.edu.ph
- [Member Name] - Backend Developer - [email@mmdc.mcl.edu.ph]
- [Member Name] - Frontend Developer - [email@mmdc.mcl.edu.ph]
- [Member Name] - DevOps Engineer - [email@mmdc.mcl.edu.ph]

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

---

## Instructions for Running Your Application

### Prerequisites
- Docker and Docker Compose installed
- Git installed
- Node.js 18+ (for local development)
- MongoDB Atlas account (or local MongoDB instance)

### Running with Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/brainbytes-multi-container.git
   cd brainbytes-multi-container
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
   - Frontend: http://localhost:3000
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
   - Frontend: http://localhost:3000
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
  name: String,              // User's full name
  email: String,             // Email address (unique)
  preferredSubjects: [       // Array of preferred subjects
    String                   // e.g., "math", "science", "history"
  ],
  bio: String,               // Short biography (max 500 chars)
  avatarUrl: String,         // Profile picture URL
  createdAt: Date,           // Auto-generated timestamp
  updatedAt: Date            // Auto-updated timestamp
}
```

### LearningMaterial Collection
```javascript
{
  _id: ObjectId,
  subject: String,           // Subject category (math, science, history, general)
  topic: String,             // Specific topic within the subject
  content: String,           // Main learning content
  tags: [String],            // Array of tags for categorization
  references: [{             // External reference links
    title: String,           // Reference title
    url: String              // Reference URL
  }],
  isPublished: Boolean,      // Draft (false) or published (true)
  createdBy: ObjectId,       // Reference to User who created it
  createdAt: Date,
  updatedAt: Date
}
```

### Message Collection
```javascript
{
  _id: ObjectId,
  text: String,              // Message content
  isUser: Boolean,           // true if from user, false if AI response
  category: String,          // Detected subject category
  subject: String,           // User-selected subject filter
  sentiment: String,         // Detected sentiment (neutral, frustrated, confused)
  createdAt: Date
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
| [Name]            |                            |                   |                                |                                                    |
| [Name]            |                            |                   |                                |                                                    |
| [Name]            |                             |                   |                                 |                                                   |

## Docker Version Information

## Project Architecture Draft
<img width="1682" height="800" alt="Project Architecture for BrainBytes AI Tutoring Platform" src="https://github.com/user-attachments/assets/97628dd0-5331-4f31-bfa0-58c3cb3a4356" />

## Task Distribution Plan
https://docs.google.com/spreadsheets/d/1e3JSPDEwzf6VswULflVIxrk0AFxl5QTjwNTdBPtG3K0/edit?usp=sharing
