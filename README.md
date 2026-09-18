# Intelligent Road Traffic Management System (IRTMS)

An AI-powered intelligent road traffic management system designed to monitor traffic conditions, analyze congestion, predict traffic patterns, generate alerts, and recommend traffic-aware routes.

## Project Overview

The Intelligent Road Traffic Management System (IRTMS) combines real-time traffic data, historical traffic records, analytics, machine learning, route analysis, and role-based access control into a centralized web application.

The system provides:

- Live traffic monitoring
- Traffic congestion analysis
- Automatic traffic alerts
- Historical traffic analytics
- Traffic prediction
- Peak-hour analysis
- Traffic-aware route recommendations
- Road performance analysis
- Traffic heatmaps
- Road utilization analysis
- User authentication and role-based access control
- TomTom traffic data integration

## Project Structure

```text
Traffic_Vision_Ai_Project/
│
├── backend/
│   ├── app/
│   │   ├── core/
│   │   ├── models/
│   │   ├── modules/
│   │   │   ├── traffic_monitoring/
│   │   │   ├── alerts/
│   │   │   ├── analytics/
│   │   │   ├── traffic_prediction/
│   │   │   ├── route_analysis/
│   │   │   ├── user_management/
│   │   │   └── workflow/
│   │   └── main.py
│   ├── requirements.txt
│   ├── runtime.txt
│   ├── render.yaml
│   └── seed_data.py
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── style.css
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md