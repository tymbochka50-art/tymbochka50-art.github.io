// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

async function initApp() {
    try {
        tg.expand();
        
        const user = tg.initDataUnsafe?.user;
        
        if (!user) {
            document.body.innerHTML = '<div class="loading">Ошибка: Не удалось получить данные пользователя</div>';
            return;
        }

        // Основные данные
        document.getElementById('debugUserId').textContent = user.id || 'Не доступен';
        
        const avatar = document.getElementById('userAvatar');
        avatar.src = user.photo_url || getDefaultAvatar();

        const userName = document.getElementById('userName');
        userName.textContent = user.first_name || 'Пользователь';

        const userLastName = document.getElementById('userLastName');
        userLastName.textContent = user.last_name || 'Не указана';

        // 🔥 ГЛАВНОЕ: Получаем био через getUserProfile
        await displayUserBioWithPopup(user.id);

        // Проверяем подписку
        checkRealSubscription(user.id);

    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
    }
}

// Обновленная функция проверки подписки с монетами
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

// Функция для получения ежедневной награды
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

// В initApp добавляем загрузку баланса:
async function initApp() {
    try {
        tg.expand();
        
        const user = tg.initDataUnsafe?.user;
        
        if (!user) {
            document.body.innerHTML = '<div class="loading">Ошибка: Не удалось получить данные пользователя</div>';
            return;
        }

        // Основные данные
        document.getElementById('debugUserId').textContent = user.id || 'Не доступен';
        
        const avatar = document.getElementById('userAvatar');
        avatar.src = user.photo_url || getDefaultAvatar();

        const userName = document.getElementById('userName');
        userName.textContent = user.first_name || 'Пользователь';

        const userLastName = document.getElementById('userLastName');
        userLastName.textContent = user.last_name || 'Не указана';

        // Загружаем баланс
        await loadUserBalance(user.id);

        // Проверяем подписку
        checkRealSubscription(user.id);

    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
    }
}

// 🔥 ОСНОВНАЯ ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ БИО
async function displayUserBioWithPopup(userId) {
    const userBio = document.getElementById('userBio');
    
    // Сначала показываем что пытаемся получить данные
    userBio.textContent = '🔄 Запрашиваем данные профиля...';
    userBio.style.color = '#6c757d';
    
    try {
        // Способ 1: Прямой запрос профиля
        tg.getUserProfile((profile) => {
            if (profile && profile.bio) {
                userBio.textContent = profile.bio;
                userBio.style.color = '#333';
                userBio.style.fontStyle = 'normal';
                console.log('✅ Био получено:', profile.bio);
            } else {
                // Способ 2: Если не сработало, показываем кнопку
                showBioRequestButton(userId, userBio);
            }
        });
        
    } catch (error) {
        console.error('Ошибка получения профиля:', error);
        showBioRequestButton(userId, userBio);
    }
}

// Показываем кнопку для запроса био
function showBioRequestButton(userId, userBioElement) {
    userBioElement.innerHTML = `
        <div style="text-align: center;">
            <p style="margin-bottom: 10px;">Био не доступно автоматически</p>
            <button onclick="requestBioWithPopup(${userId})" 
                    class="subscribe-btn"
                    style="background: #28a745;">
                👤 Запросить данные профиля
            </button>
        </div>
    `;
}

// Запрос био через попап
function requestBioWithPopup(userId) {
    const userBio = document.getElementById('userBio');
    userBio.innerHTML = '🔄 Открываем доступ к профилю...';
    
    // Открываем попап для запроса данных
    tg.showPopup({
        title: 'Доступ к профилю',
        message: 'Разрешите доступ к вашему профилю Telegram для отображения био и персональных данных',
        buttons: [
            {id: 'allow', type: 'default', text: '✅ Разрешить'},
            {id: 'cancel', type: 'cancel', text: '❌ Отмена'}
        ]
    }, async (buttonId) => {
        if (buttonId === 'allow') {
            // После разрешения запрашиваем профиль
            tg.getUserProfile((profile) => {
                if (profile && profile.bio) {
                    userBio.textContent = profile.bio;
                    userBio.style.color = '#333';
                    userBio.style.fontStyle = 'normal';
                    
                    // Сохраняем в localStorage на будущее
                    localStorage.setItem('userBio', profile.bio);
                    
                    // Показываем успех
                    showBioSuccess();
                } else {
                    userBio.textContent = 'Био не заполнено в вашем профиле Telegram';
                    userBio.style.color = '#6c757d';
                }
            });
        } else {
            userBio.textContent = 'Доступ к био не предоставлен';
            userBio.style.color = '#dc3545';
        }
    });
}

function showBioSuccess() {
    const statusElement = document.getElementById('subscriptionStatus');
    if (statusElement) {
        const oldContent = statusElement.innerHTML;
        statusElement.innerHTML = oldContent + `
            <div style="background: #d4edda; color: #155724; padding: 10px; border-radius: 8px; margin-top: 10px;">
                ✅ Данные профиля успешно загружены
            </div>
        `;
    }
}

// Реальная проверка подписки через Vercel бэкенд
async function checkRealSubscription(userId) {
    const statusElement = document.getElementById('subscriptionStatus');
    
    try {
        statusElement.innerHTML = '🔍 Проверяем подписку...';
        statusElement.className = 'subscription-status';

        // Ваш URL бэкенда на Vercel
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/check-subscription';
        
        console.log('📤 Отправляем запрос к:', backendUrl);
        console.log('👤 User ID:', userId);

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
        
        console.log('📥 Ответ от бэкенда:', result);

        if (result.success && result.isSubscribed) {
            statusElement.innerHTML = `
                ✅ Вы подписаны на канал <a href="https://t.me/CS2DropZone" target="_blank" class="channel-link">@CS2DropZone</a>
                <br><small>Статус: ${result.status}</small>
            `;
            statusElement.className = 'subscription-status subscribed';
        } else {
            statusElement.innerHTML = `
                ❌ Вы не подписаны на канал <a href="https://t.me/CS2DropZone" target="_blank" class="channel-link">@CS2DropZone</a>
                ${result.error ? `<br><small>Ошибка: ${result.error}</small>` : ''}
                <br><br>
                <button onclick="subscribeToChannel()" class="subscribe-btn">Подписаться на канал</button>
                <br><br>
                <small>После подписки нажмите "Обновить"</small>
            `;
            statusElement.className = 'subscription-status not-subscribed';
        }

    } catch (error) {
        console.error('❌ Ошибка проверки подписки:', error);
        statusElement.innerHTML = `
            ⚠️ Не удалось проверить подписку
            <br><small>Ошибка сети: ${error.message}</small>
            <br><br>
            <button onclick="checkRealSubscription(${userId})" class="subscribe-btn">Попробовать снова</button>
            <br><br>
            <button onclick="useSimpleCheck()" class="subscribe-btn">Использовать простую проверку</button>
        `;
        statusElement.className = 'subscription-status not-subscribed';
    }
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

// Функция для перехода к каналу
function subscribeToChannel() {
    tg.openLink('https://t.me/CS2DropZone');
}

// Подтверждение подписки (для простой проверки)
function confirmSubscription() {
    const statusElement = document.getElementById('subscriptionStatus');
    statusElement.innerHTML = '🎉 Спасибо за подписку! Доступ открыт!';
    statusElement.className = 'subscription-status subscribed';
    
    // Сохраняем в localStorage
    localStorage.setItem('subscribedToCS2DropZone', 'true');
}

// Функция для создания заглушки аватара
function getDefaultAvatar() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iNjAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIzMCIgeT0iMzAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPgo8cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjciIHI9IjQiLz4KPC9zdmc+Cjwvc3ZnPg==';
}

// Инициализируем приложение когда страница загрузится
document.addEventListener('DOMContentLoaded', initApp);


