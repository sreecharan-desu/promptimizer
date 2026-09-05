import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  DatabaseZap,
  Route,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { DOCS_URL } from "@/lib/site";

function RoutingPreview() {
  return (
    <div className="hero-preview hero-preview-routing">
      <div className="hero-preview-topline"><Route className="size-3.5" /> Smart route <span>live</span></div>
      {["Fast answer", "Complex analysis", "Repeat request"].map((label, index) => (
        <div key={label} className="hero-route-row">
          <span>{label}</span><i style={{ width: `${88 - index * 16}%` }} /><b>{index === 2 ? "cache" : "routed"}</b>
        </div>
      ))}
    </div>
  );
}

function QualityPreview() {
  return (
    <div className="hero-preview hero-preview-quality">
      <div className="hero-preview-topline"><ShieldCheck className="size-3.5" /> Quality gate <span>passed</span></div>
      <div className="hero-score-row"><strong>5.0</strong><strong>5.0</strong><strong>4.9</strong></div>
      <div className="hero-score-labels"><span>Accuracy</span><span>Schema</span><span>Latency</span></div>
      <div className="hero-quality-check"><CheckCircle2 className="size-3.5" /> Ready to return</div>
    </div>
  );
}

function CachePreview() {
  return (
    <div className="hero-preview hero-preview-cache">
      <div className="hero-preview-topline"><DatabaseZap className="size-3.5" /> Semantic cache <span>0 ms</span></div>
      <div className="hero-prompt-bubble">Summarize Q3 revenue…</div>
      <div className="hero-cache-line"><i /><small>0.98 match</small><i /></div>
      <div className="hero-prompt-bubble hero-prompt-bubble-answer">Replayed from cache</div>
    </div>
  );
}

function SavingsPreview() {
  return (
    <div className="hero-preview hero-preview-savings">
      <div className="hero-preview-topline"><CircleDollarSign className="size-3.5" /> Cost control <span>today</span></div>
      <div className="hero-chart" aria-label="Cost savings chart">
        {[32, 48, 38, 60, 53, 76, 68].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
      </div>
      <div className="hero-savings-total"><span>Saved this week</span><strong>$184.20</strong></div>
    </div>
  );
}

const FEATURES = [
  { label: "Routing", title: "The right model, every time.", text: "Match each request to the model that makes sense for it.", Icon: Activity, Preview: RoutingPreview },
  { label: "Quality", title: "Guardrails before answers ship.", text: "Validate important responses and escalate when they need more care.", Icon: ShieldCheck, Preview: QualityPreview },
  { label: "Cache", title: "Reuse the work you have done.", text: "Serve familiar requests instantly with semantic cache matches.", Icon: Zap, Preview: CachePreview },
  { label: "Savings", title: "Spend with context.", text: "See how your routing decisions change cost as traffic grows.", Icon: CircleDollarSign, Preview: SavingsPreview },
];

export function UnizHero() {
  return (
    <section className="hero-brand">
      <div className="hero-brand-glow" aria-hidden="true" />
      <Sparkles className="hero-orbit hero-orbit-one" aria-hidden="true" />
      <Route className="hero-orbit hero-orbit-two" aria-hidden="true" />
      <ShieldCheck className="hero-orbit hero-orbit-three" aria-hidden="true" />
      <Activity className="hero-orbit hero-orbit-four" aria-hidden="true" />

      <div className="hero-brand-copy">
        <p className="hero-brand-eyebrow"><span /> Promptimizer routing layer</p>
        <h1>Build a calmer way to<br /><em>run your model fleet.</em></h1>
        <p className="hero-brand-description">One OpenAI-compatible API for routing, quality checks, semantic cache, and spend control — designed for reliable AI products.</p>
        <div className="hero-brand-actions">
          <Link href="/signup" className="hero-brand-primary">Start routing for free <ArrowRight className="size-4" /></Link>
          <a href={`${DOCS_URL}/docs/sdk`} target="_blank" rel="noopener noreferrer" className="hero-brand-secondary">Explore the docs</a>
        </div>
      </div>

      <div className="hero-feature-grid">
        {FEATURES.map(({ label, title, text, Icon, Preview }) => (
          <article className="hero-feature-card" key={label}>
            <Preview />
            <div className="hero-feature-content">
              <p><Icon className="size-3" /> {label}</p>
              <h2>{title}</h2>
              <span>{text}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
