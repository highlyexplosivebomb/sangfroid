import './styles/base.css';
import './styles/landing.css';
import './styles/signup.css';
import './styles/game.css';
import './styles/admin.css';

import { registerView, navigateTo, getViewFromPath, SangfroidView } from './shared/router';
import { registerRenderer } from './player-portal/challenges';
import { renderInputChallenge } from './player-portal/renderers/inputChallenge';
import { renderPhotoChallenge } from './player-portal/renderers/photoChallenge';
import { mountGame, unmountGame } from './player-portal/game';
import { mountAdmin, unmountAdmin } from './admin-portal/admin';
import { initMap, mountLanding, unmountLanding } from './landing/landing';
import { getRequiredElement } from './shared/dom';

import { ChallengeType } from './shared/store';

registerRenderer(ChallengeType.Input, renderInputChallenge);
registerRenderer(ChallengeType.Photo, renderPhotoChallenge);

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