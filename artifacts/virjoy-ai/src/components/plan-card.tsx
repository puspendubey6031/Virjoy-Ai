import { motion } from "framer-motion";
import { Plan } from "@workspace/api-client-react";
import { Check, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanCardProps {
  plan: Plan;
  isSelected?: boolean;
  onSelect?: () => void;
  displayOnly?: boolean;
}

export function PlanCard({ plan, isSelected, onSelect, displayOnly = false }: PlanCardProps) {
  const isPremium = plan.id === "premium";

  const getExtraBullets = (id: string) => {
    switch (id) {
      case "free":
      case "starter":
        return [
          "Form-Based Video Creation",
          "No AI Story Generation"
        ];
      case "creator":
        return [
          "Enhanced Cinematic Effects",
          "Smart AI Assistance"
        ];
      case "premium":
        return [
          "AI Idea-to-Video Generation",
          "Automatic Story + Scene Creation"
        ];
      default:
        return [];
    }
  };

  const extraBullets = getExtraBullets(plan.id);

  return (
    <motion.div
      whileHover={!displayOnly ? { y: -4 } : undefined}
      whileTap={!displayOnly ? { scale: 0.98 } : undefined}
      onClick={!displayOnly ? onSelect : undefined}
      className={cn(
        "relative p-8 rounded-3xl border transition-all duration-300 overflow-hidden flex flex-col h-full",
        !displayOnly && "cursor-pointer",
        isSelected && !displayOnly
          ? "bg-primary/10 border-primary ring-1 ring-primary/50 shadow-[0_0_40px_-10px_rgba(var(--primary),0.4)]"
          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 hover:shadow-2xl hover:shadow-primary/5"
      )}
    >
      {isPremium && (
        <div className="absolute top-0 right-0">
          <div className="bg-gradient-to-r from-primary to-cyan-500 text-white text-[11px] font-bold px-4 py-1.5 rounded-bl-xl flex items-center gap-1.5 uppercase tracking-widest shadow-lg">
            <Sparkles className="w-3.5 h-3.5" />
            Most Popular
          </div>
        </div>
      )}

      {isSelected && !displayOnly && (
        <div className="absolute -inset-px bg-gradient-to-b from-primary/20 to-transparent rounded-3xl pointer-events-none" />
      )}

      <div className="mb-6 relative z-10">
        <h3 className="text-2xl font-black capitalize mb-2 tracking-tight">{plan.name}</h3>
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-black tracking-tighter">
            {plan.price === 0 ? "Free" : `₹${plan.price}`}
          </span>
          {plan.price > 0 && <span className="text-sm font-medium text-white/50">/month</span>}
        </div>
      </div>

      <p className="text-sm text-white/60 mb-8 flex-grow relative z-10 leading-relaxed">
        {plan.description || `Perfect for ${plan.name} creations.`}
      </p>

      <ul className="space-y-4 mb-8 relative z-10">
        <li className="flex items-start gap-3 text-sm">
          <Check className="w-5 h-5 text-primary shrink-0" />
          <span className="text-white/80">Up to <strong className="text-white">{plan.maxDuration}s</strong> duration</span>
        </li>
        <li className="flex items-start gap-3 text-sm">
          <Check className="w-5 h-5 text-primary shrink-0" />
          <span className="text-white/80">Max <strong className="text-white">{plan.maxImages}</strong> images, <strong className="text-white">{plan.maxClips}</strong> clips</span>
        </li>
        <li className="flex items-start gap-3 text-sm">
          <Check className="w-5 h-5 text-primary shrink-0" />
          <span className="text-white/80"><strong className="text-white capitalize">{plan.quality}</strong> quality</span>
        </li>
        
        {plan.aiStory && (
          <li className="flex items-start gap-3 text-sm font-medium">
            <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
            <span className="text-cyan-400">AI Story Generation</span>
          </li>
        )}
        
        {!plan.watermark && (
          <li className="flex items-start gap-3 text-sm">
            <Check className="w-5 h-5 text-primary shrink-0" />
            <span className="text-white/80">No Watermark</span>
          </li>
        )}

        {extraBullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <Star className="w-4 h-4 text-primary/70 shrink-0 mt-0.5" />
            <span className="text-white/70">{bullet}</span>
          </li>
        ))}
      </ul>
      
      {!displayOnly && (
        <div className={cn(
          "w-full py-3.5 rounded-xl text-center text-sm font-bold transition-all duration-300 relative z-10",
          isSelected 
            ? "bg-primary text-white shadow-lg shadow-primary/25" 
            : "bg-white/10 text-white group-hover:bg-white/20"
        )}>
          {isSelected ? "Selected" : "Select Plan"}
        </div>
      )}
    </motion.div>
  );
}