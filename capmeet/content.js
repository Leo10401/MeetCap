// content.js - Modified to capture live caption updates more frequently
let captionData = [];
let isRecording = false;
let lastProcessedText = '';
let lastProcessedTimestamp = 0;
let captionObserver = null;
let capturedCaptions = [];
let sidebarInjected = false;
let backendUrl = 'http://localhost:3000'; // Default backend server URL

// Load settings when extension starts
chrome.storage.sync.get(['backendUrl'], function(result) {
  if (result.backendUrl) {
    backendUrl = result.backendUrl;
  }
});

// Function to inject sidebar into Google Meet
function injectSidebar() {
  if (sidebarInjected) return;
  
  // Inject sidebar CSS
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.href = chrome.runtime.getURL('sidebar.css');
  document.head.appendChild(cssLink);
  
  // Create sidebar container
  const sidebar = document.createElement('div');
  sidebar.id = 'caption-saver-sidebar';
  sidebar.style.position = 'fixed';
  sidebar.style.top = '0';
  sidebar.style.right = '0';
  sidebar.style.width = '300px';
  sidebar.style.height = '100%';
  sidebar.style.backgroundColor = 'white';
  sidebar.style.boxShadow = '-2px 0 5px rgba(0,0,0,0.2)';
  sidebar.style.zIndex = '9999';
  sidebar.style.display = 'flex';
  sidebar.style.flexDirection = 'column';
  sidebar.style.transition = 'transform 0.3s ease-in-out';
  sidebar.style.transform = 'translateX(300px)';
  
  // Create sidebar content
  sidebar.innerHTML = `
    <div style="padding: 15px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;">
      <h2 style="margin: 0; font-size: 16px;">Google Meet Caption Saver</h2>
      <div>
        <button id="sidebar-settings" style="background: none; border: none; cursor: pointer; margin-right: 5px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
        <button id="sidebar-toggle" style="background: none; border: none; cursor: pointer;">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    </div>
    <div style="padding: 15px; display: flex; flex-direction: column; height: 100%;">
      <button id="sidebar-record-button" style="padding: 8px 12px; margin-bottom: 10px; width: 100%; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Start Recording Captions
      </button>
      <button id="sidebar-export-button" style="padding: 8px 12px; margin-bottom: 10px; width: 100%; background-color: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Export Saved Captions
      </button>
      <button id="sidebar-summarize-button" style="padding: 8px 12px; margin-bottom: 15px; width: 100%; background-color: #9C27B0; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Summarize with AI
      </button>
      <div id="sidebar-status" style="margin-bottom: 10px;">Not recording</div>
      <div style="border-top: 1px solid #ddd; padding-top: 10px; flex: 1; display: flex; flex-direction: column;">
        <h3 style="font-size: 14px; margin-top: 0;">Live Captions</h3>
        <div id="sidebar-captions-list" style="flex: 1; overflow-y: auto;">
          <p class="no-captions">No captions yet. Start recording to capture captions.</p>
        </div>
      </div>
      <div id="summary-container" style="border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px; display: none;">
        <h3 style="font-size: 14px; margin-top: 0;">AI Summary</h3>
        <div id="summary-content" style="max-height: 200px; overflow-y: auto; padding: 8px; background-color: #f5f5f5; border-radius: 4px;">
          No summary available yet.
        </div>
      </div>
    </div>
  `;
  
  // Add sidebar to the page
  document.body.appendChild(sidebar);
  
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
  settingsModal.style.backgroundColor = 'rgba(0,0,0,0.5)';
  settingsModal.innerHTML = `
    <div style="position: relative; background-color: white; margin: 15% auto; padding: 20px; width: 400px; border-radius: 4px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
      <button id="close-settings" style="position: absolute; top: 10px; right: 10px; background: none; border: none; cursor: pointer;">×</button>
      <h3 style="margin-top: 0;">Settings</h3>
      <div style="margin-bottom: 15px;">
        <label for="backend-url" style="display: block; margin-bottom: 5px;">Backend Server URL:</label>
        <input id="backend-url" type="text" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="${backendUrl}">
      </div>
      <button id="save-settings" style="padding: 8px 16px; background-color: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer;">Save Settings</button>
    </div>
  `;
  document.body.appendChild(settingsModal);
  
  // Add sidebar toggle button to the page
  const toggleButton = document.createElement('button');
  toggleButton.id = 'caption-saver-toggle';
  toggleButton.style.position = 'fixed';
  toggleButton.style.top = '10px';
  toggleButton.style.right = '10px';
  toggleButton.style.zIndex = '9998';
  toggleButton.style.backgroundColor = '#1a73e8';
  toggleButton.style.color = 'white';
  toggleButton.style.border = 'none';
  toggleButton.style.borderRadius = '50%';
  toggleButton.style.width = '48px';
  toggleButton.style.height = '48px';
  toggleButton.style.cursor = 'pointer';
  toggleButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  toggleButton.innerHTML = `
<svg width="36px" height="36px" viewBox="0 0 400.00 400.00" fill="none" xmlns="http://www.w3.org/2000/svg" transform="rotate(0)"><g id="SVGRepo_bgCarrier" stroke-width="0" transform="translate(14,14), scale(0.93)"><rect x="0" y="0" width="400.00" height="400.00" rx="200" fill="#00ccaa" strokewidth="0"></rect></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#CCCCCC" stroke-width="3.2"></g><g id="SVGRepo_iconCarrier"> <path d="M97.8357 54.6682C177.199 59.5311 213.038 52.9891 238.043 52.9891C261.298 52.9891 272.24 129.465 262.683 152.048C253.672 173.341 100.331 174.196 93.1919 165.763C84.9363 156.008 89.7095 115.275 89.7095 101.301" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M98.3318 190.694C-10.6597 291.485 121.25 273.498 148.233 295.083" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M98.3301 190.694C99.7917 213.702 101.164 265.697 100.263 272.898" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M208.308 136.239C208.308 131.959 208.308 127.678 208.308 123.396" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M177.299 137.271C177.035 133.883 177.3 126.121 177.3 123.396" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M203.398 241.72C352.097 239.921 374.881 226.73 312.524 341.851" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M285.55 345.448C196.81 341.85 136.851 374.229 178.223 264.504" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M180.018 345.448C160.77 331.385 139.302 320.213 120.658 304.675" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M218.395 190.156C219.024 205.562 219.594 220.898 219.594 236.324" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M218.395 190.156C225.896 202.037 232.97 209.77 241.777 230.327" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M80.1174 119.041C75.5996 120.222 71.0489 119.99 66.4414 120.41" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M59.5935 109.469C59.6539 117.756 59.5918 125.915 58.9102 134.086" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M277.741 115.622C281.155 115.268 284.589 114.823 287.997 114.255" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M291.412 104.682C292.382 110.109 292.095 115.612 292.095 121.093" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M225.768 116.466C203.362 113.993 181.657 115.175 160.124 118.568" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
  `;
  document.body.appendChild(toggleButton);
  
  // Set up event listeners
  document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
  document.getElementById('caption-saver-toggle').addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-record-button').addEventListener('click', toggleRecording);
  document.getElementById('sidebar-export-button').addEventListener('click', exportCaptions);
  document.getElementById('sidebar-summarize-button').addEventListener('click', summarizeCaptions);
  document.getElementById('sidebar-settings').addEventListener('click', toggleSettings);
  document.getElementById('close-settings').addEventListener('click', toggleSettings);
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  
  // Create download link element (hidden)
  const downloadLink = document.createElement('a');
  downloadLink.id = 'sidebar-download-link';
  downloadLink.style.display = 'none';
  document.body.appendChild(downloadLink);
  
  sidebarInjected = true;
  
  // Load initial caption data
  loadSavedCaptions();
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

// Toggle sidebar visibility
function toggleSidebar() {
  const sidebar = document.getElementById('caption-saver-sidebar');
  if (sidebar) {
    if (sidebar.style.transform === 'translateX(0px)') {
      sidebar.style.transform = 'translateX(300px)';
    } else {
      sidebar.style.transform = 'translateX(0px)';
    }
  }
}

// Toggle recording
function toggleRecording() {
  const recordButton = document.getElementById('sidebar-record-button');
  const statusElement = document.getElementById('sidebar-status');
  const captionsList = document.getElementById('sidebar-captions-list');
  
  if (isRecording) {
    stopRecording();
    recordButton.textContent = "Start Recording Captions";
    recordButton.style.backgroundColor = "#4CAF50";
    statusElement.textContent = "Not recording";
  } else {
    // Clear the captions list display when starting new recording
    if (captionsList) {
      captionsList.innerHTML = '<p class="no-captions">Starting new recording session...</p>';
    }
    
    startRecording();
    recordButton.textContent = "Stop Recording";
    recordButton.style.backgroundColor = "#f44336";
    statusElement.textContent = "Recording in progress...";
  }
}

// Export captions
function exportCaptions() {
  chrome.storage.local.get(null, function(items) {
    let allCaptions = [];
    
    // Filter for only caption data
    Object.keys(items).forEach(key => {
      if (key.startsWith('meet_captions_')) {
        items[key].forEach(entry => {
          allCaptions.push(entry);
        });
      }
    });
    
    if (allCaptions.length > 0) {
      // Format captions for export
      const jsonData = JSON.stringify(allCaptions, null, 2);
      const blob = new Blob([jsonData], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      
      const downloadLink = document.getElementById('sidebar-download-link');
      downloadLink.href = url;
      downloadLink.download = `google_meet_captions_${new Date().toISOString().slice(0,10)}.json`;
      downloadLink.click();
      
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      const statusElement = document.getElementById('sidebar-status');
      if (statusElement) {
        statusElement.textContent = "Captions exported";
      }
    } else {
      const statusElement = document.getElementById('sidebar-status');
      if (statusElement) {
        statusElement.textContent = "No captions to export";
      }
    }
  });
}

// Load and display saved captions
function loadSavedCaptions() {
  const captionsList = document.getElementById('sidebar-captions-list');
  if (!captionsList) return;
  
  // Clear current captions
  captionsList.innerHTML = '';
  
  // Add recent captions from current session
  if (capturedCaptions.length > 0) {
    capturedCaptions.forEach(caption => {
      addCaptionToSidebar(caption);
    });
  } else {
    // Show no captions message
    const noCaption = document.createElement('p');
    noCaption.className = 'no-captions';
    noCaption.textContent = 'No captions yet. Start recording to capture captions.';
    captionsList.appendChild(noCaption);
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
    'div[role="region"][aria-label="Captions"]',
    '.nMcdL.bj4p3b',
    '.adE6rb',
    '.iOzk7'
  ];
  
  for (const selector of containerSelectors) {
    const container = document.querySelector(selector);
    if (container) return container;
  }
  
  return null;
}

// Process all captions in the container
function processCaptions() {
  const container = findCaptionContainer();
  if (!container) return;
  
  // Get all caption elements using the specific class names
  const captionElements = container.querySelectorAll('.bh44bd.VbkSUe, .KcIKyf.jxFHg, .KcIKyf, .nMcdL.bj4p3b');
  
  if (!captionElements || captionElements.length === 0) return;
  
  // Get the latest caption element
  const latestCaptionElement = Array.from(captionElements).pop();
  if (!latestCaptionElement) return;
  
  // Get the complete caption text
  const textElement = latestCaptionElement.querySelector('.bh44bd.VbkSUe') || latestCaptionElement;
  const newText = textElement.textContent.trim();
  
  // Skip if this is the same text we just processed
  if (newText === lastProcessedText) return;
  
  // Use our improved extract function to get speaker name
  const speakerName = extractSpeakerName(latestCaptionElement);
  
  // Remove speaker name from text if present
  let captionText = newText;
  if (speakerName !== 'Unknown') {
    // Try different separator patterns
    captionText = newText.replace(`${speakerName}:`, '')
                        .replace(`${speakerName}：`, '')
                        .replace(`${speakerName} :`, '')
                        .replace(`${speakerName} ：`, '')
                        .trim();
  }
  
  // If the caption text is still the same as newText and contains a colon,
  // try to extract speaker name and text
  if (captionText === newText && newText.includes(':')) {
    const parts = newText.split(':');
    if (parts.length >= 2) {
      captionText = parts.slice(1).join(':').trim();
    }
  }
  
  // Skip if we don't have meaningful text or if it's UI text
  if (!captionText || isLikelyUIText(captionText)) return;
  
  // Update last processed text
  lastProcessedText = newText;
  
  // Check if the last caption has the same speaker
  if (capturedCaptions.length > 0) {
    const lastCaption = capturedCaptions[capturedCaptions.length - 1];
    if (lastCaption.speaker === speakerName) {
      // Update the existing caption
      lastCaption.text = captionText;
      lastCaption.timestamp = new Date().toISOString();
      
      // Also update in captionData for compatibility
      if (captionData.length > 0) {
        const lastCaptionData = captionData[captionData.length - 1];
        if (lastCaptionData.speaker === speakerName) {
          lastCaptionData.text = captionText;
          lastCaptionData.timestamp = new Date().toISOString();
        }
      }
      
      // Update the sidebar display for this caption
      updateSidebarCaption(lastCaption);
      
      // Notify popup of updated caption
      chrome.runtime.sendMessage({
        action: "updatedCaption",
        entry: lastCaption
      });
      
      return; // Skip adding a new caption
    }
  }
  
  // Generate a unique ID for this caption
  const captionId = `${speakerName}-${captionText.substring(0, 20)}`;
  
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
    timestamp: new Date().toISOString()
  });
  
  // Add to sidebar
  addCaptionToSidebar(newCaption);
  
  // Notify popup of new caption
  chrome.runtime.sendMessage({
    action: "newCaption",
    entry: newCaption
  });
  
  // Save more frequently
  if (capturedCaptions.length % 3 === 0) {
    saveCaptionData();
  }
}

// Function to update caption in sidebar
function updateSidebarCaption(caption) {
  if (!sidebarInjected) return;
  
  const captionsList = document.getElementById('sidebar-captions-list');
  if (!captionsList) return;
  
  // Look for existing caption with this ID
  const captionElement = document.getElementById(`caption-${caption.id}`);
  if (captionElement) {
    // Update the text content
    const textElement = captionElement.querySelector('.caption-text');
    if (textElement) {
      textElement.textContent = caption.text;
    }
  } else {
    // If not found, add it
    addCaptionToSidebar(caption);
  }
}

// Function to add caption to sidebar
function addCaptionToSidebar(caption) {
  if (!sidebarInjected) return;
  
  const captionsList = document.getElementById('sidebar-captions-list');
  if (!captionsList) return;
  
  // Remove "No captions" message if present
  const noCaption = captionsList.querySelector('.no-captions');
  if (noCaption) {
    captionsList.removeChild(noCaption);
  }
  
  // Create caption element
  const captionElement = document.createElement('div');
  captionElement.id = `caption-${caption.id}`;
  captionElement.className = 'caption-entry';
  captionElement.style.marginBottom = '8px';
  captionElement.style.borderBottom = '1px solid #eee';
  captionElement.style.paddingBottom = '8px';
  
  // Add timestamp (in a human-readable format)
  const time = new Date(caption.timestamp);
  const timeElement = document.createElement('div');
  timeElement.className = 'caption-time';
  timeElement.style.fontSize = '11px';
  timeElement.style.color = '#5f6368';
  timeElement.style.marginBottom = '2px';
  timeElement.textContent = time.toLocaleTimeString();
  
  // Add speaker
  const speakerElement = document.createElement('span');
  speakerElement.className = 'caption-speaker';
  speakerElement.style.fontWeight = 'bold';
  speakerElement.style.color = '#1a73e8';
  speakerElement.textContent = caption.speaker + ': ';
  
  // Add text
  const textElement = document.createElement('span');
  textElement.className = 'caption-text';
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
}

// Function to start recording captions
function startRecording() {
  isRecording = true;
  console.log('Caption recording started');
  
  // Clear previous caption data
  captionData = [];
  capturedCaptions = [];
  
  // Clear previously saved captions from storage
  clearPreviousCaptions();
  
  // Set up the caption observer right away
  setupCaptionObserver();
  
  // Notify popup that recording has started
  chrome.runtime.sendMessage({action: "recordingStatus", status: true});
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

// Set up mutation observer for captions
function setupCaptionObserver() {
  if (captionObserver) {
    captionObserver.disconnect();
  }
  
  captionObserver = new MutationObserver((mutations) => {
    if (isRecording) {
      // Only process if there are actual changes to caption content
      const hasCaptionChanges = mutations.some(mutation => {
        return mutation.type === 'childList' || 
               (mutation.type === 'characterData' && mutation.target.textContent.trim());
      });
      
      if (hasCaptionChanges) {
        processCaptions();
      }
    }
  });
  
  // Observe the entire document for caption container changes
  captionObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
  
  // Do an initial process
  processCaptions();
}

// Check if text is likely UI text rather than captions
function isLikelyUIText(text) {
  const uiKeywords = ['button', 'menu', 'click', 'settings', 'meeting', 'leave', 
                    'join', 'mute', 'unmute', 'camera', 'microphone', 'share',
                    'present', 'raise hand', 'participants', 'chat', 'more'];
  
  const lowerText = text.toLowerCase();
  for (const keyword of uiKeywords) {
    if (lowerText === keyword) { // Only exact matches for UI elements
      return true;
    }
  }
  
  // UI elements typically have very short text
  if (text.length < 3) return true;
  
  return false;
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

// Initialize when content script loads
console.log('Google Meet Caption Saver initialized - Live caption recording enabled');

// Inject the sidebar into the page
injectSidebar();

// Start checking for captions after a short delay
setTimeout(() => {
  console.log('Ready to capture captions in real-time');
  // Initialize all observer methods for maximum coverage
  setupCaptionObserver();
}, 1000);

// Summarize captions using backend AI service
function summarizeCaptions() {
  const statusElement = document.getElementById('sidebar-status');
  const summaryContainer = document.getElementById('summary-container');
  const summaryContent = document.getElementById('summary-content');
  
  if (!capturedCaptions || capturedCaptions.length === 0) {
    if (statusElement) {
      statusElement.textContent = "No captions to summarize";
    }
    return;
  }
  
  if (statusElement) {
    statusElement.textContent = "Generating summary...";
  }
  
  // Show the summary container
  if (summaryContainer) {
    summaryContainer.style.display = 'block';
    summaryContent.textContent = "Generating summary...";
  }
  
  // Send the captions to the backend for summarization
  fetch(`${backendUrl}/api/summarize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(capturedCaptions)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    // Display the summary
    if (summaryContent) {
      summaryContent.textContent = data.summary;
    }
    if (statusElement) {
      statusElement.textContent = "Summary generated successfully";
    }
  })
  .catch(error => {
    console.error('Error summarizing captions:', error);
    if (summaryContent) {
      summaryContent.textContent = "Failed to generate summary. Please try again.";
    }
    if (statusElement) {
      statusElement.textContent = "Error generating summary";
    }
  });
}