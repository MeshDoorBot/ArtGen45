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

const PILL_PADDING_X = 30;
const DATE_TIME_GAP = 12;
const SIDE_MARGIN = 96;
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
  const x = 96;
  const y = format.label === 'story' ? 96 : 56;
  const logoW = format.label === 'story' ? 168 : 132;
  const ratio = (logo.naturalHeight || logo.height) / (logo.naturalWidth || logo.width);
  const logoH = logoW * ratio;
  const padX = 22;
  const padY = 16;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = 'rgba(8,8,10,0.44)';
  ctx.fillRect(x - padX, y - padY, logoW + padX * 2, logoH + padY * 2);
  ctx.shadowColor = 'rgba(0,0,0,0.20)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 1;
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

export async function renderArtwork({ canvas, image, logo, info, formatKey, layoutKey, showPills = true, showLogo = true }) {
  const format = FORMATS[formatKey] || FORMATS.square;
  const layout = format[layoutKey] || format.lower;
  const ctx = canvas.getContext('2d', { alpha: false });

  if (canvas.width !== format.width || canvas.height !== format.height) {
    canvas.width = format.width;
    canvas.height = format.height;
  }

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

  ctx.clearRect(0, 0, cw, ch);
  drawCoverImage(ctx, image, cw, ch);
  if (showLogo) drawMeshLogo(ctx, format, logo);

  const title = info.title.trim();
  const dj = info.dj.trim();
  const guest = info.guest.trim();
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

  if (!secondaryLine) {
    drawTextOpticalCenter(ctx, primaryLine, pillX + pillW / 2, centerY);
  }

  if (secondaryLine) {
    ctx.font = `600 ${sizes.secondarySize}px ${DISPLAY_FONT}`;
    const secondaryMetrics = textMetrics(ctx, secondaryLine);
    const blockH = primaryMetrics.height + gap + secondaryMetrics.height;
    const primaryCenterY = centerY - blockH / 2 + primaryMetrics.height / 2;
    const secondaryCenterY = centerY + blockH / 2 - secondaryMetrics.height / 2;

    ctx.font = `800 ${sizes.primarySize}px ${DISPLAY_FONT}`;
    drawTextOpticalCenter(ctx, primaryLine, pillX + pillW / 2, primaryCenterY);

    ctx.fillStyle = showPills ? 'rgba(5,5,5,0.68)' : 'rgba(255,255,255,0.78)';
    ctx.font = `600 ${sizes.secondarySize}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'left';
    drawTextOpticalCenter(ctx, secondaryLine, pillX + PILL_PADDING_X, secondaryCenterY);
  }

  ctx.shadowColor = 'rgba(0,0,0,0)';
  const dateStr = formatDateLabel(info.date);
  const timeStr = formatTimeRange(info.start, info.end);
  const infoPills = [dateStr, timeStr].filter(Boolean);
  const preferredDateY = pillY + pillHeight + (secondaryLine ? 18 : 14);
  const dateY = clamp(preferredDateY, pillY + pillHeight + 16, ch - format.safeBottom - 96);

  const metaFontSize = formatKey === 'story' ? 30 : 24;
  const metaPillHeight = formatKey === 'story' ? 50 : 42;
  ctx.font = `700 ${metaFontSize}px ${DISPLAY_FONT}`;
  let nextX = pillX;
  infoPills.forEach((text, index) => {
    const bubbleW = ctx.measureText(text).width + 32;
    if (index > 0) nextX += DATE_TIME_GAP;
    if (showPills) drawPill(ctx, nextX, dateY, bubbleW, metaPillHeight);
    ctx.fillStyle = showPills ? '#050505' : 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'center';
    ctx.shadowColor = showPills ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.36)';
    ctx.shadowBlur = showPills ? 0 : 8;
    ctx.shadowOffsetY = showPills ? 0 : 1;
    drawTextOpticalCenter(ctx, text, nextX + bubbleW / 2, dateY + metaPillHeight / 2);
    ctx.shadowColor = 'rgba(0,0,0,0)';
    nextX += bubbleW;
  });

  ctx.textAlign = 'left';
  ctx.fillStyle = showPills ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.84)';
  ctx.font = `700 21px ${DISPLAY_FONT}`;
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 1;
  const siteGap = formatKey === 'story' ? 86 : 70;
  ctx.fillText('meshradio.live', pillX, infoPills.length ? dateY + siteGap : pillY + pillHeight + 44);
  ctx.shadowColor = 'rgba(0,0,0,0)';
}
