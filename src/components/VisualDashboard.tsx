import React, { useState } from 'react';
import { Task } from '../types';
import { 
  AlertOctagon, 
  Clock, 
  CheckCircle2, 
  Play, 
  Check, 
  RotateCcw, 
  Trash2, 
  Calendar,
  Grid,
  Trello,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ShieldCheck,
  ChevronRight,
  Flame,
  CheckCircle,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VisualDashboardProps {
  tasks: Task[];
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  fullscreen?: boolean;
}

export const VisualDashboard: React.FC<VisualDashboardProps> = ({
  tasks,
  onUpdateTask,
  onDeleteTask,
  fullscreen = false
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  // Helper to calculate time remaining
  const getTimeRemainingStr = (dueDateStr: string) => {
    const dueDate = new Date(dueDateStr);
    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime();
    
    if (diffMs < 0) {
      return 'Overdue';
    }
    
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) {
      return `T-Minus ${diffHours}h`;
    }
    
    const diffDays = Math.floor(diffHours / 24);
    const remainHours = diffHours % 24;
    return `T-Minus ${diffDays}d ${remainHours}h`;
  };

  // Check if task is urgent (due in < 48 hours)
  const isUrgentTask = (task: Task) => {
    if (task.status === 'completed') return false;
    const dueDate = new Date(task.due_date);
    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime();
    return diffMs > 0 && diffMs < 48 * 60 * 60 * 1000;
  };

  // Check if task is critical (priority high or urgent)
  const isCriticalTask = (task: Task) => {
    return task.priority === 'urgent' || task.priority === 'high';
  };

  // Sort tasks into Matrix Quadrants (filtering out completed tasks for the active matrix)
  const activeTasks = tasks.filter(t => t.status !== 'completed');

  const q1_criticalUrgent = activeTasks.filter(t => isCriticalTask(t) && isUrgentTask(t));
  const q2_criticalNotUrgent = activeTasks.filter(t => isCriticalTask(t) && !isUrgentTask(t));
  const q3_urgentLowPriority = activeTasks.filter(t => !isCriticalTask(t) && isUrgentTask(t));
  const q4_chill = activeTasks.filter(t => !isCriticalTask(t) && !isUrgentTask(t));

  // Kanban filters
  const kanbanPending = tasks.filter(t => t.status === 'pending');
  const kanbanInProgress = tasks.filter(t => t.status === 'in-progress');
  const kanbanCompleted = tasks.filter(t => t.status === 'completed');

  // Stats for micro-indicators
  const criticalCount = activeTasks.filter(isCriticalTask).length;
  const activeCount = tasks.filter(t => t.status === 'in-progress').length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  
  // Completed percentage
  const totalCount = tasks.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Handle progressing status
  const handleProgressStatus = async (task: Task) => {
    if (!task.id) return;
    setIsSyncing(task.id);
    let nextStatus: Task['status'] = 'pending';
    if (task.status === 'pending') nextStatus = 'in-progress';
    else if (task.status === 'in-progress') nextStatus = 'completed';
    else nextStatus = 'pending';

    try {
      await onUpdateTask(task.id, { status: nextStatus, updatedAt: new Date().toISOString() });
    } catch (e) {
      console.error('Error progressing status:', e);
    } finally {
      setIsSyncing(null);
    }
  };

  // Handle regression status
  const handleRegressStatus = async (task: Task) => {
    if (!task.id) return;
    setIsSyncing(task.id);
    try {
      await onUpdateTask(task.id, { status: 'pending', updatedAt: new Date().toISOString() });
    } catch (e) {
      console.error('Error regressing status:', e);
    } finally {
      setIsSyncing(null);
    }
  };

  const getPriorityBadgeStyles = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'bg-rose-500/15 text-rose-300 border border-rose-500/35';
      case 'high':
        return 'bg-amber-500/15 text-amber-300 border border-amber-500/35';
      case 'medium':
        return 'bg-violet-500/15 text-violet-300 border border-violet-500/35';
      case 'low':
        return 'bg-zinc-500/15 text-zinc-300 border border-zinc-700/35';
    }
  };

  if (fullscreen) {
    return (
      <div className="w-full flex-1 flex flex-col space-y-6 overflow-y-auto p-4 sm:p-6 md:p-8 bg-neutral-950/40 backdrop-blur-md rounded-[24px] border border-white/5 shadow-2xl relative z-10 scrollbar-thin">
        {/* Decorative background glow inside dashboard */}
        <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-indigo-600/5 blur-3xl pointer-events-none"></div>

        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="relative w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
                <TrendingUp className="w-4 h-4 animate-pulse" />
              </div>
              <h2 className="font-display font-extrabold text-lg sm:text-xl text-white tracking-wide">
                Strategic Analytics Hub
              </h2>
            </div>
            <p className="text-xs text-indigo-300/60 font-medium">
              A comprehensive bento grid showing your Eisenhower Urgency Matrix and Kanban workflow.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold font-mono text-zinc-400 bg-neutral-900 px-3.5 py-1.5 rounded-xl border border-white/5">
              Completion Velocity: <strong className="text-emerald-400 font-bold">{completionPercentage}%</strong>
            </span>
          </div>
        </div>

        {/* 1. Bento Grid Quick Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          {/* Card 1: Progress Rate */}
          <div className="bg-[#0f0a2d]/60 border border-[#251e4d]/40 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-md relative overflow-hidden group hover:border-violet-500/30 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-indigo-300/60 font-semibold font-mono uppercase tracking-wider">Completion Rate</span>
              <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-display font-black text-white">{completedCount}</span>
                <span className="text-xs text-indigo-300/40">/ {totalCount} finished</span>
              </div>
              <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-violet-500 via-indigo-400 to-emerald-400 transition-all duration-700"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Critical / Urgent Focus */}
          <div className="bg-[#0f0a2d]/60 border border-[#251e4d]/40 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-md relative overflow-hidden group hover:border-rose-500/30 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-rose-300/60 font-semibold font-mono uppercase tracking-wider">Critical Focus</span>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
            </div>
            <div>
              <div className="text-3xl font-display font-black text-white">{criticalCount}</div>
              <div className="text-xs text-rose-300/50 mt-1 font-semibold uppercase tracking-wider">High Priority Tasks</div>
            </div>
          </div>

          {/* Card 3: In-Progress Status */}
          <div className="bg-[#0f0a2d]/60 border border-[#251e4d]/40 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-md relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-indigo-300/60 font-semibold font-mono uppercase tracking-wider">In Active Sprint</span>
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="text-3xl font-display font-black text-white">{activeCount}</div>
              <div className="text-xs text-indigo-300/50 mt-1 font-semibold uppercase tracking-wider">Sprinting Tasks</div>
            </div>
          </div>

          {/* Card 4: Backburner / Chill */}
          <div className="bg-[#0f0a2d]/60 border border-[#251e4d]/40 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-md relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-emerald-300/60 font-semibold font-mono uppercase tracking-wider">Backlog / Chill</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-3xl font-display font-black text-white">{q4_chill.length}</div>
              <div className="text-xs text-emerald-300/50 mt-1 font-semibold uppercase tracking-wider">Chill Tasks Scheduled</div>
            </div>
          </div>
        </div>

        {/* 2. Eisenhower 2x2 Matrix Block - Rendered as large grid cards */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-1.5 border-b border-white/5 pb-1">
            <Grid className="w-4 h-4 text-violet-400" />
            <h3 className="font-display font-extrabold text-sm text-white uppercase tracking-wider">Strategic Priority Matrix (Eisenhower 2x2)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Q1: Critical & Urgent */}
            <div className="border border-rose-500/20 bg-rose-950/5 hover:border-rose-500/35 rounded-2xl p-4 flex flex-col relative overflow-hidden transition-all duration-300 shadow-lg min-h-[180px]">
              <div className="flex items-center justify-between border-b border-rose-500/10 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                  <span className="font-display font-extrabold text-xs text-rose-300 uppercase tracking-wider">Q1: Urgent & Critical</span>
                </div>
                <span className="text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded font-bold font-mono">
                  {q1_criticalUrgent.length} tasks
                </span>
              </div>
              
              <div className="space-y-2 flex-1 overflow-y-auto pr-1 max-h-[160px] custom-scroll">
                {q1_criticalUrgent.length === 0 ? (
                  <div className="h-full py-6 flex flex-col items-center justify-center text-center text-rose-300/20">
                    <ShieldCheck className="w-6 h-6 mb-1 text-rose-400/15" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Quadrant Cleared</span>
                  </div>
                ) : (
                  q1_criticalUrgent.map(task => (
                    <MatrixCard 
                      key={task.id} 
                      task={task} 
                      isSyncing={isSyncing === task.id}
                      onProgress={() => handleProgressStatus(task)} 
                      onDelete={onDeleteTask}
                      getTimeRemainingStr={getTimeRemainingStr}
                      getPriorityBadgeStyles={getPriorityBadgeStyles}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Q2: High Priority / Not Urgent */}
            <div className="border border-amber-500/20 bg-amber-950/5 hover:border-amber-500/35 rounded-2xl p-4 flex flex-col relative overflow-hidden transition-all duration-300 shadow-lg min-h-[180px]">
              <div className="flex items-center justify-between border-b border-amber-500/10 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                  <span className="font-display font-extrabold text-xs text-amber-300 uppercase tracking-wider">Q2: High Priority (Schedule)</span>
                </div>
                <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-bold font-mono">
                  {q2_criticalNotUrgent.length} tasks
                </span>
              </div>
              
              <div className="space-y-2 flex-1 overflow-y-auto pr-1 max-h-[160px] custom-scroll">
                {q2_criticalNotUrgent.length === 0 ? (
                  <div className="h-full py-6 flex flex-col items-center justify-center text-center text-amber-300/20">
                    <ShieldCheck className="w-6 h-6 mb-1 text-amber-400/15" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Quadrant Cleared</span>
                  </div>
                ) : (
                  q2_criticalNotUrgent.map(task => (
                    <MatrixCard 
                      key={task.id} 
                      task={task} 
                      isSyncing={isSyncing === task.id}
                      onProgress={() => handleProgressStatus(task)} 
                      onDelete={onDeleteTask}
                      getTimeRemainingStr={getTimeRemainingStr}
                      getPriorityBadgeStyles={getPriorityBadgeStyles}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Q3: Urgent / Low Priority */}
            <div className="border border-violet-500/20 bg-violet-950/5 hover:border-violet-500/35 rounded-2xl p-4 flex flex-col relative overflow-hidden transition-all duration-300 shadow-lg min-h-[180px]">
              <div className="flex items-center justify-between border-b border-violet-500/10 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-violet-500 rounded-full"></span>
                  <span className="font-display font-extrabold text-xs text-violet-300 uppercase tracking-wider">Q3: Sprint / Delegate</span>
                </div>
                <span className="text-[10px] bg-violet-500/15 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded font-bold font-mono">
                  {q3_urgentLowPriority.length} tasks
                </span>
              </div>
              
              <div className="space-y-2 flex-1 overflow-y-auto pr-1 max-h-[160px] custom-scroll">
                {q3_urgentLowPriority.length === 0 ? (
                  <div className="h-full py-6 flex flex-col items-center justify-center text-center text-violet-300/20">
                    <ShieldCheck className="w-6 h-6 mb-1 text-violet-400/15" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Quadrant Cleared</span>
                  </div>
                ) : (
                  q3_urgentLowPriority.map(task => (
                    <MatrixCard 
                      key={task.id} 
                      task={task} 
                      isSyncing={isSyncing === task.id}
                      onProgress={() => handleProgressStatus(task)} 
                      onDelete={onDeleteTask}
                      getTimeRemainingStr={getTimeRemainingStr}
                      getPriorityBadgeStyles={getPriorityBadgeStyles}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Q4: Chill Backburner */}
            <div className="border border-zinc-500/20 bg-zinc-950/5 hover:border-zinc-500/35 rounded-2xl p-4 flex flex-col relative overflow-hidden transition-all duration-300 shadow-lg min-h-[180px]">
              <div className="flex items-center justify-between border-b border-zinc-500/10 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-zinc-500 rounded-full"></span>
                  <span className="font-display font-extrabold text-xs text-zinc-300 uppercase tracking-wider">Q4: Chill Backburner</span>
                </div>
                <span className="text-[10px] bg-zinc-500/15 text-zinc-300 border border-zinc-500/30 px-2 py-0.5 rounded font-bold font-mono">
                  {q4_chill.length} tasks
                </span>
              </div>
              
              <div className="space-y-2 flex-1 overflow-y-auto pr-1 max-h-[160px] custom-scroll">
                {q4_chill.length === 0 ? (
                  <div className="h-full py-6 flex flex-col items-center justify-center text-center text-zinc-300/20">
                    <ShieldCheck className="w-6 h-6 mb-1 text-zinc-400/15" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Quadrant Cleared</span>
                  </div>
                ) : (
                  q4_chill.map(task => (
                    <MatrixCard 
                      key={task.id} 
                      task={task} 
                      isSyncing={isSyncing === task.id}
                      onProgress={() => handleProgressStatus(task)} 
                      onDelete={onDeleteTask}
                      getTimeRemainingStr={getTimeRemainingStr}
                      getPriorityBadgeStyles={getPriorityBadgeStyles}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Horizontal Kanban Boards */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-1.5 border-b border-white/5 pb-1">
            <Trello className="w-4 h-4 text-indigo-400" />
            <h3 className="font-display font-extrabold text-sm text-white uppercase tracking-wider">Kanban Workflow columns</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Column 1: Not Started */}
            <div className="bg-black/25 border border-[#251e4d]/30 rounded-2xl p-4 flex flex-col min-h-[220px]">
              <div className="flex items-center justify-between border-b border-[#251e4d]/40 pb-2 mb-3">
                <span className="font-display font-extrabold text-xs text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                  <span>Not Started ({kanbanPending.length})</span>
                </span>
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto pr-1 max-h-[200px] custom-scroll font-sans">
                {kanbanPending.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-8 text-center text-zinc-600 text-[10px] font-semibold uppercase tracking-wider">No pending tasks</div>
                ) : (
                  kanbanPending.map(task => (
                    <KanbanCard 
                      key={task.id}
                      task={task}
                      isSyncing={isSyncing === task.id}
                      onProgress={() => handleProgressStatus(task)}
                      onDelete={onDeleteTask}
                      getTimeRemainingStr={getTimeRemainingStr}
                      getPriorityBadgeStyles={getPriorityBadgeStyles}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Column 2: In Progress */}
            <div className="bg-violet-950/5 border border-violet-500/15 rounded-2xl p-4 flex flex-col min-h-[220px]">
              <div className="flex items-center justify-between border-b border-violet-500/10 pb-2 mb-3">
                <span className="font-display font-extrabold text-xs text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-violet-500 rounded-full animate-ping animate-duration-1000"></span>
                  <span>In Progress ({kanbanInProgress.length})</span>
                </span>
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto pr-1 max-h-[200px] custom-scroll font-sans">
                {kanbanInProgress.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-8 text-center text-violet-500/20 text-[10px] font-semibold uppercase tracking-wider">None active</div>
                ) : (
                  kanbanInProgress.map(task => (
                    <KanbanCard 
                      key={task.id}
                      task={task}
                      isSyncing={isSyncing === task.id}
                      onProgress={() => handleProgressStatus(task)}
                      onRegress={() => handleRegressStatus(task)}
                      onDelete={onDeleteTask}
                      getTimeRemainingStr={getTimeRemainingStr}
                      getPriorityBadgeStyles={getPriorityBadgeStyles}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Column 3: Completed */}
            <div className="bg-emerald-950/5 border border-emerald-500/15 rounded-2xl p-4 flex flex-col min-h-[220px]">
              <div className="flex items-center justify-between border-b border-emerald-500/10 pb-2 mb-3">
                <span className="font-display font-extrabold text-xs text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                  <span>Completed ({kanbanCompleted.length})</span>
                </span>
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto pr-1 max-h-[200px] custom-scroll font-sans">
                {kanbanCompleted.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-8 text-center text-emerald-500/20 text-[10px] font-semibold uppercase tracking-wider">None completed</div>
                ) : (
                  kanbanCompleted.map(task => (
                    <KanbanCard 
                      key={task.id}
                      task={task}
                      isSyncing={isSyncing === task.id}
                      onProgress={() => handleProgressStatus(task)}
                      onRegress={() => handleRegressStatus(task)}
                      onDelete={onDeleteTask}
                      getTimeRemainingStr={getTimeRemainingStr}
                      getPriorityBadgeStyles={getPriorityBadgeStyles}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#0f0a2d]/80 border border-[#251e4d]/40 rounded-2xl flex flex-col overflow-hidden relative transition-all shadow-lg shadow-black/40">
      {/* Visual Top Glow Accent Line */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/30 to-transparent"></div>

      {/* 1. COLLAPSIBLE ACCORDION HEADER BAR */}
      <div 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="px-4 py-3 flex flex-col gap-2.5 cursor-pointer hover:bg-violet-950/15 transition-all select-none"
      >
        {/* Row 1: Left Info Column */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-7 h-7 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
              <TrendingUp className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h4 className="font-display font-black text-[11px] uppercase tracking-wider text-white">Analytics Hub</h4>
              <p className="text-[9px] text-indigo-300/50 leading-none truncate">Triage & Kanban</p>
            </div>
          </div>
          <span className="text-[9px] font-bold bg-violet-500/10 text-violet-300 border border-violet-500/20 px-1.5 py-0.5 rounded-md uppercase font-mono shrink-0">
            {completionPercentage}% Done
          </span>
        </div>

        {/* Row 2: GLOWING MICRO-INDICATORS */}
        <div className="flex items-center justify-between gap-2 border-t border-[#251e4d]/30 pt-2">
          <div className="flex items-center gap-2 overflow-x-auto max-w-full">
            {/* Critical Indicator */}
            <div className="flex items-center gap-1 text-[8px] font-bold uppercase shrink-0 font-mono text-rose-400">
              <span className={`w-1.5 h-1.5 rounded-full bg-rose-500 ${criticalCount > 0 ? 'animate-ping shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'opacity-40'}`}></span>
              <span>{criticalCount} Critical</span>
            </div>

            <span className="w-1 h-1 bg-[#251e4d] rounded-full shrink-0"></span>

            {/* Active/In-Progress Indicator */}
            <div className="flex items-center gap-1 text-[8px] font-bold uppercase shrink-0 font-mono text-indigo-400">
              <span className={`w-1.5 h-1.5 rounded-full bg-violet-500 ${activeCount > 0 ? 'animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.8)]' : 'opacity-40'}`}></span>
              <span>{activeCount} Active</span>
            </div>

            <span className="w-1 h-1 bg-[#251e4d] rounded-full shrink-0"></span>

            {/* Completed Indicator */}
            <div className="flex items-center gap-1 text-[8px] font-bold uppercase shrink-0 font-mono text-emerald-400">
              <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${completedCount > 0 ? 'shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'opacity-40'}`}></span>
              <span>{completedCount} Done</span>
            </div>
          </div>

          {/* Toggle Expand Icon */}
          <motion.div
            animate={{ rotate: isCollapsed ? 0 : 180 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="p-1 rounded-md bg-violet-950/40 border border-violet-900/30 text-indigo-300 shrink-0"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </motion.div>
        </div>
      </div>

      {/* 2. EXPANDED CONTENT DRAWER (with Framer Motion for flawless buttery animations) */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="border-t border-[#251e4d]/35 overflow-hidden"
          >
            {/* Content Container */}
            <div className="p-3.5 bg-[#09051d]/98 max-h-[500px] overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-violet-900/50">
              
              {/* Header Info & Performance Progress Bar */}
              <div className="flex flex-col gap-2.5 bg-[#0d0725]/50 border border-[#251e4d]/40 rounded-xl p-3">
                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold font-mono text-violet-300 mb-1">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-violet-400 animate-pulse" />
                      COMPLETION RATE
                    </span>
                    <span className="text-emerald-400 font-mono font-bold">{completionPercentage}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-500 via-indigo-400 to-emerald-400 transition-all duration-700"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400/80 font-medium flex items-center justify-between border-t border-[#251e4d]/35 pt-2">
                  <span>Total Tasks Logged:</span>
                  <strong className="text-white font-mono">{totalCount}</strong>
                </div>
              </div>

              {/* SECTION 1: 2X2 URGENCY MATRIX */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 border-b border-[#251e4d]/35 pb-1">
                  <Grid className="w-3.5 h-3.5 text-violet-400" />
                  <h5 className="text-[10px] font-black uppercase tracking-wider text-violet-300">2x2 Urgency Matrix</h5>
                  <span className="text-[9px] text-indigo-300/40 font-mono">Active Tasks Priority</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* Q1: Critical & Urgent */}
                  <div className="border border-rose-500/20 bg-rose-950/5 hover:border-rose-500/30 rounded-xl p-2.5 flex flex-col relative overflow-hidden transition-all min-h-[110px]">
                    <div className="flex items-center justify-between border-b border-rose-500/10 pb-1.5 mb-1.5">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></span>
                        <span className="font-display font-black text-[9px] text-rose-300 uppercase tracking-wider">Q1: Urgent/Critical</span>
                      </div>
                      <span className="text-[9px] bg-rose-500/15 text-rose-300 border border-rose-500/30 px-1 rounded font-bold font-mono">
                        {q1_criticalUrgent.length}
                      </span>
                    </div>
                    
                    <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-0.5 custom-scroll">
                      {q1_criticalUrgent.length === 0 ? (
                        <div className="py-4 flex flex-col items-center justify-center text-center text-rose-300/20">
                          <ShieldCheck className="w-4 h-4 mb-0.5 text-rose-400/15" />
                          <span className="text-[8px] font-bold uppercase tracking-wider">All Clear</span>
                        </div>
                      ) : (
                        q1_criticalUrgent.map(task => (
                          <MatrixCard 
                            key={task.id} 
                            task={task} 
                            isSyncing={isSyncing === task.id}
                            onProgress={() => handleProgressStatus(task)} 
                            onDelete={onDeleteTask}
                            getTimeRemainingStr={getTimeRemainingStr}
                            getPriorityBadgeStyles={getPriorityBadgeStyles}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Q2: High Priority / Planned */}
                  <div className="border border-amber-500/20 bg-amber-950/5 hover:border-amber-500/30 rounded-xl p-2.5 flex flex-col relative overflow-hidden transition-all min-h-[110px]">
                    <div className="flex items-center justify-between border-b border-amber-500/10 pb-1.5 mb-1.5">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                        <span className="font-display font-black text-[9px] text-amber-300 uppercase tracking-wider">Q2: High Priority</span>
                      </div>
                      <span className="text-[9px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1 rounded font-bold font-mono">
                        {q2_criticalNotUrgent.length}
                      </span>
                    </div>
                    
                    <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-0.5 custom-scroll">
                      {q2_criticalNotUrgent.length === 0 ? (
                        <div className="py-4 flex flex-col items-center justify-center text-center text-amber-300/20">
                          <ShieldCheck className="w-4 h-4 mb-0.5 text-amber-400/15" />
                          <span className="text-[8px] font-bold uppercase tracking-wider">All Clear</span>
                        </div>
                      ) : (
                        q2_criticalNotUrgent.map(task => (
                          <MatrixCard 
                            key={task.id} 
                            task={task} 
                            isSyncing={isSyncing === task.id}
                            onProgress={() => handleProgressStatus(task)} 
                            onDelete={onDeleteTask}
                            getTimeRemainingStr={getTimeRemainingStr}
                            getPriorityBadgeStyles={getPriorityBadgeStyles}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Q3: Urgent but Low Priority */}
                  <div className="border border-violet-500/20 bg-violet-950/5 hover:border-violet-500/30 rounded-xl p-2.5 flex flex-col relative overflow-hidden transition-all min-h-[110px]">
                    <div className="flex items-center justify-between border-b border-violet-500/10 pb-1.5 mb-1.5">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-violet-500 rounded-full"></span>
                        <span className="font-display font-black text-[9px] text-violet-300 uppercase tracking-wider">Q3: Delegate/Sprints</span>
                      </div>
                      <span className="text-[9px] bg-violet-500/15 text-violet-300 border border-violet-500/30 px-1 rounded font-bold font-mono">
                        {q3_urgentLowPriority.length}
                      </span>
                    </div>
                    
                    <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-0.5 custom-scroll">
                      {q3_urgentLowPriority.length === 0 ? (
                        <div className="py-4 flex flex-col items-center justify-center text-center text-violet-300/20">
                          <ShieldCheck className="w-4 h-4 mb-0.5 text-violet-400/15" />
                          <span className="text-[8px] font-bold uppercase tracking-wider">All Clear</span>
                        </div>
                      ) : (
                        q3_urgentLowPriority.map(task => (
                          <MatrixCard 
                            key={task.id} 
                            task={task} 
                            isSyncing={isSyncing === task.id}
                            onProgress={() => handleProgressStatus(task)} 
                            onDelete={onDeleteTask}
                            getTimeRemainingStr={getTimeRemainingStr}
                            getPriorityBadgeStyles={getPriorityBadgeStyles}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Q4: Low Priority & Non-Urgent */}
                  <div className="border border-zinc-500/20 bg-zinc-950/5 hover:border-zinc-500/30 rounded-xl p-2.5 flex flex-col relative overflow-hidden transition-all min-h-[110px]">
                    <div className="flex items-center justify-between border-b border-zinc-500/10 pb-1.5 mb-1.5">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full"></span>
                        <span className="font-display font-black text-[9px] text-zinc-300 uppercase tracking-wider">Q4: Chill Backburner</span>
                      </div>
                      <span className="text-[9px] bg-zinc-500/15 text-zinc-300 border border-zinc-500/30 px-1 rounded font-bold font-mono">
                        {q4_chill.length}
                      </span>
                    </div>
                    
                    <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-0.5 custom-scroll">
                      {q4_chill.length === 0 ? (
                        <div className="py-4 flex flex-col items-center justify-center text-center text-zinc-300/20">
                          <ShieldCheck className="w-4 h-4 mb-0.5 text-zinc-400/15" />
                          <span className="text-[8px] font-bold uppercase tracking-wider">All Clear</span>
                        </div>
                      ) : (
                        q4_chill.map(task => (
                          <MatrixCard 
                            key={task.id} 
                            task={task} 
                            isSyncing={isSyncing === task.id}
                            onProgress={() => handleProgressStatus(task)} 
                            onDelete={onDeleteTask}
                            getTimeRemainingStr={getTimeRemainingStr}
                            getPriorityBadgeStyles={getPriorityBadgeStyles}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: MINI KANBAN BOARD */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-1.5 border-b border-[#251e4d]/35 pb-1">
                  <Trello className="w-3.5 h-3.5 text-indigo-400" />
                  <h5 className="text-[10px] font-black uppercase tracking-wider text-indigo-300">Mini Kanban Columns</h5>
                  <span className="text-[9px] text-indigo-300/40 font-mono">Status Board Tracker</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* To Do Column */}
                  <div className="bg-black/25 border border-[#251e4d]/30 rounded-xl p-2.5 flex flex-col">
                    <div className="flex items-center justify-between border-b border-[#251e4d]/40 pb-1.5 mb-1.5">
                      <span className="font-display font-black text-[9px] text-zinc-300 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></span>
                        <span>Not Started ({kanbanPending.length})</span>
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-0.5 custom-scroll">
                      {kanbanPending.length === 0 ? (
                        <div className="py-4 text-center text-zinc-600 text-[9px] font-semibold uppercase tracking-wider">Empty</div>
                      ) : (
                        kanbanPending.map(task => (
                          <KanbanCard 
                            key={task.id}
                            task={task}
                            isSyncing={isSyncing === task.id}
                            onProgress={() => handleProgressStatus(task)}
                            onDelete={onDeleteTask}
                            getTimeRemainingStr={getTimeRemainingStr}
                            getPriorityBadgeStyles={getPriorityBadgeStyles}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* In Progress Column */}
                  <div className="bg-violet-950/5 border border-violet-500/15 rounded-xl p-2.5 flex flex-col">
                    <div className="flex items-center justify-between border-b border-violet-500/10 pb-1.5 mb-1.5">
                      <span className="font-display font-black text-[9px] text-violet-300 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-ping"></span>
                        <span>In Progress ({kanbanInProgress.length})</span>
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-0.5 custom-scroll">
                      {kanbanInProgress.length === 0 ? (
                        <div className="py-4 text-center text-violet-500/20 text-[9px] font-semibold uppercase tracking-wider">None active</div>
                      ) : (
                        kanbanInProgress.map(task => (
                          <KanbanCard 
                            key={task.id}
                            task={task}
                            isSyncing={isSyncing === task.id}
                            onProgress={() => handleProgressStatus(task)}
                            onRegress={() => handleRegressStatus(task)}
                            onDelete={onDeleteTask}
                            getTimeRemainingStr={getTimeRemainingStr}
                            getPriorityBadgeStyles={getPriorityBadgeStyles}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Completed Column */}
                  <div className="bg-[#0c1a16] border border-emerald-500/15 rounded-xl p-2.5 flex flex-col">
                    <div className="flex items-center justify-between border-b border-emerald-500/10 pb-1.5 mb-1.5">
                      <span className="font-display font-black text-[9px] text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                        <span>Completed ({kanbanCompleted.length})</span>
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-0.5 custom-scroll">
                      {kanbanCompleted.length === 0 ? (
                        <div className="py-4 text-center text-emerald-500/20 text-[9px] font-semibold uppercase tracking-wider">None yet</div>
                      ) : (
                        kanbanCompleted.map(task => (
                          <KanbanCard 
                            key={task.id}
                            task={task}
                            isSyncing={isSyncing === task.id}
                            onProgress={() => handleProgressStatus(task)}
                            onRegress={() => handleRegressStatus(task)}
                            onDelete={onDeleteTask}
                            getTimeRemainingStr={getTimeRemainingStr}
                            getPriorityBadgeStyles={getPriorityBadgeStyles}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* Matrix Quadrant Card Widget Component */
interface MatrixCardProps {
  task: Task;
  isSyncing: boolean;
  onProgress: () => void;
  onDelete: (id: string) => Promise<void>;
  getTimeRemainingStr: (due: string) => string;
  getPriorityBadgeStyles: (p: Task['priority']) => string;
}

const MatrixCard: React.FC<MatrixCardProps> = ({
  task,
  isSyncing,
  onProgress,
  onDelete,
  getTimeRemainingStr,
  getPriorityBadgeStyles
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const isOverdue = getTimeRemainingStr(task.due_date) === 'Overdue';

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.id) return;
    setIsDeleting(true);
    try {
      await onDelete(task.id);
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
    }
  };

  return (
    <motion.div 
      whileHover={{ y: -1.5, scale: 1.015, borderColor: 'rgba(139,92,246,0.45)', backgroundColor: '#120a35' }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`group relative bg-[#0d0725]/85 border border-[#251e4d]/50 rounded-xl p-3 flex items-center justify-between gap-3 transition-all duration-200 cursor-pointer ${
        isSyncing ? 'opacity-50 pointer-events-none' : ''
      }`}
      onClick={onProgress}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${getPriorityBadgeStyles(task.priority)}`}>
            {task.priority}
          </span>
          <span className={`text-[8px] px-1.5 py-0.5 rounded-full bg-violet-950/40 text-violet-300 font-mono flex items-center gap-1 border border-violet-800/10`}>
            <Clock className="w-2 h-2" />
            <span className={isOverdue ? 'text-rose-400 font-bold' : ''}>
              {getTimeRemainingStr(task.due_date)}
            </span>
          </span>
          {task.status === 'in-progress' && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-mono animate-pulse">
              active
            </span>
          )}
        </div>
        
        <h4 className="text-xs font-bold text-zinc-100 truncate group-hover:text-white transition-colors">
          {task.title}
        </h4>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-1 rounded-md hover:bg-rose-500/15 text-zinc-400 hover:text-rose-300 transition-colors cursor-pointer"
          title="Delete task"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onProgress();
          }}
          className={`p-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer ${
            task.status === 'in-progress'
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
              : 'bg-violet-600/20 text-violet-300 border-violet-500/30 hover:bg-violet-600/40'
          }`}
          title={task.status === 'in-progress' ? 'Mark Completed' : 'Start Task'}
        >
          {task.status === 'in-progress' ? <Check className="w-3.5 h-3.5" /> : <Play className="w-3 h-3 translate-x-[0.5px]" />}
        </button>
      </div>
    </motion.div>
  );
};

/* Kanban Card Component */
interface KanbanCardProps {
  task: Task;
  isSyncing: boolean;
  onProgress: () => void;
  onRegress?: () => void;
  onDelete: (id: string) => Promise<void>;
  getTimeRemainingStr: (due: string) => string;
  getPriorityBadgeStyles: (p: Task['priority']) => string;
}

const KanbanCard: React.FC<KanbanCardProps> = ({
  task,
  isSyncing,
  onProgress,
  onRegress,
  onDelete,
  getTimeRemainingStr,
  getPriorityBadgeStyles
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const isOverdue = getTimeRemainingStr(task.due_date) === 'Overdue';

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.id) return;
    setIsDeleting(true);
    try {
      await onDelete(task.id);
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
    }
  };

  return (
    <motion.div 
      whileHover={{ y: -1.5, scale: 1.015, borderColor: 'rgba(139,92,246,0.3)', backgroundColor: '#120a35' }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`group bg-[#0d0725]/60 border border-[#251e4d]/40 rounded-xl p-3 flex flex-col gap-2 transition-all duration-200 cursor-pointer ${
        isSyncing ? 'opacity-50 pointer-events-none' : ''
      }`}
      onClick={onProgress}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className={`text-xs font-bold text-zinc-100 group-hover:text-white transition-colors leading-tight ${task.status === 'completed' ? 'line-through text-zinc-500' : ''}`}>
          {task.title}
        </h4>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-500/15 text-zinc-500 hover:text-rose-300 transition-all cursor-pointer animate-fade-in"
          title="Delete task"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${getPriorityBadgeStyles(task.priority)}`}>
          {task.priority}
        </span>

        {task.status !== 'completed' && (
          <span className="text-[8px] font-mono text-zinc-400 flex items-center gap-1 bg-[#08051a] px-1.5 py-0.5 rounded border border-[#251e4d]/30">
            <Clock className="w-2.5 h-2.5" />
            <span className={isOverdue ? 'text-rose-400 font-bold animate-pulse' : ''}>
              {getTimeRemainingStr(task.due_date)}
            </span>
          </span>
        )}
      </div>

      <div className="flex justify-end items-center gap-1 border-t border-[#251e4d]/10 pt-2 mt-1">
        {onRegress && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRegress();
            }}
            className="text-[10px] px-2 py-1 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Re-open</span>
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onProgress();
          }}
          className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
            task.status === 'pending'
              ? 'bg-violet-600/15 text-violet-300 border border-violet-500/20 hover:bg-violet-600/35'
              : task.status === 'in-progress'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/35'
                : 'text-zinc-500 hover:text-zinc-400'
          }`}
        >
          {task.status === 'pending' ? (
            <>
              <span>Start</span>
              <Play className="w-2.5 h-2.5 fill-current" />
            </>
          ) : task.status === 'in-progress' ? (
            <>
              <span>Complete</span>
              <Check className="w-3 h-3" />
            </>
          ) : null}
        </button>
      </div>
    </motion.div>
  );
};
