"use client";

import { useEffect, useRef, useState } from "react";

const colorPalettes = [
  [
    "#1e3a5f",
    "#3b82f6",
    "#06b6d4",
    "#f97316",
    "#ea580c",
    "#ec4899",
    "#db2777",
    "#9333ea",
  ],
  [
    "#0f172a",
    "#1e40af",
    "#0891b2",
    "#14b8a6",
    "#8b5cf6",
    "#a855f7",
    "#c026d3",
    "#e879f9",
  ],
  [
    "#312e81",
    "#4f46e5",
    "#fbbf24",
    "#f97316",
    "#ef4444",
    "#db2777",
    "#9333ea",
    "#c084fc",
  ],
  [
    "#0c4a6e",
    "#0369a1",
    "#0284c7",
    "#0ea5e9",
    "#06b6d4",
    "#22d3ee",
    "#2dd4bf",
    "#5eead4",
  ],
  [
    "#134e4a",
    "#0d9488",
    "#14b8a6",
    "#2dd4bf",
    "#f472b6",
    "#ec4899",
    "#a855f7",
    "#c084fc",
  ],
];

interface WaveLayer {
  baseY: number;
  amplitude: number;
  frequency: number;
  speed: number;
  color: string;
  points: number[];
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);
  const [palette] = useState(
    () => colorPalettes[Math.floor(Math.random() * colorPalettes.length)]
  );
  const wavesRef = useRef<WaveLayer[]>([]);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth + 100;
      canvas.height = window.innerHeight + 100;
      initializeWaves();
    };

    const initializeWaves = () => {
      const waves: WaveLayer[] = [];
      const waveCount = 8;

      for (let i = 0; i < waveCount; i++) {
        const baseY =
          canvas.height * 0.05 + ((canvas.height * 0.85) / waveCount) * i;
        const pointCount = 8;
        const points: number[] = [];

        for (let j = 0; j <= pointCount; j++) {
          points.push(Math.random() * Math.PI * 2);
        }

        waves.push({
          baseY,
          amplitude: 20 + Math.random() * 40,
          frequency: 0.5 + Math.random() * 0.5,
          speed: 0.3 + Math.random() * 0.4,
          color: palette[i % palette.length],
          points,
        });
      }

      wavesRef.current = waves;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("mousemove", handleMouseMove);

    const animate = () => {
      if (!ctx || !canvas || !container) return;

      timeRef.current += 0.016;

      const lerp = 0.1;
      smoothMouseRef.current.x +=
        (mouseRef.current.x - smoothMouseRef.current.x) * lerp;
      smoothMouseRef.current.y +=
        (mouseRef.current.y - smoothMouseRef.current.y) * lerp;

      const translateX = (smoothMouseRef.current.x - 0.5) * 50;
      const translateY = (smoothMouseRef.current.y - 0.5) * 50;
      container.style.transform = `translate(${translateX - 50}px, ${translateY - 50}px)`;

      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, palette[0]);
      bgGradient.addColorStop(1, palette[1]);
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      wavesRef.current.forEach((wave) => {
        ctx.beginPath();

        const segmentWidth = canvas.width / (wave.points.length - 1);

        const yPositions: number[] = [];
        for (let i = 0; i < wave.points.length; i++) {
          const phaseOffset = wave.points[i];
          const waveOffset =
            Math.sin(timeRef.current * wave.speed + phaseOffset) *
            wave.amplitude;
          const y = wave.baseY + waveOffset;
          yPositions.push(y);
        }

        ctx.moveTo(0, canvas.height);
        ctx.lineTo(0, yPositions[0]);

        for (let i = 1; i < wave.points.length; i++) {
          const x = i * segmentWidth;
          const prevX = (i - 1) * segmentWidth;
          const y = yPositions[i];
          const prevY = yPositions[i - 1];

          const cpX1 = prevX + segmentWidth * 0.5;
          const cpX2 = x - segmentWidth * 0.5;

          ctx.bezierCurveTo(cpX1, prevY, cpX2, y, x, y);
        }

        ctx.lineTo(canvas.width, canvas.height);
        ctx.closePath();

        ctx.fillStyle = wave.color;
        ctx.fill();
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [palette]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 -z-10"
      style={{ willChange: "transform" }}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
