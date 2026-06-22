// Identify editor ID from query parameters
const urlParams = new URLSearchParams(window.location.search);
const editorId = urlParams.get('id') || 'frame-a';
console.log('[Editor] Initialized', editorId);

// DOM elements
const editor = document.getElementById('editor');
const btnBold = document.getElementById('btn-bold');
const btnItalic = document.getElementById('btn-italic');
const btnStrike = document.getElementById('btn-strike');
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');
const syncStatus = document.getElementById('sync-status');
const syncStatusText = document.getElementById('sync-status-text');
const charCount = document.getElementById('char-count');
const wordsCount = document.getElementById('words-count');

// History Undo/Redo Stacks
const undoStack = [];
const redoStack = [];
const maxStackSize = 50;

let currentHtml = '';
let isSyncing = false;
let typingTimeout = null;

// Initialize editor
currentHtml = editor.innerHTML;
updateCounts();
updateToolbarStates();

// Helper to get allowed parent domain (for origin validation)
const getParentOrigin = () => {
  // If running locally, it might be file:// or http://localhost:port
  // We'll trust the parent window origin, but validate that it matches the current window's host/protocol.
  return window.location.origin;
};

// ----------------------------------------------------
// 1. PostMessage Sync Logic
// ----------------------------------------------------

function sendSyncMessage(action, html) {
  if (isSyncing) return;
  
  parent.postMessage({
    type: 'FORMAT_SYNC',
    action: action,
    html: html,
    source: editorId,
    timestamp: Date.now()
  }, '*'); // Relies on Host broker to validate origin and forward
}

// Listen for sync messages from Host
window.addEventListener('message', (event) => {
  // Origin validation: ensure the message comes from the same origin (host page)
  const allowedOrigin = getParentOrigin();
  if (event.origin !== 'null' && event.origin !== allowedOrigin && !window.location.href.startsWith('file://')) {
    console.warn(`[${editorId}] Rejected message from unauthorized origin: ${event.origin}`);
    return;
  }
  
  const data = event.data;
  if (!data) return;

  // Handle Theme Change propagation
  if (data.type === 'THEME_CHANGE') {
    document.body.className = '';
    if (data.theme !== 'dark') {
      document.body.classList.add(`theme-${data.theme}`);
    }
    return;
  }

  // Handle Collaborative Typing Status Notification
  if (data.type === 'TYPING_STATUS') {
    const peerLabel = data.source === 'frame-a' ? 'Editor A' : 'Editor B';
    if (data.status === 'typing') {
      syncStatus.classList.add('syncing'); // flashes status badge
      syncStatusText.textContent = `${peerLabel} is typing...`;
    } else {
      syncStatus.classList.remove('syncing');
      syncStatusText.textContent = 'Connected';
    }
    return;
  }

  if (data.type !== 'FORMAT_SYNC') return;
  
  // Show temporary syncing status
  showSyncingStatus();
  
  // Calculate & display sync latency
  if (data.timestamp) {
    const latency = Math.max(0, Date.now() - data.timestamp);
    const latencyBadge = document.getElementById('sync-latency');
    const latencyText = document.getElementById('sync-latency-text');
    latencyBadge.style.display = 'flex';
    latencyText.textContent = `${latency}ms sync`;
    
    // Clear and reset badge timeout
    clearTimeout(latencyBadge.timeoutId);
    latencyBadge.timeoutId = setTimeout(() => {
      latencyBadge.style.display = 'none';
    }, 2000);
  }
  
  isSyncing = true;
  
  // Record current cursor if editor has focus
  const isFocused = (document.activeElement === editor);
  const cursorOffset = isFocused ? getCursorOffset(editor) : null;
  
  // Synchronize history stacks
  syncHistory(data.action, data.html);
  
  // Apply HTML
  editor.innerHTML = data.html || '';
  currentHtml = editor.innerHTML;
  
  // Restore cursor if editor was focused
  if (isFocused && cursorOffset) {
    setCursorOffset(editor, cursorOffset);
  }
  
  updateCounts();
  updateToolbarStates();
  
  isSyncing = false;
});

function showSyncingStatus() {
  syncStatus.classList.add('syncing');
  syncStatusText.textContent = 'Syncing...';
  
  setTimeout(() => {
    syncStatus.classList.remove('syncing');
    syncStatusText.textContent = 'Connected';
  }, 400);
}

// ----------------------------------------------------
// 2. Cursor Preservation (Character Offset Tracking)
// ----------------------------------------------------

function getCursorOffset(element) {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return null;
  
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.startContainer, range.startOffset);
  
  const start = preCaretRange.toString().length;
  return {
    start: start,
    end: start + range.toString().length
  };
}

function setCursorOffset(element, offset) {
  if (!offset) return;
  
  const selection = window.getSelection();
  const range = document.createRange();
  let charCount = 0;
  let startNode = null;
  let startOffset = 0;
  let endNode = null;
  let endOffset = 0;

  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const nextCharCount = charCount + node.length;
      if (!startNode && offset.start >= charCount && offset.start <= nextCharCount) {
        startNode = node;
        startOffset = offset.start - charCount;
      }
      if (!endNode && offset.end >= charCount && offset.end <= nextCharCount) {
        endNode = node;
        endOffset = offset.end - charCount;
      }
      charCount = nextCharCount;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i]);
        if (startNode && endNode) break;
      }
    }
  }

  traverse(element);

  // Fallbacks if node wasn't found (empty editor, out of bounds)
  if (!startNode) {
    startNode = element;
    startOffset = element.childNodes.length;
  }
  if (!endNode) {
    endNode = startNode;
    endOffset = startOffset;
  }

  try {
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    selection.removeAllRanges();
    selection.addRange(range);
  } catch (e) {
    console.error('Error restoring cursor:', e);
  }
}

// ----------------------------------------------------
// 3. Formatting Commands
// ----------------------------------------------------

function execFormat(command) {
  // Format text using document.execCommand
  document.execCommand(command, false, null);
  editor.focus();
  
  // Push state to undo stack
  pushToUndo(currentHtml);
  redoStack.length = 0; // Clear redo on action
  
  currentHtml = editor.innerHTML;
  updateCounts();
  updateToolbarStates();
  
  // Broadcast
  sendSyncMessage(command, currentHtml);
}

// Register click events for formatting toolbar
btnBold.addEventListener('click', () => {
  createParticles(btnBold, 'var(--accent-purple)');
  execFormat('bold');
});
btnItalic.addEventListener('click', () => {
  createParticles(btnItalic, 'var(--accent-emerald)');
  execFormat('italic');
});
btnStrike.addEventListener('click', () => {
  createParticles(btnStrike, '#ef4444');
  execFormat('strikeThrough');
});

// Toolbar button status reflection based on cursor
function updateToolbarStates() {
  toggleButtonActive(btnBold, document.queryCommandState('bold'));
  toggleButtonActive(btnItalic, document.queryCommandState('italic'));
  toggleButtonActive(btnStrike, document.queryCommandState('strikeThrough'));
  
  btnUndo.disabled = undoStack.length === 0;
  toggleButtonActive(btnUndo, false);
  
  btnRedo.disabled = redoStack.length === 0;
  toggleButtonActive(btnRedo, false);
}

function toggleButtonActive(button, isActive) {
  if (isActive) {
    button.classList.add('active');
  } else {
    button.classList.remove('active');
  }
}

// Monitor selection changes to update button states
document.addEventListener('selectionchange', () => {
  if (document.activeElement === editor) {
    updateToolbarStates();
  }
});

// ----------------------------------------------------
// 4. Text Input & Key Event Listeners
// ----------------------------------------------------

let throttleTimeout = null;
let hasPendingSync = false;
let pendingHtml = '';

function sendThrottledSync(action, html) {
  pendingHtml = html;
  if (throttleTimeout) {
    hasPendingSync = true;
    return;
  }
  
  sendSyncMessage(action, html);
  
  throttleTimeout = setTimeout(() => {
    throttleTimeout = null;
    if (hasPendingSync) {
      hasPendingSync = false;
      sendThrottledSync(action, pendingHtml);
    }
  }, 60); // Throttle sync rate at 60ms to prevent message overloading
}

let isTypingActive = false;
let typingStatusTimeout = null;

function broadcastTypingStatus(isTyping) {
  if (isTyping === isTypingActive) return;
  isTypingActive = isTyping;
  
  parent.postMessage({
    type: 'TYPING_STATUS',
    status: isTyping ? 'typing' : 'idle',
    source: editorId
  }, '*');
}

editor.addEventListener('input', (e) => {
  if (isSyncing) return;
  
  // Broadcast typing status to peer
  broadcastTypingStatus(true);
  clearTimeout(typingStatusTimeout);
  typingStatusTimeout = setTimeout(() => {
    broadcastTypingStatus(false);
  }, 1200); // Mark idle after 1.2s typing pause
  
  // Custom Undo state stacking strategy
  const inputType = e.inputType;
  const lastChar = editor.innerText.slice(-1);
  
  if (inputType === 'insertParagraph' || /[\s\.\,\!\?\;\:\-]/.test(lastChar)) {
    pushToUndo(currentHtml);
  } else {
    // Schedule a lazy push to the undo stack for when typing pauses
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      pushToUndo(currentHtml);
    }, 1000);
  }
  
  currentHtml = editor.innerHTML;
  updateCounts();
  trackWPM();
  
  // Send typing sync update throttled
  sendThrottledSync('typing', currentHtml);
});

// Monitor keydowns for shortcuts
editor.addEventListener('keydown', (e) => {
  // Support Ctrl+B, Ctrl+I, Ctrl+Z, Ctrl+Y within contenteditable
  if (e.ctrlKey || e.metaKey) {
    const key = e.key.toLowerCase();
    
    if (key === 'b') {
      e.preventDefault();
      execFormat('bold');
    } else if (key === 'i') {
      e.preventDefault();
      execFormat('italic');
    } else if (key === 'z') {
      e.preventDefault();
      triggerUndo();
    } else if (key === 'y') {
      e.preventDefault();
      triggerRedo();
    }
  }
});

// ----------------------------------------------------
// 5. Custom Undo/Redo Engine
// ----------------------------------------------------

function pushToUndo(htmlState) {
  // Avoid duplicate states
  if (undoStack.length > 0 && undoStack[undoStack.length - 1] === htmlState) return;
  
  undoStack.push(htmlState);
  if (undoStack.length > maxStackSize) {
    undoStack.shift();
  }
  updateToolbarStates();
}

function triggerUndo() {
  if (undoStack.length === 0) return;
  
  const prevState = undoStack.pop();
  redoStack.push(currentHtml);
  
  // Set content
  applyHistoryState(prevState, 'undo');
}

function triggerRedo() {
  if (redoStack.length === 0) return;
  
  const nextState = redoStack.pop();
  undoStack.push(currentHtml);
  
  // Set content
  applyHistoryState(nextState, 'redo');
}

function applyHistoryState(htmlState, type) {
  isSyncing = true;
  
  const cursorOffset = getCursorOffset(editor);
  
  editor.innerHTML = htmlState || '';
  currentHtml = editor.innerHTML;
  
  if (cursorOffset) {
    setCursorOffset(editor, cursorOffset);
  }
  
  updateCounts();
  updateToolbarStates();
  
  isSyncing = false;
  
  // Broadcast Undo/Redo state change
  sendSyncMessage(type, currentHtml);
}

// Sync the history stacks when receiving changes from the other editor
function syncHistory(action, incomingHtml) {
  if (action === 'undo') {
    // Other editor performed an undo
    redoStack.push(currentHtml);
    if (undoStack.length > 0) undoStack.pop(); // Align stacks
  } else if (action === 'redo') {
    // Other editor performed a redo
    undoStack.push(currentHtml);
    if (redoStack.length > 0) redoStack.pop(); // Align stacks
  } else {
    // Other editor made a standard edit
    pushToUndo(currentHtml);
    redoStack.length = 0; // Invalidate redo path
  }
}

btnUndo.addEventListener('click', () => {
  createParticles(btnUndo, 'var(--accent-pink)');
  triggerUndo();
});
btnRedo.addEventListener('click', () => {
  createParticles(btnRedo, 'var(--accent-blue)');
  triggerRedo();
});

// ----------------------------------------------------
// 7. Interactive Extras (WPM Speed & Particle Burst Generator)
// ----------------------------------------------------

let typingStartTime = null;
let wpmTimeout = null;

function trackWPM() {
  const text = editor.innerText || '';
  const cleanText = text.trim();
  const words = cleanText === '' ? 0 : cleanText.split(/\s+/).length;
  
  if (words > 0 && !typingStartTime) {
    typingStartTime = Date.now();
  }
  
  if (typingStartTime) {
    const minutesPassed = (Date.now() - typingStartTime) / 60000;
    if (minutesPassed > 0.02) { // calculate after a short window
      const wpm = Math.round(words / minutesPassed);
      const wpmBadge = document.getElementById('wpm-badge');
      const wpmText = document.getElementById('wpm-text');
      
      if (wpm > 0 && wpm < 250) { // filter out divide-by-zero spike anomalies
        wpmBadge.style.display = 'flex';
        wpmText.textContent = `${wpm} WPM`;
        
        clearTimeout(wpmTimeout);
        wpmTimeout = setTimeout(() => {
          wpmBadge.style.display = 'none';
          typingStartTime = null; // reset WPM session
        }, 5000);
      }
    }
  }
}

function createParticles(buttonElement, color) {
  const rect = buttonElement.getBoundingClientRect();
  const particleCount = 10;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'editor-particle';
    particle.style.color = color;
    particle.style.backgroundColor = color;
    
    // Position at button center relative to document body
    particle.style.left = `${rect.left + rect.width / 2}px`;
    particle.style.top = `${rect.top + rect.height / 2}px`;
    
    // Trajectory calculations
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3.5;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 1; // upwards bias
    
    document.body.appendChild(particle);
    
    let x = rect.left + rect.width / 2;
    let y = rect.top + rect.height / 2;
    let opacity = 1;
    let scale = 1.2;
    
    const animate = () => {
      x += vx;
      y += vy;
      opacity -= 0.035;
      scale -= 0.04;
      
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.opacity = opacity;
      particle.style.transform = `scale(${Math.max(0, scale)})`;
      
      if (opacity > 0 && scale > 0) {
        requestAnimationFrame(animate);
      } else {
        particle.remove();
      }
    };
    
    requestAnimationFrame(animate);
  }
}

// ----------------------------------------------------
// 6. Counts Metrics
// ----------------------------------------------------

function updateCounts() {
  const text = editor.innerText || '';
  // Character count (excluding newlines/carriage returns)
  const charLength = text.replace(/[\n\r]/g, '').length;
  charCount.textContent = `${charLength} character${charLength !== 1 ? 's' : ''}`;
  
  // Word count
  const cleanText = text.trim();
  const wordLength = cleanText === '' ? 0 : cleanText.split(/\s+/).length;
  wordsCount.textContent = `${wordLength} word${wordLength !== 1 ? 's' : ''}`;
}
