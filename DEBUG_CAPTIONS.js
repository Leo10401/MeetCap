// ========================================
// DEBUG SCRIPT: Run this in browser console during a Google Meet call
// ========================================

console.log("=== DEBUGGING GOOGLE MEET CAPTION STRUCTURE ===\n");

// 1. Find caption regions
const captionRegions = document.querySelectorAll('[role="region"]');
console.log(`Found ${captionRegions.length} caption regions:`, captionRegions);

// 2. Search for caption-related elements
const allDivs = document.querySelectorAll('div');
console.log(`\nSearching through ${allDivs.length} divs for caption text...\n`);

// 3. Find elements containing caption-like text (short, speaker pattern)
const captionLikeElements = [];
allDivs.forEach(div => {
  const text = div.textContent.trim();
  if (text && text.length > 0 && text.length < 500 && !text.includes('\n\n')) {
    // Check if it looks like a caption (has speaker name pattern or is short)
    if ((text.includes(':') && text.length < 200) || (text.length < 50 && text.match(/^[A-Z]/))) {
      captionLikeElements.push({
        text: text.substring(0, 100),
        classes: div.className,
        id: div.id,
        tagName: div.tagName,
        ariaLabel: div.getAttribute('aria-label'),
        role: div.getAttribute('role')
      });
    }
  }
});

console.log(`Found ${captionLikeElements.length} potential caption elements:`);
captionLikeElements.slice(0, 10).forEach(el => {
  console.log(`  Text: "${el.text}"`);
  console.log(`  Classes: ${el.classes}`);
  console.log(`  ID: ${el.id}`);
  console.log(`  Tag: ${el.tagName}`);
  console.log(`  Role: ${el.role}, Aria-Label: ${el.ariaLabel}`);
  console.log('  ---');
});

// 4. Look for specific caption container
console.log("\n=== CHECKING KNOWN SELECTORS ===\n");
const selectors = [
  'div[role="region"][aria-label="Captions"]',
  '.nMcdL.bj4p3b',
  '.adE6rb',
  '.iOzk7',
  '.bh44bd',
  '.KcIKyf',
  '[aria-label*="caption" i]',
  '[role="status"]',
  '.A8eI7d', // Common class in recent Google Meet
  '.u7LVg',  // Another common class
];

selectors.forEach(selector => {
  const elements = document.querySelectorAll(selector);
  if (elements.length > 0) {
    console.log(`✓ Found ${elements.length} elements with selector: "${selector}"`);
    if (elements.length <= 3) {
      elements.forEach((el, idx) => {
        console.log(`  [${idx}] Text: "${el.textContent.substring(0, 50)}"`);
      });
    }
  }
});

// 5. Monitor for new caption text
console.log("\n=== MONITORING CAPTIONS (speak something to see live updates) ===\n");

const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    if (mutation.type === 'childList' || mutation.type === 'characterData') {
      const text = mutation.target.textContent?.trim();
      if (text && text.length > 3 && text.length < 200) {
        const target = mutation.target;
        console.log(`📝 New text detected: "${text}"`);
        console.log(`   Target classes: ${target.className}`);
        console.log(`   Parent classes: ${target.parentElement?.className}`);
        console.log(`   Parent role: ${target.parentElement?.getAttribute('role')}`);
      }
    }
  });
});

// Observe the entire document body
observer.observe(document.body, {
  subtree: true,
  characterData: true,
  childList: true
});

console.log("Monitor started. Speak in the meeting to see caption updates.");
console.log("When done, run: observer.disconnect();");
