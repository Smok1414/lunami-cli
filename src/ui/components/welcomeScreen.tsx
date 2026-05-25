import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Box, Text, useStdout, useInput} from 'ink';
import {checkForUpdates, getCliMetadata} from '../../update.js';
import {t} from '../../i18n.js';
import {prefersAsciiOutput} from '../../utils/terminal.js';

export const splashBackgroundColor = '#0d1f18';

const GREEN = '#3fffa8';
const GREEN_SOFT = '#6dffc4';
const GREEN_MUTED = '#2a6e4b';
const GREEN_GHOST = '#1a3d2c';

const STAR_CHARS = ['.', '·', '*', '+', '·'] as const;
const NOISE_CHARS = ['pd', '—', '·', '···', '——'] as const;

type Star = {
  id: number;
  x: number;
  y: number;
  opacity: number;
  duration: number;
  delay: number;
  char: string;
};

type Particle = {
  id: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
  char: string;
};

type Cell = {char: string; color: string; bold?: boolean};

type BrandLine = {text: string; color: string; bold?: boolean; isMoon?: boolean};

const MOON_UNICODE = [
  '         ▄████▄         ',
  '       ▄██▀  ▀██▄       ',
  '      ██▀      ▀██      ',
  '     ██          ██     ',
  '     ██          ██     ',
  '     ██          ██     ',
  '      ██▄      ▄██      ',
  '       ▀██▄  ▄██▀       ',
  '         ▀████▀         '
];

const MOON_ASCII = [
  '       .========.       ',
  '     .==        ==.     ',
  '    ==            ==    ',
  '   =                =   ',
  '   =                =   ',
  '   =                =   ',
  '    ==            ==    ',
  '     .==        ==.     ',
  '       .========.       '
];

function generateStars(count: number, columns: number, rows: number): Star[] {
  const safeRows = Math.max(8, rows - 3);
  const safeCols = Math.max(20, columns - 4);

  return Array.from({length: count}, (_, id) => ({
    id,
    x: 2 + Math.floor(Math.random() * safeCols),
    y: 1 + Math.floor(Math.random() * safeRows),
    opacity: Math.random() * 0.5 + 0.05,
    duration: Math.random() * 4 + 2,
    delay: Math.random() * 5,
    char: STAR_CHARS[Math.floor(Math.random() * STAR_CHARS.length)]!
  }));
}

function generateParticles(count: number, columns: number, rows: number): Particle[] {
  const safeRows = Math.max(8, rows - 3);
  const safeCols = Math.max(20, columns - 6);

  return Array.from({length: count}, (_, id) => ({
    id,
    x: 2 + Math.floor(Math.random() * safeCols),
    y: 1 + Math.floor(Math.random() * safeRows),
    duration: Math.random() * 7 + 4,
    delay: Math.random() * 7,
    char: NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)]!
  }));
}

function starColor(star: Star, frame: number): string {
  const phase = ((frame / 10 + star.delay) / star.duration) * Math.PI * 2;
  const wave = (Math.sin(phase) + 1) / 2;
  const opacity = 0.03 + wave * star.opacity;
  if (opacity < 0.12) return GREEN_GHOST;
  if (opacity < 0.28) return GREEN_MUTED;
  return GREEN;
}

function particleY(particle: Particle, frame: number, rows: number): number {
  const elapsed = (frame / 10 + particle.delay) % particle.duration;
  const ratio = elapsed / particle.duration;
  const drift = Math.floor(ratio * 8);
  const y = particle.y - drift;
  return ((y % rows) + rows) % rows;
}

function moonColor(frame: number): string {
  return (frame % 28) / 28 < 0.5 ? GREEN : GREEN_SOFT;
}

function moonArt(ascii: boolean): BrandLine[] {
  const lines = ascii ? MOON_ASCII : MOON_UNICODE;
  const center = (lines.length - 1) / 2;

  return lines.map((text, index) => {
    const dist = Math.abs(index - center) / Math.max(center, 1);
    let color = GREEN_MUTED;
    if (dist < 0.35) color = GREEN;
    else if (dist < 0.75) color = GREEN_SOFT;

    return {text, color, bold: dist < 0.9, isMoon: true};
  });
}

function brandLines(ascii: boolean): BrandLine[] {
  return [
    ...moonArt(ascii),
    {text: '', color: GREEN},
    {text: 'L  U  N  A  M  I', color: GREEN},
    {text: 'AI  TERMINAL  AGENT', color: GREEN_MUTED}
  ];
}

function paintCell(grid: Cell[][], x: number, y: number, cell: Cell): void {
  const row = grid[y];
  if (!row || x < 0 || x >= row.length) return;
  row[x] = cell;
}

function paintText(grid: Cell[][], x: number, y: number, line: BrandLine): void {
  for (let i = 0; i < line.text.length; i += 1) {
    paintCell(grid, x + i, y, {char: line.text[i]!, color: line.color, bold: line.bold});
  }
}

function buildFrame(
  columns: number,
  rows: number,
  frame: number,
  stars: Star[],
  particles: Particle[],
  brand: BrandLine[],
  brandStartY: number,
  fadeOut: boolean
): Cell[][] {
  const grid: Cell[][] = Array.from({length: rows}, () =>
    Array.from({length: columns}, () => ({char: ' ', color: GREEN_GHOST}))
  );

  for (const star of stars) {
    paintCell(grid, star.x, star.y, {
      char: star.char,
      color: fadeOut ? GREEN_GHOST : starColor(star, frame)
    });
  }

  for (const particle of particles) {
    const y = particleY(particle, frame, rows - 1);
    const text = particle.char;
    for (let i = 0; i < text.length; i += 1) {
      paintCell(grid, particle.x + i, y, {char: text[i]!, color: GREEN_GHOST});
    }
  }

  const moonTint = fadeOut ? GREEN_GHOST : moonColor(frame);
  for (let i = 0; i < brand.length; i += 1) {
    const line = brand[i]!;
    if (!line.text) continue;
    const x = Math.max(0, Math.floor((columns - line.text.length) / 2));
    const y = brandStartY + i;
    if (y < 0 || y >= rows) continue;
    const color = line.isMoon
      ? fadeOut
        ? GREEN_GHOST
        : line.color === GREEN
          ? moonTint
          : line.color
      : fadeOut
        ? GREEN_GHOST
        : line.color;

    paintText(grid, x, y, {...line, color});
  }

  return grid;
}

function rowToNodes(row: Cell[], y: number): React.ReactElement {
  const nodes: React.ReactNode[] = [];
  let run = '';
  let runColor = row[0]?.color ?? GREEN_GHOST;
  let runBold = row[0]?.bold ?? false;

  const flush = () => {
    if (!run) return;
    nodes.push(
      <Text key={`${y}-${nodes.length}`} color={runColor} bold={runBold}>
        {run}
      </Text>
    );
    run = '';
  };

  for (const cell of row) {
    if (cell.color === runColor && cell.bold === runBold) {
      run += cell.char;
    } else {
      flush();
      run = cell.char;
      runColor = cell.color;
      runBold = cell.bold ?? false;
    }
  }
  flush();

  return (
    <Box key={y}>
      {nodes}
    </Box>
  );
}

export function WelcomeScreen({onComplete}: {onComplete: () => void}): React.ReactElement {
  const {stdout} = useStdout();
  const [size, setSize] = useState({columns: stdout.columns ?? 80, rows: stdout.rows ?? 24});
  const [frame, setFrame] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const [updateHint, setUpdateHint] = useState<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  const fadingRef = useRef(false);
  const version = useMemo(() => getCliMetadata().version, []);
  const ascii = prefersAsciiOutput();
  const brand = useMemo(() => brandLines(ascii), [ascii]);

  onCompleteRef.current = onComplete;

  const dismiss = useCallback(() => {
    if (fadingRef.current) return;
    fadingRef.current = true;
    setFadeOut(true);
    setTimeout(() => onCompleteRef.current(), 500);
  }, []);

  useEffect(() => {
    const onResize = () => setSize({columns: stdout.columns ?? 80, rows: stdout.rows ?? 24});
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  useInput(dismiss);

  useEffect(() => {
    const timer = setInterval(() => setFrame((value) => value + 1), 100);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(dismiss, 8000);
    return () => clearTimeout(timer);
  }, [dismiss]);

  useEffect(() => {
    void checkForUpdates(1200).then((result) => {
      if (result?.updateAvailable) {
        setUpdateHint(t('welcome_update', result.latestVersion));
      }
    });
  }, []);

  const {columns, rows} = size;
  const stars = useMemo(() => generateStars(55, columns, rows), [columns, rows]);
  const particles = useMemo(() => generateParticles(24, columns, rows), [columns, rows]);

  const footerRows = updateHint ? 2 : 1;
  const canvasRows = Math.max(1, rows - footerRows);
  const brandStartY = Math.max(0, Math.floor((canvasRows - brand.length) / 2));
  const versionLabel = t('welcome_version', version);
  const skipLabel = t('welcome_skip');
  const showHint = Math.floor(frame / 7) % 2 === 0;

  const grid = buildFrame(
    columns,
    canvasRows,
    frame,
    stars,
    particles,
    brand,
    brandStartY,
    fadeOut
  );

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      {grid.map((row, y) => rowToNodes(row, y))}
      <Box width={columns} flexDirection="row">
        <Text color={GREEN_MUTED}>{versionLabel}</Text>
        <Box flexGrow={1} />
        {showHint ? <Text color={GREEN_MUTED}>{skipLabel}</Text> : <Text> </Text>}
      </Box>
      {updateHint ? (
        <Text color={GREEN_MUTED} wrap="truncate">
          {updateHint}
        </Text>
      ) : null}
    </Box>
  );
}

export function shouldShowWelcome(): boolean {
  if (process.env.LUNAMI_SKIP_SPLASH === '1') {
    return false;
  }

  return process.stdout.isTTY;
}
