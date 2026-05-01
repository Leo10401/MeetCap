// content.js - Modified to capture live caption updates more frequently
var captionData = [];
var isRecording = false;
var lastProcessedText = '';
var lastProcessedTimestamp = 0;
var captionObserver = null;
var capturedCaptions = [];
var sidebarInjected = false;
var backendUrl = 'http://localhost:5000'; // Default backend server URL
var authToken = null;
var userData = null;
var isLoggedIn = false;
var debugMode = true; // Set to true to enable additional console logs
var captionProcessTimer = null;

// Initialize when content script loads
console.log('Google Meet Caption Saver initializing...');

// Check if we're in a Google Meet session
function checkForGoogleMeet() {
  const isGoogleMeet = window.location.hostname === 'meet.google.com';
  console.log('Is Google Meet page:', isGoogleMeet, 'URL:', window.location.href);
  return isGoogleMeet;
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded, checking for Google Meet...');
  if (checkForGoogleMeet()) {
    initializeExtension();
  } else {
    console.log('Not a Google Meet page, extension will not initialize');
  }
});

// Initialize as soon as possible if document is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('Document already loaded, checking for Google Meet...');
  if (checkForGoogleMeet()) {
    initializeExtension();
  } else {
    console.log('Not a Google Meet page, extension will not initialize');
  }
}

// Function to initialize the extension
function initializeExtension() {
  console.log('Initializing CapMeet extension in Google Meet...');
  
  // Load settings when extension starts
  chrome.storage.sync.get(['backendUrl', 'authToken', 'userData', 'isLoggedIn'], function(result) {
    if (result.backendUrl) {
      backendUrl = result.backendUrl;
    }
    
    if (result.authToken) {
      authToken = result.authToken;
    }
    
    if (result.userData) {
      userData = result.userData;
    }
    
    isLoggedIn = result.isLoggedIn || false;
    
    // Inject the sidebar into the page
    injectSidebar();
    
    // Start checking for captions after a short delay
    setTimeout(() => {
      console.log('Ready to capture captions in real-time');
      // Initialize all observer methods for maximum coverage
      setupCaptionObserver();
    }, 2000); // Increased delay to allow page to fully load
  });
}

// Function to inject sidebar into Google Meet
function injectSidebar() {
  console.log('Injecting sidebar into Google Meet');
  
  if (sidebarInjected) {
    console.log('Sidebar already injected, skipping');
    return;
  }
  
  try {
    // Inject sidebar CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = chrome.runtime.getURL('sidebar.css');
    document.head.appendChild(cssLink);
    console.log('Sidebar CSS injected');
    
    // Create sidebar container
    const sidebar = document.createElement('div');
    sidebar.id = 'caption-saver-sidebar';
    sidebar.style.position = 'fixed';
    sidebar.style.top = '0';
    sidebar.style.right = '0';
    sidebar.style.width = '340px';
    sidebar.style.height = '100%';
    sidebar.style.backgroundColor = '#1a1a2e';
    sidebar.style.boxShadow = '-4px 0 24px rgba(0,0,0,0.5)';
    sidebar.style.zIndex = '9999';
    sidebar.style.display = 'flex';
    sidebar.style.flexDirection = 'column';
    sidebar.style.transition = 'transform 0.35s cubic-bezier(0.4,0,0.2,1)';
    sidebar.style.transform = 'translateX(340px)';
    sidebar.style.fontFamily = "'Segoe UI', system-ui, -apple-system, sans-serif";
    sidebar.style.color = '#e0e0e0';
    sidebar.style.overflow = 'hidden';
    
    // Create sidebar content with auth buttons
    sidebar.innerHTML = `
      <div style="padding: 14px 16px; background: linear-gradient(135deg, #0f3460, #16213e); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
        <h2 style="margin: 0; font-size: 15px; font-weight: 700; color: #fff; letter-spacing: 0.3px;">
          <span style="background: linear-gradient(90deg, #00d2ff, #7b2ff7); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">MeetCap</span>
          <span style="font-weight: 400; color: #8892b0; font-size: 12px; margin-left: 6px;">Caption Saver</span>
        </h2>
        <div style="display: flex; gap: 4px;">
          <button id="sidebar-settings" style="background: rgba(255,255,255,0.06); border: none; cursor: pointer; padding: 6px; border-radius: 8px; color: #8892b0;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button id="sidebar-toggle" style="background: rgba(255,255,255,0.06); border: none; cursor: pointer; padding: 6px; border-radius: 8px; color: #8892b0;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>
      <div style="padding: 12px 16px; display: flex; flex-direction: column; flex: 1; overflow-y: auto; gap: 0;">
        <div id="auth-status-container" style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(255,255,255,0.04); border-radius: 10px;">
          <div id="auth-status" style="font-size: 12px; color: #8892b0;">Not logged in</div>
          <div id="auth-buttons" style="display: flex; gap: 6px;">
            <button id="login-button" style="padding: 5px 12px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 20px; font-size: 11px; font-weight: 600; cursor: pointer;">Login</button>
            <button id="signup-button" style="padding: 5px 12px; background: linear-gradient(135deg, #11998e, #38ef7d); color: white; border: none; border-radius: 20px; font-size: 11px; font-weight: 600; cursor: pointer;">Sign Up</button>
          </div>
          <div id="profile-button" style="display: none;">
            <button id="view-profile" style="padding: 5px 12px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 20px; font-size: 11px; font-weight: 600; cursor: pointer;">My Profile</button>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px;">
          <button id="sidebar-record-button" style="padding: 10px 14px; width: 100%; background: linear-gradient(135deg, #11998e, #38ef7d); color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600; letter-spacing: 0.3px; box-shadow: 0 2px 12px rgba(56,239,125,0.25);">
            Start Recording Captions
          </button>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <button id="sidebar-export-button" style="padding: 9px 8px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 11px; font-weight: 600; box-shadow: 0 2px 12px rgba(102,126,234,0.25);">
              Export Saved Captions
            </button>
            <button id="sidebar-summarize-button" style="padding: 9px 8px; background: linear-gradient(135deg, #a855f7, #7c3aed); color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 11px; font-weight: 600; box-shadow: 0 2px 12px rgba(168,85,247,0.25);">
              Summarize with AI
            </button>
            <button id="sidebar-audit-button" style="padding: 9px 8px; background: linear-gradient(135deg, #f43f5e, #e11d48); color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 11px; font-weight: 700; box-shadow: 0 2px 12px rgba(244,63,94,0.25);">
              🧠 Audit Decision Quality
            </button>
            <button id="sidebar-save-meeting-button" style="padding: 9px 8px; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 11px; font-weight: 600; display: none; box-shadow: 0 2px 12px rgba(245,158,11,0.25);">
              Save Meeting to Account
            </button>
          </div>
        </div>
        <div id="sidebar-status" style="margin-bottom: 8px; font-size: 12px; color: #8892b0; text-align: center; padding: 4px; background: rgba(255,255,255,0.03); border-radius: 6px;">Not recording</div>
        <div id="live-bias-alerts" style="display: none; margin-bottom: 8px; max-height: 100px; overflow-y: auto; border: 1px solid rgba(244,63,94,0.3); border-radius: 10px; padding: 8px 10px; background: rgba(244,63,94,0.08); font-size: 12px;">
          <div style="font-weight: 700; color: #f43f5e; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">🔴 Live Bias Alerts</div>
          <div id="live-bias-alerts-list"></div>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;">
          <h3 style="font-size: 12px; margin: 0 0 6px 0; color: #8892b0; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">Live Captions</h3>
          <div id="sidebar-captions-list" style="overflow-y: auto; min-height: 150px; max-height: 250px; padding-right: 4px;">
            <p class="no-captions" style="color: #5a5a7a; font-size: 12px; text-align: center; padding: 20px 0;">No captions yet. Start recording to capture captions.</p>
          </div>
        </div>
        <div id="summary-container" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px; margin-top: 8px; display: none;">
          <h3 style="font-size: 12px; margin: 0 0 6px 0; color: #a855f7; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">AI Summary</h3>
          <div id="summary-content" style="max-height: 120px; overflow-y: auto; padding: 10px; background: rgba(168,85,247,0.08); border: 1px solid rgba(168,85,247,0.15); border-radius: 10px; font-size: 11px; line-height: 1.5; color: #c4b5fd; word-wrap: break-word;">
            No summary available yet.
          </div>
        </div>
        <div id="audit-report-container" style="border-top: 1px solid rgba(244,63,94,0.15); padding-top: 8px; margin-top: 8px; display: none;">
          <h3 style="font-size: 12px; margin: 0 0 6px 0; color: #f43f5e; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">🧠 Decision Quality Report</h3>
          <div id="audit-report-content" style="max-height: 180px; overflow-y: auto; padding: 10px; background: rgba(244,63,94,0.06); border: 1px solid rgba(244,63,94,0.12); border-radius: 10px; font-size: 11px; color: #fca5a5; word-wrap: break-word;">
            No audit report yet.
          </div>
        </div>
      </div>
    `;
    
    // Add sidebar to the page
    document.body.appendChild(sidebar);
    console.log('Sidebar container added to page');
    
    // Create settings modal
    const settingsModal = document.createElement('div');
    settingsModal.id = 'settings-modal';
    settingsModal.style.display = 'none';
    settingsModal.style.position = 'fixed';
    settingsModal.style.zIndex = '10000';
    settingsModal.style.left = '0';
    settingsModal.style.top = '0';
    settingsModal.style.width = '100%';
    settingsModal.style.height = '100%';
    settingsModal.style.backgroundColor = 'rgba(0,0,0,0.7)';
    settingsModal.innerHTML = `
      <div style="position: relative; background-color: #16213e; margin: 15% auto; padding: 24px; width: 380px; border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08);">
        <button id="close-settings" style="position: absolute; top: 10px; right: 10px; background: none; border: none; cursor: pointer; color: #8892b0; font-size: 20px;">×</button>
        <h3 style="margin-top: 0; color: #fff;">Settings</h3>
        <div style="margin-bottom: 15px;">
          <label for="backend-url" style="display: block; margin-bottom: 5px; color: #8892b0; font-size: 13px;">Backend Server URL:</label>
          <input id="backend-url" type="text" style="width: 100%; padding: 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; background: rgba(255,255,255,0.05); color: #e0e0e0; font-size: 13px;" value="${backendUrl}">
        </div>
        <button id="save-settings" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600;">Save Settings</button>
      </div>
    `;
    document.body.appendChild(settingsModal);
    console.log('Settings modal added to page');

    // Create summary popup modal
    const summaryModal = document.createElement('div');
    summaryModal.id = 'summary-popup-modal';
    summaryModal.style.cssText = 'display:none;position:fixed;z-index:10001;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);';
    summaryModal.innerHTML = `
      <div style="position:relative;background:#16213e;margin:5% auto;padding:0;width:520px;max-height:80vh;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;overflow:hidden;">
        <div style="padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.08);background:linear-gradient(135deg,#0f3460,#16213e);flex-shrink:0;">
          <h3 style="margin:0;font-size:15px;font-weight:700;color:#fff;">
            <span style="background:linear-gradient(90deg,#a855f7,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">✦</span> AI Meeting Summary
          </h3>
          <button id="close-summary-popup" style="background:rgba(255,255,255,0.06);border:none;cursor:pointer;color:#8892b0;font-size:20px;padding:4px 10px;border-radius:8px;line-height:1;">✕</button>
        </div>
        <div id="summary-popup-content" style="padding:20px;overflow-y:auto;flex:1;font-size:13px;line-height:1.7;color:#c4b5fd;font-family:'Segoe UI',system-ui,sans-serif;">
          Generating summary, please wait...
        </div>
      </div>
    `;
    document.body.appendChild(summaryModal);
    document.getElementById('close-summary-popup').addEventListener('click', function() {
      document.getElementById('summary-popup-modal').style.display = 'none';
    });
    summaryModal.addEventListener('click', function(e) {
      if (e.target === summaryModal) summaryModal.style.display = 'none';
    });
    console.log('Summary popup modal added');
    
    // Add sidebar toggle button to the page
    const toggleButton = document.createElement('button');
    toggleButton.id = 'caption-saver-toggle';
    toggleButton.style.position = 'fixed';
    toggleButton.style.top = '10px';
    toggleButton.style.right = '10px';
    toggleButton.style.zIndex = '9998';
    toggleButton.style.backgroundColor = '#0f3460';
    toggleButton.style.color = 'white';
    toggleButton.style.border = 'none';
    toggleButton.style.borderRadius = '50%';
    toggleButton.style.width = '48px';
    toggleButton.style.height = '48px';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.boxShadow = '0 4px 16px rgba(0,210,255,0.3)';
    toggleButton.innerHTML = `
  <svg width="36px" height="36px" viewBox="0 0 400.00 400.00" fill="none" xmlns="http://www.w3.org/2000/svg" transform="rotate(0)"><g id="SVGRepo_bgCarrier" stroke-width="0" transform="translate(14,14), scale(0.93)"><rect x="0" y="0" width="400.00" height="400.00" rx="200" fill="#00ccaa" strokewidth="0"></rect></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#CCCCCC" stroke-width="3.2"></g><g id="SVGRepo_iconCarrier"> <path d="M97.8357 54.6682C177.199 59.5311 213.038 52.9891 238.043 52.9891C261.298 52.9891 272.24 129.465 262.683 152.048C253.672 173.341 100.331 174.196 93.1919 165.763C84.9363 156.008 89.7095 115.275 89.7095 101.301" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M98.3318 190.694C-10.6597 291.485 121.25 273.498 148.233 295.083" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M98.3301 190.694C99.7917 213.702 101.164 265.697 100.263 272.898" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M208.308 136.239C208.308 131.959 208.308 127.678 208.308 123.396" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M177.299 137.271C177.035 133.883 177.3 126.121 177.3 123.396" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M203.398 241.72C352.097 239.921 374.881 226.73 312.524 341.851" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M285.55 345.448C196.81 341.85 136.851 374.229 178.223 264.504" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M180.018 345.448C160.77 331.385 139.302 320.213 120.658 304.675" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M218.395 190.156C219.024 205.562 219.594 220.898 219.594 236.324" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M218.395 190.156C225.896 202.037 232.97 209.77 241.777 230.327" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M80.1174 119.041C75.5996 120.222 71.0489 119.99 66.4414 120.41" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M59.5935 109.469C59.6539 117.756 59.5918 125.915 58.9102 134.086" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M277.741 115.622C281.155 115.268 284.589 114.823 287.997 114.255" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M291.412 104.682C292.382 110.109 292.095 115.612 292.095 121.093" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M225.768 116.466C203.362 113.993 181.657 115.175 160.124 118.568" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
    `;
    document.body.appendChild(toggleButton);
    console.log('Toggle button added to page');
    
    // Create download link element (hidden)
    const downloadLink = document.createElement('a');
    downloadLink.id = 'sidebar-download-link';
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    
    // Set up event listeners
    console.log('Setting up sidebar event listeners');
    
    document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
    document.getElementById('caption-saver-toggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-record-button').addEventListener('click', toggleRecording);
    document.getElementById('sidebar-export-button').addEventListener('click', exportCaptions);
    document.getElementById('sidebar-summarize-button').addEventListener('click', summarizeCaptions);
    document.getElementById('sidebar-settings').addEventListener('click', toggleSettings);
    document.getElementById('close-settings').addEventListener('click', toggleSettings);
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    document.getElementById('login-button').addEventListener('click', openLoginPage);
    document.getElementById('signup-button').addEventListener('click', openSignupPage);
    document.getElementById('view-profile').addEventListener('click', openProfilePage);
    document.getElementById('sidebar-save-meeting-button').addEventListener('click', saveMeetingToAccount);
    document.getElementById('sidebar-audit-button').addEventListener('click', auditDecisionQuality);
    
    // Update auth status display
    updateAuthDisplay();
    
    sidebarInjected = true;
    console.log('Sidebar successfully injected');
    
    // Load initial caption data
    loadSavedCaptions();
    
    // Automatically show the sidebar after injection
    setTimeout(() => {
      console.log('Automatically showing sidebar');
      toggleSidebar();
    }, 1000);
  } catch (error) {
    console.error('Error injecting sidebar:', error);
  }
}

// Update authentication display
function updateAuthDisplay() {
  const authStatus = document.getElementById('auth-status');
  const authButtons = document.getElementById('auth-buttons');
  const profileButton = document.getElementById('profile-button');
  const saveMeetingButton = document.getElementById('sidebar-save-meeting-button');
  
  chrome.storage.sync.get(['authToken', 'userData', 'isLoggedIn'], function(result) {
    if (result.isLoggedIn && result.authToken && result.userData) {
      // User is logged in
      authToken = result.authToken;
      userData = result.userData;
      isLoggedIn = true;
      
      authStatus.textContent = `Logged in as: ${result.userData.username}`;
      authButtons.style.display = 'none';
      profileButton.style.display = 'block';
      
      // Show the save meeting button if there's a summary
      const summaryContainer = document.getElementById('summary-container');
      if (summaryContainer && summaryContainer.style.display !== 'none') {
        saveMeetingButton.style.display = 'block';
      }
    } else {
      // User is not logged in
      authStatus.textContent = 'Not logged in';
      authButtons.style.display = 'block';
      profileButton.style.display = 'none';
      saveMeetingButton.style.display = 'none';
    }
  });
}

// Open login page
function openLoginPage() {
  chrome.runtime.sendMessage({ action: 'openLoginPage' });
}

// Open signup page
function openSignupPage() {
  chrome.runtime.sendMessage({ action: 'openSignupPage' });
}

// Open profile page
function openProfilePage() {
  chrome.runtime.sendMessage({ action: 'openProfilePage' });
}

// Save meeting to user's account
function saveMeetingToAccount() {
  if (!isLoggedIn || !authToken) {
    alert('You must be logged in to save meetings to your account.');
    return;
  }
  
  const summaryContent = document.getElementById('summary-content');
  if (!summaryContent || summaryContent.textContent === 'No summary available yet.') {
    alert('Please generate a summary first before saving the meeting.');
    return;
  }
  
  // Create a title for the meeting using the current date and time
  const now = new Date();
  const meetingTitle = `Google Meet - ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  
  // Extract participant names from captions
  const participants = [];
  captionData.forEach(caption => {
    if (caption.speaker && !participants.includes(caption.speaker)) {
      participants.push(caption.speaker);
    }
  });
  
  // Create meeting data
  const meetingData = {
    title: meetingTitle,
    participants: participants,
    rawCaptions: captionData,
    summary: summaryContent.textContent,
    notes: '',  // User can add notes later
    tags: ['Google Meet', 'Auto-saved']
  };
  
  // Send to backend
  fetch(`${backendUrl}/api/meetings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': authToken
    },
    body: JSON.stringify(meetingData)
  })
  .then(response => {
    if (!response.ok) {
      return response.json().then(data => {
        throw new Error(data.message || 'Failed to save meeting');
      });
    }
    return response.json();
  })
  .then(data => {
    alert('Meeting saved successfully to your account!');
  })
  .catch(error => {
    console.error('Error saving meeting:', error);
    alert('Failed to save meeting: ' + error.message);
  });
}

// Toggle settings modal
function toggleSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    if (modal.style.display === 'none') {
      // Update input value with current backend URL
      const urlInput = document.getElementById('backend-url');
      if (urlInput) {
        urlInput.value = backendUrl;
      }
      modal.style.display = 'block';
    } else {
      modal.style.display = 'none';
    }
  }
}

// Save settings
function saveSettings() {
  const urlInput = document.getElementById('backend-url');
  if (urlInput && urlInput.value.trim()) {
    backendUrl = urlInput.value.trim();
    
    // Save to Chrome storage
    chrome.storage.sync.set({ backendUrl: backendUrl }, function() {
      // Update status
      const statusElement = document.getElementById('sidebar-status');
      if (statusElement) {
        statusElement.textContent = "Settings saved";
        setTimeout(() => {
          if (!isRecording) {
            statusElement.textContent = "Not recording";
          } else {
            statusElement.textContent = "Recording in progress...";
          }
        }, 2000);
      }
    });
    
    // Close the modal
    toggleSettings();
  }
}

// Toggle sidebar
function toggleSidebar() {
  console.log('Toggle sidebar called');
  const sidebar = document.getElementById('caption-saver-sidebar');
  if (sidebar) {
    // Check if sidebar is currently hidden
    const isHidden = sidebar.style.transform === 'translateX(340px)';
    
    // Toggle sidebar visibility
    sidebar.style.transform = isHidden ? 'translateX(0)' : 'translateX(340px)';
    console.log('Sidebar visibility toggled, now', isHidden ? 'visible' : 'hidden');
  } else {
    console.error('Could not find sidebar element');
  }
}

// Toggle recording
function toggleRecording() {
  console.log('Toggle recording clicked, current state:', isRecording);
  
  const recordButton = document.getElementById('sidebar-record-button');
  const statusElement = document.getElementById('sidebar-status');
  const captionsList = document.getElementById('sidebar-captions-list');
  
  if (isRecording) {
    stopRecording();
    
    if (recordButton) {
      recordButton.textContent = "Start Recording Captions";
      recordButton.style.background = "linear-gradient(135deg, #11998e, #38ef7d)";
    }
    
    if (statusElement) {
      statusElement.textContent = "Not recording";
    }
    
    console.log('Recording stopped');
  } else {
    // Clear the captions list display when starting new recording
    if (captionsList) {
      captionsList.innerHTML = '<p class="no-captions">Starting new recording session...</p>';
      console.log('Cleared captions list');
    }
    
    startRecording();
    
    if (recordButton) {
      recordButton.textContent = "Stop Recording";
      recordButton.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
    }
    
    if (statusElement) {
      statusElement.textContent = "Recording in progress...";
    }
    
    console.log('Recording started');
  }
}

// Export captions
function exportCaptions() {
  if (captionData.length === 0) {
    alert('No captions to export. Please record some captions first.');
    return;
  }
  
  // Create JSON string from caption data
  const jsonData = JSON.stringify(captionData, null, 2);
  
  // Create Blob from JSON string
  const blob = new Blob([jsonData], { type: 'application/json' });
  
  // Create URL for Blob
  const url = URL.createObjectURL(blob);
  
  // Get download link element
  const downloadLink = document.getElementById('sidebar-download-link');
  
  if (downloadLink) {
    // Set link attributes
    downloadLink.href = url;
    downloadLink.download = `google-meet-captions-${new Date().toISOString().split('T')[0]}.json`;
    
    // Click the link to download
    downloadLink.click();
    
    // Clean up
    URL.revokeObjectURL(url);
  }
}

// Load saved captions
function loadSavedCaptions() {
  chrome.storage.local.get(['captionData'], function(result) {
    if (result.captionData && Array.isArray(result.captionData)) {
      captionData = result.captionData;
      
      // Update sidebar captions list
      const captionsList = document.getElementById('sidebar-captions-list');
      
      if (captionsList) {
        // Clear current captions
        captionsList.innerHTML = '';
        
        if (captionData.length > 0) {
          // Add each caption to the sidebar
          captionData.forEach(caption => {
            addCaptionToSidebar(caption);
          });
        } else {
          // Show "no captions" message
          captionsList.innerHTML = '<p class="no-captions">No captions yet. Start recording to capture captions.</p>';
        }
      }
    }
  });
}

// Function to add caption to sidebar
function addCaptionToSidebar(caption) {
  console.log('Adding caption to sidebar:', caption);
  
  if (!sidebarInjected) {
    console.log('Sidebar not injected, cannot add caption');
    return;
  }
  
  const captionsList = document.getElementById('sidebar-captions-list');
  if (!captionsList) {
    console.error('Cannot find captions list element in sidebar');
    return;
  }
  
  // Debug: Check what we're getting
  console.log('Caption data to add:', JSON.stringify(caption));
  console.log('Current sidebar content:', captionsList.innerHTML);
  
  try {
    // Remove "No captions" message if present
    const noCaption = captionsList.querySelector('.no-captions');
    if (noCaption) {
      captionsList.removeChild(noCaption);
    }
    
    // Fix for caption ID
    const uniqueId = caption.id || `caption-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Create caption element
    const captionElement = document.createElement('div');
    captionElement.id = uniqueId.startsWith('caption-') ? uniqueId : `caption-${uniqueId}`;
    captionElement.className = 'caption-entry';
    captionElement.style.marginBottom = '6px';
    captionElement.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    captionElement.style.paddingBottom = '6px';
    captionElement.style.padding = '6px 8px';
    captionElement.style.background = 'rgba(255,255,255,0.03)';
    captionElement.style.borderRadius = '8px';
    captionElement.style.border = '1px solid rgba(255,255,255,0.05)';
    
    // Add timestamp (in a human-readable format)
    const time = new Date(caption.timestamp);
    const timeElement = document.createElement('div');
    timeElement.className = 'caption-time';
    timeElement.style.fontSize = '10px';
    timeElement.style.color = '#5a5a7a';
    timeElement.style.marginBottom = '2px';
    timeElement.textContent = time.toLocaleTimeString();
    
    // Add speaker
    const speakerElement = document.createElement('span');
    speakerElement.className = 'caption-speaker';
    speakerElement.style.fontWeight = '600';
    speakerElement.style.color = '#00d2ff';
    speakerElement.style.fontSize = '12px';
    speakerElement.textContent = caption.speaker + ': ';
    
    // Add text
    const textElement = document.createElement('span');
    textElement.className = 'caption-text';
    textElement.style.color = '#c8c8d8';
    textElement.style.fontSize = '12px';
    textElement.style.lineHeight = '1.4';
    textElement.textContent = caption.text;
    
    // Assemble the caption element
    const contentElement = document.createElement('div');
    contentElement.appendChild(speakerElement);
    contentElement.appendChild(textElement);
    
    captionElement.appendChild(timeElement);
    captionElement.appendChild(contentElement);
    
    // Add to the list
    captionsList.appendChild(captionElement);
    
    // Scroll to bottom to show latest caption
    captionsList.scrollTop = captionsList.scrollHeight;
    
    // Limit the number of displayed captions to avoid performance issues
    const maxDisplayedCaptions = 50;
    const entries = captionsList.querySelectorAll('.caption-entry');
    if (entries.length > maxDisplayedCaptions) {
      for (let i = 0; i < entries.length - maxDisplayedCaptions; i++) {
        captionsList.removeChild(entries[i]);
      }
    }
    
    console.log('Caption successfully added to sidebar');
  } catch (error) {
    console.error('Error adding caption to sidebar:', error);
  }
}

// Function to start recording captions
function startRecording() {
  isRecording = true;
  console.log('Caption recording started - isRecording set to', isRecording);
  
  // Clear previous caption data
  captionData = [];
  capturedCaptions = [];
  console.log('Previous caption data cleared');
  
  // Clear previously saved captions from storage
  clearPreviousCaptions();
  
  // Set up the caption observer right away
  setupCaptionObserver();
  
  // Notify popup that recording has started
  chrome.runtime.sendMessage({action: "recordingStatus", status: true});
  
  // Update status in sidebar
  const statusElement = document.getElementById('sidebar-status');
  if (statusElement) {
    statusElement.textContent = 'Recording in progress...';
  }

  // Clear previous audit results
  const alertsContainer = document.getElementById('live-bias-alerts');
  const alertsList = document.getElementById('live-bias-alerts-list');
  if (alertsContainer) alertsContainer.style.display = 'none';
  if (alertsList) alertsList.innerHTML = '';

  const auditContainer = document.getElementById('audit-report-container');
  const auditContent = document.getElementById('audit-report-content');
  if (auditContainer) auditContainer.style.display = 'none';
  if (auditContent) auditContent.innerHTML = 'No audit report yet.';
}

// Function to clear previously saved captions
function clearPreviousCaptions() {
  chrome.storage.local.get(null, function(items) {
    const keysToRemove = Object.keys(items).filter(key => key.startsWith('meet_captions_'));
    if (keysToRemove.length > 0) {
      chrome.storage.local.remove(keysToRemove, function() {
        console.log('Previous captions cleared:', keysToRemove.length, 'sessions removed');
        // Notify popup that captions were cleared
        chrome.runtime.sendMessage({action: "captionsCleared"});
      });
    }
  });
}

// Function to stop recording captions
function stopRecording() {
  isRecording = false;
  console.log('Caption recording stopped');
  
  // Stop the caption observer
  if (captionObserver) {
    captionObserver.disconnect();
    captionObserver = null;
  }
  
  // Save the captured caption data
  saveCaptionData();
  
  // Notify popup that recording has stopped
  chrome.runtime.sendMessage({action: "recordingStatus", status: false});

  // Automatically generate summary and save to account
  if (captionData.length > 0) {
    const statusElement = document.getElementById('sidebar-status');
    if (statusElement) {
      statusElement.textContent = "Generating summary...";
    }

    // Generate summary
    fetch(`${backendUrl}/api/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(captionData)
    })
    .then(async response => {
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${text}`);
      }
      return JSON.parse(text);
    })
    .then(data => {
      // Show summary in popup with markdown
      showSummaryPopup(data.summary);

      // Store raw text for auto-save
      const summaryContainer = document.getElementById('summary-container');
      const summaryContent = document.getElementById('summary-content');
      if (summaryContainer && summaryContent) {
        summaryContainer.style.display = 'none';
        summaryContent.textContent = data.summary;
      }

      // If user is logged in, automatically save to account
      if (isLoggedIn && authToken) {
        // Create a title for the meeting using the current date and time
        const now = new Date();
        const meetingTitle = `Google Meet - ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
        
        // Extract participant names from captions
        const participants = [];
        captionData.forEach(caption => {
          if (caption.speaker && !participants.includes(caption.speaker)) {
            participants.push(caption.speaker);
          }
        });
        
        // Create meeting data
        const meetingData = {
          title: meetingTitle,
          participants: participants,
          rawCaptions: captionData,
          summary: data.summary,
          notes: '',  // User can add notes later
          tags: ['Google Meet', 'Auto-saved']
        };
        
        // Send to backend
        return fetch(`${backendUrl}/api/meetings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': authToken
          },
          body: JSON.stringify(meetingData)
        });
      }
    })
    .then(response => {
      if (response) {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.message || 'Failed to save meeting');
          });
        }
        // Update status
        const statusElement = document.getElementById('sidebar-status');
        if (statusElement) {
          statusElement.textContent = "Meeting saved successfully";
          setTimeout(() => {
            statusElement.textContent = "Not recording";
          }, 2000);
        }
      }
    })
    .then(() => {
      // ─── Auto per-speaker audit when recording stops ───
      return runPerSpeakerAudit();
    })
    .catch(error => {
      console.error('Error in auto-save process:', error);
      const statusElement = document.getElementById('sidebar-status');
      if (statusElement) {
        statusElement.textContent = "Error: " + error.message;
        setTimeout(() => {
          statusElement.textContent = "Not recording";
        }, 2000);
      }
    });
  }
}

// Function to save caption data to local storage
function saveCaptionData() {
  if (capturedCaptions.length > 0) {
    const timestamp = new Date().toISOString();
    const key = `meet_captions_${timestamp}`;
    
    chrome.storage.local.set({[key]: capturedCaptions}, function() {
      console.log('Captions saved:', capturedCaptions.length, 'entries');
      chrome.runtime.sendMessage({
        action: "captionsSaved", 
        timestamp: timestamp,
        count: capturedCaptions.length
      });
    });
  }
}

// Extract speaker name from caption element - improved version
function extractSpeakerName(captionElement) {
  // First try to find speaker elements with known class names
  const speakerSelectors = [
    '.NWpY1d', '.zs7s8d', '.YTbUzc', '.KcIKyf.jxFHg',
    '.KcIKyf', 'span.NWpY1d', 'span.zs7s8d'
  ];
  
  for (const selector of speakerSelectors) {
    const speakerElement = captionElement.querySelector(selector);
    if (speakerElement) {
      // Look for child elements that might contain the speaker name
      const possibleNameElements = speakerElement.querySelectorAll('span, div');
      
      if (possibleNameElements.length > 0) {
        // Try to get name from first child element
        for (const elem of possibleNameElements) {
          const speakerName = elem.textContent.trim();
          if (speakerName && speakerName !== ':' && !speakerName.endsWith(':')) {
            return speakerName.replace(/[:：]$/, '').trim();
          }
        }
      }
      
      // If no suitable child element, try the element itself
      let speakerName = speakerElement.textContent.trim();
      // Remove colon if present
      speakerName = speakerName.replace(/[:：]$/, '').trim();
      if (speakerName) return speakerName;
    }
  }
  
  // Next, try to find speaker name from parent element structure
  const parentElement = captionElement.parentElement;
  if (parentElement) {
    const speakerElems = parentElement.querySelectorAll('span.NWpY1d');
    for (const elem of speakerElems) {
      if (elem.textContent && elem.textContent.trim()) {
        return elem.textContent.trim().replace(/[:：]$/, '');
      }
    }
  }
  
  // If not found, try parsing from the caption text content
  const fullText = captionElement.textContent.trim();
  
  // Look for patterns like "Name: text" or "Name："
  const colonMatch = fullText.match(/^([^:：]+)[：:]\s*(.+)$/);
  if (colonMatch) {
    return colonMatch[1].trim();
  }
  
  // For the screenshot pattern you showed
  const captionContainer = captionElement.closest('[role="region"][aria-label="Captions"], .KcIKyf, .bh44bd');
  if (captionContainer) {
    // Look for speaker indicators (like "You:" or "Pramod:")
    const speakerIndicators = captionContainer.querySelectorAll('span.NWpY1d');
    for (const indicator of speakerIndicators) {
      const name = indicator.textContent.trim().replace(/[:：]$/, '');
      if (name) return name;
    }
  }
  
  return "Unknown";
}

// Find the caption container in the DOM
function findCaptionContainer() {
  const containerSelectors = [
    // Primary selectors (most stable)
    'div[role="region"][aria-label*="Caption" i]',
    'div[role="region"][aria-label*="caption" i]',
    
    // Fallback selectors for different Google Meet versions
    'div[role="region"]',
    
    // CSS class-based selectors (less stable but still useful)
    '.nMcdL.bj4p3b',
    '.adE6rb',
    '.iOzk7',
    '.bh44bd',
    '.A8eI7d',
    '.u7LVg',
    
    // Generic caption area patterns
    'div[aria-label*="caption" i]',
  ];
  
  // First, try to find the caption container
  for (const selector of containerSelectors) {
    try {
      const container = document.querySelector(selector);
      if (container) {
        console.log(`✓ Found caption container with selector: ${selector}`);
        return container;
      }
    } catch (e) {
      console.log(`  Selector "${selector}" caused error (likely invalid), skipping...`);
    }
  }
  
  // If no specific container found, look for any element with recent caption text
  console.log('No specific caption container found, searching for caption text patterns...');
  
  // Look for regions that contain caption-like text
  const regions = document.querySelectorAll('[role="region"]');
  for (const region of regions) {
    const text = region.textContent?.trim() || '';
    // Caption regions are usually small and contain speaker names
    if (text.length > 5 && text.length < 500 && !text.includes('\n\n\n')) {
      if (text.includes(':') || (text.length < 100 && text.match(/^[A-Z]/))) {
        console.log('✓ Found likely caption region by text pattern');
        return region;
      }
    }
  }
  
  // Last resort: return body and observe mutations there
  console.warn('Could not find specific caption container, will observe entire page');
  return document.body;
}

// Check if text is likely UI text rather than captions
function isLikelyUIText(text) {
  if (!text) return true;
  
  // Skip very short text (likely UI elements)
  if (text.length < 3) {
    console.log(`Detected UI text: "${text}" (too short)`);
    return true;
  }
  
  const uiKeywords = [
    'button', 'menu', 'click', 'settings', 'meeting', 'leave', 
    'join', 'mute', 'unmute', 'camera', 'microphone', 'share',
    'present', 'raise hand', 'participants', 'chat', 'more',
    'turn on', 'turn off', 'settings', 'people', 'recording',
    'presenter', 'host', 'is presenting', 'is muted', 'notifications',
    'is sharing', 'has turned', 'you are', 'live', 'caption',
    'connected', 'controls', 'entered', 'left', 'everyone'
  ];
  
  const lowerText = text.toLowerCase();
  
  // Check for exact UI element matches
  for (const keyword of uiKeywords) {
    if (lowerText === keyword || lowerText.includes(` ${keyword} `)) {
      console.log(`Detected UI text: "${text}" (matched keyword: ${keyword})`);
      return true;
    }
  }
  
  // Check for Hindi UI text
  const hindiUIPattern = /^हेलो$/i;
  if (hindiUIPattern.test(text)) {
    console.log(`Detected UI text: "${text}" (matched Hindi UI pattern)`);
    return true;
  }
  
  // Check for other UI patterns
  if (/^\d+$/.test(text) || // Just numbers
      /^[^\w\s]+$/.test(text) || // Just symbols
      /^\w+:$/.test(text)) { // Just a word with colon
    console.log(`Detected UI text: "${text}" (matches UI pattern)`);
    return true;
  }
  
  console.log(`Valid caption text: "${text}"`);
  return false;
}

function normalizeCaptionText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function getLatestCaptionFromDom(container) {
  const region = container.matches('[role="region"]')
    ? container
    : (container.querySelector('div[role="region"][aria-label*="Caption" i]') || container);

  const textSelectors = [
    '.ygicle.VbkSUe',
    '.bh44bd.VbkSUe',
    '.VbkSUe',
    '[data-self-name] + div'
  ].join(',');

  const textCandidates = Array.from(region.querySelectorAll(textSelectors))
    .filter((el) => !el.closest('.KcIKyf'))
    .map((el) => ({
      element: el,
      text: normalizeCaptionText(el.textContent)
    }))
    .filter((item) => item.text.length > 0);

  if (textCandidates.length === 0) {
    return null;
  }

  const latest = textCandidates[textCandidates.length - 1];
  const host = latest.element.parentElement || latest.element;

  const localSpeaker = host.querySelector('.KcIKyf.jxFHg .NWpY1d, .KcIKyf .NWpY1d, .NWpY1d');
  const allSpeakers = region.querySelectorAll('.KcIKyf.jxFHg .NWpY1d, .KcIKyf .NWpY1d, .NWpY1d');
  const fallbackSpeaker = allSpeakers.length > 0 ? allSpeakers[allSpeakers.length - 1] : null;

  const speakerName = normalizeCaptionText((localSpeaker || fallbackSpeaker)?.textContent || '').replace(/[:：]$/, '') || 'Unknown';

  return {
    speakerName,
    captionText: latest.text,
    rawText: `${speakerName}: ${latest.text}`
  };
}

// Process all captions in the container
function processCaptions() {
  console.log('Processing captions, isRecording:', isRecording);
  
  if (!isRecording) {
    console.log('Not recording, skipping caption processing');
    return;
  }

  const container = findCaptionContainer();
  if (!container) {
    console.log('No caption container found');
    return;
  }
  
  try {
    const latestCaption = getLatestCaptionFromDom(container);
    if (!latestCaption) {
      console.log('No transcript text nodes found yet');
      return;
    }

    const speakerName = latestCaption.speakerName;
    const captionText = latestCaption.captionText;
    const newText = latestCaption.rawText;
    
    console.log('Raw caption text found:', newText);
    
    // If text is identical to what we've already processed, skip it
    if (newText === lastProcessedText) {
      console.log('Skipping duplicate caption text');
      return;
    }
    
    console.log('Extracted speaker name:', speakerName);
    
    console.log('Processed caption text:', captionText);
    
    // Skip if we don't have meaningful text or if it's UI text
    if (!captionText) {
      console.log('Skipping empty caption');
      return;
    }
    
    // Ignore placeholders like "You" that are speaker labels, not transcript text
    if (captionText.length <= 3 || isLikelyUIText(captionText)) {
      console.log('Skipping likely UI text');
      return;
    }
    
    // Update last processed text
    lastProcessedText = newText;
    
    // Handle continuous speech from the same speaker
    let updatedExistingCaption = false;
    let currentCaptionId = '';
    
    // Check if the last caption was from the same speaker
    if (capturedCaptions.length > 0) {
      const lastCaption = capturedCaptions[capturedCaptions.length - 1];
      if (lastCaption.speaker === speakerName) {
        // This is the same speaker continuing to talk
        console.log('Same speaker continuing, updating existing caption');
        
        // Check if the new text is completely different or a continuation
        // If it's very different, it might be a new thought - start a new caption
        // If it's similar or an extension, update the existing caption
        
        const lastText = lastCaption.text;
        // If the new text contains what we already had (or vice versa), it's likely a continuation
        const isContinuation = lastText.includes(captionText) || 
                               captionText.includes(lastText) ||
                               // Check if they share a significant portion of words
                               checkTextSimilarity(lastText, captionText);
                               
        if (isContinuation) {
          // Update the existing caption - always keep the longer text
          if (captionText.length > lastText.length) {
            lastCaption.text = captionText;
          }
          lastCaption.timestamp = new Date().toISOString();
          
          currentCaptionId = lastCaption.id;
          updatedExistingCaption = true;
          
          // Update in the sidebar
          updateSidebarCaption(lastCaption);
        }
      }
    }
    
    // If we haven't updated an existing caption, create a new one
    if (!updatedExistingCaption) {
      // Generate a unique ID for this caption
      const captionId = `caption-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      currentCaptionId = captionId;
      
      console.log('Adding new caption with ID:', captionId);
      
      // Add new caption
      const newCaption = {
        timestamp: new Date().toISOString(),
        speaker: speakerName,
        text: captionText,
        id: captionId
      };
      
      capturedCaptions.push(newCaption);
      
      // Also add to captionData for compatibility
      captionData.push({
        speaker: speakerName,
        text: captionText,
        timestamp: new Date().toISOString(),
        id: captionId
      });
      
      // Add to sidebar
      addCaptionToSidebar(newCaption);

      // ─── Real-time audit: fire when a new caption is created ───
      if (isRecording) {
        auditSingleCaptionRealTime(newCaption);
      }
    }
    
    // Save more frequently
    if (capturedCaptions.length % 3 === 0 || updatedExistingCaption) {
      saveCaptionData();
    }
  } catch (error) {
    console.error('Error processing captions:', error);
  }
}

// Helper function to check if two texts are similar enough to be considered a continuation
function checkTextSimilarity(text1, text2) {
  // Simple word-based similarity check
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  // Count common words
  const commonWords = words1.filter(word => words2.includes(word));
  
  // Get the shorter text's word count
  const minLength = Math.min(words1.length, words2.length);
  
  // If at least 30% of the words are common, consider it similar
  return commonWords.length >= minLength * 0.3;
}

// Function to update caption in sidebar
function updateSidebarCaption(caption) {
  console.log('Updating sidebar caption:', caption.id);
  
  if (!sidebarInjected) {
    console.log('Sidebar not injected, cannot update caption');
    return;
  }
  
  const captionsList = document.getElementById('sidebar-captions-list');
  if (!captionsList) {
    console.log('Caption list element not found');
    return;
  }
  
  // Debug: Check what we're updating to
  console.log('Updating caption data:', JSON.stringify(caption));
  
  try {
    // Look for existing caption with this ID
    const captionId = caption.id || '';
    const elementId = captionId.startsWith('caption-') ? captionId : `caption-${captionId}`;
    
    // Find the element
    const captionElement = document.getElementById(elementId);
    
    if (captionElement) {
      // Update the text content
      const textElement = captionElement.querySelector('.caption-text');
      if (textElement) {
        textElement.textContent = caption.text;
        
        // Update the timestamp display
        const timeElement = captionElement.querySelector('.caption-time');
        if (timeElement) {
          const time = new Date(caption.timestamp);
          timeElement.textContent = time.toLocaleTimeString();
        }
        
        // Make the element briefly flash to show it was updated
        captionElement.style.transition = 'background-color 0.3s';
        captionElement.style.backgroundColor = '#f0f9ff';
        setTimeout(() => {
          captionElement.style.backgroundColor = 'transparent';
        }, 300);
        
        console.log('Updated existing caption in sidebar');
        
        // Scroll to the element
        captionElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        console.log('Text element not found within caption element');
      }
    } else {
      // If not found, add it as a new caption
      console.log('Caption element not found, adding as new');
      addCaptionToSidebar(caption);
    }
  } catch (error) {
    console.error('Error updating caption in sidebar:', error);
    // Try to add it as new if update fails
    try {
      addCaptionToSidebar(caption);
    } catch (e) {
      console.error('Failed to fall back to adding caption:', e);
    }
  }
}

// Set up mutation observer for captions
function setupCaptionObserver() {
  console.log('Setting up caption observer');
  
  if (captionObserver) {
    captionObserver.disconnect();
    console.log('Previous observer disconnected');
  }
  
  // Counter to avoid processing too frequently
  let processingCount = 0;
  
  captionObserver = new MutationObserver((mutations) => {
    if (isRecording) {
      try {
        // Debounce: only process every few mutations to avoid hammering the processCaptions function
        processingCount++;
        
        if (processingCount % 2 === 0) { // Process every 2nd mutation
          const hasCaptionChanges = mutations.some(mutation => {
            // Check if the mutation is happening in a caption-related area
            let isInCaptionArea = false;
            
            try {
              const target = mutation.target;
              
              // Check if target or any ancestor is a caption area
              if (target && typeof target.closest === 'function') {
                isInCaptionArea = !!target.closest([
                  '[role="region"]',
                  '.nMcdL.bj4p3b',
                  '.adE6rb',
                  '.iOzk7',
                  '.bh44bd',
                  '.KcIKyf',
                  '.A8eI7d',
                  '.u7LVg'
                ].join(','));
              }
              
              // Also check if this is text content changing (characterData)
              const hasTextChange = mutation.type === 'characterData' && 
                                   target && 
                                   target.textContent && 
                                   target.textContent.trim().length > 0;
              
              return isInCaptionArea || hasTextChange;
            } catch (e) {
              console.log('Error checking caption area:', e);
              return false;
            }
          });
          
          if (hasCaptionChanges) {
            console.log('Caption changes detected, processing...');
            // Use a short debounce to avoid processing captions too frequently
            clearTimeout(captionProcessTimer);
            captionProcessTimer = setTimeout(processCaptions, 300);
          }
        }
      } catch (error) {
        console.error('Error in mutation observer:', error);
      }
    }
  });
  
  // Look for the caption container
  const captionContainer = findCaptionContainer() || document.body;
  
  console.log('Starting caption observer on:', captionContainer.tagName, captionContainer.className);
  
  // Observe the container with optimized settings
  captionObserver.observe(captionContainer, {
    childList: true,
    subtree: true,
    characterData: true,
    characterDataOldValue: false,  // Don't need old value
    attributes: false,  // Don't watch attributes for now
    attributeOldValue: false
  });
  
  console.log('Caption observer started');
  
  // Try an initial caption processing after a short delay
  setTimeout(processCaptions, 1500);
}

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startRecording") {
    startRecording();
    sendResponse({status: "started"});
  } else if (message.action === "stopRecording") {
    stopRecording();
    sendResponse({status: "stopped"});
  } else if (message.action === "getStatus") {
    sendResponse({isRecording: isRecording});
  } else if (message.action === "saveCaptionsNow") {
    // Added new action to force save captions immediately
    saveCaptionData();
    sendResponse({status: "saved"});
  }
  return true;
});

// Summarize captions using backend AI service
// Simple markdown-to-HTML converter
function simpleMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h4 style="color:#e2e8f0;margin:12px 0 4px;font-size:13px;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="color:#e2e8f0;margin:14px 0 6px;font-size:14px;">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="color:#fff;margin:16px 0 8px;font-size:16px;">$1</h2>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e2e8f0;">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^[\-\*] (.+)$/gm, '<li style="margin:2px 0;padding-left:4px;">$1</li>')
    // Numbered lists
    .replace(/^\d+\.\s(.+)$/gm, '<li style="margin:2px 0;padding-left:4px;">$1</li>')
    // Line breaks
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
  // Wrap consecutive <li> tags in <ul>
  html = html.replace(/((?:<li[^>]*>.*?<\/li><br>?)+)/g, function(match) {
    const cleaned = match.replace(/<br>/g, '');
    return '<ul style="margin:6px 0 6px 16px;padding:0;list-style:disc;">' + cleaned + '</ul>';
  });
  return html;
}

// Show summary in a popup modal
function showSummaryPopup(summaryText) {
  const modal = document.getElementById('summary-popup-modal');
  const content = document.getElementById('summary-popup-content');
  if (modal && content) {
    content.innerHTML = simpleMarkdown(summaryText);
    modal.style.display = 'block';
  }
}

function summarizeCaptions() {
  if (captionData.length === 0) {
    alert('No captions to summarize. Please record some captions first.');
    return;
  }
  
  const statusElement = document.getElementById('sidebar-status');
  const saveMeetingButton = document.getElementById('sidebar-save-meeting-button');
  
  // Update status
  if (statusElement) statusElement.textContent = "Generating summary...";
  
  // Show popup with loading state
  const modal = document.getElementById('summary-popup-modal');
  const popupContent = document.getElementById('summary-popup-content');
  if (modal && popupContent) {
    popupContent.innerHTML = '<div style="text-align:center;padding:40px;color:#8892b0;"><div style="font-size:24px;margin-bottom:12px;">⏳</div>Generating summary, please wait...</div>';
    modal.style.display = 'block';
  }
  
  // Send captions to backend for summarization
  fetch(`${backendUrl}/api/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(captionData)
  })
  .then(async response => {
    const text = await response.text();
    console.log('Response:', text);
    if (!response.ok) throw new Error(`Server responded with ${response.status}: ${text}`);
    return JSON.parse(text);
  })
  .then(data => {
    // Show in popup with markdown rendering
    showSummaryPopup(data.summary);
    
    // Also store in the inline container for auto-save logic
    const summaryContainer = document.getElementById('summary-container');
    const summaryContent = document.getElementById('summary-content');
    if (summaryContainer && summaryContent) {
      summaryContainer.style.display = 'none';
      summaryContent.textContent = data.summary;
    }
    
    if (statusElement) {
      statusElement.textContent = "Summary generated";
      setTimeout(() => {
        statusElement.textContent = isRecording ? "Recording in progress..." : "Not recording";
      }, 2000);
    }
    
    // Show the "Save Meeting" button if user is logged in
    if (isLoggedIn && authToken && saveMeetingButton) {
      saveMeetingButton.style.display = 'block';
    }
  })
  .catch(error => {
    console.error('Error generating summary:', error);
    if (popupContent) {
      popupContent.innerHTML = '<div style="text-align:center;padding:40px;color:#f43f5e;"><div style="font-size:24px;margin-bottom:12px;">❌</div>Error generating summary. Please try again.<br><br><span style="font-size:11px;color:#8892b0;">' + error.message + '</span></div>';
    }
    
    if (statusElement) {
      statusElement.textContent = "Error generating summary";
      setTimeout(() => {
        statusElement.textContent = isRecording ? "Recording in progress..." : "Not recording";
      }, 2000);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── DECISION QUALITY AUDITOR FUNCTIONS ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// Bias emoji map (matches the Python model)
const BIAS_EMOJIS = {
  anchoring: '⚓',
  groupthink: '🐑',
  missing_objections: '🚨',
  overconfidence: '🎲',
  vague_ownership: '👻'
};

// Debounce timer for real-time audit
let auditDebounceTimer = null;

/**
 * Real-time: audit a single caption as it's created during recording.
 * Debounced to avoid flooding the API.
 */
function auditSingleCaptionRealTime(caption) {
  // Debounce: wait 2 seconds after last caption before auditing
  if (auditDebounceTimer) {
    clearTimeout(auditDebounceTimer);
  }

  auditDebounceTimer = setTimeout(async () => {
    try {
      const text = caption.text;
      if (!text || text.trim().length < 10) return;

      const response = await fetch(`${backendUrl}/api/audit-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
      });

      if (!response.ok) return;
      const result = await response.json();

      if (result.detected_biases && result.detected_biases.length > 0) {
        showLiveBiasAlert(caption, result);
      }
    } catch (err) {
      console.error('Real-time audit error:', err);
    }
  }, 2000);
}

/**
 * Show a live bias alert in the sidebar during recording.
 */
function showLiveBiasAlert(caption, auditResult) {
  const alertsContainer = document.getElementById('live-bias-alerts');
  const alertsList = document.getElementById('live-bias-alerts-list');
  if (!alertsContainer || !alertsList) return;

  alertsContainer.style.display = 'block';

  const biasIcons = auditResult.detected_biases
    .map(b => `${BIAS_EMOJIS[b] || ''} ${b.replace(/_/g, ' ')}`)
    .join(', ');

  const alertDiv = document.createElement('div');
  alertDiv.style.cssText = 'padding: 4px 0; border-bottom: 1px solid #f8bbd0; font-size: 11px;';
  alertDiv.innerHTML = `<b>${caption.speaker}:</b> ${biasIcons} <span style="color: #888;">(score: ${auditResult.score})</span>`;

  // Prepend (newest first)
  alertsList.insertBefore(alertDiv, alertsList.firstChild);

  // Keep max 10 alerts visible
  while (alertsList.children.length > 10) {
    alertsList.removeChild(alertsList.lastChild);
  }
}

/**
 * On-demand: full decision quality audit (button click).
 * Uses /api/audit-decisions for decision block analysis.
 */
async function auditDecisionQuality() {
  if (!captionData || captionData.length === 0) {
    alert('No captions to audit. Record a meeting first.');
    return;
  }

  const statusElement = document.getElementById('sidebar-status');
  if (statusElement) {
    statusElement.textContent = 'Running decision quality audit...';
  }

  try {
    const response = await fetch(`${backendUrl}/api/audit-decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(captionData)
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const report = await response.json();
    renderAuditReport(report, 'decisions');

    if (statusElement) {
      statusElement.textContent = 'Audit complete!';
      setTimeout(() => {
        statusElement.textContent = isRecording ? 'Recording in progress...' : 'Not recording';
      }, 2000);
    }
  } catch (error) {
    console.error('Audit error:', error);
    if (statusElement) {
      statusElement.textContent = 'Audit failed: ' + error.message;
      setTimeout(() => {
        statusElement.textContent = isRecording ? 'Recording in progress...' : 'Not recording';
      }, 3000);
    }
  }
}

/**
 * Auto: runs per-speaker audit when recording stops.
 */
async function runPerSpeakerAudit() {
  if (!captionData || captionData.length === 0) return;

  try {
    const response = await fetch(`${backendUrl}/api/audit-per-speaker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(captionData)
    });

    if (!response.ok) {
      console.error('Per-speaker audit failed:', response.status);
      return;
    }

    const report = await response.json();
    renderAuditReport(report, 'per-speaker');
  } catch (error) {
    console.error('Per-speaker audit error:', error);
  }
}

/**
 * Render the audit report in the sidebar.
 * @param {object} report — audit report data
 * @param {string} mode — 'decisions' | 'per-speaker'
 */
function renderAuditReport(report, mode) {
  const container = document.getElementById('audit-report-container');
  const content = document.getElementById('audit-report-content');
  if (!container || !content) return;

  container.style.display = 'block';

  if (mode === 'per-speaker') {
    // ─── Per-speaker audit report ───
    const audits = report.speaker_audits || [];
    if (audits.length === 0) {
      content.innerHTML = '<p>No speaker data available for analysis.</p>';
      return;
    }

    let html = '<div style="margin-bottom: 8px;">';
    html += '<b>Per-Speaker Decision Quality</b>';
    html += '</div>';

    audits.forEach(sa => {
      const grade = sa.score >= 75 ? '🟢' : sa.score >= 50 ? '🟡' : '🔴';
      const scoreColor = sa.score >= 75 ? '#2e7d32' : sa.score >= 50 ? '#f57f17' : '#c62828';

      html += `<div style="border: 1px solid #e0e0e0; border-radius: 6px; padding: 8px; margin-bottom: 8px; background: white;">`;
      html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">`;
      html += `<b>${sa.speaker}</b>`;
      html += `<span style="color: ${scoreColor}; font-weight: bold;">${grade} ${sa.score}/100</span>`;
      html += `</div>`;
      html += `<div style="color: #666; font-size: 11px; margin-bottom: 4px;">${sa.caption_count} caption(s)</div>`;

      if (sa.message) {
        html += `<div style="color: #999; font-style: italic;">${sa.message}</div>`;
      } else {
        if (sa.detected_biases && sa.detected_biases.length > 0) {
          const biasHtml = sa.detected_biases
            .map(b => `<span style="display: inline-block; background: #ffebee; color: #c62828; padding: 1px 6px; border-radius: 10px; margin: 1px; font-size: 10px;">${BIAS_EMOJIS[b] || ''} ${b.replace(/_/g, ' ')}</span>`)
            .join('');
          html += `<div style="margin-bottom: 4px;">${biasHtml}</div>`;
        } else {
          html += `<div style="color: #2e7d32; font-size: 11px;">✅ No biases detected</div>`;
        }

        if (sa.recommendations && sa.recommendations.length > 0) {
          html += '<div style="margin-top: 4px;">';
          sa.recommendations.forEach(rec => {
            html += `<div style="font-size: 11px; color: #555; padding-left: 8px;">→ ${rec}</div>`;
          });
          html += '</div>';
        }
      }
      html += '</div>';
    });

    content.innerHTML = html;

  } else {
    // ─── Decision-block audit report ───
    const meetingScore = report.meeting_score ?? 100;
    const decisions = report.decisions || [];
    const grade = meetingScore >= 75 ? '🟢' : meetingScore >= 50 ? '🟡' : '🔴';
    const scoreColor = meetingScore >= 75 ? '#2e7d32' : meetingScore >= 50 ? '#f57f17' : '#c62828';

    let html = `<div style="text-align: center; margin-bottom: 10px; padding: 8px; background: white; border-radius: 6px;">`;
    html += `<div style="font-size: 18px; font-weight: bold; color: ${scoreColor};">${grade} ${meetingScore}/100</div>`;
    html += `<div style="font-size: 11px; color: #666;">Meeting Health Score &middot; ${report.total_decisions || 0} decisions</div>`;
    if (report.most_common_bias) {
      html += `<div style="font-size: 11px; color: #c62828;">Most common: ${BIAS_EMOJIS[report.most_common_bias.name] || ''} ${report.most_common_bias.name.replace(/_/g, ' ')} (×${report.most_common_bias.count})</div>`;
    }
    html += '</div>';

    if (report.message) {
      html += `<div style="color: #999; font-style: italic; text-align: center;">${report.message}</div>`;
    }

    decisions.forEach(d => {
      const dGrade = d.score >= 75 ? '🟢' : d.score >= 50 ? '🟡' : '🔴';
      html += `<div style="border: 1px solid #e0e0e0; border-radius: 6px; padding: 8px; margin-bottom: 8px; background: white;">`;
      html += `<div style="display: flex; justify-content: space-between; align-items: center;">`;
      html += `<b>${d.speaker}</b> <span style="font-size: 11px; color: #888;">${d.timestamp || ''}</span>`;
      html += `</div>`;
      html += `<div style="font-size: 11px; color: #555; margin: 4px 0; font-style: italic;">"${d.trigger}"</div>`;
      html += `<div style="font-weight: bold;">${dGrade} Score: ${d.score}/100</div>`;

      if (d.detected_biases && d.detected_biases.length > 0) {
        const biasHtml = d.detected_biases
          .map(b => `<span style="display: inline-block; background: #ffebee; color: #c62828; padding: 1px 6px; border-radius: 10px; margin: 1px; font-size: 10px;">${BIAS_EMOJIS[b] || ''} ${b.replace(/_/g, ' ')}</span>`)
          .join('');
        html += `<div style="margin: 4px 0;">${biasHtml}</div>`;
      }

      if (d.recommendations && d.recommendations.length > 0) {
        d.recommendations.forEach(rec => {
          html += `<div style="font-size: 11px; color: #555; padding-left: 8px;">→ ${rec}</div>`;
        });
      }
      html += '</div>';
    });

    content.innerHTML = html;
  }
}