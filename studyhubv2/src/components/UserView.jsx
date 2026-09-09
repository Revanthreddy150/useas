import React, { useState } from 'react';
import { Youtube, ExternalLink, Folder, Share2, Check } from 'lucide-react';

// Custom Mortarboard Graduation Cap SVG matching reference site
const MortarboardIcon = ({ size = 52, color = "#635bff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18C5 19.39 8.13 21 12 21C15.87 21 19 19.39 19 17.18V13.18L12 17L5 13.18Z"/>
  </svg>
);

// Custom Book SVG matching reference site
const BookIcon = ({ size = 52, color = "#635bff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M19 2H6C4.34 2 3 3.34 3 5V19C3 20.66 4.34 22 6 22H19C20.66 22 22 20.66 22 19V5C22 3.34 20.66 2 19 2ZM11 11H7V9H11V11ZM17 15H7V13H17V15ZM17 11H13V9H17V11Z"/>
  </svg>
);

// Custom PDF Icon matching reference site
const PdfBadgeIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#ef4444">
    <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM13 9V3.5L18.5 9H13Z"/>
    <text x="7" y="18" fill="#ffffff" fontSize="7" fontWeight="bold" fontFamily="sans-serif">PDF</text>
  </svg>
);

export const UserView = ({ 
  treeData,
  pathStack,
  currentNode, 
  onNavigateDown, 
  onOpenPdf, 
  onOpenYoutube,
  searchTerm 
}) => {
  const [copiedId, setCopiedId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // Helper to open PDF directly in full browser tab
  const handleOpenPdfDirectly = (url) => {
    if (url && url !== '#') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Helper to generate location-based deep link and share/copy
  const handleShareUnit = (e, fullPathArray, unitName) => {
    e.stopPropagation();
    
    // Construct clean location path: webname/Home/Repo/Subfolder/Subject/UnitName
    const pathSegmentStr = fullPathArray.map(p => encodeURIComponent(p)).join('/');
    const shareUrl = `${window.location.origin}/#/Home/${pathSegmentStr}/${encodeURIComponent(unitName)}`;

    // Copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
    } else {
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }

    setCopiedId(unitName);
    setToastMessage('Link Copied to Clipboard!');
    setTimeout(() => {
      setCopiedId(null);
      setToastMessage('');
    }, 2500);

    // Invoke native share drawer if available on mobile
    if (navigator.share) {
      try {
        navigator.share({
          title: `Study Hub - ${unitName}`,
          text: `Study Hub notes for ${unitName}`,
          url: shareUrl
        });
      } catch (err) {
        // Ignored if user cancels share prompt
      }
    }
  };

  // Global search filtering if search term is entered
  if (searchTerm && searchTerm.trim() !== '') {
    const term = searchTerm.toLowerCase();

    const findMatches = (node, path = []) => {
      let results = [];
      if (!node) return results;

      if (node._type === 'subject') {
        const units = node.units || [];
        const links = node.links || [];
        const vids = node.vids || [];
        units.forEach((unitName, idx) => {
          if (unitName && unitName.toLowerCase().includes(term)) {
            results.push({
              type: 'unit',
              name: unitName,
              pdfUrl: links[idx] || '#',
              youtubeUrl: vids[idx] || '',
              path: path
            });
          }
        });
      } else {
        const keys = Object.keys(node).filter(k => !k.startsWith('_'));
        keys.forEach(k => {
          if (k.toLowerCase().includes(term)) {
            results.push({
              type: 'folder',
              key: k,
              path: [...path, k]
            });
          }
          results = results.concat(findMatches(node[k], [...path, k]));
        });
      }

      return results;
    };

    const matches = findMatches(treeData);

    return (
      <div style={{ width: '100%' }}>
        {toastMessage && (
          <div id="toast" style={{ display: 'block' }}>
            <Check size={16} style={{ display: 'inline', marginRight: '6px' }} />
            {toastMessage}
          </div>
        )}

        <h3 style={{ fontSize: '1rem', color: '#64748b', marginBottom: '16px' }}>
          Search Results for "{searchTerm}": ({matches.length} found)
        </h3>

        {matches.length === 0 ? (
          <div className="empty-state">
            <h3>No results found</h3>
            <p>Try searching for other subjects or topics.</p>
          </div>
        ) : (
          <div className="units-list">
            {matches.map((res, idx) => (
              <div 
                key={idx} 
                className="unit-row-card"
                onClick={() => res.type === 'unit' ? handleOpenPdfDirectly(res.pdfUrl) : onNavigateDown(res.key)}
                style={{ cursor: 'pointer' }}
              >
                <div className="unit-left">
                  {res.type === 'unit' ? <PdfBadgeIcon /> : <Folder color="#635bff" size={22} />}
                  <div>
                    <div className="unit-name">{res.type === 'unit' ? res.name : res.key}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Location: {res.path.join(' > ')}
                    </div>
                  </div>
                </div>

                <div className="unit-actions">
                  {res.type === 'unit' && (
                    <button
                      className="open-link-btn"
                      onClick={(e) => handleShareUnit(e, res.path, res.name)}
                      title="Share Note Location Link"
                      style={{ color: '#2ecc71', borderColor: '#2ecc71' }}
                    >
                      {copiedId === res.name ? <Check size={18} color="#2ecc71" /> : <Share2 size={18} />}
                    </button>
                  )}

                  {res.type === 'unit' && res.youtubeUrl && (
                    <button 
                      className="youtube-icon-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenYoutube(res.youtubeUrl, res.name);
                      }}
                      title="Watch Video Lesson"
                    >
                      <Youtube size={22} color="#ff0000" />
                    </button>
                  )}

                  {res.type === 'unit' && res.pdfUrl && (
                    <button 
                      className="open-link-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPdfDirectly(res.pdfUrl);
                      }}
                      title="Open Full Page PDF"
                    >
                      <ExternalLink size={18} />
                    </button>
                  )}

                  {res.type === 'folder' && (
                    <button 
                      className="btn-primary" 
                      style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateDown(res.key);
                      }}
                    >
                      View Folder
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!currentNode) {
    return (
      <div className="empty-state">
        <h3>Folder not found</h3>
      </div>
    );
  }

  // Subject View (Units List)
  if (currentNode._type === 'subject') {
    const units = currentNode.units || [];
    const links = currentNode.links || [];
    const vids = currentNode.vids || [];

    if (units.length === 0) {
      return (
        <div className="empty-state">
          <h3>No virtual notes added to this subject yet.</h3>
        </div>
      );
    }

    return (
      <div style={{ width: '100%' }}>
        {toastMessage && (
          <div id="toast" style={{ display: 'block' }}>
            <Check size={16} style={{ display: 'inline', marginRight: '6px' }} />
            {toastMessage}
          </div>
        )}

        <div className="units-list">
          {units.map((unitName, idx) => {
            const pdfUrl = links[idx] || '#';
            const youtubeUrl = vids[idx] || '';

            return (
              <div 
                key={idx} 
                className="unit-row-card"
                onClick={() => handleOpenPdfDirectly(pdfUrl)}
                style={{ cursor: 'pointer' }}
              >
                <div className="unit-left">
                  <PdfBadgeIcon />
                  <span className="unit-name">{unitName}</span>
                </div>

                <div className="unit-actions">
                  <button
                    className="open-link-btn"
                    onClick={(e) => handleShareUnit(e, pathStack, unitName)}
                    title="Share Location Link"
                    style={{ color: '#2ecc71', borderColor: 'rgba(46, 204, 113, 0.3)' }}
                  >
                    {copiedId === unitName ? <Check size={18} color="#2ecc71" /> : <Share2 size={18} />}
                  </button>

                  {youtubeUrl && (
                    <button 
                      className="youtube-icon-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenYoutube(youtubeUrl, unitName);
                      }}
                      title="Watch Video Lesson"
                    >
                      <Youtube size={24} color="#ff0000" />
                    </button>
                  )}

                  {pdfUrl && (
                    <button 
                      className="open-link-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPdfDirectly(pdfUrl);
                      }}
                      title="Open Full Page PDF"
                    >
                      <ExternalLink size={20} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Standard Folder/Repository Grid View
  const childKeys = Object.keys(currentNode)
    .filter(k => !k.startsWith('_'))
    .sort((a, b) => (currentNode[a]._rank || 99) - (currentNode[b]._rank || 99));

  if (childKeys.length === 0) {
    return (
      <div className="empty-state">
        <h3>No contents inside this folder</h3>
      </div>
    );
  }

  const isRoot = pathStack.length === 0;

  return (
    <div style={{ width: '100%' }}>
      <div className="cards-grid">
        {childKeys.map((key) => (
          <div 
            key={key} 
            className="repo-card"
            onClick={() => onNavigateDown(key)}
          >
            <div className="card-icon">
              {isRoot ? <MortarboardIcon /> : <BookIcon />}
            </div>
            <div className="card-title">{key}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
