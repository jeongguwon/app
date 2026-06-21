import { ensureNotSuspended } from "@/lib/auth/moderation-guard";
import { getSharedSessionStore, readAuthSessionToken } from "@/lib/auth/session";
import {
  __resetPostCreateLimiterNowForTests,
  __setPostCreateLimiterNowForTests,
  getSharedPostCreateLimiter,
} from "@/lib/posts/post-create-limiter";
import { getSharedPostStore, PostStatus, PostType } from "@/lib/posts/post-store";
import { hashSecretAnswer } from "@/lib/security/secret-answer";

let postRouteNow: () => number = Date.now;

function invalidRequest(): Response {
  return Response.json(
    {
      success: false,
      reason: "invalid_request",
    },
    {
      status: 400,
    }
  );
}

function rateLimited(): Response {
  return Response.json(
    {
      success: false,
      reason: "rate_limited",
    },
    {
      status: 429,
    }
  );
}

function isValidType(value: unknown): value is PostType {
  return value === "lost" || value === "found";
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDateIso(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function normalizePhotoPaths(value: unknown): string[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  if (!value.every((item) => typeof item === "string")) {
    return null;
  }

  return value;
}

function isValidStatus(value: unknown): value is PostStatus {
  return (
    value === "active" ||
    value === "claiming" ||
    value === "returned" ||
    value === "hidden" ||
    value === "deleted"
  );
}

function parsePositiveInt(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function normalizePeriodDays(value: string | null): number | null {
  if (value === null || value === "all") {
    return null;
  }

  if (value === "7" || value === "7d") {
    return 7;
  }

  if (value === "30" || value === "30d") {
    return 30;
  }

  return -1;
}

const PAGE_SIZE = 20;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const category = url.searchParams.get("category")?.trim() ?? "";
  const location = url.searchParams.get("location")?.trim() ?? "";
  const typeParam = url.searchParams.get("type");
  const statusParam = url.searchParams.get("status");
  const pageParam = parsePositiveInt(url.searchParams.get("page"));
  const periodDays = normalizePeriodDays(url.searchParams.get("period"));
  const mineParam = url.searchParams.get("mine");

  if (pageParam === null && url.searchParams.has("page")) {
    return invalidRequest();
  }

  if (periodDays === -1) {
    return invalidRequest();
  }

  if (typeParam !== null && typeParam !== "all" && !isValidType(typeParam)) {
    return invalidRequest();
  }

  if (statusParam !== null && !isValidStatus(statusParam)) {
    return invalidRequest();
  }

  let viewerEmail: string | null = null;

  if (mineParam === "true") {
    const token = readAuthSessionToken(
      request instanceof Request ? request.headers.get("cookie") : null
    );
    viewerEmail = token ? getSharedSessionStore().getEmailByToken(token) : null;

    if (!viewerEmail) {
      return Response.json({ success: false, reason: "unauthenticated" }, { status: 401 });
    }
  }

  const now = postRouteNow();
  const posts = getSharedPostStore()
    .list()
    .filter((post) => {
      if (viewerEmail) {
        return post.authorEmail === viewerEmail;
      }

      if (statusParam) {
        return post.status === statusParam;
      }

      return post.status !== "hidden" && post.status !== "deleted";
    })
    .filter((post) => (typeParam && typeParam !== "all" ? post.type === typeParam : true))
    .filter((post) => (category ? post.category === category : true))
    .filter((post) => (location ? post.location === location : true))
    .filter((post) => {
      if (!periodDays) {
        return true;
      }

      const eventTime = Date.parse(post.eventAt);

      if (Number.isNaN(eventTime)) {
        return false;
      }

      return now - eventTime <= periodDays * 24 * 60 * 60 * 1000;
    })
    .filter((post) => {
      if (!q) {
        return true;
      }

      const haystack = `${post.title} ${post.description ?? ""}`.toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const page = pageParam ?? 1;
  const total = posts.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const paged = start >= total ? [] : posts.slice(start, start + PAGE_SIZE);

  return Response.json({
    success: true,
    posts: paged,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages,
    },
  });
}

export function __setPostRouteNowForTests(now: () => number): void {
  postRouteNow = now;
  __setPostCreateLimiterNowForTests(now);
}

export function __resetPostRouteNowForTests(): void {
  postRouteNow = Date.now;
  __resetPostCreateLimiterNowForTests();
}

export async function POST(request: Request): Promise<Response> {
  try {
    const token = readAuthSessionToken(request.headers.get("cookie"));

    if (!token) {
      return invalidRequest();
    }

    const email = getSharedSessionStore().getEmailByToken(token);

    if (!email) {
      return invalidRequest();
    }

    const suspended = ensureNotSuspended(email);

    if (suspended) {
      return suspended;
    }

    const body = await request.json();

    if (
      !body ||
      !isValidType(body.type) ||
      !isNonEmptyText(body.title) ||
      !isNonEmptyText(body.category) ||
      !isNonEmptyText(body.location) ||
      !isValidDateIso(body.eventAt)
    ) {
      return invalidRequest();
    }

    const photoPaths = normalizePhotoPaths(body.photoPaths);

    if (photoPaths === null) {
      return invalidRequest();
    }

    if (body.type === "found") {
      if (
        !isNonEmptyText(body.storagePlace) ||
        !isNonEmptyText(body.secretQuestion) ||
        !isNonEmptyText(body.secretAnswer)
      ) {
        return invalidRequest();
      }
    }

    const limiter = getSharedPostCreateLimiter();

    if (!limiter.canCreate(email)) {
      return rateLimited();
    }

    const secretAnswerHash =
      body.type === "found" && typeof body.secretAnswer === "string"
        ? await hashSecretAnswer(body.secretAnswer)
        : undefined;

    const post = getSharedPostStore().create({
      authorEmail: email,
      type: body.type,
      title: body.title.trim(),
      category: body.category.trim(),
      location: body.location.trim(),
      eventAt: body.eventAt,
      description: typeof body.description === "string" ? body.description : undefined,
      photoPaths,
      storagePlace: typeof body.storagePlace === "string" ? body.storagePlace : undefined,
      secretQuestion: typeof body.secretQuestion === "string" ? body.secretQuestion : undefined,
      secretAnswerHash,
      now: postRouteNow,
    });

    limiter.recordCreate(email);

    return Response.json(
      {
        success: true,
        post,
      },
      {
        status: 201,
      }
    );
  } catch {
    return invalidRequest();
  }
}
