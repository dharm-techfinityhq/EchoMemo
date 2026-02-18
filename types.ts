
export interface AudioEntry {
  id: string;
  url: string;
  transcript?: string;
  summary?: string;
  createdAt: number;
}

export interface Memo {
  id: string;
  title: string;
  content: string;
  audioEntries: AudioEntry[];
  createdAt: number;
  tags: string[];
  isFavorite: boolean;
}

export enum AppView {
  LIST = 'list',
  DETAIL = 'detail',
  SETTINGS = 'settings'
}

export interface GeminiProcessingResult {
  title: string;
  summary: string;
  transcript: string;
  tags: string[];
  content?: string;
}

export interface AppTheme {
  id: string;
  name: string;
  bg: string;
  surface: string;
  primary: string;
  secondary: string;
  accent: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  visualizerColor: string;
}
