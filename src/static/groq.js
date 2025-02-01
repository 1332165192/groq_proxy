const API_BASE_URL = '/v1'; // 代理服务器的基础URL

class GroqChat {
  constructor() {
    this.apiKey = localStorage.getItem('groq_api_key') || '';
    this.currentModel = 'llama2-70b-4096';
    this.messageHistory = [];
    this.initializeUI();
  }

  initializeUI() {
    // API Key 相关元素
    this.apiKeyInput = document.getElementById('api-key');
    this.apiKeyInput.value = this.apiKey;
    this.apiKeyInput.addEventListener('change', () => this.updateApiKey());

    // 模型选择相关元素
    this.modelSelect = document.getElementById('model-select');
    this.loadModels();

    // 聊天相关元素
    this.chatContainer = document.getElementById('chat-container');
    this.messageInput = document.getElementById('message-input');
    this.sendButton = document.getElementById('send-button');
    
    // 参数控制相关元素
    this.temperatureInput = document.getElementById('temperature');
    this.maxTokensInput = document.getElementById('max-tokens');
    
    // 绑定事件
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  updateApiKey() {
    this.apiKey = this.apiKeyInput.value.trim();
    localStorage.setItem('groq_api_key', this.apiKey);
  }

  async loadModels() {
    try {
      const response = await fetch(`${API_BASE_URL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        }
      });
      
      if (!response.ok) throw new Error('Failed to load models');
      
      const { data } = await response.json();
      this.modelSelect.innerHTML = data.map(model => 
        `<option value="${model.id}">${model.id}</option>`
      ).join('');
      
      this.modelSelect.value = this.currentModel;
    } catch (error) {
      console.error('Error loading models:', error);
    }
  }

  async sendMessage() {
    const content = this.messageInput.value.trim();
    if (!content) return;

    if (!this.apiKey) {
      alert('Please enter your Groq API key first');
      return;
    }

    const userMessage = { role: 'user', content };
    this.addMessageToUI(userMessage);
    this.messageInput.value = '';

    this.messageHistory.push(userMessage);
    await this.getCompletion();
  }

  async getCompletion() {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelSelect.value,
          messages: this.messageHistory,
          temperature: parseFloat(this.temperatureInput.value),
          max_tokens: parseInt(this.maxTokensInput.value),
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const assistantMessage = data.choices[0].message;
      this.messageHistory.push(assistantMessage);
      this.addMessageToUI(assistantMessage);
    } catch (error) {
      console.error('Error:', error);
      this.addErrorToUI(error.message);
    }
  }

  addMessageToUI(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;
    messageDiv.innerHTML = `
      <div class="message-content">
        <div class="message-role">${message.role}</div>
        <div class="message-text">${this.formatMessage(message.content)}</div>
      </div>
    `;
    this.chatContainer.appendChild(messageDiv);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  addErrorToUI(errorMessage) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message error';
    errorDiv.innerHTML = `
      <div class="message-content">
        <div class="message-role">error</div>
        <div class="message-text">${errorMessage}</div>
      </div>
    `;
    this.chatContainer.appendChild(errorDiv);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  formatMessage(content) {
    // 简单的文本格式化，可以根据需要扩展
    return content.replace(/\n/g, '<br>');
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  window.groqChat = new GroqChat();
}); 