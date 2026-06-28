import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  setDoc
} from 'firebase/firestore';
import { createServer as createViteServer } from 'vite';

dotenv.config();

// Read Firebase config from project root
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(firebaseConfigPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
} else {
  console.error('firebase-applet-config.json not found!');
}

// Initialize Firebase
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

// Initialize Gemini SDK with User-Agent telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const app = express();
const PORT = 3000;

app.use(express.json());

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// API: Get tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Missing x-user-id header' });
    }

    // Make sure demo tasks are seeded
    await ensureDemoTasksSeeded(userId);

    const tasksCol = collection(db, 'tasks');
    const q = query(
      tasksCol, 
      where('userId', '==', userId),
      orderBy('due_date', 'asc')
    );
    const snapshot = await getDocs(q);
    const tasks = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() as any }))
      .filter(t => t.id !== `seed_marker_${userId}` && !t.isSeedMarker);
    res.json(tasks);
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Create task
app.post('/api/tasks', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Missing x-user-id header' });
    }

    const { title, due_date, priority, category } = req.body;
    if (!title || !due_date) {
      return res.status(400).json({ error: 'title and due_date are required' });
    }

    const newTask = {
      title,
      due_date,
      priority: priority || 'medium',
      category: category || 'general',
      status: 'pending',
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'tasks'), newTask);
    res.status(201).json({ id: docRef.id, ...newTask });
  } catch (error: any) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Update task
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Missing x-user-id header' });
    }

    const { id } = req.params;
    const updates = req.body;
    updates.updatedAt = new Date().toISOString();

    const taskRef = doc(db, 'tasks', id);
    await updateDoc(taskRef, updates);
    res.json({ id, ...updates });
  } catch (error: any) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Missing x-user-id header' });
    }

    const { id } = req.params;
    const taskRef = doc(db, 'tasks', id);
    await deleteDoc(taskRef);
    res.json({ success: true, id });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: error.message });
  }
});

// TOOL IMPLEMENTATIONS FOR GEMINI
async function ensureDemoTasksSeeded(userId: string) {
  if (!userId || !userId.startsWith('demo_')) return;

  try {
    // Check if we have already seeded for this user in the tasks collection itself
    const seedMarkerRef = doc(db, 'tasks', `seed_marker_${userId}`);
    const seedMarkerSnap = await getDoc(seedMarkerRef);
    if (seedMarkerSnap.exists()) {
      return; // Already seeded once, do not re-seed!
    }

    const tasksCol = collection(db, 'tasks');
    const q = query(
      tasksCol,
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);

    // Only consider it empty if there are no non-seed-marker documents
    const nonMarkerTasks = snapshot.docs.filter(doc => doc.id !== `seed_marker_${userId}` && !(doc.data() as any).isSeedMarker);

    if (nonMarkerTasks.length === 0) {
      console.log(`[Demo Auto-Seed] Seeding tasks for demo user ${userId}...`);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(18, 0, 0, 0);

      const inTwoDays = new Date();
      inTwoDays.setDate(inTwoDays.getDate() + 2);
      inTwoDays.setHours(12, 0, 0, 0);

      const sampleTasks = [
        {
          title: 'Submit report',
          due_date: tomorrow.toISOString(),
          priority: 'high',
          category: 'assignment',
          status: 'pending',
          userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          title: 'Pay electricity bill',
          due_date: inTwoDays.toISOString(),
          priority: 'medium',
          category: 'bill',
          status: 'pending',
          userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      for (const t of sampleTasks) {
        await addDoc(tasksCol, t);
      }
    }

    // Always record that seeding occurred or was skipped because they already had tasks
    await setDoc(seedMarkerRef, { 
      isSeedMarker: true, 
      userId, 
      createdAt: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Error auto-seeding demo tasks:', error);
  }
}

// Helper to resolve relative date strings into standard dates
function resolveRelativeDate(dateStr: string): string {
  if (!dateStr) {
    return new Date().toISOString();
  }
  
  const now = new Date();
  const trimmed = dateStr.trim().toLowerCase();
  
  if (trimmed === 'today' || trimmed === 'tonight') {
    const today = new Date();
    today.setHours(18, 0, 0, 0);
    return today.toISOString();
  }
  
  if (trimmed === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    return tomorrow.toISOString();
  }
  
  if (trimmed === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(18, 0, 0, 0);
    return yesterday.toISOString();
  }

  // Handle "in X days"
  const inDaysMatch = trimmed.match(/in\s+(\d+)\s+days?/);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    const target = new Date();
    target.setDate(target.getDate() + days);
    target.setHours(18, 0, 0, 0);
    return target.toISOString();
  }

  // Handle "next monday", "next tuesday", etc.
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < weekdays.length; i++) {
    if (trimmed.includes(weekdays[i])) {
      const targetDay = i;
      const currentDay = now.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) {
        daysToAdd += 7; // Next week's weekday
      }
      const target = new Date();
      target.setDate(target.getDate() + daysToAdd);
      target.setHours(18, 0, 0, 0);
      return target.toISOString();
    }
  }

  // If it's already a valid date/time string, we can just try parsing or return it
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch (e) {}

  return dateStr;
}

async function addTaskInternal(userId: string, args: any) {
  console.log('[add_task tool] Called with args:', args);
  const { title, due_date, priority, category } = args;
  
  const resolvedDueDate = resolveRelativeDate(due_date);
  
  const newTask = {
    title,
    due_date: resolvedDueDate,
    priority: priority || 'medium',
    category: category || 'general',
    status: 'pending',
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const docRef = await addDoc(collection(db, 'tasks'), newTask);
  return {
    success: true,
    taskId: docRef.id,
    task: newTask,
    message: `Task "${title}" added successfully.`
  };
}

async function getPrioritiesInternal(userId: string, args: any) {
  console.log('[get_priorities tool] Called with args:', args);
  const limitCount = args.limit || 5;

  // Make sure demo tasks are seeded
  await ensureDemoTasksSeeded(userId);

  const tasksCol = collection(db, 'tasks');
  const q = query(
    tasksCol,
    where('userId', '==', userId),
    where('status', '!=', 'completed')
  );

  const snapshot = await getDocs(q);
  const tasks = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() as any }))
    .filter(t => t.id !== `seed_marker_${userId}` && !t.isSeedMarker);

  // Rank priority values
  const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };

  // Sort by urgency (due_date ascending) and priority weight descending
  const sortedTasks = tasks.sort((a, b) => {
    const timeA = new Date(a.due_date).getTime();
    const timeB = new Date(b.due_date).getTime();

    if (Math.abs(timeA - timeB) < 60 * 60 * 1000) {
      // If within 1 hour, sort by priority
      const pA = priorityWeight[a.priority as keyof typeof priorityWeight] || 0;
      const pB = priorityWeight[b.priority as keyof typeof priorityWeight] || 0;
      return pB - pA;
    }
    return timeA - timeB;
  });

  return {
    tasks: sortedTasks.slice(0, limitCount)
  };
}

async function suggestScheduleInternal(userId: string, accessToken: string | undefined, args: any) {
  console.log('[suggest_schedule tool] Called with args:', args);
  const { date: rawDate, available_hours } = args;
  const date = resolveRelativeDate(rawDate).split('T')[0];

  // 1. Get pending tasks
  const { tasks } = await getPrioritiesInternal(userId, { limit: 10 });

  // 2. Query Google Calendar if accessToken is present
  let calendarEvents: any[] = [];
  if (userId && userId.startsWith('demo_')) {
    calendarEvents = [
      {
        id: 'demo-evt-1',
        summary: 'Team standup',
        start: `${date}T10:00:00`,
        end: `${date}T10:30:00`
      },
      {
        id: 'demo-evt-2',
        summary: 'Dentist appointment',
        start: `${date}T15:00:00`,
        end: `${date}T16:00:00`
      },
      {
        id: 'demo-evt-3',
        summary: 'Lunch with team',
        start: `${date}T12:00:00`,
        end: `${date}T13:00:00`
      }
    ];
  } else if (accessToken) {
    try {
      const startOfDay = `${date}T00:00:00Z`;
      const endOfDay = `${date}T23:59:59Z`;
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(startOfDay)}&timeMax=${encodeURIComponent(endOfDay)}&singleEvents=true&orderBy=startTime`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.items) {
          calendarEvents = data.items.map((item: any) => ({
            id: item.id,
            summary: item.summary || 'Busy',
            start: item.start?.dateTime || item.start?.date,
            end: item.end?.dateTime || item.end?.date,
          }));
        }
      } else {
        console.warn('Google Calendar API returned status:', response.status);
      }
    } catch (err) {
      console.error('Error fetching from Google Calendar:', err);
    }
  }

  // 3. Simple scheduler logic
  // Parse work hours (default 9 AM to 6 PM)
  let startHour = 9;
  let endHour = 18;
  if (available_hours) {
    // Basic heuristics to parse hours (e.g. "9am-5pm" or "10-18")
    const match = available_hours.toLowerCase().match(/(\d+)\s*(am|pm)?\s*-\s*(\d+)\s*(am|pm)?/);
    if (match) {
      let h1 = parseInt(match[1]);
      const ampm1 = match[2];
      let h2 = parseInt(match[3]);
      const ampm2 = match[4];

      if (ampm1 === 'pm' && h1 < 12) h1 += 12;
      if (ampm1 === 'am' && h1 === 12) h1 = 0;
      if (ampm2 === 'pm' && h2 < 12) h2 += 12;
      if (ampm2 === 'am' && h2 === 12) h2 = 0;

      startHour = h1;
      endHour = h2;
    }
  }

  // Create hourly slots
  const slots: any[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    const slotStartStr = `${hour.toString().padStart(2, '0')}:00`;
    const slotEndStr = `${(hour + 1).toString().padStart(2, '0')}:00`;
    const slotTimeLabel = `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;

    // Check calendar overlaps
    const slotStartTime = new Date(`${date}T${slotStartStr}:00`).getTime();
    const slotEndTime = new Date(`${date}T${slotEndStr}:00`).getTime();

    const overlappingEvent = calendarEvents.find(evt => {
      const evtStart = new Date(evt.start).getTime();
      const evtEnd = new Date(evt.end).getTime();
      return (evtStart < slotEndTime && evtEnd > slotStartTime);
    });

    if (overlappingEvent) {
      slots.push({
        time: `${slotTimeLabel} - ${(hour + 1) > 12 ? (hour + 1) - 12 : (hour + 1)}:00 ${(hour + 1) >= 12 ? 'PM' : 'AM'}`,
        activity: `Busy: ${overlappingEvent.summary}`,
        type: 'calendar_event'
      });
    } else {
      slots.push({
        time: `${slotTimeLabel} - ${(hour + 1) > 12 ? (hour + 1) - 12 : (hour + 1)}:00 ${(hour + 1) >= 12 ? 'PM' : 'AM'}`,
        activity: 'Open',
        type: 'free'
      });
    }
  }

  // Distribute tasks to free slots
  let taskIndex = 0;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].type === 'free' && taskIndex < tasks.length) {
      slots[i].activity = `Focus: ${tasks[taskIndex].title} (${tasks[taskIndex].priority} priority)`;
      slots[i].type = 'task';
      taskIndex++;
    } else if (slots[i].type === 'free') {
      slots[i].activity = 'Buffer / Task catch-up';
    }
  }

  return {
    date,
    calendarEventsCount: calendarEvents.length,
    calendarEvents,
    suggested_slots: slots,
    message: `Generated schedule for ${date} with ${calendarEvents.length} calendar events and ${Math.min(taskIndex, tasks.length)} focus blocks.`
  };
}

// AI Companion: Nudge Exact Prompt and Function declarations
const Nudge_systemInstruction = `You are Nudge, an assertive, hyper-focused AI Productivity Guardian. Your job is to rescue users from procrastination and missed deadlines.

CRITICAL BEHAVIORS:
1. NEVER just say "Here is a reminder." Instead, break tasks down into micro-steps or write drafts for them immediately.
2. If the user clicks "Time-Block My Day" or requests schedule suggestions, call 'suggest_schedule' to get active tasks and calendar events. Then, look closely at their active tasks and output a strict, hyper-realistic hourly calendar block schedule.
3. Identify friction: If a task requires an action (like paying a bill, emailing someone, or writing a report), provide the exact action steps, links (if applicable), or text templates they need so they can execute it in 1 click.
4. When the user mentions any task, deadline, assignment, bill, interview, or commitment, capture it immediately by calling 'add_task'. Don't ask permission first — capture it, then confirm in one brief, action-oriented sentence.
5. When the user opens a session or asks what to focus on, call 'get_priorities' to see their current task list ranked by urgency before responding.

RESPONSE FORMAT:
Always return clean markdown with bold callouts, clear actionable check-lists, and time metrics. Keep your tone encouraging but urgent.`;

const toolsList = [
  {
    name: 'add_task',
    description: 'Add a new task or deadline the user mentioned to their task list.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short description of the task'
        },
        due_date: {
          type: 'string',
          description: 'ISO 8601 date or datetime the task is due, e.g. 2026-06-27T18:00:00'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Initial priority level'
        },
        category: {
          type: 'string',
          description: 'e.g. assignment, bill, meeting, interview'
        }
      },
      required: ['title', 'due_date']
    }
  },
  {
    name: 'get_priorities',
    description: "Retrieve the user's current tasks ranked by urgency and importance, to decide what they should focus on next.",
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Max number of tasks to return, defaults to 5'
        }
      }
    }
  },
  {
    name: 'suggest_schedule',
    description: "Generate a concrete time-blocked schedule for the user's pending tasks for a given day, factoring in their existing calendar events.",
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'ISO 8601 date to schedule for, e.g. 2026-06-25'
        },
        available_hours: {
          type: 'string',
          description: "Optional free-text on the user's available hours, e.g. '9am-9pm except 1-2pm'"
        }
      },
      required: ['date']
    }
  }
];

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const authHeader = req.headers['authorization'] as string;
    const accessToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    if (!userId) {
      return res.status(401).json({ error: 'Missing x-user-id header' });
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Format messages for @google/genai SDK
    // The chat history format: Array of { role: 'user'|'model', parts: [{ text: '...' } | { functionCall: ... } | { functionResponse: ... }] }
    const contents: any[] = [];
    
    for (const msg of messages) {
      contents.push({
        role: msg.role,
        parts: msg.parts.map((p: any) => {
          if (p.text) return { text: p.text };
          if (p.functionCall) return { functionCall: p.functionCall };
          if (p.functionResponse) return { functionResponse: p.functionResponse };
          return p;
        })
      });
    }

    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = days[today.getDay()];
    
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const formattedTomorrow = tomorrow.toISOString().split('T')[0];
    
    const dynamicSystemInstruction = `${Nudge_systemInstruction}

CRITICAL TIME & DATE CONTEXT:
- Today's date is ${formattedDate} (current day of the week is ${currentDayName}). The exact current ISO date time is ${today.toISOString()}.
- Tomorrow's date is ${formattedTomorrow}.
- You MUST automatically resolve all relative date/time expressions mentioned by the user (e.g. "today", "tomorrow", "tonight", "yesterday", "next Monday", "this Friday", "in 2 days", "next week", "at 6pm") relative to today's date (${formattedDate}, ${currentDayName}) when executing function calls like 'add_task' or 'suggest_schedule'.
- NEVER ask the user to clarify or manually provide an exact YYYY-MM-DD date. You have all information needed to calculate it.
- Examples of date calculation:
  * If the user says "tomorrow" and today's date is ${formattedDate}, the calculated due_date for 'add_task' or 'suggest_schedule' is exactly tomorrow's calculated date: ${formattedTomorrow}.
  * If the user says "today" or "tonight", the calculated date is ${formattedDate}.
- Always use the calculated exact date in ISO 8601 format when invoking 'add_task' (e.g. "YYYY-MM-DDT18:00:00" or "YYYY-MM-DD") and 'suggest_schedule' (e.g. "YYYY-MM-DD").`;

    console.log('[API Chat] Sending contents to Gemini...');

    // Function Execution Loop
    let actionsTaken: any[] = [];
    let loopCount = 0;
    const maxLoops = 5;
    let finalResponseText = '';

    while (loopCount < maxLoops) {
      let response: any = null;
      let attempt = 0;
      const maxAttempts = 3; // 1 initial + 2 retries
      const delays = [1500, 3000];

      while (attempt < maxAttempts) {
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: contents,
            config: {
              systemInstruction: dynamicSystemInstruction,
              tools: [{ functionDeclarations: toolsList as any }]
            }
          });
          break; // Success! Break out of the retry loop.
        } catch (error: any) {
          const errStr = (error?.message || '').toUpperCase();
          const isUnavailable = error?.status === 503 || error?.status === 'UNAVAILABLE' || errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('OVERLOADED');
          const isRateLimit = error?.status === 429 || error?.status === 'RESOURCE_EXHAUSTED' || errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('QUOTA') || errStr.includes('LIMIT');
          
          if ((isUnavailable || isRateLimit) && attempt < maxAttempts - 1) {
            const delay = isRateLimit ? 2500 : delays[attempt];
            console.log(`Demo sync retry ${attempt + 1} initiated...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
          } else {
            if (isRateLimit || isUnavailable) {
              console.log(`Demo mode: fallback activation checkpoint reached`);
            } else {
              console.log(`System operation notice: offline state`);
            }
            throw error; // Re-throw if we have exhausted all retries
          }
        }
      }

      const candidate = response.candidates?.[0];
      const modelContent = candidate?.content;
      const parts = modelContent?.parts || [];

      // Append what the model returned to our history
      if (modelContent) {
        contents.push(modelContent);
      }

      // Check for function calls
      const functionCalls = parts.filter((p: any) => p.functionCall);

      if (functionCalls.length > 0) {
        console.log(`[API Chat] Model requested ${functionCalls.length} function call(s)`);
        const responseParts: any[] = [];

        for (const part of functionCalls) {
          const call = part.functionCall;
          let result: any = null;

          try {
            if (call.name === 'add_task') {
              result = await addTaskInternal(userId, call.args);
              actionsTaken.push({ action: 'add_task', args: call.args, result });
            } else if (call.name === 'get_priorities') {
              result = await getPrioritiesInternal(userId, call.args);
              actionsTaken.push({ action: 'get_priorities', args: call.args, result });
            } else if (call.name === 'suggest_schedule') {
              result = await suggestScheduleInternal(userId, accessToken, call.args);
              actionsTaken.push({ action: 'suggest_schedule', args: call.args, result });
            } else {
              result = { error: `Function ${call.name} is not supported` };
            }
          } catch (err: any) {
            console.error(`Error executing tool ${call.name}:`, err);
            result = { error: err.message };
          }

          responseParts.push({
            functionResponse: {
              name: call.name,
              response: result
            }
          });
        }

        // Append tool responses to the model's query
        contents.push({
          role: 'user', // In @google/genai tool/user role contains functionResponse parts
          parts: responseParts
        });

        loopCount++;
      } else {
        // No function calls, this is the final text answer!
        finalResponseText = parts.find((p: any) => p.text)?.text || '';
        break;
      }
    }

    // Server-side robust verification & safety fallbacks
    const failedAction = actionsTaken.find(a => a.result?.error);
    if (failedAction) {
      console.warn('[API Chat] Function call returned an error:', failedAction);
      finalResponseText = `I couldn't fetch that right now - can you try rephrasing or asking again? (Error: ${failedAction.result?.error || 'Unknown query error'})`;
    }

    if (!finalResponseText || finalResponseText.trim() === '') {
      console.warn('[API Chat] finalResponseText was empty. Applying safety fallback.');
      
      const lastAction = actionsTaken[actionsTaken.length - 1];
      if (lastAction) {
        if (lastAction.action === 'add_task') {
          finalResponseText = `I've successfully captured and logged that deadline for you: **${lastAction.args?.title || 'New Task'}**! Let's stay laser-focused. Is there anything else you'd like to plan?`;
        } else if (lastAction.action === 'suggest_schedule') {
          const slots = lastAction.result?.suggested_slots || [];
          if (slots.length > 0) {
            let slotListText = slots.map((s: any) => `- **${s.time}**: ${s.activity}`).join('\n');
            finalResponseText = `I have synced your calendar events and mapped out a strict, hyper-realistic hourly calendar block schedule for tomorrow:\n\n${slotListText}\n\nLet's tackle this step-by-step with zero delay!`;
          } else {
            finalResponseText = `I merged your calendar and tasks, but could not locate active slots or events. Let's start fresh and log some priorities!`;
          }
        } else {
          finalResponseText = "I executed the request behind the scenes, but didn't generate a text response. Please let me know how you'd like to proceed!";
        }
      } else {
        finalResponseText = "I'm here to nudge you to action, but I didn't generate a proper response. Can you try rephrasing or asking again?";
      }
    }

    // Sync back to the chat history array so the frontend displays the fallback properly
    let lastModelMsgIndex = -1;
    for (let i = contents.length - 1; i >= 0; i--) {
      if (contents[i].role === 'model') {
        lastModelMsgIndex = i;
        break;
      }
    }

    if (lastModelMsgIndex !== -1) {
      const partsList = contents[lastModelMsgIndex].parts || [];
      const textPartIndex = partsList.findIndex((p: any) => p.text !== undefined && p.text !== null);
      if (textPartIndex !== -1) {
        partsList[textPartIndex].text = finalResponseText;
      } else {
        partsList.push({ text: finalResponseText });
      }
      contents[lastModelMsgIndex].parts = partsList;
    } else {
      contents.push({
        role: 'model',
        parts: [{ text: finalResponseText }]
      });
    }

    res.json({
      text: finalResponseText,
      actionsTaken,
      updatedHistory: contents
    });
  } catch (error: any) {
    const errStr = (error?.message || '').toUpperCase();
    const isUnavailable = error?.status === 503 || error?.status === 'UNAVAILABLE' || errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('OVERLOADED');
    const isQuotaExceeded = error?.status === 429 || error?.status === 'RESOURCE_EXHAUSTED' || errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('QUOTA') || errStr.includes('LIMIT');
    
    if (isQuotaExceeded) {
      console.warn('[API Chat] Quota or rate limit exceeded on backend.');
      res.status(429).json({ error: 'Nudge has hit its API rate limit for the moment - please wait about a minute and try again.' });
    } else if (isUnavailable) {
      res.status(503).json({ error: 'UNAVAILABLE: Gemini is currently overloaded or temporarily unavailable. Please try again.' });
    } else {
      res.status(500).json({ error: error?.message || 'Internal server error occurred' });
    }
  }
});

// Serve UI / Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Last-Minute Life Saver] Server listening on http://localhost:${PORT}`);
  });
}

startServer();
