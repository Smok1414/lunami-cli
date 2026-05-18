import type {AgentMode} from '../state.js';

export type ThemeName = 'midnight' | 'birch' | 'aurora' | 'ember';

export type ThemeTokens = {
  background: string;
  border: string;
  borderFlash: string;
  inputBorder: string;
  title: string;
  muted: string;
  accent: string;
  planAccent: string;
  autoAccent: string;
  yoloAccent: string;
  user: string;
  userBorder: string;
  assistant: string;
  tool: string;
  toolAdd: string;
  toolRemove: string;
  error: string;
  errorBorder: string;
  progressFill: string;
  progressEmpty: string;
  code: string;
  codeBorder: string;
  paletteSelected: string;
  paletteCmd: string;
  paletteDesc: string;
  modalTitle: string;
  modalDim: string;
  ctxOn: string;
  ctxOff: string;
};

export const themeOrder: ThemeName[] = ['midnight', 'birch', 'aurora', 'ember'];

export const themes: Record<ThemeName, ThemeTokens> = {
  midnight: {
    background: '#0a1018',
    border: '#0f2a44',
    borderFlash: '#3d8fd4',
    inputBorder: '#172d45',
    title: '#f3ead7',
    muted: '#647181',
    accent: '#a3d9a5',
    planAccent: '#e8c468',
    autoAccent: '#a3d9a5',
    yoloAccent: '#fb923c',
    user: '#ffffff',
    userBorder: '#2a4a66',
    assistant: '#8fa9c7',
    tool: '#f3ead7',
    toolAdd: '#4ade80',
    toolRemove: '#f87171',
    error: '#f6b5a7',
    errorBorder: '#c45c4a',
    progressFill: '#f3ead7',
    progressEmpty: '#4d5b68',
    code: '#c6d0dc',
    codeBorder: '#1e3a52',
    paletteSelected: '#f3ead7',
    paletteCmd: '#6b9e6b',
    paletteDesc: '#647181',
    modalTitle: '#f3ead7',
    modalDim: '#4a5568',
    ctxOn: '#a3d9a5',
    ctxOff: '#647181'
  },
  birch: {
    background: '#14110e',
    border: '#3a3327',
    borderFlash: '#c9a227',
    inputBorder: '#4a4132',
    title: '#f3ead7',
    muted: '#8c8172',
    accent: '#8fbc8f',
    planAccent: '#d4a574',
    autoAccent: '#8fbc8f',
    yoloAccent: '#e07a6a',
    user: '#fff8ef',
    userBorder: '#5a5040',
    assistant: '#c6d0dc',
    tool: '#f3ead7',
    toolAdd: '#6bcf7f',
    toolRemove: '#e07a6a',
    error: '#e8a090',
    errorBorder: '#a85a48',
    progressFill: '#f3ead7',
    progressEmpty: '#5f574a',
    code: '#d8e0e8',
    codeBorder: '#4a4132',
    paletteSelected: '#fff8ef',
    paletteCmd: '#7a9e6a',
    paletteDesc: '#8c8172',
    modalTitle: '#fff8ef',
    modalDim: '#6b6358',
    ctxOn: '#8fbc8f',
    ctxOff: '#8c8172'
  },
  aurora: {
    background: '#081418',
    border: '#1e3a4a',
    borderFlash: '#5eead4',
    inputBorder: '#2a4f5c',
    title: '#e8f4f8',
    muted: '#6b8a94',
    accent: '#5eead4',
    planAccent: '#c4b5fd',
    autoAccent: '#5eead4',
    yoloAccent: '#fb7185',
    user: '#f0fdfa',
    userBorder: '#2d6a7a',
    assistant: '#99f6e4',
    tool: '#e8f4f8',
    toolAdd: '#34d399',
    toolRemove: '#fb7185',
    error: '#fda4af',
    errorBorder: '#e11d48',
    progressFill: '#5eead4',
    progressEmpty: '#2a4f5c',
    code: '#a5f3fc',
    codeBorder: '#164e63',
    paletteSelected: '#f0fdfa',
    paletteCmd: '#2dd4bf',
    paletteDesc: '#6b8a94',
    modalTitle: '#e8f4f8',
    modalDim: '#3d5a66',
    ctxOn: '#5eead4',
    ctxOff: '#6b8a94'
  },
  ember: {
    background: '#120c08',
    border: '#4a2c1a',
    borderFlash: '#fb923c',
    inputBorder: '#5c3a24',
    title: '#fff7ed',
    muted: '#a68a72',
    accent: '#fb923c',
    planAccent: '#fbbf24',
    autoAccent: '#fb923c',
    yoloAccent: '#f87171',
    user: '#fff7ed',
    userBorder: '#7c4a2a',
    assistant: '#fdba74',
    tool: '#fff7ed',
    toolAdd: '#86efac',
    toolRemove: '#fca5a5',
    error: '#fecaca',
    errorBorder: '#dc2626',
    progressFill: '#fb923c',
    progressEmpty: '#5c3a24',
    code: '#fed7aa',
    codeBorder: '#5c3a24',
    paletteSelected: '#fff7ed',
    paletteCmd: '#ea580c',
    paletteDesc: '#a68a72',
    modalTitle: '#fff7ed',
    modalDim: '#6b4a32',
    ctxOn: '#fb923c',
    ctxOff: '#a68a72'
  }
};

export function getTheme(name: ThemeName): ThemeTokens {
  return themes[name] ?? themes.midnight;
}

export function nextThemeName(current: ThemeName): ThemeName {
  const index = themeOrder.indexOf(current);
  const next = index === -1 ? 0 : (index + 1) % themeOrder.length;
  return themeOrder[next]!;
}

export function resolveThemeName(value: unknown): ThemeName {
  if (typeof value === 'string' && value in themes) {
    return value as ThemeName;
  }
  return 'midnight';
}

export function modeAccent(theme: ThemeTokens, mode: AgentMode): string {
  if (mode === 'plan') {
    return theme.planAccent;
  }

  if (mode === 'yolo') {
    return theme.yoloAccent;
  }

  return theme.autoAccent;
}

export function noColorMode(): boolean {
  return process.env.NO_COLOR !== undefined || process.env.LUNAMI_NO_COLOR === '1';
}
