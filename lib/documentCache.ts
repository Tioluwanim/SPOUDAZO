import { getMaterialDetail } from "@/lib/api";
import type { MaterialDetail } from "@/lib/types";

/**
 * lib/documentCache.ts - Section 14's "Chunk caching" / "Incremental
 * loading" for the reader, and what background prefetching warms.
 *
 * A document's content doesn't change while a student is reading it (the
 * backend only ever regenerates it via re-upload), so re-fetching the
 * same doc_id every time the reader mounts - including just switching
 * back and forth between two documents in the sidebar - is pure waste.
 * In-memory + a short TTL is proportionate here, same reasoning as
 * text_action_cache.py on the backend: this is a beta-scale app, not
 * something that needs a dedicated cache service yet.
 */

const TTL_MS = 5 * 60 * 1000; // 5 minutes - long enough to matter across a reading session, short enough that a reprocessed re-upload isn't stuck stale for long

interface CacheEntry {
  data: MaterialDetail;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<MaterialDetail>>();

function cacheKey(courseId: number, docId: string): string {
  return `${courseId}:${docId}`;
}

/** Fetches a document's content, serving from cache when fresh. Concurrent
 * calls for the same document share one in-flight request instead of
 * firing duplicate network calls (e.g. a prefetch-on-hover racing the
 * actual navigation). */
export async function getCachedMaterialDetail(courseId: number, docId: string): Promise<MaterialDetail> {
  const key = cacheKey(courseId, docId);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.cachedAt < TTL_MS) {
    return cached.data;
  }

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = getMaterialDetail(courseId, docId)
    .then((data) => {
      cache.set(key, { data, cachedAt: Date.now() });
      inFlight.delete(key);
      return data;
    })
    .catch((err) => {
      inFlight.delete(key);
      throw err;
    });

  inFlight.set(key, promise);
  return promise;
}

/** Warms the cache without the caller waiting on it - used for
 * background prefetching (e.g. hovering a sidebar link before actually
 * clicking it). Swallows errors: a failed prefetch just means the real
 * navigation will fetch normally, not a user-facing failure. */
export function prefetchMaterialDetail(courseId: number, docId: string): void {
  const key = cacheKey(courseId, docId);
  if (cache.has(key) || inFlight.has(key)) return; // already cached or already loading
  getCachedMaterialDetail(courseId, docId).catch(() => {});
}

/** Call after an action that changes a document's content (re-upload
 * replacing it) so a stale cached read isn't served past its TTL anyway. */
export function invalidateMaterialDetail(courseId: number, docId: string): void {
  cache.delete(cacheKey(courseId, docId));
}
