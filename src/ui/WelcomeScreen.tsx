import React, {useEffect, useMemo, useState} from 'react';
import {Box, Text, useStdout, useInput} from 'ink';
import {checkForUpdates, getCliMetadata} from '../update.js';
import {t} from '../i18n.js';

const MOON_ART = [
  '       _..._       ',
  '     .::\'   `.     ',
  '    :::       :    ',
  '    :::       :    ',
  '    `::.     .\'    ',
  '      `\'... \'      ',
  '                   ',
  '   L U N A M I     '
];

function buildWindRow(columns: number, seed: number): string {
  let line = '';
  for (let x = 0; x < columns + 40; x += 1) {
    const rand = Math.sin(seed * 12.9898 + x * 78.233) * 43758.5453;
    const value = rand - Math.floor(rand);
    if (value > 0.98) line += '~';
    else if (value > 0.96) line += '-';
    else if (value > 0.94) line += '·';
    else line += ' ';
  }
  return line;
}

export function WelcomeScreen({onComplete}: {onComplete: () => void}): React.ReactElement {
  const {stdout} = useStdout();
  const [dimensions, setDimensions] = useState({
    columns: stdout.columns ?? 80,
    rows: stdout.rows ?? 24
  });
  const [frame, setFrame] = useState(0);
  const [updateHint, setUpdateHint] = useState<string | null>(null);
  const version = useMemo(() => getCliMetadata().version, []);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        columns: stdout.columns ?? 80,
        rows: stdout.rows ?? 24
      });
    };
    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  useInput(() => {
    onComplete();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => f + 1);
    }, 80);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  useEffect(() => {
    void checkForUpdates(1200).then((result) => {
      if (result?.updateAvailable) {
        setUpdateHint(t('welcome_update', result.latestVersion));
      }
    });
  }, []);

  const columns = dimensions.columns;
  const rows = dimensions.rows;
  const offset = (frame * 2) % 120;
  const moonWidth = MOON_ART[0]!.length;
  const moonHeight = MOON_ART.length;
  const startX = Math.max(0, Math.floor(columns / 2 - moonWidth / 2));
  const startY = Math.max(0, Math.floor(rows / 2 - moonHeight / 2 - 2));
  const footerStart = Math.max(0, rows - 3);

  const displayLines = Array.from({length: rows}).map((_, y) => {
    if (y >= footerStart) {
      return null;
    }
    const windRow = buildWindRow(columns, y + frame);
    const line = windRow.slice(offset, offset + columns).padEnd(columns, ' ');

    if (y >= startY && y < startY + moonHeight) {
      const moonLine = MOON_ART[y - startY]!;
      const leftWind = line.slice(0, startX);
      const rightWind = line.slice(startX + moonWidth);

      return (
        <Box key={y}>
          <Text color="#4a5568">{leftWind}</Text>
          <Text color={y === startY + moonHeight - 1 ? '#a3d9a5' : '#fefcd7'} bold>
            {moonLine}
          </Text>
          <Text color="#4a5568">{rightWind}</Text>
        </Box>
      );
    }

    return (
      <Box key={y}>
        <Text color="#4a5568">{line}</Text>
      </Box>
    );
  });

  return (
    <Box flexDirection="column" width={columns} height={rows} overflow="hidden">
      {displayLines.filter((line) => line !== null)}
      <Box flexGrow={1} />
      <Text color="#8fa9c7">{t('welcome_version', version)}</Text>
      {updateHint ? <Text color="#a3d9a5">{updateHint}</Text> : null}
      <Text color="#647181">{t('welcome_skip')}</Text>
    </Box>
  );
}

export function shouldShowWelcome(): boolean {
  if (process.env.LUNAMI_SKIP_SPLASH === '1') {
    return false;
  }

  return process.stdout.isTTY;
}
