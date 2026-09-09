import React, { useState } from 'react';
import { X, ExternalLink, Youtube, FileText, Lock, Headphones, Send } from 'lucide-react';

// PDF Viewer Modal
export const PdfModal = ({ pdfUrl, title, onClose }) => {
  if (!pdfUrl) return null;

  // Use Google Docs viewer as fallback for direct viewing of raw PDF links
  const embedUrl = pdfUrl.includes('drive.google.com') 
    ? pdfUrl.replace('/view', '/preview')
    : `https://docs.google.com/gview?url=${encodeURIComponent(pdfUrl)}&embedded=true`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '900px', height: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText color="#ef4444" size={20} />
            <span>{title}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body" style={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <iframe 
            src={embedUrl} 
            title={title}
            style={{ width: '100%', height: '100%', border: 'none', flex: 1 }}
          />
          <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>If document preview fails to load:</span>
            <a 
              href={pdfUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="open-link-btn" 
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600 }}
            >
              <ExternalLink size={16} /> Open PDF Directly
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

// YouTube Video Modal
export const YoutubeModal = ({ youtubeUrl, title, onClose }) => {
  if (!youtubeUrl) return null;

  // Extract video ID
  let videoId = '';
  if (youtubeUrl.includes('v=')) {
    videoId = youtubeUrl.split('v=')[1]?.split('&')[0];
  } else if (youtubeUrl.includes('youtu.be/')) {
    videoId = youtubeUrl.split('youtu.be/')[1]?.split('?')[0];
  }

  const embedSrc = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : youtubeUrl;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Youtube color="#ff0000" size={22} />
            <span>{title} - Video Lesson</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
            <iframe 
              src={embedSrc} 
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Admin Login Modal
export const AdminLoginModal = ({ isOpen, onClose, onLogin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === 'admin' || pin === 'admin123' || pin === '1234') {
      onLogin();
      setPin('');
      setError('');
      onClose();
    } else {
      setError('Incorrect Admin PIN. Try "admin123"');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} color="#635bff" />
            <span>Admin Access</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="admin-form-group">
              <label className="admin-label">Enter Admin Password / PIN</label>
              <input 
                type="password" 
                className="admin-input" 
                placeholder="Default PIN: admin123"
                value={pin}
                onChange={e => setPin(e.target.value)}
                autoFocus
              />
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</p>}
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>
              Unlock Admin Portal
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// Support Contact Modal
export const SupportModal = ({ isOpen, onClose }) => {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  if (!isOpen) return null;

  const handleSend = (e) => {
    e.preventDefault();
    if (message.trim()) {
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setMessage('');
        onClose();
      }, 2000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Headphones size={20} color="#635bff" />
            <span>Study Hub Support</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          {sent ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#16a34a' }}>
              <h3>Message Sent!</h3>
              <p style={{ fontSize: '0.9rem', color: '#64748b' }}>Our academic support team will contact you soon.</p>
            </div>
          ) : (
            <form onSubmit={handleSend}>
              <div className="admin-form-group">
                <label className="admin-label">Need help or missing notes?</label>
                <textarea 
                  className="admin-input" 
                  rows={4}
                  placeholder="Describe what subject, unit, or issue you need help with..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Send size={16} /> Send Request
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
