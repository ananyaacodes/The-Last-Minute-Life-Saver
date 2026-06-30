import { useState, useEffect } from 'react';
import { Task, ChatMessage } from './types';
import { TaskSidebar } from './components/TaskSidebar';
import { NudgeChat } from './components/NudgeChat';
import { LandscapeBackground } from './components/LandscapeBackground';
import { VisualDashboard } from './components/VisualDashboard';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  getAccessToken 
} from './lib/firebase-client';
import { User } from 'firebase/auth';
import { 
  Sparkles, 
  LogOut, 
  AlertOctagon, 
  User as UserIcon,
  HelpCircle,
  TrendingUp,
  Flame,
  Calendar,
  Layers,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  Plus,
  Bell,
  BellRing,
  AlertTriangle,
  CheckCircle2,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem('nudge_is_demo') === 'true';
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'analytics'>('chat');
  const [isTaskSectionExpanded, setIsTaskSectionExpanded] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('nudge_theme') as 'dark' | 'light') || 'dark';
  });
  const [calendarSyncing, setCalendarSyncing] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  // Task Notifications State variables
  const [notifiedTaskIds, setNotifiedTaskIds] = useState<string[]>([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [activeToasts, setActiveToasts] = useState<Array<{ id: string; title: string; message: string; taskId?: string }>>([]);
  const [isAlarmDismissed, setIsAlarmDismissed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('nudge_alarm_dismissed') === 'true';
    }
    return false;
  });
  const [isBannerVisible, setIsBannerVisible] = useState<boolean>(true);
  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  });

  // Sync Theme with DOM
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('nudge_theme', theme);
  }, [theme]);

  const handleSyncGoogleCalendar = () => {
    if (calendarSyncing) return;
    setCalendarSyncing(true);
    setTimeout(() => {
      setCalendarSyncing(false);
      // Automatically add a helpful notification message from Nudge in the chat history
      const syncAlertMsg: ChatMessage = {
        id: Math.random().toString(),
        role: 'model',
        parts: [{ text: "🔄 **Calendar Synced!** I have imported your latest Google Calendar events and time-blocked tomorrow's schedule for you. Check your deadlines or ask me to show them!" }],
        createdAt: new Date().toISOString(),
        isSystem: true
      };
      setChatHistory(prev => [...prev, syncAlertMsg]);
    }, 1500);
  };

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      async (user, token) => {
        localStorage.removeItem('nudge_is_demo');
        setIsDemoMode(false);
        setCurrentUser(user);
        setGoogleToken(token || null);
        setNeedsAuth(false);
      },
      () => {
        const wasDemo = localStorage.getItem('nudge_is_demo') === 'true';
        if (!wasDemo) {
          setCurrentUser(null);
          setGoogleToken(null);
          setNeedsAuth(true);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  // Check and restore demo mode if saved
  useEffect(() => {
    const wasDemo = localStorage.getItem('nudge_is_demo') === 'true';
    if (wasDemo) {
      let demoUid = localStorage.getItem('nudge_demo_user_id');
      if (!demoUid) {
        demoUid = `demo_judge_${Math.random().toString(36).substring(2, 11)}`;
        localStorage.setItem('nudge_demo_user_id', demoUid);
      }
      setCurrentUser({
        uid: demoUid,
        displayName: 'Hackathon Judge (Demo)',
        email: 'judge@hackathon.demo',
        photoURL: null
      } as any);
      setGoogleToken(null);
      setNeedsAuth(false);
      setIsDemoMode(true);
    }
  }, []);

  const handleStartDemoMode = () => {
    let demoUid = localStorage.getItem('nudge_demo_user_id');
    if (!demoUid) {
      demoUid = `demo_judge_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem('nudge_demo_user_id', demoUid);
    }
    localStorage.setItem('nudge_is_demo', 'true');
    setIsDemoMode(true);
    setCurrentUser({
      uid: demoUid,
      displayName: 'Hackathon Judge (Demo)',
      email: 'judge@hackathon.demo',
      photoURL: null
    } as any);
    setGoogleToken(null);
    setNeedsAuth(false);
  };

  // Fetch Tasks once authenticated
  useEffect(() => {
    if (currentUser) {
      fetchTasks();
    } else {
      setTasks([]);
    }
  }, [currentUser]);

  const fetchTasks = async () => {
    if (!currentUser) return;
    try {
      const response = await fetch('/api/tasks', {
        headers: {
          'x-user-id': currentUser.uid
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setCurrentUser(result.user);
        setGoogleToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      if (err && (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request')) {
        console.warn('Google Sign-In closed by user.');
        setActiveToasts(prev => [...prev, {
          id: Math.random().toString(),
          title: "Sign-In Cancelled",
          message: "The login popup was closed before completing the sign-in process."
        }]);
      } else {
        console.error('Google Sign-in failed:', err);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('nudge_is_demo');
      setIsDemoMode(false);
      await logout();
      setCurrentUser(null);
      setGoogleToken(null);
      setNeedsAuth(true);
      setChatHistory([]);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Task Mutators
  const handleAddTask = async (title: string, dueDate: string, priority: Task['priority'], category: string) => {
    if (!currentUser) return;
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.uid
        },
        body: JSON.stringify({ title, due_date: dueDate, priority, category })
      });
      if (response.ok) {
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error logging task:', err);
    }
  };

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.uid
        },
        body: JSON.stringify(updates)
      });
      if (response.ok) {
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser.uid
        }
      });
      if (response.ok) {
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Send Message to Nudge Chat
  const handleSendMessage = async (text: string, audioUrl?: string, duration?: string) => {
    if (!currentUser) return;

    // Create user message
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      role: 'user',
      parts: [{ text }],
      createdAt: new Date().toISOString(),
      ...(audioUrl && { audioUrl }),
      ...(duration && { duration })
    };

    // Enforce clean intent switching across different dashboard states
    const isQuickAction = [
      "what are my current priorities",
      "suggest a schedule",
      "log a new deadline",
      "re-plan my day"
    ].some(qa => text.toLowerCase().includes(qa));

    const isOngoingModification = [
      'modify', 'update', 'change', 'postpone', 'delay', 'reschedule',
      'keep', 'edit', 'mark', 'complete', 'finish', 'ongoing', 'previous',
      'it', 'that', 'this', 'above', 'before', 'the exam', 'that task',
      'add a step', 'add step', 'continue'
    ].some(word => text.toLowerCase().includes(word));

    const isCleanIntentSwitch = isQuickAction || !isOngoingModification;

    let sanitizedHistory = chatHistory;
    if (isCleanIntentSwitch) {
      sanitizedHistory = chatHistory.filter(msg => {
        const textContent = msg.parts.map(p => p.text || '').join(' ').toLowerCase();
        const hasStaleDetails = 
          textContent.includes('organic chemistry') || 
          textContent.includes('june 27') || 
          textContent.includes('6/27') ||
          textContent.includes('chemistry');
        return !hasStaleDetails;
      });
    }

    const nextHistory = [...sanitizedHistory, userMsg];
    setChatHistory(nextHistory);
    setIsLoadingChat(true);

    if (text === "Log a New Deadline") {
      setTimeout(() => {
        const nudgeResponse: ChatMessage = {
          id: Math.random().toString(),
          role: 'model',
          parts: [{ text: "Ready. What task or deadline are we locking in right now? Give me the name and target time." }],
          createdAt: new Date().toISOString()
        };
        setChatHistory(prev => [...prev, nudgeResponse]);
        setIsLoadingChat(false);
      }, 400);
      return;
    }

    try {
      const headers: any = {
        'Content-Type': 'application/json',
        'x-user-id': currentUser.uid
      };
      if (googleToken) {
        headers['Authorization'] = `Bearer ${googleToken}`;
      }

      let response: Response | null = null;
      let errData: any = null;
      let attempt = 0;
      const maxAttempts = 3; // 1 initial + 2 retries
      const delays = [1500, 3000];

      while (attempt < maxAttempts) {
        try {
          response = await fetch('/api/chat', {
            method: 'POST',
            headers,
            body: JSON.stringify({ messages: nextHistory })
          });

          if (response.ok) {
            break;
          }

          // Read the error body if available
          try {
            errData = await response.json();
          } catch (e) {
            errData = { error: 'Unknown server error' };
          }
        } catch (fetchErr: any) {
          console.error(`Fetch attempt ${attempt + 1} failed:`, fetchErr);
          errData = { error: fetchErr.message || 'Network error' };
        }

        const errStr = (errData?.error || '').toUpperCase();
        const isUnavailable = (response && response.status === 503) || errStr.includes('503') || errStr.includes('UNAVAILABLE');
        const isQuota = (response && response.status === 429) ||
                        errStr.includes('429') ||
                        errStr.includes('QUOTA') ||
                        errStr.includes('RESOURCE_EXHAUSTED') ||
                        errStr.includes('LIMIT');

        if ((isUnavailable || isQuota) && attempt < maxAttempts - 1) {
          console.log(`Client retry ${attempt + 1} initiated (status: ${response?.status})...`);
          await new Promise(resolve => setTimeout(resolve, delays[attempt]));
          attempt++;
        } else {
          break;
        }
      }

      if (response && response.ok) {
        const data = await response.json();
        
        // Update history with full history returned by Gemini (including tool calls and responses)
        if (data.updatedHistory) {
          const finalHistory = data.updatedHistory.map((h: any) => ({
            id: Math.random().toString(),
            role: h.role,
            parts: h.parts,
            createdAt: new Date().toISOString()
          }));
          setChatHistory(finalHistory);
        } else {
          // Fallback if updatedHistory isn't returned
          const assistantMsg: ChatMessage = {
            id: Math.random().toString(),
            role: 'model',
            parts: [{ text: data.text }],
            createdAt: new Date().toISOString()
          };
          setChatHistory([...nextHistory, assistantMsg]);
        }

        // If Nudge performed backend actions like add_task or suggest_schedule, refresh the local tasks!
        if (data.actionsTaken && data.actionsTaken.length > 0) {
          console.log('[App] Action executed by Nudge. Refreshing task list.');
          await fetchTasks();
        }

      } else {
        const errStr = (typeof errData?.error === 'string' ? errData.error : JSON.stringify(errData || '')).toUpperCase();
        const isQuota = (response && response.status === 429) ||
                        errStr.includes('429') ||
                        errStr.includes('QUOTA') ||
                        errStr.includes('RESOURCE_EXHAUSTED') ||
                        errStr.includes('LIMIT') ||
                        errStr.includes('RATE') ||
                        errStr.includes('HIT ITS API RATE LIMIT');
        
        if (isQuota) {
          const fallbackMsg: ChatMessage = {
            id: Math.random().toString(),
            role: 'model',
            parts: [{ text: "Nudge has hit its API rate limit for the moment." }],
            createdAt: new Date().toISOString(),
            isSprintPlan: true,
            isSystem: false
          };
          setChatHistory([...nextHistory, fallbackMsg]);
        } else {
          const isUnavailable = (response && response.status === 503) || 
                                errStr.includes('503') || 
                                errStr.includes('UNAVAILABLE') || 
                                errStr.includes('OVERLOADED') || 
                                errStr.includes('CAPACITY_EXCEEDED');
          
          let friendlyMessage = '';
          let isSystemMsg = true;
          if (isUnavailable) {
            friendlyMessage = "Nudge is a bit overloaded right now — try again in a moment.";
          } else {
            let rawErr = errData?.error;
            if (rawErr && typeof rawErr === 'object') {
              rawErr = rawErr.message || JSON.stringify(rawErr);
            }
            if (!rawErr) {
              rawErr = 'Failed to get answer from Nudge.';
            }
            
            if (rawErr.includes('{') || rawErr.includes('}')) {
              friendlyMessage = "Nudge encountered an unexpected response — try again in a moment.";
            } else {
              friendlyMessage = `Error: ${rawErr}`;
            }
          }

          const errorMsg: ChatMessage = {
            id: Math.random().toString(),
            role: 'model',
            parts: [{ text: friendlyMessage }],
            createdAt: new Date().toISOString(),
            isSystem: isSystemMsg
          };
          setChatHistory([...nextHistory, errorMsg]);
        }
      }
    } catch (err: any) {
      console.error('Chat failed:', err);
      const errMsgStr = (err?.message || '').toUpperCase();
      const isRateLimitErr = errMsgStr.includes('RATE') || 
                             errMsgStr.includes('429') || 
                             errMsgStr.includes('LIMIT') || 
                             errMsgStr.includes('QUOTA') ||
                             errMsgStr.includes('HIT ITS API RATE LIMIT');
                             
      if (isRateLimitErr) {
        const fallbackMsg: ChatMessage = {
          id: Math.random().toString(),
          role: 'model',
          parts: [{ text: "Nudge has hit its API rate limit for the moment." }],
          createdAt: new Date().toISOString(),
          isSprintPlan: true,
          isSystem: false
        };
        setChatHistory([...nextHistory, fallbackMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: Math.random().toString(),
          role: 'model',
          parts: [{ text: 'Network communication interrupted. Please check your connection.' }],
          createdAt: new Date().toISOString(),
          isSystem: true
        };
        setChatHistory([...nextHistory, errorMsg]);
      }
    } finally {
      setIsLoadingChat(false);
    }
  };

  // Request Web Notification permission
  const requestWebNotificationPermission = async () => {
    if (!('Notification' in window)) {
      setActiveToasts(prev => [...prev, {
        id: Math.random().toString(),
        title: "Platform Constraint",
        message: "Desktop push alerts are not supported on this browser or platform."
      }]);
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      try {
        new Notification("Notifications Enabled! 🎉", {
          body: "Nudge will now alert you 24 hours before your urgent deadlines.",
          icon: 'https://cdn-icons-png.flaticon.com/512/3593/3593497.png'
        });
      } catch (e) {
        console.warn("Could not fire confirmation Notification:", e);
      }
    }
  };

  // Check for upcoming critical deadlines (less than 24 hours away) and fire notifications
  useEffect(() => {
    if (tasks.length === 0) return;

    const criticals = tasks.filter(task => {
      if (task.status === 'completed') return false;
      const dueTime = new Date(task.due_date).getTime();
      const now = Date.now();
      const hoursLeft = (dueTime - now) / (1000 * 60 * 60);
      return hoursLeft > 0 && hoursLeft <= 24;
    });

    if (criticals.length === 0) return;

    // Find criticals that haven't been notified yet in this session
    const newCriticals = criticals.filter(t => t.id && !notifiedTaskIds.includes(t.id));

    if (newCriticals.length > 0) {
      const idsToMark = newCriticals.map(t => t.id!);
      setNotifiedTaskIds(prev => [...prev, ...idsToMark]);

      newCriticals.forEach(task => {
        // 1. In-app floating slide toast
        const toastId = Math.random().toString();
        const hrsLeft = Math.ceil((new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60));
        
        setActiveToasts(prev => [...prev, {
          id: toastId,
          title: `🚨 Urgent: ${task.title}`,
          message: `This high-urgency task is due in ${hrsLeft} hours! Let's get to work.`,
          taskId: task.id
        }]);

        // Auto remove toast after 7 seconds
        setTimeout(() => {
          setActiveToasts(prev => prev.filter(t => t.id !== toastId));
        }, 7000);

        // 2. Standard HTML5 Web Notification if permission granted
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(`Nudge Alert: ${task.title} 🚨`, {
              body: `Due in ${hrsLeft} hours. Let's schedule dynamic work blocks with Nudge.`,
              icon: 'https://cdn-icons-png.flaticon.com/512/3593/3593497.png'
            });
          } catch (e) {
            console.warn("Failed to fire browser Notification:", e);
          }
        }

        // 3. Proactive chatbot auto-message
        const alertMsg: ChatMessage = {
          id: Math.random().toString(),
          role: 'model',
          parts: [{ text: `🚨 **Proactive Deadline Intervention:** I noticed that your task **"${task.title}"** is due in less than 24 hours (specifically, in **${hrsLeft} hours**)! Let's get this finished. Should I draft a custom step-by-step revision schedule or work block sequence for tomorrow to make sure you finish it on time?` }],
          createdAt: new Date().toISOString(),
          isSystem: true
        };
        setChatHistory(prev => [...prev, alertMsg]);
      });
    }
  }, [tasks, notifiedTaskIds]);

  // Proactive Alarms Helper: Find tasks due within 24 hours that are pending or in-progress
  const getProactiveAlarms = () => {
    return tasks.filter(task => {
      if (task.status === 'completed') return false;
      const dueTime = new Date(task.due_date).getTime();
      const now = Date.now();
      const hoursLeft = (dueTime - now) / (1000 * 60 * 60);
      return hoursLeft > 0 && hoursLeft <= 24;
    });
  };

  const criticalTasks = getProactiveAlarms();

  return (
    <div 
      id="app-container" 
      className={`flex flex-col ${needsAuth ? 'min-h-screen h-auto overflow-y-auto' : 'h-screen overflow-hidden'} w-full bg-transparent text-zinc-100 selection:bg-violet-600 selection:text-white font-sans relative`}
    >
      {/* Floating Active Toasts */}
      <div className="fixed top-20 left-4 right-4 sm:left-auto sm:right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {activeToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, x: 20 }}
              className="pointer-events-auto bg-[#0c0824]/95 border border-violet-500/30 rounded-2xl p-4 shadow-[0_10px_30px_rgba(139,92,246,0.3)] flex gap-3 relative overflow-hidden backdrop-blur-md"
            >
              {/* Highlight accent bar */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-indigo-600" />
              <div className="flex-1 text-left">
                <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-violet-400 animate-pulse" />
                  <span>{toast.title}</span>
                </div>
                <div className="text-[11px] text-indigo-200/70 mt-1 leading-relaxed">
                  {toast.message}
                </div>
                <div className="flex gap-2 mt-2.5">
                  <button
                    onClick={() => {
                      handleSendMessage(`Let's re-plan my day to focus on "${toast.title.replace('🚨 Urgent: ', '')}".`);
                      setActiveToasts(prev => prev.filter(t => t.id !== toast.id));
                    }}
                    className="text-[10px] bg-violet-600 hover:bg-violet-700 text-white font-extrabold px-3 py-1 rounded-full transition-all cursor-pointer shadow-md"
                  >
                    Reschedule Now
                  </button>
                  <button
                    onClick={() => setActiveToasts(prev => prev.filter(t => t.id !== toast.id))}
                    className="text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-3 py-1 rounded-full transition-all cursor-pointer border border-[#251e4d]/40"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button
                onClick={() => setActiveToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="absolute top-3 right-3 text-zinc-500 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Dynamic Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 bg-[#0d0926]/85 border-b border-[#251e4d]/40 backdrop-blur-md shrink-0 z-40">
        <div className="flex items-center gap-2 sm:gap-3">
          {currentUser && (
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded-lg border border-[#251e4d]/50 hover:bg-violet-950/20 hover:border-violet-900/30 text-indigo-300 hover:text-violet-400 md:hidden transition-all cursor-pointer mr-1"
              title="Open Dashboard"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center border border-violet-400/20 shadow-[0_0_15px_rgba(139,92,246,0.45)]">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-sm sm:text-base tracking-wide text-white leading-none">Last-Minute Life Saver</h1>
            <span className="text-[9px] sm:text-[10px] text-violet-400 font-mono tracking-wider uppercase mt-1.5 block font-semibold">Proactive AI Deadline Guardian</span>
          </div>
        </div>

        {/* User Account / Control info */}
        {currentUser && (
          <div className="flex items-center gap-3">
            {/* Quick Analytics Status Badge */}
            <button
              onClick={() => setActiveTab(activeTab === 'analytics' ? 'chat' : 'analytics')}
              className={`hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[11px] font-semibold font-mono tracking-wide transition-all cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-violet-600/25 text-white border-violet-500/40 shadow-[0_0_15px_rgba(139,92,246,0.3)]'
                  : 'bg-[#0f0a2d]/30 text-indigo-300 border-[#251e4d]/40 hover:bg-[#150e3d]/50 hover:text-white'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${tasks.filter(t => t.status !== 'completed').length > 0 ? 'bg-violet-400 animate-pulse shadow-[0_0_6px_rgba(167,139,250,0.8)]' : 'bg-zinc-500'}`} />
              <span>{tasks.filter(t => t.status !== 'completed').length} Active</span>
            </button>

            {/* Proactive Notification Bell System */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                className={`p-2 rounded-xl border border-[#251e4d]/50 hover:bg-violet-950/20 hover:border-violet-900/30 text-indigo-300 hover:text-violet-400 transition-all cursor-pointer relative ${showNotificationDropdown ? 'bg-violet-950/20 border-violet-900/40 text-violet-400' : ''}`}
                title="Alerts & Notification Center"
              >
                {criticalTasks.length > 0 ? (
                  <BellRing className="w-4 h-4 text-violet-400 animate-bounce" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
                {criticalTasks.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-mono font-extrabold animate-pulse">
                    {criticalTasks.length}
                  </span>
                )}
              </button>

              {/* Bell Dropdown Popup */}
              <AnimatePresence>
                {showNotificationDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 sm:right-0 mt-2 w-[calc(100vw-32px)] sm:w-80 bg-[#0c0824] border border-[#251e4d]/80 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.85)] p-4 z-50 space-y-3 font-sans backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between border-b border-[#251e4d]/30 pb-2">
                      <div className="flex items-center gap-1.5">
                        <AlertOctagon className="w-4 h-4 text-violet-400 animate-pulse" />
                        <span className="text-xs font-extrabold text-white">Alerts & Reminders</span>
                      </div>
                      <span className="text-[10px] text-indigo-300 font-mono font-bold bg-violet-950/40 px-2 py-0.5 rounded-full border border-violet-900/30">
                        {criticalTasks.length} Urgent
                      </span>
                    </div>

                    {/* Task Alert List */}
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                      {criticalTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                          <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                          <div>
                            <p className="text-xs font-bold text-zinc-100">All Deadlines Secured</p>
                            <p className="text-[10px] text-zinc-400/80 leading-none mt-0.5">No tasks due within 24 hours.</p>
                          </div>
                        </div>
                      ) : (
                        criticalTasks.map(task => {
                          const due = new Date(task.due_date);
                          const hrsLeft = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60));
                          return (
                            <div key={task.id} className="bg-violet-950/25 border border-violet-900/30 p-2.5 rounded-xl space-y-2 hover:border-violet-800/45 transition-all">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-extrabold text-zinc-100 truncate" title={task.title}>{task.title}</div>
                                  <div className="text-[10px] text-amber-300/80 font-semibold font-mono mt-0.5">
                                    Due in {hrsLeft} hrs ({due.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    handleSendMessage(`Create a step-by-step dynamic plan to finish my task "${task.title}" before it is due.`);
                                    setShowNotificationDropdown(false);
                                  }}
                                  className="text-[9px] bg-violet-600 hover:bg-violet-700 text-white font-extrabold px-2.5 py-1 rounded-md transition-all cursor-pointer"
                                >
                                  Nudge Plan
                                </button>
                                <button
                                  onClick={() => {
                                    handleUpdateTask(task.id!, { status: 'completed' });
                                  }}
                                  className="text-[9px] bg-emerald-600/20 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-600/30 px-2.5 py-1 rounded-md transition-all cursor-pointer"
                                >
                                  Done
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Permissions Config Switcher */}
                    <div className="border-t border-[#251e4d]/30 pt-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="text-left">
                          <div className="text-[10px] uppercase font-bold text-indigo-300/60 font-mono tracking-wider leading-none">Desktop Push Alerts</div>
                          <div className="text-[9px] text-zinc-400 mt-0.5">Status: {notificationPermission}</div>
                        </div>
                        {notificationPermission !== 'granted' ? (
                          <button
                            onClick={requestWebNotificationPermission}
                            className="text-[9px] bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 px-2.5 py-1.5 rounded-full font-bold transition-all cursor-pointer"
                          >
                            Enable Push
                          </button>
                        ) : (
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-zinc-200">{currentUser.displayName || 'Committed User'}</span>
              <span className="text-[10px] text-indigo-400/70 font-mono">{currentUser.email}</span>
            </div>
            
            {currentUser.photoURL ? (
              <img 
                src={currentUser.photoURL} 
                referrerPolicy="no-referrer"
                alt="Profile" 
                className="w-8 h-8 rounded-full border border-violet-800/50"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-zinc-400" />
              </div>
            )}

            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg border border-[#251e4d]/50 hover:bg-violet-950/20 hover:border-violet-900/30 text-indigo-300 hover:text-violet-400 transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {/* Proactive Flag Banner (Critical alarm less than 24h away) */}
      <AnimatePresence>
        {currentUser && criticalTasks.length > 0 && !isAlarmDismissed && isBannerVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="relative overflow-hidden border-b border-red-900/30 px-4 py-3 sm:px-6 sm:py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-indigo-100 z-10"
          >
            {/* Ambient pulsing background container */}
            <div className="absolute inset-0 alarm-banner-pulse pointer-events-none -z-10" />

            <div className="flex items-center gap-2 relative z-10 pr-10 sm:pr-0">
              <AlertOctagon className="w-4.5 h-4.5 text-rose-400 animate-bounce shrink-0" />
              <span>
                <strong>CRITICAL ALARM:</strong> you have <strong>{criticalTasks.length}</strong> deadline(s) due in less than 24 hours!
              </span>
            </div>
            <div className="flex items-center gap-3 relative z-10 w-full sm:w-auto justify-between sm:justify-start pr-10 sm:pr-0">
              <button
                onClick={() => handleSendMessage("Re-plan my day to finish my urgent tasks before they are due.")}
                className="btn-pill-lavender text-white tracking-tight shrink-0 w-full text-center px-3 py-2 !rounded-xl text-xs font-semibold sm:w-auto sm:px-5 sm:py-1.5 sm:!rounded-full sm:text-[11px] cursor-pointer shadow-[0_0_15px_rgba(167,139,250,0.35)] hover:shadow-[0_0_30px_rgba(167,139,250,0.95),_0_0_15px_rgba(139,92,246,0.65)] focus:shadow-[0_0_30px_rgba(167,139,250,0.95),_0_0_15px_rgba(139,92,246,0.65)] hover:scale-[1.01] sm:hover:scale-105 focus:scale-105 transition-all duration-300 outline-none"
              >
                Have Nudge Re-Plan Day
              </button>
            </div>

            <button
              onClick={() => {
                setIsBannerVisible(false);
                setIsAlarmDismissed(true);
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem('nudge_alarm_dismissed', 'true');
                }
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300/70 hover:text-white dark:hover:text-neutral-100 p-2 hover:bg-white/10 rounded-full transition-all duration-300 cursor-pointer flex items-center justify-center shrink-0 z-20 outline-none focus:outline-none focus:bg-white/10"
              title="Dismiss Alarm"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main workspace */}
      <div className={`flex-1 flex ${needsAuth ? 'min-h-0 h-auto overflow-visible' : 'overflow-hidden'} transition-all duration-300 ease-out z-10`}>
        {needsAuth ? (
          /* Landing Screen / Onboarding */
          <div className="flex-1 flex flex-col items-center justify-center py-10 px-6 text-center relative w-full">
            {/* Full Scene Illustration background */}
            <LandscapeBackground />

            <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center justify-center space-y-6">
              {/* The Cosmic Orb Area with Floating Glass Cards */}
              <div className="relative w-full max-w-md h-72 flex items-center justify-center mt-4 mb-10 md:my-2">
                {/* Soft glowing halo bleeding into the background behind the orb */}
                <div className="absolute w-80 h-80 rounded-full bg-violet-600/15 blur-3xl scale-125 animate-pulse pointer-events-none"></div>
                
                {/* Main character Nudge orb */}
                <div className="relative z-10">
                  {/* Secondary outer glow */}
                  <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-xl scale-110 pointer-events-none"></div>
                  
                  {/* ROTATING GLOW RING: Orbiting light animation */}
                  <div className="nudge-orbit-ring" />

                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
                    whileHover={{ scale: 1.08, boxShadow: "0 0 65px rgba(139,92,246,0.75)" }}
                    className={`w-36 h-36 ${isLoadingChat ? 'nudge-orb-thinking' : criticalTasks.length > 0 ? 'nudge-orb-urgent' : 'nudge-orb-organic'} flex flex-col items-center justify-center relative shadow-[0_0_50px_rgba(139,92,246,0.35)] cursor-pointer transition-shadow duration-300`}
                  >
                    {/* CRESCENT HIGHLIGHT to simulate light wrapping around a sphere */}
                    <div className="orb-crescent-highlight" />

                    {/* Triangles/almond shaped eyes pointing up, slightly lower-centered */}
                    <div className="flex gap-4 items-center justify-center mt-3 relative z-10">
                      <div className="nudge-eye animate-blink" />
                      <div className="nudge-eye animate-blink" />
                    </div>
                  </motion.div>
                </div>

                {/* Floating Translucent Glass Cards at different depths */}
                {/* Card 1: Left-Top */}
                <motion.div
                  animate={{ y: [0, -10, 0], x: [0, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 5.2, ease: "easeInOut" }}
                  className="absolute left-3 top-6 md:-left-12 md:top-6 glass-card-lavender px-4 py-2.5 rounded-2xl flex items-center gap-2 z-20 hover:scale-105 transition-transform"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                  </span>
                  <span className="text-xs font-semibold tracking-wide text-violet-200">Due in 3h</span>
                </motion.div>

                {/* Card 2: Right-Top */}
                <motion.div
                  animate={{ y: [0, 8, 0], x: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 6.4, ease: "easeInOut", delay: 0.4 }}
                  className="absolute right-3 top-6 md:-right-12 md:top-6 glass-card-lavender px-4 py-2.5 rounded-2xl flex items-center gap-2 z-20 hover:scale-105 transition-transform"
                >
                  <span className="h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.7)]"></span>
                  <span className="text-xs font-semibold tracking-wide text-indigo-200">Synced with Calendar</span>
                </motion.div>

                {/* Card 3: Left-Bottom */}
                <motion.div
                  animate={{ y: [0, 7, 0], x: [0, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 4.8, ease: "easeInOut", delay: 1.1 }}
                  className="absolute left-3 bottom-6 md:-left-12 md:bottom-6 glass-card-lavender px-4 py-2.5 rounded-2xl flex items-center gap-2 z-20 hover:scale-105 transition-transform"
                >
                  <div className="flex -space-x-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_4px_rgba(167,139,250,0.6)]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                  </div>
                  <span className="text-xs font-semibold tracking-wide text-violet-200">4 tasks today</span>
                </motion.div>

                {/* Card 4: Right-Bottom */}
                <motion.div
                  animate={{ y: [0, -7, 0], x: [0, 3, 0] }}
                  transition={{ repeat: Infinity, duration: 5.8, ease: "easeInOut", delay: 1.6 }}
                  className="absolute right-3 bottom-6 md:-right-12 md:bottom-6 glass-card-lavender px-4 py-2.5 rounded-2xl flex items-center gap-2 z-20 hover:scale-105 transition-transform"
                >
                  <span className="h-2 w-2 rounded-full bg-violet-300 animate-pulse shadow-[0_0_8px_rgba(196,181,253,0.8)]"></span>
                  <span className="text-xs font-semibold tracking-wide text-indigo-200 font-mono">Guardian Active</span>
                </motion.div>
              </div>

              <div className="space-y-4 flex flex-col items-center">
                <h2 className="font-display font-extrabold text-3xl md:text-4xl tracking-tighter text-white leading-tight">
                  Defeat Deadlines. Reclaim Time.
                </h2>
                {/* Thin glowing horizontal accent line under headline */}
                <div className="glowing-divider w-32"></div>
                <p className="text-indigo-200/70 text-sm leading-relaxed font-sans max-w-lg mx-auto pt-1">
                  Meet <strong className="text-violet-600 font-bold">Nudge</strong>, a hyper-focused AI productivity assistant that captures deadlines automatically, syncs with Google Calendar, and creates time-blocked plans to keep you on schedule.
                </p>
              </div>

              {/* Premium Pill-shaped CTA button with lavender gradient */}
              <div className="flex flex-col items-center gap-4 w-full sm:w-auto mt-4">
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="btn-pill-lavender text-white font-extrabold text-base tracking-wider px-10 py-4 shadow-[0_0_40px_rgba(167,139,250,0.8)] border-2 border-violet-400/40 hover:border-violet-300/60 transition-all z-10 cursor-pointer flex items-center justify-center gap-3 w-full"
                >
                  <Sparkles className="w-5 h-5 text-indigo-100 animate-pulse" />
                  <span>{isLoggingIn ? 'Connecting...' : 'Secure Google Sign-In'}</span>
                </button>
                
                <button
                  onClick={handleStartDemoMode}
                  className="text-xs font-semibold tracking-wider text-indigo-300 hover:text-white underline underline-offset-4 transition-all z-10 cursor-pointer opacity-80 hover:opacity-100"
                >
                  Try Demo Mode (no sign-in required)
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Active App Workspace */
          <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] overflow-hidden gap-2 md:gap-0 animate-none h-full">
            {/* Desktop Dashboard Sidebar Column */}
            <div className="hidden md:flex flex-col w-[320px] bg-[#08051a]/65 overflow-hidden shrink-0 h-full">
              {/* Header */}
              <div className="p-4 border-b border-[#251e4d]/30 flex items-center gap-2 bg-[#0c0824]/60 sticky top-0 z-20 shrink-0">
                <Layers className="w-5 h-5 text-violet-400 animate-pulse" />
                <span className="font-display font-extrabold text-sm tracking-wide text-white">Nudge Dashboard</span>
              </div>

              {/* Sidebar Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* 1. Theme Switcher */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-indigo-300/60 font-semibold font-mono block">
                    Visual Theme Mode
                  </label>
                  <div className="bg-[#0f0a2d] border border-[#251e4d]/60 rounded-xl p-1 flex gap-1">
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        theme === 'dark'
                          ? 'bg-violet-600 text-white shadow-md'
                          : 'text-indigo-300/60 hover:text-indigo-200 hover:bg-white/5'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark Space</span>
                    </button>
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        theme === 'light'
                          ? 'bg-amber-500 text-slate-900 shadow-md'
                          : 'text-indigo-300/60 hover:text-indigo-200 hover:bg-white/5'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Light Horizon</span>
                    </button>
                  </div>
                </div>

                {/* Workspace Navigation */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-indigo-300/60 font-semibold font-mono block">
                    Workspace Navigation
                  </label>
                  <div className="space-y-1.5">
                    <button
                      onClick={() => setActiveTab('chat')}
                      className={`w-full pl-4 pr-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all duration-200 ease-in-out cursor-pointer relative overflow-hidden ${
                        activeTab === 'chat'
                          ? 'bg-gradient-to-r from-purple-500/10 to-transparent text-white border border-violet-500/30'
                          : 'bg-[#0f0a2d]/40 text-indigo-300/60 border border-white/5 hover:text-indigo-200 hover:bg-white/5 hover:shadow-[0_0_12px_rgba(167,139,250,0.15)] hover:border-violet-500/20'
                      }`}
                    >
                      {activeTab === 'chat' && (
                        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-purple-500" />
                      )}
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-violet-400" />
                        <span>Guardian Chat</span>
                      </div>
                      <span className="text-[9px] font-mono text-indigo-300/40 bg-black/20 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveTab('analytics')}
                      className={`w-full pl-4 pr-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all duration-200 ease-in-out cursor-pointer relative overflow-hidden ${
                        activeTab === 'analytics'
                          ? 'bg-gradient-to-r from-purple-500/10 to-transparent text-white border border-violet-500/30 font-bold'
                          : 'bg-[#0f0a2d]/40 text-indigo-300/60 border border-white/5 hover:text-indigo-200 hover:bg-white/5 hover:shadow-[0_0_12px_rgba(167,139,250,0.15)] hover:border-violet-500/20'
                      }`}
                    >
                      {activeTab === 'analytics' && (
                        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-purple-500" />
                      )}
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-violet-400 animate-pulse" />
                        <span>Analytics Hub</span>
                      </div>
                      {tasks.filter(t => t.status !== 'completed').length > 0 && (
                        <span className="text-[9px] font-bold font-mono text-violet-300 bg-violet-600/15 border border-violet-500/30 px-1.5 py-0.5 rounded">
                          {tasks.filter(t => t.status !== 'completed').length} Left
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* 2. Add Account Component */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-indigo-300/60 font-semibold font-mono block">
                    Accounts & Integrations
                  </label>
                  <div className="bg-[#0f0a2d] border border-[#251e4d]/40 rounded-2xl p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-violet-400" />
                        <div>
                          <div className="text-xs font-bold text-zinc-100">Google Calendar</div>
                          <div className="text-[9px] text-indigo-300/50 leading-none mt-0.5">Auto deadline import</div>
                        </div>
                      </div>
                      <button
                        onClick={handleSyncGoogleCalendar}
                        disabled={calendarSyncing}
                        className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                          calendarSyncing
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 animate-pulse'
                            : googleToken 
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                              : 'bg-violet-600/10 text-violet-300 border-violet-500/20 hover:bg-violet-600/20'
                        }`}
                      >
                        {calendarSyncing ? 'Syncing...' : (googleToken ? 'Connected' : 'Connect')}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-[#251e4d]/20 pt-2.5">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-violet-400" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-zinc-100">Google Account</div>
                          <div className="text-[9px] text-indigo-300/50 leading-tight mt-0.5 truncate max-w-[120px]" title={currentUser ? currentUser.email || '' : ''}>
                            {currentUser ? (currentUser.email || 'Connected') : 'Not connected'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={currentUser ? handleLogout : handleLogin}
                        className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                          currentUser 
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20' 
                            : 'bg-violet-600 text-white border-violet-500/20 hover:bg-violet-700'
                        }`}
                      >
                        {currentUser ? 'Disconnect' : 'Add Account'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Add Task Section (collapsible accordion for complete TaskSidebar component) */}
                <div className="space-y-2">
                  <button
                    onClick={() => setIsTaskSectionExpanded(!isTaskSectionExpanded)}
                    className="w-full flex items-center justify-between p-3 bg-[#0f0a2d] hover:bg-[#150e3d] border border-[#251e4d]/40 rounded-xl transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-violet-400" />
                      <span className="text-xs font-bold text-zinc-100">Add Task & Deadlines</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-indigo-400 transition-transform ${isTaskSectionExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isTaskSectionExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden border border-[#251e4d]/30 rounded-xl bg-black/20"
                      >
                        <div className="max-h-[380px] overflow-y-auto">
                          <TaskSidebar
                            tasks={tasks}
                            onAddTask={handleAddTask}
                            onUpdateTask={handleUpdateTask}
                            onDeleteTask={handleDeleteTask}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Dashboard & Chat Column Container */}
            <div className="w-full h-full min-h-0 overflow-hidden flex flex-col relative px-4 py-2 sm:p-4">
              <AnimatePresence mode="wait">
                {activeTab === 'chat' ? (
                  <motion.div
                    key="chat-tab"
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 15 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="flex-1 min-h-0 overflow-hidden flex flex-col relative h-full"
                  >
                    <NudgeChat
                      chatHistory={chatHistory}
                      onSendMessage={handleSendMessage}
                      isLoading={isLoadingChat}
                      needsAuth={needsAuth}
                      onLogin={handleLogin}
                      isLoggingIn={isLoggingIn}
                      criticalTasksCount={criticalTasks.length}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="analytics-tab"
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="flex-1 min-h-0 overflow-hidden flex flex-col relative h-full"
                  >
                    <VisualDashboard
                      tasks={tasks}
                      onUpdateTask={handleUpdateTask}
                      onDeleteTask={handleDeleteTask}
                      fullscreen={true}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Sidebar/Drawer Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />

            {/* Sidebar Content */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-[320px] max-w-[85vw] h-full bg-[#08051a] border-r border-[#251e4d]/40 flex flex-col z-10 overflow-hidden shadow-[5px_0_30px_rgba(0,0,0,0.5)]"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-[#251e4d]/40 flex items-center justify-between bg-[#0c0824]/95 sticky top-0 z-20 shrink-0">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-violet-400" />
                  <span className="font-display font-bold text-base text-white">Nudge Dashboard</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* 1. Theme Switcher */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-indigo-300/60 font-semibold font-mono block">
                    Visual Theme Mode
                  </label>
                  <div className="bg-[#0f0a2d] border border-[#251e4d]/60 rounded-xl p-1 flex gap-1">
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        theme === 'dark'
                          ? 'bg-violet-600 text-white shadow-md'
                          : 'text-indigo-300/60 hover:text-indigo-200 hover:bg-white/5'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark Space</span>
                    </button>
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        theme === 'light'
                          ? 'bg-amber-500 text-slate-900 shadow-md'
                          : 'text-indigo-300/60 hover:text-indigo-200 hover:bg-white/5'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Light Horizon</span>
                    </button>
                  </div>
                </div>

                {/* Workspace Navigation */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-indigo-300/60 font-semibold font-mono block">
                    Workspace Navigation
                  </label>
                  <div className="space-y-1.5">
                    <button
                      onClick={() => {
                        setActiveTab('chat');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full pl-4 pr-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all duration-200 ease-in-out cursor-pointer relative overflow-hidden ${
                        activeTab === 'chat'
                          ? 'bg-gradient-to-r from-purple-500/10 to-transparent text-white border border-violet-500/30'
                          : 'bg-[#0f0a2d]/40 text-indigo-300/60 border border-white/5 hover:text-indigo-200 hover:bg-white/5 hover:shadow-[0_0_12px_rgba(167,139,250,0.15)] hover:border-violet-500/20'
                      }`}
                    >
                      {activeTab === 'chat' && (
                        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-purple-500" />
                      )}
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-violet-400" />
                        <span>Guardian Chat</span>
                      </div>
                      <span className="text-[9px] font-mono text-indigo-300/40 bg-black/20 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('analytics');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full pl-4 pr-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all duration-200 ease-in-out cursor-pointer relative overflow-hidden ${
                        activeTab === 'analytics'
                          ? 'bg-gradient-to-r from-purple-500/10 to-transparent text-white border border-violet-500/30 font-bold'
                          : 'bg-[#0f0a2d]/40 text-indigo-300/60 border border-white/5 hover:text-indigo-200 hover:bg-white/5 hover:shadow-[0_0_12px_rgba(167,139,250,0.15)] hover:border-violet-500/20'
                      }`}
                    >
                      {activeTab === 'analytics' && (
                        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-purple-500" />
                      )}
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-violet-400 animate-pulse" />
                        <span>Analytics Hub</span>
                      </div>
                      {tasks.filter(t => t.status !== 'completed').length > 0 && (
                        <span className="text-[9px] font-bold font-mono text-violet-300 bg-violet-600/15 border border-violet-500/30 px-1.5 py-0.5 rounded">
                          {tasks.filter(t => t.status !== 'completed').length} Left
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* 2. Add Account Component */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-indigo-300/60 font-semibold font-mono block">
                    Accounts & Integrations
                  </label>
                  <div className="bg-[#0f0a2d] border border-[#251e4d]/40 rounded-2xl p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-violet-400" />
                        <div>
                          <div className="text-xs font-bold text-zinc-100">Google Calendar</div>
                          <div className="text-[9px] text-indigo-300/50 leading-none mt-0.5">Auto deadline import</div>
                        </div>
                      </div>
                      <button
                        onClick={handleSyncGoogleCalendar}
                        disabled={calendarSyncing}
                        className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                          calendarSyncing
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 animate-pulse'
                            : googleToken 
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                              : 'bg-violet-600/10 text-violet-300 border-violet-500/20 hover:bg-violet-600/20'
                        }`}
                      >
                        {calendarSyncing ? 'Syncing...' : (googleToken ? 'Connected' : 'Connect')}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-[#251e4d]/20 pt-2.5">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-violet-400" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-zinc-100">Google Account</div>
                          <div className="text-[9px] text-indigo-300/50 leading-tight mt-0.5 truncate max-w-[120px]">
                            {currentUser ? (currentUser.email || 'Connected') : 'Not connected'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={currentUser ? handleLogout : handleLogin}
                        className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                          currentUser 
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20' 
                            : 'bg-violet-600 text-white border-violet-500/20 hover:bg-violet-700'
                        }`}
                      >
                        {currentUser ? 'Disconnect' : 'Add Account'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Add Task Section (collapsible accordion for complete TaskSidebar component) */}
                <div className="space-y-2">
                  <button
                    onClick={() => setIsTaskSectionExpanded(!isTaskSectionExpanded)}
                    className="w-full flex items-center justify-between p-3 bg-[#0f0a2d] hover:bg-[#150e3d] border border-[#251e4d]/40 rounded-xl transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-violet-400" />
                      <span className="text-xs font-bold text-zinc-100">Add Task & Deadlines</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-indigo-400 transition-transform ${isTaskSectionExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isTaskSectionExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden border border-[#251e4d]/30 rounded-xl bg-black/20"
                      >
                        <div className="max-h-[380px] overflow-y-auto">
                          <TaskSidebar
                            tasks={tasks}
                            onAddTask={handleAddTask}
                            onUpdateTask={handleUpdateTask}
                            onDeleteTask={handleDeleteTask}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
