export type SignupStage = 1 | 2 | 3 | 4;
export type SignupType = 'create' | 'join';

export type PlayerPayload = {
  player_name: string;
  availability: string[];
  comments: string;
};

export type CreateTeamPayload = {
  signupType: 'create';
  game_id: number;
  email: string;
  name: string;
  team_tag: string;
  team_leader: PlayerPayload;
};

export type JoinTeamPayload = {
  signupType: 'join';
  team_id: number;
} & PlayerPayload;

export type SignupPayload = CreateTeamPayload | JoinTeamPayload;

export async function generateTeamTag(teamName: string, isTagTaken: (tag: string) => Promise<boolean>): Promise<string> {
  const words = teamName.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(Boolean);
  
  let baseTag = "";
  if (words.length >= 3) {
    baseTag = words[0][0] + words[1][0] + words[2][0];
  } else if (words.length === 2) {
    baseTag = words[0].slice(0, 2) + words[1][0];
  } else if (words.length === 1) {
    baseTag = words[0].slice(0, 3);
  }

  if (baseTag.length === 3) {
    if (!(await isTagTaken(baseTag))) {
      return baseTag;
    }
  }

  const prefix1 = baseTag.slice(0, 2);
  for (let i = 0; i <= 9; i++) {
    const candidate = `${prefix1}${i}`;
    if (!(await isTagTaken(candidate))) {
      return candidate;
    }
  }

  const prefix2 = baseTag.slice(0, 1);
  for (let i = 10; i <= 99; i++) {
    const candidate = `${prefix2}${i}`;
    if (!(await isTagTaken(candidate))) {
      return candidate;
    }
  }

  throw new Error('All tag combinations are exhausted.');
}

function getField(form: HTMLFormElement, name: string): string {
  const el = form.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
  return (el?.value ?? '').trim();
}

export function getCheckedValues(form: HTMLFormElement, inputName: string): string[] {
  const els = form.querySelectorAll(`input[name="${inputName}"]:checked`);
  return Array.from(els).map((el) => (el as HTMLInputElement).value);
}

function buildPlayerPayload(form: HTMLFormElement, prefix = ''): PlayerPayload {
  return {
    player_name: getField(form, `${prefix}playerName`),
    availability: getCheckedValues(form, `${prefix}availability`),
    comments: getField(form, `${prefix}comments`),
  };
}

export async function buildCreatePayload(form: HTMLFormElement, gameId: number, isTagTaken: (tag: string) => Promise<boolean>): Promise<CreateTeamPayload> {
  const teamName = getField(form, 'teamName');

  return {
    signupType: 'create',
    game_id: gameId,
    email: getField(form, 'email'),
    name: teamName,
    team_tag: await generateTeamTag(teamName, isTagTaken),
    team_leader: buildPlayerPayload(form),
  };
}

export function buildJoinPayload(form: HTMLFormElement, teamId: number): JoinTeamPayload {
  return {
    signupType: 'join',
    team_id: teamId,
    ...buildPlayerPayload(form, 'join'),
  };
}