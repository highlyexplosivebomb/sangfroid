import { createClient } from '@supabase/supabase-js';
import type { CreateTeamPayload, JoinTeamPayload } from './signup';

const TEAM_TABLE = import.meta.env.VITE_SUPABASE_TEAM_TABLE ?? '';
const PLAYER_TABLE = import.meta.env.VITE_SUPABASE_PLAYER_TABLE ?? '';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
);

export async function getTeamByTag(tag: string): Promise<number | undefined> {
  const { data, error } = await supabase
    .from(TEAM_TABLE)
    .select('id')
    .eq('tag', tag)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? 'Unable to look up the team tag.');
  }

  return data ? (data.id as number) : undefined;
}

export async function saveTeamCreate(payload: CreateTeamPayload): Promise<void> {
  const { data: team, error: teamError } = await supabase
    .from(TEAM_TABLE)
    .insert({
      game_id: payload.game_id,
      name: payload.name,
      tag: payload.team_tag,
      email: payload.email,
    })
    .select('id')
    .single();

  if (teamError) {
    throw new Error(teamError.message ?? 'Unable to save the team.');
  }

  const { error: playerError } = await supabase
    .from(PLAYER_TABLE)
    .insert({
      team_id: team.id,
      name: payload.team_leader.player_name,
      availability: payload.team_leader.availability,
      is_leader: true,
      comments: payload.team_leader.comments,
    });

  if (playerError) {
    throw new Error(playerError.message ?? 'Unable to save the team member.');
  }
}

export async function saveTeamJoin(payload: JoinTeamPayload): Promise<void> {
  const { error } = await supabase.from(PLAYER_TABLE).insert({
    team_id: payload.team_id,
    name: payload.player_name,
    availability: payload.availability,
    is_leader: false,
    comments: payload.comments,
  });

  if (error) {
    throw new Error(error.message ?? 'Unable to join the team.');
  }
}