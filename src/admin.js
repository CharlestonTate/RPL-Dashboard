// ==================== STATE ====================
let currentDeletePrinterId = null;
let currentDeletePrinterName = null;
let currentDeleteTaskId = null;
let currentDeleteTaskName = null;
let currentEditTaskId = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadPrintersList();
    loadMaintenanceTasksList();
    loadPrintersForCheckboxes();
});

// ==================== LOAD PRINTERS ====================
function loadPrintersList() {
    const printersList = document.getElementById('printers-list');
    
    // Real-time listener for printers
    db.collection('printers')
        .orderBy('order')
        .onSnapshot((snapshot) => {
            if (snapshot.empty) {
                printersList.innerHTML = '<div class="loading">No printers found. Add one below!</div>';
                return;
            }
            
            printersList.innerHTML = '';
            
            snapshot.forEach((doc) => {
                const printer = doc.data();
                const printerItem = createPrinterItem(doc.id, printer);
                printersList.appendChild(printerItem);
            });
        }, (error) => {
            console.error('Error loading printers:', error);
            printersList.innerHTML = '<div class="error">Error loading printers.</div>';
        });
}

function createPrinterItem(id, printer) {
    const item = document.createElement('div');
    item.className = 'printer-item';
    
    const statusText = {
        'up': 'UP',
        'maintenance': 'Maintenance',
        'down': 'Down'
    };
    
    item.innerHTML = `
        <div class="printer-item-info">
            <div class="printer-item-name">${printer.name}</div>
            <div class="printer-item-order">Order: ${printer.order}</div>
            <div class="status-badge status-${printer.status}">
                ${statusText[printer.status] || 'Unknown'}
            </div>
        </div>
        <button class="btn btn-danger" onclick="openDeleteModal('${id}', \`${printer.name}\`)">
            Delete
        </button>
    `;
    
    return item;
}

// ==================== ADD PRINTER ====================
async function handleAddPrinter(e) {
    e.preventDefault();
    
    const printerId = document.getElementById('printer-id').value.trim().toLowerCase();
    const printerName = document.getElementById('printer-name').value.trim();
    const printerOrder = parseInt(document.getElementById('printer-order').value);
    
    if (!printerId || !printerName || !printerOrder) {
        showToast('Please fill in all required fields.', 'warning');
        return;
    }
    
    // Validate printer ID format
    if (!/^[a-z0-9\-]+$/.test(printerId)) {
        showToast('Printer ID can only contain lowercase letters, numbers, and hyphens.', 'warning');
        return;
    }
    
    try {
        // Check if printer ID already exists
        const existingPrinter = await db.collection('printers').doc(printerId).get();
        
        if (existingPrinter.exists) {
            showToast('A printer with this ID already exists. Please use a different ID.', 'warning');
            return;
        }
        
        // Add new printer
        await db.collection('printers').doc(printerId).set({
            name: printerName,
            status: 'up',
            order: printerOrder,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            lastUpdatedBy: 'Admin',
            notes: 'Newly added printer'
        });
        
        // Add initial audit log entry
        await db.collection('auditLog').add({
            printerId: printerId,
            printerName: printerName,
            status: 'up',
            updatedBy: 'Admin',
            notes: 'Printer added to system',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Clear form
        document.getElementById('add-printer-form').reset();
        
        showToast(`Printer "${printerName}" added successfully!`, 'success');
        
    } catch (error) {
        console.error('Error adding printer:', error);
        showToast('Error adding printer. Please try again.', 'error');
    }
}

// ==================== DELETE PRINTER ====================
function openDeleteModal(printerId, printerName) {
    currentDeletePrinterId = printerId;
    currentDeletePrinterName = printerName;
    
    const modal = document.getElementById('delete-modal');
    const printerNameSpan = document.getElementById('delete-printer-name');
    
    printerNameSpan.textContent = printerName;
    modal.style.display = 'block';
}

function closeDeleteModal() {
    const modal = document.getElementById('delete-modal');
    modal.style.display = 'none';
    currentDeletePrinterId = null;
    currentDeletePrinterName = null;
}

async function handleDeletePrinter() {
    if (!currentDeletePrinterId) return;
    
    try {
        // Delete printer
        await db.collection('printers').doc(currentDeletePrinterId).delete();
        
        // Add audit log entry about deletion
        await db.collection('auditLog').add({
            printerId: currentDeletePrinterId,
            printerName: currentDeletePrinterName,
            status: 'down',
            updatedBy: 'Admin',
            notes: `Printer removed from system`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        closeDeleteModal();
        showToast(`Printer "${currentDeletePrinterName}" deleted successfully!`, 'success');
        
    } catch (error) {
        console.error('Error deleting printer:', error);
        showToast('Error deleting printer. Please try again.', 'error');
    }
}

// ==================== CLEAR AUDIT LOG ====================
async function handleClearAuditLog() {
    const confirmed = await customConfirm(
        'WARNING: This will permanently delete ALL audit log entries.\n\n' +
        'This action cannot be undone.\n\n' +
        'Are you absolutely sure you want to continue?'
    );
    
    if (!confirmed) return;
    
    const doubleConfirm = await customConfirm(
        'Last chance! Click OK to permanently delete all audit logs.'
    );
    
    if (!doubleConfirm) return;
    
    try {
        // Get all audit log documents
        const snapshot = await db.collection('auditLog').get();
        
        if (snapshot.empty) {
            showToast('No audit logs to clear.', 'info');
            return;
        }
        
        // Delete in batches (Firestore limitation of 500 operations per batch)
        const batchSize = 500;
        let batch = db.batch();
        let operationCount = 0;
        let totalDeleted = 0;
        
        for (const doc of snapshot.docs) {
            batch.delete(doc.ref);
            operationCount++;
            
            if (operationCount === batchSize) {
                await batch.commit();
                totalDeleted += operationCount;
                batch = db.batch();
                operationCount = 0;
            }
        }
        
        // Commit remaining operations
        if (operationCount > 0) {
            await batch.commit();
            totalDeleted += operationCount;
        }
        
        showToast(`Successfully deleted ${totalDeleted} audit log entries.`, 'success');
        
    } catch (error) {
        console.error('Error clearing audit log:', error);
        showToast('Error clearing audit log. Please try again.', 'error');
    }
}

// ==================== MAINTENANCE TASKS ====================
function loadMaintenanceTasksList() {
    const tasksList = document.getElementById('maintenance-tasks-list');
    
    // Real-time listener for maintenance tasks
    db.collection('maintenanceTasks')
        .orderBy('name')
        .onSnapshot((snapshot) => {
            if (snapshot.empty) {
                tasksList.innerHTML = '<div class="loading">No maintenance tasks. Add one below!</div>';
                return;
            }
            
            tasksList.innerHTML = '';
            
            snapshot.forEach((doc) => {
                const task = doc.data();
                const taskItem = createMaintenanceTaskItem(doc.id, task);
                tasksList.appendChild(taskItem);
            });
        }, (error) => {
            console.error('Error loading maintenance tasks:', error);
            tasksList.innerHTML = '<div class="error">Error loading maintenance tasks.</div>';
        });
}

function createMaintenanceTaskItem(id, task) {
    const item = document.createElement('div');
    item.className = 'printer-item';
    
    const printerNames = task.assignedPrinterNames || [];
    const printersText = printerNames.length > 0 ? printerNames.join(', ') : 'No printers';
    
    const lastCompleted = task.lastCompleted?.toDate();
    const lastCheckText = lastCompleted 
        ? `Last: ${lastCompleted.toLocaleDateString()} by ${task.lastCompletedBy || 'Unknown'}`
        : 'Never completed';
    
    item.innerHTML = `
        <div class="printer-item-info">
            <div class="printer-item-name">${task.name}</div>
            <div class="printer-item-order">Every ${task.intervalDays} days</div>
            <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-top: 5px;">
                Printers: ${printersText}
            </div>
            <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 3px;">
                ${lastCheckText}
            </div>
        </div>
        <div style="display: flex; gap: 10px;">
            <button class="btn btn-submit" onclick="openEditTaskModal('${id}')">
                Edit
            </button>
            <button class="btn btn-danger" onclick="openDeleteTaskModal('${id}', \`${task.name}\`)">
                Delete
            </button>
        </div>
    `;
    
    return item;
}

async function loadPrintersForCheckboxes() {
    const checkboxesContainer = document.getElementById('printer-checkboxes');
    
    try {
        const snapshot = await db.collection('printers').orderBy('order').get();
        
        if (snapshot.empty) {
            checkboxesContainer.innerHTML = '<div style="color: var(--color-text-muted);">No printers available. Add printers first.</div>';
            return;
        }
        
        checkboxesContainer.innerHTML = '';
        
        snapshot.forEach((doc) => {
            const printer = doc.data();
            const checkbox = document.createElement('label');
            checkbox.style.display = 'flex';
            checkbox.style.alignItems = 'center';
            checkbox.style.gap = '8px';
            checkbox.style.cursor = 'pointer';
            checkbox.style.padding = '8px';
            checkbox.style.background = 'var(--color-bg-lighter)';
            checkbox.style.borderRadius = '6px';
            checkbox.style.transition = 'background 0.2s';
            
            checkbox.innerHTML = `
                <input type="checkbox" value="${doc.id}" data-name="${printer.name}" style="width: 18px; height: 18px; cursor: pointer;">
                <span>${printer.name}</span>
            `;
            
            checkbox.onmouseover = () => checkbox.style.background = 'var(--color-border)';
            checkbox.onmouseout = () => checkbox.style.background = 'var(--color-bg-lighter)';
            
            checkboxesContainer.appendChild(checkbox);
        });
    } catch (error) {
        console.error('Error loading printers for checkboxes:', error);
        checkboxesContainer.innerHTML = '<div class="error">Error loading printers.</div>';
    }
}

async function handleAddMaintenanceTask(e) {
    e.preventDefault();
    
    const taskName = document.getElementById('task-name').value.trim();
    const taskDescription = document.getElementById('task-description').value.trim();
    const intervalDays = parseInt(document.getElementById('task-interval').value);
    
    // Get selected printers
    const checkboxes = document.querySelectorAll('#printer-checkboxes input[type="checkbox"]:checked');
    const assignedPrinters = [];
    const assignedPrinterNames = [];
    
    checkboxes.forEach(cb => {
        assignedPrinters.push(cb.value);
        assignedPrinterNames.push(cb.getAttribute('data-name'));
    });
    
    if (!taskName || !intervalDays) {
        showToast('Please fill in all required fields.', 'warning');
        return;
    }
    
    if (assignedPrinters.length === 0) {
        showToast('Please select at least one printer.', 'warning');
        return;
    }
    
    if (intervalDays < 1) {
        showToast('Interval must be at least 1 day.', 'warning');
        return;
    }
    
    try {
        // Add new maintenance task
        await db.collection('maintenanceTasks').add({
            name: taskName,
            description: taskDescription,
            intervalDays: intervalDays,
            assignedPrinters: assignedPrinters,
            assignedPrinterNames: assignedPrinterNames,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastCompleted: null,
            lastCompletedBy: null
        });
        
        // Clear form
        document.getElementById('add-maintenance-form').reset();
        
        showToast(`Maintenance task "${taskName}" added successfully!`, 'success');
        
    } catch (error) {
        console.error('Error adding maintenance task:', error);
        showToast('Error adding maintenance task. Please try again.', 'error');
    }
}

function openDeleteTaskModal(taskId, taskName) {
    currentDeleteTaskId = taskId;
    currentDeleteTaskName = taskName;
    
    const modal = document.getElementById('delete-task-modal');
    const taskNameSpan = document.getElementById('delete-task-name');
    
    taskNameSpan.textContent = taskName;
    modal.style.display = 'block';
}

function closeDeleteTaskModal() {
    const modal = document.getElementById('delete-task-modal');
    modal.style.display = 'none';
    currentDeleteTaskId = null;
    currentDeleteTaskName = null;
}

async function handleDeleteTask() {
    if (!currentDeleteTaskId) return;
    
    try {
        // Delete maintenance task
        await db.collection('maintenanceTasks').doc(currentDeleteTaskId).delete();
        
        // Delete all history for this task
        const historySnapshot = await db.collection('maintenanceHistory')
            .where('taskId', '==', currentDeleteTaskId)
            .get();
        
        if (!historySnapshot.empty) {
            const batch = db.batch();
            historySnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }
        
        closeDeleteTaskModal();
        showToast(`Maintenance task "${currentDeleteTaskName}" deleted successfully!`, 'success');
        
    } catch (error) {
        console.error('Error deleting maintenance task:', error);
        showToast('Error deleting maintenance task. Please try again.', 'error');
    }
}

// ==================== EDIT MAINTENANCE TASK ====================
async function openEditTaskModal(taskId) {
    currentEditTaskId = taskId;
    const modal = document.getElementById('edit-task-modal');
    
    try {
        // Load task data
        const taskDoc = await db.collection('maintenanceTasks').doc(taskId).get();
        const task = taskDoc.data();
        
        // Populate form
        document.getElementById('edit-task-name').value = task.name || '';
        document.getElementById('edit-task-description').value = task.description || '';
        document.getElementById('edit-task-interval').value = task.intervalDays || '';
        
        // Load and check appropriate printers
        await loadPrintersForEditCheckboxes(task.assignedPrinters || []);
        
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error loading task for edit:', error);
        showToast('Error loading task. Please try again.', 'error');
    }
}

function closeEditTaskModal() {
    const modal = document.getElementById('edit-task-modal');
    modal.style.display = 'none';
    currentEditTaskId = null;
}

async function loadPrintersForEditCheckboxes(selectedPrinters) {
    const checkboxesContainer = document.getElementById('edit-printer-checkboxes');
    
    try {
        const snapshot = await db.collection('printers').orderBy('order').get();
        
        if (snapshot.empty) {
            checkboxesContainer.innerHTML = '<div style="color: var(--color-text-muted);">No printers available.</div>';
            return;
        }
        
        checkboxesContainer.innerHTML = '';
        
        snapshot.forEach((doc) => {
            const printer = doc.data();
            const isChecked = selectedPrinters.includes(doc.id);
            const checkbox = document.createElement('label');
            checkbox.style.display = 'flex';
            checkbox.style.alignItems = 'center';
            checkbox.style.gap = '8px';
            checkbox.style.cursor = 'pointer';
            checkbox.style.padding = '8px';
            checkbox.style.background = 'var(--color-bg-lighter)';
            checkbox.style.borderRadius = '6px';
            checkbox.style.transition = 'background 0.2s';
            
            checkbox.innerHTML = `
                <input type="checkbox" value="${doc.id}" data-name="${printer.name}" 
                       style="width: 18px; height: 18px; cursor: pointer;" ${isChecked ? 'checked' : ''}>
                <span>${printer.name}</span>
            `;
            
            checkbox.onmouseover = () => checkbox.style.background = 'var(--color-border)';
            checkbox.onmouseout = () => checkbox.style.background = 'var(--color-bg-lighter)';
            
            checkboxesContainer.appendChild(checkbox);
        });
    } catch (error) {
        console.error('Error loading printers for edit checkboxes:', error);
        checkboxesContainer.innerHTML = '<div class="error">Error loading printers.</div>';
    }
}

async function handleEditTask(e) {
    e.preventDefault();
    
    const taskName = document.getElementById('edit-task-name').value.trim();
    const taskDescription = document.getElementById('edit-task-description').value.trim();
    const intervalDays = parseInt(document.getElementById('edit-task-interval').value);
    
    // Get selected printers
    const checkboxes = document.querySelectorAll('#edit-printer-checkboxes input[type="checkbox"]:checked');
    const assignedPrinters = [];
    const assignedPrinterNames = [];
    
    checkboxes.forEach(cb => {
        assignedPrinters.push(cb.value);
        assignedPrinterNames.push(cb.getAttribute('data-name'));
    });
    
    if (!taskName || !intervalDays) {
        showToast('Please fill in all required fields.', 'warning');
        return;
    }
    
    if (assignedPrinters.length === 0) {
        showToast('Please select at least one printer.', 'warning');
        return;
    }
    
    if (intervalDays < 1) {
        showToast('Interval must be at least 1 day.', 'warning');
        return;
    }
    
    try {
        // Update maintenance task and RESET the timer
        await db.collection('maintenanceTasks').doc(currentEditTaskId).update({
            name: taskName,
            description: taskDescription,
            intervalDays: intervalDays,
            assignedPrinters: assignedPrinters,
            assignedPrinterNames: assignedPrinterNames,
            lastCompleted: null,  // RESET THE TIMER
            lastCompletedBy: null
        });
        
        closeEditTaskModal();
        showToast(`Maintenance task "${taskName}" updated successfully! Timer has been reset.`, 'success');
        
    } catch (error) {
        console.error('Error updating maintenance task:', error);
        showToast('Error updating maintenance task. Please try again.', 'error');
    }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Add maintenance task form
    const addMaintenanceForm = document.getElementById('add-maintenance-form');
    addMaintenanceForm.onsubmit = handleAddMaintenanceTask;
    
    // Add printer form
    const addPrinterForm = document.getElementById('add-printer-form');
    addPrinterForm.onsubmit = handleAddPrinter;
    
    // Delete modal
    const deleteModal = document.getElementById('delete-modal');
    const deleteCloseBtn = deleteModal.querySelector('.delete-close');
    const deleteCancelBtn = document.getElementById('delete-cancel-btn');
    const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
    
    deleteCloseBtn.onclick = closeDeleteModal;
    deleteCancelBtn.onclick = closeDeleteModal;
    deleteConfirmBtn.onclick = handleDeletePrinter;
    
    // Delete task modal
    const deleteTaskModal = document.getElementById('delete-task-modal');
    const deleteTaskCloseBtn = deleteTaskModal.querySelector('.delete-task-close');
    const deleteTaskCancelBtn = document.getElementById('delete-task-cancel-btn');
    const deleteTaskConfirmBtn = document.getElementById('delete-task-confirm-btn');
    
    deleteTaskCloseBtn.onclick = closeDeleteTaskModal;
    deleteTaskCancelBtn.onclick = closeDeleteTaskModal;
    deleteTaskConfirmBtn.onclick = handleDeleteTask;
    
    // Edit task modal
    const editTaskModal = document.getElementById('edit-task-modal');
    const editTaskCloseBtn = editTaskModal.querySelector('.edit-task-close');
    const editTaskCancelBtn = document.getElementById('edit-task-cancel-btn');
    const editTaskForm = document.getElementById('edit-task-form');
    
    editTaskCloseBtn.onclick = closeEditTaskModal;
    editTaskCancelBtn.onclick = closeEditTaskModal;
    editTaskForm.onsubmit = handleEditTask;
    
    // Clear audit log button
    const clearAuditLogBtn = document.getElementById('clear-audit-log-btn');
    clearAuditLogBtn.onclick = handleClearAuditLog;
    
    // Close modals on outside click
    window.onclick = (event) => {
        if (event.target === deleteModal) {
            closeDeleteModal();
        }
        if (event.target === deleteTaskModal) {
            closeDeleteTaskModal();
        }
        if (event.target === editTaskModal) {
            closeEditTaskModal();
        }
    };
}
