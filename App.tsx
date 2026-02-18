
import React, { useState, useEffect, useRef } from 'react';
import { Memo, AppView, AppTheme, AudioEntry } from './types';
import MemoCard from './components/MemoCard';
import AudioVisualizer from './components/AudioVisualizer';
import { processAudioMemo, refineTextMemo } from './services/geminiService';

const THEMES: AppTheme[] = [
  {
    id: 'blackWhite',
    name: 'Onyx & Paper',
    bg: '#171717',
    surface: '#262626',
    primary: '#FFFFFF',
    secondary: '#A3A3A3',
    accent: '#FFFFFF',
    border: '#404040',
    textPrimary: '#FFFFFF',
    textSecondary: '#A3A3A3',
    visualizerColor: '#FFFFFF'
  },
  {
    id: 'pinkWhite',
    name: 'Rose Matte',
    bg: '#FDF2F8',
    surface: '#FFFFFF',
    primary: '#831843',
    secondary: '#BE185D',
    accent: '#F472B6',
    border: '#FCE7F3',
    textPrimary: '#831843',
    textSecondary: '#BE185D',
    visualizerColor: '#F472B6'
  },
  {
    id: 'blueWhite',
    name: 'Sky Matte',
    bg: '#EFF6FF',
    surface: '#FFFFFF',
    primary: '#1E3A8A',
    secondary: '#1D4ED8',
    accent: '#60A5FA',
    border: '#DBEAFE',
    textPrimary: '#1E3A8A',
    textSecondary: '#1D4ED8',
    visualizerColor: '#60A5FA'
  },
  {
    id: 'greenWhite',
    name: 'Forest Matte',
    bg: '#F0FDF4',
    surface: '#FFFFFF',
    primary: '#14532D',
    secondary: '#15803D',
    accent: '#4ADE80',
    border: '#DCFCE7',
    textPrimary: '#14532D',
    textSecondary: '#15803D',
    visualizerColor: '#4ADE80'
  },
  {
    id: 'brownWhite',
    name: 'Coffee Matte',
    bg: '#F2EBE3',
    surface: '#FFFFFF',
    primary: '#5D4E3F',
    secondary: '#8C7B6A',
    accent: '#A67C52',
    border: '#D9CFC4',
    textPrimary: '#5D4E3F',
    textSecondary: '#8C7B6A',
    visualizerColor: '#A67C52'
  }
];

// Helper function to format recording duration in MM:SS
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const App: React.FC = () => {
  const [memos, setMemos] = useState<Memo[]>(() => {
    const saved = localStorage.getItem('echomemo_data');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return parsed.map((m: any) => ({
        ...m,
        audioEntries: m.audioEntries || (m.audioUrl ? [{
          id: 'legacy-' + m.id,
          url: m.audioUrl,
          transcript: m.transcript,
          summary: m.summary,
          createdAt: m.createdAt
        }] : [])
      }));
    } catch (e) {
      return [];
    }
  });
  
  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('echomemo_theme');
    return saved ? JSON.parse(saved) : THEMES[4]; 
  });

  const [view, setView] = useState<AppView>(AppView.LIST);
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const [isThemeTrayOpen, setIsThemeTrayOpen] = useState(false);
  const [transitioningTheme, setTransitioningTheme] = useState<AppTheme | null>(null);
  const [isWaveActive, setIsWaveActive] = useState(false);

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [pendingMemoData, setPendingMemoData] = useState<{
    title: string;
    summary: string;
    transcript: string;
    audioUrl: string;
    tags: string[];
    isAppendingToId?: string;
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem('echomemo_data', JSON.stringify(memos));
  }, [memos]);

  useEffect(() => {
    localStorage.setItem('echomemo_theme', JSON.stringify(theme));
    document.body.style.backgroundColor = theme.bg;
  }, [theme]);

  const triggerThemeChange = (newTheme: AppTheme) => {
    if (newTheme.id === theme.id) return;
    setTransitioningTheme(newTheme);
    setIsWaveActive(true);
    setTimeout(() => setTheme(newTheme), 300);
    setTimeout(() => {
      setIsWaveActive(false);
      setTransitioningTheme(null);
    }, 600);
  };

  const startRecording = async () => {
    try {
      const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(userStream);
      setIsRecording(true);
      setRecordingTime(0);
      chunksRef.current = [];
      const recorder = new MediaRecorder(userStream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          try {
            const result = await processAudioMemo(base64Audio, 'audio/webm');
            setPendingMemoData({
              title: result.title,
              summary: result.summary,
              transcript: result.transcript,
              audioUrl: audioUrl,
              tags: result.tags,
              isAppendingToId: selectedMemo?.id
            });
            setShowSaveDialog(true);
          } catch (err) {
            setPendingMemoData({
              title: "New Voice Memo",
              summary: "Processing failed.",
              transcript: "",
              audioUrl: audioUrl,
              tags: ["Voice"],
              isAppendingToId: selectedMemo?.id
            });
            setShowSaveDialog(true);
          }
          setIsProcessing(false);
        };
        userStream.getTracks().forEach(track => track.stop());
        setStream(null);
      };
      recorder.start();
      timerRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFinalSave = () => {
    if (!pendingMemoData) return;
    
    const audioEntry: AudioEntry = {
      id: Date.now().toString(),
      url: pendingMemoData.audioUrl,
      transcript: pendingMemoData.transcript,
      summary: pendingMemoData.summary,
      createdAt: Date.now()
    };

    if (pendingMemoData.isAppendingToId) {
      setMemos(prev => prev.map(m => {
        if (m.id === pendingMemoData.isAppendingToId) {
          const updated = {
            ...m,
            audioEntries: [audioEntry, ...m.audioEntries],
            tags: Array.from(new Set([...m.tags, ...pendingMemoData.tags]))
          };
          if (selectedMemo?.id === m.id) setSelectedMemo(updated);
          return updated;
        }
        return m;
      }));
    } else {
      const newMemo: Memo = {
        id: Date.now().toString(),
        title: pendingMemoData.title,
        content: '',
        audioEntries: [audioEntry],
        createdAt: Date.now(),
        tags: pendingMemoData.tags,
        isFavorite: false,
      };
      setMemos(prev => [newMemo, ...prev]);
    }

    setPendingMemoData(null);
    setShowSaveDialog(false);
  };

  const deleteMemo = (id: string) => {
    if (confirm("Permanently delete this memo?")) {
      setMemos(prev => prev.filter(m => m.id !== id));
      if (selectedMemo?.id === id) {
        setView(AppView.LIST);
        setSelectedMemo(null);
      }
    }
  };

  const deleteAudioEntry = (memoId: string, entryId: string) => {
    if (confirm("Remove this audio recording?")) {
      setMemos(prev => prev.map(m => {
        if (m.id === memoId) {
          const updated = { 
            ...m, 
            audioEntries: m.audioEntries.filter(e => e.id !== entryId) 
          };
          if (selectedMemo?.id === m.id) {
            setSelectedMemo(updated);
          }
          return updated;
        }
        return m;
      }));
    }
  };

  const toggleFavorite = (id: string) => {
    setMemos(prev => prev.map(m => m.id === id ? { ...m, isFavorite: !m.isFavorite } : m));
  };

  const handleCreateTextMemo = () => {
    const newMemo: Memo = {
      id: Date.now().toString(),
      title: "Quick Note",
      content: "",
      audioEntries: [],
      createdAt: Date.now(),
      tags: ["Text"],
      isFavorite: false,
    };
    setMemos(prev => [newMemo, ...prev]);
    setSelectedMemo(newMemo);
    setView(AppView.DETAIL);
  };

  const updateMemo = (updates: Partial<Memo>) => {
    if (!selectedMemo) return;
    const updated = { ...selectedMemo, ...updates };
    setSelectedMemo(updated);
    setMemos(prev => prev.map(m => m.id === selectedMemo.id ? updated : m));
  };

  const handleRefineWithAI = async () => {
    if (!selectedMemo || !selectedMemo.content) return;
    setIsProcessing(true);
    try {
      const result = await refineTextMemo(selectedMemo.content);
      updateMemo({
        title: result.title || selectedMemo.title,
        content: result.content || selectedMemo.content,
        tags: Array.from(new Set([...selectedMemo.tags, ...(result.tags || [])]))
      });
    } catch (err) {} finally {
      setIsProcessing(false);
    }
  };

  const filteredMemos = memos.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen flex flex-col max-w-5xl mx-auto px-4 sm:px-6 relative" style={{ color: theme.textPrimary }}>
      <div className={`theme-wave-overlay ${isWaveActive ? 'active' : ''}`} style={{ backgroundColor: transitioningTheme?.bg || theme.bg }} />

      {isRecording && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/5 animate-in fade-in zoom-in duration-500 backdrop-blur-3xl">
          <div className="bg-wave-container" style={{ '--wave-color': theme.accent } as any}>
            <div className="bg-wave"></div>
            <div className="bg-wave"></div>
          </div>
          <div className="text-center space-y-12">
            <div className="space-y-4">
              <h2 className="text-7xl font-black tracking-tighter" style={{ color: theme.textPrimary }}>{formatTime(recordingTime)}</h2>
              <p className="text-sm font-black uppercase tracking-[0.3em] opacity-40">Listening to your thoughts...</p>
            </div>
            <div className="w-[80vw] max-w-2xl mx-auto">
              <AudioVisualizer stream={stream} isRecording={isRecording} themeColor={theme.visualizerColor} />
            </div>
            <button 
              onClick={stopRecording}
              className="px-12 py-6 rounded-full bg-red-500 text-white font-black text-xl shadow-2xl hover:bg-red-600 transition-all active:scale-95 flex items-center gap-4 mx-auto"
            >
              <div className="w-4 h-4 bg-white rounded-sm"></div>
              Finish Recording
            </button>
          </div>
        </div>
      )}

      {!isRecording && (
        <>
          <header className="py-10 flex justify-between items-center sticky top-0 backdrop-blur-xl z-30" style={{ backgroundColor: `${theme.bg}CC` }}>
            <div className="flex flex-col gap-4">
              <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: theme.textPrimary }}>EchoMemo</h1>
              <div className="flex items-center gap-4">
                <div className="split-circle flex-shrink-0 z-40 transition-transform active:scale-90" onClick={() => setIsThemeTrayOpen(!isThemeTrayOpen)}>
                  <div className="left" style={{ backgroundColor: theme.accent }}></div>
                  <div className="right" style={{ backgroundColor: theme.bg }}></div>
                </div>
                <div className={`theme-tray-expand flex gap-4 overflow-hidden`} style={{ maxWidth: isThemeTrayOpen ? '500px' : '0px', opacity: isThemeTrayOpen ? 1 : 0 }}>
                  {THEMES.filter(t => t.id !== theme.id).map(t => (
                    <div key={t.id} className="split-circle flex-shrink-0 scale-90" onClick={() => { triggerThemeChange(t); setIsThemeTrayOpen(false); }}>
                      <div className="left" style={{ backgroundColor: t.accent }}></div>
                      <div className="right" style={{ backgroundColor: t.bg }}></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={handleCreateTextMemo} className="p-4 rounded-full shadow-sm active:scale-90" style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}`, color: theme.textSecondary }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
          </header>

          <main className="flex-1 pb-40">
            {view === AppView.LIST ? (
              <div className="space-y-8 animate-in fade-in duration-700">
                <div className="relative group">
                  <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-14 pr-6 py-5 rounded-full shadow-sm focus:outline-none" style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}`, color: theme.textPrimary }} />
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 absolute left-5 top-1/2 -translate-y-1/2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                {filteredMemos.length === 0 && (
                  <div className="text-center py-20 opacity-40">No items found. Tap the mic to record.</div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {filteredMemos.map(memo => (
                    <MemoCard key={memo.id} memo={memo} theme={theme} onClick={(m) => { setSelectedMemo(m); setView(AppView.DETAIL); }} onDelete={deleteMemo} onToggleFavorite={toggleFavorite} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-[3rem] p-8 sm:p-14 shadow-2xl border transition-colors" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                <div className="flex justify-between items-center mb-10">
                  <button onClick={() => setView(AppView.LIST)} className="flex items-center gap-3 px-5 py-2.5 rounded-full font-bold text-sm" style={{ backgroundColor: theme.bg, color: theme.textSecondary }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 19l-7-7 7-7" /></svg> Back
                  </button>
                  <div className="flex gap-4">
                    <button onClick={startRecording} className="w-12 h-12 sm:w-auto sm:px-6 sm:py-3 bg-red-50 text-red-600 rounded-full font-bold text-sm hover:bg-red-100 flex items-center justify-center sm:gap-2 transition-all">
                       <div className="hidden sm:block w-2 h-2 bg-red-500 rounded-full animate-pulse"></div> 
                       <span className="hidden sm:inline">Add Voice</span>
                       <span className="sm:hidden text-2xl font-light leading-none">+</span>
                    </button>
                    <button 
                      disabled={isProcessing || !selectedMemo?.content} 
                      onClick={handleRefineWithAI} 
                      className="w-12 h-12 sm:w-auto sm:px-6 sm:py-3 text-white rounded-full font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center" 
                      style={{ backgroundColor: theme.accent }}
                    >
                      <span className="hidden sm:inline">{isProcessing ? "Polishing..." : "AI Refine"}</span>
                      <span className="sm:hidden text-lg">{isProcessing ? "..." : "✨"}</span>
                    </button>
                    <button onClick={() => selectedMemo && deleteMemo(selectedMemo.id)} className="p-3 text-red-400 hover:text-red-600 transition-colors" title="Delete Note">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <input type="text" value={selectedMemo?.title || ''} onChange={(e) => updateMemo({ title: e.target.value })} className="w-full text-5xl font-black mb-8 focus:outline-none border-none p-0 bg-transparent" style={{ color: theme.textPrimary }} placeholder="Note Title" />
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-30">Writing</label>
                    <textarea value={selectedMemo?.content || ''} onChange={(e) => updateMemo({ content: e.target.value })} placeholder="Type here..." className="w-full h-96 focus:outline-none text-xl resize-none bg-transparent" style={{ color: theme.textPrimary }} />
                  </div>
                  <div className="space-y-6">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-30">Audio Records</label>
                    <div className="space-y-4 max-h-[30rem] overflow-y-auto pr-2 scrollbar-hide">
                      {selectedMemo?.audioEntries.map(entry => (
                        <div key={entry.id} className="p-6 rounded-[2rem] border space-y-4" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{new Date(entry.createdAt).toLocaleString()}</span>
                            <button 
                              onClick={() => selectedMemo && deleteAudioEntry(selectedMemo.id, entry.id)} 
                              className="text-red-400 text-xs font-black uppercase tracking-tighter hover:text-red-600 transition-colors"
                            >
                              Delete Record
                            </button>
                          </div>
                          <audio src={entry.url} controls className="w-full h-10 custom-audio" />
                          {entry.summary && (
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase opacity-30">AI Summary</label>
                              <p className="text-sm font-medium italic opacity-70 leading-relaxed">{entry.summary}</p>
                            </div>
                          )}
                        </div>
                      ))}
                      {selectedMemo?.audioEntries.length === 0 && <div className="py-10 text-center opacity-30 italic">No voice records for this note.</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>

          <div className="fixed bottom-0 left-0 right-0 p-10 pointer-events-none z-40 flex justify-center">
            {isProcessing && (
              <div className="mb-8 px-10 py-5 rounded-full shadow-2xl border flex items-center gap-5 animate-pulse pointer-events-auto" style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
                <span className="font-bold uppercase tracking-widest text-xs opacity-50">Echo is thinking...</span>
              </div>
            )}
            {!isProcessing && view === AppView.LIST && (
              <button 
                onClick={startRecording} 
                className="h-24 w-24 rounded-full flex items-center justify-center transition-all shadow-2xl active:scale-90 pointer-events-auto" 
                style={{ backgroundColor: theme.primary }}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-10 w-10" 
                  style={{ color: theme.id === 'blackWhite' ? '#000000' : '#FFFFFF' }}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            )}
          </div>
        </>
      )}

      {showSaveDialog && pendingMemoData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/20">
          <div 
            className="w-full max-w-md rounded-[3rem] p-10 shadow-2xl border" 
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <h2 className="text-3xl font-black mb-2" style={{ color: theme.textPrimary }}>Processing Complete</h2>
            <p className="text-sm mb-8 font-medium opacity-50" style={{ color: theme.textSecondary }}>Set a title for this voice record.</p>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest block mb-2 opacity-30" style={{ color: theme.textPrimary }}>Title</label>
                <input 
                  type="text" 
                  value={pendingMemoData.title} 
                  onChange={(e) => setPendingMemoData({...pendingMemoData, title: e.target.value})} 
                  className="w-full rounded-full px-6 py-4 font-bold focus:outline-none border" 
                  style={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.textPrimary }} 
                />
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleFinalSave} 
                  className="w-full text-white font-black py-5 rounded-full shadow-xl text-lg transition-all active:scale-95" 
                  style={{ backgroundColor: theme.id === 'blackWhite' ? '#000000' : theme.accent }}
                >
                  {pendingMemoData.isAppendingToId ? "Add to Note" : "Save as New Memo"}
                </button>
                <button 
                  onClick={() => { setShowSaveDialog(false); setPendingMemoData(null); }} 
                  className="w-full font-black py-5 rounded-full uppercase tracking-widest text-sm transition-all active:scale-95"
                  style={{ backgroundColor: theme.bg, color: theme.textSecondary }}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
