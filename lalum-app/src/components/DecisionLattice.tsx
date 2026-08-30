import { useEffect, useRef } from "react";

// The hero backdrop: a sparse graph of nodes and edges, with a signal that
// travels a short path through it every few seconds.
//
// It reads two ways on purpose. As a model tracing a chain of reasoning, and
// as a chain of authorities in a file. That is the practice in one image, and
// it is why this replaced the drifting light blobs, which were pleasant but
// said nothing.
//
// Canvas rather than SVG: the graph is generated from the hero's measured
// width, so the node count follows the viewport instead of being baked into
// path data. Drawing costs one pass over roughly 40 nodes and their edges.
//
// It never runs when it cannot be seen: the loop is bound to an
// IntersectionObserver, and under prefers-reduced-motion it paints a single
// still frame and stops.

type Node = { bx: number; by: number; phase: number; x: number; y: number };
type Edge = { a: number; b: number };
type Signal = { legs: [number, number][]; t: number };

const CLAY = "168,72,42";

export function DecisionLattice() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let signal: Signal | null = null;
    // Narrow screens carry the graph more faintly: the same alpha that reads
    // as a whisper on a desktop sits right behind body text on a phone.
    let density = 1;
    let untilNext = 1200;
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let visible = false;

    function measure() {
      const canvasEl = canvas as HTMLCanvasElement;
      const ctx2d = ctx as CanvasRenderingContext2D;
      const rect = canvasEl.getBoundingClientRect();
      // Cap the pixel ratio: past 2x the extra pixels cost real work and buy
      // nothing on lines this faint.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvasEl.width = Math.max(1, Math.round(w * dpr));
      canvasEl.height = Math.max(1, Math.round(h * dpr));
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function build() {
      nodes = [];
      edges = [];
      // Spacing follows the viewport. A fixed step that reads as a sparse
      // graph on a desktop turns into a mesh behind the text on a phone, so
      // narrow screens get a wider step and fewer, calmer lines.
      const step = w < 560 ? Math.max(104, w / 3.4) : Math.max(78, Math.min(118, w / 11));
      density = w < 560 ? 0.72 : 1;
      for (let y = -step / 2; y < h + step; y += step) {
        for (let x = -step / 2; x < w + step; x += step) {
          const k = nodes.length;
          // Deterministic jitter keyed to the index: the graph looks hand
          // placed but is identical on every load, so it never flickers
          // between renders.
          nodes.push({ bx: x + ((k * 47) % 61) - 30, by: y + ((k * 31) % 47) - 23, phase: (k * 1.7) % 6.283, x: 0, y: 0 });
        }
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].bx - nodes[j].bx, nodes[i].by - nodes[j].by);
          if (d < step * 1.24) edges.push({ a: i, b: j });
        }
      }
    }

    function walk(): Signal | null {
      // A short walk that never revisits a node, so the lit path reads as a
      // chain rather than a scribble.
      let at = Math.floor(Math.random() * nodes.length);
      const legs: [number, number][] = [];
      const seen = new Set([at]);
      for (let s = 0; s < 4; s++) {
        const out = edges.filter((e) => (e.a === at || e.b === at) && !seen.has(e.a === at ? e.b : e.a));
        if (!out.length) break;
        const e = out[Math.floor(Math.random() * out.length)];
        const to = e.a === at ? e.b : e.a;
        legs.push([at, to]);
        seen.add(to);
        at = to;
      }
      return legs.length ? { legs, t: 0 } : null;
    }

    function draw(dt: number, now: number) {
      const c = ctx as CanvasRenderingContext2D;
      c.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x = n.bx + Math.sin(now / 4200 + n.phase) * 9;
        n.y = n.by + Math.cos(now / 5300 + n.phase) * 7;
      }

      c.lineWidth = 1;
      c.strokeStyle = `rgba(${CLAY},${0.17 * density})`;
      c.beginPath();
      for (const e of edges) {
        c.moveTo(nodes[e.a].x, nodes[e.a].y);
        c.lineTo(nodes[e.b].x, nodes[e.b].y);
      }
      c.stroke();

      c.fillStyle = `rgba(${CLAY},${0.38 * density})`;
      for (const n of nodes) {
        c.beginPath();
        c.arc(n.x, n.y, 1.9, 0, 6.283);
        c.fill();
      }

      if (still) return;

      untilNext -= dt;
      if (!signal && untilNext <= 0) {
        signal = walk();
        untilNext = 2600 + Math.random() * 2200;
      }
      if (!signal) return;

      signal.t += dt / 620;
      c.lineWidth = 1.6;
      for (let i = 0; i < signal.legs.length; i++) {
        const [a, b] = signal.legs[i];
        const local = Math.max(0, Math.min(1, signal.t - i));
        if (!local) continue;
        const A = nodes[a];
        const B = nodes[b];
        // The leg fades once the signal has passed it, so the trail dissolves
        // behind the head instead of leaving the graph permanently lit.
        const fade = 0.55 * density * (1 - Math.max(0, signal.t - i - 1) * 0.6);
        c.strokeStyle = `rgba(${CLAY},${fade})`;
        c.beginPath();
        c.moveTo(A.x, A.y);
        c.lineTo(A.x + (B.x - A.x) * local, A.y + (B.y - A.y) * local);
        c.stroke();
        c.fillStyle = `rgba(${CLAY},${0.85 * density})`;
        c.beginPath();
        c.arc(A.x + (B.x - A.x) * local, A.y + (B.y - A.y) * local, 3.1, 0, 6.283);
        c.fill();
      }
      if (signal.t >= signal.legs.length) signal = null;
    }

    function frame(now: number) {
      raf = 0;
      const dt = last ? Math.min(now - last, 60) : 16;
      last = now;
      draw(dt, now);
      if (visible && !still) raf = requestAnimationFrame(frame);
    }

    function kick() {
      if (!raf) raf = requestAnimationFrame(frame);
    }

    measure();
    const io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) kick();
    });
    io.observe(canvas);
    const ro = new ResizeObserver(() => {
      measure();
      kick();
    });
    ro.observe(canvas);

    return () => {
      io.disconnect();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} className="ambient-canvas" aria-hidden="true" />;
}
