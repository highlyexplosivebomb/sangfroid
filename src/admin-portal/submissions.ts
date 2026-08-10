import {
  getPendingSubmissions,
  getChallengeById,
  getTeamData,
  setSubmissionStatus,
  SubmissionStatus,
  getAdminGameId,
} from '../shared/store';

export function renderSubmissions(content: HTMLElement, updateContent: () => void): void {
  if (!getAdminGameId()) {
    return;
  }

  const pending = getPendingSubmissions();

  if (pending.length === 0) {
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'admin-submissions-wrapper';

  for (const sub of pending) {
    const challenge = getChallengeById(sub.challengeId);
    if (!challenge) {
      continue;
    }

    const card = document.createElement('div');
    card.className = 'review-card';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'review-card-header';

    const info = document.createElement('div');
    info.className = 'review-card-info';

    const teamData = getTeamData(sub.teamId);
    const teamName = teamData ? teamData.name : 'Unknown Team';
    const teamTag = teamData ? teamData.tag : 'UNK';

    const teamEl = document.createElement('div');
    teamEl.className = 'review-team-name';
    teamEl.textContent = `${teamName} (${teamTag})`;

    const challengeEl = document.createElement('div');
    challengeEl.className = 'review-challenge-name';
    challengeEl.textContent = challenge.title;

    info.appendChild(teamEl);
    info.appendChild(challengeEl);

    const pointsEl = document.createElement('div');
    pointsEl.className = 'review-points';
    pointsEl.textContent = `${challenge.points} pts`;

    cardHeader.appendChild(info);
    cardHeader.appendChild(pointsEl);
    card.appendChild(cardHeader);

    if (sub.value && (sub.value.startsWith('data:') || sub.value.startsWith('http'))) {
      const img = document.createElement('img');
      img.className = 'review-photo';
      img.src = sub.value;
      img.alt = `Submission by ${teamName}`;
      card.appendChild(img);
    }

    const actions = document.createElement('div');
    actions.className = 'review-actions';

    const approveBtn = document.createElement('button');
    approveBtn.className = 'review-approve-btn';
    approveBtn.textContent = 'Approve';
    approveBtn.addEventListener('click', () => {
      setSubmissionStatus(sub.id, SubmissionStatus.Approved);
      updateContent();
    });

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'review-reject-btn';
    rejectBtn.textContent = 'Reject';
    rejectBtn.addEventListener('click', () => {
      setSubmissionStatus(sub.id, SubmissionStatus.Rejected);
      updateContent();
    });

    actions.appendChild(approveBtn);
    actions.appendChild(rejectBtn);
    card.appendChild(actions);

    wrapper.appendChild(card);
  }

  content.appendChild(wrapper);
}
