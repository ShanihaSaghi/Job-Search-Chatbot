// Configuration
const API_URL = 'http://localhost:5000/api/query';
const FILTER_API_URL = 'http://localhost:5000/api/filter';
const DATA_INFO_URL = 'http://localhost:5000/api/data/info';

// Global variables
let isLoading = false;
let isConnected = false;
let filterOptions = {};
let activeFilters = {};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    const userInput = document.getElementById('userInput');
    userInput.focus();
    
    // Check backend connection and load filter options
    checkBackendConnection();
    loadFilterOptions();
});

// Check if backend is available
async function checkBackendConnection() {
    try {
        const response = await fetch(API_URL.replace('/query', '/health'), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
    } catch (error) {
        isConnected = false;
        statusIndicator.classList.add('error');
        statusText.textContent = 'Backend Offline';
        console.error('Backend connection failed:', error);
        
        // Add error message
        setTimeout(() => {
            addMessage('system', 'Note: Backend is not connected. Make sure your Python server is running on http://localhost:5000');
        }, 500);
    }
}

// Load filter options from backend
async function loadFilterOptions() {
    try {
        const response = await fetch(DATA_INFO_URL);
        if (response.ok) {
            const data = await response.json();
            filterOptions = data.filter_options || {};
            
            // Populate filter dropdowns
            populateFilterDropdown('locationFilter', filterOptions.locations || []);
            populateFilterDropdown('companyFilter', filterOptions.companies || []);
            populateFilterDropdown('roleFilter', filterOptions.roles || []);
        }
    } catch (error) {
        console.error('Failed to load filter options:', error);
    }
}

// Populate dropdown with options
function populateFilterDropdown(elementId, options) {
    const select = document.getElementById(elementId);
    if (!select) return;
    
    // Keep the "All" option
    const allOption = select.querySelector('option[value=""]');
    select.innerHTML = '';
    if (allOption) select.appendChild(allOption);
    
    // Add options
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });
}

// Toggle filter panel
function toggleFilterPanel() {
    const filterPanel = document.getElementById('filterPanel');
    filterPanel.classList.toggle('active');
}

// Apply filters
async function applyFilters() {
    // Collect filter values
    const filters = {
        location: document.getElementById('locationFilter').value,
        company: document.getElementById('companyFilter').value,
        role: document.getElementById('roleFilter').value,
        skills: document.getElementById('skillsFilter').value
    };
    
    // Remove empty filters
    Object.keys(filters).forEach(key => {
        if (!filters[key]) delete filters[key];
    });
    
    // Check if any filters are applied
    if (Object.keys(filters).length === 0) {
        alert('Please select at least one filter');
        return;
    }
    
    // Store active filters
    activeFilters = filters;
    
    // Update active filters display
    updateActiveFiltersDisplay();
    
    // Close filter panel
    toggleFilterPanel();
    
    // Hide welcome screen
    const welcomeScreen = document.getElementById('welcomeScreen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }
    
    // Show loading
    isLoading = true;
    const sendBtn = document.getElementById('sendBtn');
    const userInput = document.getElementById('userInput');
    userInput.disabled = true;
    sendBtn.disabled = true;
    
    addLoadingMessage();
    
    try {
        // Call filter API
        const response = await fetch(FILTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filters })
        });
        
        if (!response.ok) {
            throw new Error('Filter request failed');
        }
        
        const data = await response.json();
        removeLoadingMessage();
        
        // Display results
        displayFilterResults(data.results, data.count);
        
    } catch (error) {
        console.error('Error:', error);
        removeLoadingMessage();
        addMessage('assistant', 'Sorry, I encountered an error processing your filters. Please try again.');
    } finally {
        isLoading = false;
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}

// Clear all filters
function clearFilters() {
    document.getElementById('locationFilter').value = '';
    document.getElementById('companyFilter').value = '';
    document.getElementById('roleFilter').value = '';
    document.getElementById('skillsFilter').value = '';
    
    activeFilters = {};
    updateActiveFiltersDisplay();
}

// Update active filters display
function updateActiveFiltersDisplay() {
    const container = document.getElementById('activeFilters');
    
    if (Object.keys(activeFilters).length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = '<div style="font-size: 13px; font-weight: 600; color: #6b7280; margin-bottom: 8px;">Active Filters:</div>';
    
    Object.keys(activeFilters).forEach(key => {
        const tag = document.createElement('div');
        tag.className = 'filter-tag';
        tag.innerHTML = `
            <span>${formatFilterLabel(key)}: ${activeFilters[key]}</span>
            <button onclick="removeFilter('${key}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        container.appendChild(tag);
    });
}

// Remove a single filter
function removeFilter(key) {
    delete activeFilters[key];
    
    // Clear the input
    const elementMap = {
        'location': 'locationFilter',
        'company': 'companyFilter',
        'role': 'roleFilter',
        'skills': 'skillsFilter'
    };
    
    const elementId = elementMap[key];
    if (elementId) {
        document.getElementById(elementId).value = '';
    }
    
    updateActiveFiltersDisplay();
    
    // Reapply filters if there are still active ones
    if (Object.keys(activeFilters).length > 0) {
        applyFilters();
    }
}

// Format filter label for display
function formatFilterLabel(key) {
    const labels = {
        'location': 'Location',
        'company': 'Company',
        'role': 'Role',
        'skills': 'Skills'
    };
    return labels[key] || key;
}

// Display filter results
function displayFilterResults(results, count) {
    let message = `Found ${count} matching result${count !== 1 ? 's' : ''}:\n\n`;
    
    if (count === 0) {
        message = 'No results found matching your filters. Try adjusting your criteria.';
        addMessage('assistant', message);
        return;
    }
    
    // Create a formatted table
    if (results.length > 0) {
        const keys = Object.keys(results[0]);
        
        message += '<div class="results-table"><table>';
        message += '<thead><tr>';
        keys.forEach(key => {
            message += `<th>${key}</th>`;
        });
        message += '</tr></thead><tbody>';
        
        results.forEach(row => {
            message += '<tr>';
            keys.forEach(key => {
                message += `<td>${escapeHtml(String(row[key] || ''))}</td>`;
            });
            message += '</tr>';
        });
        
        message += '</tbody></table></div>';
    }
    
    addMessage('assistant', message);
}

// Message handling
function addMessage(role, content) {
    const messagesArea = document.getElementById('messagesArea');
    
    // Hide welcome screen if it exists
    const welcomeScreen = document.getElementById('welcomeScreen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    let avatarHTML = '';
    if (role === 'user') {
        avatarHTML = `
            <div class="message-content">${escapeHtml(content)}</div>
            <div class="message-avatar">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
            </div>
        `;
    } else if (role === 'assistant') {
        avatarHTML = `
            <div class="message-avatar">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 8V4H8"/>
                    <rect width="16" height="12" x="4" y="8" rx="2"/>
                    <path d="M2 14h2"/>
                    <path d="M20 14h2"/>
                    <path d="M15 13v2"/>
                    <path d="M9 13v2"/>
                </svg>
            </div>
            <div class="message-content">${content.includes('<table>') ? content : formatMessage(content)}</div>
        `;
    } else if (role === 'system') {
        messageDiv.innerHTML = `<div class="message-content">${escapeHtml(content)}</div>`;
        messagesArea.appendChild(messageDiv);
        scrollToBottom();
        return;
    }
    
    messageDiv.innerHTML = avatarHTML;
    messagesArea.appendChild(messageDiv);
    scrollToBottom();
}

function addLoadingMessage() {
    const messagesArea = document.getElementById('messagesArea');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-message';
    loadingDiv.id = 'loadingMessage';
    loadingDiv.innerHTML = `
        <div class="message-avatar">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 8V4H8"/>
                <rect width="16" height="12" x="4" y="8" rx="2"/>
                <path d="M2 14h2"/>
                <path d="M20 14h2"/>
                <path d="M15 13v2"/>
                <path d="M9 13v2"/>
            </svg>
        </div>
        <div class="loading-content">
            <div class="loader"></div>
            <span>Analyzing your query...</span>
        </div>
    `;
    messagesArea.appendChild(loadingDiv);
    scrollToBottom();
}

function removeLoadingMessage() {
    const loadingMessage = document.getElementById('loadingMessage');
    if (loadingMessage) {
        loadingMessage.remove();
    }
}

// Send message to backend
async function handleSend() {
    const input = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const message = input.value.trim();
    
    if (!message || isLoading) return;
    
    // Add user message
    addMessage('user', message);
    input.value = '';
    
    // Disable input
    isLoading = true;
    input.disabled = true;
    sendBtn.disabled = true;
    
    // Show loading
    addLoadingMessage();
    
    try {
        // Call backend API
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: message
            })
        });
        
        if (!response.ok) {
            throw new Error('Backend request failed');
        }
        
        const data = await response.json();
        removeLoadingMessage();
        addMessage('assistant', data.response);
        
    } catch (error) {
        console.error('Error:', error);
        removeLoadingMessage();
        
        if (!isConnected) {
            addMessage('assistant', 'Unable to connect to the backend server. Please make sure your Python server is running on http://localhost:5000\n\nTo start the server:\n1. Run: python app.py\n2. Ensure Flask and Flask-CORS are installed');
        } else {
            addMessage('assistant', 'Sorry, I encountered an error processing your request. Please try again.');
        }
    } finally {
        // Enable input
        isLoading = false;
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

// Handle Enter key
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
    }
}

// Utility functions
function scrollToBottom() {
    const messagesArea = document.getElementById('messagesArea');
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatMessage(text) {
    // Convert markdown-style formatting to HTML
    text = escapeHtml(text);
    
    // Bold text (**text**)
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Bullet points (• or -)
    text = text.replace(/^[•\-]\s/gm, '<br>• ');
    
    return text;
}