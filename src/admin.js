// ==================== STATE ====================
let currentDeletePrinterId = null;
let currentDeletePrinterName = null;
let currentDeleteTaskId = null;
let currentDeleteTaskName = null;

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
        alert('Please fill in all required fields.');
        return;
    }
    
    // Validate printer ID format
    if (!/^[a-z0-9\-]+$/.test(printerId)) {
        alert('Printer ID can only contain lowercase letters, numbers, and hyphens.');
        return;
    }
    
    try {
        // Check if printer ID already exists
        const existingPrinter = await db.collection('printers').doc(printerId).get();
        
        if (existingPrinter.exists) {
            alert('A printer with this ID already exists. Please use a different ID.');
            return;
        }
        
        // Add new printer
        await db.collection('printers').doc(printerId).set({
            name: printerName,
            status: 'up',
            order: printerOrder,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            lastUpdatedBy: 'Admin',
            notes: 'Newly added printer',
            todos: []
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
        
        alert(`Printer "${printerName}" added successfully!`);
        
    } catch (error) {
        console.error('Error adding printer:', error);
        alert('Error adding printer. Please try again.');
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
        alert(`Printer "${currentDeletePrinterName}" deleted successfully!`);
        
    } catch (error) {
        console.error('Error deleting printer:', error);
        alert('Error deleting printer. Please try again.');
    }
}

// ==================== CLEAR AUDIT LOG ====================
async function handleClearAuditLog() {
    const confirmed = confirm(
        'WARNING: This will permanently delete ALL audit log entries.\n\n' +
        'This action cannot be undone.\n\n' +
        'Are you absolutely sure you want to continue?'
    );
    
    if (!confirmed) return;
    
    const doubleConfirm = confirm(
        'Last chance! Click OK to permanently delete all audit logs.'
    );
    
    if (!doubleConfirm) return;
    
    try {
        // Get all audit log documents
        const snapshot = await db.collection('auditLog').get();
        
        if (snapshot.empty) {
            alert('No audit logs to clear.');
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
        
        alert(`Successfully deleted ${totalDeleted} audit log entries.`);
        
    } catch (error) {
        console.error('Error clearing audit log:', error);
        alert('Error clearing audit log. Please try again.');
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
        <button class="btn btn-danger" onclick="openDeleteTaskModal('${id}', \`${task.name}\`)">
            Delete
        </button>
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
        alert('Please fill in all required fields.');
        return;
    }
    
    if (assignedPrinters.length === 0) {
        alert('Please select at least one printer.');
        return;
    }
    
    if (intervalDays < 1) {
        alert('Interval must be at least 1 day.');
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
        
        alert(`Maintenance task "${taskName}" added successfully!`);
        
    } catch (error) {
        console.error('Error adding maintenance task:', error);
        alert('Error adding maintenance task. Please try again.');
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
        alert(`Maintenance task "${currentDeleteTaskName}" deleted successfully!`);
        
    } catch (error) {
        console.error('Error deleting maintenance task:', error);
        alert('Error deleting maintenance task. Please try again.');
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
    };
}
