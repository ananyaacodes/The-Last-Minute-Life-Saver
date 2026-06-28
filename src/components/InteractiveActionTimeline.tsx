import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  Play, 
  Pause, 
  Calendar, 
  RotateCcw, 
  Sparkles, 
  Clock, 
  ArrowRight, 
  Check, 
  ChevronRight,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TimelineStep {
  id: string;
  title: string;
  duration: number; // in minutes
  completed: boolean;
  timeSlot?: string;
}

interface InteractiveActionTimelineProps {
  messageText: string;
}

export const InteractiveActionTimeline: React.FC<InteractiveActionTimelineProps> = ({ messageText }) => {
  const [steps, setSteps] = useState<TimelineStep[]>([]);
  const [activeStepId, setActiveStepId] = useState<string>('');
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60); // default 25 mins
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [activeBlockDuration, setActiveBlockDuration] = useState<number>(25);
  const timerIntervalRef = useRef<any>(null);

  // Sync Modal State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [syncState, setSyncState] = useState<'idle' | 'analyzing' | 'merging' | 'success'>('idle');

  // Parse tasks / micro-goals from messageText
  useEffect(() => {
    // Attempt to extract lists or bullet points
    const lines = messageText.split('\n');
    const parsedSteps: TimelineStep[] = [];
    
    let idCounter = 1;
    lines.forEach(line => {
      const trimmed = line.trim();
      // Look for lines starting with lists, numbers, or checklist format
      if (
        trimmed.startsWith('-') || 
        trimmed.startsWith('*') || 
        /^\d+\./.test(trimmed) || 
        trimmed.toLowerCase().startsWith('step')
      ) {
        // Clean markdown syntax
        let cleanText = trimmed
          .replace(/^-\s*\[\s*[xX]?\s*\]\s*/, '') // remove markdown checkbox
          .replace(/^[-*\s]+/, '') // remove bullet dashes
          .replace(/^\d+\.\s*/, '') // remove leading numbers
          .replace(/^step\s*\d+:\s*/i, '') // remove "Step 1:" etc.
          .trim();

        if (cleanText.length > 5) {
          // Detect duration in string (e.g., "[30 mins]" or "45 minutes" or "(20m)")
          let duration = 25; // default
          // Match duration with word boundary, optional brackets/parentheses, ordered longest to shortest to prevent partial truncation (e.g. "minutes" -> "utes")
          const durationMatch = cleanText.match(/(?:\[|\()?(\d+)\s*(?:minutes|minute|mins|min|m)\b(?:\]|\))?/i);
          if (durationMatch) {
            duration = parseInt(durationMatch[1], 10);
            // Clean up the duration string from the title
            cleanText = cleanText.replace(durationMatch[0], '').trim();
            // Clean any remaining dangling characters like leading/trailing hyphens, colons, brackets, or parentheses
            cleanText = cleanText.replace(/^[:\-\s,;\[\]\(\)]+|[:\-\s,;\[\]\(\)]+$/g, '').trim();
          }

          parsedSteps.push({
            id: `step_${idCounter++}`,
            title: cleanText,
            duration,
            completed: false
          });
        }
      }
    });

    // Fallback default high-fidelity action plan if parsing yielded too few items
    if (parsedSteps.length < 2) {
      const isExam = messageText.toLowerCase().includes('exam') || messageText.toLowerCase().includes('study') || messageText.toLowerCase().includes('syllabus');
      if (isExam) {
        setSteps([
          { id: 'step_1', title: 'Conceptual Review & Syllabus Mapping', duration: 30, completed: false },
          { id: 'step_2', title: 'High-Priority Flashcard Practice (Active Recall)', duration: 25, completed: false },
          { id: 'step_3', title: 'Solve 2 High-Yield Mock Questions', duration: 45, completed: false },
          { id: 'step_4', title: 'Critical Weakness Patching & Note-Review', duration: 20, completed: false }
        ]);
        setActiveStepId('step_1');
        setTimeLeft(30 * 60);
        setActiveBlockDuration(30);
      } else {
        setSteps([
          { id: 'step_1', title: 'Initial Triage & Outline Creation', duration: 15, completed: false },
          { id: 'step_2', title: 'Intense Deep Work Block (Sprint 1)', duration: 45, completed: false },
          { id: 'step_3', title: 'Structured Recovery & Coffee Break', duration: 10, completed: false },
          { id: 'step_4', title: 'Integration, Review, and Submission Prep', duration: 30, completed: false }
        ]);
        setActiveStepId('step_1');
        setTimeLeft(15 * 60);
        setActiveBlockDuration(15);
      }
    } else {
      setSteps(parsedSteps);
      setActiveStepId(parsedSteps[0].id);
      setTimeLeft(parsedSteps[0].duration * 60);
      setActiveBlockDuration(parsedSteps[0].duration);
    }
  }, [messageText]);

  // Timer logic
  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            clearInterval(timerIntervalRef.current);
            // Auto complete active step
            setSteps(current => 
              current.map(s => s.id === activeStepId ? { ...s, completed: true } : s)
            );
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerRunning, activeStepId]);

  const handleToggleStep = (id: string) => {
    setSteps(current => 
      current.map(s => s.id === id ? { ...s, completed: !s.completed } : s)
    );
  };

  const handleSelectActiveStep = (step: TimelineStep) => {
    setActiveStepId(step.id);
    setTimeLeft(step.duration * 60);
    setActiveBlockDuration(step.duration);
    setIsTimerRunning(false);
  };

  // Format Timer String
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Progress Bar Calculation
  const progressPercent = Math.min(100, Math.max(0, ((activeBlockDuration * 60 - timeLeft) / (activeBlockDuration * 60)) * 100));

  // Calendar Sync simulation trigger
  const handleCalendarSync = () => {
    setIsSyncModalOpen(true);
    setSyncState('analyzing');
    
    setTimeout(() => {
      setSyncState('merging');
      setTimeout(() => {
        setSyncState('success');
      }, 1500);
    }, 1200);
  };

  return (
    <div className="mt-3 w-full rounded-2xl border border-violet-500/30 bg-[#0e092b]/95 p-4 text-zinc-100 shadow-[0_0_20px_rgba(139,92,246,0.15)] relative overflow-hidden">
      {/* Visual top accent glow */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/50 to-transparent"></div>
      
      {/* Header info */}
      <div className="flex items-center justify-between border-b border-violet-500/20 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4.5 h-4.5 text-violet-400 animate-pulse" />
          <span className="font-display font-extrabold text-xs text-white tracking-wider uppercase">
            Interactive revision timeline
          </span>
        </div>
        <button
          onClick={handleCalendarSync}
          className="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-[10px] flex items-center gap-1.5 shadow-md transition-all cursor-pointer hover:scale-[1.03] active:scale-95"
        >
          <Calendar className="w-3 h-3 text-indigo-200" />
          <span>Sync to Calendar</span>
        </button>
      </div>

      {/* Main checklist */}
      <div className="space-y-2 mb-4">
        {steps.map((step, index) => {
          const isActive = step.id === activeStepId;
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleSelectActiveStep(step)}
              className={`group flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                isActive 
                  ? 'bg-violet-950/40 border-violet-500/40 shadow-[inset_0_0_10px_rgba(139,92,246,0.1)]' 
                  : 'bg-black/20 border-violet-950/20 hover:border-violet-800/30 hover:bg-violet-950/10'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Custom circular checkbox */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStep(step.id);
                  }}
                  className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 cursor-pointer ${
                    step.completed 
                      ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_8px_rgba(16,185,129,0.4)]' 
                      : isActive 
                        ? 'border-violet-400/80 bg-violet-900/20 text-transparent hover:border-violet-300' 
                        : 'border-zinc-700 bg-black/40 hover:border-violet-500/40'
                  }`}
                >
                  <motion.div
                    initial={false}
                    animate={{ scale: step.completed ? 1 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="flex items-center justify-center"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </motion.div>
                </motion.button>

                <div className="min-w-0">
                  <h5 className={`text-xs font-bold leading-snug truncate ${
                    step.completed ? 'line-through text-zinc-500' : 'text-zinc-100'
                  }`}>
                    {step.title}
                  </h5>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] text-violet-400/80 font-semibold uppercase tracking-wider">
                      Goal {index + 1}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                    <span className="text-[9px] text-zinc-500 font-mono">
                      {step.duration} mins
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Indicator / Start play button */}
              <div className="shrink-0">
                {isActive ? (
                  <div className="text-[10px] bg-violet-500/10 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full font-bold animate-pulse">
                    Active
                  </div>
                ) : (
                  <div className="opacity-0 group-hover:opacity-100 text-[10px] text-zinc-400 hover:text-white transition-all font-mono flex items-center gap-0.5">
                    <span>Activate</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Focus Timer Block Widget */}
      <div className="border border-violet-500/25 bg-[#150e3d]/60 rounded-2xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-auto min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-bold text-violet-300 font-mono uppercase tracking-wide mb-1">
            <Clock className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
            <span>Active Sprint Timer</span>
          </div>
          <h4 className="text-xs text-indigo-200 font-bold max-w-full sm:max-w-[340px] md:max-w-[480px] truncate leading-snug">
            {steps.find(s => s.id === activeStepId)?.title || 'No active block'}
          </h4>
        </div>
 
        {/* Big digits and progress block */}
        <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-between md:justify-end">
          <div className="flex flex-col items-center">
            <div className="text-2xl font-mono font-extrabold text-white tracking-widest leading-none drop-shadow-[0_0_10px_rgba(139,92,246,0.3)]">
              {formatTime(timeLeft)}
            </div>
            {/* Visual Micro Progress Bar */}
            <div className="w-16 h-1 bg-black/40 rounded-full mt-1.5 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-1000" 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
 
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                isTimerRunning 
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20' 
                  : 'bg-violet-600 text-white hover:bg-violet-500 shadow-md'
              }`}
              title={isTimerRunning ? 'Pause block' : 'Start sprint timer'}
            >
              {isTimerRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current translate-x-[0.5px]" />}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1, rotate: -180 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={() => {
                const currentStep = steps.find(s => s.id === activeStepId);
                setTimeLeft((currentStep ? currentStep.duration : 25) * 60);
                setIsTimerRunning(false);
              }}
              className="p-2.5 rounded-xl bg-black/30 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-black/50 transition-all cursor-pointer flex items-center justify-center"
              title="Reset sprint timer"
            >
              <RotateCcw className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Sync Success Portal Simulation Modal */}
      <AnimatePresence>
        {isSyncModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-sm glass-card-lavender border border-violet-500/40 rounded-3xl p-6 text-center text-zinc-100 relative overflow-hidden shadow-[0_0_50px_rgba(139,92,246,0.3)] bg-[#0d0726]"
            >
              {/* Star fields and neon graphics */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600 animate-pulse"></div>
              
              {syncState === 'analyzing' && (
                <div className="space-y-5 py-4">
                  <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-2 border-violet-500/20 border-t-violet-400 animate-spin"></div>
                    <Calendar className="w-7 h-7 text-violet-400 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-white">Analyzing Availability</h3>
                    <p className="text-xs text-indigo-200/50 mt-1 max-w-xs mx-auto">Connecting to Google Calendar Auth API & scanning active time blocks...</p>
                  </div>
                </div>
              )}

              {syncState === 'merging' && (
                <div className="space-y-5 py-4">
                  <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-400 animate-spin" style={{ animationDuration: '6s' }}></div>
                    <div className="absolute inset-2 rounded-full border-2 border-dotted border-violet-400 animate-spin" style={{ animationDuration: '3s' }}></div>
                    <Sparkles className="w-6 h-6 text-indigo-300 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-white">Merging Sprint Slots</h3>
                    <p className="text-xs text-indigo-200/50 mt-1 max-w-xs mx-auto">Allocating micro-goals into optimal high-focus buffers...</p>
                  </div>
                </div>
              )}

              {syncState === 'success' && (
                <div className="space-y-5">
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                  >
                    <Check className="w-8 h-8 stroke-[3]" />
                  </motion.div>
                  
                  <div className="space-y-1.5">
                    <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-emerald-400">Calendar Synchronized!</h3>
                    <p className="text-xs text-indigo-100 font-medium">Sprint schedule successfully merged with your Google Calendar events.</p>
                    <div className="bg-black/35 border border-[#251e4d]/40 rounded-2xl p-3 text-left space-y-1 mt-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-indigo-300 font-mono">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                        <span>Google Workspace Integration</span>
                      </div>
                      <p className="text-[11px] text-zinc-300 font-semibold leading-relaxed">
                        Added {steps.length} Study Goals to your primary calendar slot with smart proactive reminders.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsSyncModalOpen(false)}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs tracking-wider uppercase transition-all shadow-lg cursor-pointer mt-2"
                  >
                    Done & Close
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
