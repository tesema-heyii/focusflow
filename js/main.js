/*
 * ============================================================
 * FocusFlow — Task Management Application
 * ============================================================
 *
 * Current scope:
 * - Create, edit, complete, and delete tasks.
 * - Validate and normalize task titles and descriptions.
 * - Persist tasks using localStorage.
 * - Recover gracefully from invalid stored data.
 * - Search, filter, and sort tasks.
 * - Display task summary counts.
 * - Restore in-memory data if a persistence operation fails.
 *
 * Dependencies:
 * - index.html with the element IDs referenced below.
 * - No external libraries or frameworks.
 *
 * Current validation scope:
 * - Reject empty or whitespace-only titles.
 * - Trim leading and trailing whitespace from titles
 *   and descriptions.
 *
 * Future scope:
 * - Validate category, priority, and deadline values.
 * ============================================================
 */

/* ============================================================
   1. DOM REFERENCES
   ============================================================ */

// Task form and editing controls.
const taskForm = document.querySelector("#task-form");
const taskSubmitButton = document.querySelector("#task-submit-button");
const cancelEditButton = document.querySelector("#cancel-edit-button");

// Task form fields.
const taskTitleInput = document.querySelector("#task-title");
const taskDescriptionInput = document.querySelector("#task-description");
const taskCategoryInput = document.querySelector("#task-category");
const taskPriorityInput = document.querySelector("#task-priority");
const taskDeadlineInput = document.querySelector("#task-deadline");

// Task list and feedback.
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector(".empty-state");
const formMessage = document.querySelector("#task-form-message");

// Summary counters.
const totalTaskCount = document.querySelector("#task-count-total");
const activeTaskCount = document.querySelector("#task-count-active");
const completedTaskCount = document.querySelector("#task-count-completed");

// Search, filtering, and sorting controls.
const filterButtons = document.querySelectorAll(".filter-button");
const taskSearchInput = document.querySelector("#task-search");
const taskSortSelect = document.querySelector("#task-sort");

/* ============================================================
   2. APPLICATION STATE
   ============================================================ */

const STORAGE_KEY = "focusflow.tasks";

// The currently selected status filter.
let currentFilter = "all";

// The ID of the task being edited, or null when creating a task.
let editingTaskId = null;

/* ============================================================
   3. FORM MODE MANAGEMENT
   ============================================================ */

/**
 * Synchronizes the form controls with the current editing mode.
 *
 * @param {boolean} isEditing - Whether an existing task is edited.
 */
function setEditingMode(isEditing) {
  taskSubmitButton.textContent = isEditing ? "Save Changes" : "Add task";

  cancelEditButton.hidden = !isEditing;
}

/**
 * Clears the form and exits editing mode.
 */
function resetTaskForm() {
  editingTaskId = null;
  taskForm.reset();
  setEditingMode(false);
}

/* ============================================================
   4. PERSISTENCE
   ============================================================ */

/**
 * Loads tasks from localStorage.
 *
 * Invalid JSON, an unexpected data structure, or invalid records
 * are handled without crashing the application.
 *
 * @returns {Array<Object>} The valid tasks that were recovered.
 */
function loadTasks() {
  try {
    const savedTasks = localStorage.getItem(STORAGE_KEY);

    if (savedTasks === null) {
      return [];
    }

    const parsedTasks = JSON.parse(savedTasks);

    if (!Array.isArray(parsedTasks)) {
      console.error("FocusFlow storage does not contain a task array.");

      return [];
    }

    return parsedTasks
      .filter(function (task) {
        return (
          task !== null &&
          typeof task === "object" &&
          Number.isSafeInteger(task.id) &&
          task.id > 0 &&
          typeof task.title === "string"
        );
      })
      .map(function (task) {
        return {
          id: task.id,
          title: task.title,
          description:
            typeof task.description === "string" ? task.description : "",
          category:
            typeof task.category === "string" ? task.category : "personal",
          priority:
            typeof task.priority === "string" ? task.priority : "medium",
          deadline: typeof task.deadline === "string" ? task.deadline : "",
          completed: task.completed === true,
        };
      });
  } catch (error) {
    console.error("Could not load FocusFlow tasks:", error);

    return [];
  }
}

/**
 * Saves the current task array to localStorage.
 *
 * @returns {boolean} True if persistence succeeded.
 */
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));

    return true;
  } catch (error) {
    console.error("Could not save FocusFlow tasks:", error);

    return false;
  }
}

/**
 * Creates a shallow copy of every task object.
 *
 * Current task properties are primitive values, so shallow
 * copies are sufficient to restore the previous task state.
 *
 * @returns {Array<Object>} A snapshot of the current tasks.
 */
function createTaskSnapshot() {
  return tasks.map(function (task) {
    return { ...task };
  });
}

// Load persisted tasks when the application starts.
let tasks = loadTasks();

// Generate the next ID without reusing an existing ID.
let nextTaskId =
  tasks.reduce(function (largestId, task) {
    return Math.max(largestId, task.id);
  }, 0) + 1;

/* ============================================================
   5. TASK SUMMARY COUNTS
   ============================================================ */

/**
 * Updates the total, active, and completed task counters.
 */
function updateTaskCounts() {
  const total = tasks.length;

  const completed = tasks.filter(function (task) {
    return task.completed;
  }).length;

  const active = total - completed;

  totalTaskCount.textContent = String(total);
  activeTaskCount.textContent = String(active);
  completedTaskCount.textContent = String(completed);
}

/* ============================================================
   6. SEARCH, FILTERING, AND SORTING
   ============================================================ */

/**
 * Returns tasks matching the selected filter and search query,
 * sorted according to the current sorting option.
 *
 * The original tasks array is never sorted directly.
 *
 * @returns {Array<Object>} The visible tasks.
 */
function getVisibleTasks() {
  // Step 1: Apply the selected status filter.
  let visibleTasks = tasks.filter(function (task) {
    if (currentFilter === "active") {
      return !task.completed;
    }

    if (currentFilter === "completed") {
      return task.completed;
    }

    return true;
  });

  // Step 2: Search task titles and descriptions.
  const query = taskSearchInput.value.trim().toLowerCase();

  if (query !== "") {
    visibleTasks = visibleTasks.filter(function (task) {
      return (
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query)
      );
    });
  }

  // Step 3: Copy the array before sorting.
  visibleTasks = [...visibleTasks];

  // Define the relative rank of each priority.
  const priorityRank = {
    high: 3,
    medium: 2,
    low: 1,
  };

  // Step 4: Apply the selected sorting option.
  if (taskSortSelect.value === "title") {
    visibleTasks.sort(function (a, b) {
      return a.title.localeCompare(b.title);
    });
  } else if (taskSortSelect.value === "priority") {
    visibleTasks.sort(function (a, b) {
      return (priorityRank[b.priority] ?? 0) - (priorityRank[a.priority] ?? 0);
    });
  } else if (taskSortSelect.value === "deadline") {
    visibleTasks.sort(function (a, b) {
      // Tasks without deadlines appear after dated tasks.
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;

      // ISO-formatted date strings can be compared directly.
      return a.deadline.localeCompare(b.deadline);
    });
  } else {
    // Default: newest tasks first.
    visibleTasks.sort(function (a, b) {
      return b.id - a.id;
    });
  }

  return visibleTasks;
}

/* ============================================================
   7. TASK RENDERING
   ============================================================ */

/**
 * Creates a task action button.
 *
 * @param {string} label - The visible button label.
 * @param {string} action - The delegated action identifier.
 * @param {number} taskId - The associated task ID.
 * @returns {HTMLButtonElement} The created button.
 */
function createTaskButton(label, action, taskId) {
  const button = document.createElement("button");

  button.type = "button";
  button.dataset.action = action;
  button.dataset.taskId = String(taskId);
  button.textContent = label;

  return button;
}

/**
 * Renders visible tasks and refreshes the summary counters.
 */
function renderTasks() {
  // Remove the previously rendered task elements.
  taskList.replaceChildren();

  const visibleTasks = getVisibleTasks();

  for (const task of visibleTasks) {
    const taskItem = document.createElement("li");

    taskItem.classList.toggle("is-completed", task.completed);

    // Task title.
    const title = document.createElement("h3");
    title.textContent = task.title;

    taskItem.append(title);

    // Category, priority, and optional deadline.
    const details = document.createElement("p");

    details.textContent = `${task.category} · ${task.priority} priority`;

    if (task.deadline) {
      details.textContent += ` · Due: ${task.deadline}`;
    }

    taskItem.append(details);

    // Optional description.
    if (task.description) {
      const description = document.createElement("p");

      description.textContent = task.description;

      taskItem.append(description);
    }

    // Completion status.
    const status = document.createElement("p");

    status.textContent = task.completed ? "Completed" : "Not completed";

    taskItem.append(status);

    // Completion control.
    const completeButton = createTaskButton(
      task.completed ? "Mark as not completed" : "Mark as completed",
      "toggle-complete",
      task.id,
    );

    taskItem.append(completeButton);

    // Editing control.
    const editButton = createTaskButton("Edit", "edit", task.id);

    taskItem.append(editButton);

    // Deletion control.
    const deleteButton = createTaskButton("Delete", "delete", task.id);

    taskItem.append(deleteButton);

    taskList.append(taskItem);
  }

  // Show the empty state when no tasks match the current view.
  emptyState.hidden = visibleTasks.length > 0;

  // Summary counts always reflect all tasks, not just visible ones.
  updateTaskCounts();
}

/* ============================================================
   8. CREATE AND EDIT TASKS
   ============================================================ */

taskForm.addEventListener("submit", function (event) {
  event.preventDefault();

  // Normalize the title and reject blank input.
  const title = taskTitleInput.value.trim();

  if (title === "") {
    formMessage.textContent = "Please enter a task title.";

    taskTitleInput.focus();

    return;
  }

  // Capture the previous state in case persistence fails.
  const previousTasks = createTaskSnapshot();
  const previousNextTaskId = nextTaskId;

  let successMessage;

  if (editingTaskId !== null) {
    // EDIT MODE: find the existing task.
    const existingTask = tasks.find(function (task) {
      return task.id === editingTaskId;
    });

    if (!existingTask) {
      editingTaskId = null;
      setEditingMode(false);

      formMessage.textContent =
        "This task no longer exists. Please select a task to edit again.";

      return;
    }

    // Update editable fields while preserving the task ID
    // and its current completion status.
    existingTask.title = title;
    existingTask.description = taskDescriptionInput.value.trim();
    existingTask.category = taskCategoryInput.value;
    existingTask.priority = taskPriorityInput.value;
    existingTask.deadline = taskDeadlineInput.value;

    successMessage = "Task updated successfully.";
  } else {
    // CREATE MODE: construct a new task.
    const task = {
      id: nextTaskId,
      title: title,
      description: taskDescriptionInput.value.trim(),
      category: taskCategoryInput.value,
      priority: taskPriorityInput.value,
      deadline: taskDeadlineInput.value,
      completed: false,
    };

    tasks.push(task);

    nextTaskId += 1;

    successMessage = "Task added successfully.";
  }

  // Attempt to persist the changes.
  const saved = saveTasks();

  if (!saved) {
    // Restore the previous state if persistence fails.
    tasks = previousTasks;
    nextTaskId = previousNextTaskId;

    renderTasks();

    formMessage.textContent =
      "Changes could not be saved. Your previous task data has been restored.";

    return;
  }

  // Exit editing mode only after a successful save.
  resetTaskForm();

  renderTasks();

  formMessage.textContent = successMessage;
});

/* ============================================================
   9. TASK LIST ACTIONS
   ============================================================ */

/*
 * Event delegation allows one listener to handle the Edit,
 * completion, and Delete buttons for every rendered task.
 *
 * This remains effective when renderTasks() rebuilds the list.
 */

taskList.addEventListener("click", function (event) {
  // Ignore events that do not originate from an element.
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest("button[data-action]");

  if (!button || !taskList.contains(button)) {
    return;
  }

  const taskId = Number(button.dataset.taskId);
  const action = button.dataset.action;

  // EDIT: load the selected task into the form.
  // Editing does not modify or persist the task yet.
  if (action === "edit") {
    const task = tasks.find(function (item) {
      return item.id === taskId;
    });

    if (!task) {
      return;
    }

    editingTaskId = task.id;

    setEditingMode(true);

    taskTitleInput.value = task.title;
    taskDescriptionInput.value = task.description;
    taskCategoryInput.value = task.category;
    taskPriorityInput.value = task.priority;
    taskDeadlineInput.value = task.deadline;

    formMessage.textContent = "Editing task: " + task.title;

    taskTitleInput.focus();

    return;
  }

  // Ignore unsupported actions.
  if (action !== "toggle-complete" && action !== "delete") {
    return;
  }

  // Preserve the previous data before modifying it.
  const previousTasks = createTaskSnapshot();

  if (action === "toggle-complete") {
    const task = tasks.find(function (item) {
      return item.id === taskId;
    });

    if (!task) {
      return;
    }

    task.completed = !task.completed;
  }

  if (action === "delete") {
    const taskExists = tasks.some(function (item) {
      return item.id === taskId;
    });

    if (!taskExists) {
      return;
    }

    tasks = tasks.filter(function (item) {
      return item.id !== taskId;
    });
  }

  // Persist the completion or deletion change.
  const saved = saveTasks();

  if (!saved) {
    // Roll back if the change could not be persisted.
    tasks = previousTasks;

    renderTasks();

    formMessage.textContent =
      "Changes could not be saved. Your previous task data has been restored.";

    return;
  }

  // If the task currently being edited was deleted,
  // clear the form only after deletion succeeds.
  if (action === "delete" && editingTaskId === taskId) {
    resetTaskForm();

    formMessage.textContent = "Editing cancelled because the task was deleted.";
  } else if (action === "delete") {
    formMessage.textContent = "Task deleted successfully.";
  } else {
    formMessage.textContent = "Task status updated.";
  }

  renderTasks();
});

/* ============================================================
   10. STATUS FILTERS
   ============================================================ */

filterButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    const selectedFilter = button.dataset.filter;

    // Accept only the supported filter values.
    if (!["all", "active", "completed"].includes(selectedFilter)) {
      return;
    }

    currentFilter = selectedFilter;

    // Keep accessible pressed states synchronized.
    filterButtons.forEach(function (filterButton) {
      const isSelected = filterButton.dataset.filter === currentFilter;

      filterButton.setAttribute("aria-pressed", String(isSelected));
    });

    renderTasks();
  });
});

/* ============================================================
   11. SEARCH
   ============================================================ */

// Register the search listener once.
taskSearchInput.addEventListener("input", function () {
  renderTasks();
});

/* ============================================================
   12. SORTING
   ============================================================ */

// Register the sorting listener once.
taskSortSelect.addEventListener("change", function () {
  renderTasks();
});

/* ============================================================
   13. CANCEL EDITING
   ============================================================ */

cancelEditButton.addEventListener("click", function () {
  // Discard unsaved form changes without modifying the task.
  resetTaskForm();

  formMessage.textContent = "Editing cancelled.";
});

/* ============================================================
   14. INITIALIZATION
   ============================================================ */

// Render saved tasks and initialize the summary counters.
renderTasks();

// Initialize the form's default state.
setEditingMode(false);

// Initialize accessible filter states.
filterButtons.forEach(function (button) {
  button.setAttribute(
    "aria-pressed",
    String(button.dataset.filter === currentFilter),
  );
});
