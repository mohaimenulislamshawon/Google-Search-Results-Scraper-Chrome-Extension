// content.js - Content script that runs on Google search pages
// This provides direct access to the page DOM

(function() {
  'use strict';
  
  // Prevent multiple injections
  if (window.googleScraperInjected) {
    return;
  }
  window.googleScraperInjected = true;
  
  console.log('[Google Scraper] Content script loaded');
  
  // Listen for messages from the popup or background script
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === 'scrapeCurrentPage') {
      const data = scrapePageContent();
      sendResponse({ success: true, data: data });
    } else if (message.action === 'clickNextButton') {
      const result = clickNext();
      sendResponse({ success: result });
    } else if (message.action === 'checkNextButton') {
      const hasNext = hasNextButton();
      sendResponse({ hasNext: hasNext });
    }
    
    return true;
  });
  
  // Extract all visible text content from the search results
  function scrapePageContent() {
    const results = [];
    
    // Get search query
    const searchBox = document.querySelector('input[name="q"], textarea[name="q"]');
    const query = searchBox ? searchBox.value : '';
    
    // Get current page info
    const pageInfo = getCurrentPageNumber();
    
    results.push('=' .repeat(50));
    results.push(`SEARCH QUERY: ${query}`);
    results.push(`PAGE: ${pageInfo}`);
    results.push('='.repeat(50));
    results.push('');
    
    // Get organic search results
    const searchResults = document.querySelectorAll('#search .g, #rso .g, .MjjYud, [data-hveid]');
    let resultCount = 0;
    
    searchResults.forEach((result) => {
      // Skip if it's an ad or featured snippet container
      if (result.closest('[data-ads-id]') || result.closest('.commercial-unit-desktop-rhs')) {
        return;
      }
      
      const titleEl = result.querySelector('h3');
      const linkEl = result.querySelector('a[href^="http"]:not([href*="google.com/search"])');
      const snippetEl = result.querySelector('.VwiC3b, .IsZvec, .s3v9rd, [data-sncf]');
      
      const title = titleEl ? titleEl.textContent.trim() : '';
      const url = linkEl ? linkEl.href : '';
      const snippet = snippetEl ? snippetEl.textContent.trim() : '';
      
      // Only add if we have meaningful content
      if (title && (url || snippet)) {
        resultCount++;
        results.push(`--- Result #${resultCount} ---`);
        results.push(`Title: ${title}`);
        if (url) results.push(`URL: ${url}`);
        if (snippet) results.push(`Snippet: ${snippet}`);
        results.push('');
      }
    });
    
    // Get People Also Ask questions if present
    const paaQuestions = document.querySelectorAll('[data-q]');
    if (paaQuestions.length > 0) {
      results.push('--- People Also Ask ---');
      paaQuestions.forEach((q) => {
        const question = q.getAttribute('data-q') || q.textContent.trim();
        if (question) {
          results.push(`• ${question}`);
        }
      });
      results.push('');
    }
    
    // Get Related Searches if present
    const relatedSearches = document.querySelectorAll('.s75CSd, .k8XOCe, .Q71vJc');
    if (relatedSearches.length > 0) {
      results.push('--- Related Searches ---');
      relatedSearches.forEach((rs) => {
        const text = rs.textContent.trim();
        if (text && text.length > 0) {
          results.push(`• ${text}`);
        }
      });
      results.push('');
    }
    
    // If no structured results found, fallback to raw text
    if (resultCount === 0) {
      const mainContent = document.querySelector('#main, #center_col, #search, #rso');
      if (mainContent) {
        results.push('--- Raw Page Content ---');
        results.push(mainContent.innerText.substring(0, 10000)); // Limit raw content
      }
    }
    
    return results.join('\n');
  }
  
  // Get current page number
  function getCurrentPageNumber() {
    // Try to find the current page indicator
    const currentPage = document.querySelector('td.YyVfkd, .SJajHc b, [aria-current="page"]');
    if (currentPage) {
      return currentPage.textContent.trim();
    }
    
    // Try to parse from URL
    const urlParams = new URLSearchParams(window.location.search);
    const start = parseInt(urlParams.get('start') || '0');
    return Math.floor(start / 10) + 1;
  }
  
  // Check if Next button exists
  function hasNextButton() {
    return findNextButton() !== null;
  }
  
  // Find the Next button
  function findNextButton() {
    // Primary selector - the standard Google Next button
    let nextBtn = document.querySelector('#pnnext');
    if (nextBtn) return nextBtn;
    
    // Alternative selectors
    nextBtn = document.querySelector('a[aria-label="Next page"]');
    if (nextBtn) return nextBtn;
    
    nextBtn = document.querySelector('a[aria-label="Next"]');
    if (nextBtn) return nextBtn;
    
    // Look for the span with class oeN89d containing "Next"
    const spans = document.querySelectorAll('span');
    for (const span of spans) {
      if (span.textContent.trim() === 'Next') {
        const parentLink = span.closest('a');
        if (parentLink && parentLink.href) {
          return parentLink;
        }
      }
    }
    
    // Check pagination table
    const paginationLinks = document.querySelectorAll('.d6cvqb a, .AaVjTc a, #navcnt a');
    for (const link of paginationLinks) {
      const text = link.textContent.toLowerCase().trim();
      const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
      if (text.includes('next') || ariaLabel.includes('next')) {
        return link;
      }
    }
    
    return null;
  }
  
  // Click the Next button
  function clickNext() {
    const nextBtn = findNextButton();
    if (nextBtn) {
      console.log('[Google Scraper] Clicking Next button:', nextBtn);
      nextBtn.click();
      return true;
    }
    console.log('[Google Scraper] No Next button found');
    return false;
  }
  
})();
