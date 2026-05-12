'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FORMATS, renderArtwork } from '../lib/renderArtwork';

const SHOWS_URL = 'https://script.google.com/macros/s/AKfycbw3QgJtZXB48I0BUMpTE5Dlo2kqMReNuD4jbiEVBaB1z49bSgzEkAgixkjHxwTKRwY0/exec';

const emptyInfo = {
  title: '',
  dj: '',
  date: '',
  start: '',
  end: '',
  guest: ''
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

function showToInfo(show) {
  const times = splitTimeRange(show?.['A-B']);
  return {
    title: show?.['Now Playing'] || '',
    dj: show?.DJ || '',
    date: toDateInputValue(show?.Date),
    start: times.start,
    end: times.end,
    guest: ''
  };
}

function formatShowOption(show) {
  const date = new Date(show?.Date);
  const label = Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  return `${label} — ${show?.['Now Playing'] || 'Untitled show'}`;
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

export default function ArtGenerator() {
  const canvasRef = useRef(null);
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
  const [downloadReady, setDownloadReady] = useState(false);
  const [loadingShows, setLoadingShows] = useState(true);
  const [imageName, setImageName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [showPills, setShowPills] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [logoReady, setLogoReady] = useState(false);

  const hasInfo = Boolean(info.title.trim());
  const canRender = hasImage && hasInfo;

  useEffect(() => {
    let cancelled = false;
    const logo = new Image();
    logo.onload = () => {
      if (!cancelled) {
        logoRef.current = logo;
        setLogoReady(true);
      }
    };
    logo.src = '/logo-white.svg';

    fetch(SHOWS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Show fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setShows(Array.isArray(data) ? data : []);
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
      showLogo
    });
    setHasRendered(true);
    setDownloadReady(true);
    return true;
  }, [canRender, format, info, logoReady, showLogo, showPills]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const currentFormat = FORMATS[format] || FORMATS.square;
    if (canvas && (canvas.width !== currentFormat.width || canvas.height !== currentFormat.height)) {
      canvas.width = currentFormat.width;
      canvas.height = currentFormat.height;
    }
    setDownloadReady(false);
  }, [format, info, showPills, showLogo]);

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

  const onImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imageRef.current?.close) imageRef.current.close();
    setHasImage(false);
    setUploadError('');
    setImageName(file.name);
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
    fileInputRef.current?.click();
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
  const mobileStep = selectedShow ? (hasImage ? 'controls' : 'image') : 'show';
  const previewPrompt = selectedShow ? (hasImage ? 'Rendering preview' : 'Pick artwork') : 'Pick your show';

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
            <select id="showPicker" value={selectedShow} onChange={onShowChange} disabled={!shows.length}>
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
            <label htmlFor="uploadInput">Artwork image</label>
            <button type="button" className="primary" disabled={!selectedShow} onClick={onPickImage}>
              {hasImage ? 'Change image' : 'Pick artwork'}
            </button>
            {imageName && <div className="fieldNote">{imageName}</div>}
            {uploadError && <div className="fieldError">{uploadError}</div>}
          </div>

          {hasRendered && (
            <button
              type="button"
              className="secondary controlControls desktopAdvanced"
              aria-expanded={editorOpen}
              onClick={() => setEditorOpen(true)}
            >
              Edit info
            </button>
          )}

          <div className="actions controlControls desktopActions">
            <button type="button" className="primary" disabled={!canRender} onClick={onRender}>
              Render
            </button>
            <button type="button" className="secondary" disabled={!downloadReady} onClick={onDownload}>
              Download
            </button>
          </div>

          <div className="mobileActions controlControls">
            <button type="button" className="secondary" onClick={onPickImage}>
              Change image
            </button>
            <button type="button" className="secondary" disabled={!hasInfo} onClick={() => setEditorOpen(true)}>
              Edit
            </button>
            <button type="button" className="primary" disabled={!downloadReady} onClick={onDownload}>
              Download
            </button>
          </div>

          <div className="hint controlControls desktopAdvanced">
            Select a show, upload artwork, generate, then use Edit info for corrections.
          </div>
        </div>
      </section>

      {editorOpen && (
        <div className="drawerBackdrop" onClick={() => setEditorOpen(false)}>
          <section className="editDrawer" aria-label="Edit show info" onClick={(event) => event.stopPropagation()}>
            <div className="drawerHeader">
              <h2>Edit info</h2>
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

      <section className="preview" aria-label="Artwork preview">
        <div className="canvasWrap">
          <canvas ref={canvasRef} width={FORMATS.square.width} height={FORMATS.square.height} />
          {!hasRendered && (
            <div className="previewEmpty">
              <span>{previewPrompt}</span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
