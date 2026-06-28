import React, { useState } from 'react';
import { Task } from '../types';
import { 
  Plus, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  Circle, 
  AlertTriangle, 
  Calendar,
  Layers,
  ChevronDown,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TaskSidebarProps {
  tasks: Task[];
  onAddTask: (title: string, dueDate: string, priority: Task['priority'], category: string) => Promise<void>;
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
}

export const TaskSidebar: React.FC<TaskSidebarProps> = ({
  tasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDatePart, setNewDatePart] = useState('');
  const [newTimePart, setNewTimePart] = useState('');
  const [newPriority, setNewPriority] = useState<Task['priority']>('medium');
  const [newCategory, setNewCategory] = useState('assignment');
  const [filter, setFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed'>('all');
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDatePart || !newTimePart) return;
    try {
      const combinedDueDate = `${newDatePart}T${newTimePart}`;
      await onAddTask(newTitle, combinedDueDate, newPriority, newCategory);
      setNewTitle('');
      setNewDatePart('');
      setNewTimePart('');
      setNewPriority('medium');
      setNewCategory('assignment');
      setIsAdding(false);
    } catch (err) {
      console.error(err);
    }
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'text-violet-300 bg-violet-950/40 border-violet-800/50';
      case 'high':
        return 'text-indigo-300 bg-indigo-950/40 border-indigo-800/50';
      case 'medium':
        return 'text-sky-300 bg-sky-950/40 border-sky-800/50';
      case 'low':
        return 'text-zinc-400 bg-zinc-800/30 border-zinc-750/50';
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  if (filter === 'all') {
    filteredTasks.sort((a, b) => {
      const isAComplete = a.status === 'completed';
      const isBComplete = b.status === 'completed';

      // 1. Incomplete tasks (Pending, In-Progress) should always appear above completed tasks
      if (!isAComplete && isBComplete) return -1;
      if (isAComplete && !isBComplete) return 1;

      // Both are in the same completeness group
      if (!isAComplete) {
        // 2. Within the incomplete group, sort by urgency level first (Urgent > High > Medium > Low)
        const priorityWeight: Record<Task['priority'], number> = {
          urgent: 4,
          high: 3,
          medium: 2,
          low: 1
        };
        const weightA = priorityWeight[a.priority] || 2;
        const weightB = priorityWeight[b.priority] || 2;

        if (weightA !== weightB) {
          return weightB - weightA; // Higher weight (urgency) first
        }

        // Tiebreaker: sort by due date/time (soonest first)
        const timeA = new Date(a.due_date).getTime() || 0;
        const timeB = new Date(b.due_date).getTime() || 0;
        return timeA - timeB;
      } else {
        // 3. Completed tasks should be sorted by most recently completed (updatedAt) first
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA; // Descending order (most recent first)
      }
    });
  }

  // Calculate stats
  const pendingCount = tasks.filter(t => t.status !== 'completed').length;
  const urgentCount = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length;

  return (
    <div id="task-sidebar" className="flex flex-col h-full bg-[#08051a]/60 border-r border-[#251e4d]/30 backdrop-blur-md text-zinc-100 font-sans">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-[#251e4d]/30 flex flex-col gap-2">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-violet-400" />
            <h2 className="font-display font-semibold text-lg tracking-wide">Task Command</h2>
          </div>
          {/* Consistent Pill style Add Task button */}
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="btn-pill-lavender text-xs text-white font-medium px-4 py-1.5 transition-all shadow-[0_0_15px_rgba(167,139,250,0.35)] cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Task
          </button>
        </div>

        {/* Section Divider - Bold rounded header with glowing underline accent */}
        <div className="glowing-divider w-full my-1"></div>

        {/* Small stats banner */}
        <div className="flex gap-2 mt-2">
          <div className="flex-1 glass-card-lavender rounded-2xl p-2 text-center">
            <div className="text-[10px] text-indigo-300/60 font-medium uppercase tracking-wider">Active Tasks</div>
            <div className="text-lg font-display font-semibold text-violet-300">{pendingCount}</div>
          </div>
          {urgentCount > 0 && (
            <div className="flex-1 bg-violet-950/25 border border-violet-900/30 rounded-2xl p-2 text-center animate-pulse">
              <div className="text-[10px] text-violet-300 flex items-center justify-center gap-1 uppercase tracking-wider font-semibold">
                <AlertTriangle className="w-3 h-3 text-violet-400" /> Urgent
              </div>
              <div className="text-lg font-display font-semibold text-violet-400">{urgentCount}</div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Task Creator Dialog */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-[#110e30]/85 border-b border-[#251e4d]/40 p-4"
          >
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-violet-400 tracking-wider uppercase">New Deadline</span>
                <button type="button" onClick={() => setIsAdding(false)} className="text-indigo-300 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-indigo-300/50 mb-1 font-medium">Task / Goal Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Finish chemistry lab report"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full bg-[#0c0926] border border-[#251e4d]/60 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder:text-indigo-300/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-indigo-300/50 mb-1 font-medium">Due Date</label>
                  <input
                    type="date"
                    required
                    value={newDatePart}
                    onChange={e => setNewDatePart(e.target.value)}
                    className="w-full bg-[#0c0926] border border-[#251e4d]/60 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-indigo-300/50 mb-1 font-medium">Due Time</label>
                  <input
                    type="time"
                    required
                    value={newTimePart}
                    onChange={e => setNewTimePart(e.target.value)}
                    className="w-full bg-[#0c0926] border border-[#251e4d]/60 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500 animate-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-indigo-300/50 mb-1 font-medium">Category</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full bg-[#0c0926] border border-[#251e4d]/60 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="assignment">Assignment</option>
                  <option value="exam">Exam</option>
                  <option value="bill">Bill/Payment</option>
                  <option value="meeting">Meeting</option>
                  <option value="interview">Interview</option>
                  <option value="commitment">Commitment</option>
                  <option value="general">General</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-indigo-300/50 mb-1 font-medium">Urgency Level</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['low', 'medium', 'high', 'urgent'] as Task['priority'][]).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPriority(p)}
                      className={`py-1 rounded-md text-[10px] font-semibold border uppercase tracking-wider transition-all ${
                        newPriority === p
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 border-violet-400 text-white shadow-[0_0_8px_rgba(167,139,250,0.35)]'
                          : 'bg-[#0c0926] border-[#251e4d]/60 text-indigo-300/50 hover:border-violet-900/40'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Consistent Pill style submit button */}
              <button
                type="submit"
                className="w-full btn-pill-lavender text-xs text-white font-bold py-2.5 rounded-lg transition-all cursor-pointer shadow-[0_0_15px_rgba(167,139,250,0.3)]"
              >
                Log Target
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Tabs */}
      <div className="flex border-b border-[#251e4d]/30 text-xs px-2 py-1.5 bg-[#0e0a2d]/30">
        {(['all', 'pending', 'in-progress', 'completed'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 py-1 rounded-md font-medium capitalize transition-all cursor-pointer ${
              filter === tab
                ? 'bg-[#181242] text-zinc-200'
                : 'text-indigo-300/50 hover:text-indigo-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Task List container */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-[400px] md:min-h-0 [-webkit-overflow-scrolling:touch]">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-10 px-4 flex flex-col items-center justify-center">
            <span className="text-zinc-200 font-bold text-xs md:text-sm block mb-1">
              No deadlines in this view.
            </span>
            <p className="text-indigo-200/50 text-[11px] font-normal leading-relaxed max-w-[240px]">
              All clear! Ask Nudge to automatically sync your upcoming schedule or click '+ Add Task' to begin guarding your time.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredTasks.map(task => {
              const isOverdue = new Date(task.due_date).getTime() < Date.now() && task.status !== 'completed';
              const isUrgentLimit = (new Date(task.due_date).getTime() - Date.now()) < 24 * 60 * 60 * 1000 && task.status !== 'completed';

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-3 rounded-2xl border transition-all glass-card-lavender ${
                    task.status === 'completed'
                      ? 'opacity-40 border-[#251e4d]/20'
                      : isOverdue
                      ? 'border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.12)]'
                      : isUrgentLimit
                      ? 'border-violet-400/40 shadow-[0_0_15px_rgba(167,139,250,0.18)]'
                      : 'border-[#251e4d]/40'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Status Checkbox */}
                    <button
                      onClick={() => {
                        const nextStatusMap = { pending: 'in-progress', 'in-progress': 'completed', completed: 'pending' } as const;
                        onUpdateTask(task.id!, { status: nextStatusMap[task.status] });
                      }}
                      className="mt-0.5 text-indigo-300/40 hover:text-violet-400 transition-colors shrink-0 cursor-pointer"
                    >
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-4.5 h-4.5 text-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]" />
                      ) : task.status === 'in-progress' ? (
                        <Clock className="w-4.5 h-4.5 text-violet-400 animate-spin" />
                      ) : (
                        <Circle className="w-4.5 h-4.5 text-indigo-300/30" />
                      )}
                    </button>

                    {/* Task details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Priority Badge */}
                        <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>

                        {/* Category Badge */}
                        {task.category && (
                          <span className="text-[9px] text-indigo-300/60 bg-[#16113b]/50 border border-[#251e4d]/30 px-1.5 py-0.5 rounded uppercase font-medium">
                            {task.category}
                          </span>
                        )}

                        {/* Proactive flags */}
                        {isOverdue && (
                          <span className="text-[9px] font-bold text-red-400 animate-pulse uppercase">
                            OVERDUE
                          </span>
                        )}
                        {!isOverdue && isUrgentLimit && (
                          <span className="text-[9px] font-bold text-violet-400 animate-pulse uppercase">
                            &lt; 24H LEFT
                          </span>
                        )}
                      </div>

                      <h3 className={`text-xs font-semibold mt-1.5 break-words ${task.status === 'completed' ? 'line-through text-indigo-300/30 font-medium' : 'text-zinc-200'}`}>
                        {task.title}
                      </h3>

                      {/* Time indicators */}
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-indigo-300/50 font-mono">
                        <Calendar className="w-3 h-3 text-violet-400" />
                        <span>
                          {new Date(task.due_date).toLocaleDateString(undefined, { 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Delete action */}
                    {deletingTaskId === task.id ? (
                      <div className="flex flex-col sm:flex-row items-center gap-1 shrink-0 self-start mt-0.5">
                        <button
                          onClick={() => {
                            onDeleteTask(task.id!);
                            setDeletingTaskId(null);
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-[9px] px-2 py-1 rounded transition-all cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeletingTaskId(null)}
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[9px] px-2 py-1 rounded transition-all cursor-pointer border border-[#251e4d]/40"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingTaskId(task.id!)}
                        className="text-indigo-300/40 hover:text-red-400 p-1 rounded-md hover:bg-red-950/15 transition-all self-start shrink-0 cursor-pointer"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
