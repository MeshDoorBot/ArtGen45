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
const DISPLAY_FONT = 'Array, "Avenir Next", Avenir, "Helvetica Neue", -apple-system, BlinkMacSystemFont, Arial, sans-serif';
const TRACKLIST_COLUMN_GAP = 44;
const TRACKLIST_STORY_FOOTER_OFFSET = 126;
const TRACKLIST_STORY_FOOTER_GAP = 72;

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

export function formatBpmRange(min, max) {
  const start = String(min || '').trim();
  const end = String(max || '').trim();
  if (start && end) return start === end ? `${start} BPM` : `${start}-${end} BPM`;
  return start || end ? `${start || end} BPM` : '';
}

function normalizeRenderedText(value) {
  return String(value || '').replace(/C/g, 'c');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function drawCoverImage(ctx, img, w, h, imageTweak = {}) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const zoom = clamp(Number(imageTweak.zoom) || 1, 1, 2.5);
  const offsetX = Number(imageTweak.x) || 0;
  const offsetY = Number(imageTweak.y) || 0;
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const minX = Math.min(0, w - dw);
  const minY = Math.min(0, h - dh);
  const dx = clamp((w - dw) / 2 + offsetX, minX, 0);
  const dy = clamp((h - dh) / 2 + offsetY, minY, 0);

  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawPill(ctx, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.10)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#f7f5ef';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.restore();
}

function drawMeshLogo(ctx, format, logo) {
  if (!logo) return;
  const logoW = format.label === 'story' ? 168 : 132;
  const ratio = (logo.naturalHeight || logo.height) / (logo.naturalWidth || logo.width);
  const logoH = logoW * ratio;
  const x = format.label === 'story'
    ? (format.width - logoW) / 2
    : format.label === 'square'
      ? format.width - 96 - logoW
      : 96;
  const y = format.label === 'story' ? format.height - format.safeBottom - logoH + 44 : 56;
  ctx.save();
  ctx.globalAlpha = LOGO_OPACITY;
  ctx.drawImage(logo, x, y, logoW, logoH);
  ctx.restore();
}

function scaleFontsToFit(ctx, primaryText, secondaryText, maxTextWidth) {
  const primaryFont = font(800, 61);
  const primaryAmpersandFont = font(400, 61);
  ctx.font = primaryFont;
  const primaryW = measureAmpersandText(ctx, primaryText, primaryFont, primaryAmpersandFont);

  const secondaryFont = font(600, 32);
  const secondaryAmpersandFont = font(400, 32);
  ctx.font = secondaryFont;
  const secondaryW = secondaryText ? measureAmpersandText(ctx, secondaryText, secondaryFont, secondaryAmpersandFont) : 0;
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

function font(weight, size) {
  return `${weight} ${size}px ${DISPLAY_FONT}`;
}

function textRuns(text) {
  return String(text).split(/(&)/g).filter(Boolean);
}

function measureAmpersandText(ctx, text, textFont, ampersandFont = textFont) {
  const currentFont = ctx.font;
  const width = textRuns(text).reduce((total, run) => {
    ctx.font = run === '&' ? ampersandFont : textFont;
    return total + ctx.measureText(run).width;
  }, 0);
  ctx.font = currentFont;
  return width;
}

function drawTextOpticalCenter(ctx, text, x, centerY) {
  const metrics = textMetrics(ctx, text);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, centerY + (metrics.ascent - metrics.descent) / 2);
}

function drawAmpersandTextOpticalCenter(ctx, text, x, centerY, textFont, ampersandFont = textFont) {
  const align = ctx.textAlign;
  ctx.font = textFont;
  const metrics = textMetrics(ctx, text);
  const totalW = measureAmpersandText(ctx, text, textFont, ampersandFont);
  let nextX = x;

  if (align === 'center') nextX -= totalW / 2;
  if (align === 'right' || align === 'end') nextX -= totalW;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  textRuns(text).forEach((run) => {
    ctx.font = run === '&' ? ampersandFont : textFont;
    ctx.fillText(run, nextX, centerY + (metrics.ascent - metrics.descent) / 2);
    nextX += ctx.measureText(run).width;
  });

  ctx.textAlign = align;
  ctx.font = textFont;
}

function drawDisplayText(ctx, text, x, centerY, weight, size, ampersandWeight = 400) {
  drawAmpersandTextOpticalCenter(ctx, text, x, centerY, font(weight, size), font(ampersandWeight, size));
}

function splitTracklist(tracklist) {
  return normalizeRenderedText(tracklist)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function truncateTextToWidth(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;

  const suffix = '...';
  const suffixW = ctx.measureText(suffix).width;
  const targetW = Math.max(0, maxW - suffixW);
  let low = 0;
  let high = text.length;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (ctx.measureText(text.slice(0, mid)).width <= targetW) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return `${text.slice(0, low).trimEnd()}${suffix}`;
}

function getTracklistLayout(format, lines, maxW, availableH) {
  const baseSize = format.label === 'story' ? 34 : 28;
  const minSize = format.label === 'story' ? 18 : 16;
  const readableSize = format.label === 'story' ? 23 : 20;
  const preferredLineHeight = baseSize + 14;

  let columnCount = 1;
  let lineHeight = preferredLineHeight;
  let fontSize = baseSize;

  for (let columns = 1; columns <= 3; columns += 1) {
    const rows = Math.ceil(lines.length / columns);
    const nextLineHeight = Math.max(minSize + 8, Math.min(preferredLineHeight, Math.floor(availableH / Math.max(rows, 1))));
    const nextFontSize = clamp(nextLineHeight - 9, minSize, baseSize);

    columnCount = columns;
    lineHeight = nextLineHeight;
    fontSize = nextFontSize;

    if (nextFontSize >= readableSize) break;
  }

  const linesPerColumn = Math.ceil(lines.length / columnCount);
  const columnWidth = (maxW - TRACKLIST_COLUMN_GAP * (columnCount - 1)) / columnCount;
  const rowsThatFit = Math.max(1, Math.floor(availableH / lineHeight));
  const capacity = rowsThatFit * columnCount;
  const hasOverflow = lines.length > capacity;
  const visibleCount = hasOverflow ? Math.max(0, capacity - 1) : lines.length;
  const visibleLines = lines.slice(0, visibleCount);

  if (hasOverflow) {
    visibleLines.push(`+ ${lines.length - visibleCount} more tracks`);
  }

  return {
    columnCount,
    columnWidth,
    lineHeight,
    fontSize,
    linesPerColumn: rowsThatFit,
    visibleLines
  };
}

function drawTracklistArtwork(ctx, format, info, lines) {
  const x = SIDE_MARGIN;
  const maxW = format.width - SIDE_MARGIN * 2;
  const topY = format.safeTop + (format.label === 'story' ? 44 : 24);
  const title = normalizeRenderedText(info.title).trim();
  const dateStr = formatDateLabel(info.date);
  const timeStr = formatTimeRange(info.start, info.end);
  const bpmStr = formatBpmRange(info.bpmMin, info.bpmMax);
  const meta = [dateStr, timeStr, bpmStr].filter(Boolean);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.16)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  const titleBaseSize = format.label === 'story' ? 58 : 50;
  ctx.font = font(800, titleBaseSize);
  const measuredTitleW = measureAmpersandText(ctx, title, font(800, titleBaseSize), font(400, titleBaseSize));
  const titleSize = measuredTitleW > maxW - PILL_PADDING_X * 2
    ? Math.max(28, Math.floor(titleBaseSize * ((maxW - PILL_PADDING_X * 2) / measuredTitleW)))
    : titleBaseSize;
  ctx.font = font(800, titleSize);
  const titleW = Math.min(measureAmpersandText(ctx, title, font(800, titleSize), font(400, titleSize)) + PILL_PADDING_X * 2, maxW);
  const titleH = format.label === 'story' ? 78 : 68;
  drawPill(ctx, x, topY, titleW, titleH);
  ctx.fillStyle = '#050505';
  ctx.textAlign = 'left';
  drawDisplayText(ctx, title, x + PILL_PADDING_X, topY + titleH / 2, 800, titleSize);

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
  const footerY = format.label === 'story'
    ? format.height - TRACKLIST_STORY_FOOTER_OFFSET
    : format.height - format.safeBottom - 22;
  const listBottom = format.label === 'story'
    ? footerY - TRACKLIST_STORY_FOOTER_GAP
    : footerY - 42;
  const availableH = Math.max(220, listBottom - listTop);
  const { columnCount, columnWidth, lineHeight, fontSize, linesPerColumn, visibleLines } = getTracklistLayout(format, lines, maxW, availableH);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${fontSize}px ${DISPLAY_FONT}`;
  ctx.shadowColor = 'rgba(0,0,0,0.34)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;

  visibleLines.forEach((line, index) => {
    const columnIndex = Math.floor(index / linesPerColumn);
    const rowIndex = index % linesPerColumn;
    const columnX = x + columnIndex * (columnWidth + TRACKLIST_COLUMN_GAP);
    const y = listTop + rowIndex * lineHeight;
    const trackX = columnX + (columnCount === 1 ? 62 : 52);
    const trackMaxW = Math.max(120, columnWidth - (trackX - columnX));
    const number = `${String(index + 1).padStart(2, '0')}`;
    const isOverflowNote = line.startsWith('+ ');
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    if (!isOverflowNote) ctx.fillText(number, columnX, y);
    ctx.fillStyle = isOverflowNote ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.94)';
    ctx.fillText(truncateTextToWidth(ctx, line, isOverflowNote ? columnWidth : trackMaxW), isOverflowNote ? columnX : trackX, y);
  });

  ctx.font = `700 ${format.label === 'story' ? 22 : 19}px ${DISPLAY_FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.fillText('meshradio.live', x, footerY);
  ctx.restore();
}

export async function renderArtwork({ canvas, image, logo, info, formatKey, layoutKey, showPills = true, showLogo = true, tracklist = '', imageTweak = {} }) {
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
      document.fonts.load('800 61px Array'),
      document.fonts.load('700 30px Array'),
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
    drawCoverImage(ctx, image, cw, ch, imageTweak);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.fillRect(0, 0, cw, ch);
    drawTracklistArtwork(ctx, format, info, tracklistLines);
    return;
  }

  drawCoverImage(ctx, image, cw, ch, imageTweak);
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

  const primaryFont = font(800, sizes.primarySize);
  const primaryAmpersandFont = font(400, sizes.primarySize);
  const secondaryFont = font(600, sizes.secondarySize);
  const secondaryAmpersandFont = font(400, sizes.secondarySize);
  ctx.font = primaryFont;
  const primaryW = measureAmpersandText(ctx, primaryLine, primaryFont, primaryAmpersandFont);
  ctx.font = secondaryFont;
  const secondaryW = secondaryLine ? measureAmpersandText(ctx, secondaryLine, secondaryFont, secondaryAmpersandFont) : 0;

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
  ctx.font = primaryFont;

  const centerY = pillY + pillHeight / 2;
  const primaryMetrics = textMetrics(ctx, primaryLine);
  const gap = secondaryLine ? Math.max(7, Math.round(sizes.secondarySize * 0.24)) : 0;
  let textBlockBottom = pillY + pillHeight;

  if (!secondaryLine) {
    if (showPills) {
      drawDisplayText(ctx, primaryLine, pillX + pillW / 2, centerY, 800, sizes.primarySize);
    } else {
      ctx.textAlign = 'left';
      const primaryCenterY = pillY + primaryMetrics.height / 2;
      drawDisplayText(ctx, primaryLine, pillX, primaryCenterY, 800, sizes.primarySize);
      textBlockBottom = primaryCenterY + primaryMetrics.height / 2;
    }
  }

  if (secondaryLine) {
    ctx.font = secondaryFont;
    const secondaryMetrics = textMetrics(ctx, secondaryLine);
    const blockH = primaryMetrics.height + gap + secondaryMetrics.height;
    const blockCenterY = showPills ? centerY : pillY + blockH / 2;
    const primaryCenterY = blockCenterY - blockH / 2 + primaryMetrics.height / 2;
    const secondaryCenterY = blockCenterY + blockH / 2 - secondaryMetrics.height / 2;

    ctx.font = primaryFont;
    ctx.textAlign = showPills ? 'center' : 'left';
    drawDisplayText(ctx, primaryLine, showPills ? pillX + pillW / 2 : pillX, primaryCenterY, 800, sizes.primarySize);

    ctx.fillStyle = showPills ? 'rgba(5,5,5,0.68)' : 'rgba(255,255,255,0.78)';
    ctx.font = secondaryFont;
    ctx.textAlign = 'left';
    drawDisplayText(ctx, secondaryLine, showPills ? pillX + PILL_PADDING_X : pillX, secondaryCenterY, 600, sizes.secondarySize);
    textBlockBottom = secondaryCenterY + secondaryMetrics.height / 2;
  }

  ctx.shadowColor = 'rgba(0,0,0,0)';
  const dateStr = formatDateLabel(info.date);
  const timeStr = formatTimeRange(info.start, info.end);
  const bpmStr = formatBpmRange(info.bpmMin, info.bpmMax);
  const infoPills = [dateStr, timeStr, bpmStr].filter(Boolean);
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
