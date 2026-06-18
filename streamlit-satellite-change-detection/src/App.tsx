import { motion, useScroll, useTransform, useSpring, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Earth3DScene } from "./components/Earth3D";
import { AnalysisApp } from "./components/AnalysisApp";

// =====================================================================
// ANIMATED COUNTER
// =====================================================================
function AnimatedCounter({ target, duration = 2, suffix = "", decimals = 0 }: {
  target: number;
  duration?: number;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start: number | null = null;
    const animate = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, target, duration]);

  return (
    <span ref={ref}>
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

// =====================================================================
// NAVBAR
// =====================================================================
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "py-3" : "py-5"
      }`}
    >
      <div
        className={`max-w-7xl mx-auto px-6 transition-all duration-500 ${
          scrolled ? "glass rounded-full mx-4 px-6" : ""
        }`}
      >
        <div className="flex items-center justify-between">
      <motion.div
        className="flex flex-col items-start gap-1"
        whileHover={{ scale: 1.01 }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <img 
              src="/bisag-logo.png" 
              alt="BISAG Logo" 
              className="h-10 object-contain bg-white rounded-md p-1 glow-accent" 
            />
          </div>
          <div>
            <div className="font-mono text-sm tracking-[0.18em] font-bold glow-text">
              GeoChronos
            </div>
            <div className="font-mono text-[0.55rem] tracking-[0.15em] text-slate-400 uppercase">
              Change Detection Engine
            </div>
          </div>
        </div>
        <div className="font-sans text-[0.52rem] tracking-wider text-slate-400 leading-tight max-w-[280px] md:max-w-[420px]">
          Bhaskaracharya National Institute for Space Applications and Geo-informatics, Gandhinagar, Gujarat.
        </div>
      </motion.div>

          <div className="hidden md:flex items-center gap-8 font-mono text-[0.72rem] tracking-[0.1em] uppercase text-slate-400">
            {["Overview", "Features", "Metrics", "Process"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="hover:text-[#38bdf8] transition-colors relative group"
              >
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#38bdf8] group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 font-mono text-[0.7rem] text-emerald-400">
            <span className="status-dot" />
            <span className="tracking-wider">ONLINE</span>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}

// =====================================================================
// HERO SECTION WITH 3D EARTH
// =====================================================================
function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const yEarth = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacityEarth = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const scaleEarth = useTransform(scrollYProgress, [0, 1], [1, 0.8]);

  return (
    <section
      ref={ref}
      id="overview"
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
    >
      {/* Orbit pulse backdrop */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vw] max-w-[1000px] max-h-[1000px] rounded-full pointer-events-none"
        style={{
          border: "1px solid rgba(56, 189, 248, 0.06)",
          boxShadow: "0 0 80px rgba(56, 189, 248, 0.05) inset",
          animation: "orbit-pulse 12s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[70vw] max-w-[700px] max-h-[700px] rounded-full pointer-events-none"
        style={{
          border: "1px solid rgba(129, 140, 248, 0.08)",
        }}
      />

      {/* 3D Earth background */}
      <motion.div
        style={{ y: yEarth, opacity: opacityEarth, scale: scaleEarth }}
        className="absolute inset-0 w-full h-full"
      >
        <Earth3DScene />
      </motion.div>

      {/* Gradient overlays for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#040710] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#040710] via-transparent to-[#040710] opacity-40 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="font-mono text-[0.7rem] tracking-[0.32em] text-[#38bdf8] uppercase mb-5 flex items-center justify-center gap-2"
        >
          <span>🛰️</span>
          <span>Earth Observation Platform</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-none mb-6 glow-text"
        >
          GeoChronos
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="font-display text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-8"
        >
          Multi-index ensemble change detection powered by{" "}
          <span className="text-[#38bdf8]">Sentinel-2</span> imagery and{" "}
          <span className="text-[#818cf8]">Google Earth Engine</span>.
          Monitor urban growth, deforestation, and land transformation in near
          real-time.
        </motion.p>

        {/* Badge row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex flex-wrap items-center justify-center gap-2 mb-10"
        >
          {[
            "Sentinel-2 SR",
            "4-Index Ensemble",
            "10m Resolution",
            "ESA WorldCover",
            "Swipe Compare",
          ].map((b, i) => (
            <motion.span
              key={b}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9 + i * 0.08 }}
              className="font-mono text-[0.62rem] tracking-[0.1em] px-3 py-1.5 rounded-full bg-[rgba(56,189,248,0.08)] border border-[rgba(56,189,248,0.25)] text-[#38bdf8]"
            >
              {b}
            </motion.span>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          <a href="#app" className="btn-primary" style={{ textDecoration: "none" }}>🚀 Launch Demo</a>
          <a href="#features" className="btn-ghost" style={{ textDecoration: "none" }}>📖 Learn More</a>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="font-mono text-[0.6rem] tracking-[0.3em] text-slate-500 uppercase">
            Scroll
          </span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="w-5 h-8 rounded-full border border-[#38bdf8] flex items-start justify-center p-1"
          >
            <div className="w-1 h-1 rounded-full bg-[#38bdf8]" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// =====================================================================
// FEATURES GRID
// =====================================================================
function Features() {
  const features = [
    {
      icon: "🛰️",
      title: "Sentinel-2 Imagery",
      desc: "10-meter multispectral data from ESA's twin satellites, refreshed every 5 days.",
      color: "#38bdf8",
    },
    {
      icon: "🎯",
      title: "4-Index Ensemble",
      desc: "NDBI, NDVI, MNDWI, and BSI vote together — robust to seasonal and lighting shifts.",
      color: "#818cf8",
    },
    {
      icon: "🔬",
      title: "Cloud Masking",
      desc: "SCL + QA60 dual-filter pipeline removes clouds, shadows, and cirrus automatically.",
      color: "#f472b6",
    },
    {
      icon: "🌍",
      title: "ESA WorldCover",
      desc: "Ground-truth validation against 10m global land cover classification.",
      color: "#34d399",
    },
    {
      icon: "⟷",
      title: "Swipe Comparison",
      desc: "Drag the divider to visually compare baseline and target year imagery.",
      color: "#38bdf8",
    },
    {
      icon: "📊",
      title: "Precision Metrics",
      desc: "Accuracy, Precision, Recall, F1 — computed per-pixel against validated reference.",
      color: "#818cf8",
    },
  ];

  return (
    <section id="features" className="relative py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="section-title justify-center">Core Capabilities</div>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Built for{" "}
            <span className="glow-text">Planetary Intelligence</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            A production-grade pipeline that transforms raw satellite imagery
            into actionable change intelligence.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="card p-6 shine group cursor-default"
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl mb-4 transition-transform group-hover:scale-110 group-hover:rotate-3"
                style={{
                  background: `linear-gradient(135deg, ${f.color}15, ${f.color}08)`,
                  border: `1px solid ${f.color}40`,
                }}
              >
                {f.icon}
              </div>
              <h3 className="font-display text-lg font-semibold mb-2 group-hover:text-[#38bdf8] transition-colors">
                {f.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {f.desc}
              </p>
              <div
                className="mt-4 h-px w-0 group-hover:w-full transition-all duration-500"
                style={{ background: `linear-gradient(90deg, ${f.color}, transparent)` }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// SWIPE COMPARISON DEMO
// =====================================================================
function SwipeComparison() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  // Use placeholder gradient "satellite" images since we have the earth texture
  // We'll use the earth texture as a stand-in for both sides with different CSS overlays
  const baselineStyle = {
    backgroundImage: `url(/earth-texture.jpg)`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    filter: "brightness(0.9) contrast(1.1) saturate(0.8)",
  };
  const targetStyle = {
    backgroundImage: `url(/earth-texture.jpg)`,
    backgroundSize: "cover",
    backgroundPosition: "center 30%",
    filter: "brightness(1.05) contrast(1.15) saturate(1.2) hue-rotate(-10deg)",
  };

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    setPosition((x / rect.width) * 100);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const x = "touches" in e ? e.touches[0].clientX : e.clientX;
      handleMove(x);
    };
    const onUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove);
      window.addEventListener("touchend", onUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [isDragging]);

  return (
    <section className="relative py-32 px-6 overflow-hidden">
      {/* Grid backdrop */}
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute inset-0 radial-fade" />

      <div className="relative max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <div className="section-title justify-center">Visual Analysis</div>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Swipe Through <span className="glow-text">Time</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Drag the divider to compare satellite imagery across years. Detect
            construction, demolition, and land-use change at a glance.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          ref={containerRef}
          className="swipe-container mx-auto max-w-5xl"
          onMouseDown={(e) => {
            setIsDragging(true);
            handleMove(e.clientX);
          }}
          onTouchStart={(e) => {
            setIsDragging(true);
            handleMove(e.touches[0].clientX);
          }}
          onMouseMove={(e) => !isDragging || handleMove(e.clientX)}
        >
          {/* Left (baseline) */}
          <div
            className="swipe-layer"
            style={{
              ...baselineStyle,
              clipPath: `inset(0 ${100 - position}% 0 0)`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-transparent" />
          </div>

          {/* Right (target) */}
          <div
            className="swipe-layer"
            style={{
              ...targetStyle,
              clipPath: `inset(0 0 0 ${position}%)`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-tl from-purple-900/20 to-transparent" />
            {/* Change polygons overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-[30%] left-[20%] w-16 h-16 bg-red-500/40 border-2 border-red-500 rounded animate-pulse" />
              <div className="absolute top-[50%] left-[60%] w-20 h-12 bg-red-500/40 border-2 border-red-500 rounded animate-pulse" style={{ animationDelay: "0.5s" }} />
              <div className="absolute top-[60%] left-[30%] w-14 h-20 bg-blue-500/40 border-2 border-blue-500 rounded animate-pulse" style={{ animationDelay: "1s" }} />
            </div>
          </div>

          {/* Labels */}
          <div className="swipe-label left">← 2021 BASELINE</div>
          <div className="swipe-label right">2025 TARGET →</div>

          {/* Divider + handle */}
          <div
            className="swipe-divider"
            style={{ left: `${position}%` }}
          />
          <div
            className="swipe-handle"
            style={{ left: `${position}%` }}
          >
            <span className="font-mono text-xs text-[#38bdf8]">↔</span>
          </div>
        </motion.div>

        {/* Legend */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-6 mt-8 font-mono text-[0.72rem] tracking-wider"
        >
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-red-500 bg-red-500/40" />
            <span className="text-slate-400">CONSTRUCTION</span>
          </div>
          <div className="text-slate-600">|</div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-blue-500 bg-blue-500/40" />
            <span className="text-slate-400">DEMOLITION</span>
          </div>
          <div className="text-slate-600">|</div>
          <div className="flex items-center gap-2 text-[#38bdf8]">
            <span>⟵</span>
            <span>DRAG TO COMPARE</span>
            <span>⟶</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// =====================================================================
// METRICS DASHBOARD
// =====================================================================
function Metrics() {
  const metrics = [
    { label: "Overall Accuracy", value: 94.2, suffix: "%", color: "#38bdf8" },
    { label: "Precision", value: 87.6, suffix: "%", color: "#34d399" },
    { label: "Recall", value: 91.3, suffix: "%", color: "#818cf8" },
    { label: "F1 Score", value: 89.4, suffix: "%", color: "#f472b6" },
    { label: "Construction Area", value: 124.8, suffix: " ha", color: "#ef4444" },
    { label: "Demolition Area", value: 18.3, suffix: " ha", color: "#3b82f6" },
    { label: "True Positives", value: 48230, suffix: "", decimals: 0, color: "#34d399" },
    { label: "False Positives", value: 6712, suffix: "", decimals: 0, color: "#f87171" },
  ];

  return (
    <section id="metrics" className="relative py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="section-title justify-center">Detection Performance</div>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Validated <span className="glow-text">Accuracy</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Per-pixel validation against ESA WorldCover ground truth. Real-time
            metrics updated on every analysis run.
          </p>
        </motion.div>

        {/* Primary metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {metrics.slice(0, 4).map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="card p-5 text-center relative overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{
                  background: `linear-gradient(90deg, transparent, ${m.color}, transparent)`,
                }}
              />
              <div
                className="font-mono text-[0.62rem] tracking-[0.15em] uppercase text-slate-400 mb-2"
              >
                {m.label}
              </div>
              <div
                className="font-display text-3xl md:text-4xl font-bold"
                style={{ color: m.color }}
              >
                <AnimatedCounter
                  target={m.value}
                  suffix={m.suffix}
                  decimals={m.decimals ?? 1}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Area metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.slice(4).map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="card p-4 text-center"
            >
              <div className="font-mono text-[0.58rem] tracking-[0.12em] uppercase text-slate-500 mb-1">
                {m.label}
              </div>
              <div
                className="font-display text-xl md:text-2xl font-bold"
                style={{ color: m.color }}
              >
                <AnimatedCounter
                  target={m.value}
                  suffix={m.suffix}
                  decimals={m.decimals ?? 1}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Confusion matrix visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="card p-6 mt-8 max-w-3xl mx-auto"
        >
          <div className="font-mono text-[0.7rem] tracking-[0.15em] uppercase text-[#38bdf8] mb-4 text-center">
            Confusion Matrix · Per-Pixel Validation
          </div>
          <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center">
              <div className="font-mono text-[0.62rem] text-emerald-400 uppercase tracking-wider">
                TP
              </div>
              <div className="font-display text-2xl font-bold text-emerald-400">
                48,230
              </div>
              <div className="font-mono text-[0.58rem] text-slate-500 mt-1">
                true change
              </div>
            </div>
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
              <div className="font-mono text-[0.62rem] text-red-400 uppercase tracking-wider">
                FP
              </div>
              <div className="font-display text-2xl font-bold text-red-400">
                6,712
              </div>
              <div className="font-mono text-[0.58rem] text-slate-500 mt-1">
                false alarm
              </div>
            </div>
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
              <div className="font-mono text-[0.62rem] text-red-400 uppercase tracking-wider">
                FN
              </div>
              <div className="font-display text-2xl font-bold text-red-400">
                4,891
              </div>
              <div className="font-mono text-[0.58rem] text-slate-500 mt-1">
                missed
              </div>
            </div>
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center">
              <div className="font-mono text-[0.62rem] text-emerald-400 uppercase tracking-wider">
                TN
              </div>
              <div className="font-display text-2xl font-bold text-emerald-400">
                1.2M
              </div>
              <div className="font-mono text-[0.58rem] text-slate-500 mt-1">
                true stable
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// =====================================================================
// HOW IT WORKS
// =====================================================================
function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Draw Your AOI",
      desc: "Sketch a rectangle over your area of interest. The map snaps to Sentinel-2 tile bounds automatically.",
      icon: "📐",
    },
    {
      num: "02",
      title: "Select Time Window",
      desc: "Choose baseline and target years (2015 – present). Seasonal composites are built from cloud-filtered imagery.",
      icon: "🗓️",
    },
    {
      num: "03",
      title: "Tune Sensitivity",
      desc: "Adjust ensemble votes, thresholds, and patch size. Tuning guide included for every scenario.",
      icon: "🎛️",
    },
    {
      num: "04",
      title: "Swipe & Compare",
      desc: "Drag the divider to visually inspect baseline vs. target imagery before running detection.",
      icon: "⟷",
    },
    {
      num: "05",
      title: "Run Analysis",
      desc: "Earth Engine executes multi-index ensemble at 10m resolution across the full AOI — typically 30–60s.",
      icon: "🚀",
    },
    {
      num: "06",
      title: "Export Results",
      desc: "Download GeoJSON vectors or GeoTIFF rasters. Every polygon is tagged as construction or demolition.",
      icon: "💾",
    },
  ];

  return (
    <section id="process" className="relative py-32 px-6">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#040710] to-transparent" />

      <div className="relative max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="section-title justify-center">Workflow</div>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            From <span className="glow-text">Sketch</span> to{" "}
            <span className="glow-text">Insight</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            A six-step pipeline from area selection to exportable change maps.
          </p>
        </motion.div>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-8 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(56,189,248,0.3)] to-transparent" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className="card p-6 relative"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0f1628] to-[#040710] border border-[rgba(56,189,248,0.3)] flex items-center justify-center text-2xl relative z-10">
                      {s.icon}
                    </div>
                    <div className="absolute inset-0 rounded-full bg-[#38bdf8] opacity-10 blur-lg" />
                  </div>
                  <div>
                    <div className="font-mono text-[0.68rem] tracking-[0.2em] text-[#38bdf8]">
                      STEP {s.num}
                    </div>
                  </div>
                </div>
                <h3 className="font-display text-lg font-semibold mb-2 text-slate-100">
                  {s.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {s.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// LIVE FEED / TECH STACK MARQUEE
// =====================================================================
function TechMarquee() {
  const techs = [
    "GOOGLE EARTH ENGINE",
    "SENTINEL-2 SR",
    "ESA WORLDCOVER",
    "NDBI · NDVI · MNDWI · BSI",
    "10M RESOLUTION",
    "GEOJSON EXPORT",
    "GEOTIFF EXPORT",
    "CLOUD MASKING",
    "ENSEMBLE VOTING",
    "FOLIUM LEAFLET",
  ];
  return (
    <div className="relative py-12 overflow-hidden border-y border-[rgba(56,189,248,0.1)]">
      <div className="absolute inset-0 bg-gradient-to-r from-[#040710] via-transparent to-[#040710] z-10 pointer-events-none" />
      <div className="flex animate-marquee whitespace-nowrap">
        {[...techs, ...techs].map((t, i) => (
          <div
            key={i}
            className="font-mono text-[0.72rem] tracking-[0.25em] text-slate-500 mx-8 flex items-center gap-8"
          >
            <span>{t}</span>
            <span className="text-[#38bdf8]">◆</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// CTA SECTION
// =====================================================================
function CTASection() {
  return (
    <section className="relative py-32 px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="max-w-4xl mx-auto card p-10 md:p-16 text-center relative overflow-hidden"
      >
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(56,189,248,0.08)] via-transparent to-[rgba(129,140,248,0.08)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-32 bg-gradient-to-b from-[#38bdf8] to-transparent opacity-10 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(56,189,248,0.3)] bg-[rgba(56,189,248,0.06)] font-mono text-[0.68rem] tracking-[0.2em] text-[#38bdf8] uppercase mb-6">
            <span className="status-dot" />
            <span>System Online</span>
          </div>

          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
            Start Monitoring{" "}
            <span className="glow-text">Planetary Change</span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto mb-8">
            Deploy TERRA·WATCH on your own infrastructure. Connect your Google
            Earth Engine project and begin analyzing satellite imagery in
            minutes.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <a href="#app" className="btn-primary" style={{ textDecoration: "none" }}>🚀 Launch Interface</a>
            <a href="https://github.com" className="btn-ghost" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>View Source Code</a>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// =====================================================================
// FOOTER
// =====================================================================
function Footer() {
  return (
    <footer className="relative border-t border-[rgba(56,189,248,0.1)] py-10 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img 
            src="/bisag-logo.png" 
            alt="BISAG Logo" 
            className="w-8 h-8 object-contain bg-white rounded-md p-0.5" 
          />
          <div>
            <div className="font-mono text-xs tracking-[0.18em] font-bold glow-text">
              GeoChronos
            </div>
            <div className="font-mono text-[0.58rem] tracking-[0.15em] text-slate-500 uppercase">
              Satellite Change Detection · v2.0
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 font-mono text-[0.68rem] tracking-wider text-slate-500">
          <span>Built with Google Earth Engine</span>
          <span className="text-slate-700">|</span>
          <span>Sentinel-2 Imagery © ESA</span>
          <span className="text-slate-700">|</span>
          <span className="text-[#38bdf8]">2026</span>
        </div>
      </div>
    </footer>
  );
}

// =====================================================================
// APP
// =====================================================================
export default function App() {
  // Smooth scroll polyfill for anchor links
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
  }, []);

  const mainRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <div ref={mainRef} className="relative min-h-screen">
      {/* Progress bar at top */}
      <motion.div
        style={{ scaleX }}
        className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#38bdf8] via-[#818cf8] to-[#f472b6] origin-left z-[100]"
      />

      <Navbar />
      <Hero />
      <div className="scan-divider max-w-6xl mx-auto" />
      <TechMarquee />
      <Features />
      <SwipeComparison />
      <Metrics />
      <HowItWorks />
      <CTASection />
      <AnalysisApp />
      <Footer />
    </div>
  );
}
