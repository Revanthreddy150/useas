import React from 'react';
import { Search, ChevronRight, ChevronLeft } from 'lucide-react';

export const Header = ({ 
  searchTerm, 
  setSearchTerm, 
  pathStack, 
  onBreadcrumbClick, 
  onBackClick,
  currentFolderName 
}) => {
  const isHome = pathStack.length <= 1;

  return (
    <header style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Web Brand Title */}
      <div className="header-brand">
        <h1 className="header-title">STUDY HUB</h1>
      </div>

      {/* Search Bar */}
      <div className="search-container">
        <div className="search-input-wrapper">
          <Search className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search subjects or topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Breadcrumbs Navigation Bar */}
      <div className="breadcrumbs-bar">
        {pathStack.map((item, index) => {
          const isLast = index === pathStack.length - 1;
          return (
            <React.Fragment key={item.id || index}>
              <span
                className={`breadcrumb-item ${isLast ? 'breadcrumb-active' : ''}`}
                onClick={() => !isLast && onBreadcrumbClick(index)}
              >
                {item.name}
              </span>
              {!isLast && <span className="breadcrumb-separator">&gt;</span>}
            </React.Fragment>
          );
        })}
      </div>

      {/* Title & Back Button Row (Only shown when navigated into folders or repositories) */}
      {!isHome && (
        <div className="nav-header-row">
          <h2 className="current-folder-title">{currentFolderName || 'CONTENT'}</h2>
          <button className="back-btn" onClick={onBackClick}>
            <ChevronLeft size={16} /> BACK
          </button>
        </div>
      )}
    </header>
  );
};
