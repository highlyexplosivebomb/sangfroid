import { createClient } from '@supabase/supabase-js';
import type { CreateTeamPayload, JoinTeamPayload } from '../landing/signup';
import type { GameState, Team, Submission, ChallengeMessage } from './store';

export const TEAM_TABLE = import.meta.env.VITE_SUPABASE_TEAM_TABLE ?? '';
export const PLAYER_TABLE = import.meta.env.VITE_SUPABASE_PLAYER_TABLE ?? '';
export const GAME_TABLE = import.meta.env.VITE_SUPABASE_GAME_TABLE ?? '';
export const ANNOUNCEMENT_TABLE = import.meta.env.VITE_SUPABASE_ANNOUNCEMENT_TABLE ?? '';
export const SUBMISSION_TABLE = import.meta.env.VITE_SUPABASE_SUBMISSION_TABLE ?? '';
export const CHALLENGES_TABLE = import.meta.env.VITE_SUPABASE_CHALLENGE_TABLE ?? '';
export const CHALLENGE_MESSAGES_TABLE = import.meta.env.VITE_SUPABASE_CHALLENGE_CHAT_TABLE ?? 'challenge_messages';

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

export async function getTeamByTag(tag: string): Promise<Team | undefined> {
  const { data, error } = await supabase
    .from(TEAM_TABLE)
    .select('id, game_id, name, tag, pin, timestamp:created_at')
    .eq('tag', tag)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? 'Unable to look up the team tag.');
  }

  return data ?? undefined;
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

export async function fetchTeams(gameId: number): Promise<Team[]> {
  const { data, error } = await supabase
    .from(TEAM_TABLE)
    .select('id, game_id, name, tag, pin, timestamp:created_at')
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
      skip_pregame: state.skipPregame,
      skip_final_challenge: state.skipFinalChallenge,
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
    .select('id, game_id, challenge_id, team_id, status, created_at, guest_team_ids, host_team_id')
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

export async function insertSubmission(gameId: number, sub: Omit<Submission, 'id'>): Promise<number | null> {
  const { data, error } = await supabase
    .from(SUBMISSION_TABLE)
    .insert({
      game_id: gameId,
      challenge_id: sub.challengeId,
      team_id: sub.teamId,
      value: sub.value,
      status: sub.status === 'pending' ? '' : sub.status,
      created_at: sub.timestamp ? new Date(sub.timestamp).toISOString() : new Date().toISOString(),
      guest_team_ids: sub.guestTeamIds || null,
      host_team_id: sub.hostTeamId || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error inserting submission:', error);
    return null;
  }
  return data.id;
}

export async function deleteSubmission(id: number): Promise<void> {
  await supabase
    .from(CHALLENGE_MESSAGES_TABLE)
    .delete()
    .eq('submission_id', id);

  const { error } = await supabase
    .from(SUBMISSION_TABLE)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting submission:', error);
  }
}

export async function updateChallengeMatchmakingLimit(id: number, type: string, limit: number): Promise<void> {
  await supabase
    .from(CHALLENGES_TABLE)
    .update({ matchmaking_limit_type: type, matchmaking_limit: limit })
    .eq('id', id);
}

export async function fetchChallengeMessages(submissionId: number): Promise<ChallengeMessage[]> {
  const { data, error } = await supabase
    .from(CHALLENGE_MESSAGES_TABLE)
    .select('*')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching challenge messages:', error);
    return [];
  }
  return (data ?? []).map((row: any) => ({
    id: row.id,
    challengeId: row.challenge_id,
    submissionId: row.submission_id,
    teamId: row.team_id,
    message: row.message,
    timestamp: row.created_at ? new Date(row.created_at).getTime() : 0
  }));
}

export async function fetchMultipleChallengeMessages(submissionIds: number[]): Promise<ChallengeMessage[]> {
  if (submissionIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from(CHALLENGE_MESSAGES_TABLE)
    .select('*')
    .in('submission_id', submissionIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching multiple challenge messages:', error);
    return [];
  }
  return (data ?? []).map((row: any) => ({
    id: row.id,
    challengeId: row.challenge_id,
    submissionId: row.submission_id,
    teamId: row.team_id,
    message: row.message,
    timestamp: row.created_at ? new Date(row.created_at).getTime() : 0
  }));
}

export async function insertChallengeMessage(challengeId: number, submissionId: number, teamId: number, message: string): Promise<number | null> {
  const { data, error } = await supabase
    .from(CHALLENGE_MESSAGES_TABLE)
    .insert({ challenge_id: challengeId, submission_id: submissionId, team_id: teamId, message })
    .select('id')
    .single();

  if (error) {
    console.error('Error inserting challenge message:', error);
    return null;
  }
  return data?.id ?? null;
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

export async function updateSubmissionValueAndStatus(id: number, value: string, status: string): Promise<void> {
  const { error } = await supabase
    .from(SUBMISSION_TABLE)
    .update({ 
      value,
      status: status === 'pending' ? '' : status 
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating submission:', error);
  }
}

export async function updateSubmissionGuestTeamIds(id: number, guestTeamIds: number[]): Promise<void> {
  const { error } = await supabase
    .from(SUBMISSION_TABLE)
    .update({ guest_team_ids: guestTeamIds })
    .eq('id', id);

  if (error) {
    console.error('Error updating guest_team_ids:', error);
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