import { TranscriptSegment } from "@/lib/types";
import {
  ProviderError,
  RateLimitError,
  TimeoutError,
  ProviderNotConfiguredError,
} from "./errors";

export interface STTResult {
  transcript: string;
  segments: TranscriptSegment[];
}

export interface STTProvider {
  name: string;
  transcribeAudio(audioBlobOrBuffer: Blob | Uint8Array, filename?: string): Promise<STTResult>;
}

export class GroqWhisperSTTProvider implements STTProvider {
  name = "groq-whisper";
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.GROQ_API_KEY || "";
    this.model = model || process.env.STT_MODEL || "whisper-large-v3-turbo";
  }

  async transcribeAudio(audioData: Blob | Uint8Array, filename = "audio.wav"): Promise<STTResult> {
    if (!this.apiKey) {
      throw new ProviderNotConfiguredError("Groq Whisper STT", "GROQ_API_KEY");
    }

    const formData = new FormData();
    if (audioData instanceof Blob) {
      formData.append("file", audioData, filename);
    } else {
      const copy = new ArrayBuffer(audioData.byteLength);
      new Uint8Array(copy).set(new Uint8Array(audioData.buffer, audioData.byteOffset, audioData.byteLength));
      const blob = new Blob([copy]);
      formData.append("file", blob, filename);
    }

    formData.append("model", this.model);
    formData.append("response_format", "verbose_json");
    formData.append("temperature", "0");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s per maxDuration spec

    try {
      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        throw new RateLimitError(
          "Groq Whisper transcription rate limit reached. Please wait a moment before trying again.",
          retryAfter ? parseInt(retryAfter, 10) : undefined
        );
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new ProviderError(
          `Groq Whisper transcription failed (${response.status}): ${errText}`,
          "GROQ_WHISPER_ERROR",
          response.status
        );
      }

      const data = await response.json();
      const rawSegments = (data.segments || []) as Array<{ id?: number; start: number; end: number; text: string }>;
      const segments: TranscriptSegment[] = rawSegments.map((s) => ({
        id: s.id,
        start: Number(s.start.toFixed(2)),
        end: Number(s.end.toFixed(2)),
        text: s.text.trim(),
      }));

      return {
        transcript: (data.text || "").trim(),
        segments,
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof ProviderError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new TimeoutError("Groq Whisper transcription timed out after 60 seconds.");
      }
      throw new ProviderError(
        `Whisper transcription error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

export class MockSTTProvider implements STTProvider {
  name = "mock-whisper";

  constructor() {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SECURITY VIOLATION: MockSTTProvider cannot be instantiated in production.");
    }
  }

  async transcribeAudio(_audioData: Blob | Uint8Array, _filename = "audio.wav"): Promise<STTResult> {
    // Fixed plausible placeholder transcript with realistic segments per spec requirement
    return {
      transcript:
        "I have owned the Mahindra Thar diesel manual for fourteen months now and clocked around eighteen thousand kilometers. Overall it is built like a tank on the highway. The main issue is the clutch is quite heavy in bumper-to-bumper city traffic. Real world mileage is around eleven point five kmpl with the AC turned on in mixed driving conditions.",
      segments: [
        {
          id: 0,
          start: 0.0,
          end: 6.2,
          text: "I have owned the Mahindra Thar diesel manual for fourteen months now and clocked around eighteen thousand kilometers.",
        },
        {
          id: 1,
          start: 6.5,
          end: 11.8,
          text: "Overall it is built like a tank on the highway.",
        },
        {
          id: 2,
          start: 12.0,
          end: 18.4,
          text: "The main issue is the clutch is quite heavy in bumper-to-bumper city traffic.",
        },
        {
          id: 3,
          start: 18.8,
          end: 25.0,
          text: "Real world mileage is around eleven point five kmpl with the AC turned on in mixed driving conditions.",
        },
      ],
    };
  }
}

/**
 * Returns the STT provider.
 * Never silently falls back: if real mode is selected and GROQ_API_KEY is missing, throws ProviderNotConfiguredError.
 */
export function getSTTProvider(): STTProvider {
  const isMock = process.env.STT_MODE === "mock";

  if (isMock) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: STT_MODE=mock is forbidden when NODE_ENV=production.");
    }
    return new MockSTTProvider();
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new ProviderNotConfiguredError("Groq Whisper STT", "GROQ_API_KEY");
  }

  return new GroqWhisperSTTProvider(apiKey, process.env.STT_MODEL);
}
