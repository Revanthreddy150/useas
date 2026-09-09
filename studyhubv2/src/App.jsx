import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db, seedDatabaseIfEmpty } from './firebase';
import { Header } from './components/Header';
import { UserView } from './components/UserView';
import { PdfModal, YoutubeModal, SupportModal } from './components/Modals';
import { VisitorCounter } from './components/VisitorCounter';

export function App() {
  const [treeData, setTreeData] = useState({});
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState('');

  // Navigation path stack for user portal: array of folder keys
  const [pathStack, setPathStack] = useState([]);
  
  // Search query
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [activePdf, setActivePdf] = useState(null);
  const [activeYoutube, setActiveYoutube] = useState(null);
  const [showSupport, setShowSupport] = useState(false);

  // Subscribe to Firebase Realtime Database portal_tree_data updates
  useEffect(() => {
    seedDatabaseIfEmpty();

    const dataRef = ref(db, 'portal_tree_data');
    const unsubscribe = onValue(dataRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setTreeData(data);
        handleDeepLinkCheck(data);
      } else {
        setTreeData({});
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Robust Deep Link Resolution & Redirection Engine
  const handleDeepLinkCheck = (data) => {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#/')) return;

    // Clean hash path: e.g. #/Home/1ST YEAR NOTESES/... or #/1ST YEAR NOTESES/...
    let cleanHash = hash.replace(/^#\//, '');
    if (cleanHash.startsWith('Home/')) {
      cleanHash = cleanHash.replace(/^Home\//, '');
    }

    const parts = cleanHash.split('/').map(decodeURIComponent).filter(Boolean);

    if (parts.length > 0) {
      const targetUnitName = parts[parts.length - 1].trim().toLowerCase();
      const folderPath = parts.slice(0, -1);

      // Attempt to traverse treeData to locate unit
      let currentNode = data;
      for (let key of folderPath) {
        if (currentNode && currentNode[key]) {
          currentNode = currentNode[key];
        } else {
          break;
        }
      }

      let foundUrl = null;

      if (currentNode && currentNode._type === 'subject') {
        const units = currentNode.units || [];
        const links = currentNode.links || [];
        const unitIdx = units.findIndex(u => (u || '').trim().toLowerCase() === targetUnitName);
        if (unitIdx !== -1 && links[unitIdx] && links[unitIdx] !== '#') {
          foundUrl = links[unitIdx];
        }
      }

      // Secondary global fallback search if exact hierarchy traversal was missing a key
      if (!foundUrl) {
        const findUnitGlobally = (node) => {
          if (!node) return null;
          if (node._type === 'subject') {
            const units = node.units || [];
            const links = node.links || [];
            const idx = units.findIndex(u => (u || '').trim().toLowerCase() === targetUnitName);
            if (idx !== -1 && links[idx] && links[idx] !== '#') {
              return links[idx];
            }
          } else {
            const keys = Object.keys(node).filter(k => !k.startsWith('_'));
            for (let k of keys) {
              const res = findUnitGlobally(node[k]);
              if (res) return res;
            }
          }
          return null;
        };

        foundUrl = findUnitGlobally(data);
      }

      if (foundUrl) {
        setRedirecting(true);
        setRedirectTarget(foundUrl);
        
        // Immediate full window replacement to target original PDF URL
        setTimeout(() => {
          window.location.replace(foundUrl);
        }, 400);
      } else if (folderPath.length > 0) {
        // If unit wasn't found, open the parent folder directly
        setPathStack(folderPath);
      }
    }
  };

  // Evaluate current node from pathStack
  const getCurrentNode = () => {
    let node = treeData;
    for (let key of pathStack) {
      if (node && node[key]) {
        node = node[key];
      } else {
        break;
      }
    }
    return node;
  };

  const currentNode = getCurrentNode();

  // Navigation handlers
  const handleNavigateDown = (key) => {
    setSearchTerm('');
    setPathStack(prev => [...prev, key]);
  };

  const handleBreadcrumbClick = (index) => {
    setSearchTerm('');
    if (index === -1) {
      setPathStack([]);
    } else {
      setPathStack(prev => prev.slice(0, index + 1));
    }
  };

  const handleBackClick = () => {
    setSearchTerm('');
    setPathStack(prev => (prev.length > 0 ? prev.slice(0, -1) : prev));
  };

  const currentFolderName = pathStack.length > 0 ? pathStack[pathStack.length - 1] : 'Home';

  // Build breadcrumbs array for Header
  const breadcrumbsArray = [
    { id: 'home', name: 'Home' },
    ...pathStack.map((key, idx) => ({ id: `path_${idx}`, name: key }))
  ];

  if (redirecting) {
    return (
      <div id="v2-loader" style={{ display: 'flex', textAlign: 'center', padding: '40px' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '16px', fontWeight: 600, color: '#635bff' }}>
          Accessing Resource & Redirecting...
        </p>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>
          If redirection takes a moment, <a href={redirectTarget} style={{ color: '#635bff', textDecoration: 'underline' }}>click here to open directly</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        pathStack={breadcrumbsArray}
        onBreadcrumbClick={(idx) => handleBreadcrumbClick(idx - 1)}
        onBackClick={handleBackClick}
        currentFolderName={currentFolderName}
      />

      {loading ? (
        <div className="empty-state">
          <h3>Loading Study Hub...</h3>
        </div>
      ) : (
        <UserView 
          treeData={treeData}
          pathStack={pathStack}
          currentNode={currentNode}
          onNavigateDown={handleNavigateDown}
          onOpenPdf={(url, title) => setActivePdf({ url, title })}
          onOpenYoutube={(url, title) => setActiveYoutube({ url, title })}
          searchTerm={searchTerm}
        />
      )}

      {/* Footer */}
      <footer className="footer-text">
        © {new Date().getFullYear()} STUDY HUB PORTAL • ACADEMIC RESOURCE NETWORK
      </footer>

      {/* Floating Visitor Counter (Bottom Left) & Support Button (Bottom Right) */}
      <VisitorCounter onOpenSupport={() => setShowSupport(true)} />

      {/* View Modals */}
      {activePdf && (
        <PdfModal 
          pdfUrl={activePdf.url} 
          title={activePdf.title} 
          onClose={() => setActivePdf(null)} 
        />
      )}

      {activeYoutube && (
        <YoutubeModal 
          youtubeUrl={activeYoutube.url} 
          title={activeYoutube.title} 
          onClose={() => setActiveYoutube(null)} 
        />
      )}

      <SupportModal 
        isOpen={showSupport}
        onClose={() => setShowSupport(false)}
      />
    </div>
  );
}

export default App;
