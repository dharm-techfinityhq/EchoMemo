
import React from 'react';
import { Memo, AppTheme } from '../types';

interface MemoCardProps {
  memo: Memo;
  theme: AppTheme;
  onClick: (memo: Memo) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

const MemoCard: React.FC<MemoCardProps> = ({ memo, theme, onClick, onDelete, onToggleFavorite }) => {
  const dateStr = new Date(memo.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });

  return (
    <div 
      onClick={() => onClick(memo)}
      className="group relative rounded-[2.5rem] p-8 border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden active:scale-[0.99]"
      style={{ backgroundColor: theme.surface, borderColor: theme.border }}
    >
      {/* Absolute positioned delete button for better hit area */}
      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          onDelete(memo.id); 
        }}
        className="absolute top-6 right-16 p-2 rounded-full opacity-0 group-hover:opacity-40 hover:opacity-100 hover:bg-red-50 text-red-500 transition-all z-20"
        title="Delete Memo"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      <div className="flex justify-between items-start mb-4">
        <h3 className="font-bold text-xl tracking-tight truncate pr-20" style={{ color: theme.textPrimary }}>
          {memo.title || "Untitled Memo"}
        </h3>
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            onToggleFavorite(memo.id); 
          }}
          className={`text-2xl transition-all hover:scale-125 z-20 ${memo.isFavorite ? 'text-amber-400' : 'opacity-20 hover:opacity-100'}`}
          style={!memo.isFavorite ? { color: theme.textSecondary } : {}}
        >
          {memo.isFavorite ? '●' : '○'}
        </button>
      </div>

      <p className="text-sm line-clamp-2 mb-6 font-medium leading-relaxed opacity-60" style={{ color: theme.textSecondary }}>
        {memo.content || (memo.audioEntries.length > 0 ? (memo.audioEntries[0].summary || "Voice recording.") : "Empty note.")}
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {memo.tags.slice(0, 3).map(tag => (
          <span 
            key={tag} 
            className="px-3 py-1 text-[9px] font-black rounded-full uppercase tracking-widest"
            style={{ backgroundColor: theme.bg, color: theme.textSecondary }}
          >
            {tag}
          </span>
        ))}
        {memo.audioEntries.length > 0 && (
          <span 
            className="px-3 py-1 text-[9px] font-black rounded-full flex items-center gap-1.5 uppercase tracking-widest"
            style={{ backgroundColor: `${theme.accent}1A`, color: theme.accent }}
          >
             {memo.audioEntries.length} Voice Record{memo.audioEntries.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-30" style={{ color: theme.textSecondary }}>
        <span>{dateStr}</span>
        <span className="opacity-0 group-hover:opacity-100 transition-all font-bold">Open Details →</span>
      </div>
    </div>
  );
};

export default MemoCard;
