const taskForm = document.querySelector("#task-form");

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

const STORAGE_KEY = "focusflow.tasks";

let currentFilter = "all";
function loadTasks() {
  try {
    const savedTasks = localStorage.getItem(STORAGE_KEY);

    if (savedTasks === null) {
      return [];
    }

    const parsedTasks = JSON.parse(savedTasks);

    if (!Array.isArray(parsedTasks)) {
      return [];
    }

    return parsedTasks
      .filter(
        (task) =>
          task &&
          typeof task === "object" &&
          Number.isInteger(task.id) &&
          typeof task.title === "string",
      )
      .map((task) => ({
        id: task.id,
        title: task.title,
        description:
          typeof task.description === "string" ? task.description : "",
        category:
          typeof task.category === "string" ? task.category : "personal",
        priority: typeof task.priority === "string" ? task.priority : "medium",
        deadline: typeof task.deadline === "string" ? task.deadline : "",
        completed: task.completed === true,
      }));
  } catch (error) {
    console.error("Could not load FocusFlow tasks:", error);
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    console.error("Could not save FocusFlow tasks:", error);
    return false;
  }
}

let tasks = loadTasks();

let nextTaskId =
  tasks.reduce((largestId, task) => Math.max(largestId, task.id), 0) + 1;

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

function getVisibleTasks() {
  if (currentFilter === "active") {
    return tasks.filter(function (task) {
      return !task.completed;
    });
  }

  if (currentFilter === "completed") {
    return tasks.filter(function (task) {
      return task.completed;
    });
  }

  return tasks;
}

function renderTasks() {
  taskList.replaceChildren();
  const visibleTasks = getVisibleTasks();

  for (const task of visibleTasks) {
    const taskItem = document.createElement("li");

    taskItem.classList.toggle("is-completed", task.completed);

    const title = document.createElement("h3");
    title.textContent = task.title;
    taskItem.append(title);

    const details = document.createElement("p");

    details.textContent = `${task.category} · ${task.priority} priority`;

    if (task.deadline) {
      details.textContent += ` · Due: ${task.deadline}`;
    }

    taskItem.append(details);

    if (task.description) {
      const description = document.createElement("p");
      description.textContent = task.description;
      taskItem.append(description);
    }

    const status = document.createElement("p");

    status.textContent = task.completed ? "Completed" : "Not completed";

    taskItem.append(status);

    const completeButton = document.createElement("button");

    completeButton.type = "button";
    completeButton.dataset.action = "toggle-complete";
    completeButton.dataset.taskId = String(task.id);

    completeButton.textContent = task.completed
      ? "Mark as not completed"
      : "Mark as completed";

    taskItem.append(completeButton);

    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.taskId = String(task.id);
    deleteButton.textContent = "Delete";

    taskItem.append(deleteButton);

    taskList.append(taskItem);
  }

  emptyState.hidden = visibleTasks.length > 0;
  updateTaskCounts();
}

taskForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const title = taskTitleInput.value.trim();

  if (title.length === 0) {
    formMessage.textContent = "Please enter a task title.";
    taskTitleInput.focus();
    return;
  }

  const task = {
    id: nextTaskId++,
    title: title,
    description: taskDescriptionInput.value.trim(),
    category: taskCategoryInput.value,
    priority: taskPriorityInput.value,
    deadline: taskDeadlineInput.value,
    completed: false,
  };

  tasks.push(task);

  const saved = saveTasks();

  renderTasks();

  formMessage.textContent = saved
    ? ""
    : "Task added, but it could not be saved permanently.";

  taskForm.reset();
});

taskList.addEventListener("click", function (event) {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const taskId = Number(button.dataset.taskId);

  if (button.dataset.action === "toggle-complete") {
    const task = tasks.find(function (item) {
      return item.id === taskId;
    });

    if (!task) {
      return;
    }

    task.completed = !task.completed;
  } else if (button.dataset.action === "delete") {
    tasks = tasks.filter(function (item) {
      return item.id !== taskId;
    });
  } else {
    return;
  }

  const saved = saveTasks();

  renderTasks();

  formMessage.textContent = saved
    ? ""
    : "Changes could not be saved permanently.";
});
filterButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    currentFilter = button.dataset.filter;

    filterButtons.forEach(function (filterButton) {
      const isSelected = filterButton.dataset.filter === currentFilter;

      filterButton.setAttribute("aria-pressed", String(isSelected));
    });

    renderTasks();
  });
});
renderTasks();
