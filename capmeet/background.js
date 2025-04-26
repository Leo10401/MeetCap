chrome.runtime.onInstalled.addListener(() => {
    console.log('Google Meet Caption Saver extension installed');
  });
  
  // Listen for tab updates to inject the content script when on Google Meet
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url.includes('meet.google.com')) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).catch(err => console.error('Script injection failed:', err));
    }
  });

  