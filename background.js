chrome.action.onClicked.addListener(loadEditor);

async function loadEditor(tab) {
  const existEditor = await chrome.scripting.executeScript({
    target: {tabId: tab.id},
    function: editorLoaded,
  });

  if (existEditor[0].result) {
    chrome.scripting.executeScript({
      target: {tabId: tab.id},
      function: showPossiblyHiddenEditor,
    });
    return;
  }

  const startEditor = await chrome.scripting.executeScript({
    target: {tabId: tab.id},
    function: startEditingMode,
  });

  if (!startEditor[0].result) {
    return;
  }

  await chrome.scripting.executeScript({
    target: {tabId: tab.id},
    files: ['languages.js'],
  });

  await chrome.scripting.executeScript({
    target: {tabId: tab.id},
    files: ['editor.js'],
  });

  await chrome.scripting.insertCSS({
    target: {tabId: tab.id},
    files: ['document.css'],
  });
}

function showPossiblyHiddenEditor() {
  const shadow = document.getElementById('kerni-editor-container').shadowRoot;
  const kerniEditor = shadow.getElementById('kerni-editor');
  
  if (kerniEditor.style.display === 'none') {
    kerniEditor.style.display = 'flex';
    document.body.classList.add('kerni-editor-document-body');
  }
}

async function startEditingMode() {
  return await fetch(chrome.runtime.getURL('editor.html'))
  .then(response => response.text())
  .then(data => {
    document.body.classList.add('kerni-editor-document-body');

    const container = document.createElement('div')
    container.setAttribute('id', 'kerni-editor-container');
    document.querySelector('html').insertAdjacentElement('beforeend', container);

    const shadowRoot = container.attachShadow({mode: 'open'});
    shadowRoot.innerHTML = data;
    return true;
  }).catch(error => {
    console.log(`There was an error loading the editor HTML: ${error}`);
    return false;
  });
}

function editorLoaded() {
  const container = document.getElementById('kerni-editor-container');
  if (!container) {
    return false;
  }

  if (!container.shadowRoot) {
    return false;
  }

  return container.shadowRoot.getElementById('kerni-editor') !== null;
}
