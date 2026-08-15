import './styles/base.css';
import './styles/landing.css';
import './styles/signup.css';
import './styles/game.css';
import './styles/admin.css';

import { registerView, navigateTo, getViewFromPath, SangfroidView } from './shared/router';
import { registerRenderer } from './player-portal/challenges';
import { renderAnswerChallenge } from './player-portal/renderers/answerChallenge';
import { renderPhotoChallenge } from './player-portal/renderers/photoChallenge';
import { renderUniqueChallenge1 } from './player-portal/renderers/uniqueChallenge1';
import { renderUniqueChallenge2 } from './player-portal/renderers/uniqueChallenge2';
import { renderUniqueChallenge4 } from './player-portal/renderers/uniqueChallenge4';
import { mountGame, unmountGame } from './player-portal/game';
import { mountAdmin, unmountAdmin } from './admin-portal/admin';
import { initMap, mountLanding, unmountLanding } from './landing/landing';
import { getRequiredElement } from './shared/dom';

import { ChallengeType } from './shared/store';

registerRenderer(ChallengeType.Answer, renderAnswerChallenge);
registerRenderer(ChallengeType.Photo, renderPhotoChallenge);
registerRenderer(ChallengeType.Unique1, renderUniqueChallenge1);
registerRenderer(ChallengeType.Unique2, renderUniqueChallenge2);
registerRenderer(ChallengeType.Unique3, renderPhotoChallenge);
registerRenderer(ChallengeType.Unique4, renderUniqueChallenge4);
registerRenderer(ChallengeType.Final, renderAnswerChallenge);

const gameHost = getRequiredElement<HTMLElement>('#gameView');
const adminHost = getRequiredElement<HTMLElement>('#adminView');

registerView(SangfroidView.Landing, mountLanding, unmountLanding);

registerView(SangfroidView.PlayerPortal, () => {
  gameHost.classList.remove('hidden');
  mountGame(gameHost);
}, () => {
  gameHost.classList.add('hidden');
  unmountGame();
});

registerView(SangfroidView.AdminPortal, () => {
  adminHost.classList.remove('hidden');
  mountAdmin(adminHost);
}, () => {
  adminHost.classList.add('hidden');
  unmountAdmin();
});

navigateTo(getViewFromPath());
initMap();