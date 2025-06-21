// Copy and paste this into your browser console to capture tokens

// Override fetch to capture authorization headers
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const [url, options = {}] = args;
  
  // Check if this is a Protect API request
  if (url.includes('/proxy/protect/') || url.includes('/api/')) {
    console.log('🔍 API Request detected:', url);
    
    // Log headers
    if (options.headers) {
      console.log('📋 Headers:', options.headers);
      
      // Look for authorization
      if (options.headers.Authorization) {
        console.log('🔑 Authorization header found:', options.headers.Authorization);
      }
      if (options.headers['X-API-KEY']) {
        console.log('🔑 API Key found:', options.headers['X-API-KEY']);
      }
    }
    
    // Log cookies
    console.log('🍪 Cookies:', document.cookie);
  }
  
  return originalFetch.apply(this, args);
};

// Override XMLHttpRequest to capture headers
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url, ...args) {
  this._url = url;
  return originalXHROpen.apply(this, [method, url, ...args]);
};

XMLHttpRequest.prototype.send = function(data) {
  if (this._url && (this._url.includes('/proxy/protect/') || this._url.includes('/api/'))) {
    console.log('🔍 XHR Request detected:', this._url);
    
    // Log request headers
    const authHeader = this.getRequestHeader('Authorization');
    if (authHeader) {
      console.log('🔑 Authorization header found:', authHeader);
    }
    
    const apiKeyHeader = this.getRequestHeader('X-API-KEY');
    if (apiKeyHeader) {
      console.log('🔑 API Key found:', apiKeyHeader);
    }
  }
  
  return originalXHRSend.apply(this, [data]);
};

console.log('🔍 Token capture script loaded!');
console.log('📋 Now navigate around the UDM Pro interface to capture tokens...'); 