"use client";

import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Globe2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/app/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { getTopicResources, refreshTopicResources } from "@/lib/api";
import type { TopicResource } from "@/lib/types";

/**
 * SmartLibraryResources - online resources for a topic, distinct from
 * the student's own uploaded materials. Cached server-side (see
 * app/agents/smart_library.py), so opening this tab repeatedly doesn't
 * burn search-API quota - only the refresh button does.
 */
export function SmartLibraryResources({ topicId }: { topicId: number }) {
  const { push } = useToast();
  const [resources, setResources] = useState<TopicResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getTopicResources(topicId)
      .then(setResources)
      .catch((err) => push(err instanceof Error ? err.message : "Couldn't load resources", "error"))
      .finally(() => setLoading(false));
  }, [topicId, push]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const fresh = await refreshTopicResources(topicId);
      setResources(fresh);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't refresh resources", "error");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) return <Spinner label="Looking for resources…" />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-paper-dim">
          Beyond your own notes — articles and explainers found around the web for this topic.
        </p>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-ink-border px-3 py-1.5 text-xs text-paper-dim transition-colors hover:border-amber-glow/50 hover:text-paper focus-ring disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Searching…" : "Find more"}
        </button>
      </div>

      {resources.length === 0 ? (
        <EmptyState
          icon={Globe2}
          title="No resources yet"
          body="We haven't searched for this topic yet — tap “Find more” to look for articles and explainers online."
          action={
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-sm text-amber-glow hover:underline focus-ring"
            >
              {refreshing ? "Searching…" : "Search now"}
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {resources.map((r, i) => (
            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer">
              <Card className="p-4 transition-colors hover:border-amber-glow/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-paper">{r.title}</p>
                    {r.snippet && (
                      <p className="mt-1 line-clamp-2 text-sm text-paper-dim">{r.snippet}</p>
                    )}
                    {r.source_domain && (
                      <p className="mt-2 font-mono text-xs text-paper-faint">{r.source_domain}</p>
                    )}
                  </div>
                  <ExternalLink size={15} className="mt-0.5 shrink-0 text-paper-faint" />
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
