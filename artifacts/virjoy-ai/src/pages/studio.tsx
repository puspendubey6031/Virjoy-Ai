import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useGetPlans,
  useCreateVideoJob,
  useGetVideo,
  useGenerateAiStory,
  VideoJobVideoType,
  VideoJobPlan,
  PlanId
} from "@workspace/api-client-react";

import { StatStrip } from "@/components/stat-strip";
import { PlanCard } from "@/components/plan-card";
import { VideoPlayer } from "@/components/video-player";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Sparkles, Wand2, CheckCircle2,
  Target, Ghost, MonitorPlay, Smartphone, Clapperboard, Video,
  Download, Activity, X, ImageIcon, Film, Monitor, ScanLine, Cpu, Zap,
  Languages, Globe, Mic, Palette, Captions
} from "lucide-react";

const formSchema = z.object({
  prompt: z.string().min(3, "Please describe your video idea"),
  videoType: z.nativeEnum(VideoJobVideoType).optional(),
  duration: z.coerce.number().refine(v => [10, 30, 60, 180].includes(v), { message: "Invalid duration" }),
  plan: z.nativeEnum(VideoJobPlan),
});

function detectStyle(prompt: string): { label: string; color: string } {
  const l = prompt.toLowerCase();
  if (/horror|scary|dark|thriller|spooky|ghost|nightmare|terror|creepy|eerie/.test(l))
    return { label: "Cinematic Horror", color: "bg-red-500/15 text-red-400 border-red-500/30" };
  if (/vlog|lifestyle|travel|daily|diary|day in|my life|personal|routine/.test(l))
    return { label: "Lifestyle Vlog", color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" };
  if (/\bad\b|commercial|product|sell|advertisement|offer|deal|discount/.test(l))
    return { label: "Commercial Ad", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
  return { label: "Brand Promo", color: "bg-violet-500/15 text-violet-400 border-violet-500/30" };
}

const EXAMPLE_PROMPTS = [
  { label: "Cinematic app promo", text: "Create a cinematic promo video for my mobile app with smooth transitions and modern effects" },
  { label: "Horror trailer", text: "Generate a dark horror trailer with eerie atmosphere, dramatic cuts and spine-chilling audio" },
  { label: "YouTube Shorts ad", text: "Create a punchy YouTube Shorts ad for a SaaS product with bold text and fast pacing" },
  { label: "Vlog intro", text: "Make an energetic vlog intro with vibrant colors, travel footage and upbeat music" },
];

const RATIOS = [
  { id: "16:9", label: "YouTube", sub: "16:9", icon: Monitor },
  { id: "9:16-shorts", label: "Shorts", sub: "9:16", icon: Smartphone },
  { id: "9:16-reel", label: "Reel", sub: "9:16", icon: Smartphone },
  { id: "1:1", label: "Facebook", sub: "1:1", icon: MonitorPlay },
  { id: "9:16-tiktok", label: "TikTok", sub: "9:16", icon: Clapperboard },
];

const GENERATION_STEPS = [
  { icon: ScanLine, label: "Analyzing prompt", color: "text-violet-400" },
  { icon: Zap, label: "Building scenes", color: "text-amber-400" },
  { icon: Cpu, label: "Syncing audio", color: "text-cyan-400" },
  { icon: Film, label: "Rendering cinematic video", color: "text-emerald-400" },
];

// ── AI narration settings (language / voice / tone) ──────────────────────────
const LANGUAGE_OPTIONS = [
  { value: "bn-IN", label: "Bengali" },
  { value: "hi-IN", label: "Hindi" },
  { value: "en-IN", label: "English (India)" },
  { value: "en-US", label: "English (US)" },
  { value: "gu-IN", label: "Gujarati" },
  { value: "mr-IN", label: "Marathi" },
  { value: "ta-IN", label: "Tamil" },
  { value: "te-IN", label: "Telugu" },
  { value: "ur-IN", label: "Urdu" },
];

const VOICE_OPTIONS = [
  "Indian Female Natural",
  "Indian Male Natural",
  "Hindi Female Neural Voice",
  "Hindi Male Neural Voice",
  "Bengali Female Voice",
  "English Indian Female Voice",
  "US Female Neural Voice",
  "US Male Neural Voice",
];

const TONE_OPTIONS = [
  "Normal",
  "Friendly",
  "Funny",
  "Emotional",
  "Cinematic",
  "Professional",
  "Energetic",
];

export default function Studio() {
  const { data: plans } = useGetPlans();
  const createVideoJob = useCreateVideoJob();
  const generateAiStory = useGenerateAiStory();
  const { toast } = useToast();

  const [images, setImages] = useState<File[]>([]);
  const [clips, setClips] = useState<File[]>([]);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const clipInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [selectedRatio, setSelectedRatio] = useState("16:9");
  const [genStep, setGenStep] = useState(0);

  // AI narration settings — used by the video generation pipeline later
  const [selectedLanguage, setSelectedLanguage] = useState("hi-IN");
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0]);
  const [selectedTone, setSelectedTone] = useState("Normal");
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);

  const { data: activeJob } = useGetVideo(activeJobId || "", {
    query: {
      queryKey: [activeJobId],
      enabled: !!activeJobId,
      refetchInterval: (query: any) => {
        const state = query.state.data;
        if (!state) return 3000;
        return (state.status === "queued" || state.status === "processing") ? 3000 : false;
      }
    }
  } as any);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { prompt: "", videoType: undefined, duration: 30, plan: "free" },
  });

  const selectedPlanId = form.watch("plan");
  const selectedPlan = plans?.find(p => p.id === selectedPlanId);
  const watchedPrompt = form.watch("prompt");
  const detectedStyle = watchedPrompt.length > 2 ? detectStyle(watchedPrompt) : null;
  const totalAttachments = images.length + clips.length + screenshots.length;

  const isGenerating = createVideoJob.isPending || activeJob?.status === "queued" || activeJob?.status === "processing";
  const isDone = activeJob?.status === "done";
  const isFailed = activeJob?.status === "failed";

  // Cycle generation steps while rendering
  useEffect(() => {
    if (!isGenerating) { setGenStep(0); return; }
    const interval = setInterval(() => {
      setGenStep(s => (s + 1) % GENERATION_STEPS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleEnhanceWithAi = async () => {
    const prompt = form.getValues("prompt");
    if (!prompt.trim()) return;
    try {
      const res = await generateAiStory.mutateAsync({ data: { prompt } });
      form.setValue("prompt", `${res.title}. ${res.story}`);
      if (res.detectedType) form.setValue("videoType", res.detectedType as VideoJobVideoType);
      toast({ title: "Prompt Enhanced!", description: "AI has expanded your idea into a cinematic brief." });
    } catch (err: any) {
      toast({ title: "Enhancement Failed", description: err?.message || "Could not enhance prompt", variant: "destructive" });
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const formData = new FormData();
    formData.append("prompt", values.prompt);
    if (values.videoType) formData.append("videoType", values.videoType);
    formData.append("duration", values.duration.toString());
    formData.append("plan", values.plan);
    images.forEach(img => formData.append("images", img));
    clips.forEach(clip => formData.append("clips", clip));
    screenshots.forEach(s => formData.append("images", s));
    try {
      const job = await createVideoJob.mutateAsync({ data: formData as any });
      setActiveJobId(job.id);
      toast({ title: "Generating Video", description: "Your cinematic video is being created." });
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err?.message || "Could not create video job", variant: "destructive" });
    }
  };

  const handleImageFiles = (files: FileList | null) => {
    if (!files) return;
    const max = selectedPlan?.maxImages || 1;
    setImages(prev => [...prev, ...Array.from(files)].slice(0, max));
  };
  const handleClipFiles = (files: FileList | null) => {
    if (!files) return;
    const max = selectedPlan?.maxClips || 1;
    setClips(prev => [...prev, ...Array.from(files)].slice(0, max));
  };
  const handleScreenshotFiles = (files: FileList | null) => {
    if (!files) return;
    const max = selectedPlan?.maxImages || 1;
    setScreenshots(prev => [...prev, ...Array.from(files)].slice(0, max));
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="w-full">

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-28 pb-16 px-4 overflow-hidden">
        {/* Ambient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.35, 1], opacity: [0.2, 0.42, 0.2], x: [0, 90, 0], y: [0, -50, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/3 -left-1/4 w-[750px] h-[750px] bg-primary/30 rounded-full blur-[140px]"
          />
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.28, 0.1], x: [0, -70, 0], y: [0, 90, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 3 }}
            className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-cyan-500/25 rounded-full blur-[120px]"
          />
          <motion.div
            animate={{ opacity: [0.05, 0.18, 0.05] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-2/3 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-violet-500/30 rounded-full blur-[80px]"
          />
        </div>

        <div className="relative z-10 w-full max-w-3xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/25 text-primary text-sm font-semibold mb-8 shadow-[0_0_20px_-5px_rgba(139,92,246,0.4)]"
          >
            <Sparkles className="w-4 h-4" />
            AI-Powered Video Generation
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tighter mb-5 leading-[1.06]"
          >
            <span className="bg-gradient-to-br from-white via-white/95 to-white/40 bg-clip-text text-transparent">
              Describe Your Video.
            </span>
            <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-primary via-violet-300 to-cyan-400 bg-clip-text text-transparent">
              We'll Create It.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg md:text-xl text-white/45 max-w-lg mx-auto mb-10 font-medium leading-relaxed"
          >
            Type a prompt. Optionally attach screenshots or clips.<br className="hidden sm:block" />
            VirJoy AI handles the rest.
          </motion.p>

          {/* ── MAIN CREATION INTERFACE ─────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.3 }}
            id="create"
            className="w-full"
          >
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>

                {/* ── PROMPT BOX ── */}
                <div className="relative group mb-3">
                  {/* animated gradient glow ring */}
                  <motion.div
                    animate={{ opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -inset-[1px] bg-gradient-to-r from-primary/60 via-cyan-500/30 to-violet-500/60 rounded-2xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"
                  />
                  <div className="relative bg-[#0d0d14] border border-white/[0.08] group-focus-within:border-primary/40 rounded-2xl transition-all duration-500 overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_60px_-20px_rgba(0,0,0,0.8)] group-focus-within:shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_20px_80px_-20px_rgba(139,92,246,0.25)]">
                    <FormField
                      control={form.control}
                      name="prompt"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              placeholder="Describe the video you want to create..."
                              rows={6}
                              className="w-full bg-transparent border-0 text-white text-lg md:text-xl placeholder:text-white/20 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 px-6 pt-6 pb-4 leading-relaxed font-medium tracking-[-0.01em]"
                              disabled={isGenerating}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="px-6 pb-2 text-left text-rose-400 text-sm" />
                        </FormItem>
                      )}
                    />

                    {/* Toolbar inside prompt box */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-white/[0.05] bg-white/[0.015]">
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* hidden file inputs */}
                        <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleImageFiles(e.target.files)} />
                        <input ref={clipInputRef} type="file" accept="video/*" multiple className="hidden" onChange={e => handleClipFiles(e.target.files)} />
                        <input ref={screenshotInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleScreenshotFiles(e.target.files)} />

                        {/* Attach buttons */}
                        {[
                          { label: "Images", icon: ImageIcon, count: images.length, max: selectedPlan?.maxImages || 1, onClick: () => imageInputRef.current?.click(), color: "text-blue-400" },
                          { label: "Clips", icon: Film, count: clips.length, max: selectedPlan?.maxClips || 1, onClick: () => clipInputRef.current?.click(), color: "text-emerald-400" },
                          { label: "Screenshots", icon: Monitor, count: screenshots.length, max: selectedPlan?.maxImages || 1, onClick: () => screenshotInputRef.current?.click(), color: "text-violet-400" },
                        ].map(btn => (
                          <button
                            key={btn.label}
                            type="button"
                            onClick={btn.onClick}
                            disabled={isGenerating || btn.count >= btn.max}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/45 hover:text-white/80 hover:bg-white/8 transition-all disabled:opacity-35 disabled:cursor-not-allowed group/btn"
                          >
                            <span className="text-white/30 group-hover/btn:text-white/60 transition-colors font-bold text-base leading-none">+</span>
                            <btn.icon className={`w-3.5 h-3.5 ${btn.color}`} />
                            <span>{btn.label}</span>
                            {btn.count > 0 && (
                              <span className="text-primary font-bold">({btn.count})</span>
                            )}
                          </button>
                        ))}

                        {/* detected style pill */}
                        <AnimatePresence>
                          {detectedStyle && (
                            <motion.span
                              key="style"
                              initial={{ opacity: 0, scale: 0.85, x: -4 }}
                              animate={{ opacity: 1, scale: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.85 }}
                              className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ml-1 ${detectedStyle.color}`}
                            >
                              <Sparkles className="w-3 h-3" />
                              {detectedStyle.label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedPlan?.aiStory && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={handleEnhanceWithAi}
                            disabled={generateAiStory.isPending || !watchedPrompt.trim() || isGenerating}
                            className="text-primary/70 hover:text-primary hover:bg-primary/10 text-xs font-semibold rounded-lg h-8 px-3 gap-1.5"
                          >
                            {generateAiStory.isPending
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enhancing...</>
                              : <><Wand2 className="w-3.5 h-3.5" /> Enhance with AI</>
                            }
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── ATTACHMENT CHIPS ── */}
                <AnimatePresence>
                  {totalAttachments > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className="flex flex-wrap gap-2 px-1"
                    >
                      {images.map((file, i) => (
                        <motion.div key={`img-${i}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2.5 py-1.5 text-xs text-blue-300">
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span className="max-w-[110px] truncate">{file.name}</span>
                          <button type="button" onClick={() => setImages(p => p.filter((_, idx) => idx !== i))} className="text-blue-400/50 hover:text-blue-300 ml-0.5"><X className="w-3 h-3" /></button>
                        </motion.div>
                      ))}
                      {clips.map((file, i) => (
                        <motion.div key={`clip-${i}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300">
                          <Film className="w-3.5 h-3.5" />
                          <span className="max-w-[110px] truncate">{file.name}</span>
                          <button type="button" onClick={() => setClips(p => p.filter((_, idx) => idx !== i))} className="text-emerald-400/50 hover:text-emerald-300 ml-0.5"><X className="w-3 h-3" /></button>
                        </motion.div>
                      ))}
                      {screenshots.map((file, i) => (
                        <motion.div key={`ss-${i}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg px-2.5 py-1.5 text-xs text-violet-300">
                          <Monitor className="w-3.5 h-3.5" />
                          <span className="max-w-[110px] truncate">{file.name}</span>
                          <button type="button" onClick={() => setScreenshots(p => p.filter((_, idx) => idx !== i))} className="text-violet-400/50 hover:text-violet-300 ml-0.5"><X className="w-3 h-3" /></button>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── PLATFORM RATIO SELECTOR ── */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-xs text-white/30 font-medium">Platform:</span>
                  {RATIOS.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRatio(r.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                        selectedRatio === r.id
                          ? "bg-primary/20 border-primary/50 text-primary shadow-[0_0_12px_-4px_rgba(139,92,246,0.6)]"
                          : "bg-white/[0.04] border-white/10 text-white/40 hover:text-white/70 hover:bg-white/8 hover:border-white/20"
                      }`}
                    >
                      <r.icon className="w-3 h-3" />
                      {r.label}
                      <span className="text-[10px] opacity-60">{r.sub}</span>
                    </button>
                  ))}
                </div>

                {/* ── OPTIONS ROW: duration + plan + style ── */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem className="flex-shrink-0">
                        <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value.toString()}>
                          <FormControl>
                            <SelectTrigger className="h-9 bg-white/[0.04] border-white/10 rounded-xl text-sm text-white/60 hover:bg-white/8 hover:text-white/80 w-36 transition-colors">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="10" disabled={(selectedPlan?.maxDuration || 0) < 10}>10 Seconds</SelectItem>
                            <SelectItem value="30" disabled={(selectedPlan?.maxDuration || 0) < 30}>30 Seconds</SelectItem>
                            <SelectItem value="60" disabled={(selectedPlan?.maxDuration || 0) < 60}>1 Minute</SelectItem>
                            <SelectItem value="180" disabled={(selectedPlan?.maxDuration || 0) < 180}>3 Minutes</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="plan"
                    render={({ field }) => (
                      <FormItem className="flex-shrink-0">
                        <Select onValueChange={(v) => {
                          field.onChange(v);
                          const plan = plans?.find(p => p.id === v);
                          if (plan && form.getValues("duration") > plan.maxDuration) form.setValue("duration", plan.maxDuration);
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9 bg-white/[0.04] border-white/10 rounded-xl text-sm text-white/60 hover:bg-white/8 hover:text-white/80 w-40 transition-colors">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {plans?.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} {p.price > 0 ? `· ₹${p.price}/mo` : "· Free"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="videoType"
                    render={({ field }) => (
                      <FormItem className="flex-shrink-0">
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <FormControl>
                            <SelectTrigger className="h-9 bg-white/[0.04] border-white/10 rounded-xl text-sm text-white/50 hover:bg-white/8 hover:text-white/70 w-44 transition-colors">
                              <SelectValue placeholder="Auto-detect style" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ad">Commercial Ad</SelectItem>
                            <SelectItem value="horror">Cinematic Horror</SelectItem>
                            <SelectItem value="promo">Brand Promo</SelectItem>
                            <SelectItem value="vlog">Lifestyle Vlog</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                {/* ── AI SETTINGS PANEL (language / voice / tone) ── */}
                <div className="mb-4 rounded-2xl border border-white/[0.08] bg-[#0d0d14] p-4 sm:p-5 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_-30px_rgba(0,0,0,0.8)]">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/80 to-cyan-500/80 flex items-center justify-center shrink-0">
                      <Languages className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white/90 leading-tight">AI Voice &amp; Language</p>
                      <p className="text-[11px] text-white/35 leading-tight">Pick language, voice and tone for narration</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Language */}
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                        <Globe className="w-3 h-3 text-primary" /> Language
                      </label>
                      <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                        <SelectTrigger className="h-9 bg-white/[0.04] border-white/10 rounded-xl text-sm text-white/70 hover:bg-white/8 hover:text-white/90 transition-colors">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGE_OPTIONS.map(l => (
                            <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Voice */}
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                        <Mic className="w-3 h-3 text-primary" /> Voice
                      </label>
                      <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                        <SelectTrigger className="h-9 bg-white/[0.04] border-white/10 rounded-xl text-sm text-white/70 hover:bg-white/8 hover:text-white/90 transition-colors">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VOICE_OPTIONS.map(v => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Tone */}
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                        <Palette className="w-3 h-3 text-primary" /> Tone
                      </label>
                      <Select value={selectedTone} onValueChange={setSelectedTone}>
                        <SelectTrigger className="h-9 bg-white/[0.04] border-white/10 rounded-xl text-sm text-white/70 hover:bg-white/8 hover:text-white/90 transition-colors">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TONE_OPTIONS.map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* ── SUBTITLE TOGGLE ── */}
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Captions className="w-4 h-4 text-primary shrink-0" />
                      <div className="leading-tight">
                        <p className="text-sm font-semibold text-white/80">Subtitles</p>
                        <p className="text-[11px] text-white/35">
                          {subtitlesEnabled
                            ? "Captions will be added automatically"
                            : "Video will be generated without subtitles"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[11px] font-bold uppercase tracking-wide ${subtitlesEnabled ? "text-primary" : "text-white/30"}`}>
                        {subtitlesEnabled ? "On" : "Off"}
                      </span>
                      <Switch
                        checked={subtitlesEnabled}
                        onCheckedChange={setSubtitlesEnabled}
                        aria-label="Toggle subtitles"
                      />
                    </div>
                  </div>
                </div>

                {/* ── GENERATE BUTTON ── */}
                {!activeJobId && (
                  <div className="relative group/btn">
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute -inset-[2px] bg-gradient-to-r from-primary via-violet-400 to-cyan-500 rounded-2xl blur-md group-hover/btn:blur-lg transition-all duration-300"
                    />
                    <Button
                      type="submit"
                      size="lg"
                      className="relative w-full h-14 rounded-xl text-lg font-black bg-gradient-to-r from-primary via-violet-500 to-cyan-500 hover:from-primary/90 hover:via-violet-500/90 hover:to-cyan-500/90 text-white border-0 shadow-none transition-all duration-300 hover:scale-[1.015]"
                      disabled={isGenerating}
                    >
                      {isGenerating
                        ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating…</>
                        : <><Sparkles className="w-5 h-5 mr-2" /> Generate Cinematic Video</>
                      }
                    </Button>
                  </div>
                )}
              </form>
            </Form>

            {/* ── EXAMPLE PROMPTS ── */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-white/20 font-medium">Try:</span>
              {EXAMPLE_PROMPTS.map((p, i) => (
                <motion.button
                  key={i}
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => form.setValue("prompt", p.text)}
                  className="text-xs text-white/40 hover:text-white/75 bg-white/[0.03] hover:bg-primary/10 border border-white/[0.07] hover:border-primary/30 rounded-full px-3.5 py-1.5 transition-all duration-200 font-medium"
                >
                  {p.label}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* ── JOB STATUS PANEL ── */}
          <AnimatePresence>
            {activeJobId && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                className="mt-6 rounded-2xl overflow-hidden border border-white/10 backdrop-blur-xl text-left shadow-[0_20px_80px_-20px_rgba(0,0,0,0.8)]"
              >
                <div className="bg-[#0d0d14] p-6">
                  <div className="flex items-center gap-2 mb-5 font-semibold text-sm text-white/60 uppercase tracking-widest">
                    <Activity className="w-3.5 h-3.5 text-primary" />
                    Generation Status
                  </div>

                  {/* ── CINEMATIC GENERATION STEPS ── */}
                  {isGenerating && (
                    <div className="space-y-5">
                      {/* Step indicators */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {GENERATION_STEPS.map((step, i) => {
                          const isActive = i === genStep;
                          const isDoneStep = i < genStep;
                          return (
                            <motion.div
                              key={i}
                              animate={isActive ? { scale: [1, 1.02, 1] } : {}}
                              transition={{ duration: 1.2, repeat: Infinity }}
                              className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-500 ${
                                isActive
                                  ? "bg-primary/10 border-primary/30 shadow-[0_0_20px_-8px_rgba(139,92,246,0.5)]"
                                  : isDoneStep
                                  ? "bg-emerald-500/5 border-emerald-500/20"
                                  : "bg-white/[0.02] border-white/[0.06]"
                              }`}
                            >
                              {isDoneStep
                                ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                : isActive
                                ? <step.icon className={`w-5 h-5 ${step.color} animate-pulse`} />
                                : <step.icon className="w-5 h-5 text-white/20" />
                              }
                              <span className={`text-[10px] font-semibold text-center leading-tight ${
                                isActive ? "text-white/80" : isDoneStep ? "text-emerald-400/70" : "text-white/20"
                              }`}>
                                {step.label}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* Progress bar */}
                      <div className="relative h-1 w-full bg-white/[0.06] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-primary via-violet-400 to-cyan-400"
                          animate={{ width: ["5%", "85%", "5%"] }}
                          transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
                        />
                      </div>

                      {/* Active step label */}
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={genStep}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="text-sm text-center text-white/40"
                        >
                          {GENERATION_STEPS[genStep].label}…
                        </motion.p>
                      </AnimatePresence>
                    </div>
                  )}

                  {isDone && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/8 p-3.5 rounded-xl border border-emerald-400/20 text-sm font-semibold">
                        <CheckCircle2 className="w-5 h-5 shrink-0" /> Your cinematic video is ready!
                      </div>
                      {activeJob?.outputUrl && (
                        <div className="rounded-xl overflow-hidden border border-white/10 bg-black">
                          <VideoPlayer url={activeJob.outputUrl} title={activeJob.title || "Generated Video"} />
                        </div>
                      )}
                      <Button
                        variant="outline"
                        className="w-full h-11 rounded-xl border-white/15 hover:bg-white/8 font-semibold text-sm"
                        onClick={() => { setActiveJobId(null); form.reset(); setImages([]); setClips([]); setScreenshots([]); }}
                      >
                        Create Another Video
                      </Button>
                    </div>
                  )}

                  {isFailed && (
                    <div className="space-y-4">
                      <div className="text-rose-400 bg-rose-400/8 p-3.5 rounded-xl border border-rose-400/20 text-sm font-medium">
                        Generation failed. Please try again.
                      </div>
                      <Button variant="outline" className="w-full h-11 rounded-xl border-white/15 hover:bg-white/8 font-semibold text-sm" onClick={() => setActiveJobId(null)}>
                        Reset
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* stat strip */}
        <div className="w-full mt-14 relative z-10">
          <StatStrip />
        </div>
      </section>

      {/* ── CAPABILITIES STRIP ────────────────────────────────────── */}
      <section className="py-20 relative border-t border-white/[0.05]">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.04] rounded-3xl overflow-hidden">
            {[
              { icon: Sparkles, title: "Prompt → Video", desc: "Describe any video in plain language. AI detects style, pacing, and effects automatically.", color: "text-primary" },
              { icon: Film, title: "Attach Your Media", desc: "Optionally add screenshots, images, or clips. They're woven into your video as cinematic scenes.", color: "text-cyan-400" },
              { icon: Download, title: "Cinematic Output", desc: "Professional transitions, color grading, and effects — rendered and ready to share.", color: "text-violet-400" },
            ].map((item, i) => (
              <div key={i} className="bg-[#09090f] p-8 md:p-10 flex flex-col gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  <item.icon className={`w-6 h-6 ${item.color}`} />
                </div>
                <h3 className="text-lg font-bold">{item.title}</h3>
                <p className="text-white/40 leading-relaxed text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VIDEO FORMATS ─────────────────────────────────────────── */}
      <section className="py-20 relative border-t border-white/[0.05]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Every Format, One Prompt</h2>
            <p className="text-white/35 mt-3 text-base">Click any format to auto-fill a matching prompt</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 max-w-5xl mx-auto">
            {[
              { name: "Ads", icon: Target, gradient: "from-amber-500/15", border: "hover:border-amber-500/40", prompt: "Create a high-converting commercial ad for a premium product with bold visuals" },
              { name: "Horror", icon: Ghost, gradient: "from-red-500/15", border: "hover:border-red-500/40", prompt: "Make a dark cinematic horror trailer with eerie atmosphere and dramatic cuts" },
              { name: "Promo", icon: MonitorPlay, gradient: "from-violet-500/15", border: "hover:border-violet-500/40", prompt: "Create a brand promo video with smooth modern transitions and clean typography" },
              { name: "Reels", icon: Smartphone, gradient: "from-pink-500/15", border: "hover:border-pink-500/40", prompt: "Make a short punchy reel with dynamic cuts and trending music" },
              { name: "Vlogs", icon: Video, gradient: "from-cyan-500/15", border: "hover:border-cyan-500/40", prompt: "Create a personal lifestyle vlog with warm visuals and natural pacing" },
              { name: "Shorts", icon: Clapperboard, gradient: "from-green-500/15", border: "hover:border-green-500/40", prompt: "Make a viral social media short with fast pacing and bold text overlays" },
            ].map((type, i) => (
              <motion.button
                key={i}
                type="button"
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { form.setValue("prompt", type.prompt); scrollToSection("create"); }}
                className={`group p-5 rounded-2xl border border-white/[0.06] bg-gradient-to-br ${type.gradient} to-transparent backdrop-blur-md transition-all duration-200 ${type.border} hover:shadow-lg text-left`}
              >
                <type.icon className="w-7 h-7 mb-3 text-white/50 group-hover:text-white transition-colors duration-200" />
                <p className="text-sm font-bold">{type.name}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 relative border-t border-white/[0.05]">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">From Prompt to Video in Seconds</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { icon: Sparkles, title: "Write Your Prompt", desc: "Describe the video you want. AI reads your intent and auto-detects the perfect style." },
              { icon: Film, title: "Attach & Configure", desc: "Optionally upload screenshots or clips. Set duration and plan quality." },
              { icon: Download, title: "Download & Share", desc: "Your cinematic video is rendered, graded, and ready to download." },
            ].map((step, i) => (
              <div key={i} className="relative text-center">
                {i < 2 && (
                  <div className="hidden md:block absolute top-10 left-[calc(50%+44px)] right-[-calc(50%-44px)] h-px bg-gradient-to-r from-primary/30 to-transparent" />
                )}
                <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-5 relative shadow-[0_0_30px_-10px_rgba(139,92,246,0.3)]">
                  <span className="absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full bg-gradient-to-br from-primary to-violet-600 text-white text-xs font-black flex items-center justify-center shadow-[0_0_10px_-3px_rgba(139,92,246,0.8)]">{i + 1}</span>
                  <step.icon className="w-8 h-8 text-white/60" />
                </div>
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLAN SELECTOR ─────────────────────────────────────────── */}
      <section className="py-20 relative border-t border-white/[0.05]">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Choose Your Plan</h2>
            <p className="text-white/35 text-base">Upgrade for higher quality, longer videos, and AI story generation.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans?.map((plan) => (
              <PlanCard
                key={`pricing-${plan.id}`}
                plan={plan}
                isSelected={selectedPlanId === plan.id}
                onSelect={() => {
                  form.setValue("plan", plan.id as PlanId);
                  if (form.getValues("duration") > plan.maxDuration) form.setValue("duration", plan.maxDuration);
                  scrollToSection("create");
                }}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
