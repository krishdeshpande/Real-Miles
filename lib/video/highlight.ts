import { Highlight } from "@/lib/schema/review";

export const MIN_HIGHLIGHT_DURATION = 8;
export const MAX_HIGHLIGHT_DURATION = 25;

/**
 * Validates and clamps highlight span to between 8 and 25 seconds per Spec Section 7.
 * Ensures timestamps remain within [0, mediaDurationSeconds].
 * Returns null if input is null/undefined or if media duration is invalid.
 */
export function clampHighlight(
  highlight: { start_s: number; end_s: number; reason?: string | null } | null | undefined,
  mediaDurationSeconds: number
): Highlight | null {
  if (
    !highlight ||
    !Number.isFinite(highlight.start_s) ||
    !Number.isFinite(highlight.end_s)
  ) {
    return null;
  }

  if (mediaDurationSeconds <= 0 || !Number.isFinite(mediaDurationSeconds)) {
    return null;
  }

  // Ensure non-negative start
  let start = Math.max(0, highlight.start_s);
  let end = Math.max(start, highlight.end_s);

  // If start is beyond media duration, clamp start
  if (start >= mediaDurationSeconds) {
    start = Math.max(0, mediaDurationSeconds - MIN_HIGHLIGHT_DURATION);
    end = mediaDurationSeconds;
  }

  let span = end - start;

  // Clamp to minimum 8 seconds
  if (span < MIN_HIGHLIGHT_DURATION) {
    end = Math.min(mediaDurationSeconds, start + MIN_HIGHLIGHT_DURATION);
    // If end hit duration cap, shift start backwards if possible
    if (end - start < MIN_HIGHLIGHT_DURATION && start > 0) {
      start = Math.max(0, end - MIN_HIGHLIGHT_DURATION);
    }
    span = end - start;
  }

  // Clamp to maximum 25 seconds
  if (span > MAX_HIGHLIGHT_DURATION) {
    end = start + MAX_HIGHLIGHT_DURATION;
  }

  // Cap end at media duration
  if (end > mediaDurationSeconds) {
    end = mediaDurationSeconds;
    if (end - start > MAX_HIGHLIGHT_DURATION) {
      start = Math.max(0, end - MAX_HIGHLIGHT_DURATION);
    }
  }

  // Ensure minimum duration is maintained if end was capped
  if (end - start < MIN_HIGHLIGHT_DURATION && mediaDurationSeconds >= MIN_HIGHLIGHT_DURATION) {
    start = Math.max(0, end - MIN_HIGHLIGHT_DURATION);
  }

  return {
    start_s: Number(start.toFixed(2)),
    end_s: Number(end.toFixed(2)),
    reason: highlight.reason || "Owner highlight span",
  };
}
