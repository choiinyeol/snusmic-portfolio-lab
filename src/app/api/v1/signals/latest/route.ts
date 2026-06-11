/**
 * GET /api/v1/signals/latest
 *
 * Edge-compatible serverless route that reads the pre-generated static JSON
 * and returns it with explicit CORS headers so browser clients can fetch
 * cross-origin without relying solely on the next.config headers() middleware.
 *
 * The static file at /api/v1/signals/latest.json is the primary artifact —
 * this route is a thin pass-through for clients that need a proper HTTP
 * endpoint URL (e.g. fetch('/api/v1/signals/latest') in a browser app).
 *
 * Note: this is NOT a dynamic/database-backed route. It reads the JSON file
 * that the Python pipeline writes into public/api/v1/signals/latest.json
 * and re-serves it. On Vercel the file is embedded in the deploy artifact,
 * so there is no runtime file I/O — Vercel inlines public/ files at build time.
 */

import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs"; // needs fs; edge runtime doesn't have it

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=43200, stale-while-revalidate=86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  try {
    const filePath = join(process.cwd(), "public", "api", "v1", "signals", "latest.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as unknown;
    return NextResponse.json(data, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json(
      { error: "Signal data not yet generated. Run the pipeline first." },
      { status: 503, headers: CORS_HEADERS }
    );
  }
}
