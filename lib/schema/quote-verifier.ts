import { EvidenceItem } from "./review";

export interface QuoteVerificationResult {
  verified: EvidenceItem[];
  dropped: Array<{ item: EvidenceItem; reason: string }>;
}

function normalizeForComparison(str: string): string {
  return str
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Verifies that each evidence quote is a verbatim substring of the owner's source content.
 * Any quote not found verbatim in either the raw text or the transcript is dropped.
 */
export function verifyEvidenceQuotes(
  evidence: EvidenceItem[],
  sourceTexts: Array<string | null | undefined>
): QuoteVerificationResult {
  const combinedSources = sourceTexts
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map(normalizeForComparison);

  const verified: EvidenceItem[] = [];
  const dropped: Array<{ item: EvidenceItem; reason: string }> = [];

  for (const item of evidence) {
    if (!item.quote || item.quote.trim().length === 0) {
      dropped.push({ item, reason: "Empty quote" });
      continue;
    }

    const normQuote = normalizeForComparison(item.quote);

    // Quotes must be at most 25 words per Spec Section 7
    const wordCount = item.quote.trim().split(/\s+/).length;
    if (wordCount > 25) {
      dropped.push({ item, reason: `Quote exceeds 25 words limit (${wordCount} words)` });
      continue;
    }

    const isVerbatimSubstring = combinedSources.some((source) => source.includes(normQuote));

    if (isVerbatimSubstring) {
      verified.push(item);
    } else {
      dropped.push({ item, reason: "Fabricated quote: not found as a substring in owner text or transcript" });
    }
  }

  return { verified, dropped };
}
