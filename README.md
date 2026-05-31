# 🏍️ BikeSense AI — Intelligent Bike Demand Forecasting

> **Production-grade** AI-powered bike rental demand forecasting platform for Bangalore's mobility ecosystem.  
> Built with SARIMA/SARIMAX on 17,379 real hourly records · Two role-based dashboards · Investor-ready.

## 🌐 Live Demo

**Frontend (Vercel):** https://frontend-nine-lyart-78.vercel.app

> Sign up with any email → choose **Admin** (fleet operator) or **Consumer** (rider) role.  
> Demo accounts: `admin@bikesense.ai` / `Admin@1234` · `rider@bikesense.ai` / `Rider@1234` (create via Sign Up first)

---

## 🎯 What Is BikeSense?

BikeSense is a **dual-dashboard SaaS platform** serving two audiences:

| Audience | Dashboard | Purpose |
|---|---|---|
| 🏢 Rental Operators | Admin Console | Fleet management, revenue analytics, AI demand forecasting, dynamic pricing |
| 🚲 Consumers/Riders | Rider Dashboard | Smart price prediction, best-time advisor, bike marketplace, loyalty rewards |

---

## 🧠 ML Architecture

```
3-Horizon SARIMA Engine
│
├── Short-Term  → SARIMA(0,1,1)(0,1,1,24)  → 7-day  hourly  forecast
├── Medium-Term → SARIMA(1,1,2)(1,1,1,7)   → 30-day daily   forecast  
└── Long-Term   → SARIMA(0,1,0)(0,1,1,12)  → 12-month monthly forecast

Dataset: 17,379 hourly records · Bangalore · Apr 2024 – Apr 2026
Areas: 8 Bangalore zones (Indiranagar, Koramangala, Whitefield, etc.)
Models: 6 bike types (Ather 450X, Bounce Infinity, Yulu Move, etc.)

Dynamic Pricing Tiers:
  ×1.00  → Standard   (₹65.00)  Low demand
  ×1.08  → Moderate   (₹70.20)  Mid demand
  ×1.17  → High       (₹76.05)  High demand
  ×1.25  → Peak Surge (₹81.25)  Rush hours / festivals
```

---

## 🏗️ Tech Stack

### Frontend (Next.js 15)
| Layer | Tech |
|---|---|
| Framework | Next.js 15 + React 18 + TypeScript |
| Styling | Tailwind CSS (glassmorphism + neon design) |
| Animations | Framer Motion |
| Charts | Recharts |
| Auth | Clerk (role-based: admin / consumer) |
| Fonts | Space Grotesk + DM Sans + JetBrains Mono |

### Backend (FastAPI Python)
| Layer | Tech |
|---|---|
| API | FastAPI + Uvicorn |
| ML | statsmodels SARIMA/SARIMAX |
| Data | pandas + numpy |
| DB | PostgreSQL + Prisma ORM |

### Infrastructure
| Layer | Tech |
|---|---|
| Frontend deploy | Vercel |
| ML service deploy | Railway / Render |
| Database | Supabase (PostgreSQL) |
| Container | Docker + Docker Compose |

---

## 📁 Project Structure

```
bikesense/
│
├── frontend/                    # Next.js 15 app
│   ├── app/
│   │   ├── page.tsx             # ★ Landing page (investor-ready)
│   │   ├── layout.tsx           # Root layout + Clerk + fonts
│   │   ├── globals.css          # Design system (glassmorphism, tokens)
│   │   ├── auth/
│   │   │   ├── login/page.tsx   # Sign-in page
│   │   │   └── signup/page.tsx  # Sign-up + role selection
│   │   ├── admin/
│   │   │   ├── layout.tsx       # Admin sidebar + header
│   │   │   ├── dashboard/       # KPIs, revenue, alerts
│   │   │   ├── forecasting/     # SARIMA charts, heatmaps
│   │   │   ├── pricing/         # Dynamic pricing engine
│   │   │   ├── fleet/           # Fleet health, rebalancing
│   │   │   ├── analytics/       # Customer analytics
│   │   │   └── reports/         # Export PDF/CSV
│   │   └── consumer/
│   │       ├── layout.tsx       # Rider sidebar + header
│   │       ├── home/            # Search, predictor, nearby bikes
│   │       ├── predict/         # Full price predictor
│   │       ├── marketplace/     # Bike listing + filters + booking
│   │       ├── best-time/       # When to rent advisor
│   │       └── profile/         # Bookings, loyalty, settings
│   ├── lib/api.ts               # ML API client
│   ├── middleware.ts            # Clerk role-based route protection
│   └── tailwind.config.js      # Extended design tokens
│
├── ml-service/                  # FastAPI Python microservice
│   ├── main.py                  # FastAPI app + CORS + lifespan
│   ├── core/
│   │   └── model_engine.py      # ★ SARIMA training + prediction engine
│   ├── routers/
│   │   ├── predict.py           # POST /predict-demand, /predict-price
│   │   ├── admin.py             # GET /admin/revenue, /heatmap, /fleet
│   │   └── consumer.py         # GET /consumer/bikes, /best-time
│   ├── requirements.txt
│   └── Dockerfile
│
├── db/
│   └── schema.prisma            # Full database schema
│
├── docker-compose.yml           # Full stack local dev
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- PostgreSQL 15+

### 1. Clone & Setup

```bash
git clone <your-repo>
cd bikesense
```

### 2. ML Service

```bash
cd ml-service
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Copy dataset
cp /path/to/bike_data.csv .

# Start ML server
uvicorn main:app --reload --port 8000
```

The ML service will:
1. Load or generate the dataset
2. Train all 3 SARIMA models (takes ~60-90s on first run)
3. Cache 7-day, 30-day, and 12-month forecasts
4. Serve predictions at http://localhost:8000

### 3. Frontend

```bash
cd frontend

# Install deps
npm install

# Configure environment
cp .env.local.example .env.local
# Fill in your Clerk keys from https://dashboard.clerk.com
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
# CLERK_SECRET_KEY=sk_test_...

# Start dev server
npm run dev
```

Open http://localhost:3000

### 4. Database (optional for local dev)

```bash
# Install Prisma
npm install -g prisma

cd db
# Update DATABASE_URL in .env
prisma generate
prisma db push
```

---

## 🔑 Clerk Setup

1. Create account at [clerk.com](https://clerk.com)
2. Create a new application
3. Copy Publishable Key and Secret Key to `.env.local`
4. In Clerk Dashboard → Configure → Sessions → Enable **unsafe metadata**
5. The app stores `{ role: "admin" | "consumer" }` in unsafeMetadata during signup

---

## 🌐 API Reference

### ML Service Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/predict-demand` | Demand forecast for given datetime + location |
| POST | `/api/v1/predict-price` | Price prediction with surge level |
| GET | `/api/v1/forecast/short` | 7-day hourly forecast series |
| GET | `/api/v1/forecast/daily` | 30-day daily forecast |
| GET | `/api/v1/forecast/monthly` | 12-month forecast |
| GET | `/api/v1/admin/revenue` | Revenue KPIs |
| GET | `/api/v1/admin/heatmap` | Zone × Hour demand matrix |
| GET | `/api/v1/admin/fleet` | Fleet status by zone |
| GET | `/api/v1/admin/pricing/recommend` | Price recommendation for zone/hour |
| GET | `/api/v1/consumer/bikes` | Available bikes (with filters) |
| GET | `/api/v1/consumer/best-time` | Cheapest rental hours |
| GET | `/api/v1/consumer/recommendations` | Personalised recommendations |
| GET | `/api/v1/consumer/price-trend` | 7-day price trend for consumer |

### Predict Demand — Example

```bash
curl -X POST http://localhost:8000/api/v1/predict-demand \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-05-10",
    "time": "09:00",
    "location": "Indiranagar",
    "bike_model": "Ather 450X"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "datetime": "Saturday, 10 May 2026 09:00",
    "location": "Indiranagar",
    "expected_demand": 42.3,
    "confidence_interval": [31.2, 53.4],
    "demand_level": "High",
    "surge_multiplier": 1.25,
    "base_price": 65.0,
    "predicted_price": 81.25,
    "price_label": "Peak Surge",
    "savings_vs_peak": 0
  }
}
```

---

## ☁️ Deployment

### Vercel (Frontend)

```bash
cd frontend
npx vercel --prod

# Set environment variables in Vercel dashboard:
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
# CLERK_SECRET_KEY
# NEXT_PUBLIC_ML_API_URL=https://your-ml-service.railway.app
# DATABASE_URL
```

### Railway (ML Service)

1. Push `ml-service/` folder to GitHub
2. Create new Railway project → Deploy from GitHub
3. Set `DATA_PATH` environment variable
4. Railway will auto-detect the Dockerfile

### Docker Compose (Self-hosted)

```bash
# Build and run everything
docker-compose up --build

# Services:
# http://localhost:3000  → Frontend
# http://localhost:8000  → ML API
# localhost:5432         → PostgreSQL
```

---

## 📊 Dataset Schema

The enriched Bangalore bike dataset includes:

| Column | Type | Description |
|---|---|---|
| dteday | date | Date of record |
| hr | int | Hour (0–23) |
| datetime | datetime | Full timestamp |
| cnt | int | Total bike count / demand |
| temp | float | Temperature (°C) |
| hum | float | Humidity (%) |
| windspeed | float | Wind speed (km/h) |
| traffic_factor | float | Traffic congestion index |
| weather_condition | string | Clear, Cloudy, Rain, etc. |
| holiday_flag | int | 1 = holiday |
| weekend_flag | int | 1 = weekend |
| area_name | string | Bangalore zone |
| bike_model | string | Bike type |
| base_price | float | Base rental price (₹) |
| surge_multiplier | float | Dynamic surge (1.0–1.25) |
| final_price | float | Final rental price (₹) |
| zone | string | City zone grouping |

---

## 🎨 Design System

The UI uses a **Neo-Futuristic Mobility** aesthetic:

- **Glassmorphism** cards with backdrop blur
- **Gradient borders** with indigo–cyan palette
- **Neon accents**: `#6366f1` (brand) · `#00f5ff` (cyan) · `#00ff88` (green)
- **Fonts**: Space Grotesk (display) + DM Sans (body) + JetBrains Mono (code)
- **Dark-first** design: `#020617` base · `#0f172a` surface · `#1e293b` card
- **Framer Motion** page transitions + staggered animations

---

## 🔮 Roadmap

- [ ] Real-time WebSocket demand updates
- [ ] Voice search (Web Speech API)
- [ ] Push notifications for surge alerts
- [ ] Multi-city expansion (Mumbai, Pune)
- [ ] Carbon footprint tracker (EV vs petrol)
- [ ] B2B API for third-party integrations
- [ ] Mobile app (React Native)

---

## 📄 License

MIT License · Built for Bangalore's mobility ecosystem · © 2026 BikeSense AI

---

**Built with ❤️ using SARIMA · Next.js · FastAPI · Clerk**

