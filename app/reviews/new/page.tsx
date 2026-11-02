"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { SEED_VEHICLES } from "@/lib/data/seed-vehicles";
import { StructuredCardEditor } from "@/components/reviews/structured-card-editor";
import { StructuredReview } from "@/lib/schema/review";
import { Review, ReviewMediaItem } from "@/lib/types";
import { extractAudioFromVideo, captureVideoThumbnail } from "@/lib/video/audio-extractor";
import { processPhotoClient } from "@/lib/media/photo-processor";
import {
  Car,
  Mic,
  Square,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Lock,
  Video,
  Camera,
  Trash2,
  SwitchCamera,
  Play,
  Film
} from "lucide-react";

function getSupportedAudioMimeType(): string {
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

function getSupportedVideoMimeType(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "video/webm";
  }
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

interface AttachedPhoto {
  file: File;
  blob: Blob;
  previewUrl: string;
  timestamp: string;
  filename: string;
}

function ReviewSubmitStepper() {
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
  const [activeMediaTab, setActiveMediaTab] = useState<"text" | "voice" | "video">("text");
  const [rawText, setRawText] = useState("");

  // Audio Voice Note state
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioFilename, setAudioFilename] = useState<string>("voice-note.webm");
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioSeconds, setAudioSeconds] = useState(0);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Video state
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoFilename, setVideoFilename] = useState<string>("video-review.webm");
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [posterBlob, setPosterBlob] = useState<Blob | null>(null);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoSeconds, setVideoSeconds] = useState(0);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const liveVideoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Photos state (up to 8, max 5MB each, EXIF GPS stripped)
  const [photos, setPhotos] = useState<AttachedPhoto[]>([]);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);

  // Step 3 & 4: Review model & extraction
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<Review | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<string>("Initializing review draft...");
  const [extractionError, setExtractionError] = useState<{ message: string; code?: string } | null>(null);

  const selectedVehicle = SEED_VEHICLES.find((v) => v.slug === selectedSlug);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (posterUrl) URL.revokeObjectURL(posterUrl);
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [audioUrl, videoUrl, posterUrl, photos]);

  // Voice recording handlers (Spec Section 3: 180s cap)
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioRecorderRef.current = recorder;
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
      setIsRecordingAudio(true);
      setAudioSeconds(0);

      audioIntervalRef.current = setInterval(() => {
        setAudioSeconds((prev) => {
          if (prev >= 179) {
            stopAudioRecording();
            return 180;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      alert("Unable to access microphone. Please grant microphone permissions or type your review.");
    }
  };

  const stopAudioRecording = () => {
    if (audioRecorderRef.current && audioRecorderRef.current.state !== "inactive") {
      audioRecorderRef.current.stop();
    }
    if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    setIsRecordingAudio(false);
    setAudioDuration(audioSeconds);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert("Audio file exceeds the 25 MB limit.");
      return;
    }

    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
    setAudioFilename(file.name);
    setAudioDuration(60); // Default estimate
  };

  // Video recording handlers (Spec Section 3 & 13: 60s & 50MB cap, camera flip)
  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing },
        audio: true,
      });
      mediaStreamRef.current = stream;

      if (liveVideoPreviewRef.current) {
        liveVideoPreviewRef.current.srcObject = stream;
        liveVideoPreviewRef.current.play().catch(() => {});
      }

      const mimeType = getSupportedVideoMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      videoRecorderRef.current = recorder;
      videoChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const fullBlob = new Blob(videoChunksRef.current, { type: recorder.mimeType || "video/webm" });
        if (fullBlob.size > 50 * 1024 * 1024) {
          alert("Recorded video exceeds the 50 MB limit. Please record a shorter clip.");
          return;
        }

        setVideoBlob(fullBlob);
        const objUrl = URL.createObjectURL(fullBlob);
        setVideoUrl(objUrl);
        setVideoFilename(`video-review.${recorder.mimeType?.includes("mp4") ? "mp4" : "webm"}`);

        // Generate poster thumbnail client-side
        try {
          const thumb = await captureVideoThumbnail(fullBlob, 1.0);
          setPosterBlob(thumb.blob);
          setPosterUrl(thumb.dataUrl);
        } catch (thumbErr) {
          console.warn("Could not generate poster thumbnail from recording:", thumbErr);
        }

        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        if (liveVideoPreviewRef.current) {
          liveVideoPreviewRef.current.srcObject = null;
        }
      };

      recorder.start(250);
      setIsRecordingVideo(true);
      setVideoSeconds(0);

      videoIntervalRef.current = setInterval(() => {
        setVideoSeconds((prev) => {
          if (prev >= 59) {
            stopVideoRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      alert("Unable to access camera. Please grant camera and microphone permissions or choose upload.");
    }
  };

  const stopVideoRecording = () => {
    if (videoRecorderRef.current && videoRecorderRef.current.state !== "inactive") {
      videoRecorderRef.current.stop();
    }
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    setIsRecordingVideo(false);
    setVideoDuration(videoSeconds || 1);
  };

  const toggleCameraFacing = async () => {
    const nextFacing = cameraFacing === "user" ? "environment" : "user";
    setCameraFacing(nextFacing);
    if (isRecordingVideo) {
      stopVideoRecording();
      alert("Camera switched. Tap Record to start with the new camera.");
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 50MB
    if (file.size > 50 * 1024 * 1024) {
      alert("Video file exceeds the 50 MB limit.");
      return;
    }

    // Check duration limit: 60s
    const testVideo = document.createElement("video");
    testVideo.preload = "metadata";
    const testUrl = URL.createObjectURL(file);
    testVideo.src = testUrl;

    testVideo.onloadedmetadata = async () => {
      URL.revokeObjectURL(testUrl);
      if (testVideo.duration > 60) {
        alert(`Video exceeds the 60-second limit (duration: ${Math.round(testVideo.duration)}s). Please choose a clip under 60 seconds.`);
        return;
      }

      setVideoDuration(testVideo.duration);
      setVideoBlob(file);
      setVideoUrl(URL.createObjectURL(file));
      setVideoFilename(file.name);

      // Capture poster thumbnail
      try {
        const thumb = await captureVideoThumbnail(file, 1.0);
        setPosterBlob(thumb.blob);
        setPosterUrl(thumb.dataUrl);
      } catch (err) {
        console.warn("Could not generate poster thumbnail from uploaded file:", err);
      }
    };

    testVideo.onerror = () => {
      URL.revokeObjectURL(testUrl);
      alert("Unable to decode video metadata. Please verify the video format.");
    };
  };

  // Photo handlers (Spec Section 6 & 13: up to 8 photos, 5MB each, EXIF GPS stripped)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (photos.length + files.length > 8) {
      alert("Maximum 8 photos allowed per review.");
      return;
    }

    setIsProcessingPhotos(true);
    try {
      const processedList: AttachedPhoto[] = [];
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          alert(`Photo '${file.name}' exceeds the 5 MB limit and was skipped.`);
          continue;
        }

        // Process client-side: strips GPS EXIF and preserves capture timestamp
        const processed = await processPhotoClient(file);
        const previewUrl = URL.createObjectURL(processed.blob);

        processedList.push({
          file,
          blob: processed.blob,
          previewUrl,
          timestamp: processed.timestamp,
          filename: processed.filename,
        });
      }

      setPhotos((prev) => [...prev, ...processedList]);
    } catch (err) {
      alert(`Error processing photo EXIF: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessingPhotos(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const item = prev[index];
      if (item) URL.revokeObjectURL(item.previewUrl);
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  // Pipeline execution: Submit -> Audio Extraction -> Whisper STT -> Gemini Extraction -> Review Card
  const startReviewExtractionPipeline = async () => {
    if (!selectedVehicle) {
      alert("Please select a vehicle first.");
      return;
    }

    if (!rawText.trim() && !audioBlob && !videoBlob) {
      alert("Please write a review, record audio, or provide a video clip.");
      return;
    }

    setStep(3);
    setExtractionError(null);
    setExtractionStatus("Creating review draft record...");

    try {
      // 1. Build source types
      const sourceTypes: string[] = [];
      if (rawText.trim()) sourceTypes.push("text");
      if (audioBlob) sourceTypes.push("voice_note");
      if (videoBlob) sourceTypes.push("video");
      if (photos.length > 0) sourceTypes.push("photos");

      // 2. Create draft row
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

      const mediaItems: ReviewMediaItem[] = [];
      let finalAudioStoragePath: string | undefined = undefined;

      // 3. Handle Video: In-browser audio extraction + Video storage upload
      if (videoBlob) {
        setExtractionStatus("Extracting mono 16 kHz audio from video (ffmpeg/WebAudio)...");
        const extraction = await extractAudioFromVideo(videoBlob, (pct, stage) => {
          setExtractionStatus(`${stage} (${pct}%)`);
        });

        // Upload Video to storage (50MB cap)
        setExtractionStatus("Requesting upload slot for video review...");
        const videoSignRes = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: videoFilename,
            mimeType: videoBlob.type || "video/mp4",
            kind: "video",
            sizeBytes: videoBlob.size,
            durationSeconds: Math.min(60, Math.round(videoDuration || 30)),
          }),
        });

        const videoSignJson = await videoSignRes.json();
        if (!videoSignRes.ok || !videoSignJson.ok) {
          throw new Error(videoSignJson.error || "Failed to get upload authorization for video.");
        }

        setExtractionStatus("Uploading video to storage...");
        const videoUploadRes = await fetch(videoSignJson.data.uploadUrl, {
          method: "POST",
          body: videoBlob,
        });

        if (!videoUploadRes.ok) {
          throw new Error("Failed to upload video to storage.");
        }

        mediaItems.push({
          kind: "video",
          storage_path: videoSignJson.data.storagePath,
          duration_s: videoDuration || 30,
        });

        // Upload Poster Thumbnail if present
        if (posterBlob) {
          try {
            const thumbSignRes = await fetch("/api/uploads/sign", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                filename: "poster-thumbnail.jpg",
                mimeType: "image/jpeg",
                kind: "photo",
                sizeBytes: posterBlob.size,
              }),
            });
            const thumbSignJson = await thumbSignRes.json();
            if (thumbSignJson.ok) {
              await fetch(thumbSignJson.data.uploadUrl, {
                method: "POST",
                body: posterBlob,
              });
              mediaItems.push({
                kind: "photo",
                storage_path: thumbSignJson.data.storagePath,
              });
            }
          } catch (tErr) {
            console.warn("Poster upload notice:", tErr);
          }
        }

        // Upload Extracted Audio to transcription path
        setExtractionStatus("Uploading extracted audio track for transcription...");
        const audioSignRes = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: extraction.audioFilename,
            mimeType: extraction.audioBlob.type || "audio/wav",
            kind: "audio",
            sizeBytes: extraction.audioBlob.size,
            durationSeconds: Math.min(180, Math.round(videoDuration || 30)),
          }),
        });

        const audioSignJson = await audioSignRes.json();
        if (!audioSignRes.ok || !audioSignJson.ok) {
          throw new Error(audioSignJson.error || "Failed to authorize audio upload.");
        }

        const audioUploadRes = await fetch(audioSignJson.data.uploadUrl, {
          method: "POST",
          body: extraction.audioBlob,
        });

        if (!audioUploadRes.ok) {
          throw new Error("Failed to upload extracted audio track.");
        }

        const audioStoragePath = audioSignJson.data.storagePath;
        finalAudioStoragePath = audioStoragePath;
        mediaItems.push({
          kind: "audio",
          storage_path: audioStoragePath,
          duration_s: videoDuration || 30,
        });
      }

      // 4. Handle Standalone Audio Voice Note (if text + voice or voice only)
      if (audioBlob && !videoBlob) {
        setExtractionStatus("Requesting signed upload URL for voice note...");
        const signRes = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: audioFilename,
            mimeType: audioBlob.type || "audio/webm",
            kind: "audio",
            sizeBytes: audioBlob.size,
            durationSeconds: Math.min(180, audioDuration || 30),
          }),
        });

        const signJson = await signRes.json();
        if (!signRes.ok || !signJson.ok) {
          throw new Error(signJson.error || "Failed to get upload authorization for audio.");
        }

        const voiceStoragePath = signJson.data.storagePath;
        finalAudioStoragePath = voiceStoragePath;

        setExtractionStatus("Uploading voice note to storage...");
        const uploadRes = await fetch(signJson.data.uploadUrl, {
          method: "POST",
          body: audioBlob,
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload audio payload to storage.");
        }

        mediaItems.push({
          kind: "audio",
          storage_path: voiceStoragePath,
          duration_s: audioDuration || 30,
        });
      }

      // 5. Transcribe Audio (if voice note or video audio was extracted)
      if (finalAudioStoragePath) {
        setExtractionStatus("Transcribing audio segments with Whisper STT...");
        const transcribeRes = await fetch(`/api/reviews/${reviewId}/transcribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath: finalAudioStoragePath }),
        });

        const transcribeJson = await transcribeRes.json();
        if (!transcribeRes.ok || !transcribeJson.ok) {
          throw new Error(transcribeJson.error || "Transcription failed.");
        }
      }

      // 6. Handle Attached Photos (EXIF GPS already stripped)
      if (photos.length > 0) {
        setExtractionStatus(`Uploading ${photos.length} owner photos...`);
        for (let i = 0; i < photos.length; i++) {
          const p = photos[i];
          const photoSignRes = await fetch("/api/uploads/sign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: p.filename,
              mimeType: p.blob.type || "image/jpeg",
              kind: "photo",
              sizeBytes: p.blob.size,
            }),
          });
          const photoSignJson = await photoSignRes.json();
          if (photoSignJson.ok) {
            await fetch(photoSignJson.data.uploadUrl, {
              method: "POST",
              body: p.blob,
            });
            mediaItems.push({
              kind: "photo",
              storage_path: photoSignJson.data.storagePath,
              timestamp: p.timestamp,
            });
          }
        }
      }

      // 7. Update Draft Record with media paths & URLs
      await fetch(`/api/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: videoUrl,
          poster_url: posterUrl,
          photo_urls: photos.map((p) => p.previewUrl),
          media: mediaItems,
        }),
      });

      // 8. Extract Structured Review Metrics with LLM
      setExtractionStatus("Extracting structured metrics with Gemini Flash LLM...");
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

      {/* STEP 2: ADD CONTENT (MIXED INPUT: TEXT, VOICE, VIDEO, PHOTOS) */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="rounded-card border border-[var(--surface-border)] bg-surface p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveMediaTab("text")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeMediaTab === "text" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Written Review
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMediaTab("voice")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeMediaTab === "voice" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Mic className="h-3.5 w-3.5" />
                  Voice Note {audioBlob && "(Ready)"}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMediaTab("video")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeMediaTab === "video" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Video className="h-3.5 w-3.5" />
                  Video Clip {videoBlob && "(Ready)"}
                </button>
              </div>

              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                Mixed inputs accepted: combine text, audio, video &amp; photos
              </span>
            </div>

            {/* TAB 1: Written Notes */}
            {activeMediaTab === "text" && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Enter your honest ownership feedback (Hindi, English, or Hinglish accepted).</span>
                  <span className="font-mono">{rawText.length}/6000 chars</span>
                </div>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value.slice(0, 6000))}
                  rows={8}
                  placeholder="Mention kilometers driven, real city/highway mileage, annual service bills, component issues (clutch, suspension, electronics), comfort, and your verdict..."
                  className="w-full rounded-xl border border-[var(--surface-border)] bg-background p-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent leading-relaxed"
                />
              </div>
            )}

            {/* TAB 2: Voice Note (Record or Upload) */}
            {activeMediaTab === "voice" && (
              <div className="rounded-xl border border-[var(--surface-border)] bg-background/50 p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  {/* Record Voice */}
                  <div className="text-center space-y-4 border-b md:border-b-0 md:border-r border-[var(--surface-border)] pb-6 md:pb-0 md:pr-6">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-foreground">Record Voice Note</h4>
                      <p className="text-xs text-muted-foreground">Up to 3 minutes (180s) • Browser MediaRecorder</p>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-2">
                      {!isRecordingAudio ? (
                        <button
                          type="button"
                          onClick={startAudioRecording}
                          className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-white shadow-lg hover:scale-105 transition-transform"
                        >
                          <Mic className="h-6 w-6" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopAudioRecording}
                          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg animate-pulse"
                        >
                          <Square className="h-5 w-5" />
                        </button>
                      )}
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {Math.floor(audioSeconds / 60)}:{(audioSeconds % 60).toString().padStart(2, "0")} / 3:00
                      </span>
                    </div>
                  </div>

                  {/* Upload Audio File */}
                  <div className="text-center space-y-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-foreground">Upload Audio File</h4>
                      <p className="text-xs text-muted-foreground">Max 25 MB • Max 3 min • WAV, MP3, M4A, WebM, OGG</p>
                    </div>

                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioUpload}
                      className="mx-auto block text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-accent file:text-accent-foreground hover:file:bg-accent-hover cursor-pointer"
                    />
                  </div>
                </div>

                {audioUrl && !isRecordingAudio && (
                  <div className="pt-4 border-t border-[var(--surface-border)] space-y-2 text-center">
                    <span className="text-xs text-accent font-semibold block">Voice note ready for analysis</span>
                    <audio controls src={audioUrl} className="mx-auto" />
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Video Input (Record with Camera Flip or Upload) */}
            {activeMediaTab === "video" && (
              <div className="rounded-xl border border-[var(--surface-border)] bg-background/50 p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Record Video */}
                  <div className="space-y-4 border-b md:border-b-0 md:border-r border-[var(--surface-border)] pb-6 md:pb-0 md:pr-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">Record Video</h4>
                        <p className="text-xs text-muted-foreground">Limits: 60s &amp; 50 MB max</p>
                      </div>
                      <button
                        type="button"
                        onClick={toggleCameraFacing}
                        className="flex items-center gap-1 rounded-lg border border-[var(--surface-border)] bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <SwitchCamera className="h-3 w-3" />
                        {cameraFacing === "user" ? "Front" : "Back"}
                      </button>
                    </div>

                    {/* Live Preview Viewport */}
                    <div className="relative aspect-video rounded-xl bg-black overflow-hidden flex items-center justify-center border border-[var(--surface-border)]">
                      <video
                        ref={liveVideoPreviewRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${!isRecordingVideo && !videoUrl ? "hidden" : ""}`}
                      />
                      {!isRecordingVideo && !videoUrl && (
                        <div className="text-center p-4 text-xs text-muted-foreground space-y-1">
                          <Film className="h-8 w-8 mx-auto text-muted-foreground/60" />
                          <p>Camera feed appears here when recording starts</p>
                        </div>
                      )}
                      {isRecordingVideo && (
                        <div className="absolute top-2 right-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-mono text-white flex items-center gap-1 shadow animate-pulse">
                          <span className="h-2 w-2 rounded-full bg-white" />
                          REC {videoSeconds}s / 60s
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-3">
                      {!isRecordingVideo ? (
                        <button
                          type="button"
                          onClick={startVideoRecording}
                          className="flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-xs font-bold text-white hover:bg-destructive/90 transition-colors shadow"
                        >
                          <Video className="h-4 w-4" />
                          Start Recording
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopVideoRecording}
                          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-foreground hover:bg-accent-hover transition-colors shadow"
                        >
                          <Square className="h-4 w-4" />
                          Stop Recording ({videoSeconds}s)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Upload Video File */}
                  <div className="space-y-4 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Upload Video File</h4>
                      <p className="text-xs text-muted-foreground">
                        Limits: 60s max • 50 MB max • MP4, WebM, MOV
                      </p>
                    </div>

                    <div className="border border-dashed border-[var(--surface-border)] rounded-xl p-6 text-center space-y-3 bg-surface/50">
                      <Upload className="h-8 w-8 mx-auto text-accent" />
                      <div className="text-xs text-muted-foreground">
                        Select a review video clip from your device
                      </div>
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={handleVideoUpload}
                        className="mx-auto block text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-accent file:text-accent-foreground hover:file:bg-accent-hover cursor-pointer"
                      />
                    </div>

                    {posterUrl && (
                      <div className="rounded-lg border border-[var(--surface-border)] p-2 bg-surface flex items-center gap-3">
                        <img src={posterUrl} alt="Video thumbnail" className="h-12 w-16 object-cover rounded" />
                        <div className="text-[11px] text-muted-foreground truncate">
                          <span className="font-semibold text-foreground block">Thumbnail captured</span>
                          {videoFilename} ({Math.round(videoDuration)}s)
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {videoUrl && (
                  <div className="pt-4 border-t border-[var(--surface-border)] space-y-2">
                    <span className="text-xs text-accent font-semibold block text-center">Video ready for extraction</span>
                    <video controls playsInline src={videoUrl} className="max-h-56 mx-auto rounded-lg border border-[var(--surface-border)]" />
                  </div>
                )}
              </div>
            )}

            {/* PHOTO ATTACHMENTS (Spec Section 6 & 13: up to 8 photos, 5MB each, EXIF GPS stripped) */}
            <div className="rounded-xl border border-[var(--surface-border)] bg-background/40 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-accent" />
                    Attach Photos ({photos.length}/8)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Up to 8 photos (5MB each). GPS location metadata is automatically stripped client-side.
                  </p>
                </div>

                {photos.length < 8 && (
                  <label className="self-start sm:self-auto cursor-pointer rounded-lg bg-surface border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-subtle transition-colors flex items-center gap-1.5">
                    <Upload className="h-3 w-3 text-accent" />
                    <span>{isProcessingPhotos ? "Processing..." : "Select Photos"}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handlePhotoUpload}
                      disabled={isProcessingPhotos}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {photos.map((p, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-[var(--surface-border)] bg-surface aspect-square">
                      <img src={p.previewUrl} alt={p.filename} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1.5 right-1.5 rounded-full bg-black/70 p-1 text-white hover:bg-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1 text-[9px] text-muted-foreground font-mono truncate">
                        GPS stripped
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stepper Footer Action */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--surface-border)]">
              <span className="text-xs text-muted-foreground">
                Media is transcribed, audio extracted, and structured into verified metrics in Step 3.
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
            videoUrl={videoUrl || reviewData.video_url || null}
            photoUrls={photos.map((p) => p.previewUrl)}
            mediaDuration={videoDuration || 60}
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
