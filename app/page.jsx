'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EXPORT_SCALE, FORMATS, renderArtwork } from '../lib/renderArtwork';

const SHOWS_URL = 'https://script.google.com/macros/s/AKfycbw3QgJtZXB48I0BUMpTE5Dlo2kqMReNuD4jbiEVBaB1z49bSgzEkAgixkjHxwTKRwY0/exec';
const SHOWS_CACHE_KEY = 'mesh-art-generator-shows-v1';

const emptyInfo = {
  title: '',
  dj: '',
  date: '',
  start: '',
  end: '',
  guest: '',
  bpmMin: '',
  bpmMax: ''
};

const GUEST_FIELD_ORDER = ['Guest DJ', 'Guest MC'];

const defaultImageTweak = {
  x: 0,
  y: 0,
  zoom: 1
};

const demoTracklist = [
  'Asha Puthli - Space Talk',
  'Metro Area - Miura',
  'Peven Everett - Stuck',
  'Tornado Wallace - Lonely Planet',
  'Kerri Chandler - Bar A Thym',
  'Mala - Alicia',
  'Bambounou - Temple',
  'Skee Mask - Reviver',
  'Octo Octa - I Need You',
  'Pangaea - Installation',
  'Joy Orbison - Hyph Mngo',
  'Shanti Celeste - Sesame',
  'Call Super - Sulu Sekou',
  'DJ Python - Angel',
  'Objekt - Theme From Q',
  'Erika de Casier - Drama',
  'AceMo - Where They At???',
  'K-Lone - In The Dust',
  'Anz - Clearly Rushing',
  'Lone - Airglow Fires',
  'Batu - Marius',
  'Pearson Sound - Alien Mode',
  'Helena Hauff - c45p',
  'Ben UFO - Untitled Dubplate',
  'Facta - Blush',
  'Jossy Mitsu - Odawara',
  'Josey Rebelle - Pressure Mix',
  'Mesh Test ID - Extra Long Artist Name With A Long Track Title'
]
  .concat(Array.from({ length: 6 }, (_, index) => `Extended Mix Test ${String(index + 29).padStart(2, '0')} - Deep Two Hour Tracklist Check`))
  .join('\n');

const demoInfo = {
  title: 'Tracklist Export Test',
  dj: 'Mesh Radio',
  date: '2026-06-16',
  start: '20:00',
  end: '22:00',
  guest: 'Column Check',
  bpmMin: '118',
  bpmMax: '136'
};

function toDateInputValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function splitTimeRange(range) {
  const [start = '', end = ''] = String(range || '').split('-').map((t) => t.trim());
  return { start, end };
}

function normalizeFieldName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeGuestValue(value) {
  return String(value || '').trim();
}

function normalizeBpmValue(value) {
  const match = String(value || '').match(/\d{1,3}/);
  return match ? match[0] : '';
}

function isGuestField(key) {
  const normalizedKey = normalizeFieldName(key);
  return (
    normalizedKey.includes('guest') ||
    normalizedKey === 'featuring' ||
    normalizedKey === 'feat'
  );
}

function getShowBpmRange(show) {
  if (!show) return { bpmMin: '', bpmMax: '' };

  const rangeValue = show.BPM || show.Bpm || show.bpm || show['BPM Range'] || show['Bpm Range'];
  const rangeMatches = String(rangeValue || '').match(/\d{1,3}/g) || [];
  if (rangeMatches.length) {
    return {
      bpmMin: rangeMatches[0] || '',
      bpmMax: rangeMatches[1] || ''
    };
  }

  return {
    bpmMin: normalizeBpmValue(show['BPM Min'] || show['Min BPM'] || show.bpmMin || show.minBpm),
    bpmMax: normalizeBpmValue(show['BPM Max'] || show['Max BPM'] || show.bpmMax || show.maxBpm)
  };
}

function getShowGuest(show) {
  if (!show) return '';

  const orderedGuests = GUEST_FIELD_ORDER
    .map((field) => normalizeGuestValue(show[field]))
    .filter(Boolean);

  const otherGuests = Object.entries(show)
    .filter(([key, value]) => value && isGuestField(key) && !GUEST_FIELD_ORDER.includes(key))
    .map(([, value]) => normalizeGuestValue(value))
    .filter(Boolean);

  const guests = [...orderedGuests, ...otherGuests];

  return [...new Set(guests.map((guest) => guest.toLowerCase()))]
    .map((guestKey) => guests.find((guest) => guest.toLowerCase() === guestKey))
    .join(' + ');
}

function showToInfo(show) {
  const times = splitTimeRange(show?.['A-B']);
  const bpmRange = getShowBpmRange(show);
  return {
    title: show?.['Now Playing'] || '',
    dj: show?.DJ || '',
    date: toDateInputValue(show?.Date),
    start: times.start,
    end: times.end,
    guest: getShowGuest(show),
    ...bpmRange
  };
}

function formatShowOption(show) {
  const date = new Date(show?.Date);
  const label = Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  return `${label} — ${show?.['Now Playing'] || 'Untitled show'}`;
}

function cleanShowId(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function showMatchesId(show, showId) {
  if (!showId) return false;
  return [
    show?.showId,
    show?.showID,
    show?.show_id,
    show?.['Show ID'],
    show?.['ShowID'],
    show?.['Show Id']
  ].some((value) => cleanShowId(value) === showId);
}

function showDateTime(show) {
  const date = new Date(show?.Date);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function findShowIndexById(shows, showId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const matches = shows
    .map((show, index) => ({ show, index, time: showDateTime(show) }))
    .filter(({ show }) => showMatchesId(show, showId));

  if (!matches.length) return -1;

  const future = matches
    .filter(({ time }) => time !== null && time >= today.getTime())
    .sort((a, b) => a.time - b.time);
  if (future.length) return future[0].index;

  const past = matches
    .filter(({ time }) => time !== null)
    .sort((a, b) => b.time - a.time);
  return past.length ? past[0].index : matches[0].index;
}

async function decodeUpload(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {}
  }

  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      if (img.decode) {
        try {
          await img.decode();
        } catch {}
      }
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function createDemoArtworkImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');

  const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, '#101010');
  background.addColorStop(0.42, '#42574c');
  background.addColorStop(1, '#ece2c8');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.78;
  ctx.fillStyle = '#f4f0e7';
  ctx.fillRect(120, 160, 760, 760);
  ctx.fillStyle = '#050505';
  ctx.fillRect(188, 228, 624, 624);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#f4f0e7';
  ctx.font = '700 86px Arial, sans-serif';
  ctx.fillText('MESH', 190, 1010);
  ctx.font = '700 38px Arial, sans-serif';
  ctx.fillText('LOCAL TRACKLIST EXPORT TEST', 190, 1074);

  return canvas;
}

export default function ArtGenerator() {
  const canvasRef = useRef(null);
  const showPickerRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageRef = useRef(null);
  const logoRef = useRef(null);
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState('');
  const [format, setFormat] = useState('square');
  const [info, setInfo] = useState(emptyInfo);
  const [hasImage, setHasImage] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [imageTweakOpen, setImageTweakOpen] = useState(false);
  const [tracklistOpen, setTracklistOpen] = useState(false);
  const [tracklist, setTracklist] = useState('');
  const [tracklistEnabled, setTracklistEnabled] = useState(true);
  const [downloadReady, setDownloadReady] = useState(false);
  const [loadingShows, setLoadingShows] = useState(true);
  const [imageName, setImageName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [showPills, setShowPills] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [logoReady, setLogoReady] = useState(false);
  const [imageTweak, setImageTweak] = useState(defaultImageTweak);
  const [initialShowId] = useState(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return cleanShowId(params.get('showId') || params.get('showID') || params.get('id'));
  });
  const [demoTracklistMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('demo') === 'tracklist';
  });

  const hasInfo = Boolean(info.title.trim());
  const canRender = hasImage && hasInfo;

  useEffect(() => {
    let cancelled = false;
    const cachedShows = window.localStorage.getItem(SHOWS_CACHE_KEY);
    if (cachedShows) {
      try {
        const parsedShows = JSON.parse(cachedShows);
        if (Array.isArray(parsedShows) && parsedShows.length) {
          setShows(parsedShows);
          setLoadingShows(false);
        }
      } catch {
        window.localStorage.removeItem(SHOWS_CACHE_KEY);
      }
    }

    const logo = new Image();
    logo.onload = () => {
      if (!cancelled) {
        logoRef.current = logo;
        setLogoReady(true);
      }
    };
    logo.src = '/logo-white.png';

    fetch(SHOWS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Show fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          const nextShows = Array.isArray(data) ? data : [];
          setShows(nextShows);
          if (nextShows.length) {
            window.localStorage.setItem(SHOWS_CACHE_KEY, JSON.stringify(nextShows));
          }
        }
      })
      .catch(() => {
        if (!cancelled) setShows([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingShows(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const renderCurrentArtwork = useCallback(async () => {
    if (!canvasRef.current || !imageRef.current || !canRender) return false;
    await renderArtwork({
      canvas: canvasRef.current,
      image: imageRef.current,
      logo: logoRef.current,
      info,
      formatKey: format,
      layoutKey: 'lower',
      showPills,
      showLogo,
      imageTweak,
      tracklist: tracklistEnabled ? tracklist : ''
    });
    setHasRendered(true);
    setDownloadReady(true);
    return true;
  }, [canRender, format, imageTweak, info, logoReady, showLogo, showPills, tracklist, tracklistEnabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const currentFormat = FORMATS[format] || FORMATS.square;
    const outputWidth = currentFormat.width * EXPORT_SCALE;
    const outputHeight = currentFormat.height * EXPORT_SCALE;
    if (canvas && (canvas.width !== outputWidth || canvas.height !== outputHeight)) {
      canvas.width = outputWidth;
      canvas.height = outputHeight;
    }
    setDownloadReady(false);
  }, [format, imageTweak, info, showPills, showLogo, tracklist, tracklistEnabled]);

  useEffect(() => {
    if (!canRender) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!cancelled) await renderCurrentArtwork();
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canRender, renderCurrentArtwork]);

  useEffect(() => {
    if (!initialShowId || !shows.length || selectedShow) return;
    const matchIndex = findShowIndexById(shows, initialShowId);
    if (matchIndex === -1) return;

    const nextValue = String(matchIndex);
    setSelectedShow(nextValue);
    setInfo(showToInfo(shows[matchIndex]));
    setDownloadReady(false);
  }, [initialShowId, selectedShow, shows]);

  useEffect(() => {
    if (!demoTracklistMode) return;
    setFormat('story');
    setInfo(demoInfo);
    setTracklist(demoTracklist);
    setTracklistEnabled(true);
    setImageTweak(defaultImageTweak);
    imageRef.current = createDemoArtworkImage();
    setImageName('Generated demo artwork');
    setHasImage(true);
    setHasRendered(false);
    setDownloadReady(false);
  }, [demoTracklistMode]);

  const onShowChange = (event) => {
    const value = event.target.value;
    setSelectedShow(value);
    const show = shows[Number(value)];
    if (show) setInfo(showToInfo(show));
    setDownloadReady(false);
  };

  const updateInfo = (field) => (event) => {
    setInfo((current) => ({ ...current, [field]: event.target.value }));
    setDownloadReady(false);
  };

  const onTracklistChange = (event) => {
    setTracklist(event.target.value);
    setTracklistEnabled(true);
    setDownloadReady(false);
  };

  const onImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imageRef.current?.close) imageRef.current.close();
    setHasImage(false);
    setUploadError('');
    setImageName(file.name);
    setImageTweak(defaultImageTweak);
    setDownloadReady(false);
    try {
      imageRef.current = await decodeUpload(file);
      setHasImage(true);
    } catch {
      imageRef.current = null;
      setImageName('');
      setUploadError('Could not read that image. Try a JPG or PNG.');
    }
  };

  const onRender = async () => {
    await renderCurrentArtwork();
  };

  const onPickImage = () => {
    const input = fileInputRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch {}
    input.click();
  };

  const onPickShow = () => {
    const picker = showPickerRef.current;
    if (!picker || picker.disabled) return;
    picker.focus();
    try {
      picker.showPicker?.();
    } catch {}
  };

  const updateImageTweak = (nextTweak) => {
    setImageTweak((current) => ({
      x: Math.max(-600, Math.min(600, nextTweak.x ?? current.x)),
      y: Math.max(-900, Math.min(900, nextTweak.y ?? current.y)),
      zoom: Math.max(1, Math.min(2.5, nextTweak.zoom ?? current.zoom))
    }));
    setDownloadReady(false);
  };

  const nudgeImage = (x, y) => {
    updateImageTweak({ x: imageTweak.x + x, y: imageTweak.y + y });
  };

  const onDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !downloadReady) return;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;

    const title = (info.title || 'mesh')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const filename = `mesh-${title || 'artwork'}-${FORMATS[format].label}.png`;

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isIOS) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return;
    }

    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch {}
    }

    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const showPlaceholder = useMemo(() => {
    if (loadingShows) return 'Loading shows...';
    return shows.length ? 'Select a show' : 'No shows found';
  }, [loadingShows, shows.length]);
  const selectedShowData = shows[Number(selectedShow)];
  const selectedShowLabel = selectedShowData ? formatShowOption(selectedShowData) : '';
  const hasShowContext = Boolean(selectedShow || demoTracklistMode);
  const mobileStep = hasShowContext ? (hasImage ? 'controls' : 'image') : 'show';
  const previewPrompt = hasShowContext ? (hasImage ? 'Rendering preview' : 'Pick artwork') : 'Pick your show';

  return (
    <main className="shell">
      <section className="panel" data-mobile-step={mobileStep}>
        <div className="masthead">
          <h1>Mesh Art Generator</h1>
          <p>Square posts and story-safe artwork for DJs.</p>
        </div>

        <div className="stack">
          <div className="statusRow desktopOnly" aria-label="Generator readiness">
            <span className={hasInfo ? 'statusItem isReady' : 'statusItem'}>Info</span>
            <span className={hasImage ? 'statusItem isReady' : 'statusItem'}>Image</span>
            <span className={downloadReady ? 'statusItem isReady' : 'statusItem'}>Ready</span>
          </div>

          <div className="controlShow">
            <label htmlFor="showPicker">Show</label>
            <select ref={showPickerRef} id="showPicker" value={selectedShow} onChange={onShowChange} disabled={!shows.length}>
              <option value="">{showPlaceholder}</option>
              {shows.map((show, index) => (
                <option key={`${show?.Date}-${show?.['Now Playing']}-${index}`} value={index}>
                  {formatShowOption(show)}
                </option>
              ))}
            </select>
          </div>

          <div className="formatControl controlControls">
            <div>
              <label htmlFor="formatPicker">Format</label>
              <select id="formatPicker" value={format} onChange={(event) => setFormat(event.target.value)}>
                <option value="square">Square 1:1</option>
                <option value="post">Post 4:5</option>
                <option value="story">Story 9:16</option>
              </select>
            </div>
          </div>

          <div className="mobileFormatButtons controlControls" aria-label="Artwork format">
            <button
              type="button"
              className={format === 'square' ? 'isActive' : ''}
              onClick={() => setFormat('square')}
              aria-pressed={format === 'square'}
            >
              Square
            </button>
            <button
              type="button"
              className={format === 'post' ? 'isActive' : ''}
              onClick={() => setFormat('post')}
              aria-pressed={format === 'post'}
            >
              Post
            </button>
            <button
              type="button"
              className={format === 'story' ? 'isActive' : ''}
              onClick={() => setFormat('story')}
              aria-pressed={format === 'story'}
            >
              Story
            </button>
          </div>

          <label className="toggleRow controlControls desktopAdvanced" htmlFor="pillToggle">
            <span>Clean view</span>
            <input
              id="pillToggle"
              type="checkbox"
              checked={!showPills}
              onChange={(event) => setShowPills(!event.target.checked)}
            />
          </label>

          <label className="toggleRow controlControls desktopAdvanced" htmlFor="logoToggle">
            <span>Mesh logo</span>
            <input
              id="logoToggle"
              type="checkbox"
              checked={showLogo}
              onChange={(event) => setShowLogo(event.target.checked)}
            />
          </label>

          <input ref={fileInputRef} id="uploadInput" className="visuallyHiddenFile" type="file" accept="image/*" onChange={onImageChange} />

          <div className="controlImage">
            {selectedShowLabel && !hasImage && <div className="selectedShowNote">{selectedShowLabel}</div>}
            <label htmlFor="uploadInput">Artwork image</label>
            <button type="button" className="primary" disabled={!selectedShow} onClick={onPickImage}>
              {hasImage ? 'Change image' : 'Pick artwork'}
            </button>
            {imageName && <div className="fieldNote">{imageName}</div>}
            {uploadError && <div className="fieldError">{uploadError}</div>}
          </div>

          {hasRendered && (
            <div className="editButtonGrid controlControls desktopAdvanced">
              <button
                type="button"
                className="secondary"
                aria-expanded={editorOpen}
                onClick={() => setEditorOpen(true)}
              >
                Edit + add guests
              </button>
              <button
                type="button"
                className="secondary"
                aria-expanded={imageTweakOpen}
                onClick={() => setImageTweakOpen(true)}
              >
                Move/enlarge image
              </button>
            </div>
          )}

          <div className="tracklistControls controlControls" data-has-tracklist={tracklist.trim() ? 'true' : 'false'}>
            <button
              type="button"
              className="secondary"
              disabled={!hasInfo}
              onClick={() => setTracklistOpen(true)}
            >
              {tracklist.trim() ? 'Edit tracklist' : '+ Tracklist'}
            </button>

            {tracklist.trim() && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setTracklistEnabled((enabled) => !enabled);
                  setDownloadReady(false);
                }}
              >
                {tracklistEnabled ? 'Normal view' : 'Tracklist view'}
              </button>
            )}
          </div>

          <div className="actions controlControls desktopActions">
            <button type="button" className="primary" disabled={!canRender} onClick={onRender}>
              Render
            </button>
            <button type="button" className="downloadButton" disabled={!downloadReady} onClick={onDownload}>
              Download
            </button>
          </div>

          <div className="mobileActions controlControls">
            <button type="button" className="secondary" onClick={onPickImage}>
              Change image
            </button>
            <button type="button" className="secondary" disabled={!hasInfo} onClick={() => setEditorOpen(true)}>
              Edit + add guests
            </button>
            <button type="button" className="secondary" disabled={!hasImage} onClick={() => setImageTweakOpen(true)}>
              Move/enlarge image
            </button>
            <button type="button" className="downloadButton" disabled={!downloadReady} onClick={onDownload}>
              Download
            </button>
          </div>

          <div className="hint controlControls desktopAdvanced">
            Select a show, upload artwork, generate, then use Edit + add guests for corrections.
          </div>
        </div>
      </section>

      {tracklistOpen && (
        <div className="drawerBackdrop" onClick={() => setTracklistOpen(false)}>
          <section className="editDrawer" aria-label="Add tracklist" onClick={(event) => event.stopPropagation()}>
            <div className="drawerHeader">
              <h2>Tracklist</h2>
              <button type="button" className="secondary" onClick={() => setTracklistOpen(false)}>
                Done
              </button>
            </div>
            <div className="editor">
              <div>
                <label htmlFor="tracklistInput">Tracks</label>
                <textarea
                  id="tracklistInput"
                  value={tracklist}
                  onChange={onTracklistChange}
                  placeholder="One track per line"
                  rows={10}
                />
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setTracklist('');
                  setDownloadReady(false);
                }}
              >
                Clear tracklist
              </button>
            </div>
          </section>
        </div>
      )}

      {editorOpen && (
        <div className="drawerBackdrop" onClick={() => setEditorOpen(false)}>
          <section className="editDrawer" aria-label="Edit show info" onClick={(event) => event.stopPropagation()}>
            <div className="drawerHeader">
              <h2>Edit + add guests</h2>
              <button type="button" className="secondary" onClick={() => setEditorOpen(false)}>
                Done
              </button>
            </div>
            <div className="editor">
              <div>
                <label htmlFor="titleInput">Show title</label>
                <input id="titleInput" value={info.title} onChange={updateInfo('title')} placeholder="Show title" />
              </div>
              <div>
                <label htmlFor="djInput">DJ / host</label>
                <input id="djInput" value={info.dj} onChange={updateInfo('dj')} placeholder="DJ / host" />
              </div>
              <div className="grid-2">
                <div>
                  <label htmlFor="dateInput">Date</label>
                  <input id="dateInput" type="date" value={info.date} onChange={updateInfo('date')} />
                </div>
                <div>
                  <label htmlFor="guestInput">Guest</label>
                  <input id="guestInput" value={info.guest} onChange={updateInfo('guest')} placeholder="Guest" />
                </div>
              </div>
              <div className="grid-2">
                <div>
                  <label htmlFor="startInput">Start</label>
                  <input id="startInput" type="time" value={info.start} onChange={updateInfo('start')} />
                </div>
                <div>
                  <label htmlFor="endInput">End</label>
                  <input id="endInput" type="time" value={info.end} onChange={updateInfo('end')} />
                </div>
              </div>
              <div className="grid-2">
                <div>
                  <label htmlFor="bpmMinInput">BPM from</label>
                  <input
                    id="bpmMinInput"
                    type="number"
                    min="0"
                    max="999"
                    inputMode="numeric"
                    value={info.bpmMin}
                    onChange={updateInfo('bpmMin')}
                    placeholder="120"
                  />
                </div>
                <div>
                  <label htmlFor="bpmMaxInput">BPM to</label>
                  <input
                    id="bpmMaxInput"
                    type="number"
                    min="0"
                    max="999"
                    inputMode="numeric"
                    value={info.bpmMax}
                    onChange={updateInfo('bpmMax')}
                    placeholder="130"
                  />
                </div>
              </div>
              <label className="toggleRow" htmlFor="drawerLogoToggle">
                <span>Mesh logo</span>
                <input
                  id="drawerLogoToggle"
                  type="checkbox"
                  checked={showLogo}
                  onChange={(event) => setShowLogo(event.target.checked)}
                />
              </label>
              <label className="toggleRow" htmlFor="drawerCleanToggle">
                <span>Clean view</span>
                <input
                  id="drawerCleanToggle"
                  type="checkbox"
                  checked={!showPills}
                  onChange={(event) => setShowPills(!event.target.checked)}
                />
              </label>
            </div>
          </section>
        </div>
      )}

      {imageTweakOpen && (
        <div className="drawerBackdrop" onClick={() => setImageTweakOpen(false)}>
          <section className="editDrawer imageTweakDrawer" aria-label="Move and enlarge artwork image" onClick={(event) => event.stopPropagation()}>
            <div className="drawerHeader">
              <h2>Move/enlarge image</h2>
              <button type="button" className="secondary" onClick={() => setImageTweakOpen(false)}>
                Done
              </button>
            </div>
            <div className="editor imageTweakEditor">
              <div className="nudgePad" aria-label="Move image">
                <button type="button" className="secondary" aria-label="Move image up" onClick={() => nudgeImage(0, -36)}>
                  ^
                </button>
                <button type="button" className="secondary" aria-label="Move image left" onClick={() => nudgeImage(-36, 0)}>
                  &lt;
                </button>
                <button type="button" className="secondary" aria-label="Move image right" onClick={() => nudgeImage(36, 0)}>
                  &gt;
                </button>
                <button type="button" className="secondary" aria-label="Move image down" onClick={() => nudgeImage(0, 36)}>
                  v
                </button>
              </div>
              <div>
                <label htmlFor="imageZoom">Zoom</label>
                <input
                  id="imageZoom"
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.01"
                  value={imageTweak.zoom}
                  onChange={(event) => updateImageTweak({ zoom: Number(event.target.value) })}
                />
              </div>
              <div className="imageTweakActions">
                <button type="button" className="secondary" onClick={() => updateImageTweak(defaultImageTweak)}>
                  Fit canvas
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={!canRender}
                  onClick={async () => {
                    await renderCurrentArtwork();
                    setImageTweakOpen(false);
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <section className="preview" aria-label="Artwork preview">
        <div className="canvasWrap">
          <canvas ref={canvasRef} width={FORMATS.square.width * EXPORT_SCALE} height={FORMATS.square.height * EXPORT_SCALE} />
          {!hasRendered && (
            <div className="previewEmpty">
              {!selectedShow ? (
                <button type="button" onClick={onPickShow} disabled={!shows.length}>
                  {previewPrompt}
                </button>
              ) : !hasImage ? (
                <button type="button" onClick={onPickImage}>
                  {previewPrompt}
                </button>
              ) : (
                <span>{previewPrompt}</span>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
