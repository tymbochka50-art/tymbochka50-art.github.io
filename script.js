// ===== AI CHAT APPLICATION =====
class AIChatApplication {
    constructor() {
        // Конфигурация API
        this.config = {
            apiEndpoint: 'https://misha4458456-test3.hf.space',
            apiRoute: '/run/predict',
            defaultTemperature: 0.1,
            defaultMaxTokens: 300,
            modelMode: 'code'
        };
        
        // Состояние приложения
        this.state = {
            currentChatId: null,
            messages: [],
            isTyping: false,
            isOnline: false,
            settings: this.loadSettings(),
            theme: 'light'
        };
        
        // Инициализация
        this.initializeElements();
        this.bindEvents();
        this.initializeApplication();
    }

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    initializeElements() {
        // Основные элементы
        this.elements = {
            // Контейнеры
            container: document.querySelector('.container'),
            sidebar: document.querySelector('.sidebar'),
            chatMessages: document.getElementById('chatMessages'),
            chatHistory: document.getElementById('chatHistory'),
            typingIndicator: document.getElementById('typingIndicator'),
            
            // Ввод сообщений
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendButton'),
            charCounter: document.getElementById('charCounter'),
            
            // Кнопки управления
            newChatBtn: document.getElementById('newChatBtn'),
            clearChatBtn: document.getElementById('clearChatBtn'),
            exportBtn: document.getElementById('exportBtn'),
            sidebarToggle: document.getElementById('sidebarToggle'),
            settingsBtn: document.getElementById('settingsBtn'),
            
            // Модальные окна
            settingsModal: document.getElementById('settingsModal'),
            closeSettingsBtn: document.getElementById('closeSettingsBtn'),
            saveSettingsBtn: document.getElementById('saveSettingsBtn'),
            resetSettingsBtn: document.getElementById('resetSettingsBtn'),
            testApiBtn: document.getElementById('testApiBtn'),
            testResult: document.getElementById('testResult'),
            
            // Настройки
            apiEndpoint: document.getElementById('apiEndpoint'),
            apiRoute: document.getElementById('apiRoute'),
            temperatureSlider: document.getElementById('temperatureSlider'),
            temperatureValue: document.getElementById('temperatureValue'),
            maxTokensSlider: document.getElementById('maxTokensSlider'),
            maxTokensValue: document.getElementById('maxTokensValue'),
            modelSelect: document.getElementById('modelSelect'),
            themeSelect: document.getElementById('themeSelect'),
            animationsToggle: document.getElementById('animationsToggle'),
            
            // Статус
            statusIndicator: document.getElementById('statusIndicator'),
            modelBadge: document.getElementById('modelBadge'),
            
            // Примеры
            exampleButtons: document.querySelectorAll('.example-btn'),
            shortcutButtons: document.querySelectorAll('.shortcut-btn')
        };
    }

    bindEvents() {
        // Отправка сообщений
        this.elements.sendButton.addEventListener('click', () => this.sendMessage());
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Автоматическое изменение высоты textarea
        this.elements.messageInput.addEventListener('input', () => {
            this.adjustTextareaHeight();
            this.updateCharCounter();
        });
        
        // Управление чатами
        this.elements.newChatBtn.addEventListener('click', () => this.createNewChat());
        this.elements.clearChatBtn.addEventListener('click', () => this.clearCurrentChat());
        this.elements.exportBtn.addEventListener('click', () => this.exportChatHistory());
        
        // Боковая панель
        this.elements.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        
        // Настройки
        this.elements.settingsBtn.addEventListener('click', () => this.showSettings());
        this.elements.closeSettingsBtn.addEventListener('click', () => this.hideSettings());
        this.elements.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.elements.resetSettingsBtn.addEventListener('click', () => this.resetSettings());
        this.elements.testApiBtn.addEventListener('click', () => this.testApiConnection());
        
        // Обновление значений слайдеров
        this.elements.temperatureSlider.addEventListener('input', (e) => {
            this.elements.temperatureValue.textContent = e.target.value;
        });
        
        this.elements.maxTokensSlider.addEventListener('input', (e) => {
            this.elements.maxTokensValue.textContent = e.target.value;
        });
        
        // Примеры и быстрые кнопки
        this.elements.exampleButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const example = e.currentTarget.dataset.example;
                this.elements.messageInput.value = example;
                this.elements.messageInput.focus();
                this.adjustTextareaHeight();
            });
        });
        
        this.elements.shortcutButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const prompt = e.currentTarget.dataset.prompt;
                this.elements.messageInput.value = prompt;
                this.elements.messageInput.focus();
                this.adjustTextareaHeight();
            });
        });
        
        // Закрытие модальных окон
        window.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) {
                this.hideSettings();
            }
        });
        
        // Сохранение настроек при изменении
        this.elements.themeSelect.addEventListener('change', (e) => {
            this.setTheme(e.target.value);
        });
        
        // Загрузка истории при клике
        document.addEventListener('click', (e) => {
            if (e.target.closest('.history-item')) {
                const chatId = e.target.closest('.history-item').dataset.chatId;
                if (chatId) {
                    this.loadChat(chatId);
                    if (window.innerWidth <= 1024) {
                        this.toggleSidebar();
                    }
                }
            }
        });
    }

    initializeApplication() {
        // Установка темы
        this.setTheme(this.state.settings.theme || 'light');
        
        // Загрузка сохранённых настроек
        this.loadSavedSettings();
        
        // Загрузка истории чатов
        this.loadChatHistory();
        
        // Создание нового чата или загрузка последнего
        const lastChatId = localStorage.getItem('lastChatId');
        if (lastChatId) {
            this.loadChat(lastChatId);
        } else {
            this.createNewChat();
        }
        
        // Проверка подключения к API
        this.checkApiConnection();
        
        // Фокус на поле ввода
        setTimeout(() => {
            this.elements.messageInput.focus();
        }, 500);
    }

    // ===== УПРАВЛЕНИЕ СООБЩЕНИЯМИ =====
    async sendMessage() {
        const message = this.elements.messageInput.value.trim();
        if (!message || this.state.isTyping) return;
        
        // Очистка поля ввода
        this.elements.messageInput.value = '';
        this.adjustTextareaHeight();
        this.updateCharCounter();
        
        // Добавление сообщения пользователя
        this.addMessage(message, 'user');
        
        // Показать индикатор печатания
        this.showTypingIndicator();
        
        try {
            // Получение ответа от API
            const response = await this.getAIResponse(message);
            
            // Скрыть индикатор печатания
            this.hideTypingIndicator();
            
            // Добавление ответа AI
            this.addMessage(response, 'ai');
            
            // Сохранение чата
            this.saveChat();
            
        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage(`❌ Ошибка: ${error.message}`, 'ai');
            console.error('API Error:', error);
            this.showNotification('Ошибка подключения к AI', 'error');
        }
    }

    async getAIResponse(message) {
        // Формирование промпта в зависимости от режима
        let prompt = '';
        const mode = this.state.settings.modelMode || 'code';
        
        if (mode === 'code') {
            prompt = `### Инструкция:
Ты - эксперт по программированию. Пиши чистый, документированный код с комментариями.
Отвечай кратко и по делу.

### Запрос:
${message}

### Ответ:`;
        } else if (mode === 'chat') {
            prompt = `### Инструкция:
Ты - helpful AI assistant. Отвечай информативно и дружелюбно.

### Запрос:
${message}

### Ответ:`;
        } else {
            prompt = `### Запрос:
${message}

### Ответ:`;
        }
        
        // Подготовка данных для API
        const requestData = {
            data: [prompt]
        };
        
        // Отправка запроса к API
        const apiUrl = this.state.settings.apiEndpoint + this.state.settings.apiRoute;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestData),
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Извлечение ответа из разных форматов API
        let aiResponse = '';
        
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            aiResponse = data.data[0];
        } else if (data.response) {
            aiResponse = data.response;
        } else if (data.text) {
            aiResponse = data.text;
        } else if (data.generated_text) {
            aiResponse = data.generated_text;
        } else {
            aiResponse = JSON.stringify(data);
        }
        
        // Удаление промпта из ответа, если он присутствует
        if (prompt && aiResponse.includes(prompt)) {
            aiResponse = aiResponse.replace(prompt, '').trim();
        }
        
        // Форматирование кода
        aiResponse = this.formatCodeBlocks(aiResponse);
        
        return aiResponse;
    }

    addMessage(text, sender) {
        const messageId = Date.now();
        const timestamp = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Создание элемента сообщения
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        messageDiv.dataset.messageId = messageId;
        
        // Форматирование текста
        let formattedText = this.formatMessageText(text, sender);
        
        messageDiv.innerHTML = `
            <div class="avatar">${sender === 'user' ? 'U' : 'AI'}</div>
            <div class="message-content">
                <div class="message-text">${formattedText}</div>
                <div class="message-timestamp">${timestamp}</div>
            </div>
        `;
        
        // Добавление в DOM
        this.elements.chatMessages.appendChild(messageDiv);
        
        // Прокрутка к новому сообщению
        this.scrollToBottom();
        
        // Сохранение в состоянии
        this.state.messages.push({
            id: messageId,
            text: text,
            sender: sender,
            timestamp: Date.now(),
            formatted: formattedText
        });
        
        // Обновление заголовка чата
        if (this.state.messages.length === 2) { // Первое сообщение + ответ
            this.updateChatTitle(text);
        }
    }

    formatMessageText(text, sender) {
        if (sender === 'user') {
            return this.escapeHtml(text);
        }
        
        // Форматирование для AI сообщений
        let formatted = this.escapeHtml(text);
        
        // Обработка блоков кода
        formatted = this.formatCodeBlocks(formatted);
        
        // Замена переносов строк
        formatted = formatted.replace(/\n/g, '<br>');
        
        // Обработка маркированных списков
        formatted = formatted.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
        if (formatted.includes('<li>')) {
            formatted = formatted.replace(/^(.*)(<li>.*<\/li>)(.*)$/s, '$1<ul>$2</ul>$3');
        }
        
        return formatted;
    }

    formatCodeBlocks(text) {
        // Обработка блоков кода с тройными backticks
        return text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || 'plaintext';
            const escapedCode = this.escapeHtml(code.trim());
            return `
                <div class="code-block">
                    <pre><code class="language-${language}">${escapedCode}</code></pre>
                    <button class="copy-code-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent)">
                        <i class="fas fa-copy"></i> Копировать
                    </button>
                </div>
            `;
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== УПРАВЛЕНИЕ ЧАТАМИ =====
    createNewChat() {
        const chatId = 'chat_' + Date.now();
        this.state.currentChatId = chatId;
        this.state.messages = [];
        
        // Очистка области сообщений
        this.elements.chatMessages.innerHTML = `
            <div class="message ai-message welcome-message">
                <div class="avatar">AI</div>
                <div class="message-content">
                    <div class="message-text">
                        <h3>👋 Добро пожаловать в AI Code Assistant!</h3>
                        <p>Я ваш персональный помощник по программированию. Начните новый диалог!</p>
                    </div>
                    <div class="message-timestamp">Только что</div>
                </div>
            </div>
        `;
        
        // Сохранение
        this.saveChat();
        this.loadChatHistory();
        
        // Фокус на поле ввода
        this.elements.messageInput.focus();
        
        this.showNotification('Создан новый чат');
    }

    loadChat(chatId) {
        const chatData = localStorage.getItem(chatId);
        if (!chatData) {
            this.showNotification('Чат не найден', 'error');
            return;
        }
        
        try {
            const chat = JSON.parse(chatData);
            this.state.currentChatId = chatId;
            this.state.messages = chat.messages || [];
            
            // Очистка и отображение сообщений
            this.elements.chatMessages.innerHTML = '';
            this.state.messages.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${msg.sender}-message`;
                messageDiv.dataset.messageId = msg.id;
                
                messageDiv.innerHTML = `
                    <div class="avatar">${msg.sender === 'user' ? 'U' : 'AI'}</div>
                    <div class="message-content">
                        <div class="message-text">${msg.formatted || this.escapeHtml(msg.text)}</div>
                        <div class="message-timestamp">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                `;
                
                this.elements.chatMessages.appendChild(messageDiv);
            });
            
            // Прокрутка вниз
            this.scrollToBottom();
            
            // Обновление активного элемента в истории
            document.querySelectorAll('.history-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.chatId === chatId) {
                    item.classList.add('active');
                }
            });
            
            // Сохранение последнего чата
            localStorage.setItem('lastChatId', chatId);
            
        } catch (error) {
            console.error('Ошибка загрузки чата:', error);
            this.showNotification('Ошибка загрузки чата', 'error');
        }
    }

    saveChat() {
        if (!this.state.currentChatId || this.state.messages.length === 0) return;
        
        const chatData = {
            id: this.state.currentChatId,
            title: this.getChatTitle(),
            messages: this.state.messages,
            timestamp: Date.now(),
            messageCount: this.state.messages.length
        };
        
        localStorage.setItem(this.state.currentChatId, JSON.stringify(chatData));
        localStorage.setItem('lastChatId', this.state.currentChatId);
        
        // Обновление истории
        this.loadChatHistory();
    }

    clearCurrentChat() {
        if (!confirm('Вы уверены, что хотите очистить текущий чат? Все сообщения будут удалены.')) {
            return;
        }
        
        if (this.state.currentChatId) {
            localStorage.removeItem(this.state.currentChatId);
        }
        
        this.createNewChat();
        this.showNotification('Чат очищен');
    }

    updateChatTitle(firstMessage) {
        if (!this.state.currentChatId) return;
        
        const title = firstMessage.length > 30 
            ? firstMessage.substring(0, 30) + '...' 
            : firstMessage;
        
        const chatData = localStorage.getItem(this.state.currentChatId);
        if (chatData) {
            try {
                const chat = JSON.parse(chatData);
                chat.title = title;
                localStorage.setItem(this.state.currentChatId, JSON.stringify(chat));
                this.loadChatHistory();
            } catch (error) {
                console.error('Ошибка обновления заголовка:', error);
            }
        }
    }

    getChatTitle() {
        if (this.state.messages.length === 0) return 'Новый чат';
        
        const firstUserMessage = this.state.messages.find(m => m.sender === 'user');
        if (firstUserMessage) {
            return firstUserMessage.text.length > 30 
                ? firstUserMessage.text.substring(0, 30) + '...' 
                : firstUserMessage.text;
        }
        
        return 'Чат с AI';
    }

    // ===== ИСТОРИЯ ЧАТОВ =====
    loadChatHistory() {
        const chats = [];
        
        // Получение всех чатов из localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('chat_')) {
                try {
                    const chat = JSON.parse(localStorage.getItem(key));
                    chats.push(chat);
                } catch (error) {
                    console.error('Ошибка загрузки чата:', error);
                }
            }
        }
        
        // Сортировка по времени
        chats.sort((a, b) => b.timestamp - a.timestamp);
        
        // Отображение истории
        this.renderChatHistory(chats);
    }

    renderChatHistory(chats) {
        this.elements.chatHistory.innerHTML = '';
        
        if (chats.length === 0) {
            this.elements.chatHistory.innerHTML = `
                <div class="history-placeholder">
                    <i class="fas fa-comments"></i>
                    <p>История чатов пуста</p>
                </div>
            `;
            return;
        }
        
        chats.forEach(chat => {
            const historyItem = document.createElement('div');
            historyItem.className = `history-item ${chat.id === this.state.currentChatId ? 'active' : ''}`;
            historyItem.dataset.chatId = chat.id;
            
            const date = new Date(chat.timestamp).toLocaleDateString([], {
                day: 'numeric',
                month: 'short'
            });
            
            historyItem.innerHTML = `
                <i class="fas fa-message"></i>
                <div class="history-item-content">
                    <div class="history-item-title">${chat.title || 'Без названия'}</div>
                    <div class="history-item-date">${date} • ${chat.messageCount || 0} сообщ.</div>
                </div>
            `;
            
            this.elements.chatHistory.appendChild(historyItem);
        });
    }

    exportChatHistory() {
        if (!this.state.currentChatId || this.state.messages.length === 0) {
            this.showNotification('Нет сообщений для экспорта', 'error');
            return;
        }
        
        const chatData = {
            title: this.getChatTitle(),
            exportedAt: new Date().toISOString(),
            messages: this.state.messages.map(msg => ({
                sender: msg.sender,
                text: msg.text,
                timestamp: new Date(msg.timestamp).toLocaleString()
            }))
        };
        
        const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-chat-${this.state.currentChatId}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('История экспортирована');
    }

    // ===== НАСТРОЙКИ =====
    loadSettings() {
        const defaultSettings = {
            apiEndpoint: 'https://misha4458456-test3.hf.space',
            apiRoute: '/run/predict',
            temperature: 0.1,
            maxTokens: 300,
            modelMode: 'code',
            theme: 'light',
            animations: true
        };
        
        try {
            const saved = localStorage.getItem('aiChatSettings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch (error) {
            console.error('Ошибка загрузки настроек:', error);
            return defaultSettings;
        }
    }

    saveSettings() {
        const settings = {
            apiEndpoint: this.elements.apiEndpoint.value,
            apiRoute: this.elements.apiRoute.value,
            temperature: parseFloat(this.elements.temperatureSlider.value),
            maxTokens: parseInt(this.elements.maxTokensSlider.value),
            modelMode: this.elements.modelSelect.value,
            theme: this.elements.themeSelect.value,
            animations: this.elements.animationsToggle.checked
        };
        
        this.state.settings = settings;
        localStorage.setItem('aiChatSettings', JSON.stringify(settings));
        
        // Применение настроек
        this.setTheme(settings.theme);
        this.config.modelMode = settings.modelMode;
        
        this.hideSettings();
        this.showNotification('Настройки сохранены');
        
        // Проверка подключения с новыми настройками
        this.checkApiConnection();
    }

    loadSavedSettings() {
        // Загрузка значений в UI
        this.elements.apiEndpoint.value = this.state.settings.apiEndpoint;
        this.elements.apiRoute.value = this.state.settings.apiRoute;
        this.elements.temperatureSlider.value = this.state.settings.temperature;
        this.elements.temperatureValue.textContent = this.state.settings.temperature;
        this.elements.maxTokensSlider.value = this.state.settings.maxTokens;
        this.elements.maxTokensValue.textContent = this.state.settings.maxTokens;
        this.elements.modelSelect.value = this.state.settings.modelMode;
        this.elements.themeSelect.value = this.state.settings.theme;
        this.elements.animationsToggle.checked = this.state.settings.animations;
        
        // Применение темы
        this.setTheme(this.state.settings.theme);
    }

    resetSettings() {
        if (!confirm('Вы уверены, что хотите сбросить все настройки к значениям по умолчанию?')) {
            return;
        }
        
        localStorage.removeItem('aiChatSettings');
        this.state.settings = this.loadSettings();
        this.loadSavedSettings();
        
        this.showNotification('Настройки сброшены');
    }

    async testApiConnection() {
        this.elements.testResult.className = 'test-result';
        this.elements.testResult.textContent = 'Тестирование подключения...';
        this.elements.testResult.style.display = 'block';
        
        try {
            const apiUrl = this.elements.apiEndpoint.value + this.elements.apiRoute.value;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: ['test'] }),
                mode: 'cors'
            });
            
            if (response.ok) {
                this.elements.testResult.className = 'test-result success';
                this.elements.testResult.innerHTML = `
                    <i class="fas fa-check-circle"></i> 
                    Подключение успешно! API отвечает корректно.
                `;
                this.state.isOnline = true;
                this.updateStatusIndicator();
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            this.elements.testResult.className = 'test-result error';
            this.elements.testResult.innerHTML = `
                <i class="fas fa-exclamation-circle"></i> 
                Ошибка подключения: ${error.message}
            `;
            this.state.isOnline = false;
            this.updateStatusIndicator();
        }
    }

    async checkApiConnection() {
        try {
            const apiUrl = this.state.settings.apiEndpoint + this.state.settings.apiRoute;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: ['ping'] }),
                mode: 'cors'
            });
            
            this.state.isOnline = response.ok;
        } catch (error) {
            this.state.isOnline = false;
        }
        
        this.updateStatusIndicator();
    }

    // ===== UI УПРАВЛЕНИЕ =====
    showTypingIndicator() {
        this.state.isTyping = true;
        this.elements.typingIndicator.classList.add('active');
        this.elements.sendButton.disabled = true;
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.state.isTyping = false;
        this.elements.typingIndicator.classList.remove('active');
        this.elements.sendButton.disabled = false;
    }

    showSettings() {
        this.elements.settingsModal.classList.add('active');
    }

    hideSettings() {
        this.elements.settingsModal.classList.remove('active');
    }

    toggleSidebar() {
        this.elements.sidebar.classList.toggle('active');
    }

    adjustTextareaHeight() {
        const textarea = this.elements.messageInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }

    updateCharCounter() {
        const length = this.elements.messageInput.value.length;
        this.elements.charCounter.textContent = `${length}/2000`;
        
        if (length > 1800) {
            this.elements.charCounter.style.color = '#f44336';
        } else if (length > 1500) {
            this.elements.charCounter.style.color = '#ff9800';
        } else {
            this.elements.charCounter.style.color = '';
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }, 100);
    }

    setTheme(theme) {
        this.state.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('aiChatTheme', theme);
    }

    updateStatusIndicator() {
        const statusEl = this.elements.statusIndicator;
        const statusText = statusEl.querySelector('.status-text');
        
        if (this.state.isOnline) {
            statusEl.classList.add('online');
            statusEl.classList.remove('offline');
            statusText.textContent = 'Online';
        } else {
            statusEl.classList.add('offline');
            statusEl.classList.remove('online');
            statusText.textContent = 'Offline';
        }
    }

    showNotification(message, type = 'success') {
        // Создание уведомления
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Стили для уведомления
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4caf50' : '#f44336'};
            color: white;
            padding: 12px 24px;
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-lg);
            z-index: 2000;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideInRight 0.3s ease;
            max-width: 400px;
        `;
        
        document.body.appendChild(notification);
        
        // Удаление через 3 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
        
        // Добавление CSS анимаций
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // ===== УТИЛИТЫ =====
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // Сегодня
        if (diff < 24 * 60 * 60 * 1000) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // Вчера
        if (diff < 2 * 24 * 60 * 60 * 1000) {
            return 'Вчера';
        }
        
        // На этой неделе
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            return date.toLocaleDateString([], { weekday: 'short' });
        }
        
        // Более недели назад
        return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    }
}

// ===== ЗАПУСК ПРИЛОЖЕНИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    // Инициализация приложения
    window.aiChatApp = new AIChatApplication();
    
    // Глобальные обработчики
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window.aiChatApp.hideSettings();
        }
    });
    
    // Обработка копирования кода
    document.addEventListener('click', (e) => {
        if (e.target.closest('.copy-code-btn')) {
            const btn = e.target.closest('.copy-code-btn');
            const code = btn.parentElement.querySelector('code').textContent;
            navigator.clipboard.writeText(code)
                .then(() => {
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check"></i> Скопировано!';
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                    }, 2000);
                })
                .catch(err => {
                    console.error('Ошибка копирования:', err);
                });
        }
    });
    
    console.log('🚀 AI Chat Application запущен!');
});
