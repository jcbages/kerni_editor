const KERNI_EDITOR_USER_KEY = 'kerni-editor-user-key';

window.onload = async () => {
  chrome.storage.local.get([KERNI_EDITOR_USER_KEY], async data => {
    const userKey = data[KERNI_EDITOR_USER_KEY];
    if (userKey) {
      document.getElementsByName(KERNI_EDITOR_USER_KEY)[0].value = userKey;
      await loadUserInfo(userKey);
    }
  });

  document.getElementById('save-changes-button').addEventListener('click', () => {
    const userKey = document.getElementsByName(KERNI_EDITOR_USER_KEY)[0].value.trim();
    chrome.storage.local.set({[KERNI_EDITOR_USER_KEY]: userKey}, async () => {
      await loadUserInfo(userKey, true);
    });
  });
};

async function loadUserInfo(userKey, keyUpdated=false) {
  const statusMessage = document.getElementById('user-projects-status-message');
  const projectsList = document.getElementById('user-projects-list');

  try {
    if (keyUpdated) {
      statusMessage.innerHTML = 'User Key updated! Please wait while we load the projects...';
    } else {
      statusMessage.innerHTML = 'Please wait while we load the projects...';
    }

    statusMessage.style.display = 'block';
    projectsList.style.display = 'none';

    const response = await fetch('https://api.kerni.app/user_info', {
      method: 'GET',
      headers: {'Authorization': `Basic ${userKey}`},
    });

    if (response.ok) {
      const data = await response.json();
      populateUserProjects(data.projects);
      statusMessage.style.display = 'none';
      projectsList.style.display = 'block';
    } else if (response.status === 403) {
      statusMessage.innerHTML = 'No projects were found for this user key';
    } else {
      throw `Unexpected error status ${response.status}`;
    }
  } catch (error) {
    statusMessage.innerHTML = 'Something went wrong when trying to load the user info, try again later.';
  }
}

function populateUserProjects(projects) {
  const projectsList = document.getElementById('user-projects-list');
  projectsList.innerHTML = '';

  for (const project of projects) {
    projectsList.innerHTML += `<li>${project.project_id}</li>`;
  }
}
