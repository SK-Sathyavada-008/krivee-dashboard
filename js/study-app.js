/**
 * KriVee Study Planner - UI Controller & View Components
 * Live Dynamic Tracking (Strict Real Data Calculation)
 */

import { store } from './study-store.js';

class StudyApp {
  constructor() {
    this.currentTab = 'dashboard';
    this.selectedCalendarDate = new Date().toISOString().split('T')[0];
    this.calendarCurrentMonth = new Date().getMonth();
    this.calendarCurrentYear = new Date().getFullYear();
    this.selectedPlannerDate = new Date().toISOString().split('T')[0];
    this.selectedLeaderboardFilter = 'week';
  }

  init() {
    this.bindGlobalEvents();
    this.setupNavigation();
    this.setupModals();
    this.renderAll();

    // Subscribe to store updates
    store.subscribe(() => {
      this.renderAll();
    });
  }

  showToast(message, icon = '✨') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${icon}</span> <span>${this.escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- NAVIGATION ROUTER ---
  setupNavigation() {
    const tabs = document.querySelectorAll('.nav-tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetView = tab.dataset.view;
        this.switchTab(targetView);
      });
    });
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === tabName);
    });

    document.querySelectorAll('.section-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${tabName}`);
    });

    this.renderCurrentView();
  }

  renderAll() {
    this.renderHeaderStatus();
    this.renderCurrentView();
  }

  renderCurrentView() {
    switch (this.currentTab) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'roadmap':
        this.renderRoadmap();
        break;
      case 'daily-plan':
        this.renderDailyPlan();
        break;
      case 'calendar':
        this.renderCalendar();
        break;
      case 'leaderboard':
        this.renderLeaderboard();
        break;
      case 'analytics':
        this.renderAnalytics();
        break;
      case 'weekly-review':
        this.renderWeeklyReview();
        break;
    }
  }

  // --- HEADER STATUS ---
  renderHeaderStatus() {
    const stats = store.getUserStats();
    const streakEl = document.getElementById('header-streak-val');
    const xpEl = document.getElementById('header-xp-val');
    const userAvatarEl = document.getElementById('header-user-avatar');
    const userNameEl = document.getElementById('header-user-name');

    if (streakEl) streakEl.textContent = `${stats.streak || 0}d`;
    if (xpEl) xpEl.textContent = `${stats.xp || 0} XP`;
    if (userNameEl) userNameEl.textContent = store.getCurrentUserName();
    if (userAvatarEl) userAvatarEl.textContent = store.getCurrentUserName().charAt(0);
  }

  // --- DASHBOARD VIEW ---
  renderDashboard() {
    const container = document.getElementById('dashboard-content');
    if (!container) return;

    const focusData = store.getCurrentFocus();
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTasks = store.getTasksForDate(todayStr);
    const completedTasks = todayTasks.filter(t => t.completed).length;
    const totalPlannedHours = todayTasks.reduce((sum, t) => sum + (t.plannedDuration || 0), 0);
    const totalActualHours = todayTasks.reduce((sum, t) => sum + (t.actualDuration || 0), 0);
    const taskPercent = todayTasks.length > 0 ? Math.round((completedTasks / todayTasks.length) * 100) : 0;
    const stats = store.getUserStats();
    const advisories = store.getSmartPlanningAdvisories(todayStr);

    let html = ``;

    // Smart Advisory Alerts
    if (advisories.length > 0) {
      advisories.forEach(adv => {
        html += `
          <div class="advisory-banner ${adv.type}">
            <span>⚠️</span>
            <div><strong>${this.escapeHtml(adv.title)}:</strong> ${this.escapeHtml(adv.message)}</div>
          </div>
        `;
      });
    }

    // Top Stats Bar
    html += `
      <div class="stat-widgets">
        <div class="stat-widget">
          <div class="stat-widget-label">Daily Streak</div>
          <div class="stat-widget-val">🔥 ${stats.streak || 0} <span style="font-size:14px;font-weight:normal;color:var(--ink-soft);">days</span></div>
          <div class="stat-widget-sub">Best: ${stats.longestStreak || 0} days</div>
        </div>
        <div class="stat-widget">
          <div class="stat-widget-label">Study Time Today</div>
          <div class="stat-widget-val">⏱️ ${totalActualHours} <span style="font-size:14px;font-weight:normal;color:var(--ink-soft);">/ ${stats.dailyGoalHours || 3} hrs</span></div>
          <div class="stat-widget-sub">${totalActualHours >= (stats.dailyGoalHours || 3) ? '✨ Daily goal met!' : `${((stats.dailyGoalHours || 3) - totalActualHours).toFixed(1)}h left to goal`}</div>
        </div>
        <div class="stat-widget">
          <div class="stat-widget-label">Total Experience</div>
          <div class="stat-widget-val">⚡ ${stats.xp || 0} <span style="font-size:14px;font-weight:normal;color:var(--ink-soft);">XP</span></div>
          <div class="stat-widget-sub">${stats.badges ? stats.badges.length : 0} badges unlocked</div>
        </div>
        <div class="stat-widget">
          <div class="stat-widget-label">Today's Tasks</div>
          <div class="stat-widget-val">🎯 ${completedTasks} <span style="font-size:14px;font-weight:normal;color:var(--ink-soft);">/ ${todayTasks.length}</span></div>
          <div class="stat-widget-sub">${taskPercent}% completed</div>
        </div>
      </div>
    `;

    // CURRENT FOCUS CARD
    if (focusData) {
      const remainingNames = focusData.remainingTopics.map(t => t.name).slice(0, 4);
      html += `
        <div class="focus-card">
          <div class="focus-badge-row">
            <span class="focus-label">🎯 Current Focus Subject</span>
            <span class="commitment-lock">
              🔒 Focus committed until ${focusData.commitment.endDate || 'Target'}
            </span>
          </div>
          <div class="focus-title">${this.escapeHtml(focusData.subject.name)}</div>
          <div class="focus-desc">${this.escapeHtml(focusData.subject.description || 'Targeting full completion before switching subjects.')}</div>
          
          <div class="focus-progress-wrap">
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" style="width: ${focusData.progress}%"></div>
            </div>
            <div class="progress-meta">
              <span><strong>${focusData.progress}% Complete</strong> (${focusData.completedTopics.length}/${focusData.topics.length} topics finished)</span>
              <span>Target: ${focusData.commitment.endDate || 'No deadline'}</span>
            </div>
          </div>

          ${remainingNames.length > 0 ? `
            <div style="font-size:12px;font-weight:600;color:var(--ink-soft);margin-top:10px;">Next Topics to Finish:</div>
            <div class="focus-topics-list">
              ${remainingNames.map(name => `<span class="focus-topic-chip">📌 ${this.escapeHtml(name)}</span>`).join('')}
              ${focusData.remainingTopics.length > 4 ? `<span class="focus-topic-chip">+${focusData.remainingTopics.length - 4} more</span>` : ''}
            </div>
          ` : `<div style="font-size:13px;color:var(--sage);font-weight:600;margin-top:10px;">${focusData.topics.length > 0 ? '🎉 All topics in this focus subject completed!' : 'Add topics to your roadmap to track progress.'}</div>`}

          <div class="focus-actions">
            <button class="btn-secondary" id="btn-change-focus">Change Focus Subject</button>
            <button class="btn-primary" id="btn-quick-plan-focus">+ Plan Today's Study</button>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="focus-card" style="text-align:center;padding:36px;">
          <div class="focus-title" style="font-size:20px;margin-bottom:8px;">No Current Focus Subject Selected</div>
          <p class="focus-desc" style="margin-bottom:16px;">Select a focus subject and commit to a completion period to build steady study habits.</p>
          <button class="btn-primary" id="btn-set-focus">🎯 Set Current Focus</button>
        </div>
      `;
    }

    // Dashboard 2-column Grid: Today's Tasks & Subject Progress / Leaderboard Snapshot
    const userSubjects = store.state.subjects.filter(s => s.userId === store.getCurrentUser());

    html += `
      <div class="dash-grid">
        <!-- Today's Tasks -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">📝 Today's Study Tasks</div>
              <div class="card-subtitle">${todayTasks.length} planned • ${totalActualHours} / ${totalPlannedHours} hrs logged</div>
            </div>
            <button class="btn-secondary" style="padding:4px 10px;font-size:12px;" id="btn-dash-add-task">+ Task</button>
          </div>

          <div class="task-list">
            ${todayTasks.length === 0 ? `
              <div style="text-align:center;padding:32px;color:var(--ink-faint);font-size:13px;">
                No study tasks scheduled for today.<br>
                <button class="btn-secondary" style="margin-top:12px;" id="btn-dash-add-first-task">+ Add First Task</button>
              </div>
            ` : todayTasks.map(t => this.renderTaskItemHtml(t)).join('')}
          </div>
        </div>

        <!-- Right Column: Mini Leaderboard & Roadmap Summary -->
        <div style="display:flex;flex-direction:column;gap:20px;">
          <!-- Mini Leaderboard -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">🏆 Study Duel</div>
              <button class="btn-secondary" style="padding:3px 8px;font-size:11.5px;" id="btn-dash-view-leaderboard">Full Board →</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${store.getLeaderboardData('week').map((user, idx) => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg);border-radius:8px;border:1px solid var(--line);">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:18px;">${idx === 0 ? '🥇' : '🥈'}</span>
                    <div>
                      <strong style="font-size:13.5px;color:var(--ink);">${this.escapeHtml(user.name)}</strong>
                      <div style="font-size:11.5px;color:var(--ink-soft);">🔥 ${user.streak}d streak • ${user.weeklyHours}h studied</div>
                    </div>
                  </div>
                  <span class="status-pill xp-pill">${user.xp} XP</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Subject Progress Snapshot -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">📚 Subject Progress</div>
              <button class="btn-secondary" style="padding:3px 8px;font-size:11.5px;" id="btn-dash-view-roadmap">Roadmap →</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:12px;">
              ${userSubjects.length === 0 ? `
                <div style="font-size:12.5px;color:var(--ink-faint);text-align:center;padding:16px;">No subjects created yet.</div>
              ` : userSubjects.map(sub => {
                const subTopics = store.state.topics.filter(t => t.subjectId === sub.id);
                const done = subTopics.filter(t => t.status === 'completed').length;
                const pct = subTopics.length > 0 ? Math.round((done / subTopics.length) * 100) : 0;
                return `
                  <div>
                    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
                      <strong style="color:var(--ink);">${this.escapeHtml(sub.name)}</strong>
                      <span style="color:var(--ink-soft);">${done}/${subTopics.length} (${pct}%)</span>
                    </div>
                    <div class="progress-bar-wrap">
                      <div class="progress-bar-fill" style="width:${pct}%"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.bindDashboardButtons();
  }

  bindDashboardButtons() {
    const btnSetFocus = document.getElementById('btn-set-focus');
    const btnChangeFocus = document.getElementById('btn-change-focus');
    const btnQuickPlan = document.getElementById('btn-quick-plan-focus');
    const btnAddTask = document.getElementById('btn-dash-add-task');
    const btnAddFirstTask = document.getElementById('btn-dash-add-first-task');
    const btnViewLeaderboard = document.getElementById('btn-dash-view-leaderboard');
    const btnViewRoadmap = document.getElementById('btn-dash-view-roadmap');

    if (btnSetFocus) btnSetFocus.addEventListener('click', () => this.openFocusModal());
    if (btnChangeFocus) btnChangeFocus.addEventListener('click', () => this.openFocusModal());
    if (btnQuickPlan) btnQuickPlan.addEventListener('click', () => this.openAddTaskModal());
    if (btnAddTask) btnAddTask.addEventListener('click', () => this.openAddTaskModal());
    if (btnAddFirstTask) btnAddFirstTask.addEventListener('click', () => this.openAddTaskModal());
    if (btnViewLeaderboard) btnViewLeaderboard.addEventListener('click', () => this.switchTab('leaderboard'));
    if (btnViewRoadmap) btnViewRoadmap.addEventListener('click', () => this.switchTab('roadmap'));

    // Task item checkboxes & deletes
    this.bindTaskItemEvents();
  }

  // --- TASK ITEM HTML RENDERER ---
  renderTaskItemHtml(t) {
    const sub = store.state.subjects.find(s => s.id === t.subjectId);
    const top = store.state.topics.find(top => top.id === t.topicId);

    return `
      <div class="task-item-row ${t.completed ? 'completed' : ''}" data-id="${t.id}">
        <div class="task-left">
          <input type="checkbox" class="task-checkbox" ${t.completed ? 'checked' : ''} data-id="${t.id}">
          <div class="task-info-block">
            <span class="task-name">${this.escapeHtml(t.title)}</span>
            <div class="task-tags-row">
              ${sub ? `<span class="tag-badge subject">${this.escapeHtml(sub.name)}</span>` : ''}
              ${top ? `<span class="tag-badge topic">${this.escapeHtml(top.name)}</span>` : ''}
              <span class="tag-badge time">⏱️ ${t.actualDuration || 0}/${t.plannedDuration || 1}h</span>
              <span class="tag-badge" style="background:var(--bg);border:1px solid var(--line);">${t.priority}</span>
              ${t.notes ? `<span style="font-size:11px;color:var(--ink-soft);font-style:italic;">"${this.escapeHtml(t.notes)}"</span>` : ''}
            </div>
          </div>
        </div>
        <div class="task-right">
          <button class="btn-secondary btn-log-time" style="padding:3px 8px;font-size:11px;" data-id="${t.id}">+ Log Time</button>
          <button class="task-delete" data-id="${t.id}" title="Delete task">&times;</button>
        </div>
      </div>
    `;
  }

  bindTaskItemEvents() {
    document.querySelectorAll('.task-checkbox').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const completed = e.target.checked;
        await store.toggleDailyTask(id, completed);
        if (completed) {
          this.showToast('Task completed! +20 XP awarded ⚡', '🎉');
        }
      });
    });

    document.querySelectorAll('.task-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('Delete this study task?')) {
          await store.deleteDailyTask(id);
          this.showToast('Task deleted');
        }
      });
    });

    document.querySelectorAll('.btn-log-time').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const task = store.state.dailyTasks.find(t => t.id === id);
        if (!task) return;
        const input = prompt(`Log study hours for "${task.title}" (Current: ${task.actualDuration || 0}h):`, '1');
        if (input !== null) {
          const added = parseFloat(input);
          if (!isNaN(added) && added > 0) {
            const newTotal = (task.actualDuration || 0) + added;
            await store.updateDailyTask(id, { actualDuration: parseFloat(newTotal.toFixed(1)) });
            store.recalculateDailyStreak(task.date);
            this.showToast(`Logged ${added} hours! ⏱️`);
          }
        }
      });
    });
  }

  // --- STUDY ROADMAP VIEW ---
  renderRoadmap() {
    const container = document.getElementById('roadmap-content');
    if (!container) return;

    const userSubjects = store.state.subjects.filter(s => s.userId === store.getCurrentUser());

    let html = `
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Study Roadmap</h1>
          <div class="page-subtitle">Subjects → Topics → Subtasks with structured completion tracking</div>
        </div>
        <button class="btn-primary" id="btn-add-subject">+ Create New Subject</button>
      </div>
    `;

    if (userSubjects.length === 0) {
      html += `
        <div class="card" style="text-align:center;padding:48px;">
          <h3 style="font-family:'Fraunces',serif;font-size:18px;margin-bottom:8px;">No study subjects yet</h3>
          <p style="color:var(--ink-soft);font-size:13.5px;margin-bottom:16px;">Add your primary focus subjects (e.g. Data Structures, System Design, Machine Learning).</p>
          <button class="btn-primary" id="btn-add-subject-empty">+ Add Your First Subject</button>
        </div>
      `;
    } else {
      userSubjects.forEach(sub => {
        const topics = store.state.topics.filter(t => t.subjectId === sub.id);
        const completedTopics = topics.filter(t => t.status === 'completed');
        const progressPct = topics.length > 0 ? Math.round((completedTopics.length / topics.length) * 100) : 0;
        const totalEstHours = topics.reduce((acc, t) => acc + (t.estimatedHours || 0), sub.estimatedHours || 0);
        const totalActHours = topics.reduce((acc, t) => acc + (t.actualHours || 0), sub.actualHours || 0);

        html += `
          <div class="subject-card" data-subject-id="${sub.id}">
            <div class="subject-card-head">
              <div class="subject-title-area">
                <div>
                  <div class="subject-name">${this.escapeHtml(sub.name)}</div>
                  <div style="font-size:12.5px;color:var(--ink-soft);margin-top:2px;">
                    ${this.escapeHtml(sub.description)} • Target: ${sub.targetDate || 'Flexible'}
                  </div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="subject-meta-pill">Priority: ${sub.priority.toUpperCase()}</span>
                <span class="subject-meta-pill">⏱️ ${totalActHours}/${totalEstHours}h</span>
                <button class="btn-secondary" style="padding:4px 10px;font-size:12px;" data-action="add-topic" data-subject-id="${sub.id}">+ Add Topic</button>
                <button class="btn-secondary" style="padding:4px 8px;font-size:12px;" data-action="edit-subject" data-subject-id="${sub.id}">✏️</button>
                <button class="task-delete" data-action="delete-subject" data-subject-id="${sub.id}">&times;</button>
              </div>
            </div>

            <div class="subject-body">
              <div style="margin-bottom:14px;">
                <div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--ink-soft);margin-bottom:6px;">
                  <span><strong>Overall Progress:</strong> ${completedTopics.length} of ${topics.length} topics completed</span>
                  <strong>${progressPct}%</strong>
                </div>
                <div class="progress-bar-wrap">
                  <div class="progress-bar-fill" style="width: ${progressPct}%"></div>
                </div>
              </div>

              <!-- Topic Accordion/List -->
              <div class="topic-list-tree">
                ${topics.length === 0 ? `
                  <div style="font-size:13px;color:var(--ink-faint);padding:12px;text-align:center;">No topics added under this subject yet.</div>
                ` : topics.map(top => {
                  const subtasks = top.subtasks || [];
                  const doneSubtasks = subtasks.filter(st => st.done).length;
                  const isDone = top.status === 'completed';

                  return `
                    <div class="topic-card-item" data-topic-id="${top.id}">
                      <div class="topic-item-head">
                        <div class="topic-name-wrap">
                          <input type="checkbox" class="topic-status-toggle" ${isDone ? 'checked' : ''} data-topic-id="${top.id}">
                          <div>
                            <div class="topic-title ${isDone ? 'done' : ''}">${this.escapeHtml(top.name)}</div>
                            <div style="font-size:11.5px;color:var(--ink-soft);">
                              ${subtasks.length > 0 ? `${doneSubtasks}/${subtasks.length} subtasks done • ` : ''}
                              ⏱️ ${top.actualHours || 0}/${top.estimatedHours || 1}h • Priority: ${top.priority}
                            </div>
                          </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                          <button class="btn-secondary" style="padding:2px 8px;font-size:11px;" data-action="quick-plan-topic" data-topic-id="${top.id}" data-subject-id="${sub.id}">+ Plan in Day</button>
                          <button class="btn-secondary" style="padding:2px 6px;font-size:11px;" data-action="edit-topic" data-topic-id="${top.id}">✏️</button>
                          <button class="task-delete" data-action="delete-topic" data-topic-id="${top.id}">&times;</button>
                        </div>
                      </div>

                      ${(subtasks.length > 0 || top.notes) ? `
                        <div class="topic-item-details">
                          ${top.notes ? `<div style="font-style:italic;color:var(--ink-soft);margin-bottom:8px;">📝 "${this.escapeHtml(top.notes)}"</div>` : ''}
                          ${subtasks.length > 0 ? `
                            <div style="font-weight:600;font-size:12px;color:var(--ink);">Subtasks:</div>
                            <div class="subtask-checklist">
                              ${subtasks.map((st, i) => `
                                <label class="subtask-row">
                                  <input type="checkbox" class="subtask-toggle" ${st.done ? 'checked' : ''} data-topic-id="${top.id}" data-index="${i}">
                                  <span style="${st.done ? 'text-decoration:line-through;color:var(--ink-soft);' : ''}">${this.escapeHtml(st.text)}</span>
                                </label>
                              `).join('')}
                            </div>
                          ` : ''}
                        </div>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        `;
      });
    }

    container.innerHTML = html;
    this.bindRoadmapEvents();
  }

  bindRoadmapEvents() {
    const btnAddSubject = document.getElementById('btn-add-subject');
    const btnAddSubjectEmpty = document.getElementById('btn-add-subject-empty');
    if (btnAddSubject) btnAddSubject.addEventListener('click', () => this.openSubjectModal());
    if (btnAddSubjectEmpty) btnAddSubjectEmpty.addEventListener('click', () => this.openSubjectModal());

    document.querySelectorAll('[data-action="add-topic"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const subjectId = e.currentTarget.dataset.subjectId;
        this.openTopicModal(null, subjectId);
      });
    });

    document.querySelectorAll('[data-action="edit-subject"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const subjectId = e.currentTarget.dataset.subjectId;
        const sub = store.state.subjects.find(s => s.id === subjectId);
        if (sub) this.openSubjectModal(sub);
      });
    });

    document.querySelectorAll('[data-action="delete-subject"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const subjectId = e.currentTarget.dataset.subjectId;
        if (confirm('Delete this entire subject and all its topics?')) {
          await store.deleteSubject(subjectId);
          this.showToast('Subject deleted');
        }
      });
    });

    document.querySelectorAll('.topic-status-toggle').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const topicId = e.target.dataset.topicId;
        const checked = e.target.checked;
        await store.updateTopic(topicId, {
          status: checked ? 'completed' : 'in_progress',
          completedAt: checked ? new Date().toISOString() : null
        });
        if (checked) {
          this.showToast('Topic Completed! +50 XP awarded 🧠', '🎉');
        }
      });
    });

    document.querySelectorAll('.subtask-toggle').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const topicId = e.target.dataset.topicId;
        const idx = parseInt(e.target.dataset.index);
        const top = store.state.topics.find(t => t.id === topicId);
        if (top && top.subtasks && top.subtasks[idx]) {
          top.subtasks[idx].done = e.target.checked;
          await store.updateTopic(topicId, { subtasks: top.subtasks });
        }
      });
    });

    document.querySelectorAll('[data-action="quick-plan-topic"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const topicId = e.currentTarget.dataset.topicId;
        const subjectId = e.currentTarget.dataset.subjectId;
        this.openAddTaskModal({ subjectId, topicId, date: this.selectedPlannerDate });
      });
    });

    document.querySelectorAll('[data-action="edit-topic"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const topicId = e.currentTarget.dataset.topicId;
        const top = store.state.topics.find(t => t.id === topicId);
        if (top) this.openTopicModal(top, top.subjectId);
      });
    });

    document.querySelectorAll('[data-action="delete-topic"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const topicId = e.currentTarget.dataset.topicId;
        if (confirm('Delete this topic?')) {
          await store.deleteTopic(topicId);
          this.showToast('Topic deleted');
        }
      });
    });
  }

  // --- DAILY PLANNER VIEW ---
  renderDailyPlan() {
    const container = document.getElementById('daily-plan-content');
    if (!container) return;

    const dateStr = this.selectedPlannerDate;
    const tasks = store.getTasksForDate(dateStr);
    const completedTasks = tasks.filter(t => t.completed).length;
    const plannedHours = tasks.reduce((sum, t) => sum + (t.plannedDuration || 0), 0);
    const actualHours = tasks.reduce((sum, t) => sum + (t.actualDuration || 0), 0);
    const percent = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
    const advisories = store.getSmartPlanningAdvisories(dateStr);
    const stats = store.getUserStats();

    const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    let html = `
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Daily Study Planner</h1>
          <div class="page-subtitle">Schedule, execute, and record honest study duration</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="btn-secondary" id="btn-prev-day">← Prev Day</button>
          <input type="date" id="planner-date-picker" class="form-control" style="width:auto;padding:6px 10px;" value="${dateStr}">
          <button class="btn-secondary" id="btn-today">Today</button>
          <button class="btn-secondary" id="btn-next-day">Next Day →</button>
          <button class="btn-primary" id="btn-plan-add-task">+ Add Task</button>
        </div>
      </div>

      <!-- Smart Advisories -->
      ${advisories.map(adv => `
        <div class="advisory-banner ${adv.type}">
          <span>⚠️</span>
          <div><strong>${this.escapeHtml(adv.title)}:</strong> ${this.escapeHtml(adv.message)}</div>
        </div>
      `).join('')}

      <!-- Daily Progress Summary Bar -->
      <div class="card" style="margin-bottom:24px;background:#FCFBF8;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div>
            <div style="font-family:'Fraunces',serif;font-size:18px;font-weight:600;">${formattedDate}</div>
            <div style="font-size:13px;color:var(--ink-soft);margin-top:2px;">
              ${completedTasks} of ${tasks.length} tasks completed (${percent}%) • Study Time: ${actualHours} / ${plannedHours} hours
            </div>
          </div>
          <span class="status-pill ${actualHours >= (stats.dailyGoalHours || 3) ? 'streak-pill' : 'xp-pill'}">
            ${actualHours >= (stats.dailyGoalHours || 3) ? '🔥 Streak Goal Met' : `${actualHours}h Logged`}
          </span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width: ${percent}%"></div>
        </div>
      </div>

      <!-- Tasks List -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Study Tasks (${tasks.length})</div>
          <button class="btn-secondary" style="padding:4px 10px;font-size:12px;" id="btn-planner-quick-add">+ Quick Add</button>
        </div>
        <div class="task-list">
          ${tasks.length === 0 ? `
            <div style="text-align:center;padding:48px;color:var(--ink-faint);font-size:13.5px;">
              No study tasks planned for ${formattedDate}.<br>
              <button class="btn-secondary" style="margin-top:14px;" id="btn-planner-empty-add">+ Plan A Task</button>
            </div>
          ` : tasks.map(t => this.renderTaskItemHtml(t)).join('')}
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.bindDailyPlanEvents();
  }

  bindDailyPlanEvents() {
    const datePicker = document.getElementById('planner-date-picker');
    const btnPrev = document.getElementById('btn-prev-day');
    const btnNext = document.getElementById('btn-next-day');
    const btnToday = document.getElementById('btn-today');
    const btnAddTask = document.getElementById('btn-plan-add-task');
    const btnQuickAdd = document.getElementById('btn-planner-quick-add');
    const btnEmptyAdd = document.getElementById('btn-planner-empty-add');

    if (datePicker) {
      datePicker.addEventListener('change', (e) => {
        this.selectedPlannerDate = e.target.value;
        this.renderDailyPlan();
      });
    }

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        const d = new Date(this.selectedPlannerDate + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        this.selectedPlannerDate = d.toISOString().split('T')[0];
        this.renderDailyPlan();
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        const d = new Date(this.selectedPlannerDate + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        this.selectedPlannerDate = d.toISOString().split('T')[0];
        this.renderDailyPlan();
      });
    }

    if (btnToday) {
      btnToday.addEventListener('click', () => {
        this.selectedPlannerDate = new Date().toISOString().split('T')[0];
        this.renderDailyPlan();
      });
    }

    if (btnAddTask) btnAddTask.addEventListener('click', () => this.openAddTaskModal({ date: this.selectedPlannerDate }));
    if (btnQuickAdd) btnQuickAdd.addEventListener('click', () => this.openAddTaskModal({ date: this.selectedPlannerDate }));
    if (btnEmptyAdd) btnEmptyAdd.addEventListener('click', () => this.openAddTaskModal({ date: this.selectedPlannerDate }));

    this.bindTaskItemEvents();
  }

  // --- MONTHLY CALENDAR VIEW ---
  renderCalendar() {
    const container = document.getElementById('calendar-content');
    if (!container) return;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const currentYear = this.calendarCurrentYear;
    const currentMonth = this.calendarCurrentMonth;
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    let html = `
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Monthly Study Activity</h1>
          <div class="page-subtitle">Track consistency, completed study days, and review historical activity</div>
        </div>
      </div>

      <div class="calendar-wrap">
        <div class="calendar-nav-bar">
          <button class="btn-secondary" id="btn-cal-prev">← Prev Month</button>
          <div class="calendar-month-title">${monthNames[currentMonth]} ${currentYear}</div>
          <button class="btn-secondary" id="btn-cal-next">Next Month →</button>
        </div>

        <div class="calendar-grid">
          <div class="cal-day-header">Sun</div>
          <div class="cal-day-header">Mon</div>
          <div class="cal-day-header">Tue</div>
          <div class="cal-day-header">Wed</div>
          <div class="cal-day-header">Thu</div>
          <div class="cal-day-header">Fri</div>
          <div class="cal-day-header">Sat</div>
    `;

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      html += `<div class="cal-day-cell other-month"><span class="cal-day-num">${dayNum}</span></div>`;
    }

    // Days of the month
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const monthPadded = String(currentMonth + 1).padStart(2, '0');
      const dayPadded = String(day).padStart(2, '0');
      const dateStr = `${currentYear}-${monthPadded}-${dayPadded}`;
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === this.selectedCalendarDate;

      const act = store.getDayActivityStatus(dateStr);

      html += `
        <div class="cal-day-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="cal-day-num">${day}</span>
            <span class="status-dot ${act.dot}"></span>
          </div>
          <div style="margin-top:auto;">
            ${act.total > 0 ? `
              <div style="font-size:10.5px;color:var(--ink-soft);">${act.completed}/${act.total} tasks</div>
              <div class="cal-hours-text">⏱️ ${act.hours}h</div>
            ` : `<div style="font-size:10px;color:var(--ink-faint);">—</div>`}
          </div>
        </div>
      `;
    }

    html += `
        </div>

        <div class="cal-legend">
          <span style="font-weight:600;color:var(--ink);">Indicators:</span>
          <div class="legend-item"><span class="status-dot green"></span> 🟢 Fully Completed</div>
          <div class="legend-item"><span class="status-dot yellow"></span> 🟡 Partially Completed</div>
          <div class="legend-item"><span class="status-dot red"></span> 🔴 Missed</div>
          <div class="legend-item"><span class="status-dot grey"></span> ⚪ No Plan / Rest</div>
        </div>
      </div>
    `;

    // Selected Day Drilldown Card below calendar
    const drillTasks = store.getTasksForDate(this.selectedCalendarDate);
    const drillDateFmt = new Date(this.selectedCalendarDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    html += `
      <div class="card" style="margin-top:24px;">
        <div class="card-header">
          <div>
            <div class="card-title">📅 Activity Details: ${drillDateFmt}</div>
            <div class="card-subtitle">${drillTasks.length} tasks scheduled on this date</div>
          </div>
          <button class="btn-primary" id="btn-cal-jump-planner" data-date="${this.selectedCalendarDate}">Open in Daily Planner →</button>
        </div>

        <div class="task-list">
          ${drillTasks.length === 0 ? `
            <div style="color:var(--ink-soft);font-size:13px;padding:16px;text-align:center;">No study tasks recorded for this date.</div>
          ` : drillTasks.map(t => this.renderTaskItemHtml(t)).join('')}
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.bindCalendarEvents();
  }

  bindCalendarEvents() {
    const btnPrev = document.getElementById('btn-cal-prev');
    const btnNext = document.getElementById('btn-cal-next');
    const btnJump = document.getElementById('btn-cal-jump-planner');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (this.calendarCurrentMonth === 0) {
          this.calendarCurrentMonth = 11;
          this.calendarCurrentYear--;
        } else {
          this.calendarCurrentMonth--;
        }
        this.renderCalendar();
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (this.calendarCurrentMonth === 11) {
          this.calendarCurrentMonth = 0;
          this.calendarCurrentYear++;
        } else {
          this.calendarCurrentMonth++;
        }
        this.renderCalendar();
      });
    }

    if (btnJump) {
      btnJump.addEventListener('click', (e) => {
        this.selectedPlannerDate = e.target.dataset.date;
        this.switchTab('daily-plan');
      });
    }

    document.querySelectorAll('.cal-day-cell[data-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        this.selectedCalendarDate = cell.dataset.date;
        this.renderCalendar();
      });
    });

    this.bindTaskItemEvents();
  }

  // --- LEADERBOARD & ACHIEVEMENTS VIEW ---
  renderLeaderboard() {
    const container = document.getElementById('leaderboard-content');
    if (!container) return;

    const filter = this.selectedLeaderboardFilter;
    const leaderboardData = store.getLeaderboardData(filter);
    const achievements = store.getAchievementsList();

    let html = `
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Leaderboard & Gamification</h1>
          <div class="page-subtitle">Friendly accountability between Veer and SK to finish what we start</div>
        </div>
        <div class="nav-tabs" style="background:var(--surface);">
          <button class="nav-tab-btn ${filter === 'today' ? 'active' : ''}" data-filter="today">Today</button>
          <button class="nav-tab-btn ${filter === 'week' ? 'active' : ''}" data-filter="week">This Week</button>
          <button class="nav-tab-btn ${filter === 'month' ? 'active' : ''}" data-filter="month">This Month</button>
          <button class="nav-tab-btn ${filter === 'all' ? 'active' : ''}" data-filter="all">All Time</button>
        </div>
      </div>

      <!-- Two User Podium Cards -->
      <div class="leaderboard-cards">
        ${leaderboardData.map((user, idx) => `
          <div class="user-rank-card ${idx === 0 && user.xp > 0 ? 'rank-1' : ''}">
            <div class="rank-badge">${idx === 0 ? '🥇 #1' : '🥈 #2'}</div>
            <div class="user-name">${this.escapeHtml(user.name)}</div>
            <div style="font-size:13.5px;color:var(--ink-soft);">${user.xp > 0 ? (idx === 0 ? 'Leading the session! 🚀' : 'On the trail! 🔥') : 'Ready to start logging study sessions.'}</div>
            
            <div class="user-rank-stats">
              <div class="rank-stat-item">
                Experience
                <strong>⚡ ${user.xp} XP</strong>
              </div>
              <div class="rank-stat-item">
                Study Streak
                <strong>🔥 ${user.streak} Days</strong>
              </div>
              <div class="rank-stat-item">
                Weekly Study Time
                <strong>⏱️ ${user.weeklyHours} Hours</strong>
              </div>
              <div class="rank-stat-item">
                Topics Completed
                <strong>🧠 ${user.topicsCompleted} Topics</strong>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- XP Rules Explanation -->
      <div class="card" style="margin-bottom:28px;background:#FAF8F2;border-color:#E8DEC8;">
        <div style="font-family:'Fraunces',serif;font-size:16px;font-weight:600;margin-bottom:8px;">💡 How XP is Earned (Live Tracking & Anti-Farming Protected)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;font-size:12.5px;color:var(--ink-soft);">
          <div>✅ <strong>+20 XP</strong> Complete Planned Task</div>
          <div>🧠 <strong>+50 XP</strong> Complete Study Topic</div>
          <div>💻 <strong>+10 XP</strong> Solve DSA Milestone</div>
          <div>🔄 <strong>+15 XP</strong> Revision Session</div>
          <div>🎯 <strong>+25 XP</strong> Meet Daily Study Goal</div>
          <div>🔥 <strong>+20 XP</strong> Active Daily Streak</div>
        </div>
      </div>

      <!-- Achievements Showcase -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏅 Unlocked Achievements & Badges</div>
          <div class="card-subtitle">${achievements.filter(a => a.unlocked).length} / ${achievements.length} Unlocked</div>
        </div>
        <div class="achievements-grid">
          ${achievements.map(ach => `
            <div class="achievement-card ${ach.unlocked ? '' : 'locked'}">
              <div class="achievement-icon">${ach.icon}</div>
              <div>
                <div class="achievement-title">${this.escapeHtml(ach.title)}</div>
                <div class="achievement-desc">${this.escapeHtml(ach.desc)}</div>
                <div style="font-size:11px;font-weight:600;margin-top:6px;color:${ach.unlocked ? 'var(--sage)' : 'var(--ink-faint)'};">
                  ${ach.unlocked ? '✓ Unlocked' : '🔒 Locked'}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.bindLeaderboardEvents();
  }

  bindLeaderboardEvents() {
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectedLeaderboardFilter = e.target.dataset.filter;
        this.renderLeaderboard();
      });
    });
  }

  // --- ANALYTICS VIEW ---
  renderAnalytics() {
    const container = document.getElementById('analytics-content');
    if (!container) return;

    const userTasks = store.state.dailyTasks.filter(t => t.userId === store.getCurrentUser());
    const completedTasks = userTasks.filter(t => t.completed);
    const totalHours = userTasks.reduce((sum, t) => sum + (t.actualDuration || 0), 0);
    const completionRate = userTasks.length > 0 ? Math.round((completedTasks.length / userTasks.length) * 100) : 0;
    const focusSwitches = store.getFocusSwitchCount(30);

    // Subject breakdown
    const subjectBreakdown = {};
    userTasks.forEach(t => {
      const sub = store.state.subjects.find(s => s.id === t.subjectId);
      const subName = sub ? sub.name : 'General Study';
      subjectBreakdown[subName] = (subjectBreakdown[subName] || 0) + (t.actualDuration || 0);
    });
    const maxSubHours = Math.max(...Object.values(subjectBreakdown), 1);

    // Weekday hours live calculation
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayHours = { 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0, 'Friday': 0, 'Saturday': 0, 'Sunday': 0 };

    userTasks.forEach(t => {
      if (t.date && t.actualDuration > 0) {
        const d = new Date(t.date + 'T00:00:00');
        const dayName = daysOfWeek[d.getDay()];
        if (weekdayHours[dayName] !== undefined) {
          weekdayHours[dayName] += t.actualDuration;
        }
      }
    });

    const maxDayHours = Math.max(...Object.values(weekdayHours), 1);
    
    // Find most productive day
    let bestDay = '—';
    let maxFound = 0;
    Object.entries(weekdayHours).forEach(([day, hrs]) => {
      if (hrs > maxFound) {
        maxFound = hrs;
        bestDay = day;
      }
    });

    let html = `
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Productivity Insights</h1>
          <div class="page-subtitle">Clean, meaningful metrics to help you stay focused and finish subjects</div>
        </div>
      </div>

      <div class="stat-widgets" style="margin-bottom:24px;">
        <div class="stat-widget">
          <div class="stat-widget-label">Task Completion Rate</div>
          <div class="stat-widget-val">${completionRate}%</div>
          <div class="stat-widget-sub">${completedTasks.length} / ${userTasks.length} tasks finished</div>
        </div>
        <div class="stat-widget">
          <div class="stat-widget-label">Total Study Time</div>
          <div class="stat-widget-val">${totalHours.toFixed(1)} <span style="font-size:14px;color:var(--ink-soft);">hrs</span></div>
          <div class="stat-widget-sub">${userTasks.length > 0 ? `Across ${userTasks.length} planned tasks` : 'No logs yet'}</div>
        </div>
        <div class="stat-widget">
          <div class="stat-widget-label">Most Productive Day</div>
          <div class="stat-widget-val">${bestDay}</div>
          <div class="stat-widget-sub">${maxFound > 0 ? `${maxFound.toFixed(1)} hrs logged` : 'Start logging study time'}</div>
        </div>
        <div class="stat-widget">
          <div class="stat-widget-label">Focus Switching Freq</div>
          <div class="stat-widget-val">${focusSwitches} <span style="font-size:14px;color:var(--ink-soft);">times</span></div>
          <div class="stat-widget-sub">${focusSwitches <= 2 ? '✨ High focus commitment!' : '⚠️ Try sticking to 1 subject'}</div>
        </div>
      </div>

      <div class="analytics-grid">
        <!-- Subject Time Breakdown -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">📊 Study Time by Subject</div>
            <div class="card-subtitle">Actual hours logged</div>
          </div>
          <div class="chart-bar-list">
            ${Object.keys(subjectBreakdown).length === 0 ? `
              <div style="font-size:13px;color:var(--ink-soft);padding:24px;text-align:center;">No study hours logged yet. Schedule tasks and log hours to see distribution.</div>
            ` : Object.entries(subjectBreakdown).map(([name, hours]) => {
              const widthPct = Math.round((hours / maxSubHours) * 100);
              return `
                <div class="chart-bar-row">
                  <div class="chart-bar-label" title="${this.escapeHtml(name)}">${this.escapeHtml(name)}</div>
                  <div class="chart-bar-track">
                    <div class="chart-bar-fill" style="width: ${widthPct}%;"></div>
                  </div>
                  <div class="chart-bar-val">${hours.toFixed(1)}h</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Consistency Pattern -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">📈 Weekly Study Consistency</div>
            <div class="card-subtitle">Real daily hour distribution</div>
          </div>
          <div class="chart-bar-list">
            ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
              const dayHrs = weekdayHours[day] || 0;
              const widthPct = maxFound > 0 ? Math.round((dayHrs / maxDayHours) * 100) : 0;
              return `
                <div class="chart-bar-row">
                  <div class="chart-bar-label">${day}</div>
                  <div class="chart-bar-track">
                    <div class="chart-bar-fill clay" style="width: ${widthPct}%;"></div>
                  </div>
                  <div class="chart-bar-val">${dayHrs.toFixed(1)}h</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  // --- WEEKLY REVIEW VIEW ---
  renderWeeklyReview() {
    const container = document.getElementById('weekly-review-content');
    if (!container) return;

    const tasks = store.state.dailyTasks.filter(t => t.userId === store.getCurrentUser());
    const completed = tasks.filter(t => t.completed).length;
    const actualHours = tasks.reduce((sum, t) => sum + (t.actualDuration || 0), 0);
    const plannedHours = tasks.reduce((sum, t) => sum + (t.plannedDuration || 0), 0);
    const topicsDone = store.state.topics.filter(t => t.userId === store.getCurrentUser() && t.status === 'completed').length;
    const stats = store.getUserStats();

    const reasonsList = [
      'Too many tasks scheduled',
      'Topic was too difficult',
      'Procrastination / Distractions',
      'Poor daily planning',
      'Lack of time / Emergencies',
      'Subject switching fatigue'
    ];

    let html = `
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Weekly Retrospective</h1>
          <div class="page-subtitle">Analyze what worked, record what went wrong, and recalibrate your planning</div>
        </div>
        <button class="btn-primary" id="btn-save-review">Save Weekly Review</button>
      </div>

      <div class="review-stats-grid">
        <div class="stat-widget">
          <div class="stat-widget-label">Planned vs Actual Hours</div>
          <div class="stat-widget-val">${actualHours.toFixed(1)} <span style="font-size:14px;color:var(--ink-soft);">/ ${plannedHours.toFixed(1)} hrs</span></div>
          <div class="stat-widget-sub">${plannedHours > 0 ? `${Math.round((actualHours / plannedHours) * 100)}% execution efficiency` : 'No hours planned yet'}</div>
        </div>
        <div class="stat-widget">
          <div class="stat-widget-label">Tasks Completed</div>
          <div class="stat-widget-val">${completed} <span style="font-size:14px;color:var(--ink-soft);">/ ${tasks.length}</span></div>
          <div class="stat-widget-sub">${topicsDone} topics conquered</div>
        </div>
        <div class="stat-widget">
          <div class="stat-widget-label">Total XP</div>
          <div class="stat-widget-val">⚡ ${stats.xp || 0} <span style="font-size:14px;color:var(--ink-soft);">XP</span></div>
          <div class="stat-widget-sub">🔥 ${stats.streak || 0} day streak preserved</div>
        </div>
      </div>

      <!-- What Went Wrong Section -->
      <div class="card" style="margin-bottom:24px;">
        <div class="card-title" style="margin-bottom:4px;">🔍 "What Went Wrong?" Post-Mortem</div>
        <div class="card-subtitle" style="margin-bottom:16px;">Select all factors that contributed to unfinished tasks:</div>

        <div class="reasons-tags-select" id="reasons-container">
          ${reasonsList.map(r => `
            <div class="reason-chip" data-reason="${this.escapeHtml(r)}">${this.escapeHtml(r)}</div>
          `).join('')}
        </div>

        <div class="form-group" style="margin-top:16px;">
          <label class="form-label">Self-Reflection & Plan for Next Week</label>
          <textarea id="review-notes" class="form-control" placeholder="What will you do differently to ensure you finish what you start?"></textarea>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.bindWeeklyReviewEvents();
  }

  bindWeeklyReviewEvents() {
    document.querySelectorAll('.reason-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('selected');
      });
    });

    const btnSave = document.getElementById('btn-save-review');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        store.awardXP('WEEKLY_REVIEW', 30, 'review_' + Date.now(), 'Completed Weekly Review');
        this.showToast('Weekly review recorded! +30 XP awarded 📝', '🎉');
      });
    }
  }

  // --- MODALS & DIALOGS ---
  setupModals() {
    // Backdrop click to close
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });

    document.querySelectorAll('.modal-close-btn, [data-dismiss="modal"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-backdrop');
        if (modal) modal.classList.add('hidden');
      });
    });
  }

  openSubjectModal(subjectToEdit = null) {
    const modal = document.getElementById('modal-subject');
    const form = document.getElementById('form-subject');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('subject-id-input').value = subjectToEdit ? subjectToEdit.id : '';
    document.getElementById('subject-title-modal').textContent = subjectToEdit ? 'Edit Study Subject' : 'Create Study Subject';
    
    if (subjectToEdit) {
      document.getElementById('subj-name-input').value = subjectToEdit.name;
      document.getElementById('subj-desc-input').value = subjectToEdit.description || '';
      document.getElementById('subj-priority-input').value = subjectToEdit.priority || 'medium';
      document.getElementById('subj-start-input').value = subjectToEdit.startDate || '';
      document.getElementById('subj-target-input').value = subjectToEdit.targetDate || '';
      document.getElementById('subj-hours-input').value = subjectToEdit.estimatedHours || 10;
    } else {
      document.getElementById('subj-start-input').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.remove('hidden');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('subject-id-input').value;
      const data = {
        name: document.getElementById('subj-name-input').value.trim(),
        description: document.getElementById('subj-desc-input').value.trim(),
        priority: document.getElementById('subj-priority-input').value,
        startDate: document.getElementById('subj-start-input').value,
        targetDate: document.getElementById('subj-target-input').value,
        estimatedHours: document.getElementById('subj-hours-input').value
      };

      if (id) {
        await store.updateSubject(id, data);
        this.showToast('Subject updated');
      } else {
        await store.createSubject(data);
        this.showToast('New study subject created! 📚', '✨');
      }
      modal.classList.add('hidden');
    };
  }

  openTopicModal(topicToEdit = null, defaultSubjectId = '') {
    const modal = document.getElementById('modal-topic');
    const form = document.getElementById('form-topic');
    const select = document.getElementById('topic-subj-select');
    if (!modal || !form || !select) return;

    form.reset();
    const userSubjects = store.state.subjects.filter(s => s.userId === store.getCurrentUser());
    select.innerHTML = userSubjects.map(s => `<option value="${s.id}">${this.escapeHtml(s.name)}</option>`).join('');

    if (defaultSubjectId) select.value = defaultSubjectId;
    document.getElementById('topic-id-input').value = topicToEdit ? topicToEdit.id : '';
    document.getElementById('topic-title-modal').textContent = topicToEdit ? 'Edit Topic' : 'Add Study Topic';

    if (topicToEdit) {
      select.value = topicToEdit.subjectId;
      document.getElementById('topic-name-input').value = topicToEdit.name;
      document.getElementById('topic-desc-input').value = topicToEdit.description || '';
      document.getElementById('topic-hours-input').value = topicToEdit.estimatedHours || 2;
      document.getElementById('topic-priority-input').value = topicToEdit.priority || 'medium';
      document.getElementById('topic-notes-input').value = topicToEdit.notes || '';
      document.getElementById('topic-subtasks-input').value = (topicToEdit.subtasks || []).map(st => st.text).join('\n');
    }

    modal.classList.remove('hidden');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('topic-id-input').value;
      const subtasksText = document.getElementById('topic-subtasks-input').value.trim();
      const subtasks = subtasksText ? subtasksText.split('\n').filter(s => s.trim()).map(text => ({ id: Date.now() + Math.random().toString(), text: text.trim(), done: false })) : [];

      const data = {
        subjectId: select.value,
        name: document.getElementById('topic-name-input').value.trim(),
        description: document.getElementById('topic-desc-input').value.trim(),
        estimatedHours: document.getElementById('topic-hours-input').value,
        priority: document.getElementById('topic-priority-input').value,
        notes: document.getElementById('topic-notes-input').value.trim(),
        subtasks
      };

      if (id) {
        await store.updateTopic(id, data);
        this.showToast('Topic updated');
      } else {
        await store.createTopic(data);
        this.showToast('Topic added to roadmap! 📌', '✨');
      }
      modal.classList.add('hidden');
    };
  }

  openAddTaskModal(prefill = {}) {
    const modal = document.getElementById('modal-add-task');
    const form = document.getElementById('form-add-task');
    const subjSelect = document.getElementById('task-modal-subj');
    const topicSelect = document.getElementById('task-modal-topic');
    if (!modal || !form) return;

    form.reset();

    const userSubjects = store.state.subjects.filter(s => s.userId === store.getCurrentUser());
    subjSelect.innerHTML = `<option value="">-- No Subject (General Study) --</option>` +
      userSubjects.map(s => `<option value="${s.id}">${this.escapeHtml(s.name)}</option>`).join('');

    const populateTopics = (subId) => {
      if (!subId) {
        topicSelect.innerHTML = `<option value="">-- Select Subject First --</option>`;
        topicSelect.disabled = true;
        return;
      }
      const tops = store.state.topics.filter(t => t.subjectId === subId);
      topicSelect.innerHTML = `<option value="">-- No Specific Topic --</option>` +
        tops.map(t => `<option value="${t.id}">${this.escapeHtml(t.name)}</option>`).join('');
      topicSelect.disabled = false;
    };

    subjSelect.onchange = (e) => populateTopics(e.target.value);

    if (prefill.subjectId) {
      subjSelect.value = prefill.subjectId;
      populateTopics(prefill.subjectId);
      if (prefill.topicId) topicSelect.value = prefill.topicId;
    } else {
      populateTopics('');
    }

    document.getElementById('task-modal-date').value = prefill.date || this.selectedPlannerDate || new Date().toISOString().split('T')[0];

    modal.classList.remove('hidden');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const taskData = {
        title: document.getElementById('task-modal-title').value.trim(),
        subjectId: subjSelect.value,
        topicId: topicSelect.value,
        date: document.getElementById('task-modal-date').value,
        plannedDuration: document.getElementById('task-modal-duration').value,
        priority: document.getElementById('task-modal-priority').value,
        notes: document.getElementById('task-modal-notes').value.trim()
      };

      await store.createDailyTask(taskData);
      this.showToast('Study task scheduled! 🎯', '✨');
      modal.classList.add('hidden');
    };
  }

  openFocusModal() {
    const modal = document.getElementById('modal-focus');
    const form = document.getElementById('form-focus');
    const select = document.getElementById('focus-subj-select');
    const reasonGroup = document.getElementById('focus-reason-group');
    if (!modal || !form || !select) return;

    form.reset();
    const userSubjects = store.state.subjects.filter(s => s.userId === store.getCurrentUser());
    
    if (userSubjects.length === 0) {
      alert('Please create at least one study subject in the Roadmap first before selecting your focus.');
      this.switchTab('roadmap');
      return;
    }

    select.innerHTML = userSubjects.map(s => `<option value="${s.id}">${this.escapeHtml(s.name)}</option>`).join('');

    const currentFocus = store.getCurrentFocus();
    const isEarlySwitch = currentFocus && currentFocus.isLocked;

    if (isEarlySwitch) {
      reasonGroup.style.display = 'block';
    } else {
      reasonGroup.style.display = 'none';
    }

    document.getElementById('focus-start-input').value = new Date().toISOString().split('T')[0];
    const defaultEnd = new Date(Date.now() + 12 * 86400000).toISOString().split('T')[0];
    document.getElementById('focus-end-input').value = defaultEnd;

    modal.classList.remove('hidden');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const newSubjId = select.value;
      const startDate = document.getElementById('focus-start-input').value;
      const endDate = document.getElementById('focus-end-input').value;
      const reason = document.getElementById('focus-reason-select').value;
      const reasonNote = document.getElementById('focus-reason-note').value.trim();

      if (isEarlySwitch) {
        await store.switchFocusEarly(newSubjId, startDate, endDate, reason, reasonNote);
        this.showToast('Focus subject updated with recorded reason 🎯', '⚠️');
      } else {
        await store.setFocusCommitment(newSubjId, startDate, endDate);
        this.showToast('Committed to new Focus Subject! 🔒', '🎯');
      }
      modal.classList.add('hidden');
    };
  }

  openSettingsModal() {
    const modal = document.getElementById('modal-settings');
    const form = document.getElementById('form-settings');
    const btnReset = document.getElementById('btn-reset-all-data');
    if (!modal || !form) return;

    const stats = store.getUserStats();
    document.getElementById('settings-goal-input').value = stats.dailyGoalHours || 3;
    document.getElementById('settings-user-select').value = store.getCurrentUser();

    if (btnReset) {
      btnReset.onclick = async () => {
        if (confirm('Are you sure you want to reset all tracking data and streaks to 0? This cannot be undone.')) {
          await store.resetAllData();
          modal.classList.add('hidden');
          this.showToast('All streaks and data reset to 0', '🧹');
        }
      };
    }

    modal.classList.remove('hidden');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const goal = parseFloat(document.getElementById('settings-goal-input').value) || 3;
      const selectedUser = document.getElementById('settings-user-select').value;

      stats.dailyGoalHours = goal;
      await store.saveUserStats(store.getCurrentUser(), stats);

      if (selectedUser !== store.getCurrentUser()) {
        store.setCurrentUser(selectedUser);
        this.showToast(`Switched user profile to ${store.getCurrentUserName()}`);
      } else {
        this.showToast('Settings saved successfully!');
      }

      modal.classList.add('hidden');
    };
  }

  bindGlobalEvents() {
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => this.openSettingsModal());
    }
  }
}

export const app = new StudyApp();
