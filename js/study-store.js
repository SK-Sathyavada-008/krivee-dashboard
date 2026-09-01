/**
 * KriVee Study Planner - Centralized Store & Business Logic
 * Real-time Firestore sync with offline localStorage fallback
 * Clean live state - no dump/mock data
 */

import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAUe0lWYTlidPDLCtW2zjWYMikAexcDhW0",
  authDomain: "krivee-dashboard.firebaseapp.com",
  projectId: "krivee-dashboard",
  storageBucket: "krivee-dashboard.firebasestorage.app",
  messagingSenderId: "452749524448",
  appId: "1:452749524448:web:82c4505c5012a6a310bf85"
};

let db = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firestore not available in this environment. Falling back to local storage.", e);
}

class StudyStore {
  constructor() {
    this.currentUser = 'veer'; // 'veer' or 'sk'
    this.subscribers = new Set();
    
    // Clean initial state (0 streaks, 0 XP, empty subjects/tasks)
    this.state = this.getEmptyState();

    this.unsubscribers = [];
    this.loadFromLocalStorage();
  }

  getEmptyState() {
    return {
      subjects: [],
      topics: [],
      dailyTasks: [],
      focusCommitments: {}, // userId -> { subjectId, startDate, endDate, history: [] }
      userStats: {
        veer: { xp: 0, streak: 0, longestStreak: 0, dailyGoalHours: 3, badges: [] },
        sk: { xp: 0, streak: 0, longestStreak: 0, dailyGoalHours: 3, badges: [] }
      },
      xpLedger: [],
      reviews: [],
      focusHistory: []
    };
  }

  setCurrentUser(user) {
    this.currentUser = (user || 'veer').toLowerCase();
    this.saveToLocalStorage();
    this.initRealtimeListeners();
    this.notify();
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getCurrentUserName() {
    return this.currentUser === 'sk' ? 'SK' : 'Veer';
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  notify() {
    this.subscribers.forEach(cb => cb(this.state));
  }

  // Local storage persistence
  saveToLocalStorage() {
    try {
      localStorage.setItem('krivee_study_state', JSON.stringify(this.state));
    } catch (e) {
      console.warn("Failed saving state to localStorage", e);
    }
  }

  loadFromLocalStorage() {
    try {
      const data = localStorage.getItem('krivee_study_state');
      if (data) {
        const parsed = JSON.parse(data);
        this.state = { ...this.getEmptyState(), ...parsed };
      } else {
        this.state = this.getEmptyState();
        this.saveToLocalStorage();
      }
    } catch (e) {
      this.state = this.getEmptyState();
      this.saveToLocalStorage();
    }
  }

  // Reset all data & streaks
  async resetAllData() {
    this.state = this.getEmptyState();
    this.saveToLocalStorage();
    this.notify();

    if (db) {
      try {
        await setDoc(doc(db, "study_user_stats", "veer"), this.state.userStats.veer);
        await setDoc(doc(db, "study_user_stats", "sk"), this.state.userStats.sk);
      } catch (e) {
        console.warn("Firestore reset error:", e);
      }
    }
  }

  // Real-time Firestore sync
  initRealtimeListeners() {
    if (!db) return;
    
    // Clear old listeners
    this.unsubscribers.forEach(u => typeof u === 'function' && u());
    this.unsubscribers = [];

    try {
      // 1. Subjects
      const subjectsCol = collection(db, "study_subjects");
      const unsub1 = onSnapshot(subjectsCol, (snapshot) => {
        if (!snapshot.empty) {
          const subjects = [];
          snapshot.forEach(doc => subjects.push({ id: doc.id, ...doc.data() }));
          this.state.subjects = subjects;
          this.saveToLocalStorage();
          this.notify();
        }
      }, err => console.warn("Firestore subjects err:", err));
      this.unsubscribers.push(unsub1);

      // 2. Topics
      const topicsCol = collection(db, "study_topics");
      const unsub2 = onSnapshot(topicsCol, (snapshot) => {
        if (!snapshot.empty) {
          const topics = [];
          snapshot.forEach(doc => topics.push({ id: doc.id, ...doc.data() }));
          this.state.topics = topics;
          this.saveToLocalStorage();
          this.notify();
        }
      }, err => console.warn("Firestore topics err:", err));
      this.unsubscribers.push(unsub2);

      // 3. Tasks
      const tasksCol = collection(db, "study_tasks");
      const unsub3 = onSnapshot(tasksCol, (snapshot) => {
        if (!snapshot.empty) {
          const tasks = [];
          snapshot.forEach(doc => tasks.push({ id: doc.id, ...doc.data() }));
          this.state.dailyTasks = tasks;
          this.saveToLocalStorage();
          this.notify();
        }
      }, err => console.warn("Firestore tasks err:", err));
      this.unsubscribers.push(unsub3);

      // 4. Focus
      const focusCol = collection(db, "study_focus");
      const unsub4 = onSnapshot(focusCol, (snapshot) => {
        if (!snapshot.empty) {
          snapshot.forEach(doc => {
            this.state.focusCommitments[doc.id] = doc.data();
          });
          this.saveToLocalStorage();
          this.notify();
        }
      }, err => console.warn("Firestore focus err:", err));
      this.unsubscribers.push(unsub4);

      // 5. User Stats
      const statsCol = collection(db, "study_user_stats");
      const unsub5 = onSnapshot(statsCol, (snapshot) => {
        if (!snapshot.empty) {
          snapshot.forEach(doc => {
            this.state.userStats[doc.id] = { ...this.state.userStats[doc.id], ...doc.data() };
          });
          this.saveToLocalStorage();
          this.notify();
        }
      }, err => console.warn("Firestore stats err:", err));
      this.unsubscribers.push(unsub5);

    } catch (e) {
      console.warn("Could not attach firestore snapshot listeners:", e);
    }
  }

  // --- SUBJECTS API ---
  async createSubject(subjectData) {
    const id = 'subj_' + Date.now();
    const newSubject = {
      id,
      userId: this.currentUser,
      name: subjectData.name.trim(),
      description: subjectData.description || '',
      priority: subjectData.priority || 'medium',
      startDate: subjectData.startDate || new Date().toISOString().split('T')[0],
      targetDate: subjectData.targetDate || '',
      status: 'not_started',
      estimatedHours: parseFloat(subjectData.estimatedHours) || 10,
      actualHours: 0,
      createdAt: new Date().toISOString()
    };

    this.state.subjects.push(newSubject);
    this.saveToLocalStorage();
    this.notify();

    if (db) {
      try {
        await setDoc(doc(db, "study_subjects", id), newSubject);
      } catch (e) { console.error("Firestore subject create error:", e); }
    }
    return newSubject;
  }

  async updateSubject(id, updates) {
    const idx = this.state.subjects.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.state.subjects[idx] = { ...this.state.subjects[idx], ...updates };
      this.saveToLocalStorage();
      this.notify();

      if (db) {
        try {
          await updateDoc(doc(db, "study_subjects", id), updates);
        } catch (e) { console.error("Firestore subject update error:", e); }
      }
    }
  }

  async deleteSubject(id) {
    this.state.subjects = this.state.subjects.filter(s => s.id !== id);
    this.state.topics = this.state.topics.filter(t => t.subjectId !== id);
    this.saveToLocalStorage();
    this.notify();

    if (db) {
      try {
        await deleteDoc(doc(db, "study_subjects", id));
      } catch (e) { console.error("Firestore subject delete error:", e); }
    }
  }

  // --- TOPICS API ---
  async createTopic(topicData) {
    const id = 'top_' + Date.now();
    const newTopic = {
      id,
      subjectId: topicData.subjectId,
      userId: this.currentUser,
      name: topicData.name.trim(),
      description: topicData.description || '',
      startDate: topicData.startDate || new Date().toISOString().split('T')[0],
      targetDate: topicData.targetDate || '',
      estimatedHours: parseFloat(topicData.estimatedHours) || 2,
      actualHours: 0,
      priority: topicData.priority || 'medium',
      status: 'not_started',
      subtasks: topicData.subtasks || [],
      notes: topicData.notes || '',
      postponeCount: 0,
      createdAt: new Date().toISOString()
    };

    this.state.topics.push(newTopic);
    this.recalculateSubjectProgress(topicData.subjectId);
    this.saveToLocalStorage();
    this.notify();

    if (db) {
      try {
        await setDoc(doc(db, "study_topics", id), newTopic);
      } catch (e) { console.error("Firestore topic create error:", e); }
    }
    return newTopic;
  }

  async updateTopic(id, updates) {
    const idx = this.state.topics.findIndex(t => t.id === id);
    if (idx !== -1) {
      const prevTopic = this.state.topics[idx];
      const updatedTopic = { ...prevTopic, ...updates };
      this.state.topics[idx] = updatedTopic;

      // Gamification award on topic completion
      if (updates.status === 'completed' && prevTopic.status !== 'completed') {
        this.awardXP('TOPIC_COMPLETED', 50, id, 'Completed topic: ' + updatedTopic.name);
        this.checkAchievements();
      }

      this.recalculateSubjectProgress(updatedTopic.subjectId);
      this.saveToLocalStorage();
      this.notify();

      if (db) {
        try {
          await updateDoc(doc(db, "study_topics", id), updates);
        } catch (e) { console.error("Firestore topic update error:", e); }
      }
    }
  }

  async deleteTopic(id) {
    const t = this.state.topics.find(t => t.id === id);
    const subjectId = t ? t.subjectId : null;
    this.state.topics = this.state.topics.filter(t => t.id !== id);
    if (subjectId) this.recalculateSubjectProgress(subjectId);
    this.saveToLocalStorage();
    this.notify();

    if (db) {
      try {
        await deleteDoc(doc(db, "study_topics", id));
      } catch (e) { console.error("Firestore topic delete error:", e); }
    }
  }

  recalculateSubjectProgress(subjectId) {
    const s = this.state.subjects.find(sub => sub.id === subjectId);
    if (!s) return;
    const subjectTopics = this.state.topics.filter(t => t.subjectId === subjectId);
    if (subjectTopics.length === 0) {
      s.actualHours = 0;
      return;
    }

    const completed = subjectTopics.filter(t => t.status === 'completed').length;
    const totalActual = subjectTopics.reduce((acc, t) => acc + (t.actualHours || 0), 0);

    let newStatus = s.status;
    if (completed === subjectTopics.length && completed > 0) {
      newStatus = 'completed';
    } else if (completed > 0 || totalActual > 0) {
      if (newStatus !== 'paused') newStatus = 'in_progress';
    }

    s.actualHours = totalActual;
    s.status = newStatus;
    this.updateSubject(subjectId, { actualHours: totalActual, status: newStatus });
  }

  // Strict subject completion verification
  canMarkSubjectCompleted(subjectId) {
    const subjectTopics = this.state.topics.filter(t => t.subjectId === subjectId);
    if (subjectTopics.length === 0) return true;
    const uncompleted = subjectTopics.filter(t => t.status !== 'completed');
    return uncompleted.length === 0;
  }

  // --- CURRENT FOCUS & COMMITMENT SYSTEM ---
  getCurrentFocus() {
    const commitment = this.state.focusCommitments[this.currentUser];
    if (!commitment || !commitment.subjectId) return null;
    const subject = this.state.subjects.find(s => s.id === commitment.subjectId);
    if (!subject) return null;

    const topics = this.state.topics.filter(t => t.subjectId === subject.id);
    const completedTopics = topics.filter(t => t.status === 'completed');
    const remainingTopics = topics.filter(t => t.status !== 'completed');
    const progress = topics.length > 0 ? Math.round((completedTopics.length / topics.length) * 100) : 0;

    return {
      subject,
      commitment,
      topics,
      completedTopics,
      remainingTopics,
      progress,
      isLocked: commitment.lockedUntil ? new Date() < new Date(commitment.lockedUntil + 'T23:59:59') : false
    };
  }

  async setFocusCommitment(subjectId, startDate, endDate) {
    const current = this.state.focusCommitments[this.currentUser] || {};
    const commitment = {
      subjectId,
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
      lockedUntil: endDate,
      history: current.history || []
    };

    this.state.focusCommitments[this.currentUser] = commitment;
    this.saveToLocalStorage();
    this.notify();

    if (db) {
      try {
        await setDoc(doc(db, "study_focus", this.currentUser), commitment);
      } catch (e) { console.error("Firestore focus update error:", e); }
    }
  }

  async switchFocusEarly(newSubjectId, newStartDate, newEndDate, reason, reasonNote) {
    const current = this.state.focusCommitments[this.currentUser] || {};
    const oldSubjectId = current.subjectId;
    const historyEntry = {
      date: new Date().toISOString().split('T')[0],
      prevSubjectId: oldSubjectId,
      newSubjectId: newSubjectId,
      reason: reason || 'Other',
      note: reasonNote || '',
      timestamp: new Date().toISOString()
    };

    const history = current.history ? [...current.history, historyEntry] : [historyEntry];
    this.state.focusHistory.push({ userId: this.currentUser, ...historyEntry });

    const commitment = {
      subjectId: newSubjectId,
      startDate: newStartDate || new Date().toISOString().split('T')[0],
      endDate: newEndDate || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
      lockedUntil: newEndDate,
      history
    };

    this.state.focusCommitments[this.currentUser] = commitment;
    this.saveToLocalStorage();
    this.notify();

    if (db) {
      try {
        await setDoc(doc(db, "study_focus", this.currentUser), commitment);
      } catch (e) { console.error("Firestore focus switch error:", e); }
    }
  }

  getFocusSwitchCount(days = 14) {
    const current = this.state.focusCommitments[this.currentUser] || {};
    const history = current.history || [];
    const cutoff = new Date(Date.now() - days * 86400000);
    return history.filter(h => new Date(h.timestamp) >= cutoff).length;
  }

  // --- DAILY PLANNER & CALENDAR API ---
  getTasksForDate(dateStr, userId = this.currentUser) {
    return this.state.dailyTasks.filter(t => t.userId === userId && t.date === dateStr);
  }

  async createDailyTask(taskData) {
    const id = 'dtask_' + Date.now();
    const newTask = {
      id,
      userId: this.currentUser,
      title: taskData.title.trim(),
      subjectId: taskData.subjectId || '',
      topicId: taskData.topicId || '',
      date: taskData.date || new Date().toISOString().split('T')[0],
      plannedDuration: parseFloat(taskData.plannedDuration) || 1,
      actualDuration: parseFloat(taskData.actualDuration) || 0,
      priority: taskData.priority || 'medium',
      completed: false,
      notes: taskData.notes || '',
      createdAt: new Date().toISOString()
    };

    this.state.dailyTasks.push(newTask);
    this.saveToLocalStorage();
    this.notify();

    if (db) {
      try {
        await setDoc(doc(db, "study_tasks", id), newTask);
      } catch (e) { console.error("Firestore task add error:", e); }
    }
    return newTask;
  }

  async toggleDailyTask(id, completed) {
    const idx = this.state.dailyTasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      const task = this.state.dailyTasks[idx];
      task.completed = completed;
      task.completedAt = completed ? new Date().toISOString() : null;

      if (completed) {
        // Award XP for completing task
        this.awardXP('TASK_COMPLETED', 20, id, 'Completed: ' + task.title);

        // Check if topic duration should be updated
        if (task.topicId && task.actualDuration > 0) {
          const top = this.state.topics.find(t => t.id === task.topicId);
          if (top) {
            this.updateTopic(task.topicId, {
              actualHours: (top.actualHours || 0) + task.actualDuration
            });
          }
        }
      }

      this.recalculateDailyStreak(task.date);
      this.checkAchievements();
      this.saveToLocalStorage();
      this.notify();

      if (db) {
        try {
          await updateDoc(doc(db, "study_tasks", id), {
            completed,
            completedAt: task.completedAt || null
          });
        } catch (e) { console.error("Firestore task toggle error:", e); }
      }
    }
  }

  async updateDailyTask(id, updates) {
    const idx = this.state.dailyTasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.state.dailyTasks[idx] = { ...this.state.dailyTasks[idx], ...updates };
      this.saveToLocalStorage();
      this.notify();

      if (db) {
        try {
          await updateDoc(doc(db, "study_tasks", id), updates);
        } catch (e) { console.error("Firestore task update error:", e); }
      }
    }
  }

  async deleteDailyTask(id) {
    this.state.dailyTasks = this.state.dailyTasks.filter(t => t.id !== id);
    this.saveToLocalStorage();
    this.notify();

    if (db) {
      try {
        await deleteDoc(doc(db, "study_tasks", id));
      } catch (e) { console.error("Firestore task delete error:", e); }
    }
  }

  // --- STREAK & MEANINGFUL STUDY ENGINE ---
  recalculateDailyStreak(dateStr = new Date().toISOString().split('T')[0]) {
    const userStats = this.getUserStats(this.currentUser);
    const goalHours = userStats.dailyGoalHours || 3;
    const tasks = this.getTasksForDate(dateStr, this.currentUser);
    const totalActualHours = tasks.reduce((sum, t) => sum + (t.actualDuration || 0), 0);
    const completedTasks = tasks.filter(t => t.completed).length;

    // Rule: streak counts if actual hours >= goal hours OR (all planned tasks >= 2 completed with minimum 1 hr)
    const isGoalMet = (totalActualHours >= goalHours) || (tasks.length > 0 && completedTasks === tasks.length && totalActualHours >= 1);

    if (isGoalMet) {
      this.awardXP('DAILY_GOAL_MET', 25, 'goal_' + dateStr, 'Met daily goal (' + totalActualHours + 'h)');
      if (userStats.lastGoalDate !== dateStr) {
        userStats.lastGoalDate = dateStr;
        userStats.streak = (userStats.streak || 0) + 1;
        if (userStats.streak > (userStats.longestStreak || 0)) {
          userStats.longestStreak = userStats.streak;
        }
        this.saveUserStats(this.currentUser, userStats);
      }
    }
  }

  // Day activity status for Calendar (🟢 fully completed, 🟡 partially completed, 🔴 missed, ⚪ no plan)
  getDayActivityStatus(dateStr, userId = this.currentUser) {
    const tasks = this.getTasksForDate(dateStr, userId);
    if (tasks.length === 0) return { status: 'none', label: 'No plan', dot: 'grey', hours: 0, completed: 0, total: 0 };

    const completed = tasks.filter(t => t.completed).length;
    const totalActualHours = tasks.reduce((sum, t) => sum + (t.actualDuration || 0), 0);
    const plannedHours = tasks.reduce((sum, t) => sum + (t.plannedDuration || 0), 0);

    const isPast = new Date(dateStr) < new Date(new Date().toISOString().split('T')[0]);

    if (completed === tasks.length && completed > 0) {
      return { status: 'full', label: 'Fully Completed', dot: 'green', hours: totalActualHours, completed, total: tasks.length };
    } else if (completed > 0 || totalActualHours > 0) {
      return { status: 'partial', label: 'Partially Completed', dot: 'yellow', hours: totalActualHours, completed, total: tasks.length };
    } else if (isPast && tasks.length > 0 && completed === 0) {
      return { status: 'missed', label: 'Missed', dot: 'red', hours: 0, completed: 0, total: tasks.length };
    } else {
      return { status: 'planned', label: 'Planned', dot: 'grey', hours: plannedHours, completed: 0, total: tasks.length };
    }
  }

  // --- XP & GAMIFICATION LEDGER ---
  awardXP(action, amount, refId, description) {
    const today = new Date().toISOString().split('T')[0];
    
    // Anti-farming rule 1: Idempotent refId check
    const existing = this.state.xpLedger.find(entry => entry.userId === this.currentUser && entry.refId === refId);
    if (existing) return false;

    // Anti-farming rule 2: Daily cap (max 300 XP per day)
    const todayXP = this.state.xpLedger
      .filter(entry => entry.userId === this.currentUser && entry.date === today)
      .reduce((sum, e) => sum + e.amount, 0);

    if (todayXP >= 300) {
      console.log("Daily XP limit reached (300 XP).");
      return false;
    }

    const awardAmount = Math.min(amount, 300 - todayXP);
    const entry = {
      id: 'xp_' + Date.now(),
      userId: this.currentUser,
      action,
      amount: awardAmount,
      refId,
      description,
      date: today,
      timestamp: new Date().toISOString()
    };

    this.state.xpLedger.push(entry);
    const stats = this.getUserStats(this.currentUser);
    stats.xp = (stats.xp || 0) + awardAmount;
    this.saveUserStats(this.currentUser, stats);
    this.saveToLocalStorage();
    this.notify();

    if (db) {
      try {
        setDoc(doc(db, "study_xp_ledger", entry.id), entry);
      } catch (e) { console.error("Firestore XP save error:", e); }
    }
    return true;
  }

  // --- ACHIEVEMENTS ENGINE ---
  checkAchievements() {
    const stats = this.getUserStats(this.currentUser);
    const badges = new Set(stats.badges || []);
    const userTopics = this.state.topics.filter(t => t.userId === this.currentUser && t.status === 'completed');
    const userTasks = this.state.dailyTasks.filter(t => t.userId === this.currentUser && t.completed);
    const userSubjects = this.state.subjects.filter(s => s.userId === this.currentUser && s.status === 'completed');

    if ((stats.streak || 0) >= 7) badges.add('streak_7');
    if (userSubjects.length >= 1) badges.add('first_subject');
    if (userTasks.length >= 100) badges.add('100_tasks');
    if (userTopics.length >= 50) badges.add('50_topics');
    if (this.getFocusSwitchCount(30) === 0 && (stats.streak || 0) >= 10) badges.add('focus_master');

    stats.badges = Array.from(badges);
    this.saveUserStats(this.currentUser, stats);
  }

  getAchievementsList() {
    const stats = this.getUserStats(this.currentUser);
    const unlocked = new Set(stats.badges || []);

    const allBadges = [
      { id: 'streak_7', icon: '🔥', title: '7 Day Streak', desc: 'Maintain an active study streak for 7 consecutive days' },
      { id: 'first_subject', icon: '📚', title: 'First Subject Completed', desc: 'Complete 100% of topics in any study subject' },
      { id: 'focus_master', icon: '🎯', title: 'Focus Master', desc: 'Commit to your focus subject without early switching' },
      { id: '100_tasks', icon: '💯', title: '100 Tasks Completed', desc: 'Finish 100 planned study tasks' },
      { id: '50_topics', icon: '🧠', title: '50 Topics Completed', desc: 'Conquer 50 topics across your learning roadmap' },
      { id: 'perfect_week', icon: '⚡', title: 'Perfect Week', desc: 'Meet your daily study goal 7 days in a single week' },
      { id: 'weekly_num_1', icon: '🏆', title: 'Weekly #1', desc: 'Top the shared leaderboard for the current week' }
    ];

    return allBadges.map(b => ({
      ...b,
      unlocked: unlocked.has(b.id)
    }));
  }

  // --- STATS & LEADERBOARD API ---
  getUserStats(userId = this.currentUser) {
    if (!this.state.userStats[userId]) {
      this.state.userStats[userId] = {
        xp: 0,
        streak: 0,
        longestStreak: 0,
        dailyGoalHours: 3,
        badges: []
      };
    }
    return this.state.userStats[userId];
  }

  async saveUserStats(userId, stats) {
    this.state.userStats[userId] = stats;
    this.saveToLocalStorage();
    this.notify();

    if (db) {
      try {
        await setDoc(doc(db, "study_user_stats", userId), stats);
      } catch (e) { console.error("Firestore stats error:", e); }
    }
  }

  getLeaderboardData(filter = 'week') {
    // Users Veer and SK
    const users = ['sk', 'veer'];
    const now = new Date();
    
    return users.map(u => {
      const stats = this.getUserStats(u);
      const tasks = this.state.dailyTasks.filter(t => t.userId === u);
      const topics = this.state.topics.filter(t => t.userId === u && t.status === 'completed');
      
      // Calculate weekly study hours
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
      const weeklyTasks = tasks.filter(t => new Date(t.date) >= sevenDaysAgo);
      const weeklyHours = weeklyTasks.reduce((sum, t) => sum + (t.actualDuration || 0), 0);
      const completedTasks = tasks.filter(t => t.completed).length;

      // Filtered XP calculation strictly from actual ledger
      let filteredXP = 0;
      if (filter === 'today') {
        const todayStr = now.toISOString().split('T')[0];
        filteredXP = this.state.xpLedger
          .filter(e => e.userId === u && e.date === todayStr)
          .reduce((sum, e) => sum + e.amount, 0);
      } else if (filter === 'week') {
        filteredXP = this.state.xpLedger
          .filter(e => e.userId === u && new Date(e.date) >= sevenDaysAgo)
          .reduce((sum, e) => sum + e.amount, 0);
      } else if (filter === 'month') {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
        filteredXP = this.state.xpLedger
          .filter(e => e.userId === u && new Date(e.date) >= thirtyDaysAgo)
          .reduce((sum, e) => sum + e.amount, 0);
      } else {
        filteredXP = stats.xp || 0;
      }

      return {
        userId: u,
        name: u === 'sk' ? 'SK' : 'Veer',
        xp: filteredXP,
        totalXP: stats.xp || 0,
        streak: stats.streak || 0,
        weeklyHours: parseFloat(weeklyHours.toFixed(1)),
        tasksCompleted: completedTasks,
        topicsCompleted: topics.length
      };
    }).sort((a, b) => b.xp - a.xp);
  }

  // --- SMART PLANNING ADVISORY ---
  getSmartPlanningAdvisories(dateStr = new Date().toISOString().split('T')[0]) {
    const advisories = [];
    const tasks = this.getTasksForDate(dateStr, this.currentUser);
    const plannedHours = tasks.reduce((sum, t) => sum + (t.plannedDuration || 0), 0);

    // Rule 1: Over-scheduling warning (> 8 hours)
    if (plannedHours > 8) {
      advisories.push({
        type: 'warning',
        title: 'Unrealistic Daily Plan',
        message: `You scheduled ${plannedHours} hours of tasks today. Recommended: 4–6 focused study hours to avoid burnout.`
      });
    }

    // Rule 2: Postponed topic detector
    const postponedTopics = this.state.topics.filter(t => t.userId === this.currentUser && (t.postponeCount || 0) >= 3);
    if (postponedTopics.length > 0) {
      advisories.push({
        type: 'warning',
        title: 'Postponed Topics Alert',
        message: `You have postponed "${postponedTopics[0].name}" 3+ times. Consider breaking it down into smaller, 30-minute subtasks.`
      });
    }

    // Rule 3: Frequent focus switching detector
    const switchCount = this.getFocusSwitchCount(14);
    if (switchCount >= 3) {
      advisories.push({
        type: 'warning',
        title: 'Focus Hopping Alert',
        message: `You changed your primary focus ${switchCount} times in the last 14 days. Commit to one subject for at least 7 straight days.`
      });
    }

    return advisories;
  }
}

export const store = new StudyStore();
