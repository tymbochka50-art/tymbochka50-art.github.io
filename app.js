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

        // Загружаем баланс
        await loadUserBalance(user.id);

        // Проверяем подписку
        checkRealSubscription(user.id);

        console.log('📊 Данные пользователя:', user);

    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        document.body.innerHTML = '<div class="loading">Ошибка загрузки приложения</div>';
    }
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

// Инициализируем приложение когда страница загрузится
document.addEventListener('DOMContentLoaded', initApp);
