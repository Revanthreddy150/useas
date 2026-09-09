import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, runTransaction } from "firebase/database";
import liveRepositoriesData from "./live_repositories.json";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const dataRef = ref(db, "portal_tree_data");
const countRef = ref(db, "visitor_count");
const msgRef = ref(db, "messages");

let core = liveRepositoriesData;
let path = [];
let searchTerm = "";

// Initial render
window.addEventListener('DOMContentLoaded', () => {
  render();
});

// Increment visitor count
try {
  runTransaction(countRef, (cur) => (cur === null || cur === undefined ? 1380 : cur + 1));
} catch(e){}

onValue(countRef, (snap) => {
  if(snap.exists()) {
    const el = document.getElementById('view-count');
    if (el) el.innerText = Number(snap.val()).toLocaleString();
  }
});

// Subscribe to Firebase Realtime Database
onValue(dataRef, (snap) => {
    if(snap.exists()) {
        core = snap.val();
    } else {
        core = liveRepositoriesData;
        set(dataRef, liveRepositoriesData);
    }
    checkDeepLinkRedirect();
    render();
});

// Deep Link Check & Auto-Redirect
function checkDeepLinkRedirect() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#/')) return;

  let cleanHash = hash.replace(/^#\//, '');
  if (cleanHash.startsWith('Home/')) cleanHash = cleanHash.replace(/^Home\//, '');

  const parts = cleanHash.split('/').map(decodeURIComponent).filter(Boolean);
  if (parts.length > 0) {
    const targetUnit = parts[parts.length - 1].trim().toLowerCase();
    const folderPath = parts.slice(0, -1);

    let target = core;
    for (let k of folderPath) {
      if (target && target[k]) target = target[k];
      else break;
    }

    let foundUrl = null;
    if (target && target._type === 'subject') {
      const units = target.units || [];
      const links = target.links || [];
      const idx = units.findIndex(u => (u||'').trim().toLowerCase() === targetUnit);
      if (idx !== -1 && links[idx] && links[idx] !== '#') foundUrl = links[idx];
    }

    if (!foundUrl) {
      // Global search fallback
      const searchGlobally = (node) => {
        if (!node) return null;
        if (node._type === 'subject') {
          const units = node.units || [];
          const links = node.links || [];
          const idx = units.findIndex(u => (u||'').trim().toLowerCase() === targetUnit);
          if (idx !== -1 && links[idx] && links[idx] !== '#') return links[idx];
        } else {
          const keys = Object.keys(node).filter(k => !k.startsWith('_'));
          for (let k of keys) {
            const res = searchGlobally(node[k]);
            if (res) return res;
          }
        }
        return null;
      };
      foundUrl = searchGlobally(core);
    }

    if (foundUrl) {
      const loader = document.getElementById('v2-loader');
      if (loader) loader.style.display = 'flex';
      setTimeout(() => {
        window.location.replace(foundUrl);
      }, 400);
    }
  }
}

// Render Engine
export function render() {
    const grid = document.getElementById('mainGrid');
    const notesArea = document.getElementById('notesArea');
    const unitList = document.getElementById('unitList');
    const navHeader = document.getElementById('navHeader');
    const viewTitle = document.getElementById('viewTitle');
    const bc = document.getElementById('bc');

    if (!grid || !unitList) return;
    
    grid.innerHTML = '';
    unitList.innerHTML = '';

    // Breadcrumbs
    let bcHtml = `<span class="bc-link" onclick="window.jumpTo(-1)">Home</span>`;
    path.forEach((p, i) => { bcHtml += ` > <span class="bc-link" onclick="window.jumpTo(${i})">${p}</span>`; });
    if (bc) bc.innerHTML = bcHtml;
    
    if(path.length > 0) {
      if (navHeader) navHeader.style.display = 'flex';
      if (viewTitle) viewTitle.innerText = path[path.length - 1];
    } else {
      if (navHeader) navHeader.style.display = 'none';
    }

    // Live Search Filter
    if (searchTerm.trim() !== '') {
      grid.style.display = 'none';
      if (notesArea) notesArea.style.display = 'block';
      if (navHeader) navHeader.style.display = 'none';

      const matches = [];
      const findMatches = (node, currentPath = []) => {
        if (!node) return;
        if (node._type === 'subject') {
          (node.units || []).forEach((u, i) => {
            if (u && u.toLowerCase().includes(searchTerm.toLowerCase())) {
              matches.push({
                type: 'unit',
                name: u,
                link: (node.links || [])[i] || '#',
                vid: (node.vids || [])[i] || '',
                path: currentPath
              });
            }
          });
        } else {
          Object.keys(node).filter(k => !k.startsWith('_')).forEach(k => {
            if (k.toLowerCase().includes(searchTerm.toLowerCase())) {
              matches.push({ type: 'folder', name: k, path: [...currentPath, k] });
            }
            findMatches(node[k], [...currentPath, k]);
          });
        }
      };

      findMatches(core);

      if (matches.length === 0) {
        unitList.innerHTML = '<div style="text-align:center; padding:40px; color:#888;">No results found</div>';
      } else {
        matches.forEach((m, idx) => {
          const animDelay = (idx * 0.05).toFixed(2);
          if (m.type === 'unit') {
            unitList.innerHTML += `
              <div class="unit-item" style="animation-delay: ${animDelay}s" onclick="window.openPdf('${m.link}')">
                <span><i class="fa-solid fa-file-pdf" style="color:#ef4444; margin-right:10px;"></i> ${m.name}</span>
                <div class="action-btns" onclick="event.stopPropagation()">
                  <button class="icon-action-btn" onclick="window.shareUnit('${m.path.join('/')}', '${m.name}')" title="Share Link"><i class="fa-solid fa-share-nodes" style="color:#2ecc71;"></i></button>
                  ${m.vid ? `<button class="icon-action-btn" onclick="window.openVideo('${m.vid}', '${m.name}')" title="Watch Video"><i class="fa-brands fa-youtube" style="color:#ff0000;"></i></button>` : ''}
                  <button class="icon-action-btn" onclick="window.openPdf('${m.link}')" title="Open Full Page PDF"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
                </div>
              </div>`;
          } else {
            unitList.innerHTML += `
              <div class="unit-item" style="animation-delay: ${animDelay}s" onclick="window.jumpToPath('${m.path.join('/')}')">
                <span><i class="fa-solid fa-folder-open" style="color:var(--primary); margin-right:10px;"></i> ${m.name}</span>
                <i class="fa-solid fa-chevron-right"></i>
              </div>`;
          }
        });
      }
      return;
    }

    // Normal Level Navigation
    let target = core;
    path.forEach(p => { if(target) target = target[p]; });

    if(!target) { path = []; render(); return; }

    if(target._type === 'subject') {
        grid.style.display = 'none';
        if (notesArea) notesArea.style.display = 'block';
        (target.units || []).forEach((u, i) => {
            const pdfLink = (target.links || [])[i] || '#';
            const vidLink = (target.vids || [])[i] || '';
            const animDelay = (i * 0.05).toFixed(2);

            unitList.innerHTML += `
                <div class="unit-item" style="animation-delay: ${animDelay}s" onclick="window.openPdf('${pdfLink}')">
                    <span><i class="fa-solid fa-file-pdf" style="color:#ef4444; margin-right:10px;"></i> ${u}</span>
                    <div class="action-btns" onclick="event.stopPropagation()">
                      <button class="icon-action-btn" onclick="window.shareUnit('${path.join('/')}', '${u}')" title="Share Link"><i class="fa-solid fa-share-nodes" style="color:#2ecc71;"></i></button>
                      ${vidLink ? `<button class="icon-action-btn" onclick="window.openVideo('${vidLink}', '${u}')" title="Watch Video"><i class="fa-brands fa-youtube" style="color:#ff0000;"></i></button>` : ''}
                      <button class="icon-action-btn" onclick="window.openPdf('${pdfLink}')" title="Open Full Page PDF"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
                    </div>
                </div>`;
        });
    } else {
        grid.style.display = 'grid';
        if (notesArea) notesArea.style.display = 'none';

        const keys = Object.keys(target).filter(k => !k.startsWith('_')).sort((a,b) => (target[a]._rank || 99) - (target[b]._rank || 99));
        
        keys.forEach((k, idx) => {
            const animDelay = (idx * 0.06).toFixed(2);
            grid.innerHTML += `
                <div class="card" style="animation-delay: ${animDelay}s" onclick="window.moveIn('${k}')">
                    <i class="fa-solid ${path.length === 0 ? 'fa-graduation-cap' : 'fa-book-open'}" style="font-size:2.5rem; color:var(--primary); margin-bottom:15px;"></i>
                    <h3 style="font-size:1rem;">${k}</h3>
                </div>`;
        });
    }
}

// Navigation & Actions attached to window
window.moveIn = (key) => { path.push(key); render(); };
window.goBack = () => { path.pop(); render(); };
window.jumpTo = (idx) => { path = path.slice(0, idx + 1); render(); };
window.jumpToPath = (pathStr) => { path = pathStr.split('/'); render(); };

window.openPdf = (url) => {
  if (url && url !== '#') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

window.openVideo = (url, name) => {
  const nameEl = document.getElementById('v-video-name');
  if (nameEl) nameEl.innerText = name;
  let vidId = '';
  if(url.includes('v=')) vidId = url.split('v=')[1].split('&')[0];
  else if(url.includes('youtu.be/')) vidId = url.split('youtu.be/')[1].split('?')[0];
  const frame = document.getElementById('video-frame');
  if (frame) frame.src = vidId ? `https://www.youtube.com/embed/${vidId}?autoplay=1` : url;
  const viewer = document.getElementById('video-viewer');
  if (viewer) viewer.style.display = 'flex';
};

window.closeVideo = () => {
  const frame = document.getElementById('video-frame');
  if (frame) frame.src = '';
  const viewer = document.getElementById('video-viewer');
  if (viewer) viewer.style.display = 'none';
};

window.shareUnit = (pathStr, name) => {
  const parts = pathStr.split('/').filter(Boolean).map(encodeURIComponent);
  const baseUrl = window.location.href.split('#')[0].replace(/\/$/, '');
  const shareUrl = `${baseUrl}/#/Home/${parts.join('/')}/${encodeURIComponent(name)}`;
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl);
  }
  
  const toast = document.getElementById('toast');
  if (toast) {
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2500);
  }

  if (navigator.share) {
    try {
      navigator.share({ title: name, text: `Study Hub notes for ${name}`, url: shareUrl });
    } catch(e){}
  }
};

// Support Form Actions
window.openHelp = () => { const el = document.getElementById('help-panel'); if (el) el.style.display = 'flex'; };
window.closeHelp = () => { const el = document.getElementById('help-panel'); if (el) el.style.display = 'none'; };
window.sendReport = () => {
  const msgEl = document.getElementById('helpMsg');
  const msg = msgEl ? msgEl.value : '';
  if (msg.trim()) {
    onValue(msgRef, (snap) => {
      const currentInbox = (snap.exists() && snap.val().inbox) ? snap.val().inbox : [];
      currentInbox.push({ text: msg.trim(), time: new Date().toLocaleString() });
      set(msgRef, { inbox: currentInbox });
    }, { onlyOnce: true });
    alert("Report sent to Study Hub support!");
    if (msgEl) msgEl.value = '';
    window.closeHelp();
  }
};

// Search Input Listener
document.addEventListener('DOMContentLoaded', () => {
  render();
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      render();
    });
  }
});
