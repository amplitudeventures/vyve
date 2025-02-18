# Django Analysis Project

This Django REST API project provides a robust backend for handling complex analysis tasks with phase-based processing, AI integration, and vector storage capabilities.

## Quick Start Guide

### Installation Steps

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Set Up Python Environment**
   ```bash
   # Create a virtual environment
   python -m venv venv
   
   # Activate the virtual environment
   source venv/bin/activate  # On Linux/Mac
   # OR
   .\venv\Scripts\activate  # On Windows
   ```

3. **Install Dependencies**
   ```bash
   # Upgrade pip
   pip install --upgrade pip
   
   # Install required packages
   pip install -r requirements.txt
   ```

4. **Environment Configuration**
   ```bash
   # Copy the example env file
   cp .env.example .env
   
   # Edit .env file with your credentials
   nano .env  # or use any text editor
   ```

5. **Database Setup**
   ```bash
   # Apply migrations
   python manage.py makemigrations
   python manage.py migrate
   
   # Create superuser
   python manage.py createsuperuser
   ```

### Starting the Application

1. **Start the Development Server**
   ```bash
   python manage.py runserver
   ```

2. **Verify Installation**
   - Open browser and navigate to:
     - Admin Panel: http://localhost:8000/admin/
     - API Root: http://localhost:8000/

### Using the APIs

1. **Authentication**
   ```bash
   # Get JWT token
   curl -X POST http://localhost:8000/api/token/ \
        -H "Content-Type: application/json" \
        -d '{"username": "your_username", "password": "your_password"}'
   ```

2. **API Endpoints Usage**
   ```bash
   # Start Analysis
   curl -X POST http://localhost:8000/start_analysis/ \
        -H "Authorization: Bearer your_jwt_token" \
        -H "Content-Type: application/json" \
        -d '{"data": "your_analysis_data"}'
   
   # Get Analysis Status
   curl -X GET http://localhost:8000/get_analysis_status/ \
        -H "Authorization: Bearer your_jwt_token"
   
   # Get Analysis Results
   curl -X GET http://localhost:8000/get_analysis_results/ \
        -H "Authorization: Bearer your_jwt_token"
   ```

### Troubleshooting

1. **Database Issues**
   ```bash
   # Reset database
   python manage.py flush
   python manage.py migrate
   ```

2. **Environment Issues**
   - Verify all environment variables are set correctly
   - Ensure virtual environment is activated
   - Check Python version (recommended: 3.8+)

3. **API Connection Issues**
   - Verify server is running
   - Check JWT token expiration
   - Ensure correct API endpoint URLs

## Project Structure

### Main Components

1. **Main Project (`backend/`):**
   - Core Django configuration
   - Django 5.1.6
   - REST framework for API endpoints

2. **API App (`backend/api/`):**
   - Main application handling business logic
   - Models:
     - `Phase`: Represents main analysis phases
     - `Prompt`: Stores prompts for phases
     - `SubPhase`: Handles sub-components with dependencies
     - `AnalysisResult`: Stores analysis results
   - REST endpoints:
     - `/start_analysis/`
     - `/get_analysis_status/`
     - `/get_analysis_results/`

3. **Utilities (`backend/api/utils/`):**
   - Pinecone integration for vector storage
   - LangChain processing capabilities

## Prerequisites and Setup

### 1. Python Environment Setup
```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
source venv/bin/activate  # On Linux/Mac
```

### 2. Required Python Packages
- Django (5.1.6)
- Django REST framework
- SimpleJWT (for JWT authentication)
- Pinecone-client
- LangChain
- OpenAI
- python-dotenv

### 3. Environment Variables
Create a `.env` file with the following variables:
```
# Database Configuration (if using PostgreSQL)
DATABASE_URL=your_database_url

# API Keys
OPENAI_API_KEY=your_openai_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX_NAME=your_pinecone_index

# Supabase Configuration (if using Supabase)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_key
```

### 4. Database Setup
```bash
# The project uses SQLite by default
# Run migrations
python manage.py migrate
```

### 5. Create Admin User
```bash
python manage.py createsuperuser
```

## Project Functionality

### Data Model Flow
- `Phase`: Main analysis phases
- `Prompt`: Prompts associated with phases
- `SubPhase`: Sub-components of phases with dependencies
- `AnalysisResult`: Analysis results storage

### API Endpoints
- `/start_analysis/`: Initiates analysis process
- `/get_analysis_status/`: Checks ongoing analysis status
- `/get_analysis_results/`: Retrieves analysis results

### Authentication
- JWT (JSON Web Tokens) authentication
- REST framework JWT configuration

### Vector Storage
- Pinecone integration
- OpenAI embeddings for vector operations

## Starting the Project

1. **Environment Setup**
   - Verify environment variables
   - Activate virtual environment
   - Install dependencies

2. **Run Development Server**
   ```bash
   python manage.py runserver
   ```

3. **Access Points**
   - Admin interface: `http://localhost:8000/admin/`
   - API endpoints: `http://localhost:8000/`

## Additional Notes

### Security Considerations
- Debug mode is enabled (set to `True`)
- Django secret key should be changed in production
- CSRF middleware is currently commented out

### Database Options
- SQLite configured for development
- PostgreSQL configuration available (commented)
- Configurable based on needs

### Error Handling
- Retry logic for Pinecone operations
- Comprehensive error logging

## Project Features
- Phase-based analysis system
- Asynchronous task processing
- Status tracking capabilities
- AI integration through OpenAI
- Vector storage via Pinecone
- RESTful API architecture

## Development Guidelines
1. Keep environment variables secure
2. Run migrations after model changes
3. Test API endpoints thoroughly
4. Monitor error logs for issues
5. Follow Django REST framework best practices

## Production Deployment
Before deploying to production:
1. Change Django secret key
2. Disable debug mode
3. Configure proper database
4. Set up proper CORS headers
5. Enable CSRF protection
6. Configure proper static file serving
7. Set up proper error logging
8. Configure proper caching
