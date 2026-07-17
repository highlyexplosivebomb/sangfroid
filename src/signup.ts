export type PlayersPayload = {
  player_one: string;
  player_two: string;
  player_three: string;
};

export type SignupPayload = {
  game_id: number;
  email: string;
  name: string;
  players: PlayersPayload;
};

export type SignupStage = 1 | 2 | 3;

export function buildSignupPayload(formData: FormData, game_id: number): SignupPayload {
  const data = Object.fromEntries(formData.entries());

  const toTrimmedString = (value: unknown) =>
    typeof value === 'string' ? value.trim() : '';

  return {
    game_id,
    email: toTrimmedString(data.email),
    name: toTrimmedString(data.name),
    players: {
      player_one: toTrimmedString(data.playerOne),
      player_two: toTrimmedString(data.playerTwo),
      player_three: toTrimmedString(data.playerThree)
    }
  };
}

export function isStageComplete(stage: SignupStage, payload: SignupPayload, formData: FormData): boolean {
  switch (stage) {
    case 1:
      return payload.game_id > 0;
    case 2:
      return payload.email.length > 0 && payload.name.length > 0 && payload.players.player_one.length > 0;
    case 3:
      switch (Number(formData.get('extraTeammates'))) {
        case 1:
          return payload.players.player_two.length > 0;
        case 2:
          return payload.players.player_two.length > 0 && payload.players.player_three.length > 0;
        default:
          return true;
      }
  }
}