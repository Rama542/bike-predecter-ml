"""
BikeSense Auth Router — Email OTP Verification
────────────────────────────────────────────────
POST /api/v1/auth/send-verification  →  generate OTP + send email
POST /api/v1/auth/verify-code        →  validate OTP

Email sending:
  • If SMTP_USER + SMTP_PASSWORD env vars are set → real email via Gmail SMTP
  • Otherwise → DEV MODE: OTP printed to server console & returned in response
    (safe for local development; disable before production)
"""

import os
import json
import random
import string
import smtplib
import logging
import pathlib
import tempfile
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timedelta
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger("bikesense.auth")

# ── Persistent OTP Store (JSON file) ──────────────────────────────────────────
# Survives uvicorn auto-reloads and server restarts.
# Uses tempfile.gettempdir() so this works on Linux (/tmp), macOS, and Windows.
_OTP_FILE = pathlib.Path(tempfile.gettempdir()) / "bikesense_otp_store.json"

def _load_otp_store() -> dict:
    """Load OTP store from disk, dropping any expired entries."""
    if not _OTP_FILE.exists():
        return {}
    try:
        raw = json.loads(_OTP_FILE.read_text())
        now = datetime.now().isoformat()
        # Only keep non-expired records
        return {k: v for k, v in raw.items() if v.get("expires_at", "") > now}
    except Exception:
        return {}

def _save_otp_store(store: dict) -> None:
    """Persist OTP store to disk (datetime values stored as ISO strings)."""
    try:
        serialisable = {}
        for email, record in store.items():
            serialisable[email] = {
                k: (v.isoformat() if isinstance(v, datetime) else v)
                for k, v in record.items()
            }
        _OTP_FILE.write_text(json.dumps(serialisable))
    except Exception as e:
        logger.warning(f"Could not persist OTP store: {e}")


# ── SMTP Config ───────────────────────────────────────────────────────────────
# Re-read on every call (not module-level) so .env changes take effect
# immediately after uvicorn reloads without needing a full restart.
def _smtp_config():
    host     = os.getenv("SMTP_HOST",      "smtp.gmail.com")
    port     = int(os.getenv("SMTP_PORT",  "587"))
    user     = os.getenv("SMTP_USER",      "")
    password = os.getenv("SMTP_PASSWORD",  "")
    name     = os.getenv("SMTP_FROM_NAME", "BikeSense AI")
    dev_mode = not (user and password)
    return host, port, user, password, name, dev_mode


def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def _send_email(to_email: str, otp: str) -> bool:
    """Send OTP email via SMTP. Returns True on success."""
    host, port, user, password, name, _ = _smtp_config()
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Your BikeSense verification code: {otp}"
        msg["From"]    = f"{name} <{user}>"
        msg["To"]      = to_email

        html = f"""
        <html><body style="font-family:sans-serif;background:#0f172a;color:#f1f5f9;padding:40px;">
          <div style="max-width:480px;margin:auto;background:#1e293b;border-radius:16px;padding:40px;border:1px solid rgba(99,102,241,0.2);">
            <div style="text-align:center;margin-bottom:24px;">
              <div style="display:inline-block;background:#6366f1;border-radius:12px;padding:12px 20px;">
                <span style="font-size:20px;font-weight:bold;color:white;">🚲 BikeSense AI</span>
              </div>
            </div>
            <h2 style="color:#f1f5f9;text-align:center;margin-bottom:8px;">Verify your email</h2>
            <p style="color:#94a3b8;text-align:center;margin-bottom:32px;">
              Enter this code in the BikeSense app to complete your sign-up.
            </p>
            <div style="background:#0f172a;border-radius:12px;padding:24px;text-align:center;letter-spacing:12px;font-size:36px;font-weight:bold;color:#6366f1;font-family:monospace;border:1px solid rgba(99,102,241,0.3);">
              {otp}
            </div>
            <p style="color:#64748b;font-size:13px;text-align:center;margin-top:24px;">
              This code expires in <strong style="color:#94a3b8;">10 minutes</strong>.<br/>
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        </body></html>
        """
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(host, port) as server:
            server.ehlo()
            server.starttls()
            server.login(user, password)
            server.sendmail(user, to_email, msg.as_string())

        logger.info(f"✅ Verification email sent to {to_email}")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to send email to {to_email}: {e}")
        return False


# ── Request / Response Models ─────────────────────────────────────────────────

class SendVerificationRequest(BaseModel):
    email: str
    name: str = "User"

class VerifyCodeRequest(BaseModel):
    email: str
    code: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/send-verification")
async def send_verification(body: SendVerificationRequest):
    """Generate OTP and send verification email."""
    _, _, _, _, _, dev_mode = _smtp_config()
    email = body.email.lower().strip()

    store = _load_otp_store()

    # Rate-limit: allow resend only after 60 seconds
    if email in store:
        existing = store[email]
        sent_at_str = existing.get("sent_at", "")
        try:
            sent_at = datetime.fromisoformat(sent_at_str)
            seconds_since_sent = (datetime.now() - sent_at).total_seconds()
            if seconds_since_sent < 60:
                return {
                    "success": False,
                    "error": f"Please wait {int(60 - seconds_since_sent)}s before requesting a new code."
                }
        except Exception:
            pass  # Malformed timestamp — allow resend

    otp = _generate_otp()
    now = datetime.now()
    store[email] = {
        "otp":        otp,
        "sent_at":    now.isoformat(),
        "expires_at": (now + timedelta(minutes=10)).isoformat(),
        "attempts":   0,
    }
    _save_otp_store(store)

    if dev_mode:
        logger.warning(f"🔑 [DEV MODE] OTP for {email}: {otp}")
        return {
            "success":  True,
            "dev_mode": True,
            "dev_otp":  otp,
            "message":  f"[Dev Mode] Your OTP is {otp} — shown here because no SMTP is configured.",
        }
    else:
        sent = _send_email(email, otp)
        if not sent:
            return {"success": False, "error": "Failed to send email. Please try again."}
        return {
            "success":  True,
            "dev_mode": False,
            "message":  f"Verification code sent to {email}. Check your inbox.",
        }


@router.post("/verify-code")
async def verify_code(body: VerifyCodeRequest):
    """Validate a submitted OTP against the stored one."""
    email  = body.email.lower().strip()
    store  = _load_otp_store()
    record = store.get(email)

    if not record:
        return {"success": False, "error": "No verification code found. Please click 'Resend code' to get a new one."}

    now_str = datetime.now().isoformat()
    if now_str > record.get("expires_at", ""):
        store.pop(email, None)
        _save_otp_store(store)
        return {"success": False, "error": "Code has expired. Please request a new one."}

    record["attempts"] = record.get("attempts", 0) + 1
    if record["attempts"] > 5:
        store.pop(email, None)
        _save_otp_store(store)
        return {"success": False, "error": "Too many attempts. Please request a new code."}

    if body.code.strip() != record["otp"]:
        store[email] = record
        _save_otp_store(store)
        remaining = 5 - record["attempts"]
        return {"success": False, "error": f"Incorrect code. {remaining} attempt(s) remaining."}

    # ✅ Verified — remove from store
    store.pop(email, None)
    _save_otp_store(store)
    return {"success": True, "message": "Email verified successfully."}


# Server-side User Registry
# Uses tempfile.gettempdir() for cross-platform compatibility.
_USER_FILE = pathlib.Path(tempfile.gettempdir()) / "bikesense_user_registry.json"

def _load_user_registry() -> dict:
    if not _USER_FILE.exists():
        return {}
    try:
        return json.loads(_USER_FILE.read_text())
    except Exception:
        return {}

def _save_user_registry(registry: dict) -> None:
    try:
        _USER_FILE.write_text(json.dumps(registry))
    except Exception as e:
        logger.warning(f"Could not persist user registry: {e}")


class RegisterUserRequest(BaseModel):
    id:         str
    firstName:  str
    lastName:   str
    email:      str
    role:       str          # "admin" | "consumer"
    createdAt:  str


@router.post("/register")
async def register_user(body: RegisterUserRequest):
    """
    Called by the frontend after OTP verification + local account creation.
    Stores a copy of the user profile server-side for developer visibility.
    """
    _user_registry = _load_user_registry()
    email = body.email.lower().strip()

    # Prevent duplicate registrations (same email)
    existing = next((u for u in _user_registry.values() if u["email"] == email), None)
    if existing:
        # Update existing record (e.g. re-registration after password reset)
        _user_registry[body.id] = {**existing, "lastSeenAt": datetime.now().isoformat()}
        _save_user_registry(_user_registry)
        return {"success": True, "message": "User record updated."}

    _user_registry[body.id] = {
        "id":          body.id,
        "firstName":   body.firstName,
        "lastName":    body.lastName,
        "email":       email,
        "role":        body.role,
        "createdAt":   body.createdAt,
        "registeredAt": datetime.now().isoformat(),
        "lastSeenAt":  datetime.now().isoformat(),
        "verified":    True,
    }
    _save_user_registry(_user_registry)
    logger.info(f"✅ New user registered: {body.firstName} {body.lastName} ({email}) as {body.role}")
    return {"success": True, "message": "User registered successfully."}


@router.get("/users")
async def list_users():
    """
    Developer endpoint — returns all registered users sorted by registration date.
    In production: protect this with an admin API key header.
    """
    _user_registry = _load_user_registry()
    users = sorted(_user_registry.values(), key=lambda u: u["registeredAt"], reverse=True)
    return {
        "success": True,
        "total": len(users),
        "users": users,
    }


@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    """Remove a user from the server-side registry."""
    _user_registry = _load_user_registry()
    if user_id not in _user_registry:
        return {"success": False, "error": "User not found."}
    removed = _user_registry.pop(user_id)
    _save_user_registry(_user_registry)
    logger.info(f"🗑️ User deleted: {removed['email']}")
    return {"success": True, "message": f"User {removed['email']} deleted."}
