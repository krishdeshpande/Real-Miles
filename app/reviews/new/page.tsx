"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { SEED_VEHICLES } from "@/lib/data/seed-vehicles";
import { StructuredCardEditor } from "@/components/reviews/structured-card-editor";
import { StructuredReview } from "@/lib/schema/review";
import { Review } from "@/lib/types";
import {
  Car,
  Bike,
  Mic,
  Square,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Lock,
  Volume2
} from "lucide-react";

function getSupportedMimeType(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "audio/webm";
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

function ReviewSubmitStepper() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSlug = searchParams.get("vehicle") || "";
  const { user } = useAuth();

  // Current Step: 1 = vehicle, 2 = content, 3 = reading/extracting, 4 = review structured card
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Vehicle & metadata
  const [selectedSlug, setSelectedSlug] = useState(initialSlug);
  const [variant, setVariant] = useState("");
  const [modelYear, setModelYear] = useState<number>(new Date().getFullYear());
  const [purchaseMonth, setPurchaseMonth] = useState("");

  // Step 2: Content
  const [contentType, setContentType] = useState<"text" | "voice_record" | "voice_upload">("text");
  const [rawText, setRawText] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioFilename, setAudioFilename] = useState<string>("voice-note.webm");

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Step 3 & 4: Review model & extraction
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<Review | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<string>("Initializing review draft...");
  const [extractionError, setExtractionError] = useState<{ message: string; code?: string } | null>(null);

  const selectedVehicle = SEED_VEHICLES.find((v) => v.slug === selectedSlug);

  // Clean up audio blob URL
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, [audioUrl]);

  // Voice recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const fullBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setAudioBlob(fullBlob);
        setAudioUrl(URL.createObjectURL(fullBlob));
        setAudioFilename(`voice-recording.${recorder.mimeType?.includes("mp4") ? "mp4" : "webm"}`);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 179) {
            stopRecording();
            return 180;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      alert("Unable to access microphone. Please grant microphone permissions or type your review.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
    setAudioDuration(recordingSeconds);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert("Audio file exceeds the 25 MB limit.");
      return;
    }

    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
    setAudioFilename(file.name);
  };

  // Pipeline execution: Submit -> Transcribe -> Extract -> Review Card
  const startReviewExtractionPipeline = async () => {
    if (!selectedVehicle) {
      alert("Please select a vehicle first.");
      return;
    }

    if (!rawText.trim() && !audioBlob) {
      alert("Please enter review text or record a voice note.");
      return;
    }

    setStep(3);
    setExtractionError(null);
    setExtractionStatus("Creating review draft record...");

    try {
      // 1. Create draft row
      const sourceTypes: string[] = [];
      if (rawText.trim()) sourceTypes.push("text");
      if (audioBlob) sourceTypes.push("audio");

      const draftRes = await fetch("/api/reviews/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: selectedVehicle.id,
          variant: variant || null,
          model_year: modelYear,
          purchase_month: purchaseMonth || null,
          raw_text: rawText.trim() || null,
          source_types: sourceTypes,
        }),
      });

      const draftJson = await draftRes.json();
      if (!draftRes.ok || !draftJson.ok) {
        throw new Error(draftJson.error || "Failed to create review draft.");
      }

      const reviewId = draftJson.data.id;
      setActiveReviewId(reviewId);

      let storagePath: string | undefined = undefined;

      // 2. Upload audio if present
      if (audioBlob) {
        setExtractionStatus("Requesting signed upload URL for audio...");
        const signRes = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: audioFilename,
            mimeType: audioBlob.type || "audio/webm",
            kind: "audio",
            sizeBytes: audioBlob.size,
            durationSeconds: audioDuration || 30,
          }),
        });

        const signJson = await signRes.json();
        if (!signRes.ok || !signJson.ok) {
          throw new Error(signJson.error || "Failed to get upload authorization.");
        }

        const { uploadUrl, storagePath: sPath } = signJson.data;
        storagePath = sPath;

        setExtractionStatus("Uploading voice note to storage...");
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          body: audioBlob,
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload audio payload to storage.");
        }

        // 3. Transcribe audio
        setExtractionStatus("Transcribing audio voice note (Whisper)...");
        const transcribeRes = await fetch(`/api/reviews/${reviewId}/transcribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath }),
        });

        const transcribeJson = await transcribeRes.json();
        if (!transcribeRes.ok || !transcribeJson.ok) {
          throw new Error(transcribeJson.error || "Transcription failed.");
        }
      }

      // 4. Extract structured review
      setExtractionStatus("Extracting structured review metrics with Gemini Flash...");
      const extractRes = await fetch(`/api/reviews/${reviewId}/extract`, {
        method: "POST",
      });

      const extractJson = await extractRes.json();
      if (!extractRes.ok || !extractJson.ok) {
        setExtractionError({
          message: extractJson.error || "Extraction failed.",
          code: extractJson.code,
        });
        return;
      }

      setReviewData(extractJson.data);
      setStep(4);
    } catch (err: unknown) {
      setExtractionError({
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleUpdateStructuredCard = async (updated: StructuredReview) => {
    if (!activeReviewId) return;
    const res = await fetch(`/api/reviews/${activeReviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ structured: updated }),
    });

    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error(json.error || "Failed to save updates.");
    }
    setReviewData(json.data);
  };

  return (
    <div className="space-y-8">
      {/* Top Stepper Navigation */}
      <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-4">
        <div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-accent">
            Step {step} of 4 • {step === 1 ? "Choose Vehicle" : step === 2 ? "Add Experience" : step === 3 ? "Analyzing" : "Confirm Record"}
          </span>
          <h1 className="text-2xl font-bold font-heading text-foreground mt-0.5">
            {step === 1 && "Select Vehicle & Specifications"}
            {step === 2 && "Share Your Ownership Experience"}
            {step === 3 && "Reading Your Review"}
            {step === 4 && "Review & Confirm Structured Data"}
          </h1>
        </div>

        {step > 1 && step !== 3 && (
          <button
            onClick={() => setStep((prev) => (prev > 1 ? (prev - 1) as 1 | 2 | 4 : 1))}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Previous Step
          </button>
        )}
      </div>

      {!user && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs">
            <Lock className="h-4 w-4 text-accent shrink-0" />
            <span>Please sign in to save your review draft.</span>
          </div>
          <Link
            href="/auth/login"
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"
          >
            Sign In
          </Link>
        </div>
      )}

      {/* STEP 1: VEHICLE & METADATA */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SEED_VEHICLES.map((v) => {
              const isSelected = selectedSlug === v.slug;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedSlug(v.slug)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    isSelected
                      ? "border-accent bg-accent/10 shadow-md ring-1 ring-accent"
                      : "border-[var(--surface-border)] bg-surface hover:bg-surface-subtle"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {v.category}
                    </span>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-accent" />}
                  </div>
                  <div className="text-xs text-muted-foreground">{v.make}</div>
                  <div className="font-heading font-bold text-foreground text-sm">{v.model}</div>
                  <div className="text-[11px] text-muted-foreground mt-2 font-mono">{v.fuel_type}</div>
                </button>
              );
            })}
          </div>

          {selectedVehicle && (
            <div className="rounded-card border border-[var(--surface-border)] bg-surface p-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider font-heading">
                Vehicle Ownership Context
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                    Variant (Free text)
                  </label>
                  <input
                    type="text"
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                    placeholder="e.g. LX 4x4 Hard Top / Dark Edition"
                    className="w-full rounded-xl border border-[var(--surface-border)] bg-background px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                    Model Year
                  </label>
                  <input
                    type="number"
                    value={modelYear}
                    onChange={(e) => setModelYear(parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-[var(--surface-border)] bg-background px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                    Purchase Month
                  </label>
                  <input
                    type="month"
                    value={purchaseMonth}
                    onChange={(e) => setPurchaseMonth(e.target.value)}
                    className="w-full rounded-xl border border-[var(--surface-border)] bg-background px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-accent-foreground hover:bg-accent-hover transition-colors"
                >
                  Continue to Add Content
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: ADD CONTENT */}
      {step === 2 && (
        <div className="rounded-card border border-[var(--surface-border)] bg-surface p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 border-b border-[var(--surface-border)] pb-3">
            <button
              onClick={() => setContentType("text")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                contentType === "text" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Write Review
            </button>
            <button
              onClick={() => setContentType("voice_record")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                contentType === "voice_record" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              Record Voice Note
            </button>
            <button
              onClick={() => setContentType("voice_upload")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                contentType === "voice_upload" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Audio File
            </button>
          </div>

          {/* Option A: Text Review */}
          {contentType === "text" && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Enter your unfiltered ownership feedback (Hindi, English, or Hinglish accepted).</span>
                <span className="font-mono">{rawText.length}/6000 chars</span>
              </div>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value.slice(0, 6000))}
                rows={10}
                placeholder="Mention how many kilometers you have driven, real-world mileage in city/highway, maintenance costs, clutch/gearbox issues, comfort, and whether you would buy it again..."
                className="w-full rounded-xl border border-[var(--surface-border)] bg-background p-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent leading-relaxed"
              />
            </div>
          )}

          {/* Option B: Voice Note Recording */}
          {contentType === "voice_record" && (
            <div className="rounded-xl border border-[var(--surface-border)] bg-background/50 p-8 text-center space-y-5">
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-bold text-foreground">Record In-Browser Voice Note</h3>
                <p className="text-xs text-muted-foreground">
                  Up to 3 minutes (180s). Simply speak your review naturally as if talking to a friend.
                </p>
              </div>

              <div className="flex flex-col items-center justify-center gap-3">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-white shadow-lg hover:scale-105 transition-transform"
                  >
                    <Mic className="h-7 w-7" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg animate-pulse"
                  >
                    <Square className="h-6 w-6" />
                  </button>
                )}

                <span className="font-mono text-sm font-semibold text-foreground">
                  {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")} / 3:00
                </span>
                {isRecording && (
                  <span className="text-xs text-accent font-semibold animate-pulse">
                    Recording live audio...
                  </span>
                )}
              </div>

              {audioUrl && !isRecording && (
                <div className="pt-4 border-t border-[var(--surface-border)] space-y-2">
                  <div className="text-xs text-muted-foreground">Playback recorded voice note:</div>
                  <audio controls src={audioUrl} className="mx-auto" />
                </div>
              )}
            </div>
          )}

          {/* Option C: Audio File Upload */}
          {contentType === "voice_upload" && (
            <div className="rounded-xl border border-dashed border-[var(--surface-border)] bg-background/50 p-8 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-muted-foreground">
                <Upload className="h-6 w-6 text-accent" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">Select an audio file from your device</p>
                <p className="text-xs text-muted-foreground">
                  Max size: 25 MB • Max duration: 3 minutes • WAV, MP3, M4A, WebM, OGG
                </p>
              </div>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="mx-auto block text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-accent file:text-accent-foreground hover:file:bg-accent-hover cursor-pointer"
              />
              {audioUrl && (
                <div className="pt-2">
                  <audio controls src={audioUrl} className="mx-auto" />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-[var(--surface-border)]">
            <span className="text-xs text-muted-foreground">
              Review will be structured into verified metrics in Step 3.
            </span>
            <button
              type="button"
              onClick={startReviewExtractionPipeline}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-xs font-bold text-accent-foreground hover:bg-accent-hover transition-colors shadow-md shadow-accent/10"
            >
              Analyze &amp; Extract Data
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: READING YOUR REVIEW (POLLING & STATUS) */}
      {step === 3 && (
        <div className="rounded-card border border-[var(--surface-border)] bg-surface p-8 sm:p-14 text-center space-y-6">
          {!extractionError ? (
            <div className="space-y-4 max-w-md mx-auto">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/20 text-accent animate-pulse">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold font-heading text-foreground">
                  Reading Your Review
                </h2>
                <p className="text-xs font-mono text-accent">
                  {extractionStatus}
                </p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We transcribe audio segments, extract ownership numbers (km, mileage, annual service costs, component issues),
                and verify evidence quotes verbatim.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-w-lg mx-auto">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/20 text-destructive">
                <AlertCircle className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold font-heading text-foreground">
                  {extractionError.code === "NOT_A_REVIEW"
                    ? "Submission Not Recognized as Review"
                    : "Extraction Processing Notice"}
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {extractionError.message}
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-lg bg-surface border border-[var(--surface-border)] px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-subtle"
                >
                  Edit Input Content
                </button>
                <button
                  type="button"
                  onClick={startReviewExtractionPipeline}
                  className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-accent-foreground hover:bg-accent-hover"
                >
                  Retry Extraction
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 4: EDITABLE STRUCTURED CARD */}
      {step === 4 && reviewData?.structured && (
        <div className="space-y-6">
          <StructuredCardEditor
            initialData={reviewData.structured}
            onSave={handleUpdateStructuredCard}
            vehicleName={`${selectedVehicle?.make} ${selectedVehicle?.model}`}
          />
        </div>
      )}
    </div>
  );
}

export default function NewReviewPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">Loading review submission pipeline...</div>}>
        <ReviewSubmitStepper />
      </Suspense>
    </div>
  );
}
