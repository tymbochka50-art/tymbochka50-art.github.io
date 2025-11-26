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

// 🔥 ПРАВИЛЬНЫЕ функции для работы с био
function displayUserBio(user) {
    const userBio = document.getElementById('userBio');
    
    // Сначала проверяем сохраненное кастомное био
    const customBio = localStorage.getItem('customBio');
    if (customBio) {
        userBio.innerHTML = `
            <div style="text-align: left;">
                <div style="margin-bottom: 5px;">${customBio}</div>
                <button onclick="clearCustomBio()" style="background: none; border: none; color: #6c757d; font-size: 12px; cursor: pointer; padding: 0;">
                    ✏️ Изменить био
                </button>
            </div>
        `;
        userBio.style.color = '#333';
        return;
    }
    
    // Способ 1: Используем данные из initDataUnsafe
    if (user.bio && user.bio.trim() !== '') {
        userBio.textContent = user.bio;
        userBio.style.color = '#333';
        userBio.style.fontStyle = 'normal';
        console.log('✅ Био из initData:', user.bio);
        return;
    }
    
    // Способ 2: Показываем доступные данные
    const availableData = [];
    if (user.username) availableData.push(`@${user.username}`);
    if (user.language_code) availableData.push(`Язык: ${user.language_code}`);
    if (user.is_premium) availableData.push(`⭐ Premium`);
    
    if (availableData.length > 0) {
        userBio.innerHTML = `
            <div style="text-align: center;">
                <p style="margin-bottom: 8px; color: #6c757d;">Био не доступно в Mini App</p>
                <p style="font-size: 12px; color: #6c757d; margin-bottom: 10px;">Доступно: ${availableData.join(', ')}</p>
                <button onclick="requestBioManually()" class="subscribe-btn" style="background: #17a2b8;">
                    ✏️ Заполнить био вручную
                </button>
                <button onclick="showBioHelp()" class="subscribe-btn" style="background: #6c757d; margin-left: 5px;">
                    ℹ️ Справка
                </button>
            </div>
        `;
    } else {
        userBio.innerHTML = `
            <div style="text-align: center;">
                <p style="color: #6c757d; margin-bottom: 10px;">Био не доступно</p>
                <button onclick="requestBioManually()" class="subscribe-btn" style="background: #17a2b8;">
                    ✏️ Заполнить био
                </button>
            </div>
        `;
    }
}

// Запрос ручного ввода био
function requestBioManually() {
    tg.showPopup({
        title: 'Расскажите о себе',
        message: 'Заполните информацию о себе. Это увидят другие пользователи:',
        buttons: [
            {id: 'input', type: 'default', text: '✏️ Ввести био'},
            {id: 'cancel', type: 'cancel', text: 'Пропустить'}
        ]
    }, (buttonId) => {
        if (buttonId === 'input') {
            showBioInput();
        }
    });
}

// Показ поля ввода био
function showBioInput() {
    const userBio = document.getElementById('userBio');
    userBio.innerHTML = `
        <div style="text-align: center;">
            <textarea id="bioInput" placeholder="Напишите о себе (интересы, увлечения, род деятельности)..."
                      style="width: 100%; height: 80px; padding: 10px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; font-family: inherit; resize: vertical;"></textarea>
            <div style="font-size: 12px; color: #6c757d; margin-bottom: 10px;">Макс. 200 символов</div>
            <br>
            <button onclick="saveCustomBio()" class="subscribe-btn" style="background: #28a745;">
                💾 Сохранить
            </button>
            <button onclick="displayUserBio(tg.initDataUnsafe?.user)" class="subscribe-btn" style="background: #6c757d; margin-left: 10px;">
                ❌ Отмена
            </button>
        </div>
    `;
}

// Сохранение кастомного био
function saveCustomBio() {
    const bioInput = document.getElementById('bioInput');
    const bioText = bioInput.value.trim();
    
    if (bioText) {
        if (bioText.length > 200) {
            tg.showAlert('⚠️ Слишком длинное био! Максимум 200 символов.');
            return;
        }
        
        const userBio = document.getElementById('userBio');
        userBio.innerHTML = `
            <div style="text-align: left;">
                <div style="margin-bottom: 5px;">${bioText}</div>
                <button onclick="clearCustomBio()" style="background: none; border: none; color: #6c757d; font-size: 12px; cursor: pointer; padding: 0;">
                    ✏️ Изменить био
                </button>
            </div>
        `;
        userBio.style.color = '#333';
        
        // Сохраняем в localStorage
        localStorage.setItem('customBio', bioText);
        
        tg.showAlert('✅ Био сохранено!');
    } else {
        tg.showAlert('⚠️ Введите текст био');
    }
}

// Очистка кастомного био
function clearCustomBio() {
    localStorage.removeItem('customBio');
    displayUserBio(tg.initDataUnsafe?.user);
}

// Справка по заполнению био
function showBioHelp() {
    tg.showPopup({
        title: 'Как заполнить био в Telegram?',
        message: '1. Откройте настройки Telegram\n2. Нажмите "Редактировать профиль"\n3. Заполните поле "Био"\n4. Вернитесь в это приложение\n\nИли используйте кнопку "Заполнить био вручную"',
        buttons: [
            {id: 'open_telegram', type: 'default', text: '📱 Открыть Telegram'},
            {id: 'manual', type: 'default', text: '✏️ Ввести вручную'},
            {id: 'cancel', type: 'cancel', text: 'Закрыть'}
        ]
    }, (buttonId) => {
        if (buttonId === 'open_telegram') {
            tg.openTelegramLink('tg://settings');
        } else if (buttonId === 'manual') {
            requestBioManually();
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
