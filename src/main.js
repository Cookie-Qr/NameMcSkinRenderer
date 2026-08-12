import './style.css';
import { createIcons, Play, Pause, Camera, Download, RotateCcw, Sun, Moon, ImageUp, Trash2 } from 'lucide';
import './namemc-renderer.js';
import { createSkinRecord, listSkins, removeSkin, saveSkin } from './skin-library.js';

const defaultSkin = '/skins/alex.png';
const app = document.querySelector('#app');
const storedTheme = localStorage.getItem('namemc-theme');
if (storedTheme === 'dark') document.documentElement.classList.add('dark');

app.innerHTML = `
  <header class="site-header">
    <nav class="navbar page-width" aria-label="主导航">
      <a class="brand" href="/"><img class="brand-mark" src="/namemc-logo.svg" width="32" height="32" alt="" /><span>NameMC</span></a>
      <a class="nav-link active" href="#preview">皮肤</a>
      <button class="icon-button theme-button" id="theme-button" title="切换主题"><i data-lucide="sun"></i></button>
    </nav>
  </header>

  <main class="page-width" id="preview">
    <h1><span id="skin-title">Alex</span> <small>Minecraft皮肤预览</small></h1>
    <hr />
    <div class="preview-layout">
      <section class="viewer-card">
        <div class="viewer-stage animation-paused">
          <canvas class="skin-3d drop-shadow" id="skin-canvas" width="225" height="450" data-model="slim" aria-label="可拖动的 Minecraft 皮肤模型"></canvas>
          <div class="viewer-actions">
            <button class="icon-button" id="play-button" title="播放"><i data-lucide="play"></i></button>
            <button class="icon-button" id="capture-button" title="截图"><i data-lucide="camera"></i></button>
            <button class="icon-button download-button" id="download-button" title="下载皮肤"><i data-lucide="download"></i></button>
          </div>
        </div>
      </section>

      <aside class="control-panel">
        <section class="panel-section upload-section">
          <div class="section-title">本地皮肤</div>
          <label class="upload-zone" for="skin-file" id="upload-zone">
            <i data-lucide="image-up"></i>
            <span><strong>选择皮肤 PNG</strong><small>支持 64×64 和 64×32</small></span>
          </label>
          <input id="skin-file" type="file" accept="image/png,.png" multiple hidden />
          <div class="file-row"><span class="file-name" id="file-name">Alex.png</span><button class="text-button" id="reset-button"><i data-lucide="rotate-ccw"></i>恢复 Alex</button></div>
        </section>

        <section class="panel-section library-section">
          <div class="section-title">皮肤库 <span class="section-meta" id="library-count">0</span></div>
          <div class="library-list" id="library-list" aria-live="polite"></div>
        </section>

        <section class="panel-section">
          <div class="section-title">模型</div>
          <div class="segmented" role="group" aria-label="手臂模型">
            <button data-model="slim" class="selected">纤细</button>
            <button data-model="default">经典</button>
          </div>
        </section>

        <section class="panel-section">
          <div class="section-title">视角</div>
          <div class="angle-grid">
            <label>水平<input id="theta" type="number" value="30" min="-360" max="360" step="1" /></label>
            <label>俯仰<input id="phi" type="number" value="21" min="-90" max="90" step="1" /></label>
            <label>动作<input id="time" type="number" value="90" min="0" max="1440" step="1" /></label>
          </div>
        </section>
      </aside>
    </div>
  </main>
  <div class="toast" id="toast" role="status"></div>
`;

const icons = { Play, Pause, Camera, Download, RotateCcw, Sun, Moon, ImageUp, Trash2 };
createIcons({ icons });

const canvas = document.querySelector('#skin-canvas');
const stage = document.querySelector('.viewer-stage');
const fileInput = document.querySelector('#skin-file');
const modelButtons = [...document.querySelectorAll('.segmented [data-model]')];
const angleInputs = ['theta', 'phi', 'time'].map(id => document.querySelector(`#${id}`));
let currentUrl = defaultSkin;
let currentFileName = 'Alex.png';
let blobUrl = null;
let playing = false;
let currentLibraryId = null;
let libraryRecords = [];
const libraryUrls = new Map();

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 1500);
}

async function loadSkin(source, fileName) {
  await window.nameMcRenderer.loadSkin(source);
  currentUrl = source;
  currentFileName = fileName;
  document.querySelector('#file-name').textContent = fileName;
  const skinName = fileName.replace(/\.png$/i, '') || '本地皮肤';
  document.querySelector('#skin-title').textContent = skinName;
  document.title = `${skinName} Minecraft皮肤预览 | NameMC`;
}

function updateModelSelection(selectedType) {
  modelButtons.forEach(button => button.classList.toggle('selected', button.dataset.model === selectedType));
  canvas.dataset.model = selectedType;
}

function revokeLibraryUrls() {
  libraryUrls.forEach(url => URL.revokeObjectURL(url));
  libraryUrls.clear();
}

function renderLibrary() {
  const list = document.querySelector('#library-list');
  document.querySelector('#library-count').textContent = libraryRecords.length;
  list.replaceChildren();
  if (!libraryRecords.length) {
    const empty = document.createElement('p');
    empty.className = 'library-empty';
    empty.textContent = '导入的皮肤会显示在这里';
    list.append(empty);
    return;
  }
  libraryRecords.slice().sort((a, b) => b.createdAt - a.createdAt).forEach(record => {
    const url = URL.createObjectURL(record.blob);
    libraryUrls.set(record.id, url);
    const item = document.createElement('div');
    item.className = `library-item${record.id === currentLibraryId ? ' active' : ''}`;
    item.innerHTML = `<button class="library-open" type="button"><img alt="" /><span></span></button><button class="icon-button library-delete" type="button" title="从皮肤库删除"><i data-lucide="trash-2"></i></button>`;
    item.querySelector('img').src = url;
    item.querySelector('span').textContent = record.name;
    item.querySelector('.library-open').addEventListener('click', () => loadLibraryRecord(record));
    item.querySelector('.library-delete').addEventListener('click', async () => {
      await removeSkin(record.id);
      libraryRecords = libraryRecords.filter(itemRecord => itemRecord.id !== record.id);
      if (currentLibraryId === record.id) currentLibraryId = null;
      revokeLibraryUrls();
      renderLibrary();
      toast('已从皮肤库删除');
    });
    list.append(item);
  });
  createIcons({ icons });
}

async function loadLibraryRecord(record) {
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = URL.createObjectURL(record.blob);
  currentLibraryId = record.id;
  await loadSkin(blobUrl, record.name);
  revokeLibraryUrls();
  renderLibrary();
  toast('已切换皮肤');
}

function validateSkin(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const valid = image.width === 64 && (image.height === 64 || image.height === 32);
      if (valid) resolve(url);
      else {
        URL.revokeObjectURL(url);
        reject(new Error(`皮肤尺寸为 ${image.width}×${image.height}，需要 64×64 或 64×32`));
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取这个 PNG 文件'));
    };
    image.src = url;
  });
}

fileInput.addEventListener('change', async () => {
  const files = [...fileInput.files];
  if (!files.length) return;
  try {
    const validRecords = [];
    for (const file of files) {
      const url = await validateSkin(file);
      URL.revokeObjectURL(url);
      validRecords.push(createSkinRecord(file));
    }
    for (const record of validRecords) {
      for (const oldRecord of libraryRecords.filter(old => old.name === record.name)) await removeSkin(oldRecord.id);
      await saveSkin(record);
    }
    libraryRecords = [...validRecords, ...libraryRecords.filter(old => !validRecords.some(next => next.name === old.name))];
    revokeLibraryUrls();
    renderLibrary();
    await loadLibraryRecord(validRecords[0]);
    toast(validRecords.length === 1 ? '本地皮肤已载入' : `已导入 ${validRecords.length} 个皮肤`);
  } catch (error) {
    fileInput.value = '';
    toast(error.message);
  }
});

const dropZone = document.querySelector('#upload-zone');
['dragenter', 'dragover'].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.remove('dragging'); }));
dropZone.addEventListener('drop', event => {
  const files = [...event.dataTransfer.files];
  if (!files.length) return;
  const transfer = new DataTransfer();
  files.forEach(file => transfer.items.add(file));
  fileInput.files = transfer.files;
  fileInput.dispatchEvent(new Event('change'));
});

modelButtons.forEach(button => button.addEventListener('click', () => {
  updateModelSelection(button.dataset.model);
  window.nameMcRenderer.setModel(button.dataset.model);
}));

angleInputs.forEach(input => input.addEventListener('input', () => {
  window.nameMcRenderer.setAngles({
    theta: Number(document.querySelector('#theta').value),
    phi: Number(document.querySelector('#phi').value),
    time: Number(document.querySelector('#time').value)
  });
}));

window.addEventListener('namemc-angle-change', event => {
  document.querySelector('#theta').value = Math.round(event.detail.theta);
  document.querySelector('#phi').value = Math.round(event.detail.phi);
  document.querySelector('#time').value = Math.round(event.detail.time);
});

document.querySelector('#play-button').addEventListener('click', event => {
  playing = !playing;
  window.nameMcRenderer.setPlaying(playing);
  stage.classList.toggle('animation-paused', !playing);
  event.currentTarget.innerHTML = `<i data-lucide="${playing ? 'pause' : 'play'}"></i>`;
  event.currentTarget.title = playing ? '暂停' : '播放';
  createIcons({ icons });
});

document.querySelector('#capture-button').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `${currentFileName.replace(/\.png$/i, '')}-preview.png`;
  link.href = window.nameMcRenderer.capture();
  link.click();
});

document.querySelector('#download-button').addEventListener('click', async () => {
  const link = document.createElement('a');
  link.download = currentFileName;
  link.href = currentUrl;
  link.click();
});

document.querySelector('#reset-button').addEventListener('click', async () => {
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = null;
  currentLibraryId = null;
  fileInput.value = '';
  updateModelSelection('slim');
  window.nameMcRenderer.setModel('slim');
  window.nameMcRenderer.setAngles({ theta: 30, phi: 21, time: 90 });
  await loadSkin(defaultSkin, 'Alex.png');
  renderLibrary();
  toast('已恢复 Alex 皮肤');
});

document.querySelector('#theme-button').addEventListener('click', event => {
  const dark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('namemc-theme', dark ? 'dark' : 'light');
  event.currentTarget.innerHTML = `<i data-lucide="${dark ? 'moon' : 'sun'}"></i>`;
  event.currentTarget.title = dark ? '切换浅色模式' : '切换深色模式';
  createIcons({ icons });
});

await window.nameMcRenderer.init({ canvas, skin: defaultSkin, model: 'slim', theta: 30, phi: 21, time: 90 });
libraryRecords = await listSkins();
renderLibrary();
