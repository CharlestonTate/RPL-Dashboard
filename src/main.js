// ==================== STATE ====================
let currentPrinterId = null;
let currentEditLogId = null;
let currentTodoPrinterId = null;
let currentMaintenanceTaskId = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    await initializeDatabase();
    setupEventListeners();
    loadPrinters();
    loadAuditLog();
    loadMaintenanceTasks();
});

// Initialize database with printers if they don't exist
async function initializeDatabase() {
    try {
        const printersSnapshot = await db.collection('printers').get();
        
        if (printersSnapshot.empty) {
            console.log('Initializing printers in database...');
            const batch = db.batch();
            
            INITIAL_PRINTERS.forEach(printer => {
                const printerRef = db.collection('printers').doc(printer.id);
                batch.set(printerRef, {
                    name: printer.name,
                    status: 'up',
                    order: printer.order,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                    lastUpdatedBy: 'System',
                    notes: 'Initialized',
                    todos: []
                });
            });
            
            await batch.commit();
            console.log('Printers initialized successfully!');
        }
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// ==================== PRINTERS ====================
function loadPrinters() {
    const printersGrid = document.getElementById('printers-grid');
    
    // Real-time listener for printers
    db.collection('printers')
        .orderBy('order')
        .onSnapshot((snapshot) => {
            if (snapshot.empty) {
                printersGrid.innerHTML = '<div class="loading">No printers found. Add printers in Admin.</div>';
                return;
            }
            
            printersGrid.innerHTML = '';
            
            snapshot.forEach((doc) => {
                const printer = doc.data();
                const printerCard = createPrinterCard(doc.id, printer);
                printersGrid.appendChild(printerCard);
            });
        }, (error) => {
            console.error('Error loading printers:', error);
            printersGrid.innerHTML = '<div class="error">Error loading printers. Check console.</div>';
        });
}

function createPrinterCard(id, printer) {
    const card = document.createElement('div');
    card.className = `printer-card status-${printer.status}`;
    
    const statusText = {
        'up': 'UP',
        'maintenance': 'Maintenance',
        'down': 'Down'
    };
    
    // Calculate todo progress
    const todos = printer.todos || [];
    const completedTodos = todos.filter(t => t.completed).length;
    const totalTodos = todos.length;
    const todosText = totalTodos > 0 ? `${completedTodos}/${totalTodos} tasks` : 'No tasks';
    
    card.innerHTML = `
        <div class="printer-name">${printer.name}</div>
        <div class="printer-status">${statusText[printer.status] || 'Unknown'}</div>
        <div class="printer-info">
            <small>Last update by: ${printer.lastUpdatedBy || 'N/A'}</small>
        </div>
        <div class="printer-todos">
            <div class="printer-todos-header">
                <span>Tasks:</span>
                <span class="todos-progress">${todosText}</span>
            </div>
        </div>
    `;
    
    // Add click handlers
    const statusArea = card.querySelector('.printer-status');
    statusArea.style.cursor = 'pointer';
    statusArea.onclick = (e) => {
        e.stopPropagation();
        openStatusModal(id, printer.name);
    };
    
    const todosArea = card.querySelector('.printer-todos');
    todosArea.style.cursor = 'pointer';
    todosArea.onclick = (e) => {
        e.stopPropagation();
        openTodoModal(id, printer.name);
    };
    
    return card;
}

// ==================== AUDIT LOG ====================
function loadAuditLog() {
    const auditLog = document.getElementById('audit-log');
    
    // Real-time listener for audit log
    db.collection('auditLog')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .onSnapshot((snapshot) => {
            if (snapshot.empty) {
                auditLog.innerHTML = '<div class="loading">No audit log entries yet.</div>';
                return;
            }
            
            auditLog.innerHTML = '';
            
            snapshot.forEach((doc) => {
                const log = doc.data();
                const logEntry = createLogEntry(doc.id, log);
                auditLog.appendChild(logEntry);
            });
        }, (error) => {
            console.error('Error loading audit log:', error);
            auditLog.innerHTML = '<div class="error">Error loading audit log.</div>';
        });
}

function createLogEntry(id, log) {
    const entry = document.createElement('div');
    entry.className = `log-entry status-${log.status}`;
    
    const timestamp = log.timestamp?.toDate() || new Date();
    const timeString = timestamp.toLocaleString();
    
    const statusText = {
        'up': 'UP',
        'maintenance': 'Maintenance',
        'down': 'Down'
    };
    
    entry.innerHTML = `
        <div class="log-header">
            <div class="log-printer">
                <span class="status-badge status-${log.status}">
                    ${statusText[log.status]}
                </span>
                <strong>${log.printerName}</strong>
            </div>
            <div class="log-time">${timeString}</div>
        </div>
        <div class="log-user">Last update by: <strong>${log.updatedBy}</strong></div>
        <div class="log-notes collapsed" id="notes-${id}">
            <div class="notes-preview">${log.notes}</div>
        </div>
        <div class="log-actions">
            <button class="btn-text" onclick="toggleNotes('${id}')">
                <span id="toggle-text-${id}">Show Full Notes</span>
            </button>
            <button class="btn-text" onclick="editNotes('${id}', \`${log.notes.replace(/`/g, '\\`')}\`)">Edit Notes</button>
        </div>
    `;
    
    return entry;
}

function toggleNotes(logId) {
    const notesDiv = document.getElementById(`notes-${logId}`);
    const toggleText = document.getElementById(`toggle-text-${logId}`);
    
    if (notesDiv.classList.contains('collapsed')) {
        notesDiv.classList.remove('collapsed');
        notesDiv.classList.add('expanded');
        toggleText.textContent = 'Show Less';
    } else {
        notesDiv.classList.remove('expanded');
        notesDiv.classList.add('collapsed');
        toggleText.textContent = 'Show Full Notes';
    }
}

function editNotes(logId, currentNotes) {
    currentEditLogId = logId;
    const editModal = document.getElementById('edit-modal');
    const editNotesTextarea = document.getElementById('edit-notes');
    
    editNotesTextarea.value = currentNotes;
    editModal.style.display = 'block';
}

// ==================== MAINTENANCE TASKS ====================
function loadMaintenanceTasks() {
    const banner = document.getElementById('maintenance-banner');
    const tasksGrid = document.getElementById('maintenance-tasks-grid');
    
    // Real-time listener for maintenance tasks
    db.collection('maintenanceTasks')
        .orderBy('name')
        .onSnapshot((snapshot) => {
            if (snapshot.empty) {
                banner.style.display = 'none';
                return;
            }
            
            banner.style.display = 'block';
            tasksGrid.innerHTML = '';
            
            snapshot.forEach((doc) => {
                const task = doc.data();
                const taskCard = createMaintenanceTaskCard(doc.id, task);
                tasksGrid.appendChild(taskCard);
            });
        }, (error) => {
            console.error('Error loading maintenance tasks:', error);
        });
}

function createMaintenanceTaskCard(id, task) {
    const card = document.createElement('div');
    
    // Calculate days since last check
    const now = new Date();
    const lastCompleted = task.lastCompleted?.toDate();
    const daysSinceCheck = lastCompleted 
        ? Math.floor((now - lastCompleted) / (1000 * 60 * 60 * 24))
        : null;
    
    const intervalDays = task.intervalDays || 10;
    const daysUntilDue = lastCompleted 
        ? intervalDays - daysSinceCheck
        : null;
    
    // Determine status
    let statusClass = 'ok';
    let statusText = 'OK';
    
    if (!lastCompleted) {
        statusClass = 'overdue';
        statusText = 'Never Checked';
    } else if (daysUntilDue < 0) {
        statusClass = 'overdue';
        statusText = `Overdue ${Math.abs(daysUntilDue)}d`;
    } else if (daysUntilDue <= 2) {
        statusClass = 'due-soon';
        statusText = `Due in ${daysUntilDue}d`;
    } else {
        statusText = `${daysUntilDue} days left`;
    }
    
    const printerNames = task.assignedPrinterNames || [];
    const printersText = printerNames.join(', ');
    
    const lastCheckText = lastCompleted 
        ? `Last: ${lastCompleted.toLocaleDateString()} by ${task.lastCompletedBy || 'Unknown'}`
        : 'Never checked';
    
    card.className = `maintenance-task-card status-${statusClass}`;
    card.onclick = () => openMaintenanceModal(id, task.name);
    
    card.innerHTML = `
        <div class="maintenance-task-header">
            <div class="maintenance-task-name">${task.name}</div>
            <div class="maintenance-status-badge status-${statusClass}">${statusText}</div>
        </div>
        ${task.description ? `<div class="maintenance-task-description">${task.description}</div>` : ''}
        <div class="maintenance-task-printers">${printersText}</div>
        <div class="maintenance-task-info">Every ${intervalDays} days</div>
        <div class="maintenance-task-last">${lastCheckText}</div>
    `;
    
    return card;
}

function openMaintenanceModal(taskId, taskName) {
    currentMaintenanceTaskId = taskId;
    const modal = document.getElementById('maintenance-modal');
    const modalTaskName = document.getElementById('modal-maintenance-task-name');
    
    modalTaskName.textContent = taskName;
    modal.style.display = 'block';
    
    // Clear form
    document.getElementById('maintenance-form').reset();
}

function closeMaintenanceModal() {
    const modal = document.getElementById('maintenance-modal');
    modal.style.display = 'none';
    currentMaintenanceTaskId = null;
}

async function handleMaintenanceCompletion() {
    const completedBy = document.getElementById('completed-by-name').value.trim();
    const notes = document.getElementById('completion-notes').value.trim();
    
    if (!completedBy) {
        alert('Please enter your name.');
        return;
    }
    
    try {
        const taskRef = db.collection('maintenanceTasks').doc(currentMaintenanceTaskId);
        const taskDoc = await taskRef.get();
        const taskData = taskDoc.data();
        
        // Update task with new completion time
        await taskRef.update({
            lastCompleted: firebase.firestore.FieldValue.serverTimestamp(),
            lastCompletedBy: completedBy
        });
        
        // Add to history
        await db.collection('maintenanceHistory').add({
            taskId: currentMaintenanceTaskId,
            taskName: taskData.name,
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            completedBy: completedBy,
            notes: notes || ''
        });
        
        closeMaintenanceModal();
        
        // CONFETTI TIME!
        triggerConfetti();
        
    } catch (error) {
        console.error('Error completing maintenance task:', error);
        alert('Error completing task. Please try again.');
    }
}

// ==================== TODO LIST MANAGEMENT ====================
function openTodoModal(printerId, printerName) {
    currentTodoPrinterId = printerId;
    const modal = document.getElementById('todo-modal');
    const modalPrinterName = document.getElementById('modal-todo-printer-name');
    
    modalPrinterName.textContent = `${printerName} - Tasks`;
    modal.style.display = 'block';
    
    loadTodos(printerId);
}

function closeTodoModal() {
    const modal = document.getElementById('todo-modal');
    modal.style.display = 'none';
    currentTodoPrinterId = null;
    document.getElementById('new-todo-input').value = '';
}

async function loadTodos(printerId) {
    const todosList = document.getElementById('todos-list');
    
    try {
        const printerDoc = await db.collection('printers').doc(printerId).get();
        const todos = printerDoc.data().todos || [];
        
        if (todos.length === 0) {
            todosList.innerHTML = '<div style="text-align: center; color: var(--color-text-muted); padding: 20px;">No tasks yet. Add one below!</div>';
            return;
        }
        
        todosList.innerHTML = '';
        todos.forEach((todo, index) => {
            const todoItem = createTodoItem(todo, index, printerId);
            todosList.appendChild(todoItem);
        });
    } catch (error) {
        console.error('Error loading todos:', error);
        todosList.innerHTML = '<div class="error">Error loading tasks.</div>';
    }
}

function createTodoItem(todo, index, printerId) {
    const item = document.createElement('div');
    item.className = 'todo-item';
    
    item.innerHTML = `
        <input type="checkbox" ${todo.completed ? 'checked' : ''} onchange="toggleTodo(${index}, '${printerId}')">
        <div class="todo-text ${todo.completed ? 'completed' : ''}">${todo.text}</div>
        <button class="btn-delete-todo" onclick="deleteTodo(${index}, '${printerId}')" title="Delete task">×</button>
    `;
    
    return item;
}

async function toggleTodo(index, printerId) {
    try {
        const printerRef = db.collection('printers').doc(printerId);
        const printerDoc = await printerRef.get();
        const todos = printerDoc.data().todos || [];
        
        todos[index].completed = !todos[index].completed;
        
        await printerRef.update({ todos: todos });
        
        // Check if all todos are completed
        const allCompleted = todos.length > 0 && todos.every(t => t.completed);
        if (allCompleted) {
            triggerConfetti();
        }
        
        loadTodos(printerId);
    } catch (error) {
        console.error('Error toggling todo:', error);
        alert('Error updating task. Please try again.');
    }
}

async function deleteTodo(index, printerId) {
    if (!confirm('Delete this task?')) return;
    
    try {
        const printerRef = db.collection('printers').doc(printerId);
        const printerDoc = await printerRef.get();
        const todos = printerDoc.data().todos || [];
        
        todos.splice(index, 1);
        
        await printerRef.update({ todos: todos });
        loadTodos(printerId);
    } catch (error) {
        console.error('Error deleting todo:', error);
        alert('Error deleting task. Please try again.');
    }
}

async function addTodo() {
    const input = document.getElementById('new-todo-input');
    const todoText = input.value.trim();
    
    if (!todoText) {
        alert('Please enter a task.');
        return;
    }
    
    try {
        const printerRef = db.collection('printers').doc(currentTodoPrinterId);
        const printerDoc = await printerRef.get();
        const todos = printerDoc.data().todos || [];
        
        todos.push({
            text: todoText,
            completed: false,
            createdAt: new Date().toISOString()
        });
        
        await printerRef.update({ todos: todos });
        
        input.value = '';
        loadTodos(currentTodoPrinterId);
    } catch (error) {
        console.error('Error adding todo:', error);
        alert('Error adding task. Please try again.');
    }
}

function triggerConfetti() {
    // Confetti animation
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 2000 };

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        confetti(Object.assign({}, defaults, {
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        }));
        confetti(Object.assign({}, defaults, {
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        }));
    }, 250);
}

// ==================== MODALS ====================
function openStatusModal(printerId, printerName) {
    currentPrinterId = printerId;
    const modal = document.getElementById('status-modal');
    const modalPrinterName = document.getElementById('modal-printer-name');
    
    modalPrinterName.textContent = `Updating: ${printerName}`;
    modal.style.display = 'block';
    
    // Clear form
    document.getElementById('status-form').reset();
}

function closeStatusModal() {
    const modal = document.getElementById('status-modal');
    modal.style.display = 'none';
    currentPrinterId = null;
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    modal.style.display = 'none';
    currentEditLogId = null;
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Status modal
    const statusModal = document.getElementById('status-modal');
    const closeBtn = statusModal.querySelector('.close');
    const cancelBtn = document.getElementById('cancel-btn');
    const statusForm = document.getElementById('status-form');
    
    closeBtn.onclick = closeStatusModal;
    cancelBtn.onclick = closeStatusModal;
    
    statusForm.onsubmit = async (e) => {
        e.preventDefault();
        await handleStatusUpdate();
    };
    
    // Edit modal
    const editModal = document.getElementById('edit-modal');
    const editCloseBtn = editModal.querySelector('.edit-close');
    const editCancelBtn = document.getElementById('edit-cancel-btn');
    const editForm = document.getElementById('edit-form');
    
    editCloseBtn.onclick = closeEditModal;
    editCancelBtn.onclick = closeEditModal;
    
    editForm.onsubmit = async (e) => {
        e.preventDefault();
        await handleNotesEdit();
    };
    
    // Maintenance modal
    const maintenanceModal = document.getElementById('maintenance-modal');
    const maintenanceCloseBtn = maintenanceModal.querySelector('.maintenance-close');
    const maintenanceCancelBtn = document.getElementById('maintenance-cancel-btn');
    const maintenanceForm = document.getElementById('maintenance-form');
    
    maintenanceCloseBtn.onclick = closeMaintenanceModal;
    maintenanceCancelBtn.onclick = closeMaintenanceModal;
    
    maintenanceForm.onsubmit = async (e) => {
        e.preventDefault();
        await handleMaintenanceCompletion();
    };
    
    // Todo modal
    const todoModal = document.getElementById('todo-modal');
    const todoCloseBtn = todoModal.querySelector('.todo-close');
    const todoCloseBtnBottom = document.getElementById('todo-close-btn');
    const addTodoBtn = document.getElementById('add-todo-btn');
    const newTodoInput = document.getElementById('new-todo-input');
    
    todoCloseBtn.onclick = closeTodoModal;
    todoCloseBtnBottom.onclick = closeTodoModal;
    addTodoBtn.onclick = addTodo;
    
    newTodoInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTodo();
        }
    };
    
    // Close modals on outside click
    window.onclick = (event) => {
        if (event.target === statusModal) {
            closeStatusModal();
        }
        if (event.target === editModal) {
            closeEditModal();
        }
        if (event.target === maintenanceModal) {
            closeMaintenanceModal();
        }
        if (event.target === todoModal) {
            closeTodoModal();
        }
    };
}

// ==================== HANDLE UPDATES ====================
async function handleStatusUpdate() {
    const userName = document.getElementById('user-name').value.trim();
    const status = document.getElementById('status-select').value;
    const notes = document.getElementById('notes').value.trim();
    
    if (!userName || !status || !notes) {
        alert('Please fill in all required fields.');
        return;
    }
    
    try {
        const printerRef = db.collection('printers').doc(currentPrinterId);
        const printerDoc = await printerRef.get();
        const printerName = printerDoc.data().name;
        
        // Update printer status
        await printerRef.update({
            status: status,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            lastUpdatedBy: userName,
            notes: notes
        });
        
        // Add to audit log
        await db.collection('auditLog').add({
            printerId: currentPrinterId,
            printerName: printerName,
            status: status,
            updatedBy: userName,
            notes: notes,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        closeStatusModal();
        
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Error updating status. Please try again.');
    }
}

async function handleNotesEdit() {
    const newNotes = document.getElementById('edit-notes').value.trim();
    
    if (!newNotes) {
        alert('Notes cannot be empty.');
        return;
    }
    
    try {
        await db.collection('auditLog').doc(currentEditLogId).update({
            notes: newNotes,
            editedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        closeEditModal();
        
    } catch (error) {
        console.error('Error editing notes:', error);
        alert('Error editing notes. Please try again.');
    }
}
