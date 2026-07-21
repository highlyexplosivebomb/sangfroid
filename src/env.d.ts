/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_TEAM_TABLE?: string;
  readonly VITE_SUPABASE_PLAYER_TABLE?: string;
  readonly VITE_GAME_CODE_1?: string;
  readonly VITE_GAME_CODE_2?: string;
  readonly VITE_GAME_CODE_3?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
