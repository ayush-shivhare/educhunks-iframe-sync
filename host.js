document.addEventListener('DOMContentLoaded', () => {
  console.log('[Host] Message Broker successfully initialized.');
  const frameAWrapper = document.getElementById('wrapper-frame-a');
  const frameBWrapper = document.getElementById('wrapper-frame-b');
  const terminalBody = document.getElementById('terminal-body');
  const btnClearLog = document.getElementById('btn-clear-log');
  let currentFilter = 'all';

  
  // Local origin validation helper
  const getHostOrigin = () => {
    return window.location.origin;
  };

  // ----------------------------------------------------
  // 1. PostMessage Relay Broker
  // ----------------------------------------------------
  window.addEventListener('message', (event) => {
    // Origin validation
    const allowedOrigin = getHostOrigin();
    if (event.origin !== 'null' && event.origin !== allowedOrigin && !window.location.href.startsWith('file://')) {
      console.warn(`[Host] PostMessage blocked from unauthorized origin: ${event.origin}`);
      return;
    }

    const payload = event.data;
    if (!payload) return;

    // Handle typing status notification relay
    if (payload.type === 'TYPING_STATUS') {
      const { status, source } = payload;
      const target = source === 'frame-a' ? 'frame-b' : 'frame-a';
      const targetIframe = document.getElementById(target);
      if (targetIframe && targetIframe.contentWindow) {
        targetIframe.contentWindow.postMessage({
          type: 'TYPING_STATUS',
          status: status,
          source: source
        }, '*');
      }
      return;
    }

    if (payload.type !== 'FORMAT_SYNC') return;

    const { action, html, source, timestamp } = payload;
    const target = source === 'frame-a' ? 'frame-b' : 'frame-a';

    // 1. Log event on Host UI
    addTerminalLog(source, target, action, html);

    // 2. Visual flash animation to show sync path
    triggerSyncFlash(source, target);
    animateBrokerVisualizer(source, target, action);

    // 3. Relay message to destination iframe (injecting timestamp)
    const targetIframe = document.getElementById(target);
    if (targetIframe && targetIframe.contentWindow) {
      targetIframe.contentWindow.postMessage({
        type: 'FORMAT_SYNC',
        action: action,
        html: html,
        timestamp: timestamp || Date.now()
      }, '*');
    }
  });

  // ----------------------------------------------------
  // 2. Terminal Logger Interface
  // ----------------------------------------------------
  let logCount = 0;

  function addTerminalLog(source, target, action, html) {
    // Remove "Empty Log" text if it's the first log
    const emptyMsg = terminalBody.querySelector('.terminal-empty');
    if (emptyMsg) {
      emptyMsg.remove();
    }

    const timestamp = new Date().toLocaleTimeString();
    const logId = `log-${++logCount}`;

    // Formatting badges based on source and target
    const sourceLabel = source === 'frame-a' ? 'Frame A' : 'Frame B';
    const targetLabel = target === 'frame-a' ? 'Frame A' : 'Frame B';
    const sourceClass = source === 'frame-a' ? 'sender-a' : 'sender-b';
    const targetClass = target === 'frame-a' ? 'sender-a' : 'sender-b';

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    // Categorize log type
    let category = 'format';
    if (action === 'typing') {
      category = 'typing';
    } else if (action === 'undo' || action === 'redo') {
      category = 'history';
    }
    entry.setAttribute('data-category', category);

    // Filter visibility check on creation
    if (currentFilter !== 'all' && category !== currentFilter) {
      entry.style.display = 'none';
    }
    
    // Sanitize HTML code display
    const escapedHtml = html
      ? html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      : '<i>(empty)</i>';

    entry.innerHTML = `
      <div class="log-meta">
        <span class="log-time">[${timestamp}]</span>
        <span class="log-direction">
          <span class="log-sender ${sourceClass}">${sourceLabel}</span>
          <span class="log-arrow">➔</span>
          <span class="log-sender sender-host">Host</span>
          <span class="log-arrow">➔</span>
          <span class="log-sender ${targetClass}">${targetLabel}</span>
        </span>
        <span class="log-action action-${action}">${action}</span>
      </div>
      <div>
        <button class="log-payload-toggle" data-target="${logId}">Toggle payload HTML</button>
        <pre id="${logId}" class="log-payload"><code>${escapedHtml}</code></pre>
      </div>
    `;

    terminalBody.appendChild(entry);
    
    // Auto scroll to bottom (only if scrollbar is near bottom or we are showing the current entry)
    if (currentFilter === 'all' || category === currentFilter) {
      terminalBody.scrollTop = terminalBody.scrollHeight;
    }

    // Attach toggle handler
    const toggleBtn = entry.querySelector('.log-payload-toggle');
    toggleBtn.addEventListener('click', () => {
      const codeBlock = document.getElementById(logId);
      codeBlock.classList.toggle('visible');
    });

    // Limit log size to last 50 entries
    const entries = terminalBody.querySelectorAll('.log-entry');
    if (entries.length > 50) {
      entries[0].remove();
    }
  }

  // Terminal Filter Event Handler
  const filterTabs = document.querySelectorAll('.filter-tab');

  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => {
        t.style.background = 'transparent';
        t.style.borderColor = 'transparent';
        t.style.color = 'var(--text-muted)';
      });

      tab.style.background = 'rgba(139, 92, 246, 0.15)';
      tab.style.borderColor = 'rgba(139, 92, 246, 0.4)';
      tab.style.color = '#ffffff';

      currentFilter = tab.getAttribute('data-filter');
      
      const entries = terminalBody.querySelectorAll('.log-entry');
      entries.forEach(entry => {
        const category = entry.getAttribute('data-category');
        if (currentFilter === 'all' || category === currentFilter) {
          entry.style.display = 'block';
        } else {
          entry.style.display = 'none';
        }
      });
    });
  });

  // Clear Logs
  btnClearLog.addEventListener('click', () => {
    terminalBody.innerHTML = '<div class="terminal-empty">No postMessage transactions logged yet. Type or click format actions inside the editors.</div>';
    logCount = 0;
  });

  // ----------------------------------------------------
  // 3. Visual Sync Glows & Flashes
  // ----------------------------------------------------
  function triggerSyncFlash(source, target) {
    const sourceEl = source === 'frame-a' ? frameAWrapper : frameBWrapper;
    const targetEl = target === 'frame-a' ? frameAWrapper : frameBWrapper;

    // Reset animations
    sourceEl.classList.remove('sync-flash', 'active-glow');
    targetEl.classList.remove('sync-flash', 'active-glow');
    
    // Trigger layout force reflow to restart CSS keyframe animations
    void sourceEl.offsetWidth;
    void targetEl.offsetWidth;

    // Add classes
    sourceEl.classList.add('sync-flash', 'active-glow');
    targetEl.classList.add('sync-flash', 'active-glow');

    // Remove active glow after animation cycle completes
    setTimeout(() => {
      sourceEl.classList.remove('active-glow');
      targetEl.classList.remove('active-glow');
    }, 1200);
  }

  function animateBrokerVisualizer(source, target, action) {
    const pulseA = document.getElementById('pulse-a-to-host');
    const pulseB = document.getElementById('pulse-host-to-b');
    const brokerCircle = document.getElementById('node-broker');
    const nodeA = document.querySelector('#node-frame-a .node-icon');
    const nodeB = document.querySelector('#node-frame-b .node-icon');

    // Reset animations
    pulseA.style.animation = 'none';
    pulseB.style.animation = 'none';
    brokerCircle.classList.remove('pulse');
    nodeA.style.boxShadow = 'none';
    nodeB.style.boxShadow = 'none';

    // Force reflow
    void pulseA.offsetWidth;
    void pulseB.offsetWidth;
    void brokerCircle.offsetWidth;
    void nodeA.offsetWidth;
    void nodeB.offsetWidth;

    // Define colors based on action
    let color = 'var(--accent-purple)';
    if (action === 'bold') {
      color = 'var(--accent-amber)';
    } else if (action === 'italic') {
      color = 'var(--accent-emerald)';
    } else if (action === 'strikeThrough') {
      color = '#ef4444';
    } else if (action === 'typing') {
      color = 'var(--accent-blue)';
    } else if (action === 'undo') {
      color = 'var(--accent-purple)';
    } else if (action === 'redo') {
      color = 'var(--accent-pink)';
    }

    // Set colors of pulse paths
    pulseA.style.stroke = color;
    pulseA.style.filter = `drop-shadow(0 0 5px ${color})`;
    pulseB.style.stroke = color;
    pulseB.style.filter = `drop-shadow(0 0 5px ${color})`;

    if (source === 'frame-a') {
      nodeA.style.boxShadow = `0 0 15px ${color}`;
      pulseA.style.animation = 'pulse-forward 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';

      setTimeout(() => {
        brokerCircle.classList.add('pulse');
        
        // Trigger concentric rings ripple
        const rings = document.querySelectorAll('.pulsar-ring');
        rings.forEach((ring, idx) => {
          ring.style.animation = 'none';
          void ring.offsetWidth;
          ring.style.borderColor = color;
          ring.style.boxShadow = `0 0 15px ${color}`;
          ring.style.animation = `pulsar-ripple-${idx + 1} 0.8s cubic-bezier(0.1, 0.8, 0.3, 1) forwards`;
        });

        // Particle burst
        createBrokerBurst(color);

        // Accelerate Starfield background if space theme is active
        accelerateStarfield();

        pulseB.style.animation = 'pulse-forward 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';

        setTimeout(() => {
          nodeB.style.boxShadow = `0 0 15px ${color}`;
          setTimeout(() => {
            nodeA.style.boxShadow = 'none';
            nodeB.style.boxShadow = 'none';
          }, 300);
        }, 400);
      }, 400);
    } else {
      nodeB.style.boxShadow = `0 0 15px ${color}`;
      pulseB.style.animation = 'pulse-backward 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';

      setTimeout(() => {
        brokerCircle.classList.add('pulse');

        // Trigger concentric rings ripple
        const rings = document.querySelectorAll('.pulsar-ring');
        rings.forEach((ring, idx) => {
          ring.style.animation = 'none';
          void ring.offsetWidth;
          ring.style.borderColor = color;
          ring.style.boxShadow = `0 0 15px ${color}`;
          ring.style.animation = `pulsar-ripple-${idx + 1} 0.8s cubic-bezier(0.1, 0.8, 0.3, 1) forwards`;
        });

        // Particle burst
        createBrokerBurst(color);

        // Accelerate Starfield background if space theme is active
        accelerateStarfield();

        pulseA.style.animation = 'pulse-backward 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';

        setTimeout(() => {
          nodeA.style.boxShadow = `0 0 15px ${color}`;
          setTimeout(() => {
            nodeA.style.boxShadow = 'none';
            nodeB.style.boxShadow = 'none';
          }, 300);
        }, 400);
      }, 400);
    }
  }

  function createBrokerBurst(color) {
    const broker = document.getElementById('node-broker');
    const rect = broker.getBoundingClientRect();
    const particleCount = 14;

    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement('div');
      p.className = 'broker-particle';
      p.style.color = color;
      p.style.backgroundColor = color;
      
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      p.style.left = `${centerX}px`;
      p.style.top = `${centerY}px`;
      
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      document.body.appendChild(p);
      
      let x = centerX;
      let y = centerY;
      let opacity = 1;
      let scale = 1.2;
      
      const animate = () => {
        x += vx;
        y += vy;
        opacity -= 0.03;
        scale -= 0.025;
        
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        p.style.opacity = opacity;
        p.style.transform = `scale(${Math.max(0, scale)})`;
        
        if (opacity > 0 && scale > 0) {
          requestAnimationFrame(animate);
        } else {
          p.remove();
        }
      };
      
      requestAnimationFrame(animate);
    }
  }


  // ----------------------------------------------------
  // 4. Terminal Window Controls (Red, Yellow, Green Dots)
  // ----------------------------------------------------
  const terminalCard = document.querySelector('.terminal-card');
  const dotClose = document.getElementById('dot-close');
  const dotMinimize = document.getElementById('dot-minimize');
  const dotMaximize = document.getElementById('dot-maximize');
  const btnRestoreTerminal = document.getElementById('btn-restore-terminal');

  // Close Terminal (Red Dot)
  dotClose.addEventListener('click', () => {
    terminalCard.style.display = 'none';
    btnRestoreTerminal.style.display = 'flex';
  });

  // Restore Terminal
  btnRestoreTerminal.addEventListener('click', () => {
    terminalCard.style.display = 'flex';
    btnRestoreTerminal.style.display = 'none';
  });

  // Minimize Terminal (Yellow Dot)
  dotMinimize.addEventListener('click', () => {
    terminalCard.classList.toggle('minimized');
    if (terminalCard.classList.contains('maximized')) {
      terminalCard.classList.remove('maximized');
    }
  });

  // Maximize Terminal (Green Dot)
  dotMaximize.addEventListener('click', () => {
    terminalCard.classList.toggle('maximized');
    if (terminalCard.classList.contains('minimized')) {
      terminalCard.classList.remove('minimized');
    }
  });

  // ----------------------------------------------------
  // 5. Theme Switching Broker
  // ----------------------------------------------------
  const themeButtons = document.querySelectorAll('.theme-btn');
  themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Reset states
      themeButtons.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = 'var(--text-muted)';
      });
      
      btn.classList.add('active');
      btn.style.background = 'rgba(139, 92, 246, 0.2)';
      btn.style.color = '#ffffff';
      
      const theme = btn.getAttribute('data-theme');
      
      // Update Host page classes
      document.body.className = '';
      if (theme !== 'dark') {
        document.body.classList.add(`theme-${theme}`);
      }
      
      // Update canvas theme animation state
      activeThemeMode = theme;
      startTerminalAnimations();
      
      // Forward theme update to both iframes
      const iframes = ['frame-a', 'frame-b'];
      iframes.forEach(id => {
        const frame = document.getElementById(id);
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({
            type: 'THEME_CHANGE',
            theme: theme
          }, '*');
        }
      });
    });
  });

  // ----------------------------------------------------
  // Canvas Theme Animations Manager
  // ----------------------------------------------------
  const canvas = document.getElementById('terminal-canvas');
  const ctx = canvas.getContext('2d');
  let animationId = null;
  let activeThemeMode = 'dark'; // 'dark' | 'matrix' | 'cyberpunk'

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || 300;
    canvas.height = rect.height || 400;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Space Dark Theme (3D Starfield Warp)
  const stars = [];
  const numStars = 80;
  let starSpeed = 0.5;
  let targetSpeed = 0.5;
  
  function initStars() {
    stars.length = 0;
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * canvas.width - canvas.width / 2,
        y: Math.random() * canvas.height - canvas.height / 2,
        z: Math.random() * canvas.width,
        color: `rgba(255, 255, 255, ${0.4 + Math.random() * 0.6})`
      });
    }
  }

  function drawStarfield() {
    ctx.fillStyle = 'rgba(10, 7, 20, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    starSpeed += (targetSpeed - starSpeed) * 0.08;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    stars.forEach(star => {
      star.z -= starSpeed;
      if (star.z <= 0) {
        star.z = canvas.width;
        star.x = Math.random() * canvas.width - canvas.width / 2;
        star.y = Math.random() * canvas.height - canvas.height / 2;
      }
      
      const k = 128.0 / star.z;
      const px = star.x * k + centerX;
      const py = star.y * k + centerY;
      
      if (px >= 0 && px < canvas.width && py >= 0 && py < canvas.height) {
        const size = (1.5 * (canvas.width - star.z)) / canvas.width;
        ctx.fillStyle = star.color;
        ctx.fillRect(px, py, Math.max(0.5, size), Math.max(0.5, size));
      }
    });
  }
  
  function accelerateStarfield() {
    if (activeThemeMode === 'dark') {
      targetSpeed = 15.0; // Hyperdrive warp speed!
      setTimeout(() => {
        targetSpeed = 0.5; // Smooth slow down back to normal speed
      }, 700);
    }
  }

  // Matrix Green Theme (Katakana Rain)
  const katakana = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ1234567890';
  const alphabet = katakana.split('');
  let columns = [];
  const fontSize = 12;

  function initMatrix() {
    columns = [];
    const colCount = Math.floor(canvas.width / fontSize) + 1;
    for (let i = 0; i < colCount; i++) {
      columns.push({
        y: Math.random() * -canvas.height,
        speed: 1 + Math.random() * 2
      });
    }
  }

  function drawMatrix() {
    ctx.fillStyle = 'rgba(4, 8, 4, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#39ff14';
    ctx.font = `${fontSize}px monospace`;
    
    columns.forEach((col, index) => {
      const text = alphabet[Math.floor(Math.random() * alphabet.length)];
      const x = index * fontSize;
      ctx.fillText(text, x, col.y);
      
      col.y += col.speed * fontSize * 0.35;
      if (col.y > canvas.height && Math.random() > 0.98) {
        col.y = 0;
      }
    });
  }

  // Cyberpunk Theme (Synthwave Perspective Grid)
  let gridOffset = 0;
  function drawCyberpunk() {
    ctx.fillStyle = 'rgba(7, 3, 14, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 1.2;
    
    const horizon = canvas.height * 0.35;
    const gridHeight = canvas.height - horizon;
    
    gridOffset = (gridOffset + 1.2) % 40;
    
    const numVertical = 16;
    for (let i = 0; i <= numVertical; i++) {
      const xOffset = (i / numVertical) * canvas.width;
      ctx.beginPath();
      ctx.moveTo(xOffset, horizon);
      const targetX = ((i / numVertical) - 0.5) * canvas.width * 2.2 + canvas.width / 2;
      ctx.lineTo(targetX, canvas.height);
      ctx.stroke();
    }
    
    let y = gridOffset;
    while (y < gridHeight) {
      const ratio = y / gridHeight;
      const py = horizon + (ratio * ratio) * gridHeight;
      
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255, 0, 127, ${0.05 + ratio * 0.25})`;
      ctx.moveTo(0, py);
      ctx.lineTo(canvas.width, py);
      ctx.stroke();
      
      y += 20;
    }
  }

  // Unified loop
  function loop() {
    if (activeThemeMode === 'dark') {
      drawStarfield();
    } else if (activeThemeMode === 'matrix') {
      drawMatrix();
    } else if (activeThemeMode === 'cyberpunk') {
      drawCyberpunk();
    }
    animationId = requestAnimationFrame(loop);
  }

  function startTerminalAnimations() {
    cancelAnimationFrame(animationId);
    resizeCanvas();
    if (activeThemeMode === 'dark') {
      initStars();
    } else if (activeThemeMode === 'matrix') {
      initMatrix();
    }
    loop();
  }

  // Initial initialization after layout settles
  setTimeout(() => {
    startTerminalAnimations();
  }, 300);
});
