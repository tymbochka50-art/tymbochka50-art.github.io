// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

// Основная функция инициализации
async function initApp() {
    try {
        tg.expand();
        
        // Основная кнопка
        tg.MainButton.setText("Обновить");
        tg.MainButton.show();
        tg.MainButton.onClick(() => {
            location.reload();
        });
        
        const user = tg.initDataUnsafe?.user;
        
        if (!user) {
            document.body.innerHTML = '<div class="loading">Ошибка: Не удалось получить данные пользователя</div>';
            return;
        }

        // Показываем ID пользователя для отладки
        document.getElementById('debugUserId').textContent = user.id || 'Не доступен';
        document.getElementById('debugBackend').textContent = 'Vercel';

        // Аватар
        const avatar = document.getElementById('userAvatar');
        if (user.photo_url) {
            avatar.src = user.photo_url;
        } else {
            avatar.src = getDefaultAvatar();
        }

        // Имя пользователя
        const userName = document.getElementById('userName');
        userName.textContent = user.first_name || 'Пользователь';

        // Фамилия
        const userLastName = document.getElementById('userLastName');
        userLastName.textContent = user.last_name || 'Не указана';

        // 🔥 ПРАВИЛЬНОЕ отображение био
        displayUserBio(user);

        // Загружаем баланс
        await loadUserBalance(user.id);

        // Проверяем подписку
        checkRealSubscription(user.id);

        console.log('📊 Все данные пользователя:', user);

    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        document.body.innerHTML = '<div class="loading">Ошибка загрузки приложения</div>';
    }
}

// Умное отображение информации о пользователе
function displayUserBio(user) {
    const userBio = document.getElementById('userBio');
    
    // 1. Сначала проверяем сохраненное кастомное био
    const customBio = localStorage.getItem('customBio');
    if (customBio && customBio.trim() !== '') {
        userBio.innerHTML = `
            <div style="text-align: left;">
                <div style="margin-bottom: 8px; color: #333; font-style: normal;">${customBio}</div>
                <button onclick="clearCustomBio()" class="bio-edit-btn">
                    ✏️ Изменить описание
                </button>
            </div>
        `;
        return;
    }
    
    // 2. Пытаемся получить био из Telegram
    if (user.bio && user.bio.trim() !== '') {
        userBio.innerHTML = `
            <div style="text-align: left;">
                <div style="margin-bottom: 8px; color: #333; font-style: normal;">${user.bio}</div>
                <button onclick="showBioOptions()" class="bio-edit-btn">
                    ✏️ Дополнить описание
                </button>
            </div>
        `;
        return;
    }
    
    // 3. Если био пустое - показываем расширенную информацию
    showEnhancedUserInfo(user, userBio);
}

// Показ расширенной информации о пользователе
function showEnhancedUserInfo(user, userBioElement) {
    const userInfo = [];
    
    // Собираем всю доступную информацию
    if (user.username) userInfo.push(`<strong>Username:</strong> @${user.username}`);
    if (user.language_code) userInfo.push(`<strong>Язык:</strong> ${user.language_code}`);
    if (user.is_premium) userInfo.push(`<strong>Status:</strong> ⭐ Telegram Premium`);
    
    // Добавляем информацию о платформе
    const platform = getPlatformInfo();
    if (platform) userInfo.push(`<strong>Платформа:</strong> ${platform}`);
    
    // Добавляем дату регистрации (примерная)
    const registrationInfo = getRegistrationInfo();
    if (registrationInfo) userInfo.push(`<strong>В системе:</strong> ${registrationInfo}`);
    
    if (userInfo.length > 0) {
        userBioElement.innerHTML = `
            <div style="text-align: center;">
                <div style="color: #6c757d; margin-bottom: 15px;">
                    <p style="margin-bottom: 8px;">📋 Информация о профиле:</p>
                    <div style="text-align: left; background: #f8f9fa; padding: 12px; border-radius: 8px; font-size: 13px;">
                        ${userInfo.join('<br>')}
                    </div>
                </div>
                <div style="display: flex; gap: 8px; justify-content: center;">
                    <button onclick="requestBioManually()" class="subscribe-btn" style="background: #28a745; padding: 8px 16px;">
                        ✏️ Добавить описание
                    </button>
                    <button onclick="generateSmartBio(${user.id})" class="subscribe-btn" style="background: #17a2b8; padding: 8px 16px;">
                        🪄 Автозаполнение
                    </button>
                </div>
            </div>
        `;
    } else {
        // Если вообще нет данных
        userBioElement.innerHTML = `
            <div style="text-align: center;">
                <p style="color: #6c757d; margin-bottom: 15px;">
                    🤔 Информация о профиле не доступна
                </p>
                <button onclick="requestBioManually()" class="subscribe-btn" style="background: #28a745;">
                    ✏️ Создать описание
                </button>
            </div>
        `;
    }
}

// Получение информации о платформе
function getPlatformInfo() {
    const tg = window.Telegram?.WebApp;
    if (!tg) return null;
    
    const platform = tg.platform;
    switch(platform) {
        case 'android': return '📱 Android';
        case 'ios': return '📱 iOS';
        case 'web': return '🌐 Web';
        case 'weba': return '📱 Telegram App';
        default: return platform;
    }
}

// Генерация примерной даты регистрации
function getRegistrationInfo() {
    const firstVisit = localStorage.getItem('firstVisitDate');
    if (firstVisit) {
        const visitDate = new Date(firstVisit);
        const daysAgo = Math.floor((new Date() - visitDate) / (1000 * 60 * 60 * 24));
        return `${daysAgo} дней`;
    } else {
        const now = new Date().toISOString();
        localStorage.setItem('firstVisitDate', now);
        return 'сегодня';
    }
}

// Умное автозаполнение био
function generateSmartBio(userId) {
    const user = tg.initDataUnsafe?.user;
    const templates = [
        "Игрок CS2 🎮 | Люблю соревновательный режим",
        "Увлекаюсь киберспортом 🏆 | В поиске тиммейтов",
        "Стример CS2 📹 | Делюсь геймплеем",
        "Новичок в CS2 🎯 | Учусь играть",
        "Профессиональный игрок ⚡ | Топ-уровень",
        "Коллекционер скинов 💎 | Ищу редкие предметы",
        "Турнирный игрок 🏅 | Участвую в соревнованиях"
    ];
    
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    
    const userBio = document.getElementById('userBio');
    userBio.innerHTML = `
        <div style="text-align: center;">
            <p style="color: #333; margin-bottom: 10px;">Предлагаем вариант:</p>
            <div style="background: #e7f3ff; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                "${randomTemplate}"
            </div>
            <div style="display: flex; gap: 8px; justify-content: center;">
                <button onclick="acceptGeneratedBio('${randomTemplate}')" class="subscribe-btn" style="background: #28a745; padding: 8px 16px;">
                    ✅ Использовать
                </button>
                <button onclick="showBioOptions()" class="subscribe-btn" style="background: #6c757d; padding: 8px 16px;">
                    ✏️ Свой вариант
                </button>
            </div>
        </div>
    `;
}

// Принятие сгенерированного био
function acceptGeneratedBio(bioText) {
    localStorage.setItem('customBio', bioText);
    displayUserBio(tg.initDataUnsafe?.user);
    tg.showAlert('✅ Описание добавлено!');
}

// Показ опций для био
function showBioOptions() {
    tg.showPopup({
        title: 'Настройка описания',
        message: 'Выберите способ заполнения информации о себе:',
        buttons: [
            {id: 'manual', type: 'default', text: '✏️ Ввести вручную'},
            {id: 'auto', type: 'default', text: '🪄 Автозаполнение'},
            {id: 'help', type: 'default', text: 'ℹ️ Справка'},
            {id: 'cancel', type: 'cancel', text: 'Закрыть'}
        ]
    }, (buttonId) => {
        switch(buttonId) {
            case 'manual':
                requestBioManually();
                break;
            case 'auto':
                generateSmartBio(tg.initDataUnsafe?.user?.id);
                break;
            case 'help':
                showBioHelp();
                break;
        }
    });
}

// Обновленная функция ручного ввода
function requestBioManually() {
    const userBio = document.getElementById('userBio');
    userBio.innerHTML = `
        <div style="text-align: center;">
            <p style="color: #333; margin-bottom: 10px;">✏️ Напишите о себе:</p>
            <textarea id="bioInput" placeholder="Например: Профессиональный игрок в CS2, участвую в турнирах, ищу тиммейтов..."
                      style="width: 100%; height: 80px; padding: 12px; border: 2px solid #667eea; border-radius: 8px; margin-bottom: 10px; font-family: inherit; resize: vertical; font-size: 14px;"></textarea>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span id="charCount" style="font-size: 12px; color: #6c757d;">0/200</span>
                <button onclick="fillExampleBio()" style="background: none; border: none; color: #667eea; font-size: 12px; cursor: pointer; text-decoration: underline;">
                    📝 Пример
                </button>
            </div>
            <div style="display: flex; gap: 8px; justify-content: center;">
                <button onclick="saveCustomBio()" class="subscribe-btn" style="background: #28a745; padding: 10px 20px;">
                    💾 Сохранить
                </button>
                <button onclick="displayUserBio(tg.initDataUnsafe?.user)" class="subscribe-btn" style="background: #6c757d; padding: 10px 20px;">
                    ❌ Отмена
                </button>
            </div>
        </div>
    `;
    
    // Добавляем счетчик символов
    const bioInput = document.getElementById('bioInput');
    const charCount = document.getElementById('charCount');
    
    bioInput.addEventListener('input', function() {
        const length = this.value.length;
        charCount.textContent = `${length}/200`;
        if (length > 190) {
            charCount.style.color = '#dc3545';
        } else if (length > 150) {
            charCount.style.color = '#ffc107';
        } else {
            charCount.style.color = '#6c757d';
        }
    });
}

// Заполнение примера био
function fillExampleBio() {
    const examples = [
        "Профессиональный игрок в CS2 с опытом участия в турнирах",
        "Любитель CS2, играю для удовольствия в свободное время", 
        "Стример CS2 на Twitch, делюсь геймплеем и советами",
        "Коллекционер редких скинов в CS2",
        "Новичок в CS2, учусь играть и ищу наставника",
        "Турнирный организатор по CS2",
        "Аналитик киберспортивных матчей по CS2"
    ];
    
    const randomExample = examples[Math.floor(Math.random() * examples.length)];
    document.getElementById('bioInput').value = randomExample;
    document.getElementById('bioInput').dispatchEvent(new Event('input'));
}

// Обновленная функция сохранения био
function saveCustomBio() {
    const bioInput = document.getElementById('bioInput');
    const bioText = bioInput.value.trim();
    
    if (!bioText) {
        tg.showAlert('⚠️ Введите описание о себе');
        return;
    }
    
    if (bioText.length > 200) {
        tg.showAlert('⚠️ Слишком длинное описание! Максимум 200 символов.');
        return;
    }
    
    localStorage.setItem('customBio', bioText);
    displayUserBio(tg.initDataUnsafe?.user);
    tg.showAlert('✅ Описание сохранено!');
}

// Очистка кастомного био
function clearCustomBio() {
    tg.showPopup({
        title: 'Удалить описание?',
        message: 'Вы уверены что хотите удалить ваше описание?',
        buttons: [
            {id: 'delete', type: 'destructive', text: '❌ Удалить'},
            {id: 'cancel', type: 'cancel', text: 'Отмена'}
        ]
    }, (buttonId) => {
        if (buttonId === 'delete') {
            localStorage.removeItem('customBio');
            displayUserBio(tg.initDataUnsafe?.user);
            tg.showAlert('✅ Описание удалено');
        }
    });
}

// Функция для создания заглушки аватара
function getDefaultAvatar() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iNjAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIzMCIgeT0iMzAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPgo8cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjciIHI9IjQiLz4KPC9zdmc+Cjwvc3ZnPg==';
}

// ==================== СИСТЕМА МОНЕТ ====================

// Загружаем баланс при старте
async function loadUserBalance(userId) {
    try {
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/get-balance';
        
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId
            })
        });

        const result = await response.json();
        
        if (result.success) {
            const coinsElement = document.getElementById('userCoins');
            coinsElement.textContent = result.coins;
        }
    } catch (error) {
        console.error('Ошибка загрузки баланса:', error);
    }
}

// Проверка подписки с начислением монет
async function checkRealSubscription(userId) {
    const statusElement = document.getElementById('subscriptionStatus');
    const coinsElement = document.getElementById('userCoins');
    
    try {
        statusElement.innerHTML = '🔍 Проверяем подписку и баланс...';
        statusElement.className = 'subscription-status';

        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/check-subscription';
        
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId
            })
        });

        const result = await response.json();
        
        console.log('💰 Balance result:', result);

        // Обновляем баланс монет
        if (result.success) {
            coinsElement.textContent = result.coins;
            coinsElement.classList.add('reward-animation');
            setTimeout(() => coinsElement.classList.remove('reward-animation'), 600);
        }

        if (result.success && result.isSubscribed) {
            let statusHTML = `
                ✅ Вы подписаны на канал <a href="https://t.me/CS2DropZone" target="_blank" class="channel-link">@CS2DropZone</a>
                <br><small>Статус: ${result.status}</small>
            `;
            
            // Показываем начисление монет если есть
            if (result.coinsAwarded > 0) {
                statusHTML += `
                    <div class="coins-awarded">
                        🎉 +${result.coinsAwarded} монет за подписку!
                    </div>
                `;
            }
            
            statusHTML += `
                <br>
                <button onclick="claimDailyReward(${userId})" class="subscribe-btn">
                    🎁 Забрать ежедневную награду (+10 монет)
                </button>
            `;
            
            statusElement.innerHTML = statusHTML;
            statusElement.className = 'subscription-status subscribed';
        } else {
            statusElement.innerHTML = `
                ❌ Вы не подписаны на канал <a href="https://t.me/CS2DropZone" target="_blank" class="channel-link">@CS2DropZone</a>
                ${result.error ? `<br><small>Ошибка: ${result.error}</small>` : ''}
                <br><br>
                <button onclick="subscribeToChannel()" class="subscribe-btn">Подписаться на канал</button>
                <br><br>
                <small>После подписки обновите страницу для получения +10 монет</small>
            `;
            statusElement.className = 'subscription-status not-subscribed';
        }

    } catch (error) {
        console.error('Ошибка проверки подписки:', error);
        statusElement.innerHTML = `
            ⚠️ Не удалось проверить подписку
            <br><small>Ошибка сети: ${error.message}</small>
            <br><br>
            <button onclick="checkRealSubscription(${userId})" class="subscribe-btn">Попробовать снова</button>
        `;
        statusElement.className = 'subscription-status not-subscribed';
    }
}

// Ежедневная награда
async function claimDailyReward(userId) {
    const statusElement = document.getElementById('subscriptionStatus');
    const coinsElement = document.getElementById('userCoins');
    
    try {
        statusElement.innerHTML = '🎁 Забираем ежедневную награду...';
        
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/daily-reward';
        
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId
            })
        });

        const result = await response.json();
        
        if (result.success) {
            // Обновляем баланс
            coinsElement.textContent = result.coins;
            coinsElement.classList.add('reward-animation');
            
            let message = result.message;
            if (result.coinsAwarded > 0) {
                message = `🎉 +${result.coinsAwarded} монет! Теперь у вас: ${result.coins} монет`;
            }
            
            statusElement.innerHTML = `
                <div class="subscription-status subscribed">
                    ${message}
                    <br><br>
                    <button onclick="checkRealSubscription(${userId})" class="subscribe-btn">
                        🔄 Обновить статус
                    </button>
                </div>
            `;
        } else {
            statusElement.innerHTML = `
                <div class="subscription-status not-subscribed">
                    ❌ Не удалось получить награду: ${result.error}
                    <br><br>
                    <button onclick="claimDailyReward(${userId})" class="subscribe-btn">Попробовать снова</button>
                </div>
            `;
        }

    } catch (error) {
        console.error('Ошибка получения награды:', error);
        statusElement.innerHTML = `
            <div class="subscription-status not-subscribed">
                ⚠️ Ошибка сети
                <br><br>
                <button onclick="claimDailyReward(${userId})" class="subscribe-btn">Попробовать снова</button>
            </div>
        `;
    }
}

// Функция для перехода к каналу
function subscribeToChannel() {
    tg.openLink('https://t.me/CS2DropZone');
}

// Простая проверка подписки (запасной вариант)
function useSimpleCheck() {
    const statusElement = document.getElementById('subscriptionStatus');
    
    statusElement.innerHTML = `
        📋 Простая проверка подписки:
        <br><br>
        1. Подпишитесь на <a href="https://t.me/CS2DropZone" class="channel-link">@CS2DropZone</a>
        <br>
        2. Нажмите кнопку ниже после подписки
        <br><br>
        <button onclick="subscribeToChannel()" class="subscribe-btn">📲 Перейти в канал</button>
        <br><br>
        <button onclick="confirmSubscription()" class="subscribe-btn">✅ Я подписался</button>
    `;
    statusElement.className = 'subscription-status not-subscribed';
}

// Подтверждение подписки (для простой проверки)
function confirmSubscription() {
    const statusElement = document.getElementById('subscriptionStatus');
    statusElement.innerHTML = '🎉 Спасибо за подписку! Доступ открыт!';
    statusElement.className = 'subscription-status subscribed';
    
    // Сохраняем в localStorage
    localStorage.setItem('subscribedToCS2DropZone', 'true');
}

// Инициализируем приложение когда страница загрузится
document.addEventListener('DOMContentLoaded', initApp);

