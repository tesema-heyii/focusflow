"use strict";

/* ============================================================
   1. DOM REFERENCES
   ============================================================ */

const taskForm = document.querySelector("#task-form");
const taskSubmitButton = document.querySelector("#task-submit-button");
const cancelEditButton = document.querySelector("#cancel-edit-button");

const taskTitleInput = document.querySelector("#task-title");
const taskDescriptionInput = document.querySelector("#task-description");
const taskCategoryInput = document.querySelector("#task-category");
const taskPriorityInput = document.querySelector("#task-priority");
const taskDeadlineInput = document.querySelector("#task-deadline");

const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector(".empty-state");
const formMessage = document.querySelector("#task-form-message");

const totalTaskCount = document.querySelector("#task-count-total");
const activeTaskCount = document.querySelector("#task-count-active");
const completedTaskCount = document.querySelector("#task-count-completed");

const filterButtons = document.querySelectorAll(".filter-button");
const taskSearchInput = document.querySelector("#task-search");
const taskSortSelect = document.querySelector("#task-sort");

/* ============================================================
   2. CONSTANTS AND APPLICATION STATE
   ============================================================ */

const STORAGE_KEY = "focusflow.tasks";

const CATEGORIES = ["study", "work", "personal", "project"];
const PRIORITIES = ["low", "medium", "high"];

const PRIORITY_RANK = {
  high: 3,
  medium: 2,
  low: 1,
};

let tasks = [];
let nextTaskId = 1;
let currentFilter = "all";
let editingTaskId = null;

/* ============================================================
   3. VALIDATION
   ============================================================ */

function validateTaskFields({
  title,
  description,
  category,
  priority,
  deadline,
}) {
  if (title.trim() === "") {
    return "Please enter a task title.";
  }

  if (title.trim().length > 120) {
    return "The title cannot exceed 120 characters.";
  }

  if (description.trim().length > 1000) {
    return "The description cannot exceed 1,000 characters.";
  }

  if (!CATEGORIES.includes(category)) {
    return "Please select a valid category.";
  }

  if (!PRIORITIES.includes(priority)) {
    return "Please select a valid priority.";
  }

  if (deadline !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      return "Please enter a valid deadline.";
    }

    const [year, month, day] = deadline.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    const validDate =
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;

    if (!validDate) {
      return "Please enter a real calendar date.";
    }
  }

  return null;
}

/* ============================================================
   4. LOAD AND SAVE TASKS
   ============================================================ */

function loadTasks() {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);

    if (storedData === null) {
      return [];
    }

    const parsedData = JSON.parse(storedData);

    if (!Array.isArray(parsedData)) {
      console.error("Saved task data is not an array.");
      return [];
    }

    const validTasks = [];
    const usedIds = new Set();

    for (const item of parsedData) {
      if (
        item === null ||
        typeof item !== "object" ||
        !Number.isSafeInteger(item.id) ||
        item.id <= 0 ||
        usedIds.has(item.id) ||
        typeof item.title !== "string"
      ) {
        continue;
      }

      const task = {
        id: item.id,
        title: item.title.trim(),
        description:
          typeof item.description === "string" ? item.description.trim() : "",
        category: CATEGORIES.includes(item.category)
          ? item.category
          : "personal",
        priority: PRIORITIES.includes(item.priority) ? item.priority : "medium",
        deadline: typeof item.deadline === "string" ? item.deadline : "",
        completed: item.completed === true,
      };

      // Ignore records that exceed the supported text limits.
      if (
        task.title === "" ||
        task.title.length > 120 ||
        task.description.length > 1000
      ) {
        continue;
      }

      // Repair an invalid deadline rather than losing the task.
      if (task.deadline !== "" && validateTaskFields(task) !== null) {
        task.deadline = "";
      }

      if (validateTaskFields(task) !== null) {
        continue;
      }

      validTasks.push(task);
      usedIds.add(task.id);
    }

    return validTasks;
  } catch (error) {
    console.error("Could not load saved tasks:", error);
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    console.error("Could not save tasks:", error);
    return false;
  }
}

function createTaskSnapshot() {
  return tasks.map((task) => ({ ...task }));
}

function persistOrRollback(previousTasks, previousNextTaskId) {
  if (saveTasks()) {
    return true;
  }

  tasks = previousTasks;
  nextTaskId = previousNextTaskId;

  renderTasks();

  formMessage.textContent =
    "Could not save changes. Your previous tasks were restored.";

  return false;
}

/* ============================================================
   5. FORM MODE
   ============================================================ */

function setEditingMode(isEditing) {
  taskSubmitButton.textContent = isEditing ? "Save changes" : "Add task";

  cancelEditButton.hidden = !isEditing;
}

function resetTaskForm() {
  editingTaskId = null;
  taskForm.reset();
  setEditingMode(false);
}

/* ============================================================
   6. FILTERING, SEARCH, AND SORTING
   ============================================================ */

function getVisibleTasks() {
  const query = taskSearchInput.value.trim().toLowerCase();

  let result = tasks.filter((task) => {
    if (currentFilter === "active" && task.completed) {
      return false;
    }

    if (currentFilter === "completed" && !task.completed) {
      return false;
    }

    const searchableText = [
      task.title,
      task.description,
      task.category,
      task.priority,
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(query);
  });

  result = [...result];

  switch (taskSortSelect.value) {
    case "title":
      result.sort((a, b) => a.title.localeCompare(b.title));
      break;

    case "priority":
      result.sort(
        (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority],
      );
      break;

    case "deadline":
      result.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;

        return a.deadline.localeCompare(b.deadline);
      });
      break;

    case "newest":
    default:
      result.sort((a, b) => b.id - a.id);
      break;
  }

  return result;
}





/* ============================================================
   DEADLINE AWARENESS
   ============================================================ */

// Return today's date in local YYYY-MM-DD format.
// Avoids UTC/time-zone errors when comparing date-only deadlines.
function getTodayDateString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Calculate the number of calendar days between two date strings.
function getDaysUntilDeadline(deadline) {
  const today = getTodayDateString();

  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const [dueYear, dueMonth, dueDay] = deadline.split("-").map(Number);

  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay);
  const deadlineUtc = Date.UTC(dueYear, dueMonth - 1, dueDay);

  return Math.round((deadlineUtc - todayUtc) / 86400000);
}

// Return a deadline label and CSS class for relevant tasks.
function getDeadlineStatus(task) {
  // Completed tasks should never display an overdue warning.
  if (task.completed || !task.deadline) {
    return null;
  }

  const daysRemaining = getDaysUntilDeadline(task.deadline);

  if (daysRemaining < 0) {
    return {
      label: "Overdue",
      className: "deadline-badge--overdue",
    };
  }

  if (daysRemaining === 0) {
    return {
      label: "Due today",
      className: "deadline-badge--today",
    };
  }

  if (daysRemaining === 1) {
    return {
      label: "Due tomorrow",
      className: "deadline-badge--tomorrow",
    };
  }

  if (daysRemaining <= 7) {
    return {
      label: "Upcoming",
      className: "deadline-badge--upcoming",
    };
  }

  return null;
}




/* ============================================================
   7. TASK ELEMENT CREATION
   ============================================================ */

function createActionButton(label, action, taskId) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = `task-action-button ${action}-button`;
  button.dataset.action = action;
  button.dataset.taskId = String(taskId);
  button.textContent = label;

  return button;
}

function createTaskElement(task) {
  const item = document.createElement("li");
  item.className = "task-item";
  item.dataset.taskId = String(task.id);

  if (task.completed) {
    item.classList.add("is-completed");
  }

  const content = document.createElement("div");
  content.className = "task-content";

  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.title;

  content.append(title);

  if (task.description) {
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description;
    content.append(description);
  }






  
  const metadata = document.createElement("p");
  metadata.className = "task-metadata";
  metadata.append(
    document.createTextNode(`${task.category} · ${task.priority} priority`),
  );

  if (task.deadline) {
    metadata.append(document.createTextNode(` · Due: ${task.deadline}`));
  }

  const deadlineStatus = getDeadlineStatus(task);

  if (deadlineStatus) {
    const badge = document.createElement("span");

    badge.className = `deadline-badge ${deadlineStatus.className}`;
    badge.textContent = deadlineStatus.label;
    badge.setAttribute(
      "aria-label",
      `Deadline status: ${deadlineStatus.label}`,
    );

    metadata.append(document.createTextNode(" "));
    metadata.append(badge);
  }

  content.append(metadata);








  const status = document.createElement("p");
  status.className = "task-status";
  status.textContent = task.completed ? "Completed" : "Active";

  content.append(status);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  actions.append(
    createActionButton(
      task.completed ? "Mark active" : "Complete",
      "toggle-complete",
      task.id,
    ),
    createActionButton("Edit", "edit", task.id),
    createActionButton("Delete", "delete", task.id),
  );

  item.append(content, actions);

  return item;
}

/* ============================================================
   8. RENDER TASKS AND COUNTERS
   ============================================================ */

function updateTaskCounts() {
  const completed = tasks.filter((task) => task.completed).length;

  totalTaskCount.textContent = String(tasks.length);
  activeTaskCount.textContent = String(tasks.length - completed);
  completedTaskCount.textContent = String(completed);
}

function renderTasks() {
  const visibleTasks = getVisibleTasks();
  const fragment = document.createDocumentFragment();

  for (const task of visibleTasks) {
    fragment.append(createTaskElement(task));
  }

  taskList.replaceChildren(fragment);

  // The empty message disappears as soon as visible tasks exist.
  emptyState.hidden = visibleTasks.length > 0;

  if (visibleTasks.length === 0) {
    const heading = emptyState.querySelector("h3");
    const paragraph = emptyState.querySelector("p");

    if (taskSearchInput.value.trim() !== "") {
      heading.textContent = "No matching tasks";
      paragraph.textContent = "Try a different search term.";
    } else if (currentFilter === "active") {
      heading.textContent = "No active tasks";
      paragraph.textContent = "All your tasks are completed.";
    } else if (currentFilter === "completed") {
      heading.textContent = "No completed tasks";
      paragraph.textContent = "Completed tasks will appear here.";
    } else {
      heading.textContent = "No tasks to display";
      paragraph.textContent =
        "Your tasks will appear here once you create your first task.";
    }
  }

  updateTaskCounts();
}

/* ============================================================
   9. ADD AND EDIT TASKS
   ============================================================ */

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = taskTitleInput.value.trim();
  const description = taskDescriptionInput.value.trim();
  const category = taskCategoryInput.value;
  const priority = taskPriorityInput.value;
  const deadline = taskDeadlineInput.value;

  const validationError = validateTaskFields({
    title,
    description,
    category,
    priority,
    deadline,
  });

  if (validationError !== null) {
    formMessage.textContent = validationError;
    return;
  }

  const previousTasks = createTaskSnapshot();
  const previousNextTaskId = nextTaskId;

  let successMessage;

  if (editingTaskId !== null) {
    const task = tasks.find((item) => item.id === editingTaskId);

    if (!task) {
      resetTaskForm();
      formMessage.textContent = "This task no longer exists. Please try again.";
      return;
    }

    task.title = title;
    task.description = description;
    task.category = category;
    task.priority = priority;
    task.deadline = deadline;

    successMessage = "Task updated successfully.";
  } else {
    tasks.push({
      id: nextTaskId,
      title,
      description,
      category,
      priority,
      deadline,
      completed: false,
    });

    nextTaskId += 1;
    successMessage = "Task added successfully.";
  }

  if (!persistOrRollback(previousTasks, previousNextTaskId)) {
    return;
  }

  resetTaskForm();
  renderTasks();

  formMessage.textContent = successMessage;
});

/* ============================================================
   10. COMPLETE, EDIT, AND DELETE TASKS
   ============================================================ */

taskList.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest("button[data-action]");

  if (!button || !taskList.contains(button)) {
    return;
  }

  const taskId = Number(button.dataset.taskId);
  const action = button.dataset.action;

  const task = tasks.find((item) => item.id === taskId);

  if (!task) {
    return;
  }

  // Editing only fills the form; it does not save changes yet.
  if (action === "edit") {
    editingTaskId = task.id;

    taskTitleInput.value = task.title;
    taskDescriptionInput.value = task.description;
    taskCategoryInput.value = task.category;
    taskPriorityInput.value = task.priority;
    taskDeadlineInput.value = task.deadline;

    setEditingMode(true);

    formMessage.textContent = `Editing task: ${task.title}`;
    taskTitleInput.focus();

    return;
  }

  if (action !== "toggle-complete" && action !== "delete") {
    return;
  }

  const previousTasks = createTaskSnapshot();
  const previousNextTaskId = nextTaskId;

  if (action === "toggle-complete") {
    task.completed = !task.completed;
  } else {
    tasks = tasks.filter((item) => item.id !== taskId);
  }

  if (!persistOrRollback(previousTasks, previousNextTaskId)) {
    return;
  }

  if (action === "delete" && editingTaskId === taskId) {
    resetTaskForm();
  }

  renderTasks();

  formMessage.textContent =
    action === "delete" ? "Task deleted successfully." : "Task status updated.";
});

/* ============================================================
   11. STATUS FILTERS
   ============================================================ */

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;

    if (!["all", "active", "completed"].includes(filter)) {
      return;
    }

    currentFilter = filter;

    filterButtons.forEach((item) => {
      item.setAttribute(
        "aria-pressed",
        String(item.dataset.filter === currentFilter),
      );
    });

    renderTasks();
  });
});

/* ============================================================
   12. SEARCH AND SORT
   ============================================================ */

taskSearchInput.addEventListener("input", renderTasks);
taskSortSelect.addEventListener("change", renderTasks);

/* ============================================================
   13. CANCEL EDITING
   ============================================================ */

cancelEditButton.addEventListener("click", () => {
  resetTaskForm();
  formMessage.textContent = "Editing cancelled.";
});

/* ============================================================
   14. INITIALIZATION
   ============================================================ */

try {
  tasks = loadTasks();

  nextTaskId = tasks.reduce((maxId, task) => Math.max(maxId, task.id), 0) + 1;

  renderTasks();
  setEditingMode(false);
} catch (error) {
  console.error("FocusFlow could not initialize:", error);

  formMessage.textContent =
    "FocusFlow could not initialize correctly. Check the browser console.";
}




/* =========================================
   FocusFlow — Light and dark theme switcher
   Add this block at the end of js/main.js
   ========================================= */

(() => {
  "use strict";

  const THEME_STORAGE_KEY = "focusflow.theme";

  const themeToggle = document.querySelector("#theme-toggle");
  const themeIcon = document.querySelector("#theme-toggle-icon");
  const themeLabel = document.querySelector("#theme-toggle-label");

  // If the theme button is absent, do not interfere with task management.
  if (!themeToggle || !themeIcon || !themeLabel) {
    return;
  }

  function readSavedTheme() {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

      if (savedTheme === "light" || savedTheme === "dark") {
        return savedTheme;
      }
    } catch (error) {
      console.warn("FocusFlow could not read the saved theme.", error);
    }

    return "light";
  }

  function applyTheme(theme) {
    const selectedTheme = theme === "dark" ? "dark" : "light";
    const isDark = selectedTheme === "dark";

    document.documentElement.dataset.theme = selectedTheme;

    themeIcon.textContent = isDark ? "☀" : "☾";
    themeLabel.textContent = isDark ? "Light mode" : "Dark mode";

    themeToggle.setAttribute(
      "aria-label",
      isDark ? "Switch to light theme" : "Switch to dark theme"
    );

    themeToggle.setAttribute("aria-pressed", String(isDark));
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn("FocusFlow could not save the theme preference.", error);
    }
  }

  // Restore the saved theme when the page loads.
  applyTheme(readSavedTheme());

  // Switch themes when the user clicks the button.
  themeToggle.addEventListener("click", () => {
    const currentTheme =
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";

    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    applyTheme(nextTheme);
    saveTheme(nextTheme);
  });
})();
