"""Admin endpoints — revenue, heatmap, fleet, pricing."""
from fastapi import APIRouter, Request, UploadFile, File
from typing import Optional
from pydantic import BaseModel

router = APIRouter()

@router.get("/system-status")
async def get_system_status(request: Request):
    engine = request.app.state.engine
    last_trained = getattr(engine, "last_trained", None)
    is_training  = getattr(engine, "is_training",  False)
    train_error  = getattr(engine, "train_error",  None)
    return {
        "success":     True,
        "is_training": is_training,
        "last_trained": last_trained.isoformat() if last_trained else None,
        "train_error": train_error,
    }


class MLConfigUpdate(BaseModel):
    peak_surge: float
    event_multiplier: float

@router.get("/ml-config")
async def get_ml_config(request: Request):
    engine = request.app.state.engine
    return {"success": True, "config": getattr(engine, "surge_config", {"peak_surge": 1.25, "event_multiplier": 1.50})}

@router.post("/ml-config")
async def update_ml_config(config: MLConfigUpdate, request: Request):
    engine = request.app.state.engine
    engine.surge_config = {
        "peak_surge": config.peak_surge,
        "event_multiplier": config.event_multiplier
    }
    return {"success": True, "message": "ML Configuration updated successfully."}


@router.get("/config/zones")
async def get_zones(request: Request):
    engine = request.app.state.engine
    zones = getattr(engine, "dynamic_zones", ["City Center"])
    return {"success": True, "data": zones}

@router.get("/config/models")
async def get_models(request: Request):
    engine = request.app.state.engine
    models = getattr(engine, "dynamic_models", ["Standard Bike"])
    return {"success": True, "data": models}


@router.post("/upload-dataset")
async def upload_dataset(request: Request, file: UploadFile = File(...)):
    engine = request.app.state.engine
    from core.model_engine import DATA_PATH
    import asyncio, io
    import pandas as pd
    try:
        contents = await file.read()
        if not contents:
            return {"success": False, "error": "Uploaded file is empty."}

        # ── Pre-validate the CSV before overwriting the live dataset ──────────
        try:
            df_check = pd.read_csv(io.BytesIO(contents))
        except Exception as e:
            return {"success": False, "error": f"Could not parse file as CSV: {e}"}

        if len(df_check) < 48:
            return {"success": False, "error": (
                f"Dataset too small ({len(df_check)} rows). "
                "Need at least 48 rows for SARIMA training."
            )}

        cols_lower = {c.lower() for c in df_check.columns}
        has_cnt   = bool(cols_lower & {"cnt","count","rides","demand","total","num_rides",
                                       "rentals","rented","rented_bikes","booked","usage","trips",
                                       "bookings","hire","hires","bike_count","rental_count"})
        has_date  = bool(cols_lower & {"dteday","date","ds","day","start_date"})
        has_hour  = bool(cols_lower & {"hr","hour","hrs","hour_of_day","hour_num"})
        # Accept any column name that looks like a full datetime / timestamp
        has_dt    = bool(cols_lower & {"datetime","timestamp","ts","time","date_time",
                                       "start_time","end_time","ride_time","trip_time",
                                       "started_at","ended_at","created_at"})
        if not has_cnt or (not has_dt and not (has_date and has_hour)):
            return {"success": False, "error": (
                f"CSV is missing required columns. Found: {list(df_check.columns)}. "
                "Need: a datetime/timestamp column (or date+hour columns), "
                "plus a demand column (cnt/count/rides/demand/trips/rentals/usage)."
            )}

        with open(DATA_PATH, "wb") as buffer:
            buffer.write(contents)

        # Clear any stale error from a previous failed training so polling
        # doesn't immediately fire the error branch on the first tick.
        engine.train_error = None
        engine.is_training = False

        # Retrain SARIMA models in background thread (non-blocking)
        loop = asyncio.get_running_loop()
        loop.run_in_executor(None, engine.train)
        return {"success": True, "message": "Dataset uploaded! SARIMA models are retraining in the background."}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/revenue")
async def get_revenue(request: Request):
    engine = request.app.state.engine
    return {"success": True, "data": engine.get_revenue_data()}


@router.get("/heatmap")
async def get_heatmap(date: Optional[str] = None, request: Request = None):
    engine = request.app.state.engine
    return {"success": True, "data": engine.get_heatmap_data(date)}


@router.get("/pricing/recommend")
async def recommend_price(area: str, hour: int, is_weekend: bool = False, date: Optional[str] = None, request: Request = None):
    engine = request.app.state.engine
    return {"success": True, "data": engine.get_price_recommendation(area, hour, is_weekend, date)}


@router.get("/pricing/hourly-schedule")
async def hourly_price_schedule(area: str = "City Center", is_weekend: bool = False, request: Request = None):
    """Return ML-computed price for every hour (0-23) for the given area."""
    engine = request.app.state.engine
    schedule = []
    for h in range(24):
        rec = engine.get_price_recommendation(area, h, is_weekend)
        schedule.append({
            "hour": h,
            "hour_label": f"{h:02d}:00",
            "price": rec["recommended_price"],
            "surge": rec["surge_multiplier"],
            "demand_index": rec["demand_index"],
            "strategy": rec["strategy"],
        })
    return {"success": True, "data": schedule}


@router.get("/pricing/zone-matrix")
async def zone_price_matrix(is_weekend: bool = False, date: str = None, hour: int = None, request: Request = None):
    """Return ML price recommendation for every zone. If date/hour is provided, forecasts for that date/time."""
    from datetime import datetime
    engine = request.app.state.engine
    current_hour = hour if hour is not None else datetime.now().hour
    is_wknd = datetime.now().weekday() >= 5 or is_weekend
    zones = getattr(engine, "dynamic_zones", ["City Center"])
    matrix = []
    for zone in zones:
        rec = engine.get_price_recommendation(zone, current_hour, is_wknd, date)
        surge = rec["surge_multiplier"]
        demand = ("High" if surge >= 1.17 else ("Moderate" if surge >= 1.08 else "Normal"))
        # Estimate zone revenue from zone intelligence
        zi = engine.get_zone_intelligence()
        zone_data = next((z for z in zi if z["zone"] == zone), {})
        matrix.append({
            "zone": zone,
            "price": rec["recommended_price"],
            "surge": surge,
            "demand": demand,
            "demand_index": rec["demand_index"],
            "revenue": zone_data.get("revenue", 0),
            "rides": zone_data.get("rides", 0),
        })
    return {"success": True, "data": matrix}


@router.get("/fleet")
async def get_fleet(request: Request):
    """Simulated fleet status data with dynamic ML demand scoring."""
    import random
    from datetime import datetime
    
    # Dynamic demand from ML engine
    engine = request.app.state.engine
    current_hour = datetime.now().hour
    is_weekend = datetime.now().weekday() >= 5

    zones = getattr(engine, "dynamic_zones", ["City Center"])
    # If using Bangalore default zones, use realistic fleet numbers
    base_totals = {
        "Indiranagar": 250, "Koramangala": 220, "Whitefield": 180,
        "Marathahalli": 160, "HSR Layout": 190, "Jayanagar": 140,
        "Electronic City": 130, "Hebbal": 110
    }
    # Otherwise fallback to default inventory for dynamic zones, distributed based on traffic weights
    total_weight = sum(getattr(engine, "dynamic_area_weights", {}).values()) or 1.0
    for z in zones:
        if z not in base_totals:
            w = getattr(engine, "dynamic_area_weights", {}).get(z, 1.0)
            # Total synthetic fleet size = len(zones) * 150
            # Distribute proportionally based on historical area weight
            base_totals[z] = max(50, int((w / total_weight) * (len(zones) * 150)))
    
    fleet = []
    for a in zones:
        total = base_totals[a]
        # Pull real demand index from the SARIMA model engine
        ml_data = engine.get_price_recommendation(a, current_hour, is_weekend)
        demand_score = ml_data.get("demand_index", 1.0)
        
        # Base utilization is ~30% of fleet at 1.0 demand
        # As demand spikes to 1.5x, utilization spikes to 45% or higher
        in_use = int(total * 0.35 * demand_score)
        in_use = min(in_use, int(total * 0.85)) # Max 85% in use
        
        # Realistic static percentages for hardware issues
        maintenance = int(total * 0.05)
        low_battery = int(total * 0.04)
        
        available = total - in_use - maintenance

        fleet.append({
            "area": a,
            "total": total,
            "available": available,
            "in_use": in_use,
            "maintenance": maintenance,
            "low_battery": low_battery,
            "demand_score": demand_score,
        })
    return {"success": True, "data": fleet}


@router.get("/fleet/models")
async def get_fleet_models(request: Request):
    """Fleet model stats with ML-derived revenue estimates."""
    import random
    from datetime import datetime
    engine = request.app.state.engine
    current_hour = datetime.now().hour
    is_weekend = datetime.now().weekday() >= 5

    # Get current-hour city-wide demand from SARIMA
    baseline_zone = engine.dynamic_zones[0] if engine.dynamic_zones else "City Center"
    rec = engine.get_price_recommendation(baseline_zone, current_hour, is_weekend)
    demand_idx = rec.get("demand_index", 1.0)
    surge = rec.get("surge_multiplier", 1.0)

    dynamic_models = getattr(engine, "dynamic_models", ["Standard Bike"])
    model_prices = getattr(engine, "dynamic_model_prices", {})

    model_configs = []
    # If the exact Bangalore models are found, use their specific realistic attributes
    default_configs = {
        "Ather 450X":      {"count": 247, "type": "EV",      "avg_battery": True,  "base_rev": 4.2},
        "Bounce Infinity": {"count": 198, "type": "EV",      "avg_battery": True,  "base_rev": 3.1},
        "Yulu Move":       {"count": 156, "type": "EV",      "avg_battery": True,  "base_rev": 1.8},
        "Honda Activa":    {"count": 183, "type": "Scooter", "avg_battery": False, "base_rev": 2.8},
        "Royal Enfield":   {"count":  87, "type": "Premium", "avg_battery": False, "base_rev": 3.4},
        "Rapido Bike":     {"count": 132, "type": "Budget",  "avg_battery": False, "base_rev": 1.4},
    }

    for m in dynamic_models:
        if m in default_configs:
            cfg = default_configs[m].copy()
            cfg["model"] = m
            model_configs.append(cfg)
        else:
            base = model_prices.get(m, 65.0)
            model_configs.append({
                "model": m,
                "count": 100 + random.randint(0, 100),
                "type": "Standard",
                "avg_battery": random.choice([True, False]),
                "base_rev": round((base / 65.0) * 2.5, 1)
            })
    models = []
    for m in model_configs:
        # Determine utilization purely from ML demand index
        in_use = int(m["count"] * 0.35 * demand_idx)
        in_use = min(in_use, int(m["count"] * 0.85))
        
        # Static realistic hardware issues percentage
        issues = int(m["count"] * 0.05)
        
        # Available is deterministically calculated
        available = m["count"] - in_use - issues
        # Revenue scales with current ML demand index
        rev = round(m["base_rev"] * demand_idx * surge, 1)
        entry = {
            "model":    m["model"],
            "count":    m["count"],
            "available": available,
            "type":     m["type"],
            "issues":   issues,
            "revenue":  f"₹{rev}L",
            "demand_idx": round(demand_idx, 2),
        }
        if m["avg_battery"]:
            entry["avg_battery"] = random.randint(60, 95)
        else:
            entry["avg_battery"] = None
        models.append(entry)
    return {"success": True, "data": models}



@router.get("/alerts")
async def get_live_alerts(request: Request):
    """
    Intelligent multi-hour ML-driven alerts with actionable bike rebalancing recommendations.
    Scans the next 3 hours across all zones using SARIMA predictions, identifies demand imbalances,
    and generates specific move-bikes-from-X-to-Y instructions.
    """
    from datetime import datetime, timedelta
    engine = request.app.state.engine
    alerts = []
    now = datetime.now()

    areas = getattr(engine, "dynamic_zones", ["City Center"])

    # Base fleet counts per area (mirrors fleet endpoint)
    base_fleet = {
        "Indiranagar": 250, "Koramangala": 220, "Whitefield": 180,
        "Marathahalli": 160, "HSR Layout": 190, "Jayanagar": 140,
        "Electronic City": 130, "Hebbal": 110
    }
    total_weight = sum(getattr(engine, "dynamic_area_weights", {}).values()) or 1.0
    for z in areas:
        if z not in base_fleet:
            w = getattr(engine, "dynamic_area_weights", {}).get(z, 1.0)
            base_fleet[z] = max(50, int((w / total_weight) * (len(areas) * 150)))

    # ── STEP 1: Scan next 3 hours across all zones ───────────────────────────
    # For each future hour, get SARIMA demand + surge for every area
    horizon = []  # list of (hour_offset, hour_val, area, surge, demand_idx, available_bikes)
    for h_offset in range(1, 4):
        future = now + timedelta(hours=h_offset)
        fh = future.hour
        is_wknd = future.weekday() >= 5
        date_str = future.strftime("%Y-%m-%d")
        hour_str = future.strftime("%I:%M %p").lstrip("0")

        for area in areas:
            rec = engine.get_price_recommendation(area, fh, is_wknd, date=date_str)
            surge     = rec.get("surge_multiplier", 1.0)
            demand    = rec.get("demand_index", 1.0)
            total     = base_fleet[area]
            in_use    = min(int(total * 0.35 * demand), int(total * 0.85))
            available = total - in_use - int(total * 0.05)  # minus maintenance
            horizon.append({
                "h_offset": h_offset,
                "hour_str": hour_str,
                "area": area,
                "surge": surge,
                "demand": demand,
                "available": available,
                "total": total,
            })

    # ── STEP 2: Find the HOTTEST zone in the next 3 hours ────────────────────
    horizon_sorted_high = sorted(horizon, key=lambda x: x["surge"], reverse=True)
    hot  = horizon_sorted_high[0]   # highest surge zone + hour

    # Find the COOLEST zone at the same future hour (donor zone)
    same_hour_zones = [z for z in horizon if z["h_offset"] == hot["h_offset"]]
    same_hour_sorted_low = sorted(same_hour_zones, key=lambda x: x["surge"])
    cool = same_hour_sorted_low[0]  # lowest surge zone at that hour

    # ── STEP 3: Compute how many bikes to move ────────────────────────────────
    # Deficit = how many more bikes the hot zone needs at that surge level
    # Surplus = how many extra bikes the cool zone can spare
    hot_deficit  = max(0, int(hot["total"]  * 0.35 * hot["surge"])  - hot["available"])
    cool_surplus = max(0, cool["available"] - int(cool["total"] * 0.35))
    bikes_to_move = min(hot_deficit, cool_surplus, 30)  # cap at 30 bikes per alert
    bikes_to_move = max(bikes_to_move, 5)  # always recommend at least 5

    # ── STEP 4: Generate ALERT 1 — Surge Spike Warning ───────────────────────
    alerts.append({
        "type": "critical",
        "title": "Surge Spike Predicted",
        "msg": (
            f"SARIMA forecasts {hot['surge']:.2f}x surge in {hot['area']} "
            f"at {hot['hour_str']} (demand index: {hot['demand']:.2f}). "
            f"Only {hot['available']} bikes currently available."
        ),
        "action": None,
        "time": "Just now",
        "area_high": hot["area"],
        "area_low": None,
        "bikes": None,
    })

    # ── STEP 5: Generate ALERT 2 — Rebalancing Action Required ───────────────
    alerts.append({
        "type": "rebalance",
        "title": "⚡ Rebalancing Required",
        "msg": (
            f"Move {bikes_to_move} bikes from {cool['area']} "
            f"({cool['surge']:.2f}x — low demand, {cool['available']} idle) "
            f"→ {hot['area']} before {hot['hour_str']} to meet predicted surge demand."
        ),
        "action": f"Move {bikes_to_move} bikes: {cool['area']} → {hot['area']}",
        "time": "Just now",
        "area_high": hot["area"],
        "area_low": cool["area"],
        "bikes": bikes_to_move,
    })

    # ── STEP 6: Scan for a 2nd independent surge zone (different from hot) ───
    other_hot_list = [z for z in horizon_sorted_high if z["area"] != hot["area"]]
    if other_hot_list:
        other_hot  = other_hot_list[0]
        other_cool_list = [
            z for z in horizon if z["h_offset"] == other_hot["h_offset"] and z["area"] != other_hot["area"]
        ]
        other_cool_sorted = sorted(other_cool_list, key=lambda x: x["surge"])
        if other_cool_sorted:
            other_cool = other_cool_sorted[0]
            other_bikes = max(5, min(15, int(other_hot["total"] * 0.1)))
            alerts.append({
                "type": "rebalance",
                "title": "Secondary Demand Zone",
                "msg": (
                    f"Moderate demand rising in {other_hot['area']} at {other_hot['hour_str']} "
                    f"({other_hot['surge']:.2f}x surge). Recommend moving {other_bikes} bikes "
                    f"from {other_cool['area']} as a precaution."
                ),
                "action": f"Move {other_bikes} bikes: {other_cool['area']} → {other_hot['area']}",
                "time": "1 min ago",
                "area_high": other_hot["area"],
                "area_low": other_cool["area"],
                "bikes": other_bikes,
            })

    # ── STEP 7: System heartbeat alert ───────────────────────────────────────
    alerts.append({
        "type": "info",
        "title": "ML Engine Active",
        "msg": f"SARIMA models scanning {len(areas)} zones across 3-hour horizon. Last trained on historical uploaded dataset.",
        "action": None,
        "time": "Live",
        "area_high": None,
        "area_low": None,
        "bikes": None,
    })

    return {"success": True, "data": alerts}


@router.get("/customers/analytics")
async def customer_analytics(request: Request):
    return {
        "success": True,
        "data": {
            "total_customers": 12847,
            "returning_users": 8341,
            "high_spend_users": 1204,
            "churn_risk": 673,
            "new_this_month": 891,
            "avg_ltv": 4820,
            "segments": [
                {"name":"Daily Commuters","count":4120,"avg_rides":22,"color":"#3B82F6"},
                {"name":"Weekend Riders","count":3210,"avg_rides":8,"color":"#10B981"},
                {"name":"Occasional","count":3870,"avg_rides":3,"color":"#F59E0B"},
                {"name":"Power Users","count":1647,"avg_rides":31,"color":"#8B5CF6"},
            ]
        }
    }


@router.get("/reports/monthly")
async def monthly_report(request: Request):
    engine = request.app.state.engine
    import pandas as pd
    df = engine.df

    COMBO_SCALE = max(1, len(engine.dynamic_zones)) if hasattr(engine, "dynamic_zones") else 1
    avg_price = float(df["final_price"].mean()) if "final_price" in df.columns else 65.0

    # 1. Historical monthly data (Use engine.monthly_ts to inherit the incomplete month filtering)
    historical_data = []
    if hasattr(engine, "monthly_ts"):
        for idx, row in engine.monthly_ts.iterrows():
            period = f"{idx.year}-{idx.month:02d}"
            rides = int(row["cnt"] / COMBO_SCALE)
            revenue = round((rides * avg_price) / 100000, 1)  # → ₹L
            historical_data.append({
                "period": period,
                "rides": rides,
                "revenue": revenue
            })

    # 2. SARIMA Forecast (trained on the same scale → divide by same factor)
    forecast_data = engine.get_monthly_forecast()

    forecast_records = []
    for f in forecast_data:
        dt = pd.to_datetime(f["dt"])
        period  = f"{dt.year}-{dt.month:02d}"
        rides   = max(0, int(f["demand"] / COMBO_SCALE))          # scale to realistic rides
        revenue = round((rides * avg_price) / 100000, 1)           # rupees → ₹L
        forecast_records.append({
            "period":      period,
            "rides":       rides,
            "revenue":     revenue,
            "is_forecast": True,
        })

    combined_data = historical_data + forecast_records
    return {"success": True, "data": combined_data}


@router.get("/zone-intelligence")
async def get_zone_intelligence(request: Request):
    engine = request.app.state.engine
    return {"success": True, "data": engine.get_zone_intelligence()}

@router.get("/pricing/events")
async def event_pricing_list(request: Request = None):
    """Return dynamic festival and event pricing extracted from historical SARIMA ML data."""
    engine = request.app.state.engine
    events = engine.get_event_pricing()
    return {"success": True, "data": events}
