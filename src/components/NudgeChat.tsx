import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '../types';
import { InteractiveActionTimeline } from './InteractiveActionTimeline';
import { 
  Send, 
  Sparkles, 
  Calendar, 
  AlertCircle, 
  Layers, 
  Clock, 
  CheckCircle,
  HelpCircle,
  TrendingUp,
  BrainCircuit,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Trash2,
  XCircle,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Custom Interactive Spectrogram Voice Player
const VoiceMessagePlayer: React.FC<{ audioUrl: string; duration?: string }> = ({ audioUrl, duration }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxDuration, setMaxDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioUrl || audioUrl === 'demo-audio-url') return;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setMaxDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    // If it's a demo audio or placeholder
    if (audioUrl === 'demo-audio-url') {
      setIsPlaying(prev => !prev);
      if (!isPlaying) {
        // Simulate progress timer
        let start = Date.now();
        const interval = setInterval(() => {
          setCurrentTime(prev => {
            if (prev >= 4) {
              clearInterval(interval);
              setIsPlaying(false);
              return 0;
            }
            return (Date.now() - start) / 1000;
          });
        }, 100);
      } else {
        setCurrentTime(0);
      }
      return;
    }

    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.error("Audio playback error:", err));
      setIsPlaying(true);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex items-center gap-3 bg-violet-950/40 border border-violet-800/30 p-3 rounded-2xl w-full max-w-[280px] shadow-[0_4px_20px_rgba(139,92,246,0.15)]">
      <button
        onClick={togglePlay}
        type="button"
        className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center hover:scale-105 transition-all cursor-pointer shadow-md border border-violet-400/20"
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-white text-white" />
        ) : (
          <Play className="w-4 h-4 fill-white text-white translate-x-[1px]" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        {/* Spectrogram / Spectrograph specter wave */}
        <div className="flex items-end gap-[3px] h-6 mb-1">
          {Array.from({ length: 22 }).map((_, i) => {
            // Pulsate heights live if audio playing
            const height = isPlaying 
              ? Math.abs(Math.sin(currentTime * 8 + i * 0.4)) * 16 + 4
              : Math.abs(Math.sin(i * 0.3)) * 10 + 4;
            return (
              <div 
                key={i} 
                className={`w-[2.5px] rounded-full transition-all duration-150 ${isPlaying ? 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]' : 'bg-violet-600/40'}`}
                style={{ height: `${Math.max(2, height)}px` }}
              />
            );
          })}
        </div>
        <div className="flex justify-between items-center text-[9px] text-indigo-300/80 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{duration || (maxDuration ? formatTime(maxDuration) : '0:05')}</span>
        </div>
      </div>
    </div>
  );
};

interface NudgeChatProps {
  chatHistory: ChatMessage[];
  onSendMessage: (text: string, audioUrl?: string, duration?: string) => Promise<void>;
  isLoading: boolean;
  needsAuth: boolean;
  onLogin: () => Promise<void>;
  isLoggingIn: boolean;
  criticalTasksCount?: number;
}

export const NudgeChat: React.FC<NudgeChatProps> = ({
  chatHistory,
  onSendMessage,
  isLoading,
  needsAuth,
  onLogin,
  isLoggingIn,
  criticalTasksCount = 0
}) => {
  const [inputText, setInputText] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Voice Integration State variables
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const [aiVoiceEnabled, setAiVoiceEnabled] = useState(() => {
    return localStorage.getItem('ai_voice_responses') === 'true';
  });
  const latestTranscriptRef = useRef('');
  const lastSpokenMessageIdRef = useRef<string | null>(null);

  // Auto Scroll & SpeechSynthesis Trigger
  useEffect(() => {
    localStorage.setItem('ai_voice_responses', aiVoiceEnabled ? 'true' : 'false');
    if (!aiVoiceEnabled) {
      window.speechSynthesis?.cancel();
    }
  }, [aiVoiceEnabled]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!aiVoiceEnabled || chatHistory.length === 0) return;
    const lastMsg = chatHistory[chatHistory.length - 1];
    
    if (lastMsg.role === 'model' && lastMsg.id !== lastSpokenMessageIdRef.current) {
      lastSpokenMessageIdRef.current = lastMsg.id;
      
      const textPart = lastMsg.parts.find(p => p.text)?.text;
      if (textPart) {
        // Clean markdown tags, emojis, and brackets for crystal-clear SpeechSynthesis output
        const cleanText = textPart
          .replace(/[*#`_\-🎙️🌸🚨⏳✨●]/g, '')
          .replace(/\[[^\]]*\]/g, '')
          .replace(/\([-a-zA-Z0-9\s]+\)/g, '')
          .trim();

        if (cleanText) {
          window.speechSynthesis?.cancel();
          const utterance = new SpeechSynthesisUtterance(cleanText);
          if (window.speechSynthesis) {
            const voices = window.speechSynthesis.getVoices();
            const enVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || 
                            voices.find(v => v.lang.startsWith('en'));
            if (enVoice) {
              utterance.voice = enVoice;
            }
          }
          utterance.rate = 1.05;
          window.speechSynthesis?.speak(utterance);
        }
      }
    }
  }, [chatHistory, aiVoiceEnabled]);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  // Listen to structured roadmap panel mount & update events to scroll and anchor cleanly
  useEffect(() => {
    const handleTimelineMount = () => {
      // Small timeout to allow DOM/layout changes to settle
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 80);
    };

    window.addEventListener('nudge-timeline-mounted', handleTimelineMount);
    return () => {
      window.removeEventListener('nudge-timeline-mounted', handleTimelineMount);
    };
  }, []);

  // Voice-to-Text Event Handler & Dynamically Instantiated Speech Recognition Engine
  const toggleListening = () => {
    setVoiceError(null);

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.warn("Speech recognition stop error:", err);
        }
      }
      setIsListening(false);
    } else {
      try {
        const SpeechRecognitionClass = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        if (!SpeechRecognitionClass) {
          setVoiceError("Speech-to-text is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
          return;
        }

        let recognition: any;
        try {
          recognition = new SpeechRecognitionClass();
        } catch (initErr: any) {
          console.warn("Could not instantiate SpeechRecognitionClass natively:", initErr);
          setVoiceError("Speech-to-text engine initialization failed. Microphone access might be restricted.");
          return;
        }

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
          setVoiceError(null);
        };

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setInputText(transcript);
        };

        recognition.onerror = (event: any) => {
          if (event.error === 'not-allowed') {
            console.warn('Microphone permission was denied (not-allowed) by the user or browser context.');
            setIsListening(false);
            setVoiceError("Microphone permission was blocked. Please grant access in your browser or click 'Open in New Tab' to speak.");
            return;
          }

          if (event.error === 'no-speech' || event.error === 'aborted') {
            console.warn('Speech recognition warning:', event.error);
            return;
          }

          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          setVoiceError(`Voice transcription issue: ${event.error}.`);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
      } catch (err: any) {
        console.error("Failed to start SpeechRecognition:", err);
        setVoiceError(`Could not start speech recognition: ${err.message || err}`);
        setIsListening(false);
      }
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText);
    setInputText('');
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {}
      setIsListening(false);
    }
  };

  const handleQuickAction = (actionText: string) => {
    if (isLoading) return;
    onSendMessage(actionText);
  };

  // Determine Nudge orb state based on parameters
  const orbState = isLoading 
    ? 'thinking' 
    : (criticalTasksCount > 0) 
      ? 'urgent' 
      : 'idle';

  const getOrbClass = (state: string) => {
    if (state === 'thinking') return 'nudge-orb-thinking';
    if (state === 'urgent') return 'nudge-orb-urgent';
    return 'nudge-orb-organic';
  };

  const getPlainText = (children: React.ReactNode): string => {
    if (typeof children === 'string') return children;
    if (Array.isArray(children)) {
      return children.map(getPlainText).join('');
    }
    if (children && typeof children === 'object' && 'props' in children) {
      return getPlainText((children as any).props.children);
    }
    return '';
  };

  const PriorityHeader: React.FC<{ text: string }> = ({ text }) => {
    // Regex to parse: "Priority [num]: [title] (Due [date])"
    const regex = /Priority\s*(\d+)?\s*:\s*(.*?)(?:\s*[\(\[]\s*Due\s*(.*?)\s*[\)\]])?$/i;
    const match = text.match(regex);

    if (!match) {
      return <span className="font-semibold text-violet-300">{text}</span>;
    }

    const priorityNum = match[1];
    const title = match[2];
    const dueDate = match[3];

    return (
      <div className="w-full my-3 p-3.5 bg-purple-950/20 border border-purple-500/10 rounded-xl border-l-2 border-l-purple-500 shadow-[0_4px_12px_rgba(139,92,246,0.05)] backdrop-blur-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-500/30">
            Priority {priorityNum || '!'}
          </span>
          <h4 className="font-display font-bold text-xs sm:text-sm text-white tracking-tight truncate">
            {title}
          </h4>
        </div>
        {dueDate && (
          <div className="shrink-0 self-start sm:self-auto text-[10px] sm:text-xs font-semibold tracking-wide text-purple-300 bg-purple-500/10 px-2 py-1 rounded-md border border-purple-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span>Due {dueDate}</span>
          </div>
        )}
      </div>
    );
  };

  const formatInlineKeywords = (text: string): React.ReactNode[] => {
    if (!text) return [];

    // Match key-value attributes like Category: Hackathon, Status: Urgent/Critical,
    // as well as other indicators.
    // Captured groups:
    // 1. Key-Value attribute: (Category|Status|Priority|Due|Est|Urgency):\s*([A-Za-z0-9_\/\- +]+)
    // 2. Standard time indicators: (Time Remaining:\s*~?\s*[^.\n,;!)]+|\[\s*Est:[^\]]+\]|\[\s*Deadline:[^\]]+\])
    // 3. Simple status words: \b(Pending|Completed|Overdue|In Progress|Urgent\/Critical|Urgent|Critical)\b
    const regex = /(\b(?:Category|Status|Priority|Due|Est|Urgency):\s*[A-Za-z0-9_\/\- +]+|(?:Time Remaining:\s*~?\s*[^.\n,;!)]+|\[\s*Est:[^\]]+\]|\[\s*Deadline:[^\]]+\])|\b(?:Pending|Completed|Overdue|In Progress|Urgent\/Critical|Urgent|Critical)\b)/gi;

    const parts = text.split(regex);
    if (parts.length === 1) {
      return [text];
    }

    const result: React.ReactNode[] = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      // When split with a single capture group, matched items reside at odd indices (i % 2 === 1)
      if (i % 2 === 1) {
        const lowerPart = part.toLowerCase();

        // Check if it is a key-value attribute
        const kvMatch = part.match(/^(Category|Status|Priority|Due|Est|Urgency):\s*(.+)$/i);
        if (kvMatch) {
          const key = kvMatch[1];
          const val = kvMatch[2].trim();
          const isUrgentCritical = val.toLowerCase() === 'urgent/critical' || val.toLowerCase() === 'urgent' || val.toLowerCase() === 'critical';

          if (isUrgentCritical) {
            result.push(
              <span key={`kv-${i}`} className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full text-xs font-mono inline-flex items-center gap-1 mx-1 my-0.5 shadow-[0_0_8px_rgba(239,68,68,0.1)]">
                <span className="font-semibold text-rose-300/90">{key}:</span>
                <span className="font-bold">{val}</span>
              </span>
            );
          } else {
            result.push(
              <span key={`kv-${i}`} className="inline-flex items-center gap-1.5 bg-[#160e3d]/60 border border-purple-500/25 rounded-lg px-2 py-0.5 text-xs font-mono my-0.5 mx-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] hover:border-purple-500/45 transition-all">
                <span className="text-purple-300/90 font-semibold">{key}:</span>
                <span className="text-zinc-200 font-medium">{val}</span>
              </span>
            );
          }
        }
        // Standalone Urgent/Critical or Urgent or Critical status
        else if (lowerPart === 'urgent/critical' || lowerPart === 'urgent' || lowerPart === 'critical') {
          result.push(
            <span key={`status-${i}`} className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full text-xs font-mono inline-block mx-1 my-0.5 font-bold shadow-[0_0_8px_rgba(239,68,68,0.1)]">
              {part}
            </span>
          );
        }
        // Standard status words
        else if (['pending', 'completed', 'overdue', 'in progress'].includes(lowerPart)) {
          let colorClass = "text-amber-400 bg-amber-500/10 border border-amber-500/20";
          if (lowerPart === 'completed') {
            colorClass = "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20";
          } else if (lowerPart === 'overdue') {
            colorClass = "text-rose-400 bg-rose-500/10 border border-rose-500/20";
          } else if (lowerPart === 'in progress') {
            colorClass = "text-indigo-400 bg-indigo-500/10 border border-indigo-500/20";
          }
          result.push(
            <span key={`status-${i}`} className={`${colorClass} px-2 py-0.5 rounded-full text-[10px] font-mono inline-block mx-1 my-0.5 select-none font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.2)]`}>
              {part}
            </span>
          );
        }
        // Time / Deadline indicators
        else {
          result.push(
            <span key={`time-${i}`} className="text-purple-300/90 bg-purple-500/5 border border-purple-500/10 px-2 py-0.5 rounded-md tracking-wide text-xs font-medium inline-flex items-center gap-1.5 mx-1 my-0.5">
              <Clock className="w-3 h-3 text-violet-400 shrink-0" />
              <span>{part}</span>
            </span>
          );
        }
      } else {
        result.push(part);
      }
    }

    return result;
  };

  const formatChildren = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === 'string') {
      return formatInlineKeywords(children);
    }
    if (Array.isArray(children)) {
      return children.map((child, idx) => {
        if (typeof child === 'string') {
          return <React.Fragment key={idx}>{formatInlineKeywords(child)}</React.Fragment>;
        }
        return child;
      });
    }
    return children;
  };

  const parseEmailDraft = (text: string) => {
    const subjectRegex = /(?:^|\n)(?:Subject|\*\*Subject\*\*|Subject Line|\*\*Subject Line\*\*):\s*([^\n]+)/i;
    const match = text.match(subjectRegex);
    if (!match) return null;

    const subjectIndex = match.index!;
    const intro = text.substring(0, subjectIndex).trim();
    
    const rest = text.substring(subjectIndex).trim();
    
    const bodyStartRegex = /^(?:Subject|\*\*Subject\*\*|Subject Line|\*\*Subject Line\*\*):\s*([^\n]+)\n*([\s\S]*)/i;
    const bodyMatch = rest.match(bodyStartRegex);
    if (!bodyMatch) return null;

    const subject = bodyMatch[1].trim();
    let remaining = bodyMatch[2].trim();

    remaining = remaining.replace(/^(?:Body|\*\*Body\*\*):\s*\n*/i, '').trim();

    let body = remaining;
    let outro = "";

    const paragraphs = remaining.split(/\n\s*\n/);
    if (paragraphs.length > 1) {
      const lastParagraph = paragraphs[paragraphs.length - 1].trim();
      const isConversationalOutro = 
        /^(let me know|feel free|i hope|hope this|i have|does this|is there|i've|would you|you can)/i.test(lastParagraph) ||
        (lastParagraph.length < 150 && (lastParagraph.includes('?') || lastParagraph.includes('!') || lastParagraph.includes('adjust') || lastParagraph.includes('copy') || lastParagraph.includes('edit')));

      if (isConversationalOutro) {
        outro = lastParagraph;
        body = paragraphs.slice(0, -1).join('\n\n').trim();
      }
    }

    return { intro, subject, body, outro };
  };

  const EmailDraftCard: React.FC<{ subject: string; body: string }> = ({ subject, body }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
      const fullText = `Subject: ${subject}\n\n${body}`;
      try {
        await navigator.clipboard.writeText(fullText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    };

    return (
      <div className="w-full my-4 bg-zinc-950/80 border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative font-sans">
        <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/5">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            <span className="text-[10px] font-mono text-zinc-400 ml-2 uppercase tracking-wider">Email Draft</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md transition-all cursor-pointer border border-white/5"
          >
            {copied ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy to Clipboard</span>
              </>
            )}
          </button>
        </div>

        <div className="px-6 py-4 space-y-3.5 text-xs sm:text-sm text-zinc-300 font-mono select-text">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 pb-2.5 border-b border-white/5">
            <span className="text-purple-300 font-semibold shrink-0">Subject:</span>
            <span className="text-neutral-200 font-medium select-all break-words">{subject}</span>
          </div>
          <div className="whitespace-pre-wrap leading-relaxed select-all text-neutral-200 font-sans pr-2 space-y-2">
            {body.split('\n').map((line, idx) => {
              if (line.trim() === '') {
                return <div key={idx} className="h-2" />;
              }
              const trimmed = line.trim();
              const isGreeting = trimmed.startsWith('Dear') || trimmed.startsWith('Hello') || trimmed.startsWith('Hi') || trimmed.startsWith('To ');
              const isSignoff = trimmed.startsWith('Best') || trimmed.startsWith('Sincerely') || trimmed.startsWith('Thanks') || trimmed.startsWith('Warm') || trimmed.startsWith('Regards');
              
              if (isGreeting || isSignoff) {
                return (
                  <div key={idx} className="text-purple-300 font-semibold">
                    {line}
                  </div>
                );
              }
              return (
                <div key={idx} className="text-neutral-200">
                  {line}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const SprintPlanFallbackCard: React.FC = () => {
    const [copied, setCopied] = useState(false);
    const [checklist, setChecklist] = useState([
      { id: 'item-1', text: 'Complete front-end responsive viewport check', completed: true },
      { id: 'item-2', text: 'Connect and seed production database collections', completed: false },
      { id: 'item-3', text: 'Refine the 3-minute lightning talk speech triggers', completed: false }
    ]);

    const handleToggleCheck = (id: string) => {
      setChecklist(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
    };

    const handleCopy = async () => {
      const textToCopy = `VIBE2SHIP ACTIVE SPRINT PLAN\n\n` +
        `Timeline Roadmap:\n` +
        `- 09:00 - 11:00 | Interface Polish & Layout Convergence | Status: COMPLETED (CRITICAL)\n` +
        `- 11:00 - 13:00 | Database Schema Hardening & Cloud Sync | Status: IN PROGRESS (CRITICAL)\n` +
        `- 13:00 - 15:00 | Integration Testing & Gemini Auto-Checks | Status: PENDING (HIGH)\n` +
        `- 15:00 - 17:00 | Pitch Practice & Demo Flow Verification | Status: PENDING (HIGH)\n\n` +
        `Interactive Hackathon Checklists:\n` +
        checklist.map(item => `[${item.completed ? 'x' : ' '}] ${item.text}`).join('\n') + 
        `\n\nNudge Shield Protection Layer active.`;

      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy: ', err);
      }
    };

    return (
      <div className="w-full my-4 bg-[#0d0928]/95 border border-purple-500/20 rounded-2xl overflow-hidden shadow-[0_0_35px_rgba(139,92,246,0.15)] relative font-sans">
        {/* Glowing badge at top */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500" />
        
        {/* Bypass Indicator Banner */}
        <div className="bg-gradient-to-r from-purple-950/40 to-indigo-950/40 px-4 py-3 border-b border-purple-500/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
            <div>
              <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider font-mono">Shield Bypass Activated</p>
              <p className="text-[10px] text-indigo-300/80 font-mono">API Rate Limits Auto-Healed for Live Presentation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-zinc-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 px-3 py-1.5 rounded-xl transition-all cursor-pointer border border-purple-500/20 select-none self-start sm:self-center"
          >
            {copied ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-emerald-400 font-bold">Roadmap Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-violet-400" />
                <span>Copy Sprint Plan</span>
              </>
            )}
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Header text */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
              <h4 className="font-display font-extrabold text-base tracking-tight text-white uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-100 to-purple-200">
                VIBE2SHIP Active Sprint Plan
              </h4>
            </div>
            <p className="text-xs text-indigo-200/80 leading-relaxed font-sans">
              Protecting your live presentation with fully responsive offline-first roadmap registers. Here is your current tactical blueprint to ship the demo:
            </p>
          </div>

          {/* Timeline Grid */}
          <div className="space-y-2.5">
            <div className="text-[10px] uppercase font-bold tracking-wider font-mono text-indigo-400/80">Roadmap Targets</div>
            
            {/* Step 1 */}
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/10 flex items-start sm:items-center justify-between gap-3 transition-all hover:bg-purple-950/30">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Interface Polish & Layout Convergence</p>
                  <p className="text-[10px] text-zinc-400 font-mono">09:00 - 11:00 • Est: 2 hrs</p>
                </div>
              </div>
              <span className="text-[9px] font-mono uppercase font-bold tracking-wider bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full shrink-0 border border-emerald-500/20">
                Done
              </span>
            </div>

            {/* Step 2 */}
            <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-400/20 flex items-start sm:items-center justify-between gap-3 transition-all shadow-[0_0_15px_rgba(167,139,250,0.05)]">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-violet-500/10 border border-violet-400/40 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 animate-pulse">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    Database Schema Hardening & Cloud Sync
                  </p>
                  <p className="text-[10px] text-violet-300 font-mono">11:00 - 13:00 • Est: 2 hrs</p>
                </div>
              </div>
              <span className="text-[9px] font-mono uppercase font-bold tracking-wider bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full shrink-0 border border-violet-500/30 animate-pulse">
                In Progress
              </span>
            </div>

            {/* Step 3 */}
            <div className="p-3 rounded-xl bg-purple-950/10 border border-white/5 flex items-start sm:items-center justify-between gap-3 opacity-75">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                  <Clock className="w-3 h-3 text-zinc-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-300">Integration Testing & Gemini Auto-Checks</p>
                  <p className="text-[10px] text-zinc-500 font-mono">13:00 - 15:00 • Est: 2 hrs</p>
                </div>
              </div>
              <span className="text-[9px] font-mono uppercase font-bold tracking-wider bg-white/5 text-zinc-400 px-2 py-0.5 rounded-full shrink-0 border border-white/5">
                Pending
              </span>
            </div>

            {/* Step 4 */}
            <div className="p-3 rounded-xl bg-purple-950/10 border border-white/5 flex items-start sm:items-center justify-between gap-3 opacity-75">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                  <Clock className="w-3 h-3 text-zinc-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-300">Pitch Practice & Demo Flow Verification</p>
                  <p className="text-[10px] text-zinc-500 font-mono">15:00 - 17:00 • Est: 2 hrs</p>
                </div>
              </div>
              <span className="text-[9px] font-mono uppercase font-bold tracking-wider bg-white/5 text-zinc-400 px-2 py-0.5 rounded-full shrink-0 border border-white/5">
                Pending
              </span>
            </div>
          </div>

          {/* Interactive Checklist section */}
          <div className="space-y-2.5 pt-1">
            <div className="text-[10px] uppercase font-bold tracking-wider font-mono text-indigo-400/80">Interactive Battle Checklist</div>
            <div className="space-y-2">
              {checklist.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => handleToggleCheck(item.id)}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    item.completed 
                      ? 'bg-emerald-950/10 border-emerald-500/20 text-zinc-400' 
                      : 'bg-white/5 border-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border transition-all ${
                    item.completed 
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-400' 
                      : 'border-zinc-500 hover:border-violet-400'
                  }`}>
                    {item.completed && <span className="text-[10px] font-extrabold">✓</span>}
                  </div>
                  <span className={`text-xs ${item.completed ? 'line-through opacity-70' : ''}`}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Heuristics to detect custom JSON structures or schedule blocks inside Nudge text answers
  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.isSprintPlan) {
      return <SprintPlanFallbackCard />;
    }
    let textPart = msg.parts.find(p => p.text)?.text || '';
    
    // Safety net fallback across all chat responses if empty
    if (!msg.audioUrl && (!textPart || textPart.trim() === '')) {
      textPart = "I'm here to nudge you to action, but I didn't generate a proper response. Can you try rephrasing or asking again?";
    }
    
    // 1. Audio Voice Message bubble block
    if (msg.audioUrl) {
      return (
        <div className="space-y-2 w-full">
          <div className="flex items-center gap-1.5 text-[10px] text-indigo-300 font-bold font-mono uppercase">
            <Volume2 className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
            <span>Voice Record Transcript</span>
          </div>
          <VoiceMessagePlayer audioUrl={msg.audioUrl} duration={msg.duration} />
          {textPart && textPart !== "🎙️ Voice Message" && textPart !== "🎙️ [Voice Message]" && (
            <div className="text-xs text-indigo-200/95 leading-relaxed italic border-l-2 border-violet-500/30 pl-2 mt-1">
              <ReactMarkdown
                components={{
                  p: ({ node, children, ...props }) => <p className="mb-1 last:mb-0 inline" {...props}>{formatChildren(children)}</p>,
                  strong: ({ node, ...props }) => <strong className="font-semibold text-violet-300" {...props} />,
                }}
              >
                {`"${textPart}"`}
              </ReactMarkdown>
            </div>
          )}
        </div>
      );
    }

    // Intercept and cleanly format Email Drafts
    const emailDraft = parseEmailDraft(textPart);
    if (emailDraft) {
      return (
        <div className="space-y-3 w-full">
          {emailDraft.intro && (
            <div className="text-sm text-indigo-100 leading-relaxed font-sans">
              <ReactMarkdown
                components={{
                  p: ({ node, children, ...props }) => {
                    const text = getPlainText(children);
                    if (/^Priority\s*(\d+)?\s*:/i.test(text.trim())) {
                      return <PriorityHeader text={text.trim()} />;
                    }
                    return <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props}>{formatChildren(children)}</p>;
                  },
                  strong: ({ node, ...props }) => <strong className="font-semibold text-violet-300" {...props} />,
                }}
              >
                {emailDraft.intro}
              </ReactMarkdown>
            </div>
          )}
          <EmailDraftCard subject={emailDraft.subject} body={emailDraft.body} />
          {emailDraft.outro && (
            <div className="text-sm text-indigo-100 leading-relaxed font-sans">
              <ReactMarkdown
                components={{
                  p: ({ node, children, ...props }) => {
                    const text = getPlainText(children);
                    if (/^Priority\s*(\d+)?\s*:/i.test(text.trim())) {
                      return <PriorityHeader text={text.trim()} />;
                    }
                    return <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props}>{formatChildren(children)}</p>;
                  },
                  strong: ({ node, ...props }) => <strong className="font-semibold text-violet-300" {...props} />,
                }}
              >
                {emailDraft.outro}
              </ReactMarkdown>
            </div>
          )}
        </div>
      );
    }

    // 2. Schedule markdown table rendering
    if (textPart.includes('|') && textPart.toLowerCase().includes('time') && textPart.toLowerCase().includes('activity')) {
      const parts = textPart.split('|');
      const introText = parts[0] || '';
      return (
        <div className="space-y-2 w-full">
          <div className="text-sm text-indigo-100 leading-relaxed font-sans">
            <ReactMarkdown
              components={{
                p: ({ node, children, ...props }) => {
                  const text = getPlainText(children);
                  if (/^Priority\s*(\d+)?\s*:/i.test(text.trim())) {
                    return <PriorityHeader text={text.trim()} />;
                  }
                  return <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props}>{formatChildren(children)}</p>;
                },
                strong: ({ node, ...props }) => <strong className="font-semibold text-violet-300" {...props} />,
              }}
            >
              {introText}
            </ReactMarkdown>
          </div>
          <div className="glass-card-lavender rounded-2xl p-4 border border-[#251e4d]/50 font-mono text-xs overflow-x-auto text-violet-200">
            {textPart}
          </div>
        </div>
      );
    }

    const lowerText = textPart.toLowerCase();
    const hasStudyPlan = (
      lowerText.includes('should i draft a custom step-by-step revision schedule') ||
      lowerText.includes('revision schedule') ||
      lowerText.includes('study block') ||
      lowerText.includes('action plan') ||
      lowerText.includes('sprint schedule') ||
      lowerText.includes('micro-goals') ||
      lowerText.includes('sprint timer') ||
      lowerText.includes('interactive timeline') ||
      lowerText.includes('action timeline') ||
      (lowerText.includes('step 1') && lowerText.includes('step 2')) ||
      (lowerText.includes('- [ ]') && lowerText.includes('min'))
    );

    return (
      <div className="space-y-3 w-full">
        <div className="text-sm text-indigo-100 leading-relaxed font-sans">
          <ReactMarkdown
            components={{
              p: ({ node, children, ...props }) => {
                const text = getPlainText(children);
                if (/^Priority\s*(\d+)?\s*:/i.test(text.trim())) {
                  return <PriorityHeader text={text.trim()} />;
                }
                return <p className="mb-3 last:mb-0 whitespace-pre-wrap" {...props}>{formatChildren(children)}</p>;
              },
              strong: ({ node, ...props }) => <strong className="font-semibold text-violet-300" {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-3 space-y-2 text-neutral-200 leading-relaxed" {...props} />,
              ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-2 text-neutral-200 leading-relaxed" {...props} />,
              li: ({ node, children, ...props }) => <li className="text-neutral-200 leading-relaxed" {...props}>{formatChildren(children)}</li>,
              em: ({ node, ...props }) => <em className="italic text-indigo-300/80" {...props} />,
              code: ({ node, ...props }) => <code className="bg-violet-950/50 text-violet-200 px-1.5 py-0.5 rounded font-mono text-xs border border-violet-800/20" {...props} />,
              h1: ({ children }) => {
                const text = getPlainText(children);
                if (/Priority/i.test(text)) return <PriorityHeader text={text} />;
                return <h1 className="text-xl font-bold text-white mt-4 mb-2">{children}</h1>;
              },
              h2: ({ children }) => {
                const text = getPlainText(children);
                if (/Priority/i.test(text)) return <PriorityHeader text={text} />;
                return <h2 className="text-lg font-bold text-white mt-3 mb-1.5">{children}</h2>;
              },
              h3: ({ children }) => {
                const text = getPlainText(children);
                if (/Priority/i.test(text)) return <PriorityHeader text={text} />;
                return <h3 className="text-base font-bold text-white mt-3 mb-1">{children}</h3>;
              },
              h4: ({ children }) => {
                const text = getPlainText(children);
                if (/Priority/i.test(text)) return <PriorityHeader text={text} />;
                return <h4 className="text-sm font-bold text-white mt-2 mb-1">{children}</h4>;
              }
            }}
          >
            {textPart}
          </ReactMarkdown>
        </div>
        {hasStudyPlan && (
          <InteractiveActionTimeline messageText={textPart} />
        )}
      </div>
    );
  };

  return (
    <div id="nudge-chat" className="flex flex-col h-full bg-[#060413]/70 backdrop-blur-md text-zinc-100 relative overflow-hidden">
      {/* Nudge Chat Header */}
      <div className="p-4 border-b border-[#251e4d]/35 flex items-center justify-between bg-[#0c0824]/90 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {/* Animated Nudge Orb */}
          <div className="relative w-9 h-9 flex items-center justify-center">
            <div className={`absolute inset-0 rounded-full bg-violet-600/20 blur-md ${isLoading ? 'animate-ping' : 'animate-pulse'}`}></div>
            <div className={`w-7 h-7 flex flex-col items-center justify-center relative ${getOrbClass(orbState)}`}>
              {/* Subtle Eyes */}
              <div className="flex gap-[3px] items-center justify-center">
                <div className="nudge-eye-small animate-blink" />
                <div className="nudge-eye-small animate-blink" />
              </div>
            </div>
            {/* Blinking indicator (amber/gold critical warning mode with microscopic radar pulse) */}
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-amber-500/30 rounded-full animate-ping pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-amber-500 rounded-full border border-zinc-950 shadow-sm"></div>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-display font-semibold text-sm tracking-wide text-white">Nudge</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 font-mono font-semibold border border-violet-500/20">Proactive Companion</span>
            </div>
            <span className="text-[11px] text-indigo-300/60">Monitoring deadlines & commitments</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-indigo-300 bg-[#130f3a]/80 border border-[#251e4d]/50 px-2.5 py-1.5 rounded-full">
          <BrainCircuit className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">AI Guard Active</span>
        </div>
      </div>

      {/* Message List area */}
      <div className={`flex-1 max-h-[calc(100vh-220px)] overflow-y-auto px-4 py-4 space-y-4 ${chatHistory.length === 0 ? 'flex flex-col justify-center' : ''}`}>
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center max-w-md mx-auto my-auto text-center space-y-5 p-8 rounded-[24px] bg-neutral-950/40 backdrop-blur-md border border-white/5 shadow-2xl relative z-10">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-violet-600/15 blur-2xl scale-125 animate-pulse pointer-events-none"></div>
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
                whileHover={{ scale: 1.08, boxShadow: "0 0 55px rgba(139,92,246,0.65)" }}
                className={`w-20 h-20 flex flex-col items-center justify-center z-10 relative cursor-pointer ${getOrbClass(orbState)} shadow-[0_0_40px_rgba(139,92,246,0.35)] transition-shadow duration-300`}
              >
                {/* Character eyes */}
                <div className="flex gap-2.5 items-center justify-center mt-1">
                  <div className="nudge-eye-small animate-blink" />
                  <div className="nudge-eye-small animate-blink" />
                </div>
              </motion.div>
            </div>
            <div className="space-y-1.5">
              <h1 className="font-display font-extrabold text-xl text-white tracking-tighter">Hi, I'm Nudge.</h1>
              <p className="text-xs text-indigo-200/60 leading-relaxed font-sans px-4">
                I capture task logs automatically, track deadlines, query Google Calendar, and plan time blocks so you actually finish your work before it's too late.
              </p>
            </div>

            {/* Quick Actions / Helpers */}
            <div className="grid grid-cols-1 gap-2 w-full pt-2">
              <button
                onClick={() => handleQuickAction("What are my current priorities? Get my tasks list.")}
                className="flex items-center gap-2.5 glass-card-lavender hover:bg-[#1a1547]/40 rounded-2xl px-3.5 py-1.5 text-left text-xs transition-all cursor-pointer border border-purple-500/10"
              >
                <TrendingUp className="w-4 h-4 text-violet-400 shrink-0" />
                <div>
                  <div className="font-semibold text-zinc-200 text-[11px] leading-tight">Review Urgent Priorities</div>
                  <div className="text-[9px] text-indigo-300/50 leading-none mt-0.5">Pulls task registers, sorted by date</div>
                </div>
              </button>

              <button
                onClick={() => handleQuickAction("Suggest a schedule for tomorrow.")}
                className="flex items-center gap-2.5 glass-card-lavender hover:bg-[#1a1547]/40 rounded-2xl px-3.5 py-1.5 text-left text-xs transition-all cursor-pointer border border-purple-500/10"
              >
                <Calendar className="w-4 h-4 text-violet-400 shrink-0" />
                <div>
                  <div className="font-semibold text-zinc-200 text-[11px] leading-tight">Time-Block My Day</div>
                  <div className="text-[9px] text-indigo-300/50 leading-none mt-0.5">Syncs calendar events and logs hourly work</div>
                </div>
              </button>

              <button
                onClick={() => handleQuickAction("Log a New Deadline")}
                className="flex items-center gap-2.5 glass-card-lavender hover:bg-[#1a1547]/40 rounded-2xl px-3.5 py-1.5 text-left text-xs transition-all cursor-pointer border border-purple-500/10"
              >
                <Clock className="w-4 h-4 text-violet-400 shrink-0" />
                <div>
                  <div className="font-semibold text-zinc-200 text-[11px] leading-tight">Log A New Deadline</div>
                  <div className="text-[9px] text-indigo-300/50 leading-none mt-0.5">Say a date and details; I will record it</div>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {chatHistory.map((msg) => {
              const isUser = msg.role === 'user';
              
              // Skip raw tool-only content blocks to keep the conversation clean
              const hasText = msg.parts.some(p => p.text);
              const isToolOnly = !hasText && msg.parts.some(p => p.functionCall || p.functionResponse);
              if (isToolOnly) return null;

              return (
                <div key={msg.id} className={`flex items-start gap-3 w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className={`w-7 h-7 flex items-center justify-center relative shrink-0 mt-0.5 rounded-full ${getOrbClass(orbState)} shadow-[0_0_10px_rgba(167,139,250,0.15)]`}>
                      <div className="flex gap-[2px] items-center justify-center">
                        <div className="nudge-eye-small" />
                        <div className="nudge-eye-small" />
                      </div>
                    </div>
                  )}

                  <div className="max-w-[82%] sm:max-w-[78%] flex flex-col gap-1.5">
                    <div className={`p-3.5 text-xs sm:text-sm leading-relaxed ${
                      isUser 
                        ? 'bg-gradient-to-r from-purple-600/20 to-purple-500/10 border border-purple-500/20 rounded-[20px] rounded-tr-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] font-medium text-[#f1edff]' 
                        : 'bg-neutral-900/30 backdrop-blur-sm rounded-[20px] rounded-bl-none border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] text-zinc-100'
                    }`}>
                      {renderMessageContent(msg)}
                    </div>

                    {/* Meta/Tool-execution notifications under message */}
                    {!isUser && msg.parts.some(p => p.text) && (
                      <div className="space-y-1">
                        {/* Display subtle indicators if the assistant completed functions behind the scenes */}
                        {chatHistory.filter(h => h.role === 'user' && h.parts.some(p => p.functionResponse)).map((h, index) => {
                          const resp = h.parts.find(p => p.functionResponse)?.functionResponse;
                          if (!resp) return null;

                          let label = '';
                          let details = '';

                          if (resp.name === 'add_task') {
                            label = 'Saved deadline';
                            details = resp.response?.task?.title || 'New target';
                          } else if (resp.name === 'get_priorities') {
                            label = 'Indexed urgency matrix';
                            details = `${resp.response?.tasks?.length || 0} tasks evaluated`;
                          } else if (resp.name === 'suggest_schedule') {
                            label = 'Merged calendar and allocated slots';
                            details = resp.response?.message || 'Schedule mapped';
                          } else {
                            return null;
                          }

                          return (
                            <div key={index} className="flex items-center gap-1.5 text-[9px] text-indigo-300/50 font-mono bg-[#110e30]/50 px-2 py-1 rounded-md border border-[#251e4d]/40">
                              <CheckCircle className="w-3 h-3 text-violet-400" />
                              <span className="font-bold text-indigo-200">{label}:</span>
                              <span className="text-indigo-300 truncate max-w-[200px]">{details}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 flex items-center justify-center relative shrink-0 mt-0.5 rounded-full bg-violet-600/20 border border-violet-500/30 shadow-[0_0_10px_rgba(139,92,246,0.15)]">
                      <span className="text-[10px] font-mono font-bold text-violet-300">U</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading / Thinking bubble */}
            {isLoading && (
              <div className="flex items-start gap-3 w-full justify-start">
                <div className="w-7 h-7 flex flex-col items-center justify-center relative shrink-0 mt-1 rounded-full nudge-orb-thinking shadow-[0_0_10px_rgba(167,139,250,0.15)]">
                  {/* Subtle character eyes */}
                  <div className="flex gap-[2px] items-center justify-center">
                    <div className="nudge-eye-small" />
                    <div className="nudge-eye-small" />
                  </div>
                </div>
                <div className="bg-purple-950/20 border border-purple-500/10 rounded-full px-4 py-1.5 inline-flex items-center space-x-2 text-xs font-mono tracking-wide">
                  <span className="text-violet-300 font-medium">Nudge is analyzing</span>
                  <div className="flex gap-1 items-center">
                    <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input / Control Station */}
      <div className="p-4 sm:p-5 bg-transparent relative z-10 shrink-0">
        <AnimatePresence>
          {voiceError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-start gap-2.5 relative max-w-2xl mx-auto"
            >
              <AlertCircle className="w-4.5 h-4.5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1 pr-6 leading-relaxed">
                {voiceError}
              </div>
              <button
                type="button"
                onClick={() => setVoiceError(null)}
                className="absolute top-2 right-2 text-amber-400/70 hover:text-white transition-all cursor-pointer"
                title="Dismiss warning"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {needsAuth ? (
          <div className="glass-card-lavender p-5 rounded-3xl flex flex-col items-center text-center gap-4 max-w-2xl mx-auto">
            <Calendar className="w-9 h-9 text-violet-400 animate-pulse" />
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Sign-in Required to Enable Full Features</h4>
              <p className="text-[11px] text-indigo-200/50 mt-1 max-w-sm">Connect Google Calendar and sync logs with our high-integrity task store</p>
            </div>
            {/* Consistent Pill style Link button */}
            <button
              onClick={onLogin}
              disabled={isLoggingIn}
              className="btn-pill-lavender text-white font-bold px-6 py-2.5 shadow-[0_0_20px_rgba(167,139,250,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2.5"
            >
              <Sparkles className="w-4 h-4 text-indigo-200 animate-pulse" />
              <span className="text-xs">
                {isLoggingIn ? 'Establishing connection...' : 'Link Google Account'}
              </span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="w-full max-w-2xl mx-auto relative">
            <div className={`flex items-center gap-2 bg-[#0f0b2a]/95 backdrop-blur-md border rounded-full p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] transition-all duration-300 ${
              isInputFocused 
                ? 'ring-2 ring-violet-500/40 border-violet-500/50 shadow-[0_0_25px_rgba(139,92,246,0.3)]' 
                : 'border-[#251e4d]/75'
            }`}>
              <div className="flex-1 flex items-center relative min-w-0">
                <input
                  type="text"
                  required
                  disabled={isLoading}
                  readOnly={isListening}
                  inputMode={isListening ? "none" : undefined}
                  placeholder={isLoading ? "Nudge is working..." : (isListening ? "Listening... Speak now..." : "Message Nudge...")}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  className="bg-transparent border-none focus:outline-none focus:ring-0 text-sm px-4 flex-grow text-zinc-100 placeholder:text-zinc-500 min-w-0"
                />
                
                {/* Voice-to-Text Button */}
                <button
                  type="button"
                  onClick={toggleListening}
                  title="Voice-to-Text Transcription"
                  className={`p-2 rounded-full transition-all duration-300 cursor-pointer shrink-0 mr-1 ${
                    isListening 
                      ? 'bg-purple-600/20 border border-purple-400/60 shadow-[0_0_15px_rgba(168,85,247,0.5)] animate-pulse scale-110' 
                      : 'text-indigo-300/70 hover:text-white hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20'
                  }`}
                >
                  <Mic className={`w-4 h-4 transition-all duration-300 ${isListening ? 'animate-bounce text-purple-400' : 'text-indigo-300/70'}`} />
                </button>
              </div>

              {/* AI Voice Response Switch Toggle */}
              <button
                type="button"
                onClick={() => setAiVoiceEnabled(!aiVoiceEnabled)}
                title={aiVoiceEnabled ? "Mute AI Voice Responses" : "Enable AI Voice Responses"}
                className={`w-9 h-9 rounded-full border flex flex-col items-center justify-center transition-all cursor-pointer shrink-0 relative ${
                  aiVoiceEnabled 
                    ? 'bg-violet-600/20 border-violet-500/40 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.25)] hover:bg-violet-600/30' 
                    : 'bg-[#0f0b2a]/90 border-white/5 text-zinc-500 hover:text-zinc-400'
                }`}
              >
                {aiVoiceEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>

              {/* Main Text Send Button */}
              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="btn-pill-lavender text-white w-9 h-9 rounded-full flex items-center justify-center hover:scale-105 transition-all cursor-pointer shrink-0 disabled:opacity-40 disabled:hover:scale-100"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
