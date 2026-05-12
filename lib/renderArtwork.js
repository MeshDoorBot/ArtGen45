export const FORMATS = {
  square: {
    label: 'square',
    width: 1080,
    height: 1080,
    safeTop: 80,
    safeBottom: 96,
    lower: { x: 96, titleY: 730, dateY: 875 },
    center: { x: 96, titleY: 545, dateY: 690 }
  },
  post: {
    label: 'post',
    width: 1080,
    height: 1350,
    safeTop: 96,
    safeBottom: 140,
    lower: { x: 96, titleY: 925, dateY: 1070 },
    center: { x: 96, titleY: 640, dateY: 785 }
  },
  story: {
    label: 'story',
    width: 1080,
    height: 1920,
    safeTop: 250,
    safeBottom: 340,
    lower: { x: 96, titleY: 1240, dateY: 1390 },
    center: { x: 96, titleY: 840, dateY: 990 }
  }
};

export const EXPORT_SCALE = 2;

const PILL_PADDING_X = 30;
const DATE_TIME_GAP = 12;
const SIDE_MARGIN = 96;
const LOGO_OPACITY = 0.52;
const DISPLAY_FONT = 'Defectica, "Avenir Next", Avenir, "Helvetica Neue", -apple-system, BlinkMacSystemFont, Arial, sans-serif';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short'
});

export function formatDateLabel(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return '';
  return dateFormatter.format(new Date(year, month - 1, day));
}

export function formatTimeLabel(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return time;
  const hr = ((h + 11) % 12) + 1;
  return `${hr}${m ? `:${m.toString().padStart(2, '0')}` : ''}${h >= 12 ? 'pm' : 'am'}`;
}

export function formatTimeRange(start, end) {
  const startLabel = formatTimeLabel(start);
  const endLabel = formatTimeLabel(end);
  return endLabel ? `${startLabel} → ${endLabel}` : startLabel;
}

function normalizeRenderedText(value) {
  return String(value || '').replace(/C/g, 'c');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function drawCoverImage(ctx, img, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;

  ctx.drawImage(
    img,
    (iw - sw) / 2,
    (ih - sh) / 2,
    sw,
    sh,
    0,
    0,
    w,
    h
  );
}

function drawPill(ctx, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.10)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#f7f5ef';
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.restore();
}

function drawMeshLogo(ctx, format, logo) {
  if (!logo) return;
  const logoW = format.label === 'story' ? 168 : 132;
  const ratio = (logo.naturalHeight || logo.height) / (logo.naturalWidth || logo.width);
  const logoH = logoW * ratio;
  const x = format.label === 'story' ? (format.width - logoW) / 2 : 96;
  const y = format.label === 'story' ? format.height - format.safeBottom - logoH + 44 : 56;
  ctx.save();
  ctx.globalAlpha = LOGO_OPACITY;
  ctx.drawImage(logo, x, y, logoW, logoH);
  ctx.restore();
}

function scaleFontsToFit(ctx, primaryText, secondaryText, maxTextWidth) {
  ctx.font = `800 61px ${DISPLAY_FONT}`;
  const primaryW = ctx.measureText(primaryText).width;

  ctx.font = `600 32px ${DISPLAY_FONT}`;
  const secondaryW = secondaryText ? ctx.measureText(secondaryText).width : 0;
  const widest = Math.max(primaryW, secondaryW);

  if (widest <= maxTextWidth) {
    return { primarySize: 61, secondarySize: 32 };
  }

  const scale = maxTextWidth / widest;
  return {
    primarySize: Math.max(34, Math.floor(61 * scale)),
    secondarySize: Math.max(22, Math.floor(32 * scale))
  };
}

function textMetrics(ctx, text) {
  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || 0;
  const descent = metrics.actualBoundingBoxDescent || 0;
  return {
    ascent,
    descent,
    height: ascent + descent
  };
}

function drawTextOpticalCenter(ctx, text, x, centerY) {
  const metrics = textMetrics(ctx, text);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, centerY + (metrics.ascent - metrics.descent) / 2);
}

function splitTracklist(tracklist) {
  return normalizeRenderedText(tracklist)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function drawTracklistArtwork(ctx, format, info, lines) {
  const x = SIDE_MARGIN;
  const maxW = format.width - SIDE_MARGIN * 2;
  const topY = format.safeTop + (format.label === 'story' ? 44 : 24);
  const title = normalizeRenderedText(info.title).trim();
  const dateStr = formatDateLabel(info.date);
  const timeStr = formatTimeRange(info.start, info.end);
  const meta = [dateStr, timeStr].filter(Boolean);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.16)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  const titleBaseSize = format.label === 'story' ? 58 : 50;
  ctx.font = `800 ${titleBaseSize}px ${DISPLAY_FONT}`;
  const measuredTitleW = ctx.measureText(title).width;
  const titleSize = measuredTitleW > maxW - PILL_PADDING_X * 2
    ? Math.max(28, Math.floor(titleBaseSize * ((maxW - PILL_PADDING_X * 2) / measuredTitleW)))
    : titleBaseSize;
  ctx.font = `800 ${titleSize}px ${DISPLAY_FONT}`;
  const titleW = Math.min(ctx.measureText(title).width + PILL_PADDING_X * 2, maxW);
  const titleH = format.label === 'story' ? 78 : 68;
  drawPill(ctx, x, topY, titleW, titleH);
  ctx.fillStyle = '#050505';
  ctx.textAlign = 'left';
  drawTextOpticalCenter(ctx, title, x + PILL_PADDING_X, topY + titleH / 2);

  ctx.font = `700 ${format.label === 'story' ? 30 : 24}px ${DISPLAY_FONT}`;
  let nextX = x;
  const metaY = topY + titleH + 14;
  const metaH = format.label === 'story' ? 50 : 42;
  meta.forEach((text, index) => {
    if (index > 0) nextX += DATE_TIME_GAP;
    const pillW = ctx.measureText(text).width + 32;
    drawPill(ctx, nextX, metaY, pillW, metaH);
    ctx.fillStyle = '#050505';
    ctx.textAlign = 'center';
    drawTextOpticalCenter(ctx, text, nextX + pillW / 2, metaY + metaH / 2);
    nextX += pillW;
  });
  ctx.restore();

  const listTop = meta.length ? metaY + metaH + 58 : topY + titleH + 62;
  const listBottom = format.height - format.safeBottom - (format.label === 'story' ? 94 : 64);
  const availableH = Math.max(220, listBottom - listTop);
  const baseSize = format.label === 'story' ? 34 : 28;
  const lineHeight = Math.max(32, Math.min(baseSize + 14, Math.floor(availableH / Math.max(lines.length, 1))));
  const fontSize = clamp(lineHeight - 10, 18, baseSize);
  const visibleLines = lines.slice(0, Math.floor(availableH / lineHeight));

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${fontSize}px ${DISPLAY_FONT}`;
  ctx.shadowColor = 'rgba(0,0,0,0.34)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;

  visibleLines.forEach((line, index) => {
    const y = listTop + index * lineHeight;
    const number = `${String(index + 1).padStart(2, '0')}`;
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fillText(number, x, y);
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.fillText(line, x + 62, y);
  });

  ctx.font = `700 ${format.label === 'story' ? 22 : 19}px ${DISPLAY_FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.fillText('meshradio.live', x, listBottom + 42);
  ctx.restore();
}

export async function renderArtwork({ canvas, image, logo, info, formatKey, layoutKey, showPills = true, showLogo = true, tracklist = '' }) {
  const format = FORMATS[formatKey] || FORMATS.square;
  const layout = format[layoutKey] || format.lower;
  const ctx = canvas.getContext('2d', { alpha: false });
  const outputWidth = format.width * EXPORT_SCALE;
  const outputHeight = format.height * EXPORT_SCALE;

  if (canvas.width !== outputWidth || canvas.height !== outputHeight) {
    canvas.width = outputWidth;
    canvas.height = outputHeight;
  }

  ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);

  if (document.fonts?.load) {
    await Promise.all([
      document.fonts.load('800 61px Defectica'),
      document.fonts.load('700 30px Defectica'),
      document.fonts.ready
    ]);
  }

  const cw = format.width;
  const ch = format.height;
  const maxPillWidth = cw - SIDE_MARGIN * 2;
  const maxTextW = maxPillWidth - PILL_PADDING_X * 2;
  const tracklistLines = splitTracklist(tracklist);

  ctx.clearRect(0, 0, cw, ch);
  if (tracklistLines.length) {
    ctx.save();
    ctx.filter = 'blur(22px) saturate(1.15)';
    drawCoverImage(ctx, image, cw, ch);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.fillRect(0, 0, cw, ch);
    drawTracklistArtwork(ctx, format, info, tracklistLines);
    return;
  }

  drawCoverImage(ctx, image, cw, ch);
  if (showLogo) drawMeshLogo(ctx, format, logo);

  const title = normalizeRenderedText(info.title).trim();
  const dj = normalizeRenderedText(info.dj).trim();
  const guest = normalizeRenderedText(info.guest).trim();
  const showEqualsDj = dj && title.toLowerCase() === dj.toLowerCase();

  let primaryLine = title;
  let secondaryLine = '';

  if (showEqualsDj) {
    if (guest) primaryLine = `${title} + ${guest}`;
  } else {
    secondaryLine = [dj, guest].filter(Boolean).join(' + ');
  }

  const sizes = scaleFontsToFit(ctx, primaryLine, secondaryLine, maxTextW);

  ctx.font = `800 ${sizes.primarySize}px ${DISPLAY_FONT}`;
  const primaryW = ctx.measureText(primaryLine).width;
  ctx.font = `600 ${sizes.secondarySize}px ${DISPLAY_FONT}`;
  const secondaryW = secondaryLine ? ctx.measureText(secondaryLine).width : 0;

  let pillW = Math.max(primaryW, secondaryW) + PILL_PADDING_X * 2;
  let pillX = layout.x;
  if (pillW > maxPillWidth) {
    pillW = maxPillWidth;
    pillX = (cw - pillW) / 2;
  }

  const pillHeight = secondaryLine ? 116 : 78;
  const pillY = clamp(layout.titleY, format.safeTop + 24, ch - format.safeBottom - 260);

  if (showPills) drawPill(ctx, pillX, pillY, pillW, pillHeight);

  ctx.fillStyle = showPills ? '#050505' : '#fff';
  ctx.textAlign = 'center';
  ctx.shadowColor = showPills ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.42)';
  ctx.shadowBlur = showPills ? 0 : 12;
  ctx.shadowOffsetY = showPills ? 0 : 2;
  ctx.font = `800 ${sizes.primarySize}px ${DISPLAY_FONT}`;

  const centerY = pillY + pillHeight / 2;
  const primaryMetrics = textMetrics(ctx, primaryLine);
  const gap = secondaryLine ? Math.max(7, Math.round(sizes.secondarySize * 0.24)) : 0;
  let textBlockBottom = pillY + pillHeight;

  if (!secondaryLine) {
    if (showPills) {
      drawTextOpticalCenter(ctx, primaryLine, pillX + pillW / 2, centerY);
    } else {
      ctx.textAlign = 'left';
      const primaryCenterY = pillY + primaryMetrics.height / 2;
      drawTextOpticalCenter(ctx, primaryLine, pillX, primaryCenterY);
      textBlockBottom = primaryCenterY + primaryMetrics.height / 2;
    }
  }

  if (secondaryLine) {
    ctx.font = `600 ${sizes.secondarySize}px ${DISPLAY_FONT}`;
    const secondaryMetrics = textMetrics(ctx, secondaryLine);
    const blockH = primaryMetrics.height + gap + secondaryMetrics.height;
    const blockCenterY = showPills ? centerY : pillY + blockH / 2;
    const primaryCenterY = blockCenterY - blockH / 2 + primaryMetrics.height / 2;
    const secondaryCenterY = blockCenterY + blockH / 2 - secondaryMetrics.height / 2;

    ctx.font = `800 ${sizes.primarySize}px ${DISPLAY_FONT}`;
    ctx.textAlign = showPills ? 'center' : 'left';
    drawTextOpticalCenter(ctx, primaryLine, showPills ? pillX + pillW / 2 : pillX, primaryCenterY);

    ctx.fillStyle = showPills ? 'rgba(5,5,5,0.68)' : 'rgba(255,255,255,0.78)';
    ctx.font = `600 ${sizes.secondarySize}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'left';
    drawTextOpticalCenter(ctx, secondaryLine, showPills ? pillX + PILL_PADDING_X : pillX, secondaryCenterY);
    textBlockBottom = secondaryCenterY + secondaryMetrics.height / 2;
  }

  ctx.shadowColor = 'rgba(0,0,0,0)';
  const dateStr = formatDateLabel(info.date);
  const timeStr = formatTimeRange(info.start, info.end);
  const infoPills = [dateStr, timeStr].filter(Boolean);
  const preferredDateY = (showPills ? pillY + pillHeight : textBlockBottom) + (secondaryLine ? 18 : 14);
  const dateMinY = (showPills ? pillY + pillHeight : textBlockBottom) + 16;
  const dateY = clamp(preferredDateY, dateMinY, ch - format.safeBottom - 96);

  const metaFontSize = formatKey === 'story' ? 30 : 24;
  const metaPillHeight = formatKey === 'story' ? 50 : 42;
  ctx.font = `700 ${metaFontSize}px ${DISPLAY_FONT}`;
  let nextX = pillX;
  infoPills.forEach((text, index) => {
    const textW = ctx.measureText(text).width;
    const bubbleW = textW + 32;
    if (index > 0) nextX += DATE_TIME_GAP;
    if (showPills) drawPill(ctx, nextX, dateY, bubbleW, metaPillHeight);
    ctx.fillStyle = showPills ? '#050505' : 'rgba(255,255,255,0.92)';
    ctx.textAlign = showPills ? 'center' : 'left';
    ctx.shadowColor = showPills ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.36)';
    ctx.shadowBlur = showPills ? 0 : 8;
    ctx.shadowOffsetY = showPills ? 0 : 1;
    drawTextOpticalCenter(ctx, text, showPills ? nextX + bubbleW / 2 : nextX, dateY + metaPillHeight / 2);
    ctx.shadowColor = 'rgba(0,0,0,0)';
    nextX += showPills ? bubbleW : textW;
  });

  ctx.textAlign = 'left';
  ctx.fillStyle = showPills ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.84)';
  ctx.font = `700 21px ${DISPLAY_FONT}`;
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 1;
  const siteGap = showPills ? (formatKey === 'story' ? 86 : 70) : (formatKey === 'story' ? 58 : 46);
  const siteY = infoPills.length
    ? dateY + siteGap
    : showPills
      ? pillY + pillHeight + 44
      : textBlockBottom + 42;
  ctx.fillText('meshradio.live', pillX, siteY);
  ctx.shadowColor = 'rgba(0,0,0,0)';
}
