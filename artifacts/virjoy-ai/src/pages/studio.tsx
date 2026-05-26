import { useState, useRef } from "react";
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
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Sparkles, Wand2, CheckCircle2,
  Target, Ghost, MonitorPlay, Smartphone, Clapperboard, Video,
  ArrowRight, Download, PlayCircle, Activity,
  Paperclip, X, ImageIcon, Film
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
  "Create a cinematic promo video for my mobile app with smooth transitions",
  "Make a dark horror trailer with eerie music and dramatic cuts",
  "Create a YouTube ad for a modern SaaS product with clean visuals",
  "Make a lifestyle vlog intro with energetic pacing and vibrant colors",
];

export default function Studio() {
  const { data: plans } = useGetPlans();
  const createVideoJob = useCreateVideoJob();
  const generateAiStory = useGenerateAiStory();
  const { toast } = useToast();

  const [images, setImages] = useState<File[]>([]);
  const [clips, setClips] = useState<File[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const clipInputRef = useRef<HTMLInputElement>(null);

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [showPlanSelector, setShowPlanSelector] = useState(false);

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
  const totalAttachments = images.length + clips.length;

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
    try {
      const job = await createVideoJob.mutateAsync({ data: formData as any });
      setActiveJobId(job.id);
      toast({ title: "Generating Video", description: "Your video is being created from your prompt." });
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err?.message || "Could not create video job", variant: "destructive" });
    }
  };

  const handleImageFiles = (files: FileList | null) => {
    if (!files) return;
    const maxImages = selectedPlan?.maxImages || 1;
    const newFiles = Array.from(files).slice(0, maxImages - images.length);
    setImages(prev => [...prev, ...newFiles].slice(0, maxImages));
  };

  const handleClipFiles = (files: FileList | null) => {
    if (!files) return;
    const maxClips = selectedPlan?.maxClips || 1;
    const newFiles = Array.from(files).slice(0, maxClips - clips.length);
    setClips(prev => [...prev, ...newFiles].slice(0, maxClips));
  };

  const isGenerating = createVideoJob.isPending || activeJob?.status === "queued" || activeJob?.status === "processing";
  const isDone = activeJob?.status === "done";
  const isFailed = activeJob?.status === "failed";

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="w-full">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-28 pb-16 px-4 overflow-hidden">
        {/* bg orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.25, 0.45, 0.25], x: [0, 80, 0], y: [0, -40, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/3 -left-1/4 w-[700px] h-[700px] bg-primary/25 rounded-full blur-[130px]"
          />
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.15, 0.35, 0.15], x: [0, -80, 0], y: [0, 80, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 3 }}
            className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-cyan-500/20 rounded-full blur-[110px]"
          />
        </div>

        <div className="relative z-10 w-full max-w-4xl mx-auto text-center">
          {/* badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-8"
          >
            <Sparkles className="w-4 h-4" />
            AI-Powered Video Generation
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tighter mb-5 bg-gradient-to-br from-white via-white/95 to-white/50 bg-clip-text text-transparent leading-[1.08]"
          >
            Describe Your Video.<br className="hidden md:block" /> We'll Create It.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg md:text-xl text-white/50 max-w-xl mx-auto mb-12 font-medium"
          >
            Type a prompt. Optionally attach screenshots or clips. VirJoy AI handles the rest.
          </motion.p>

          {/* ── MAIN CREATION INTERFACE ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            id="create"
            className="w-full"
          >
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                {/* PROMPT BOX */}
                <div className="relative group mb-3">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/40 via-cyan-500/20 to-primary/40 rounded-2xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                  <div className="relative bg-white/[0.04] border border-white/10 group-focus-within:border-primary/30 rounded-2xl transition-colors duration-300 overflow-hidden backdrop-blur-xl">
                    <FormField
                      control={form.control}
                      name="prompt"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              placeholder="Describe the video you want to create..."
                              rows={4}
                              className="w-full bg-transparent border-0 text-white text-base md:text-lg placeholder:text-white/25 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 px-6 pt-5 pb-3 leading-relaxed"
                              disabled={isGenerating}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="px-6 pb-2 text-left text-rose-400" />
                        </FormItem>
                      )}
                    />

                    {/* bottom toolbar inside the prompt box */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-white/[0.06]">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* attach images */}
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={e => handleImageFiles(e.target.files)}
                        />
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          disabled={isGenerating || images.length >= (selectedPlan?.maxImages || 1)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ImageIcon className="w-4 h-4" />
                          <span>Images {images.length > 0 && <span className="text-primary font-semibold">({images.length})</span>}</span>
                        </button>

                        {/* attach clips */}
                        <input
                          ref={clipInputRef}
                          type="file"
                          accept="video/*"
                          multiple
                          className="hidden"
                          onChange={e => handleClipFiles(e.target.files)}
                        />
                        <button
                          type="button"
                          onClick={() => clipInputRef.current?.click()}
                          disabled={isGenerating || clips.length >= (selectedPlan?.maxClips || 1)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Film className="w-4 h-4" />
                          <span>Clips {clips.length > 0 && <span className="text-primary font-semibold">({clips.length})</span>}</span>
                        </button>

                        {/* detected style badge */}
                        <AnimatePresence>
                          {detectedStyle && (
                            <motion.span
                              key="style"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${detectedStyle.color}`}
                            >
                              <Sparkles className="w-3 h-3" />
                              {detectedStyle.label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* AI enhance — premium only */}
                        {selectedPlan?.aiStory && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={handleEnhanceWithAi}
                            disabled={generateAiStory.isPending || !watchedPrompt.trim() || isGenerating}
                            className="text-primary/80 hover:text-primary hover:bg-primary/10 text-xs font-semibold rounded-lg h-8 px-3 gap-1.5"
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

                {/* attachments preview strip */}
                <AnimatePresence>
                  {totalAttachments > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex flex-wrap gap-2 mb-3 px-1"
                    >
                      {images.map((file, i) => (
                        <div key={`img-${i}`} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/60">
                          <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                          <span className="max-w-[100px] truncate">{file.name}</span>
                          <button type="button" onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} className="text-white/30 hover:text-white/70 ml-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {clips.map((file, i) => (
                        <div key={`clip-${i}`} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/60">
                          <Film className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="max-w-[100px] truncate">{file.name}</span>
                          <button type="button" onClick={() => setClips(prev => prev.filter((_, idx) => idx !== i))} className="text-white/30 hover:text-white/70 ml-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* options row: duration + plan + style override */}
                <div className="flex flex-wrap items-center gap-2 mb-4 px-1">
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem className="flex-shrink-0">
                        <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value.toString()}>
                          <FormControl>
                            <SelectTrigger className="h-9 bg-white/5 border-white/10 rounded-xl text-sm text-white/70 hover:bg-white/10 w-36">
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
                          if (plan && form.getValues("duration") > plan.maxDuration) {
                            form.setValue("duration", plan.maxDuration);
                          }
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9 bg-white/5 border-white/10 rounded-xl text-sm text-white/70 hover:bg-white/10 w-40">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {plans?.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} {p.price > 0 ? `(₹${p.price}/mo)` : "(Free)"}
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
                            <SelectTrigger className="h-9 bg-white/5 border-white/10 rounded-xl text-sm text-white/50 hover:bg-white/10 w-44">
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

                  <span className="text-xs text-white/25 hidden sm:block">Style auto-detected if not set</span>
                </div>

                {/* generate button */}
                {!activeJobId && (
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full h-14 rounded-xl text-lg font-black bg-white text-black hover:bg-white/90 shadow-[0_0_50px_-12px_rgba(255,255,255,0.5)] transition-all duration-300 hover:scale-[1.015] hover:shadow-[0_0_60px_-10px_rgba(255,255,255,0.6)]"
                    disabled={isGenerating}
                  >
                    {isGenerating
                      ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</>
                      : <><Sparkles className="w-5 h-5 mr-2" /> Generate Video</>
                    }
                  </Button>
                )}
              </form>
            </Form>

            {/* example prompts */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-white/25">Try:</span>
              {EXAMPLE_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => form.setValue("prompt", p)}
                  className="text-xs text-white/35 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-full px-3 py-1 transition-all truncate max-w-[240px]"
                >
                  {p}
                </button>
              ))}
            </div>
          </motion.div>

          {/* job status panel (shown after submission) */}
          <AnimatePresence>
            {activeJobId && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-6 p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl text-left"
              >
                <div className="flex items-center gap-2 mb-4 font-semibold text-base">
                  <Activity className="w-4 h-4 text-primary" />
                  Generation Status
                </div>

                {isGenerating && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60 capitalize">{activeJob?.status || "Initializing"}…</span>
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-cyan-400 rounded-full"
                        initial={{ width: "5%" }}
                        animate={{ width: activeJob?.status === "processing" ? "65%" : "30%" }}
                        transition={{ duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
                      />
                    </div>
                    <p className="text-xs text-white/35 text-center">Applying cinematic effects and rendering your video…</p>
                  </div>
                )}

                {isDone && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 p-3 rounded-xl border border-emerald-400/20 text-sm font-semibold">
                      <CheckCircle2 className="w-5 h-5 shrink-0" /> Your video is ready!
                    </div>
                    {activeJob?.outputUrl && (
                      <div className="rounded-xl overflow-hidden border border-white/10 bg-black">
                        <VideoPlayer url={activeJob.outputUrl} title={activeJob.title || "Generated Video"} />
                      </div>
                    )}
                    <Button
                      variant="outline"
                      className="w-full h-11 rounded-xl border-white/15 hover:bg-white/10 font-semibold text-sm"
                      onClick={() => { setActiveJobId(null); form.reset(); setImages([]); setClips([]); }}
                    >
                      Create Another Video
                    </Button>
                  </div>
                )}

                {isFailed && (
                  <div className="space-y-4">
                    <div className="text-rose-400 bg-rose-400/10 p-3 rounded-xl border border-rose-400/20 text-sm font-medium">
                      Generation failed. Please try again.
                    </div>
                    <Button variant="outline" className="w-full h-11 rounded-xl border-white/15 hover:bg-white/10 font-semibold text-sm" onClick={() => setActiveJobId(null)}>
                      Reset
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* stat strip */}
        <div className="w-full mt-12 relative z-10">
          <StatStrip />
        </div>
      </section>

      {/* ── CAPABILITIES (3 clean highlights — no upload tool cards) ── */}
      <section className="py-20 relative border-t border-white/5">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 rounded-3xl overflow-hidden">
            {[
              {
                icon: Sparkles,
                title: "Prompt → Video",
                desc: "Describe any video in plain language. The AI detects style, pacing, and effects automatically.",
                color: "text-primary"
              },
              {
                icon: Paperclip,
                title: "Attach Your Media",
                desc: "Optionally add screenshots, images, or short clips. They're woven into your video as cinematic scenes.",
                color: "text-cyan-400"
              },
              {
                icon: Film,
                title: "Cinematic Output",
                desc: "Every video gets professional transitions, color grading, and effects — rendered and ready to share.",
                color: "text-violet-400"
              },
            ].map((item, i) => (
              <div key={i} className="bg-black/60 backdrop-blur-sm p-8 md:p-10 flex flex-col gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                  <item.icon className={`w-6 h-6 ${item.color}`} />
                </div>
                <h3 className="text-xl font-bold">{item.title}</h3>
                <p className="text-white/50 leading-relaxed text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VIDEO FORMATS ── */}
      <section className="py-20 relative border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Every Format, One Prompt</h2>
            <p className="text-white/40 mt-3 text-base">Just describe your idea — the style is detected automatically</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 max-w-5xl mx-auto">
            {[
              { name: "Ads", icon: Target, gradient: "from-amber-500/15", border: "hover:border-amber-500/40", prompt: "Create a high-converting commercial ad for a premium product" },
              { name: "Horror", icon: Ghost, gradient: "from-red-500/15", border: "hover:border-red-500/40", prompt: "Make a dark cinematic horror trailer with eerie atmosphere" },
              { name: "Promo", icon: MonitorPlay, gradient: "from-violet-500/15", border: "hover:border-violet-500/40", prompt: "Create a brand promo video with smooth modern transitions" },
              { name: "Reels", icon: Smartphone, gradient: "from-pink-500/15", border: "hover:border-pink-500/40", prompt: "Make a short punchy reel with dynamic cuts and music" },
              { name: "Vlogs", icon: Video, gradient: "from-cyan-500/15", border: "hover:border-cyan-500/40", prompt: "Create a personal vlog with warm lifestyle visuals" },
              { name: "Shorts", icon: Clapperboard, gradient: "from-green-500/15", border: "hover:border-green-500/40", prompt: "Make a viral social media short with fast pacing" },
            ].map((type, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { form.setValue("prompt", type.prompt); scrollToSection("create"); }}
                className={`group p-5 rounded-2xl border border-white/5 bg-gradient-to-br ${type.gradient} to-transparent backdrop-blur-md transition-all duration-200 ${type.border} hover:scale-[1.03] hover:shadow-lg text-left`}
              >
                <type.icon className="w-7 h-7 mb-3 text-white/60 group-hover:text-white transition-colors" />
                <p className="text-sm font-bold">{type.name}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-20 relative border-t border-white/5">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">From Prompt to Video in Seconds</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: "01", icon: Sparkles, title: "Write Your Prompt", desc: "Describe the video you want. Our AI reads your intent and auto-detects the perfect style." },
              { num: "02", icon: Paperclip, title: "Attach & Configure", desc: "Optionally upload screenshots or clips. Set your duration and plan quality." },
              { num: "03", icon: Download, title: "Download & Share", desc: "Your cinematic video is rendered, graded, and ready to download in minutes." },
            ].map((step, i) => (
              <div key={i} className="relative text-center">
                {i < 2 && (
                  <div className="hidden md:block absolute top-10 left-[calc(50%+40px)] right-[-calc(50%-40px)] h-px bg-gradient-to-r from-white/20 to-transparent" />
                )}
                <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-5 relative">
                  <span className="absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center">{i + 1}</span>
                  <step.icon className="w-8 h-8 text-white/70" />
                </div>
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLAN SELECTOR ── */}
      <section className="py-20 relative border-t border-white/5">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Choose Your Plan</h2>
            <p className="text-white/40 text-base">Upgrade for higher quality, longer videos, and AI story generation.</p>
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
