# Intelligent Road Traffic Management System (IRTMS)

An intelligent, traffic-aware road management platform designed to monitor road conditions, analyze congestion, predict traffic patterns, recommend routes, manage traffic alerts, and provide operational analytics through a web-based dashboard.

## Features

- Real-time traffic monitoring
- TomTom traffic data integration
- Traffic congestion classification
- Traffic prediction and peak-hour analysis
- Traffic-aware route planning
- Alternative route comparison
- Active traffic alerts and alert management
- Traffic analytics and trends
- Road performance analysis
- Interactive traffic maps
- Role-based user management
- JWT-based authentication
- Responsive dashboard interface
- Dockerized backend and frontend

## Technology Stack

### Frontend
- React
- Vite
- JavaScript / JSX
- Leaflet
- Axios
- CSS

### Backend
- Python
- FastAPI
- SQLAlchemy
- SQLite
- JWT authentication
- Uvicorn

### External Services
- TomTom Traffic APIs
- OpenStreetMap tiles through Leaflet

### Deployment
- Docker
- Docker Compose
- GitHub
- Render

## Project Structure

```text
Intelligent Road Traffic Management System (IRTMS)/
│
├── backend/
│   ├── app/
│   │   ├── core/
│   │   ├── models/
│   │   ├── modules/
│   │   │   ├── alerts/
│   │   │   ├── analytics/
│   │   │   ├── route_analysis/
│   │   │   ├── traffic_monitoring/
│   │   │   ├── traffic_prediction/
│   │   │   ├── user_management/
│   │   │   └── workflow/
│   │   ├── main.py
│   │   └── ...
│   ├── requirements.txt
│   ├── Dockerfile
│   └── render.yaml
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── style.css
│   └── package.json
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## Application Modules

### Dashboard
Provides a centralized overview of monitored traffic points, average traffic speed, congestion levels, vehicles monitored, alerts, system status, and current road conditions.

### Live Monitoring
Displays current traffic conditions and monitored road locations using live traffic data and an interactive map.

### Traffic Prediction
Provides traffic prediction information and peak-hour analysis to support traffic planning and operational decisions.

### Route Planner
Allows users to enter source and destination locations, receive location suggestions, calculate traffic-aware routes, and compare available route alternatives.

### Alerts
Displays active traffic alerts, severity information, traffic conditions, and alert status.

### Analytics
Provides traffic heatmaps, trends, road-performance information, and other traffic analytics.

### User Management
Allows authorized users to view registered users, manage roles, and activate or deactivate accounts.

## Authentication

The backend uses JWT-based authentication.

Protected API endpoints require an access token obtained through the authentication flow. User roles are used to control access to operational and administrative functionality.

## Environment Variables

Create a `.env` file in the project root based on `.env.example`.

Example:

```env
DATABASE_URL=sqlite:///./irtms.db
SECRET_KEY=replace-with-a-secure-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
TOMTOM_API_KEY=your-tomtom-api-key
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:8000
```

### Security

Never commit `.env` or real API keys to GitHub.

For production deployments, configure secrets through the hosting platform's environment-variable settings.

## Running Locally

### Backend

Open a terminal in the backend directory:

```bash
cd backend
```

Create and activate a virtual environment:

```bash
python -m venv .venv
```

Windows:

```powershell
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:

```text
http://localhost:8000
```

FastAPI documentation:

```text
http://localhost:8000/docs
```

Health check:

```text
http://localhost:8000/health
```

### Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

## Running with Docker

From the project root:

```bash
docker compose build
docker compose up -d
```

Check running containers:

```bash
docker ps
```

Stop the application:

```bash
docker compose down
```

The default services are:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8000
API Docs: http://localhost:8000/docs
```

## Testing

Backend tests can be run from the backend directory:

```bash
python -m pytest
```

Frontend production build:

```bash
cd frontend
npm run build
```

## API Overview

The FastAPI backend provides APIs for:

```text
/api/auth
/api/alerts
/api/analytics
/api/prediction
/api/traffic
/api/route
```

The exact endpoints and request/response schemas are available through the FastAPI Swagger documentation at:

```text
http://localhost:8000/docs
```

## Data Sources

Traffic monitoring can use TomTom traffic data through the backend integration.

The TomTom API key is configured on the backend through the `TOMTOM_API_KEY` environment variable. The key should never be exposed in frontend source code or committed to the repository.

## Deployment

The project is structured for containerized deployment and can be deployed using Docker and cloud services such as Render.

A production deployment should configure:

- `DATABASE_URL`
- `SECRET_KEY`
- `TOMTOM_API_KEY`
- `FRONTEND_URL`
- `VITE_API_URL`

Production secrets should be configured through environment variables rather than committed configuration files.

For persistent production data, use an appropriate persistent database/storage configuration rather than relying on an ephemeral local SQLite database.

## Development Workflow

Recommended workflow:

```text
Develop
   ↓
Run backend tests
   ↓
Build frontend
   ↓
Test with Docker
   ↓
Verify application workflows
   ↓
Commit changes
   ↓
Push to GitHub
   ↓
Deploy
   ↓
Run production smoke tests
```

## Project Status

The project currently includes the core traffic monitoring, prediction, route planning, alerts, analytics, authentication, and user-management workflows and is structured for Docker-based deployment.

## License

This project is developed for educational, academic, and project demonstration purposes.

Add an appropriate open-source license here if the project is intended for public redistribution.
