// PaperHub Main Logic with Universal Firebase Compatibility, Full-Page Reader View & Custom Deep-Link Sharing

// Firebase Configuration (Study Hub)
const firebaseConfig = {
    apiKey: "AIzaSyDEMuw60DEiC1WDRdQ5vslBKS8LimB_Uj0",
    authDomain: "studyhub-33164.firebaseapp.com",
    projectId: "studyhub-33164",
    storageBucket: "studyhub-33164.firebasestorage.app",
    messagingSenderId: "918352715015",
    appId: "1:918352715015:web:ab2ba28aa9456aba32b9a2"
};

// Application State Variables
let allPapers = [];
let isAdmin = false;
let currentView = 'grid';
let fClicks = 0;
let mClicks = 0;
let db = null;
let papersCol = null;
let activeReaderPaperId = null;

// DOM Elements
const papersContainer = document.getElementById('papers-container');
const searchInput = document.getElementById('mSearch');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const adminPanel = document.getElementById('admin-panel');
const adminActiveBadge = document.getElementById('adminActiveBadge');
const lockAdminBtn = document.getElementById('lockAdminBtn');
const saveBtnText = document.getElementById('saveBtnText');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const paperForm = document.getElementById('paperForm');
const saveBtn = document.getElementById('save-btn');

// Secret Modal Elements
const overlay = document.getElementById('overlay');
const secretModal = document.getElementById('secretModal');
const modalHeading = document.getElementById('modalHeading');
const footerTrigger = document.getElementById('footerTrigger');
const secretInputGroup = document.getElementById('secretInputGroup');
const secretPassInput = document.getElementById('secretPassInput');
const secretSubmitBtn = document.getElementById('secretSubmitBtn');

// Full-Page Reader Elements
const fullPageReader = document.getElementById('fullPageReader');
const readerBackBtn = document.getElementById('readerBackBtn');
const readerShareBtn = document.getElementById('readerShareBtn');
const readerTitle = document.getElementById('readerTitle');
const readerSubjectBadge = document.getElementById('readerSubjectBadge');
const readerBody = document.getElementById('readerBody');

// Fallback Sample Resources
const SAMPLE_PAPERS = [
    {
        id: "demo-1",
        title: "Calculus & Linear Algebra Final Exam Papers - 2025",
        subject: "Mathematics",
        link: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
    },
    {
        id: "demo-2",
        title: "Computer Networks & Protocols Comprehensive Study Guide",
        subject: "Computer Science",
        link: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: "demo-3",
        title: "Data Structures & Algorithms - Complete Reference Notes",
        subject: "Computer Science",
        link: "https://www.orimi.com/pdf-test.pdf"
    },
    {
        id: "demo-4",
        title: "Quantum Physics & Engineering Mechanics Problems",
        subject: "Physics & Engineering",
        link: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80"
    }
];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    renderSkeletons();
    initFirebase();
    initEventListeners();
});

// Render Shimmer Skeletons
function renderSkeletons() {
    papersContainer.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        const sk = document.createElement('div');
        sk.className = 'skeleton-box';
        sk.innerHTML = `
            <div class="skeleton-img"></div>
            <div class="skeleton-line" style="width: 80%;"></div>
            <div class="skeleton-line" style="width: 50%;"></div>
        `;
        papersContainer.appendChild(sk);
    }
}

// Initialize Firebase Realtime Connection
function initFirebase() {
    try {
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();
            papersCol = db.collection("papers");

            // Realtime Listener
            papersCol.onSnapshot((snapshot) => {
                const docs = snapshot.docs.map(doc => {
                    const data = doc.data() || {};
                    return {
                        id: doc.id,
                        title: data.title || data.name || 'Untitled Document',
                        subject: data.subject || data.category || '',
                        link: data.link || data.url || ''
                    };
                });

                if (docs.length > 0) {
                    allPapers = docs;
                } else {
                    allPapers = docs.length ? docs : [];
                }

                applyFiltersAndRender();
                checkDeepLinkUrl();
            }, (error) => {
                console.warn("Firestore snapshot notice:", error);
                if (allPapers.length === 0) {
                    allPapers = SAMPLE_PAPERS;
                }
                applyFiltersAndRender();
                checkDeepLinkUrl();
            });
        } else {
            console.warn("Operating in local demo mode.");
            allPapers = SAMPLE_PAPERS;
            applyFiltersAndRender();
            checkDeepLinkUrl();
        }
    } catch (e) {
        console.error("Firebase init error:", e);
        allPapers = SAMPLE_PAPERS;
        applyFiltersAndRender();
        checkDeepLinkUrl();
    }
}

// Smart Subject Extraction
function getPaperSubject(item) {
    if (item.subject && item.subject.trim()) {
        return item.subject.trim();
    }

    const title = (item.title || '').toLowerCase();

    if (title.match(/(calculus|algebra|math|geometry|trigonometry|matrices|statistics|probability|equations)/)) {
        return "Mathematics";
    }
    if (title.match(/(computer|programming|java|python|code|data structure|algorithm|network|software|database|web|html|os|operating system)/)) {
        return "Computer Science";
    }
    if (title.match(/(physics|mechanics|quantum|thermodynamics|circuit|electrical|engineering|electromagnetism)/)) {
        return "Physics & Engineering";
    }
    if (title.match(/(chemistry|organic|inorganic|biology|biochemistry|medical|anatomy)/)) {
        return "Chemistry & Biology";
    }
    if (title.match(/(english|literature|history|economics|finance|business|management)/)) {
        return "Humanities & Commerce";
    }

    return "General Studies";
}

// Slugify Title Helper
function slugifyTitle(title) {
    if (!title) return 'paper';
    return String(title)
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Generate Present Domain + /papername Share URL
function getPaperShareUrl(item) {
    const slug = slugifyTitle(item.title);
    const origin = window.location.origin;
    let pathname = window.location.pathname;

    if (pathname.endsWith('/index.html')) {
        pathname = pathname.substring(0, pathname.length - 10);
    }
    if (!pathname.endsWith('/')) {
        pathname += '/';
    }

    return `${origin}${pathname}${slug}`;
}

// Handle Deep Link Opening on Page Load
function checkDeepLinkUrl() {
    if (!allPapers.length) return;

    const pathSlug = window.location.pathname.split('/').filter(Boolean).pop();
    const searchStr = window.location.search.replace(/^\?/, '');
    const hashSlug = window.location.hash.replace(/^#\/?/, '');

    const urlParams = new URLSearchParams(window.location.search);
    const paramSlug = urlParams.get('paper') || searchStr.split('&')[0];

    const rawTarget = (paramSlug || hashSlug || pathSlug || '').toLowerCase();
    if (!rawTarget || rawTarget === 'index.html' || rawTarget.includes('.html')) return;

    const matchedPaper = allPapers.find(p => {
        const pSlug = slugifyTitle(p.title);
        return pSlug === rawTarget || p.id === rawTarget || p.title.toLowerCase().includes(rawTarget.replace(/-/g, ' '));
    });

    if (matchedPaper) {
        setTimeout(() => {
            window.openFullPageReader(matchedPaper.id);
            showToast(`Opened shared paper: "${matchedPaper.title}"`, "success");
        }, 300);
    }
}

// Apply Filters & Search Query
function applyFiltersAndRender() {
    const query = searchInput.value.toLowerCase().trim();

    let filtered = allPapers.filter(item => {
        const title = (item.title || '').toLowerCase();
        const link = (item.link || '').toLowerCase();
        const subject = getPaperSubject(item).toLowerCase();
        return title.includes(query) || link.includes(query) || subject.includes(query);
    });

    renderUI(filtered);
}

// Determine File Type Metadata
function getItemType(link) {
    if (!link) return { label: 'Web Link', class: 'pdf', icon: 'fa-solid fa-globe' };
    const lower = link.toLowerCase();
    if (lower.includes('drive.google.com')) {
        return { label: 'Google Drive', class: 'drive', icon: 'fa-brands fa-google-drive' };
    } else if (lower.includes('.pdf')) {
        return { label: 'PDF File', class: 'pdf', icon: 'fa-solid fa-file-pdf' };
    } else if (lower.match(/\.(jpeg|jpg|gif|png|webp|svg)/) || lower.includes('imgur.com') || lower.includes('unsplash.com')) {
        return { label: 'Image', class: 'image', icon: 'fa-solid fa-file-image' };
    }
    return { label: 'Document', class: 'pdf', icon: 'fa-solid fa-file-lines' };
}

// Format Viewer URLs for Embed
function getFormattedViewerUrl(item) {
    const rawLink = item.link || '';
    const lower = rawLink.toLowerCase();
    const isDrive = lower.includes('drive.google.com');
    const isPdf = lower.includes('.pdf') || isDrive;
    let displayUrl = rawLink;

    if (isDrive) {
        let fileId = '';
        if (rawLink.includes('/d/')) {
            fileId = rawLink.split('/d/')[1].split('/')[0];
        } else {
            try {
                fileId = new URL(rawLink).searchParams.get('id') || '';
            } catch (e) {
                fileId = '';
            }
        }
        if (fileId) {
            displayUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${fileId}`)}&embedded=true`;
        }
    } else if (isPdf && rawLink) {
        displayUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(rawLink)}&embedded=true`;
    }

    return { isPdf, displayUrl };
}

// Render Paper Cards
function renderUI(data) {
    papersContainer.innerHTML = '';

    if (currentView === 'list') {
        papersContainer.classList.add('list-view');
    } else {
        papersContainer.classList.remove('list-view');
    }

    if (!data || data.length === 0) {
        papersContainer.innerHTML = `
            <div class="empty-box">
                <div class="empty-icon"><i class="fa-solid fa-folder-open"></i></div>
                <h3>No papers found in repository</h3>
                <p>Try clearing your search query.</p>
            </div>
        `;
        return;
    }

    data.forEach(item => {
        const subjectName = getPaperSubject(item);
        const { isPdf, displayUrl } = getFormattedViewerUrl(item);
        const titleText = item.title || 'Untitled Document';
        const linkUrl = item.link || '#';

        const card = document.createElement('div');
        card.className = 'paper-card';
        card.setAttribute('data-id', item.id);
        
        // Direct Full-Page Reader Click Event
        card.onclick = (e) => {
            if (e.target.closest('.admin-bar')) return;
            window.openFullPageReader(item.id);
        };

        card.innerHTML = `
            <div class="card-media">
                <div class="hover-overlay">
                    <span class="open-notice-chip">
                        <i class="fa-solid fa-book-open"></i> Click to Open Reader
                    </span>
                </div>

                ${isPdf 
                    ? `<iframe src="${displayUrl}" loading="lazy" title="${escapeHtml(titleText)}"></iframe>`
                    : `<img src="${escapeHtml(linkUrl)}" loading="lazy" alt="${escapeHtml(titleText)}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80';">`
                }
            </div>

            <div class="card-info">
                <h3 class="card-heading" title="${escapeHtml(titleText)}">${escapeHtml(titleText)}</h3>
                <div class="card-footer-meta">
                    <span><i class="fa-solid fa-circle-check"></i> PaperHub Verified</span>
                    <span><i class="fa-solid fa-chevron-right"></i></span>
                </div>
            </div>

            ${isAdmin ? `
                <div class="admin-bar" onclick="event.stopPropagation();">
                    <button class="admin-btn edit" onclick="event.stopPropagation(); window.editMe('${item.id}', '${escapeHtml(titleText)}', '${escapeHtml(linkUrl)}', '${escapeHtml(subjectName)}')">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="admin-btn delete" onclick="event.stopPropagation(); window.deleteMe('${item.id}')">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            ` : ''}
        `;

        papersContainer.appendChild(card);
    });
}

// Escape HTML Utility
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// OPEN FULL-PAGE DOCUMENT READER VIEW
window.openFullPageReader = (paperId) => {
    const item = allPapers.find(p => p.id === paperId);
    if (!item) return;

    activeReaderPaperId = paperId;
    const { isPdf, displayUrl } = getFormattedViewerUrl(item);
    const subjectName = getPaperSubject(item);
    const titleText = item.title || 'Untitled Document';
    const linkUrl = item.link || '#';

    readerTitle.innerText = titleText;
    readerSubjectBadge.innerHTML = `<i class="fa-solid fa-book-bookmark"></i> ${escapeHtml(subjectName)}`;

    if (isPdf) {
        readerBody.innerHTML = `<iframe src="${displayUrl}" title="${escapeHtml(titleText)}"></iframe>`;
    } else {
        readerBody.innerHTML = `<img src="${escapeHtml(linkUrl)}" alt="${escapeHtml(titleText)}">`;
    }

    fullPageReader.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};

// CLOSE FULL-PAGE DOCUMENT READER VIEW
window.closeFullPageReader = () => {
    fullPageReader.classList.add('hidden');
    readerBody.innerHTML = '';
    document.body.style.overflow = '';
    activeReaderPaperId = null;
};

// Event Listeners Initialization
function initEventListeners() {
    // Reader Header Controls
    readerBackBtn.addEventListener('click', window.closeFullPageReader);
    readerShareBtn.addEventListener('click', () => {
        if (activeReaderPaperId) {
            window.sharePaperLink(activeReaderPaperId);
        }
    });

    // Secret Admin Triggers
    footerTrigger.addEventListener('click', () => {
        fClicks++;
        if (fClicks === 5) {
            overlay.classList.remove('hidden');
            secretModal.classList.remove('hidden');
            fClicks = 0;
            mClicks = 0;
            secretInputGroup.classList.add('hidden');
            showToast("Security Prompt Initiated", "info");
        }
    });

    modalHeading.addEventListener('click', () => {
        mClicks++;
        if (mClicks === 5) {
            secretInputGroup.classList.remove('hidden');
            secretPassInput.focus();
            showToast("Enter Admin Credentials", "info");
            mClicks = 0;
        }
    });

    secretSubmitBtn.addEventListener('click', attemptAdminUnlock);
    secretPassInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') attemptAdminUnlock();
    });

    lockAdminBtn.addEventListener('click', () => {
        isAdmin = false;
        adminPanel.classList.add('hidden');
        adminActiveBadge.classList.add('hidden');
        showToast("Admin Mode Locked", "info");
        applyFiltersAndRender();
    });

    // Save Data to Cloud
    paperForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('paper-title').value.trim();
        const subject = document.getElementById('paper-subject').value.trim();
        const link = document.getElementById('paper-link').value.trim();
        const editId = document.getElementById('edit-id').value;

        if (!title || !link) {
            showToast("Please enter both Title and Resource Link.", "error");
            return;
        }

        saveBtn.disabled = true;
        saveBtnText.innerText = "Saving to Cloud...";

        try {
            if (papersCol) {
                if (editId) {
                    await papersCol.doc(editId).update({ title, subject, link });
                    showToast("Document updated in Firestore!", "success");
                } else {
                    await papersCol.add({ title, subject, link, createdAt: new Date() });
                    showToast("New paper saved to Firestore!", "success");
                }
            } else {
                if (editId) {
                    const idx = allPapers.findIndex(p => p.id === editId);
                    if (idx !== -1) allPapers[idx] = { id: editId, title, subject, link };
                } else {
                    allPapers.unshift({ id: 'local-' + Date.now(), title, subject, link });
                }
                applyFiltersAndRender();
                showToast("Saved to local workspace!", "success");
            }
            resetForm();
        } catch (err) {
            console.error(err);
            showToast("Permission Error: Please check database rules.", "error");
        } finally {
            saveBtn.disabled = false;
        }
    });

    cancelEditBtn.addEventListener('click', resetForm);

    // Search Controls
    searchInput.addEventListener('input', (e) => {
        if (e.target.value) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
        applyFiltersAndRender();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        applyFiltersAndRender();
        searchInput.focus();
    });

    // Ctrl+K Search Shortcut
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
        }
    });

    // Layout Toggles
    document.getElementById('gridViewBtn').addEventListener('click', () => {
        document.getElementById('gridViewBtn').classList.add('active');
        document.getElementById('listViewBtn').classList.remove('active');
        currentView = 'grid';
        applyFiltersAndRender();
    });

    document.getElementById('listViewBtn').addEventListener('click', () => {
        document.getElementById('listViewBtn').classList.add('active');
        document.getElementById('gridViewBtn').classList.remove('active');
        currentView = 'list';
        applyFiltersAndRender();
    });
}

// Password Unlock
function attemptAdminUnlock() {
    const password = secretPassInput.value.trim();
    if (password === "study11") {
        isAdmin = true;
        adminPanel.classList.remove('hidden');
        adminActiveBadge.classList.remove('hidden');
        closeModal();
        showToast("Welcome Admin! Control panel unlocked.", "success");
        applyFiltersAndRender();
    } else {
        showToast("Incorrect System Password", "error");
        secretPassInput.value = '';
    }
}

function resetForm() {
    document.getElementById('paper-title').value = '';
    document.getElementById('paper-subject').value = '';
    document.getElementById('paper-link').value = '';
    document.getElementById('edit-id').value = '';
    saveBtnText.innerText = "Save to Cloud";
    cancelEditBtn.classList.add('hidden');
}

// Global Window Methods
window.closeModal = () => {
    overlay.classList.add('hidden');
    secretModal.classList.add('hidden');
    secretPassInput.value = '';
    secretInputGroup.classList.add('hidden');
};

window.editMe = (id, title, link, subject) => {
    document.getElementById('paper-title').value = title;
    document.getElementById('paper-subject').value = subject || '';
    document.getElementById('paper-link').value = link;
    document.getElementById('edit-id').value = id;
    saveBtnText.innerText = "Update Paper";
    cancelEditBtn.classList.remove('hidden');
    adminPanel.scrollIntoView({ behavior: 'smooth' });
    document.getElementById('paper-title').focus();
};

window.deleteMe = async (id) => {
    if (confirm("Are you sure you want to delete this paper from PaperHub?")) {
        try {
            if (papersCol && !id.startsWith('demo-') && !id.startsWith('local-')) {
                await papersCol.doc(id).delete();
                showToast("Paper deleted from Firestore.", "success");
            } else {
                allPapers = allPapers.filter(p => p.id !== id);
                applyFiltersAndRender();
                showToast("Paper removed.", "success");
            }
        } catch (err) {
            console.error(err);
            showToast("Failed to delete paper.", "error");
        }
    }
};

// Share Paper Link Handler (Present Domain + /papername)
window.sharePaperLink = (paperId) => {
    const item = allPapers.find(p => p.id === paperId);
    if (!item) {
        showToast("Paper unavailable for sharing.", "error");
        return;
    }

    const shareUrl = getPaperShareUrl(item);

    function copyFallback(text) {
        const tempInput = document.createElement('input');
        tempInput.style.position = 'fixed';
        tempInput.style.opacity = '0';
        tempInput.value = text;
        document.body.appendChild(tempInput);
        tempInput.focus();
        tempInput.select();
        try {
            document.execCommand('copy');
            showToast(`Share link copied: ${text}`, "success");
        } catch (e) {
            showToast("Copied share link to clipboard!", "success");
        }
        document.body.removeChild(tempInput);
    }

    if (navigator.clipboard && window.isSecureContext !== false) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            showToast(`Share link copied: ${shareUrl}`, "success");
        }).catch(() => {
            copyFallback(shareUrl);
        });
    } else {
        copyFallback(shareUrl);
    }

    if (navigator.share) {
        navigator.share({
            title: item.title,
            text: `View "${item.title}" on PaperHub`,
            url: shareUrl
        }).catch(() => {});
    }
};

// Floating Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;

    let icon = 'fa-solid fa-circle-info';
    if (type === 'success') icon = 'fa-solid fa-circle-check';
    if (type === 'error') icon = 'fa-solid fa-triangle-exclamation';

    toast.innerHTML = `<i class="${icon}"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
