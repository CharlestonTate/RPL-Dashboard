// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDla9CB6I0iVd0MyjZW_g837MMJb9h9VLA",
  authDomain: "rpl-dashboard.firebaseapp.com",
  projectId: "rpl-dashboard",
  storageBucket: "rpl-dashboard.firebasestorage.app",
  messagingSenderId: "712693742227",
  appId: "1:712693742227:web:da0f84ae908e9f75132b66",
  measurementId: "G-DJ5DCLFJMN"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Initial printers list - easily add more here!
const INITIAL_PRINTERS = [
  { id: 'taz4', name: 'TAZ4', order: 1 },
  { id: 'prusa-core1', name: 'Prusa Core1', order: 2 },
  { id: 'prusa-core2', name: 'Prusa Core2', order: 3 },
  { id: 'pruxl', name: 'PruXL', order: 4 },
  { id: 'prusa1', name: 'Prusa 1', order: 5 },
  { id: 'prusa2', name: 'Prusa 2', order: 6 },
  { id: 'prusa3', name: 'Prusa 3', order: 7 },
  { id: 'prusa4', name: 'Prusa 4', order: 8 },
  { id: 'taz5', name: 'TAZ5', order: 9 }
];

// ==================== TOAST NOTIFICATION SYSTEM ====================
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">${message}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  container.appendChild(toast);
  
  // Auto remove after duration
  if (duration > 0) {
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// Keep confirm dialogs as-is, only replace alerts
window.showToast = showToast;

// ==================== CUSTOM CONFIRM DIALOG ====================
function customConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const messageEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    
    messageEl.textContent = message;
    modal.style.display = 'block';
    
    const handleOk = () => {
      cleanup();
      resolve(true);
    };
    
    const handleCancel = () => {
      cleanup();
      resolve(false);
    };
    
    const cleanup = () => {
      modal.style.display = 'none';
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
      window.removeEventListener('click', handleOutsideClick);
    };
    
    const handleOutsideClick = (event) => {
      if (event.target === modal) {
        handleCancel();
      }
    };
    
    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
    window.addEventListener('click', handleOutsideClick);
  });
}

window.customConfirm = customConfirm;
