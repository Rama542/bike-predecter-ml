import { NextRequest, NextResponse } from "next/server";
import { getMockResponse } from "../mock";

const ML_BASE = (process.env.ML_API_URL || "").replace(/\/$/, "");

async function proxy(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const path = pathSegments.join("/");
  const search = req.nextUrl.search;

  // ── If no ML backend configured, return mock data immediately ─────────────
  if (!ML_BASE) {
    const mock = getMockResponse(pathSegments, req.nextUrl.searchParams);
    if (mock !== null) {
      return NextResponse.json({ ...mock, _demo: true });
    }
    return NextResponse.json(
      { success: false, error: "ML backend not configured. Set ML_API_URL environment variable.", _demo: true },
      { status: 503 }
    );
  }

  const url = `${ML_BASE}/api/v1/${path}${search}`;

  try {
    const isPost = req.method === "POST" || req.method === "PUT" || req.method === "PATCH";

    const headers = new Headers();
    req.headers.forEach((value, key) => {
      const lk = key.toLowerCase();
      if (!["host","connection","content-length","transfer-encoding","te","trailer","upgrade","expect"].includes(lk)) {
        headers.set(key, value);
      }
    });
    headers.set("Accept", "application/json");

    const fetchOptions: RequestInit & { signal?: AbortSignal } = {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(60000),
    };

    if (isPost) {
      const buffer = await req.arrayBuffer();
      fetchOptions.body = buffer as BodyInit;
    }

    const res = await fetch(url, fetchOptions);
    const responseText = await res.text();
    let data: object;
    try { data = JSON.parse(responseText); } catch { data = { error: "Invalid JSON from backend", raw: responseText }; }
    return NextResponse.json(data, { status: res.status });

  } catch (err: unknown) {
    const msg = (err instanceof Error) ? err.message : String(err);
    const isTimeout = msg.includes("TimeoutError") || msg.includes("AbortError");
    console.error(`[ML Proxy] ${req.method} ${url} failed: ${msg}`);

    // ── Backend is down — fall back to mock data ────────────────────────────
    const mock = getMockResponse(pathSegments, req.nextUrl.searchParams);
    if (mock !== null) {
      console.warn(`[ML Proxy] Using demo fallback for ${path}`);
      return NextResponse.json({ ...mock, _demo: true });
    }

    return NextResponse.json(
      {
        success: false,
        error: isTimeout
          ? "ML backend request timed out. The service may be starting up — try again in 30s."
          : "ML backend is starting up. Demo data shown until it's ready.",
        detail: msg,
        _demo: true,
      },
      { status: 503 }
    );
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  const params = await context.params;
  return proxy(req, params.path);
}
export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  const params = await context.params;
  return proxy(req, params.path);
}
export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  const params = await context.params;
  return proxy(req, params.path);
}
export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  const params = await context.params;
  return proxy(req, params.path);
}
