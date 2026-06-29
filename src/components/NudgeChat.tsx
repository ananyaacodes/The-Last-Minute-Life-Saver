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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const recordingRecognitionRef = useRef<any>(null);
  const recordingTranscriptRef = useRef<string>('');

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

  // Voice-to-Text Speech Recognition Initializer
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false; // Stops automatically when user stops speaking
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        latestTranscriptRef.current = '';
      };

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setInputText(prev => {
            const updated = prev + (prev ? ' ' : '') + finalTranscript;
            latestTranscriptRef.current = updated;
            return updated;
          });
        }
      };

      rec.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          console.warn('Speech recognition warning:', event.error);
          return;
        }

        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setVoiceError("Microphone permission was blocked. To grant access, click 'Open in New Tab' at the top right of the preview panel, or check your browser's site settings.");
        } else {
          setVoiceError(`Voice transcription issue: ${event.error}. Please check your browser's microphone permissions.`);
        }
      };

      rec.onend = () => {
        setIsListening(false);
        const finalSpeech = latestTranscriptRef.current.trim();
        if (finalSpeech) {
          onSendMessage(finalSpeech);
          setInputText('');
          latestTranscriptRef.current = '';
        }
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleListening = () => {
    setVoiceError(null);
    if (!recognitionRef.current) {
      setVoiceError("Voice-to-text is not fully supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        latestTranscriptRef.current = '';
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err: any) {
        console.error("Failed to start SpeechRecognition:", err);
        setVoiceError(`Could not start speech recognition: ${err.message || err}`);
      }
    }
  };

  // Direct Voice Message Sending logic
  const startVoiceRecording = async () => {
    if (isRecording) return;
    setVoiceError(null);

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setVoiceError("Voice input isn't supported in this browser, please type instead.");
      return;
    }

    // Initialize recording transcript
    recordingTranscriptRef.current = '';

    // Initialize & start Web Speech API Speech Recognition
    const rec = new SpeechRecognitionClass();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    
    rec.onresult = (event: any) => {
      let text = '';
      for (let i = 0; i < event.results.length; ++i) {
        text += event.results[i][0].transcript;
      }
      recordingTranscriptRef.current = text;
    };

    rec.onerror = (event: any) => {
      console.warn("Speech recognition during recording warning:", event.error);
    };

    rec.onend = () => {
      console.log("Speech recognition during recording stopped.");
    };

    recordingRecognitionRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("navigator.mediaDevices not accessible");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const mins = Math.floor(recordingDuration / 60);
        const secs = recordingDuration % 60;
        const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

        if (recordingRecognitionRef.current) {
          try {
            recordingRecognitionRef.current.stop();
          } catch (e) {}
        }

        const transcribedText = recordingTranscriptRef.current.trim() || "🎙️ Voice Message";

        // Send Voice message to chat
        onSendMessage(transcribedText, audioUrl, durationStr);
        
        // Cleanup streams
        stream.getTracks().forEach(track => track.stop());
        setRecordingDuration(0);
        setIsRecording(false);
      };

      setIsRecording(true);
      setRecordingDuration(0);
      mediaRecorder.start();

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.warn("Direct microphone unavailable (or sandboxed inside iframe). Initiating highly polished demo recorder:", err);
      // Fallback
      simulateDemoVoiceMsg();
      setVoiceError("Microphone input was restricted in the preview pane. We started a smart voice simulator fallback! To test real recording, click 'Open in New Tab' at the top right.");
    }
  };

  const stopVoiceRecording = () => {
    if (!isRecording) return;
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recordingRecognitionRef.current) {
      try {
        recordingRecognitionRef.current.stop();
      } catch (e) {
        console.error("Error stopping recording speech recognition:", e);
      }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      // Demo recording mode stop
      const mins = Math.floor(recordingDuration / 60);
      const secs = recordingDuration % 60;
      const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      
      const transcribedText = recordingTranscriptRef.current.trim() || "Hey Nudge, please review my schedule and add tasks.";
      onSendMessage(transcribedText, "demo-audio-url", durationStr);
      setIsRecording(false);
      setRecordingDuration(0);
    }
  };

  const cancelVoiceRecording = () => {
    if (!isRecording) return;
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recordingRecognitionRef.current) {
      try {
        recordingRecognitionRef.current.onresult = null;
        recordingRecognitionRef.current.onerror = null;
        recordingRecognitionRef.current.onend = null;
        recordingRecognitionRef.current.stop();
      } catch (e) {}
      recordingRecognitionRef.current = null;
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }

    setIsRecording(false);
    setRecordingDuration(0);
  };

  const simulateDemoVoiceMsg = () => {
    setIsRecording(true);
    setRecordingDuration(0);

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      const rec = new SpeechRecognitionClass();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      
      rec.onresult = (event: any) => {
        let text = '';
        for (let i = 0; i < event.results.length; ++i) {
          text += event.results[i][0].transcript;
        }
        recordingTranscriptRef.current = text;
      };

      rec.onerror = (event: any) => {
        console.warn("Speech recognition error in simulator:", event.error);
      };

      recordingRecognitionRef.current = rec;
      try {
        rec.start();
      } catch (e) {}
    }
    
    timerRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText);
    setInputText('');
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
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

    // Group 1: Time indicators
    // Group 2: Status indicators
    const regex = /(Time Remaining:\s*~?\s*[^.\n,;!)]+|\[\s*Est:[^\]]+\]|\[\s*Deadline:[^\]]+\])|\b(Pending|Completed|Overdue|In Progress)\b/gi;

    const parts = text.split(regex);
    if (parts.length === 1) {
      return [text];
    }

    const result: React.ReactNode[] = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      const mod = i % 3;
      if (mod === 0) {
        result.push(part);
      } else if (mod === 1) {
        // Time indicator
        result.push(
          <span key={`time-${i}`} className="text-purple-300/80 tracking-wide text-sm font-medium italic inline-block mx-0.5">
            {part}
          </span>
        );
      } else if (mod === 2) {
        // Status indicator
        let colorClass = "text-amber-400 bg-amber-500/10";
        const lowerPart = part.toLowerCase();
        if (lowerPart === 'completed') {
          colorClass = "text-emerald-400 bg-emerald-500/10";
        } else if (lowerPart === 'overdue') {
          colorClass = "text-rose-400 bg-rose-500/10";
        } else if (lowerPart === 'in progress') {
          colorClass = "text-indigo-400 bg-indigo-500/10";
        }
        result.push(
          <span key={`status-${i}`} className={`${colorClass} px-2 py-0.5 rounded text-xs font-mono inline-block mx-0.5 select-none font-semibold`}>
            {part}
          </span>
        );
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

        <div className="p-4 space-y-3.5 text-xs sm:text-sm text-zinc-300 font-mono select-text">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 pb-2.5 border-b border-white/5">
            <span className="text-purple-400 font-bold shrink-0">Subject:</span>
            <span className="text-white font-medium select-all break-words">{subject}</span>
          </div>
          <div className="whitespace-pre-wrap leading-relaxed select-all text-zinc-300 font-sans pr-2">
            {body}
          </div>
        </div>
      </div>
    );
  };

  // Heuristics to detect custom JSON structures or schedule blocks inside Nudge text answers
  const renderMessageContent = (msg: ChatMessage) => {
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
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${chatHistory.length === 0 ? 'flex flex-col justify-center' : ''}`}>
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
                <div key={msg.id} className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className={`w-7 h-7 flex items-center justify-center relative shrink-0 mt-0.5 ${getOrbClass(orbState)}`}>
                      <div className="flex gap-[2px] items-center justify-center">
                        <div className="nudge-eye-small" />
                        <div className="nudge-eye-small" />
                      </div>
                    </div>
                  )}

                  <div className="max-w-[85%] flex flex-col gap-1.5">
                    <div className={`p-4 text-sm leading-relaxed ${
                      isUser 
                        ? 'bg-gradient-to-r from-purple-600/20 to-purple-500/10 border border-purple-500/20 rounded-[20px] rounded-br-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] font-medium text-[#f1edff]' 
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
                </div>
              );
            })}

            {/* Loading / Thinking bubble */}
            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 flex flex-col items-center justify-center relative shrink-0 mt-1 nudge-orb-thinking">
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
                {isRecording ? (
                  /* Recording Voice Message UI */
                  <div className="flex items-center justify-between w-full px-4 py-1 bg-violet-950/20 rounded-full">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                      <span className="text-xs text-indigo-200 font-mono font-bold">
                        Recording... {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60) < 10 ? '0' : ''}{recordingDuration % 60}
                      </span>
                      {/* Spectrogram visualization wave */}
                      <div className="flex items-center gap-[2px] h-3">
                        <div className="w-[2.5px] h-2 bg-red-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-[2.5px] h-3.5 bg-red-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-[2.5px] h-1 bg-red-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        <div className="w-[2.5px] h-2.5 bg-red-400 animate-bounce" style={{ animationDelay: '450ms' }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={cancelVoiceRecording}
                        className="p-1 px-2.5 rounded-full bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px] font-extrabold transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={stopVoiceRecording}
                        className="p-1 px-3 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 hover:scale-105 text-white text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 shadow-md"
                      >
                        <Send className="w-3 h-3 fill-white text-white" /> Send Msg
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Standard Input / Voice-to-Text UI */
                  <>
                    <input
                      type="text"
                      required
                      disabled={isLoading}
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
                      className={`p-1.5 rounded-full transition-all cursor-pointer shrink-0 mr-1 ${
                        isListening 
                          ? 'text-violet-300 bg-violet-600/30 border border-violet-400/50 shadow-[0_0_15px_rgba(139,92,246,0.6)] animate-pulse scale-105' 
                          : 'text-indigo-300/70 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Mic className={`w-4 h-4 ${isListening ? 'animate-bounce text-violet-300' : ''}`} />
                    </button>
                  </>
                )}
              </div>

              {/* Record Voice Message toggle Button (visible when not recording) */}
              {!isRecording && (
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  disabled={isLoading}
                  title="Send Voice Message directly"
                  className="w-9 h-9 rounded-full bg-transparent border border-white/5 hover:border-violet-500/50 flex items-center justify-center text-indigo-300 hover:text-violet-300 transition-all cursor-pointer shrink-0 hover:bg-[#150e4a]"
                >
                  <Volume2 className="w-4 h-4 text-violet-400" />
                </button>
              )}

              {/* AI Voice Response Switch Toggle */}
              {!isRecording && (
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
              )}

              {/* Main Text Send Button */}
              {!isRecording && (
                <button
                  type="submit"
                  disabled={isLoading || !inputText.trim()}
                  className="btn-pill-lavender text-white w-9 h-9 rounded-full flex items-center justify-center hover:scale-105 transition-all cursor-pointer shrink-0 disabled:opacity-40 disabled:hover:scale-100"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
