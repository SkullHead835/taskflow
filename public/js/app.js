/**
 * TaskFlow - Client Application
 * Pure Vanilla JavaScript - No external dependencies
 */

(function () {
  'use strict';

  // ==========================================================================
  // Application State
  // ==========================================================================
  const state = {
    currentFilter: 'all', // 'all' | 'pending' | 'completed'
    tasks: [],
    isLoading: false,
    notificationTimeout: null
  };

  // ==========================================================================
  // DOM Element References
  // ==========================================================================
  const elements = {
    taskCountBadge: document.getElementById('taskCountBadge'),
    notificationBanner: document.getElementById('notificationBanner'),
    notificationMessage: document.getElementById('notificationMessage'),
    notificationCloseBtn: document.getElementById('notificationCloseBtn'),
    createTaskForm: document.getElementById('createTaskForm'),
    taskTitleInput: document.getElementById('taskTitleInput'),
    taskDescInput: document.getElementById('taskDescInput'),
    addTaskBtn: document.getElementById('addTaskBtn'),
    filterButtons: document.querySelectorAll('.filter-btn'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    emptyState: document.getElementById('emptyState'),
    emptyFilterState: document.getElementById('emptyFilterState'),
    taskList: document.getElementById('taskList')
  };

  // ==========================================================================
  // API Helpers
  // ==========================================================================

  /**
   * Performs an HTTP request to the TaskFlow API.
   *
   * @param {string} endpoint
   * @param {object} [options={}]
   * @returns {Promise<any>}
   */
  async function apiRequest(endpoint, options = {}) {
    const defaultHeaders = {
      Accept: 'application/json'
    };

    if (options.body && typeof options.body === 'string') {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    let response;
    try {
      response = await fetch(endpoint, config);
    } catch {
      throw new Error('Unable to connect to the server. Please check your connection.');
    }

    const result = await response.json();

    if (!response.ok || !result.success) {
      const errorMessage =
        result && result.error && result.error.message
          ? result.error.message
          : `Request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    return result.data;
  }

  // ==========================================================================
  // Notification Feedback
  // ==========================================================================

  /**
   * Displays a visible notification banner.
   *
   * @param {string} message
   * @param {'success'|'error'} [type='success']
   */
  function showNotification(message, type = 'success') {
    if (state.notificationTimeout) {
      clearTimeout(state.notificationTimeout);
      state.notificationTimeout = null;
    }

    elements.notificationMessage.textContent = message;
    elements.notificationBanner.className = `notification-banner ${type}`;

    state.notificationTimeout = setTimeout(() => {
      hideNotification();
    }, 4500);
  }

  /**
   * Hides the notification banner.
   */
  function hideNotification() {
    elements.notificationBanner.className = 'notification-banner hidden';
    elements.notificationMessage.textContent = '';
  }

  // ==========================================================================
  // Task Count Summary
  // ==========================================================================

  /**
   * Updates the visual indicator of task count in the header based on active filter.
   *
   * @param {number} count
   */
  function updateTaskCount(count) {
    let label = '';
    if (state.currentFilter === 'pending') {
      label = count === 1 ? '1 pending' : `${count} pending`;
    } else if (state.currentFilter === 'completed') {
      label = count === 1 ? '1 completed' : `${count} completed`;
    } else {
      label = count === 1 ? '1 task' : `${count} tasks`;
    }
    elements.taskCountBadge.textContent = label;
  }

  // ==========================================================================
  // UI State Handling
  // ==========================================================================

  /**
   * Sets UI loading state.
   *
   * @param {boolean} loading
   */
  function setLoading(loading) {
    state.isLoading = loading;
    if (loading) {
      elements.loadingIndicator.classList.remove('hidden');
      elements.emptyState.classList.add('hidden');
      elements.emptyFilterState.classList.add('hidden');
      elements.taskList.classList.add('hidden');
    } else {
      elements.loadingIndicator.classList.add('hidden');
      elements.taskList.classList.remove('hidden');
    }
  }

  /**
   * Renders empty state placeholders if no tasks match.
   */
  function renderEmptyStates() {
    if (state.tasks.length === 0) {
      elements.taskList.classList.add('hidden');
      if (state.currentFilter === 'all') {
        elements.emptyState.classList.remove('hidden');
        elements.emptyFilterState.classList.add('hidden');
      } else {
        elements.emptyState.classList.add('hidden');
        elements.emptyFilterState.classList.remove('hidden');
      }
    } else {
      elements.emptyState.classList.add('hidden');
      elements.emptyFilterState.classList.add('hidden');
      elements.taskList.classList.remove('hidden');
    }
  }

  // ==========================================================================
  // Task Rendering (Safe DOM Construction - No unsafe innerHTML)
  // ==========================================================================

  /**
   * Builds a safe DOM node for a single task.
   *
   * @param {object} task
   * @returns {HTMLElement}
   */
  function createTaskElement(task) {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''}`;
    li.dataset.taskId = String(task.id);

    // 1. Checkbox container
    const checkContainer = document.createElement('div');
    checkContainer.className = 'task-checkbox-container';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = Boolean(task.completed);
    checkbox.setAttribute('aria-label', `Mark task "${task.title}" as ${task.completed ? 'pending' : 'completed'}`);

    checkbox.addEventListener('change', async () => {
      checkbox.disabled = true;
      try {
        await toggleTaskCompletion(task.id, checkbox.checked);
      } catch (err) {
        checkbox.checked = !checkbox.checked; // Revert checkbox on error
        showNotification(err.message, 'error');
      } finally {
        checkbox.disabled = false;
      }
    });

    checkContainer.appendChild(checkbox);

    // 2. Content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'task-content';

    const titleDiv = document.createElement('h3');
    titleDiv.className = 'task-title';
    titleDiv.textContent = task.title;

    contentContainer.appendChild(titleDiv);

    if (task.description) {
      const descDiv = document.createElement('p');
      descDiv.className = 'task-description';
      descDiv.textContent = task.description;
      contentContainer.appendChild(descDiv);
    }

    const metaDiv = document.createElement('div');
    metaDiv.className = 'task-meta';

    if (task.category && task.category.name) {
      const categoryBadge = document.createElement('span');
      categoryBadge.className = 'category-badge';
      categoryBadge.textContent = task.category.name;
      if (task.category.color) {
        categoryBadge.style.backgroundColor = `${task.category.color}22`;
        categoryBadge.style.color = task.category.color;
        categoryBadge.style.borderColor = task.category.color;
      }
      metaDiv.appendChild(categoryBadge);
    }

    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge ${task.completed ? 'completed' : 'pending'}`;
    statusBadge.textContent = task.completed ? 'Completed' : 'Pending';

    metaDiv.appendChild(statusBadge);
    contentContainer.appendChild(metaDiv);

    // 3. Actions container
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-icon edit';
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('aria-label', `Edit task "${task.title}"`);
    editBtn.addEventListener('click', () => {
      enterInlineEditMode(li, task);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-icon delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete task "${task.title}"`);
    deleteBtn.addEventListener('click', () => {
      handleDeleteTask(task.id, task.title, deleteBtn);
    });

    actionsContainer.appendChild(editBtn);
    actionsContainer.appendChild(deleteBtn);

    // Assemble task item
    li.appendChild(checkContainer);
    li.appendChild(contentContainer);
    li.appendChild(actionsContainer);

    return li;
  }

  /**
   * Replaces task card content with an accessible inline edit form.
   *
   * @param {HTMLElement} itemElement
   * @param {object} task
   */
  function enterInlineEditMode(itemElement, task) {
    // Clear current task element contents
    while (itemElement.firstChild) {
      itemElement.removeChild(itemElement.firstChild);
    }

    const form = document.createElement('form');
    form.className = 'edit-form';

    // Title input
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'edit-input';
    titleInput.value = task.title;
    titleInput.maxLength = 120;
    titleInput.required = true;
    titleInput.setAttribute('aria-label', 'Edit task title');

    // Description textarea
    const descInput = document.createElement('textarea');
    descInput.className = 'edit-textarea';
    descInput.rows = 2;
    descInput.maxLength = 1000;
    descInput.value = task.description || '';
    descInput.placeholder = 'Description (optional)';
    descInput.setAttribute('aria-label', 'Edit task description');

    // Buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'edit-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary btn-sm';
    cancelBtn.textContent = 'Cancel';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn btn-primary btn-sm';
    saveBtn.textContent = 'Save';

    actionsDiv.appendChild(cancelBtn);
    actionsDiv.appendChild(saveBtn);

    form.appendChild(titleInput);
    form.appendChild(descInput);
    form.appendChild(actionsDiv);
    itemElement.appendChild(form);

    titleInput.focus();

    // Cancel edit handler
    cancelBtn.addEventListener('click', () => {
      renderTaskList();
    });

    // Save edit handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newTitle = titleInput.value.trim();

      if (!newTitle) {
        showNotification('Task title cannot be empty.', 'error');
        titleInput.focus();
        return;
      }

      saveBtn.disabled = true;
      cancelBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        const updated = await apiRequest(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: newTitle,
            description: descInput.value.trim() || null
          })
        });

        // Update task in state and re-render
        const index = state.tasks.findIndex((t) => t.id === task.id);
        if (index !== -1) {
          state.tasks[index] = updated;
        }

        renderTaskList();
        showNotification('Task updated successfully.');
      } catch (err) {
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
        saveBtn.textContent = 'Save';
        showNotification(err.message, 'error');
      }
    });
  }

  /**
   * Clears and renders all tasks from current state into the task list.
   */
  function renderTaskList() {
    // Clear list safely
    while (elements.taskList.firstChild) {
      elements.taskList.removeChild(elements.taskList.firstChild);
    }

    state.tasks.forEach((task) => {
      const taskNode = createTaskElement(task);
      elements.taskList.appendChild(taskNode);
    });

    renderEmptyStates();
    updateTaskCount(state.tasks.length);
  }

  // ==========================================================================
  // Data Operations (CRUD & Filters)
  // ==========================================================================

  /**
   * Fetches tasks from the backend API using the active filter.
   */
  async function loadTasks() {
    setLoading(true);

    try {
      let endpoint = '/api/tasks';
      if (state.currentFilter === 'pending') {
        endpoint = '/api/tasks?completed=false';
      } else if (state.currentFilter === 'completed') {
        endpoint = '/api/tasks?completed=true';
      }

      const tasks = await apiRequest(endpoint);
      state.tasks = Array.isArray(tasks) ? tasks : [];
      renderTaskList();
    } catch (err) {
      showNotification(err.message, 'error');
      state.tasks = [];
      renderTaskList();
    } finally {
      setLoading(false);
    }
  }

  /**
   * Toggles task completion state.
   *
   * @param {number} taskId
   * @param {boolean} completed
   */
  async function toggleTaskCompletion(taskId, completed) {
    const updated = await apiRequest(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed })
    });

    // If currently filtering, reload list to respect filter; otherwise update in place
    if (state.currentFilter !== 'all') {
      await loadTasks();
    } else {
      const index = state.tasks.findIndex((t) => t.id === taskId);
      if (index !== -1) {
        state.tasks[index] = updated;
        renderTaskList();
      }
    }

    showNotification(
      completed ? 'Task marked as completed.' : 'Task reopened as pending.'
    );
  }

  /**
   * Deletes a task after confirmation.
   *
   * @param {number} taskId
   * @param {string} taskTitle
   * @param {HTMLButtonElement} buttonElement
   */
  async function handleDeleteTask(taskId, taskTitle, buttonElement) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${taskTitle}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    buttonElement.disabled = true;

    try {
      await apiRequest(`/api/tasks/${taskId}`, {
        method: 'DELETE'
      });

      state.tasks = state.tasks.filter((t) => t.id !== taskId);
      renderTaskList();
      showNotification('Task deleted successfully.');
    } catch (err) {
      buttonElement.disabled = false;
      showNotification(err.message, 'error');
    }
  }

  /**
   * Handles task creation submission.
   *
   * @param {Event} e
   */
  async function handleCreateTask(e) {
    e.preventDefault();

    const title = elements.taskTitleInput.value.trim();
    const description = elements.taskDescInput.value.trim();

    if (!title) {
      showNotification('Task title is required.', 'error');
      elements.taskTitleInput.focus();
      return;
    }

    elements.addTaskBtn.disabled = true;
    const btnText = elements.addTaskBtn.querySelector('.btn-text');
    if (btnText) btnText.textContent = 'Adding Task...';

    try {
      await apiRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: description || undefined
        })
      });

      elements.createTaskForm.reset();
      showNotification('Task created successfully!');
      await loadTasks();
      elements.taskTitleInput.focus();
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      elements.addTaskBtn.disabled = false;
      if (btnText) btnText.textContent = 'Add Task';
    }
  }

  // ==========================================================================
  // Client-Side Routing (Hash-Based)
  // ==========================================================================

  const VALID_ROUTES = ['all', 'pending', 'completed'];

  /**
   * Parses current URL hash route and returns a valid filter name.
   *
   * @returns {'all'|'pending'|'completed'}
   */
  function getRouteFromHash() {
    const raw = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
    return VALID_ROUTES.includes(raw) ? raw : 'all';
  }

  /**
   * Synchronizes active route with UI filter buttons and reloads tasks.
   */
  function handleRoute() {
    const route = getRouteFromHash();

    if (window.location.hash !== `#/${route}`) {
      window.location.hash = `#/${route}`;
    }

    state.currentFilter = route;

    elements.filterButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.filter === route);
    });

    loadTasks();
  }

  /**
   * Handles filter button clicks by navigating hash route.
   *
   * @param {Event} e
   */
  function handleFilterClick(e) {
    const target = e.target.closest('.filter-btn');
    if (!target) return;

    const filter = target.dataset.filter;
    if (filter && VALID_ROUTES.includes(filter)) {
      window.location.hash = `#/${filter}`;
    }
  }

  // ==========================================================================
  // Event Listeners & Initialization
  // ==========================================================================
  function init() {
    elements.createTaskForm.addEventListener('submit', handleCreateTask);

    elements.filterButtons.forEach((btn) => {
      btn.addEventListener('click', handleFilterClick);
    });

    elements.notificationCloseBtn.addEventListener('click', hideNotification);

    // Client-side router: listen for hash changes (back/forward navigation)
    window.addEventListener('hashchange', handleRoute);

    // Initial route handling
    handleRoute();
  }

  // Boot on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
