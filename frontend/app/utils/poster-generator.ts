/**
 * High-DPI HTML5 Canvas Announcement Poster Generator Engine
 * Renders professional, publication-ready Reviewer Bucket announcement posters.
 */

export type PosterAspectRatio = "1:1" | "16:9" | "4:5";
export type PosterTextPosition = "top" | "center" | "bottom";
export type PosterTextAlign = "left" | "center" | "right";
export type PosterOverlayStyle = "gradient-bottom" | "gradient-top" | "vignette" | "card" | "full";

export interface PresetBackground {
  id: string;
  name: string;
  description: string;
  gradientColors: [string, string, string?];
  angle?: number;
}

export const PRESET_BACKGROUNDS: PresetBackground[] = [
  {
    id: "reviewer-dark",
    name: "Reviewer Bucket Dark",
    description: "Official sleek dark background with subtle amber glow",
    gradientColors: ["#0f172a", "#020617", "#1e1b4b"],
    angle: 135
  },
  {
    id: "indigo-aurora",
    name: "Indigo Aurora",
    description: "Deep indigo & cosmic violet gradient",
    gradientColors: ["#1e1b4b", "#311042", "#0f172a"],
    angle: 120
  },
  {
    id: "slate-minimal",
    name: "Slate Minimal",
    description: "Clean monochrome charcoal & slate",
    gradientColors: ["#18181b", "#09090b", "#27272a"],
    angle: 160
  },
  {
    id: "emerald-horizon",
    name: "Emerald Horizon",
    description: "Deep forest emerald with obsidian tones",
    gradientColors: ["#064e3b", "#022c22", "#0f172a"],
    angle: 145
  },
  {
    id: "ember-sunset",
    name: "Ember Sunset",
    description: "Rich amber and deep crimson twilight",
    gradientColors: ["#451a03", "#7c2d12", "#0f172a"],
    angle: 135
  }
];

export interface PosterRenderOptions {
  title: string;
  message: string;
  cta?: string;
  categoryLabel?: string;
  priorityLabel?: string;
  priorityColor?: string; // e.g., "#0284c7" (sky), "#f59e0b" (amber), "#e11d48" (rose), "#71717a" (neutral)
  aspectRatio: PosterAspectRatio;
  textPosition: PosterTextPosition;
  textAlign: PosterTextAlign;
  overlayStyle?: PosterOverlayStyle;
  overlayOpacity: number; // 0.0 to 1.0 (e.g. 0.65)
  customImageElement?: HTMLImageElement | null;
  presetBackgroundId?: string;
  dateString?: string;
}

/**
 * Returns pixel dimensions based on aspect ratio for high-DPI 2x export.
 */
export function getPosterDimensions(aspectRatio: PosterAspectRatio): { width: number; height: number } {
  switch (aspectRatio) {
    case "16:9":
      return { width: 1280, height: 720 };
    case "4:5":
      return { width: 1080, height: 1350 };
    case "1:1":
    default:
      return { width: 1200, height: 1200 };
  }
}

/**
 * Helper to split text into wrapped lines given a max canvas width.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [];
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    const words = para.split(" ");
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + " " + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Draw a rounded rectangle helper for HTML5 Canvas.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Renders the entire announcement poster to the provided HTML5 Canvas.
 */
export async function renderPosterToCanvas(
  canvas: HTMLCanvasElement,
  options: PosterRenderOptions
): Promise<void> {
  const { width, height } = getPosterDimensions(options.aspectRatio);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  // 1. Draw Background
  if (options.customImageElement && options.customImageElement.complete && options.customImageElement.naturalWidth > 0) {
    const img = options.customImageElement;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const targetRatio = width / height;

    let renderW = width;
    let renderH = height;
    let offsetX = 0;
    let offsetY = 0;

    if (imgRatio > targetRatio) {
      renderH = height;
      renderW = height * imgRatio;
      offsetX = (width - renderW) / 2;
    } else {
      renderW = width;
      renderH = width / imgRatio;
      offsetY = (height - renderH) / 2;
    }

    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
  } else {
    // Preset gradient background
    const preset = PRESET_BACKGROUNDS.find((p) => p.id === options.presetBackgroundId) || PRESET_BACKGROUNDS[0];
    const angleRad = ((preset.angle || 135) * Math.PI) / 180;
    const x1 = width / 2 - (Math.cos(angleRad) * width) / 2;
    const y1 = height / 2 - (Math.sin(angleRad) * height) / 2;
    const x2 = width / 2 + (Math.cos(angleRad) * width) / 2;
    const y2 = height / 2 + (Math.sin(angleRad) * height) / 2;

    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, preset.gradientColors[0]);
    grad.addColorStop(0.5, preset.gradientColors[1]);
    if (preset.gradientColors[2]) {
      grad.addColorStop(1, preset.gradientColors[2]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle ambient decorative circle mesh
    ctx.save();
    ctx.globalAlpha = 0.12;
    const ambientGrad = ctx.createRadialGradient(width * 0.8, height * 0.2, 50, width * 0.8, height * 0.2, width * 0.6);
    ambientGrad.addColorStop(0, "#ffffff");
    ambientGrad.addColorStop(1, "transparent");
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // 2. Draw Contrast Overlay
  const opacity = Math.max(0.1, Math.min(1.0, options.overlayOpacity ?? 0.65));
  ctx.save();

  if (options.overlayStyle === "card") {
    // Semi-transparent dark wash over entire canvas
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity * 0.4})`;
    ctx.fillRect(0, 0, width, height);
  } else if (options.textPosition === "top") {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, `rgba(10, 10, 12, ${opacity})`);
    grad.addColorStop(0.55, `rgba(10, 10, 12, ${opacity * 0.75})`);
    grad.addColorStop(1, `rgba(10, 10, 12, ${opacity * 0.25})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else if (options.textPosition === "bottom") {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, `rgba(10, 10, 12, ${opacity * 0.2})`);
    grad.addColorStop(0.45, `rgba(10, 10, 12, ${opacity * 0.7})`);
    grad.addColorStop(1, `rgba(10, 10, 12, ${opacity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else {
    // Center position: full vignette + center gradient
    const grad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.75);
    grad.addColorStop(0, `rgba(5, 5, 8, ${opacity * 0.85})`);
    grad.addColorStop(0.7, `rgba(5, 5, 8, ${opacity * 0.7})`);
    grad.addColorStop(1, `rgba(5, 5, 8, ${opacity * 0.95})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();

  // 3. Layout Dimensions & Margins
  const paddingX = Math.round(width * 0.08); // 8% horizontal padding
  const contentWidth = width - paddingX * 2;

  const titleText = options.title.trim();
  const messageText = options.message.trim();
  const ctaText = (options.cta || "").trim();
  const categoryLabel = options.categoryLabel || "COMMUNITY";
  const priorityLabel = options.priorityLabel || "NORMAL";
  const priorityColor = options.priorityColor || "#f59e0b";

  // Typography Scaling based on resolution
  const scale = width / 1200;
  const badgeFontSize = Math.round(20 * scale);
  const titleFontSize = titleText.length > 50 ? Math.round(44 * scale) : Math.round(54 * scale);
  const titleLineHeight = Math.round(titleFontSize * 1.25);
  const bodyFontSize = Math.round(26 * scale);
  const bodyLineHeight = Math.round(bodyFontSize * 1.45);
  const ctaFontSize = Math.round(22 * scale);
  const footerFontSize = Math.round(18 * scale);

  // Setup canvas fonts for measuring
  ctx.font = `800 ${titleFontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const titleLines = wrapText(ctx, titleText, contentWidth);

  ctx.font = `400 ${bodyFontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const bodyLines = wrapText(ctx, messageText, contentWidth);

  // Calculate Total Content Height for vertical positioning
  const brandHeaderHeight = Math.round(60 * scale);
  const badgeGap = Math.round(28 * scale);
  const titleHeight = titleLines.length * titleLineHeight;
  const titleGap = Math.round(24 * scale);
  const bodyHeight = bodyLines.length * bodyLineHeight;
  const ctaHeight = ctaText ? Math.round(54 * scale) : 0;
  const ctaGap = ctaText ? Math.round(36 * scale) : 0;
  const footerHeight = Math.round(40 * scale);

  const totalContentHeight =
    brandHeaderHeight +
    badgeGap +
    titleHeight +
    titleGap +
    bodyHeight +
    ctaGap +
    ctaHeight +
    footerHeight +
    Math.round(40 * scale);

  // Vertical Origin based on textPosition
  let startY: number;
  if (options.overlayStyle === "card") {
    // Draw frosted card container in center
    const cardPadding = Math.round(48 * scale);
    const cardWidth = width - paddingX * 1.2;
    const cardHeight = Math.min(height - paddingX * 1.2, totalContentHeight + cardPadding * 1.5);
    const cardX = (width - cardWidth) / 2;
    const cardY = (height - cardHeight) / 2;

    ctx.save();
    ctx.fillStyle = `rgba(15, 23, 42, ${Math.min(0.92, opacity + 0.15)})`;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = Math.round(2 * scale);
    roundRect(ctx, cardX, cardY, cardWidth, cardHeight, Math.round(28 * scale));
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    startY = cardY + cardPadding;
  } else if (options.textPosition === "top") {
    startY = Math.round(height * 0.08);
  } else if (options.textPosition === "bottom") {
    startY = height - totalContentHeight - Math.round(height * 0.08);
  } else {
    // Center
    startY = Math.max(Math.round(height * 0.08), (height - totalContentHeight) / 2);
  }

  let currentY = startY;

  // 4. Draw Brand Header (Logo Icon + "REVIEWER BUCKET" + "OFFICIAL ANNOUNCEMENT")
  ctx.save();
  const align = options.textAlign;
  let headerX = paddingX;
  if (align === "center") {
    headerX = width / 2;
    ctx.textAlign = "center";
  } else if (align === "right") {
    headerX = width - paddingX;
    ctx.textAlign = "right";
  } else {
    ctx.textAlign = "left";
  }

  // Header Badge Pill
  ctx.font = `700 ${badgeFontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const badgeText = `${categoryLabel.toUpperCase()}  •  ${priorityLabel.toUpperCase()}`;
  const badgeWidth = ctx.measureText(badgeText).width + Math.round(36 * scale);
  const badgeH = Math.round(34 * scale);

  let badgeX = paddingX;
  if (align === "center") {
    badgeX = (width - badgeWidth) / 2;
  } else if (align === "right") {
    badgeX = width - paddingX - badgeWidth;
  }

  // Badge background
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = Math.round(1.5 * scale);
  roundRect(ctx, badgeX, currentY, badgeWidth, badgeH, badgeH / 2);
  ctx.fill();
  ctx.stroke();

  // Priority colored dot
  const dotRadius = Math.round(4.5 * scale);
  const dotX = badgeX + Math.round(18 * scale);
  const dotY = currentY + badgeH / 2;
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = priorityColor;
  ctx.fill();

  // Badge label text
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, dotX + Math.round(12 * scale), dotY);
  ctx.restore();

  currentY += badgeH + Math.round(32 * scale);

  // 5. Draw Title
  if (titleLines.length > 0) {
    ctx.save();
    ctx.font = `800 ${titleFontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";

    // Text Shadow for contrast
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = Math.round(12 * scale);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.round(3 * scale);

    let titleX = paddingX;
    if (align === "center") {
      titleX = width / 2;
      ctx.textAlign = "center";
    } else if (align === "right") {
      titleX = width - paddingX;
      ctx.textAlign = "right";
    } else {
      ctx.textAlign = "left";
    }

    for (const line of titleLines) {
      ctx.fillText(line, titleX, currentY);
      currentY += titleLineHeight;
    }
    ctx.restore();
    currentY += Math.round(18 * scale);
  }

  // 6. Accent Line
  ctx.save();
  const lineWidth = Math.min(contentWidth, Math.round(80 * scale));
  let lineX = paddingX;
  if (align === "center") {
    lineX = (width - lineWidth) / 2;
  } else if (align === "right") {
    lineX = width - paddingX - lineWidth;
  }

  ctx.fillStyle = priorityColor;
  roundRect(ctx, lineX, currentY, lineWidth, Math.round(4 * scale), Math.round(2 * scale));
  ctx.fill();
  ctx.restore();

  currentY += Math.round(24 * scale);

  // 7. Draw Message Body
  if (bodyLines.length > 0) {
    ctx.save();
    ctx.font = `400 ${bodyFontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.textBaseline = "top";

    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = Math.round(8 * scale);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.round(2 * scale);

    let bodyX = paddingX;
    if (align === "center") {
      bodyX = width / 2;
      ctx.textAlign = "center";
    } else if (align === "right") {
      bodyX = width - paddingX;
      ctx.textAlign = "right";
    } else {
      ctx.textAlign = "left";
    }

    for (const line of bodyLines) {
      ctx.fillText(line, bodyX, currentY);
      currentY += bodyLineHeight;
    }
    ctx.restore();
  }

  // 8. Draw Call To Action Button (if provided)
  if (ctaText) {
    currentY += Math.round(28 * scale);
    ctx.save();
    ctx.font = `700 ${ctaFontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    const ctaLabel = `${ctaText}  →`;
    const ctaBtnWidth = ctx.measureText(ctaLabel).width + Math.round(48 * scale);
    const ctaBtnHeight = Math.round(52 * scale);

    let ctaX = paddingX;
    if (align === "center") {
      ctaX = (width - ctaBtnWidth) / 2;
    } else if (align === "right") {
      ctaX = width - paddingX - ctaBtnWidth;
    }

    // CTA Pill Fill
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, ctaX, currentY, ctaBtnWidth, ctaBtnHeight, ctaBtnHeight / 2);
    ctx.fill();

    // CTA Text
    ctx.fillStyle = "#09090b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ctaLabel, ctaX + ctaBtnWidth / 2, currentY + ctaBtnHeight / 2);

    ctx.restore();
    currentY += ctaBtnHeight;
  }

  // 9. Draw Footer (Official Brand Watermark + Date)
  const footerY = height - Math.round(height * 0.05);
  ctx.save();
  ctx.font = `600 ${footerFontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.textBaseline = "middle";

  // Left side brand note
  ctx.textAlign = "left";
  ctx.fillText("REVIEWER BUCKET  •  OFFICIAL ANNOUNCEMENT", paddingX, footerY);

  // Right side date note
  const dateDisplay = options.dateString || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  ctx.textAlign = "right";
  ctx.fillText(dateDisplay, width - paddingX, footerY);
  ctx.restore();
}

/**
 * Export canvas to clean WebP Blob.
 */
export async function exportPosterBlob(options: PosterRenderOptions): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await renderPosterToCanvas(canvas, options);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to export poster canvas to blob"));
        }
      },
      "image/webp",
      0.9
    );
  });
}

/**
 * Export canvas to data URL (WebP or PNG fallback).
 */
export async function exportPosterDataUrl(options: PosterRenderOptions): Promise<string> {
  const canvas = document.createElement("canvas");
  await renderPosterToCanvas(canvas, options);
  return canvas.toDataURL("image/webp", 0.9);
}
