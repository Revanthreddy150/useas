import React, { useState } from 'react';
import { ref, push, set, remove } from 'firebase/database';
import { db, seedDatabaseIfEmpty } from '../firebase';
import { Plus, Trash2, FolderPlus, FilePlus, Database, ArrowLeft } from 'lucide-react';

export const AdminPortal = ({ treeData, onClose }) => {
  const [activeTab, setActiveTab] = useState('add-repo');

  // Form states
  const [repoName, setRepoName] = useState('');
  const [parentPath, setParentPath] = useState('');
  const [subfolderName, setSubfolderName] = useState('');
  const [unitPath, setUnitPath] = useState('');
  const [unitName, setUnitName] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  const showStatus = (text, type = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
  };

  // Helper to build list of all subfolder paths for dropdown selection
  const getSubfolderOptions = () => {
    const options = [];
    if (!treeData) return options;

    const traverse = (node, pathKeys, pathNames) => {
      if (!node) return;
      
      const currentPathKey = pathKeys.join('/');
      const currentPathName = pathNames.join(' > ');
      options.push({ key: currentPathKey, name: currentPathName });

      if (node.subfolders) {
        Object.keys(node.subfolders).forEach(subKey => {
          traverse(
            node.subfolders[subKey], 
            [...pathKeys, 'subfolders', subKey], 
            [...pathNames, node.subfolders[subKey].name]
          );
        });
      }
    };

    Object.keys(treeData).forEach(repoKey => {
      traverse(
        treeData[repoKey], 
        ['repositories', repoKey], 
        [treeData[repoKey].name]
      );
    });

    return options;
  };

  const folderOptions = getSubfolderOptions();

  // Handle Add Repository
  const handleAddRepo = async (e) => {
    e.preventDefault();
    if (!repoName.trim()) return;

    try {
      const repoRef = ref(db, 'repositories');
      const newRef = push(repoRef);
      await set(newRef, {
        id: newRef.key,
        name: repoName.trim(),
        icon: 'graduation-cap',
        subfolders: {}
      });

      setRepoName('');
      showStatus('Repository added successfully!');
    } catch (err) {
      showStatus('Error adding repository: ' + err.message, 'error');
    }
  };

  // Handle Add Subfolder
  const handleAddSubfolder = async (e) => {
    e.preventDefault();
    if (!parentPath || !subfolderName.trim()) return;

    try {
      const targetRef = ref(db, `${parentPath}/subfolders`);
      const newRef = push(targetRef);
      await set(newRef, {
        id: newRef.key,
        name: subfolderName.trim(),
        subfolders: {},
        units: {}
      });

      setSubfolderName('');
      showStatus('Subfolder added successfully!');
    } catch (err) {
      showStatus('Error adding subfolder: ' + err.message, 'error');
    }
  };

  // Handle Add Unit / Note
  const handleAddUnit = async (e) => {
    e.preventDefault();
    if (!unitPath || !unitName.trim() || !pdfUrl.trim()) return;

    try {
      const targetRef = ref(db, `${unitPath}/units`);
      const newRef = push(targetRef);
      await set(newRef, {
        id: newRef.key,
        name: unitName.trim(),
        pdfUrl: pdfUrl.trim(),
        youtubeUrl: youtubeUrl.trim() || ''
      });

      setUnitName('');
      setPdfUrl('');
      setYoutubeUrl('');
      showStatus('Unit / Virtual Note added successfully!');
    } catch (err) {
      showStatus('Error adding unit: ' + err.message, 'error');
    }
  };

  // Delete item from Firebase
  const handleDeleteItem = async (path) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await remove(ref(db, path));
        showStatus('Item deleted successfully!');
      } catch (err) {
        showStatus('Error deleting item: ' + err.message, 'error');
      }
    }
  };

  // 1-Click Seed Sample Data
  const handleSeedData = async () => {
    if (window.confirm('Load sample reference data into Firebase? This will populate the repositories.')) {
      try {
        await seedDatabaseIfEmpty();
        showStatus('Reference sample data loaded!');
      } catch (err) {
        showStatus('Seed error: ' + err.message, 'error');
      }
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', color: '#635bff', display: 'flex', alignItems: 'center', gap: '10px' }}>
          STUDY HUB Admin Management
        </h2>
        <button className="back-btn" onClick={onClose}>
          <ArrowLeft size={16} /> Return to User Portal
        </button>
      </div>

      {statusMsg.text && (
        <div style={{ 
          padding: '12px 16px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          background: statusMsg.type === 'error' ? '#fee2e2' : '#dcfce7',
          color: statusMsg.type === 'error' ? '#991b1b' : '#166534',
          fontWeight: 600
        }}>
          {statusMsg.text}
        </div>
      )}

      {/* Admin Action Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button 
          className={`btn-secondary ${activeTab === 'add-repo' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('add-repo')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} /> Add Repository
        </button>
        <button 
          className={`btn-secondary ${activeTab === 'add-subfolder' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('add-subfolder')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <FolderPlus size={16} /> Add Subfolder
        </button>
        <button 
          className={`btn-secondary ${activeTab === 'add-unit' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('add-unit')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <FilePlus size={16} /> Add Unit / Notes
        </button>
        <button 
          className="btn-secondary"
          onClick={handleSeedData}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', background: '#0284c7' }}
        >
          <Database size={16} /> Seed Reference Data
        </button>
      </div>

      {/* Form Panels */}
      <div className="admin-card">
        {activeTab === 'add-repo' && (
          <form onSubmit={handleAddRepo}>
            <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>Add Top-Level Repository</h3>
            <div className="admin-form-group">
              <label className="admin-label">Repository Name</label>
              <input 
                type="text" 
                className="admin-input" 
                placeholder="e.g. 1ST YEAR NOTESES, SEM - 3 Noteses, records" 
                value={repoName}
                onChange={e => setRepoName(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary">
              Create Repository
            </button>
          </form>
        )}

        {activeTab === 'add-subfolder' && (
          <form onSubmit={handleAddSubfolder}>
            <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>Add Subfolder under Repository</h3>
            <div className="admin-form-group">
              <label className="admin-label">Select Target Parent Folder</label>
              <select 
                className="admin-input" 
                value={parentPath}
                onChange={e => setParentPath(e.target.value)}
                required
              >
                <option value="">-- Choose Repository / Parent Folder --</option>
                {folderOptions.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.name}</option>
                ))}
              </select>
            </div>
            <div className="admin-form-group">
              <label className="admin-label">New Subfolder Name</label>
              <input 
                type="text" 
                className="admin-input" 
                placeholder="e.g. BSC - DATA SCIENCE, Telugu, Python" 
                value={subfolderName}
                onChange={e => setSubfolderName(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary">
              Create Subfolder
            </button>
          </form>
        )}

        {activeTab === 'add-unit' && (
          <form onSubmit={handleAddUnit}>
            <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>Add Virtual Note / Unit Item</h3>
            <div className="admin-form-group">
              <label className="admin-label">Select Subfolder Location</label>
              <select 
                className="admin-input" 
                value={unitPath}
                onChange={e => setUnitPath(e.target.value)}
                required
              >
                <option value="">-- Choose Subfolder --</option>
                {folderOptions.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.name}</option>
                ))}
              </select>
            </div>
            <div className="admin-form-group">
              <label className="admin-label">Unit Title / Name</label>
              <input 
                type="text" 
                className="admin-input" 
                placeholder="e.g. unit - 1 ( గజేంద్ర మోక్షం ), Syllabus by AKNU" 
                value={unitName}
                onChange={e => setUnitName(e.target.value)}
                required
              />
            </div>
            <div className="admin-form-group">
              <label className="admin-label">PDF File Link URL</label>
              <input 
                type="url" 
                className="admin-input" 
                placeholder="https://example.com/notes.pdf or Google Drive link" 
                value={pdfUrl}
                onChange={e => setPdfUrl(e.target.value)}
                required
              />
            </div>
            <div className="admin-form-group">
              <label className="admin-label">Optional YouTube Video Link</label>
              <input 
                type="url" 
                className="admin-input" 
                placeholder="https://www.youtube.com/watch?v=... (Optional)" 
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary">
              Publish Unit Note
            </button>
          </form>
        )}
      </div>

      {/* Database Tree Overview with Delete Actions */}
      <div className="admin-card">
        <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>Live Database Content Hierarchy</h3>
        {!treeData || Object.keys(treeData).length === 0 ? (
          <p style={{ color: '#64748b' }}>No repositories found. Click "Seed Reference Data" to initialize standard dataset.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.keys(treeData).map(repoKey => {
              const repo = treeData[repoKey];
              return (
                <div key={repoKey} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, color: '#635bff' }}>🎓 {repo.name}</span>
                    <button 
                      className="btn-danger"
                      onClick={() => handleDeleteItem(`repositories/${repoKey}`)}
                    >
                      <Trash2 size={14} /> Delete Repo
                    </button>
                  </div>

                  {/* Render Subfolders */}
                  {repo.subfolders && Object.keys(repo.subfolders).map(subKey => {
                    const sub = repo.subfolders[subKey];
                    return (
                      <div key={subKey} style={{ marginLeft: '20px', marginTop: '8px', paddingLeft: '12px', borderLeft: '2px solid #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, color: '#334155' }}>📁 {sub.name}</span>
                          <button 
                            className="btn-danger" 
                            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                            onClick={() => handleDeleteItem(`repositories/${repoKey}/subfolders/${subKey}`)}
                          >
                            Delete
                          </button>
                        </div>

                        {/* Render Nested Subfolders */}
                        {sub.subfolders && Object.keys(sub.subfolders).map(nestedKey => {
                          const nested = sub.subfolders[nestedKey];
                          return (
                            <div key={nestedKey} style={{ marginLeft: '20px', marginTop: '6px', paddingLeft: '12px', borderLeft: '2px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 500, color: '#475569' }}>📖 {nested.name}</span>
                                <button 
                                  className="btn-danger" 
                                  style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                  onClick={() => handleDeleteItem(`repositories/${repoKey}/subfolders/${subKey}/subfolders/${nestedKey}`)}
                                >
                                  Delete
                                </button>
                              </div>

                              {/* Render Units */}
                              {nested.units && Object.keys(nested.units).map(unitKey => {
                                const unit = nested.units[unitKey];
                                return (
                                  <div key={unitKey} style={{ marginLeft: '16px', marginTop: '4px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                                    <span>📄 {unit.name}</span>
                                    <button 
                                      className="btn-danger" 
                                      style={{ padding: '1px 6px', fontSize: '0.65rem' }}
                                      onClick={() => handleDeleteItem(`repositories/${repoKey}/subfolders/${subKey}/subfolders/${nestedKey}/units/${unitKey}`)}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
