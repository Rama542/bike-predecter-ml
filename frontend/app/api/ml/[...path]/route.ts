import { NextRequest, NextResponse } from "next/server";

const ML_BASE = (process.env.ML_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function proxy(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const path = pathSegments.join("/");
  const search = req.nextUrl.search;
  const url = `${ML_BASE}/api/v1/${path}${search}`;

  try {
    const isPost = req.method === "POST" || req.method === "PUT" || req.method === "PATCH";
    
    const headers = new Headers();
    req.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      // Strip hop-by-hop headers and content-length (re-derived from buffer size by fetch)
      // transfer-encoding MUST be stripped: browser may send chunked, but proxy buffers the
      // body fully — forwarding the header causes FastAPI/Starlette to mis-parse the body
      if (
        lowerKey !== "host" &&
        lowerKey !== "connection" &&
        lowerKey !== "content-length" &&
        lowerKey !== "transfer-encoding" &&
        lowerKey !== "te" &&
        lowerKey !== "trailer" &&
        lowerKey !== "upgrade" &&
        lowerKey !== "expect"          // undici (Node fetch) does not support Expect header
      ) {
        headers.set(key, value);
      }
    });
    headers.set("Accept", "application/json");

    const fetchOptions: any = {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(60000),
    };

    if (isPost) {
      const buffer = await req.arrayBuffer();
      fetchOptions.body = buffer;
    }

    console.log(`[ML Proxy] Sending ${req.method} to ${url}`);
    const res = await fetch(url, fetchOptions);
    
    const responseText = await res.text();
    console.log(`[ML Proxy] Response from FastAPI: ${res.status} ${responseText}`);
    
    let data;
    try { data = JSON.parse(responseText); } catch(e) { data = { error: "Invalid JSON from backend", raw: responseText }; }
    
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error(`[ML Proxy] ${req.method} ${url} failed:`, err?.message ?? err);
    try { require('fs').writeFileSync('proxy_error.log', String(err?.stack || err?.message || err)); } catch(e){}
    return NextResponse.json(
      { success: false, error: "ML backend unreachable: " + (err?.message || "Unknown"), detail: err?.message },
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
