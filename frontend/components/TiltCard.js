"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function TiltCard({
  icon,
  title,
  description,
  cta,
  ctaLink = "#",
  image, // new prop
  priority = false,
  children,
}) {
  const cardRef = useRef(null);
  const glowRef = useRef(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    const glow = glowRef.current;
    if (!card || !glow) return;

    const handleMouseMove = (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;
      card.style.transform =
        `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px) scale(1.02)`;

      const glowX = (x / rect.width) * 100;
      const glowY = (y / rect.height) * 100;
      glow.style.background =
        `radial-gradient(circle at ${glowX}% ${glowY}%, rgba(78, 223, 145, 0.25) 0%, transparent 70%)`;
    };

    const handleMouseLeave = () => {
      card.style.transform =
        "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)";
      glow.style.background = "transparent";
    };

    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className="feature-card rounded-[28px] p-lg flex flex-col h-full group relative overflow-hidden"
    >
      <div
        ref={glowRef}
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100"
        style={{ background: "transparent" }}
      />

      {/* ─── Image ───────────────────────────────────────────── */}
      {image && !imageFailed && (
        <div className="mb-lg relative aspect-video rounded-xl overflow-hidden bg-surface-container">
          <Image
            src={image}
            alt={title}
            fill
            priority={priority}
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            onError={() => setImageFailed(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e1510] to-transparent opacity-60"></div>
        </div>
      )}

      {children ? (
        children
      ) : (
        <>
          <div className="flex items-center gap-sm mb-sm text-secondary">
            <span className="material-symbols-outlined text-2xl">{icon}</span>
            <h3 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg">{title}</h3>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mb-lg flex-grow">{description}</p>
          {cta && (
            <Link href={ctaLink} className="inline-flex items-center gap-2 text-secondary font-bold group-hover:gap-3 transition-all">
              {cta}
              <span className="material-symbols-outlined text-sm">east</span>
            </Link>
          )}
        </>
      )}
    </div>
  );
}