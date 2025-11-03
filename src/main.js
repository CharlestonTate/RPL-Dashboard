// ==================== STATE ====================
let currentPrinterId = null;
let currentEditLogId = null;
let allMaintenanceTasks = [];

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    await initializeDatabase();
    setupEventListeners();
    loadMaintenanceTasksData();
    loadPrinters();
    loadAuditLog();
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
                    notes: 'Initialized'
                });
            });
            
            await batch.commit();
            console.log('Printers initialized successfully!');
        }
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// ==================== MAINTENANCE TASKS DATA ====================
function loadMaintenanceTasksData() {
    // Real-time listener for maintenance tasks
    db.collection('maintenanceTasks')
        .orderBy('name')
        .onSnapshot((snapshot) => {
            allMaintenanceTasks = [];
            snapshot.forEach((doc) => {
                allMaintenanceTasks.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        });
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
    
    // Get maintenance tasks assigned to this printer
    const printerTasks = allMaintenanceTasks.filter(task => 
        task.assignedPrinters && task.assignedPrinters.includes(id)
    );
    
    let maintenanceHtml = '';
    if (printerTasks.length > 0) {
        maintenanceHtml = '<div class="printer-maintenance-tasks">';
        printerTasks.forEach(task => {
            const progress = calculateTaskProgress(task);
            maintenanceHtml += `
                <div class="maintenance-task-item">
                    <div class="task-header">
                        <label class="task-checkbox-label">
                            <input type="checkbox" 
                                   class="task-checkbox" 
                                   onchange="handleMaintenanceCheck(event, '${task.id}', '${task.name}', '${id}', '${printer.name}')">
                            <span class="task-name">${task.name}</span>
                        </label>
                    </div>
                    <div class="task-progress-bar">
                        <div class="task-progress-fill" style="width: ${progress.percentage}%; background: ${progress.color};"></div>
                    </div>
                    <div class="task-progress-text">${progress.text}</div>
                </div>
            `;
        });
        maintenanceHtml += '</div>';
    }
    
    card.innerHTML = `
        <div class="printer-name">${printer.name}</div>
        <div class="printer-status" onclick="openStatusModal('${id}', '${printer.name}')" style="cursor: pointer;">
            ${statusText[printer.status] || 'Unknown'}
        </div>
        <div class="printer-info">
            <small>Last update by: ${printer.lastUpdatedBy || 'N/A'}</small>
        </div>
        ${maintenanceHtml}
    `;
    
    return card;
}

function calculateTaskProgress(task) {
    const now = new Date();
    const lastCompleted = task.lastCompleted?.toDate();
    const intervalDays = task.intervalDays || 10;
    
    if (!lastCompleted) {
        return {
            percentage: 0,
            color: '#ef4444',
            text: 'Never checked'
        };
    }
    
    const daysSinceCheck = Math.floor((now - lastCompleted) / (1000 * 60 * 60 * 24));
    const daysRemaining = intervalDays - daysSinceCheck;
    const percentage = Math.max(0, Math.min(100, (daysRemaining / intervalDays) * 100));
    
    let color, text;
    if (daysRemaining < 0) {
        color = '#ef4444'; // Red
        text = `Overdue by ${Math.abs(daysRemaining)} days`;
    } else if (daysRemaining <= 2) {
        color = '#f59e0b'; // Yellow
        text = `${daysRemaining} days left`;
    } else {
        color = '#10b981'; // Green
        text = `${daysRemaining} days left`;
    }
    
    return { percentage, color, text };
}

async function handleMaintenanceCheck(event, taskId, taskName, printerId, printerName) {
    const checkbox = event.target;
    
    // Show custom confirmation
    const confirmed = await customConfirm(`Mark "${taskName}" as completed for ${printerName}?`);
    if (!confirmed) {
        // Uncheck the checkbox
        checkbox.checked = false;
        return;
    }
    
    try {
        // Update task with new completion time
        await db.collection('maintenanceTasks').doc(taskId).update({
            lastCompleted: firebase.firestore.FieldValue.serverTimestamp(),
            lastCompletedBy: 'User'
        });
        
        // Add to history
        await db.collection('maintenanceHistory').add({
            taskId: taskId,
            taskName: taskName,
            printerId: printerId,
            printerName: printerName,
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            completedBy: 'User',
            notes: ''
        });
        
        // CONFETTI!
        triggerConfetti();
        
        // Uncheck the checkbox after completion
        checkbox.checked = false;
        
        showToast(`${taskName} completed for ${printerName}!`, 'success');
        
    } catch (error) {
        console.error('Error completing maintenance task:', error);
        showToast('Error completing task. Please try again.', 'error');
        checkbox.checked = false;
    }
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

// ==================== CONFETTI ====================
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
    
    // Close modals on outside click
    window.onclick = (event) => {
        if (event.target === statusModal) {
            closeStatusModal();
        }
        if (event.target === editModal) {
            closeEditModal();
        }
    };
}

// ==================== HANDLE UPDATES ====================
async function handleStatusUpdate() {
    const userName = document.getElementById('user-name').value.trim();
    const status = document.getElementById('status-select').value;
    const notes = document.getElementById('notes').value.trim();
    
    if (!userName || !status || !notes) {
        showToast('Please fill in all required fields.', 'warning');
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
        showToast('Error updating status. Please try again.', 'error');
    }
}

async function handleNotesEdit() {
    const newNotes = document.getElementById('edit-notes').value.trim();
    
    if (!newNotes) {
        showToast('Notes cannot be empty.', 'warning');
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
        showToast('Error editing notes. Please try again.', 'error');
    }
}
