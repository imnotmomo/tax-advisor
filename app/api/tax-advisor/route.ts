import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SITE_ACCESS_COOKIE_NAME, hasValidSiteAccessCookie } from "@/lib/site-password";

const DEFAULT_TOP_K = 10;

type RequestBody = {
  question?: unknown;
  topK?: unknown;
  allowScenarios?: unknown;
};

type UpstreamErrorBody = {
  ok?: unknown;
  answer?: unknown;
  detail?: unknown;
  error?: unknown;
};

function getUpstreamBaseUrl() {
  const base = process.env.TAX_ADVISOR_API_URL?.trim();

  if (!base) {
    return null;
  }

  return base.replace(/\/(chat|health)\/?$/, "").replace(/\/$/, "");
}

function getUpstreamChatUrl() {
  const base = getUpstreamBaseUrl();
  return base ? `${base}/chat` : null;
}

function getUpstreamHealthUrl() {
  const base = getUpstreamBaseUrl();
  return base ? `${base}/health` : null;
}

function buildUpstreamHeaders(includeJsonContentType = false) {
  const headers = new Headers();

  if (includeJsonContentType) {
    headers.set("Content-Type", "application/json");
  }

  const bearerToken = process.env.TAX_ADVISOR_API_BEARER_TOKEN?.trim();

  if (bearerToken) {
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }

  return headers;
}

function normalizeUpstreamErrorMessage(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return null;
  }

  if (/(<!doctype html|<html[\s>]|<body[\s>])/i.test(normalized)) {
    return null;
  }

  if (normalized.length > 220) {
    return `${normalized.slice(0, 217).trimEnd()}...`;
  }

  return normalized;
}

function getUpstreamErrorMessage(
  parsedBody: Pick<UpstreamErrorBody, "detail" | "error"> | null,
  rawText: string,
  fallback: string
) {
  return (
    normalizeUpstreamErrorMessage(parsedBody?.detail) ??
    normalizeUpstreamErrorMessage(parsedBody?.error) ??
    normalizeUpstreamErrorMessage(rawText) ??
    fallback
  );
}

async function getUnauthorizedResponse() {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(SITE_ACCESS_COOKIE_NAME)?.value;

  if (hasValidSiteAccessCookie(accessCookie)) {
    return null;
  }

  return NextResponse.json({ error: "Password required." }, { status: 401 });
}

export async function GET() {
  const unauthorizedResponse = await getUnauthorizedResponse();

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const upstreamUrl = getUpstreamHealthUrl();

  if (!upstreamUrl) {
    return NextResponse.json(
      {
        ok: false,
        healthy: false,
        error: "TAX_ADVISOR_API_URL is not configured.",
      },
      { status: 500 }
    );
  }

  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers: buildUpstreamHeaders(),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        healthy: false,
        error: "Backend /health is not reachable.",
      },
      { status: 502 }
    );
  }

  const rawText = await upstreamResponse.text();
  let parsedBody: UpstreamErrorBody | null = null;

  try {
    parsedBody = rawText ? (JSON.parse(rawText) as UpstreamErrorBody) : null;
  } catch {
    parsedBody = null;
  }

  if (!upstreamResponse.ok) {
    const detail = getUpstreamErrorMessage(
      parsedBody,
      rawText,
      `Upstream health request failed with status ${upstreamResponse.status}.`
    );

    return NextResponse.json(
      {
        ok: false,
        healthy: false,
        error: detail,
      },
      { status: upstreamResponse.status }
    );
  }

  if (parsedBody?.ok !== true) {
    return NextResponse.json(
      {
        ok: false,
        healthy: false,
        error: "Unexpected health response from backend.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    healthy: true,
  });
}

export async function POST(request: Request) {
  const unauthorizedResponse = await getUnauthorizedResponse();

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const upstreamUrl = getUpstreamChatUrl();

  if (!upstreamUrl) {
    return NextResponse.json(
      { error: "TAX_ADVISOR_API_URL is not configured." },
      { status: 500 }
    );
  }

  const topK =
    typeof body?.topK === "number" && Number.isFinite(body.topK) ? body.topK : DEFAULT_TOP_K;
  const allowScenarios = body?.allowScenarios === true;

  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: buildUpstreamHeaders(true),
      cache: "no-store",
      body: JSON.stringify({
        question,
        top_k: topK,
        allow_scenarios: allowScenarios,
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "The advisor service is currently unavailable." },
      { status: 502 }
    );
  }

  const rawText = await upstreamResponse.text();
  let parsedBody: UpstreamErrorBody | null = null;

  try {
    parsedBody = rawText ? (JSON.parse(rawText) as UpstreamErrorBody) : null;
  } catch {
    parsedBody = null;
  }

  if (!upstreamResponse.ok) {
    const detail = getUpstreamErrorMessage(
      parsedBody,
      rawText,
      `Upstream request failed with status ${upstreamResponse.status}.`
    );

    return NextResponse.json({ error: detail }, { status: upstreamResponse.status });
  }

  if (typeof parsedBody?.answer !== "string" || parsedBody.answer.trim().length === 0) {
    return NextResponse.json({ error: "Upstream returned no answer." }, { status: 502 });
  }

  return NextResponse.json({ answer: parsedBody.answer.trim() });
}
