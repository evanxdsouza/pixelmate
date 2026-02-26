const API_URL = 'http://localhost:3001';
let ws = null;

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const promptInput = document.getElementById('prompt');
const submitBtn = document.getElementById('submitBtn');
const quickActionInput = document.getElementById('quickAction');
const quickSubmitBtn = document.getElementById('quickSubmitBtn');
const responseDiv = document.getElementById('response');
const tabs = document.querySelectorAll('.tab');
const taskTab = document.getElementById('taskTab');
const currentTab = document.getElementById('currentTab');

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    if (tab.dataset.tab === 'task') {
      taskTab.classList.remove('hidden');
      currentTab.classList.add('hidden');
    } else {
      taskTab.classList.add('hidden');
      currentTab.classList.remove('hidden');
    }
  });
});

// Enable/disable buttons based on input
promptInput.addEventListener('input', () => {
  submitBtn.disabled = !promptInput.value.trim();
});

quickActionInput.addEventListener('input', () => {
  quickSubmitBtn.disabled = !quickActionInput.value.trim();
});

// Connect to backend
function connect() {
  try {
    ws = new WebSocket('ws://localhost:3001/ws');
    
    ws.onopen = () => {
      statusDot.classList.add('connected');
      statusText.textContent = 'Connected';
      submitBtn.disabled = !promptInput.value.trim();
      quickSubmitBtn.disabled = !quickActionInput.value.trim();
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'agent_event' && data.event?.thought) {
          showResponse(data.event.thought, false);
        } else if (data.type === 'task_completed') {
          showResponse(data.result || 'Task completed', false);
          submitBtn.disabled = false;
          quickSubmitBtn.disabled = false;
        } else if (data.type === 'task_error') {
          showResponse(data.error || 'An error occurred', true);
          submitBtn.disabled = false;
          quickSubmitBtn.disabled = false;
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };
    
    ws.onclose = () => {
      statusDot.classList.remove('connected');
      statusText.textContent = 'Disconnected';
      submitBtn.disabled = true;
      quickSubmitBtn.disabled = true;
      setTimeout(connect, 3000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  } catch (e) {
    statusText.textContent = 'Connection failed';
    setTimeout(connect, 3000);
  }
}

function showResponse(text, isError) {
  responseDiv.classList.remove('hidden', 'error');
  if (isError) {
    responseDiv.classList.add('error');
  }
  responseDiv.textContent = text;
}

// Submit task via HTTP (fallback if WebSocket fails)
async function submitTask(prompt) {
  try {
    responseDiv.classList.remove('hidden', 'error');
    responseDiv.textContent = 'Processing...';
    
    const response = await fetch(`${API_URL}/api/agent/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    
    if (!response.ok) {
      throw new Error('Failed to start task');
    }
    
    const data = await response.json();
    responseDiv.textContent = `Task started: ${data.taskId}`;
    
    // Poll for completion
    pollTaskStatus(data.taskId);
  } catch (error) {
    showResponse(error.message, true);
  }
}

async function pollTaskStatus(taskId) {
  const checkStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/agent/status/${taskId}`);
      const data = await response.json();
      
      if (data.state === 'done') {
        showResponse('Task completed!', false);
        submitBtn.disabled = false;
        quickSubmitBtn.disabled = false;
      } else if (data.state === 'error') {
        showResponse('Task failed', true);
        submitBtn.disabled = false;
        quickSubmitBtn.disabled = false;
      } else {
        setTimeout(checkStatus, 2000);
      }
    } catch (e) {
      setTimeout(checkStatus, 2000);
    }
  };
  
  checkStatus();
}

// Event listeners
submitBtn.addEventListener('click', () => {
  const prompt = promptInput.value.trim();
  if (!prompt) return;
  
  submitBtn.disabled = true;
  promptInput.value = '';
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'start_task', prompt }));
    responseDiv.classList.remove('hidden', 'error');
    responseDiv.textContent = 'Processing...';
  } else {
    submitTask(prompt);
  }
});

quickSubmitBtn.addEventListener('click', async () => {
  const action = quickActionInput.value.trim();
  if (!action) return;
  
  quickSubmitBtn.disabled = true;
  
  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  const prompt = `${action} on page: ${tab.title} (${tab.url})`;
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'start_task', prompt }));
    responseDiv.classList.remove('hidden', 'error');
    responseDiv.textContent = 'Processing...';
  } else {
    submitTask(prompt);
  }
});

// Initialize
connect();
