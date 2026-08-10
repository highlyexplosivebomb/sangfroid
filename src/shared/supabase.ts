import { createClient } from '@supabase/supabase-js';
import type { CreateTeamPayload, JoinTeamPayload } from '../landing/signup';
import type { GameState } from './store';

export const TEAM_TABLE = import.meta.env.VITE_SUPABASE_TEAM_TABLE ?? '';
export const PLAYER_TABLE = import.meta.env.VITE_SUPABASE_PLAYER_TABLE ?? '';
export const GAME_TABLE = import.meta.env.VITE_SUPABASE_GAME_TABLE ?? '';
export const ANNOUNCEMENT_TABLE = import.meta.env.VITE_SUPABASE_ANNOUNCEMENT_TABLE ?? '';
export const SUBMISSION_TABLE = import.meta.env.VITE_SUPABASE_SUBMISSION_TABLE ?? '';
export const CHALLENGES_TABLE = import.meta.env.VITE_SUPABASE_CHALLENGE_TABLE ?? '';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
);

export async function getTeamMemberCount(teamId: number): Promise<number> {
  const { count, error } = await supabase
    .from(PLAYER_TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId);

  if (error) {
    throw new Error(error.message ?? 'Unable to count team members.');
  }

  return count ?? 0;
}

export async function fetchTeamPlayers(teamId: number): Promise<{ name: string; is_leader: boolean }[]> {
  const { data, error } = await supabase
    .from(PLAYER_TABLE)
    .select('name, is_leader')
    .eq('team_id', teamId);

  if (error) {
    console.error('Error fetching team players:', error);
    return [];
  }
  return data ?? [];
}

export async function getTeamByTag(tag: string): Promise<{ id: number; game_id: number; name: string; pin: string } | undefined> {
  const { data, error } = await supabase
    .from(TEAM_TABLE)
    .select('id, game_id, name, pin')
    .eq('tag', tag)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? 'Unable to look up the team tag.');
  }

  return data
    ? { id: data.id as number, game_id: data.game_id as number, name: data.name as string, pin: data.pin as string }
    : undefined;
}

export async function fetchGames(): Promise<{ id: number }[]> {
  const { data, error } = await supabase
    .from(GAME_TABLE)
    .select('id')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching games:', error);
    return [];
  }
  return data ?? [];
}

export async function fetchTeams(gameId: number): Promise<{ id: number; tag: string; name: string }[]> {
  const { data, error } = await supabase
    .from(TEAM_TABLE)
    .select('id, tag, name')
    .eq('game_id', gameId);

  if (error) {
    console.error('Error fetching teams:', error);
    return [];
  }
  return data ?? [];
}

export async function saveTeamCreate(payload: CreateTeamPayload): Promise<void> {
  const { data: team, error: teamError } = await supabase
    .from(TEAM_TABLE)
    .insert({
      game_id: payload.game_id,
      name: payload.name,
      tag: payload.team_tag,
      pin: payload.pin,
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
      is_leader: true,
    });

  if (playerError) {
    throw new Error(playerError.message ?? 'Unable to save the team member.');
  }
}

export async function saveTeamJoin(payload: JoinTeamPayload): Promise<void> {
  const memberCount = await getTeamMemberCount(payload.team_id);
  if (memberCount >= 3) {
    throw new Error('This team is already full (max 3 members).');
  }

  const { error } = await supabase.from(PLAYER_TABLE).insert({
    team_id: payload.team_id,
    name: payload.player_name,
    is_leader: false,
  });

  if (error) {
    throw new Error(error.message ?? 'Unable to join the team.');
  }
}

export async function fetchGameState(gameId: number) {
  const { data, error } = await supabase
    .from(GAME_TABLE)
    .select('*')
    .eq('id', gameId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching game state:', error);
  }
  return data;
}

export async function updateGameState(gameId: number, state: GameState): Promise<void> {
  const { error } = await supabase
    .from(GAME_TABLE)
    .upsert({
      id: gameId,
      status: state.status === 'stopped' ? '' : state.status,
      duration: state.duration,
      time_remaining: state.timeRemainingSeconds,
      last_tick_timestamp: state.lastTickTimestamp ? new Date(state.lastTickTimestamp).toISOString() : null,
    });
  if (error) {
    console.error('Error updating game state:', error);
  }
}

export async function fetchAnnouncements(gameId: number) {
  const { data, error } = await supabase
    .from(ANNOUNCEMENT_TABLE)
    .select('*')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching announcements:', error);
  }
  return data ?? [];
}

export async function insertAnnouncement(gameId: number, message: string): Promise<number | null> {
  const { data, error } = await supabase
    .from(ANNOUNCEMENT_TABLE)
    .insert({
      game_id: gameId,
      message,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error inserting announcement:', error);
    return null;
  }
  return data.id;
}

interface SubmissionInsert {
  gameId: number;
  challengeId: number;
  teamId: number;
  value: string;
  status: string;
  timestamp: number;
}

export async function fetchSubmissions(gameId: number, asAdmin: boolean, teamId?: number) {
  if (asAdmin) {
    const { data, error } = await supabase
      .from(SUBMISSION_TABLE)
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching admin submissions:', error);
    }
    return data ?? [];
  }

  const { data: lightData, error: lightError } = await supabase
    .from(SUBMISSION_TABLE)
    .select('id, game_id, challenge_id, team_id, status, created_at')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true });

  if (lightError) {
    console.error('Error fetching lightweight submissions:', lightError);
    return [];
  }

  const fullMap = new Map<number, string>();
  if (teamId) {
    const { data: fullData, error: fullError } = await supabase
      .from(SUBMISSION_TABLE)
      .select('id, value')
      .eq('game_id', gameId)
      .eq('team_id', teamId);

    if (fullError) {
      console.error('Error fetching full submissions:', fullError);
    } else if (fullData) {
      fullData.forEach((row: any) => fullMap.set(row.id, row.value));
    }
  }

  return (lightData ?? []).map((row: any) => ({
    ...row,
    value: fullMap.get(row.id) || null
  }));
}

export async function insertSubmission(sub: SubmissionInsert): Promise<number | null> {
  const { data, error } = await supabase
    .from(SUBMISSION_TABLE)
    .insert({
      game_id: sub.gameId,
      challenge_id: sub.challengeId,
      team_id: sub.teamId,
      value: sub.value,
      status: sub.status === 'pending' ? '' : sub.status,
      created_at: sub.timestamp ? new Date(sub.timestamp).toISOString() : new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error inserting submission:', error);
    return null;
  }
  return data.id;
}

export async function updateSubmissionStatus(id: number, status: string): Promise<void> {
  const { error } = await supabase
    .from(SUBMISSION_TABLE)
    .update({ status: status === 'pending' ? '' : status })
    .eq('id', id);

  if (error) {
    console.error('Error updating submission:', error);
  }
}

export async function fetchChallenges() {
  const { data, error } = await supabase
    .from(CHALLENGES_TABLE)
    .select('*')
    .order('points', { ascending: true });

  if (error) {
    console.error('Error fetching challenges:', error);
  }
  return data ?? [];
}

export async function dismissAnnouncementDb(announcementId: number, teamTag: string): Promise<void> {
  const { data, error: fetchErr } = await supabase
    .from(ANNOUNCEMENT_TABLE)
    .select('dismissed_by')
    .eq('id', announcementId)
    .single();

  if (fetchErr || !data) {
    console.error('Error fetching announcement for dismissal:', fetchErr);
    return;
  }

  const current = data.dismissed_by || [];
  if (!current.includes(teamTag)) {
    const updated = [...current, teamTag];
    const { error: updateErr } = await supabase
      .from(ANNOUNCEMENT_TABLE)
      .update({ dismissed_by: updated })
      .eq('id', announcementId);

    if (updateErr) {
      console.error('Error updating announcement dismissal:', updateErr);
    }
  }
}

export async function uploadPhoto(file: Blob, teamTag: string): Promise<string | null> {
  const fileName = `${teamTag}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.jpg`;

  const { error } = await supabase.storage
    .from('photos')
    .upload(fileName, file, {
      contentType: 'image/jpeg'
    });

  if (error) {
    console.error('Error uploading photo:', error);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('photos')
    .getPublicUrl(fileName);

  return publicUrl;
}