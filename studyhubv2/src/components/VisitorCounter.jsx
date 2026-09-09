import React, { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db, incrementVisitorCount } from '../firebase';
import { Eye, Headphones } from 'lucide-react';

export const VisitorCounter = ({ onOpenSupport }) => {
  const [count, setCount] = useState(1380);

  useEffect(() => {
    // Increment visitor count once on mount
    incrementVisitorCount();

    // Subscribe to visitor count changes
    const countRef = ref(db, 'visitor_count');
    const unsubscribe = onValue(countRef, (snapshot) => {
      if (snapshot.exists()) {
        setCount(snapshot.val());
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      {/* Visitor Counter Floating Badge (Bottom Left) */}
      <div className="floating-visitor-badge">
        <Eye size={16} />
        <span>{count.toLocaleString()}</span>
      </div>

      {/* Floating Support Button (Bottom Right) */}
      <button 
        className="floating-support-btn" 
        onClick={onOpenSupport}
        title="Study Hub Help & Support"
      >
        <Headphones size={24} />
      </button>
    </>
  );
};
