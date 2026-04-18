// frontend/src/features/hub/tabs/ops/hooks/useNextCandidatePreview.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchNextPathfinderSeed } from '../../../../../api/enrichment/fetchNextPathfinderSeed';
import { fetchNextScraperTarget } from '../../../../../api/enrichment/fetchNextScraperTarget';
import type {
  PathfinderPreviewResponse,
  ScraperPreviewResponse,
} from '../../../../../api/types/PipelineSummary';
import { extractApiFailure } from '../lib/formatters';

export interface UseNextCandidatePreviewResult {
  pathfinder: PathfinderPreviewResponse | null;
  scraper: ScraperPreviewResponse | null;
  loadingPath: boolean;
  loadingScrape: boolean;
  errorPath: string | null;
  errorScrape: string | null;
  reevaluate: () => void;
  lastEvaluatedAt: number | null;
}

export function useNextCandidatePreview(orgId: number | null): UseNextCandidatePreviewResult {
  const [pathfinder, setPathfinder] = useState<PathfinderPreviewResponse | null>(null);
  const [scraper, setScraper] = useState<ScraperPreviewResponse | null>(null);
  const [loadingPath, setLoadingPath] = useState(false);
  const [loadingScrape, setLoadingScrape] = useState(false);
  const [errorPath, setErrorPath] = useState<string | null>(null);
  const [errorScrape, setErrorScrape] = useState<string | null>(null);
  const [lastEvaluatedAt, setLastEvaluatedAt] = useState<number | null>(null);
  const genRef = useRef(0);

  const reevaluate = useCallback(() => {
    if (orgId == null) return;
    const gen = ++genRef.current;

    setLoadingPath(true);
    setErrorPath(null);
    void fetchNextPathfinderSeed()
      .then((r) => {
        if (gen !== genRef.current) return;
        setPathfinder(r);
      })
      .catch((err) => {
        if (gen !== genRef.current) return;
        setErrorPath(extractApiFailure(err).message);
      })
      .finally(() => {
        if (gen === genRef.current) setLoadingPath(false);
      });

    setLoadingScrape(true);
    setErrorScrape(null);
    void fetchNextScraperTarget()
      .then((r) => {
        if (gen !== genRef.current) return;
        setScraper(r);
      })
      .catch((err) => {
        if (gen !== genRef.current) return;
        setErrorScrape(extractApiFailure(err).message);
      })
      .finally(() => {
        if (gen !== genRef.current) return;
        setLoadingScrape(false);
        setLastEvaluatedAt(Date.now());
      });
  }, [orgId]);

  // Fire once on mount/org change.
  useEffect(() => {
    if (orgId == null) return;
    // Reset previous candidates when org changes.
    setPathfinder(null);
    setScraper(null);
    setErrorPath(null);
    setErrorScrape(null);
    reevaluate();
  }, [orgId, reevaluate]);

  return {
    pathfinder,
    scraper,
    loadingPath,
    loadingScrape,
    errorPath,
    errorScrape,
    reevaluate,
    lastEvaluatedAt,
  };
}
