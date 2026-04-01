# CareerAlign - Complete Functionality Documentation

## Project Overview
**CareerAlign** is an AI-powered Smart Resume Analyzer that helps users analyze their resumes, detect skill gaps, get personalized learning recommendations, and discover job opportunities based on BigData analytics.

---

## 🎯 Core Features

### 1. **Resume Upload & AI Parsing**
- **Functionality**: Users can upload PDF resumes
- **Technology**: Google Gemini AI (gemini-2.5-flash model)
- **Features**:
  - PDF file validation
  - AI-powered resume parsing
  - Extracts: Name, Skills, Experience, Projects, Education
  - Stores parsed data in MongoDB
  - Returns resume ID for further operations
- **Endpoint**: `POST /api/resume/upload`
- **Frontend**: Dashboard component with drag-and-drop file upload

### 2. **Resume & Job Description Analysis**
- **Functionality**: Analyzes resume against a job description
- **Technology**: 
  - Google Gemini AI for skill extraction
  - Google Gemini Embeddings (text-embedding-004) for semantic matching
  - Cosine similarity for skill matching
- **Features**:
  - Extracts skills from job description using AI
  - Semantic matching between resume skills and job requirements
  - Calculates match percentage (0-100%)
  - Identifies matched skills (skills user has)
  - Identifies missing skills (skills needed for the job)
  - Handles semantic similarity (e.g., "JS" matches "JavaScript")
- **Endpoint**: `POST /api/analysis/analyze`
- **Request Body**: `{ resumeId, jobDescription }`
- **Response**: Match percentage, matched skills, missing skills, upskilling plan

### 3. **Skill Gap Detection**
- **Functionality**: Detects skills missing from resume compared to job requirements
- **Technology**: Semantic matching using embeddings
- **Features**:
  - Compares resume skills with job requirements
  - Uses AI to identify missing skills (considers semantic similarity)
  - Returns categorized results (matched vs missing)
  - Visual representation with color-coded badges

### 4. **Personalized Upskilling Roadmap**
- **Functionality**: AI-generated learning recommendations
- **Technology**: Google Gemini AI
- **Features**:
  - **Timeline**: Estimated weeks to complete learning
  - **Courses**: 
    - Course title/skill name
    - Platform (Coursera, Udemy, etc.)
    - Duration
    - Priority level (High/Medium/Low)
  - **Projects**: 
    - Project title
    - Description
    - Required skills
    - Difficulty level
  - **Resources**: 
    - Resource type (Article/Video/Tutorial)
    - Title and description
    - Related skill
- **Generated when**: Missing skills are detected
- **Display**: Organized sections in Dashboard

### 5. **Job Suggestions**
- **Functionality**: Finds best matching jobs from database
- **Technology**: 
  - Semantic similarity using embeddings
  - Cosine similarity calculation
  - Database query with scoring
- **Features**:
  - Searches all jobs in database
  - Calculates match score for each job (0-100%)
  - Sorts by match score (highest first)
  - Returns top N jobs (default: 10)
  - Shows: Job title, company, location, description, required skills, match percentage
- **Endpoint**: `GET /api/analysis/job-suggestions?resumeId={id}&limit={n}`
- **Frontend**: Separate tab in Dashboard with job cards

### 6. **Market Trend Analytics Dashboard**
- **Functionality**: BigData analytics and visualizations
- **Technology**: MongoDB aggregation, Recharts for visualization
- **Features**:
  - **Overview Tab**:
    - Statistics cards (Total Records, Unique Skills, Job Titles, Top Skills)
    - Top Skills Bar Chart
    - Experience Level Distribution (Area Chart)
    - Top Job Titles Pie Chart
    - Skills Demand Heatmap (by Experience Level)
  - **Trends Tab**:
    - Skill search functionality
    - Market trends line chart (demand by experience level)
    - Skill correlation bar chart (related skills)
- **Endpoints**: Multiple analytics endpoints (see API section)

---

## 📊 Analytics & BigData Features

### Analytics Endpoints

1. **Top Skills** - `GET /api/analytics/top-skills?limit={n}`
   - Returns most in-demand skills
   - Sorted by frequency
   - Configurable limit

2. **Skills by YOE** - `GET /api/analytics/skills-by-yoe`
   - Returns skills grouped by years of experience
   - Used for heatmap visualization
   - Format: `{ skill, yoe, value }`

3. **Skills by Job Title** - `GET /api/analytics/skills-by-title/:title`
   - Returns skills required for specific job title
   - Sorted by frequency

4. **Job Titles List** - `GET /api/analytics/job-titles`
   - Returns all unique job titles
   - With count for each title

5. **YOE Distribution** - `GET /api/analytics/yoe-distribution`
   - Distribution of experience levels
   - Includes unique skills count per YOE

6. **Top Skills by YOE** - `GET /api/analytics/top-skills-by-yoe?yoe={years}`
   - Top skills for specific experience level
   - Returns top 15 skills

7. **Market Trends** - `GET /api/analytics/market-trends?skill={skillName}`
   - Demand trend for a specific skill
   - Grouped by experience level
   - Shows job titles count

8. **Dashboard Stats** - `GET /api/analytics/dashboard-stats`
   - Comprehensive statistics
   - Includes: total records, unique skills, unique titles, top skills, YOE distribution, top titles

9. **Skill Correlation** - `GET /api/analytics/skill-correlation?skill={skillName}`
   - Finds skills that appear together with the searched skill
   - Returns top 20 correlated skills
   - Useful for understanding skill combinations

### Visualizations

1. **Bar Charts**: Top skills, skill correlation
2. **Area Charts**: YOE distribution
3. **Pie Charts**: Job titles distribution
4. **Line Charts**: Market trends over experience levels
5. **Heatmaps**: Skills demand by experience level (color-coded)
6. **Horizontal Bar Charts**: Skill correlations

---

## 🗄️ Database Models

### 1. **Resume Model**
- Fields:
  - `filename`: String
  - `contentType`: String
  - `data`: Buffer (PDF file)
  - `extracted`: Object
    - `name`: String
    - `skills`: Array of Strings
    - `experience`: Array (Mixed - can be strings or objects)
    - `projects`: Array (Mixed - can be strings or objects)
    - `education`: Array (Mixed - can be strings or objects)
  - `uploadedAt`: Date

### 2. **Job Model**
- Fields:
  - `title`: String
  - `company`: String
  - `location`: String
  - `description`: String
  - `skills`: Array of Strings
  - `postedAt`: Date

### 3. **SkillsData Model** (BigData)
- Fields:
  - `title`: String (job role)
  - `skill`: String
  - `yoe`: Number (years of experience)
  - `createdAt`, `updatedAt`: Timestamps
- **Source**: Populated from CSV file (`jobs.csv`)
- **Collection**: `skill_data`

---

## 🔌 API Endpoints Summary

### Resume Routes (`/api/resume`)
- `POST /upload` - Upload and parse resume

### Analysis Routes (`/api/analysis`)
- `POST /analyze` - Analyze resume against job description
- `GET /job-suggestions` - Get job recommendations

### Analytics Routes (`/api/analytics`)
- `GET /top-skills` - Top skills in market
- `GET /skills-by-yoe` - Skills by experience level
- `GET /skills-by-title/:title` - Skills for specific job
- `GET /job-titles` - All job titles
- `GET /yoe-distribution` - Experience distribution
- `GET /top-skills-by-yoe` - Top skills for YOE
- `GET /market-trends` - Market trends for skill
- `GET /dashboard-stats` - Comprehensive stats
- `GET /skill-correlation` - Related skills

### Job Routes (`/api/jobs`)
- `GET /` - Get all jobs
- `GET /:id` - Get job by ID

### Match Routes (`/api/match`)
- `POST /` - Match resume to job (legacy endpoint)

---

## 🎨 Frontend Components

### 1. **LandingPage.jsx**
- Hero section with call-to-action
- Features showcase
- Interactive demo
- How it works section
- Testimonials
- Contact/Footer section
- Navigation to Dashboard

### 2. **Dashboard.jsx**
- **Sidebar Navigation**:
  - Resume Analyzer (active)
  - Market Analytics (link)
  - User profile section
- **Main Content**:
  - Resume upload area (drag & drop)
  - Job description textarea
  - Analyze button
  - **Analysis Results Tab**:
    - Match score with progress bar
    - Matched skills (green badges)
    - Missing skills (red badges)
    - Upskilling roadmap (courses, projects, resources)
  - **Job Suggestions Tab**:
    - Job cards with match scores
    - Job details (title, company, location, skills)
    - Sorted by match percentage

### 3. **AnalyticsDashboard.jsx**
- **Header**: Navigation and view switcher
- **Overview Tab**:
  - Statistics cards (4 cards)
  - Top Skills Bar Chart
  - YOE Distribution Area Chart
  - Job Titles Pie Chart
  - Skills Heatmap
- **Trends Tab**:
  - Skill search input
  - Market trends line chart
  - Skill correlation horizontal bar chart

---

## 🤖 AI/ML Features

### 1. **Resume Parsing (Gemini AI)**
- Model: `gemini-2.5-flash`
- Extracts structured data from PDF
- Handles complex resume formats
- Returns JSON with name, skills, experience, projects, education

### 2. **Skill Extraction (Gemini AI)**
- Extracts technical skills from job descriptions
- Returns JSON array of skills
- Handles various job description formats

### 3. **Semantic Matching**
- Model: `text-embedding-004` (Google Gemini Embeddings)
- Converts skills to embeddings
- Calculates cosine similarity
- Handles semantic similarity (e.g., "JS" = "JavaScript")

### 4. **Missing Skills Detection (Gemini AI)**
- AI identifies missing skills
- Considers semantic similarity
- Returns array of missing skills

### 5. **Upskilling Plan Generation (Gemini AI)**
- AI generates personalized learning roadmap
- Includes courses, projects, resources
- Provides timeline estimates
- Prioritizes learning items

---

## 🔄 Data Flow

### Resume Analysis Flow:
1. User uploads PDF resume → Backend receives file
2. Gemini AI parses resume → Extracts structured data
3. Data saved to MongoDB → Returns resume ID
4. User enters job description → Frontend sends to backend
5. Gemini AI extracts skills from JD → Returns skill array
6. Semantic matching → Calculates similarity
7. Missing skills detection → AI identifies gaps
8. Upskilling plan generation → AI creates roadmap
9. Job suggestions → Semantic search in database
10. Results displayed → Frontend shows analysis

### Analytics Flow:
1. CSV data processed → Stored in MongoDB
2. User requests analytics → Backend aggregates data
3. MongoDB aggregation → Processes BigData
4. Results formatted → Sent to frontend
5. Recharts visualizes → Charts and graphs displayed
..3333333333333322
22
---

## 🛠️ Technical Stack

### Backend:
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose) 


- **AI**: Google Gemini API
  - Models: gemini-2.5-flash, text-embedding-004
- **File Upload**: Multer
- **Environment**: Node.js with ES modules

### Frontend:
- **Framework**: React 19
- **Routing**: React Router DOM
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Build Tool**: Vite

### Data Processing:
- **CSV Parser**: csv-parser
- **Skill Normalization**: Custom utility
- **BigData**: MongoDB aggregation pipelines

---

## 📁 Project Structure

```
Smart-Resume-Analyser/
├── backend/
│   ├── controllers/
│   │   ├── analysisController.js    # Main analysis logic
│   │   └── matchController.js        # Legacy matching
│   ├── models/
│   │   ├── Resume.js                  # Resume schema
│   │   ├── jobs.js                    # Job schema
│   │   └── SkillsData.js              # BigData schema
│   ├── routes/
│   │   ├── ResumeRoutes.js            # Resume upload
│   │   ├── analysisRoutes.js          # Analysis endpoints
│   │   ├── analyticsRoutes.js         # Analytics endpoints
│   │   ├── jobRoutes.js               # Job CRUD
│   │   └── matchRoutes.js             # Legacy matching
│   ├── utils/
│   │   └── normaliseSkills.js        # Skill normalization
│   ├── scripts/
│   │   └── processSkillsCSV.js       # CSV ingestion
│   ├── data/
│   │   └── jobs.csv                   # BigData source
│   └── server.js                      # Main server
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Dashboard.jsx          # Main dashboard
    │   │   ├── AnalyticsDashboard.jsx # Analytics view
    │   │   └── LandingPage.jsx        # Landing page
    │   ├── utils/
    │   │   ├── api.js                 # Main API calls
    │   │   └── analyticsApi.js        # Analytics API calls
    │   ├── navigation/
    │   │   └── Router.jsx              # Routing
    │   └── App.jsx
    └── package.json
```

---

## ✨ Key Features Summary

### ✅ Implemented Features:

1. ✅ **Resume Upload** - PDF upload with AI parsing
2. ✅ **Resume Parsing** - AI extracts structured data (Gemini)
3. ✅ **Job Description Analysis** - AI extracts skills from JD
4. ✅ **Semantic Skill Matching** - Embedding-based similarity
5. ✅ **Skill Gap Detection** - Identifies missing skills
6. ✅ **Match Score Calculation** - Percentage compatibility
7. ✅ **Personalized Upskilling Roadmap** - AI-generated learning plan
8. ✅ **Job Recommendations** - Semantic search for matching jobs
9. ✅ **Market Analytics Dashboard** - BigData visualizations
10. ✅ **Top Skills Analysis** - Most in-demand skills
11. ✅ **YOE Distribution** - Experience level analytics
12. ✅ **Skills Heatmap** - Demand by experience level
13. ✅ **Market Trends** - Skill demand trends
14. ✅ **Skill Correlation** - Related skills analysis
15. ✅ **Job Titles Analytics** - Job market insights
16. ✅ **Interactive Charts** - Bar, Line, Pie, Area charts
17. ✅ **Responsive Design** - Mobile-friendly UI
18. ✅ **Error Handling** - Comprehensive error management
19. ✅ **Loading States** - User feedback during processing
20. ✅ **Professional UI/UX** - Sleek, modern interface

---

## 🔐 Environment Variables Required

```env
MONGO_URI=mongodb://localhost:27017/...
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash (optional, defaults to gemini-2.5-flash)
PORT=5000 (optional, defaults to 5000)
```

---

## 🚀 How to Use

### 1. Resume Analysis:
- Navigate to Dashboard
- Upload PDF resume
- Paste job description
- Click "Analyze Resume"
- View match score, skill gaps, and upskilling plan
- Switch to "Job Suggestions" tab for recommendations

### 2. Market Analytics:
- Click "Market Analytics" in sidebar
- View overview statistics and charts
- Switch to "Trends" tab
- Search for any skill to see market trends and correlations

---

## 📈 Data Sources

- **Resume Data**: User-uploaded PDFs (parsed and stored)
- **Job Data**: Database collection (can be seeded)
- **Skills Data**: CSV file (`jobs.csv`) with job titles, YOE, and skills
- **Analytics**: Aggregated from SkillsData collection

---

## 🎯 Project Goals Achieved

✅ **Resume Parsing**: AI-powered PDF parsing without errors  
✅ **Skill Gap Detection**: Semantic matching-based gap analysis  
✅ **Job Suggestions**: Database-based recommendations with match scores  
✅ **Upskilling Recommendations**: AI-generated personalized roadmap  
✅ **BigData Analytics**: Comprehensive market trend analysis  
✅ **Visualizations**: Multiple chart types for data insights  
✅ **Professional UI**: Sleek, modern, final-year-project quality  

---

## 📝 Notes

- All AI operations use Google Gemini API
- Semantic matching ensures accurate skill comparison
- BigData analytics powered by MongoDB aggregation
- Frontend uses modern React with hooks
- Backend follows RESTful API principles
- Error handling implemented throughout
- Loading states for better UX
- Responsive design for all screen sizes

---

**Last Updated**: Current implementation
**Status**: Fully Functional ✅

