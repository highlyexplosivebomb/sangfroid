import { createClient } from '@supabase/supabase-js';
import type { SignupPayload } from './signup';

export type SupabaseConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseTeamTable: string;
  supabasePlayersTable: string;
};

export const sangfroidConfig: SupabaseConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  supabaseTeamTable: import.meta.env.VITE_SUPABASE_TEAM_TABLE ?? '',
  supabasePlayersTable: import.meta.env.VITE_SUPABASE_PLAYERS_TABLE ?? ''
};

export async function saveTeamSignup(
  payload: SignupPayload,
  config: SupabaseConfig
): Promise<void> {
  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

  const { data: playersData, error: playersError } = await supabase
    .from(config.supabasePlayersTable)
    .insert(payload.players)
    .select('id')
    .single();

  if (playersError) {
    throw new Error(playersError.message ?? 'Unable to save the players.');
  }

  const teamPayload = {
    game_id: payload.game_id,
    email: payload.email,
    name: payload.name,
    players_id: playersData.id,
  };

  const { error: teamError } = await supabase
    .from(config.supabaseTeamTable)
    .insert(teamPayload);

  if (teamError) {
    throw new Error(teamError.message ?? 'Unable to save the team.');
  }
}