// ==================== STATE ====================
let currentDeletePrinterId = null;
let currentDeletePrinterName = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadPrintersList();
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
        'up': '✓ UP',
        'maintenance': '⚠ Maintenance',
        'down': '✗ Down'
    };
    
    item.innerHTML = `
        <div class="printer-item-info">
            <div class="printer-item-name">${printer.name}</div>
            <div class="printer-item-order">Order: ${printer.order}</div>
            <div class="status-badge status-${printer.status}">
                ${statusText[printer.status] || 'Unknown'}
            </div>
        </div>
        <button class="btn btn-danger" onclick="openDeleteModal('${id}', '${printer.name.replace(/'/g, "\\'")}')">
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
        '⚠️ WARNING: This will permanently delete ALL audit log entries.\n\n' +
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

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
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
    
    // Clear audit log button
    const clearAuditLogBtn = document.getElementById('clear-audit-log-btn');
    clearAuditLogBtn.onclick = handleClearAuditLog;
    
    // Close modal on outside click
    window.onclick = (event) => {
        if (event.target === deleteModal) {
            closeDeleteModal();
        }
    };
}

