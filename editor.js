const KERNI_EDITOR_HOVER_CLASS = 'kerni-editor-hover';
const KERNI_EDITOR_CLICK_CLASS = 'kerni-editor-click';
const KERNI_EDITOR_PUBLISH_CHANGES_ID = 'kerni-editor-publish-changes';

const KERNI_EDITOR_BUTTON_SELECTED_CLASS = 'kerni-editor-selected';
const KERNI_EDITOR_MUTATED_CLASS = 'kerni-editor-mutated';

const KERNI_EDITOR_LANGUAGE_DROPDOWN = 'kerni-editor-language-dropdown';
const KERNI_EDITOR_ADD_LANGUAGE_CONTAINER = 'kerni-editor-add-language-container';
const KERNI_EDITOR_ADD_LANGUAGE_SELECTED = 'kerni-editor-add-language-selected';

const MAX_EDITABLE_LEVEL_DOWN_LOOKUP = 2;
const MAX_EDITABLE_LEVEL_UP_LOOKUP = 2;

const KERNI_EDITOR_USER_KEY = 'kerni-editor-user-key';

const DRAFTS_KERNI_URL = 'drafts.kerni.app';
const LANGUAGE_PATHNAME_REGEXP = /^\/([^\/]+)(.*)$/;

let kerniState = {
  kerniEditing: false,
  languageDropdown: false,
  hoveredElement: null,
  clickedElement: null,
  addLanguageSelected: null,
  projectLanguages: null,
  editorState: {
    mutatedElements: new Set(),
    mutatedContent: new Map(),
  },
}

function main() {
  setupEditorBar();
  enableEditorFuntionality();
  startListeningChanges();
  enableAlertAboutLeaving();
}

function shadow() {
  let shadow = null;
  return (() => {
    if (!shadow) {
      return shadow = document.getElementById('kerni-editor-container').shadowRoot;
    } else {
      return shadow;
    }
  })();
}

function setupEditorBar() {
  initSiteState();

  const previewButton = shadow().getElementById('kerni-editor-preview');
  const editorButton = shadow().getElementById('kerni-editor-editor');
  const publishMessage = shadow().getElementById('kerni-editor-publish-message');
  const languageButton = shadow().getElementById('kerni-editor-change-language-button');
  const publishButton = shadow().getElementById('kerni-editor-publish-button');
  const closeButton = shadow().getElementById('kerni-editor-close-button');
  const languageDropdown = shadow().getElementById(KERNI_EDITOR_LANGUAGE_DROPDOWN);
  const addLanguageButton = shadow().getElementById('kerni-editor-add-language-button');
  const addLanguageContainer = shadow().getElementById(KERNI_EDITOR_ADD_LANGUAGE_CONTAINER);
  const addLanguageConfirmButton = shadow().getElementById('kerni-editor-add-language-confirm-button');

  if (!kerniState.kerniEditing) {
    previewButton.classList.add(KERNI_EDITOR_BUTTON_SELECTED_CLASS);
    editorButton.classList.remove(KERNI_EDITOR_BUTTON_SELECTED_CLASS);
  } else {
    previewButton.classList.remove(KERNI_EDITOR_BUTTON_SELECTED_CLASS);
    editorButton.classList.add(KERNI_EDITOR_BUTTON_SELECTED_CLASS);
  }

  previewButton.addEventListener('click', _event => {
    kerniState.kerniEditing = false;
    dismissEditingState();
    editorButton.classList.remove(KERNI_EDITOR_BUTTON_SELECTED_CLASS);
    previewButton.classList.add(KERNI_EDITOR_BUTTON_SELECTED_CLASS);
  });

  editorButton.addEventListener('click', _event => {
    kerniState.kerniEditing = true;
    startEditingState();
    previewButton.classList.remove(KERNI_EDITOR_BUTTON_SELECTED_CLASS);
    editorButton.classList.add(KERNI_EDITOR_BUTTON_SELECTED_CLASS);
  });

  if (kerniState.site.language !== 'original') {
    languageButton.innerHTML = `${VALID_LANGUAGES[kerniState.site.language].name} Language`;
  }

  languageButton.addEventListener('click', _event => {
    if (kerniState.languageDropdown) {
      hideLanguageDropdown();
    } else {
      showLanguageDropdown();
    }
  });

  addLanguageButton.addEventListener('click', _event => {
    if (!kerniState.languageDropdown) {
      return;
    }

    addLanguageContainer.style.display = 'block';
  });

  addLanguageContainer.querySelector('.close-button').addEventListener('click', _event => {
    dismissAddLanguageState();
  });

  addLanguageContainer.querySelector('ul').addEventListener('click', event => {
    if (kerniState.addLanguageSelected) {
      kerniState.addLanguageSelected.classList.remove(KERNI_EDITOR_ADD_LANGUAGE_SELECTED);
    }

    if (event.target.hasAttribute('data-kerni_language')) {
      kerniState.addLanguageSelected = event.target;
      kerniState.addLanguageSelected.classList.add(KERNI_EDITOR_ADD_LANGUAGE_SELECTED);

      addLanguageConfirmButton.innerHTML = 'Add language';
    }
  });

  languageDropdown.querySelector('ul').addEventListener('click', event => {
    const targetLanguage = event.target.getAttribute('data-kerni_language');

    let oldPrefix = '', targetPrefix = '';
    if (kerniState.site.draft) {
      targetPrefix = `/${kerniState.site.projectId}/${targetLanguage}`;
      if (kerniState.site.language !== 'original') {
        oldPrefix = `/${kerniState.site.projectId}/${kerniState.site.language}`;
      } else {
        oldPrefix = `/${kerniState.site.projectId}`
      }
    } else {
      targetPrefix = `/${targetLanguage}`;
      if (kerniState.site.language !== 'original') {
        oldPrefix = `/${kerniState.site.language}`;
      } else {
        oldPrefix = '/';
      }
    }
    
   window.location.href = window.location.href.replace(oldPrefix, targetPrefix);
  });

  addLanguageConfirmButton.addEventListener('click', async _event => {
    if (!kerniState.addLanguageSelected) {
      return;
    }

    const language = kerniState.addLanguageSelected.getAttribute('data-kerni_language');
    if (!language) {
      return;
    }
    
    try {
      addLanguageConfirmButton.disable = true;
      addLanguageConfirmButton.innerHTML = 'Please wait...';

      const authToken = await getAuthToken();
      if (!authToken) {
        addLanguageConfirmButton.innerHTML = 'Missing user key, please check and update it in the extension options';
        return;
      }

      const response = await fetch(`https://api.kerni.app/project/${kerniState.site.projectId}/languages/${kerniState.site.language}`, {
        method: 'POST',
        headers: {'Authorization': `Basic ${authToken}`},
      })

      if (response.ok) {
        dismissAddLanguageState();
        kerniState.projectLanguages = null;
        showLanguageDropdown();
      } else if (response.status === 403) {
        addLanguageConfirmButton.innerHTML = 'Invalid user key, please check and update it in the extension options';
      } else {
        throw `Unexpected status code ${response.status}`;
      }
    } catch (error) {
      console.log(`Something wrong happened while sending update ${error}`);
      addLanguageConfirmButton.innerHTML = `Something went wrong, please try again`;
    }

    addLanguageConfirmButton.disable = false;
  })

  closeButton.addEventListener('click', _event => {
    dismissEditingState();
    document.body.classList.remove('kerni-editor-document-body');
    shadow().getElementById('kerni-editor').style.display = 'none';
  });

  publishButton.addEventListener('click', async _event => {
    if (!kerniState.editorState.mutatedElements.size) {
      return;
    }

    publishButton.innerHTML = 'Publishing';
    publishButton.disable = true;

    try {
      const authToken = await getAuthToken();

      if (!authToken) {
        publishMessage.querySelector('.kerni-message-icon').innerHTML = '❌';
        publishMessage.querySelector('.kerni-message-content').innerHTML = 'Missing user key,<br>Please check and update it in the extension options';
        publishMessage.style.display = 'block';

        publishButton.innerHTML = 'Publish';
        publishButton.disable = false;

        return;
      }

      const response = await fetch(`https://api.kerni.app/translation/${kerniState.site.projectId}/${kerniState.site.language}?path_name=${kerniState.site.pathName}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apifyKerniState()),
      })

      if (response.ok) {
        publishMessage.querySelector('.kerni-message-icon').innerHTML = '🎉';
        publishMessage.querySelector('.kerni-message-content').innerHTML = `You published ${kerniState.editorState.mutatedElements.size}<br>changes to your site!`;

        dismissEditingState();

        kerniState.editorState.mutatedElements.clear();
        kerniState.editorState.mutatedContent.clear();

        shadow().getElementById(KERNI_EDITOR_PUBLISH_CHANGES_ID).innerText = `${kerniState.editorState.mutatedElements.size} unpublished changes`;
      } else if (response.status === 401) {
        publishMessage.querySelector('.kerni-message-icon').innerHTML = '❌';
        publishMessage.querySelector('.kerni-message-content').innerHTML = 'This project should only be editted inside the drafts.kerni.app URL';
      } else if (response.status === 403) {
        publishMessage.querySelector('.kerni-message-icon').innerHTML = '❌';
        publishMessage.querySelector('.kerni-message-content').innerHTML = 'Invalid user key,<br>Please check and update it in the extension options';
      } else {
        throw `Unexpected status code ${response.status}`;
      }

      publishMessage.style.display = 'block';
    } catch (error) {
      console.log(`Something wrong happened while sending update ${error}`);

      publishMessage.querySelector('.kerni-message-icon').innerHTML = '❌';
      publishMessage.querySelector('.kerni-message-content').innerHTML = `Something went wrong,<br>please try again`;
      publishMessage.style.display = 'block';
    }

    publishButton.innerHTML = 'Publish';
    publishButton.disable = false;
  });

  publishMessage.querySelector('button').addEventListener('click', _event => {
    publishMessage.style.display = 'none';
  });
}

function initSiteState() {
  let url, draft;
  if (window.location.host !== DRAFTS_KERNI_URL) {
    url = window.location.href;
    draft = false;
  } else {
    url = `${window.location.protocol}//${window.location.pathname.substring(1)}`;
    draft = true;
  }

  const parsedUrl = new URL(url);
  const projectId = parsedUrl.host;
  const matches = parsedUrl.pathname.match(LANGUAGE_PATHNAME_REGEXP);

  let language, pathName;
  if (!matches) {
    language = 'original';
    pathName = '/';
  } else {
    language = matches[1] in VALID_LANGUAGES ? matches[1] : 'original';
    pathName = matches[2].endsWith('/') ? matches[2] : `${matches[2]}/`;
  }

  kerniState.site = {
    projectId: projectId,
    language: language,
    pathName: pathName,
    draft: draft,
  };
}

function dismissAddLanguageState() {
  if (kerniState.addLanguageSelected) {
    kerniState.addLanguageSelected.removeAttribute('data-kerni_language');
    kerniState.addLanguageSelected = null;
  }

  const addLanguageConfirmButton = shadow().getElementById('kerni-editor-add-language-confirm-button');
  addLanguageConfirmButton.innerHTML = 'Add language';

  const addLanguageContainer = shadow().getElementById(KERNI_EDITOR_ADD_LANGUAGE_CONTAINER);
  addLanguageContainer.style.display = 'none';
}

async function getAuthToken() {
  return new Promise((resolve, _reject) => {
    chrome.storage.local.get([KERNI_EDITOR_USER_KEY], data => {
      resolve(data[KERNI_EDITOR_USER_KEY]);
    });
  });
}

function hideLanguageDropdown() {
  kerniState.languageDropdown = false;
  shadow().getElementById(KERNI_EDITOR_LANGUAGE_DROPDOWN).style.display = 'none';
}

async function showLanguageDropdown() {
  kerniState.languageDropdown = true;
  const languageDropdown = shadow().getElementById(KERNI_EDITOR_LANGUAGE_DROPDOWN);
  const addLanguageContainer = shadow().getElementById(KERNI_EDITOR_ADD_LANGUAGE_CONTAINER);

  languageDropdown.style.display = 'block';
  if (!kerniState.projectLanguages) {
    const languageList = languageDropdown.querySelector('ul');
    languageList.innerHTML = 'Loading languages...';

    const addLanguageList = addLanguageContainer.querySelector('ul');
    addLanguageList.innerHTML = 'Loading languages...';

    kerniState.projectLanguages = await loadProjectLanguages();
    if (kerniState.projectLanguages === null) {
      languageList.innerHTML = 'Failed to load languages, please try again';
      addLanguageList.innerHTML = 'Failed to load languages, please try again';
    } else {
      languageList.innerHTML = kerniState.projectLanguages.map(language => {
        const name = isCurrentLanguage(language) ? `${language.name} ✅` : language.name;
        return `<li data-kerni_language="${language.id}">${name}</li>`;
      }).join('');

      let existingLanguages = new Set(kerniState.projectLanguages.map(language => language.id));
      addLanguageList.innerHTML = Object.keys(VALID_LANGUAGES).map(language => {
        if (!existingLanguages.has(language)) {
          return `<li data-kerni_language="${language}">${VALID_LANGUAGES[language].name}</li>`;
        }
      }).join('');
    }
  }
}

function isCurrentLanguage(language) {
  return kerniState.site.language === 'original' && language.original || kerniState.site.language === language.id;
}

async function loadProjectLanguages() {
  try {
    const response = await fetch(`https://api.kerni.app/project/${kerniState.site.projectId}/languages`);

    if (response.ok) {
      result = await response.json();
      return result.languages;
    } else {
      throw `Unexpected status code ${response.status}`;
    }
  } catch (error) {
    console.log(`Something wrong happened while sending update ${error}`);
    return null;
  }
}

function apifyKerniState() {
  let body = {
    draft: kerniState.site.draft,
    changes: {},
  };

  for (const [_key, value] of kerniState.editorState.mutatedContent) {
    if (!isEmptyText(value.originalValue)) {
      body.changes[value.originalValue.trim()] = value.currentValue.trim();
    }
  }

  return body;
}

function dismissEditingState() {
  if (kerniState.hoveredElement) {
    kerniState.hoveredElement.classList.remove(KERNI_EDITOR_HOVER_CLASS);
    kerniState.hoveredElement = null;
  }

  if (kerniState.clickedElement) {
    kerniState.clickedElement.classList.remove(KERNI_EDITOR_CLICK_CLASS);
    kerniState.clickedElement.contentEditable = false;
    kerniState.clickedElement.removeAttribute('data-gramm_editor');
    kerniState.clickedElement = null;
  }

  for (let element of kerniState.editorState.mutatedElements) {
    element.classList.remove(KERNI_EDITOR_MUTATED_CLASS);
  }
}

function startEditingState() {
  for (let element of kerniState.editorState.mutatedElements) {
    element.classList.add(KERNI_EDITOR_MUTATED_CLASS);
  }
}

function preventClickWhenEditing() {
  document.body.addEventListener('click', event => {
    if (kerniState.kerniEditing) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, true);
}

function enableEditorFuntionality() {
  preventClickWhenEditing();
  enableHoverAndClick();
  listenContentEditable();
}

function isNonEmptyElement(element) {
  if (element.nodeType == Node.COMMENT_NODE) {
    return false;
  }

  if (element.nodeType == Node.TEXT_NODE && !elementHasText(element)) {
    return false;
  }

  return true;
}

function enableHoverAndClick() {
  document.body.addEventListener('mouseover', event => {
    if (!kerniState.kerniEditing) {
      if (kerniState.hoveredElement) {
        kerniState.hoveredElement.classList.remove(KERNI_EDITOR_HOVER_CLASS);
        kerniState.hoveredElement = null;
      }
      return;
    }

    if (kerniState.hoveredElement && kerniState.hoveredElement !== event.target) {
      kerniState.hoveredElement.classList.remove(KERNI_EDITOR_HOVER_CLASS);
      kerniState.hoveredElement = null;
    }

    let currentElement = event.target;

    // if no text but only one child then try finding text in that child
    for (let i = 0; i < MAX_EDITABLE_LEVEL_DOWN_LOOKUP && !elementHasText(currentElement); ++i) {
      const elements = Array.from(currentElement.childNodes);
      if (elements.filter(isNonEmptyElement).length === 1) {
        currentElement = elements.find(isNonEmptyElement);
      } else {
        break;
      }
    }

    if (!elementHasText(currentElement)) {
      return;
    }

    // to avoid redundancy try to go up some levels to a bigger block
    for (let i = 0; i < MAX_EDITABLE_LEVEL_UP_LOOKUP; ++i) {
      if (currentElement.parentNode && elementHasText(currentElement.parentNode)) {
        currentElement = currentElement.parentNode;
      } else {
        break;
      }
    }

    kerniState.hoveredElement = currentElement;
    kerniState.hoveredElement.classList.add(KERNI_EDITOR_HOVER_CLASS);
  }, true);

  document.body.addEventListener('click', event => {
    if (!kerniState.kerniEditing) {
      if (kerniState.clickedElement) {
        kerniState.clickedElement.classList.remove(KERNI_EDITOR_CLICK_CLASS);
        kerniState.clickedElement.contentEditable = false;
        kerniState.clickedElement.removeAttribute('data-gramm_editor');
        kerniState.clickedElement = null;
      }
      return;
    }
    
    if (kerniState.clickedElement && kerniState.clickedElement !== event.target) {
      kerniState.clickedElement.classList.remove(KERNI_EDITOR_CLICK_CLASS);
      kerniState.clickedElement.contentEditable = false;
      kerniState.clickedElement.removeAttribute('data-gramm_editor');
      kerniState.clickedElement = null;
    }
    
    if (!kerniState.hoveredElement) {
      return;
    }
    
    kerniState.clickedElement = kerniState.hoveredElement;
    kerniState.clickedElement.classList.add(KERNI_EDITOR_CLICK_CLASS);
    kerniState.clickedElement.contentEditable = true;
    kerniState.clickedElement.setAttribute('data-gramm_editor', false);
    
    if (!kerniState.clickedElement.hasAttribute('data-kerni_raw')) {
      kerniState.clickedElement.setAttribute('data-kerni_raw', kerniState.clickedElement.innerHTML);
    }

    kerniState.clickedElement.focus();
  }, true);
}

function listenContentEditable() {
  document.body.addEventListener('keydown', event => {
    if (!kerniState.kerniEditing || !kerniState.clickedElement) {
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      return false;
    }
  }, true);

  document.body.addEventListener('paste', event => {
    if (!kerniState.kerniEditing || !kerniState.clickedElement) {
      return false;
    }

    const text = event.clipboardData.getData('text/plain')
      .replace('&nbsp;', '')       // &nbsp; whitespaces
      .replace(/\u200B/g,'')       // &ZeroWidthSpace whitespaces
      .replace(/\r?\n|\r|\t/g, '') // newlines & tabs

    event.preventDefault();
    document.execCommand('insertText', false, text);
    return false;
  }, true);

  document.body.addEventListener('input', event => {
    if (!kerniState.kerniEditing || event.target !== kerniState.clickedElement) {
      return;
    }

    // TODO : fix this later as carriage is returning to start
    // kerniState.clickedElement.innerHTML = kerniState.clickedElement.innerHTML
    //   .replace('&nbsp;', '')  // &nbsp; whitespaces
    //   .replace(/\u200B/g,''); // &ZeroWidthSpace whitespaces

    if (kerniState.clickedElement.innerHTML !== kerniState.clickedElement.getAttribute('data-kerni_raw') && !containedInMutatedElement(kerniState.clickedElement)) {
      kerniState.clickedElement.classList.add(KERNI_EDITOR_MUTATED_CLASS);
      kerniState.editorState.mutatedElements.add(kerniState.clickedElement);
    } else {
      kerniState.clickedElement.classList.remove(KERNI_EDITOR_MUTATED_CLASS);
      kerniState.editorState.mutatedElements.delete(kerniState.clickedElement);
    }

    shadow().getElementById(KERNI_EDITOR_PUBLISH_CHANGES_ID).innerText = `${kerniState.editorState.mutatedElements.size} unpublished changes`;
  }, true);
}

function containedInMutatedElement(element) {
  do {
    element = element.parentNode;
    if (element && kerniState.editorState.mutatedElements.has(element)) {
      return true;
    }
  } while (element);

  return false;
}

function elementHasText(element) {
  return Array.from(element.childNodes).some(child => {
    if (child.nodeType !== Node.TEXT_NODE) {
      return false;
    } else {
      return !isEmptyText(child.data);
    }
  });
}

function isEmptyText(content) {
  const nonemptyText = content
    .replace(/\n|\r|\t| |u200B/g, '')
    .replace('&nbsp', '');

  return nonemptyText.length === 0;
}

function startListeningChanges() {
  const observer = new MutationObserver((mutationList, _observer) => {
    for (const mutation of mutationList) {
      if (mutation.type === 'characterData') {
        handleMutationCharacterData(mutation.target, mutation.oldValue, mutation.target.data);
      } else if (mutation.type === 'childList') {
        handleMutationRemovedNodes(mutation.removedNodes);
      }
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    characterDataOldValue: true,
  });
}

function handleMutationRemovedNodes(removedNodes) {
  for (const element of removedNodes) {
    removeElementMutatedContent(element);

    const subtree = element.nodeType === Node.TEXT_NODE ? [] : element.getElementsByTagName('*');
    for (const node of subtree) {
      removeElementMutatedContent(node);
    }
  }
}

function removeElementMutatedContent(element) {
  if (element.nodeType === Node.TEXT_NODE) {
    handleMutationCharacterData(element, element.data, '');
    return;
  }

  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      handleMutationCharacterData(node, node.data, '');
    }
  }
}

function handleMutationCharacterData(target, oldValue, newValue) {
  if (kerniState.editorState.mutatedContent.has(target)) {
    kerniState.editorState.mutatedContent.get(target).currentValue = newValue;
  } else {
    kerniState.editorState.mutatedContent.set(target, {
      originalValue: oldValue,
      currentValue: newValue,
    });
  }
}

function enableAlertAboutLeaving() {
  window.addEventListener('beforeunload', event => {
    if (kerniState.editorState.mutatedElements.size > 0) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

setTimeout(main, 100);
