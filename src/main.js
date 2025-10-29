// ==================== STATE ====================
let currentPrinterId = null;
let currentEditLogId = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    await initializeDatabase();
    setupEventListeners();
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
    card.onclick = () => openStatusModal(id, printer.name);
    
    const statusText = {
        'up': '✓ UP',
        'maintenance': '⚠ Maintenance',
        'down': '✗ Down'
    };
    
    card.innerHTML = `
        <div class="printer-name">${printer.name}</div>
        <div class="printer-status">${statusText[printer.status] || 'Unknown'}</div>
        <div class="printer-info">
            <small>Updated by: ${printer.lastUpdatedBy || 'N/A'}</small>
        </div>
    `;
    
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
    
    const statusEmoji = {
        'up': '✓',
        'maintenance': '⚠',
        'down': '✗'
    };
    
    const statusText = {
        'up': 'UP',
        'maintenance': 'Maintenance',
        'down': 'Down'
    };
    
    entry.innerHTML = `
        <div class="log-header">
            <div class="log-printer">
                <span class="status-badge status-${log.status}">
                    ${statusEmoji[log.status]} ${statusText[log.status]}
                </span>
                <strong>${log.printerName}</strong>
            </div>
            <div class="log-time">${timeString}</div>
        </div>
        <div class="log-user">Updated by: <strong>${log.updatedBy}</strong></div>
        <div class="log-notes collapsed" id="notes-${id}">
            <div class="notes-preview">${log.notes}</div>
        </div>
        <div class="log-actions">
            <button class="btn-text" onclick="toggleNotes('${id}')">
                <span id="toggle-text-${id}">Show Full Notes</span>
            </button>
            <button class="btn-text" onclick="editNotes('${id}', '${log.notes.replace(/'/g, "\\'")}')">Edit Notes</button>
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