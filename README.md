# 🛡️ SHEild — AI-Assisted Public Safety Platform

**Smart technology for safer communities.**

SHEild is an open-innovation hackathon project focused on public safety, crime awareness, and accessible emergency information. Initially focused on Amritsar, Punjab, India, the platform aims to bring useful safety information together in one place.

## 🎯 Problem Statement

People often lack access to organized, location-based safety information. Details about reported incidents, emergency facilities, and personal safety resources are scattered across different sources.

SHEild aims to make this information easier to access through an interactive, technology-driven platform.

## ✨ Key Features

- 🗺️ **Interactive Safety Map:** Google Maps integration centered on Amritsar.
- 🚨 **Incident Awareness:** Map-based visualization of reported incidents.
- 🏥 **Emergency Facilities:** Display of available police stations and hospitals when verified data is available.
- 📊 **Safety Dashboard:** Centralized safety information and visual insights.
- 📋 **Crime Reports:** Dedicated section for crime-related information.
- 👥 **Trusted Contacts:** Emergency contact management.
- 🛡️ **Safety Resources:** Personal safety awareness and helpful information.

## 🤖 OpenAI & ChatGPT — AI Technology

OpenAI technologies are part of the SHEild development approach.

**OpenAI ChatGPT usage:**
- Project planning and problem-solving.
- AI-assisted coding and debugging.
- Frontend and backend development assistance.
- Documentation and technical explanations.
- Brainstorming future AI-powered safety features.

**Planned AI capabilities:**
- AI-assisted analysis of verified incident reports.
- Natural-language summaries of safety information.
- Intelligent safety information assistance.
- Context-aware safety recommendations based on reliable information.

**AI integration status:** ChatGPT is used as a development assistant. Runtime integration through the OpenAI API is a planned enhancement, not a currently verified application feature.

## 🧰 Technology Stack

| Component | Technology |
|---|---|
| Frontend | React 19 |
| Build Tool | Vite |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Backend | Python, FastAPI |
| Maps | Google Maps JavaScript API |
| Charts | Recharts |
| Icons | Lucide React |
| AI Development Assistant | OpenAI ChatGPT |
| Planned AI API | OpenAI API |

## 🏗️ System Architecture

```text
                 SHEild Platform
                       |
          +------------+------------+
          |                         |
       Frontend                  Backend
  React + TypeScript             FastAPI
          |                         |
          |                     Database
          |
    Google Maps API

    OpenAI ChatGPT
    Development Assistance

    OpenAI API
    Planned AI Integration
```

## 🚀 Getting Started

### Prerequisites
- Node.js and npm
- Python 3
- Git
- Google Maps API key

### Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/SHEild.git
cd SHEild
```

### Frontend setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
VITE_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```

Start the frontend:

```bash
npm run dev
```

Open `http://localhost:5173`.

### Backend setup

```bash
cd backend
python -m venv .venv
```

Activate on Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the backend:

```bash
uvicorn main:app --reload
```

API documentation: `http://127.0.0.1:8000/docs`

*The backend command assumes the FastAPI instance is named `app` in `main.py`.*

## 🔮 Future Scope

- OpenAI API integration for intelligent safety assistance.
- AI-assisted incident report summarization.
- Improved emergency facility coverage.
- Real-time verified safety information where data sources permit.
- Emergency alerts and trusted-contact workflows.
- Multilingual support.
- Expansion to additional cities.

## 🔐 Security & Privacy

- API keys and secrets must never be committed to GitHub.
- Incident information should include sources and dates.
- Approximate locations must be clearly identified.
- Personal information should be protected through appropriate security controls.

## 📍 Project Information

| Detail | Information |
|---|---|
| Project | SHEild |
| Category | AI / Public Safety / Social Impact |
| Initial Focus | Amritsar, Punjab, India |
| AI Technology | OpenAI ChatGPT |
| Development | Open Innovation Hackathon |

---

**SHEild — Technology with a purpose. Building safer communities through innovation.** 🛡️