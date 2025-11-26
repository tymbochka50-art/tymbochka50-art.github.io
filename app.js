// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

// Добавьте эту функцию в app.js ПЕРЕД всем остальным кодом
function claimDailyRewardTimer() {
    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    const claimBtn = document.getElementById('claimRewardBtn');
    
    if (!userId) {
        alert('❌ Не удалось определить пользователя');
        return;
    }
    
    // Временно показываем сообщение
    claimBtn.disabled = true;
    claimBtn.textContent = '🔄 Получаем...';
    
    setTimeout(() => {
        claimBtn.disabled = false;
        claimBtn.textContent = '🎁 Забрать +10 монет';
        alert('✅ Награда получена! +10 монет');
    }, 1000);
}

// Или если хотите полную версию, добавьте эту функцию:
async function claimDailyRewardTimer() {
    const tg = window.Telegram.WebApp;
    const userId = tg.initDataUnsafe?.user?.id;
    const claimBtn = document.getElementById('claimRewardBtn');
    
    if (!userId) {
        tg.showAlert('❌ Не удалось определить пользователя');
        return;
    }
    
    try {
        claimBtn.disabled = true;
        claimBtn.textContent = '🔄 Получаем...';
        
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/daily-reward-timer';
        
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
            const coinsElement = document.getElementById('userCoins');
            coinsElement.textContent = result.coins;
            coinsElement.classList.add('coin-animation');
            setTimeout(() => coinsElement.classList.remove('coin-animation'), 600);
            
            // Обновляем прогресс
            updateRewardUI(result);
            
            // Показываем сообщение
            tg.showAlert(result.message);
            
            // Запускаем таймер если нужно
            if (!result.canClaim && result.timeUntilNextReward > 0) {
                startRewardTimer(result.timeUntilNextReward, userId);
            }
        } else {
            tg.showAlert(`❌ Ошибка: ${result.error}`);
        }
        
        claimBtn.disabled = false;
        claimBtn.textContent = '🎁 Забрать +10 монет';
        
    } catch (error) {
        console.error('Ошибка получения награды:', error);
        tg.showAlert('❌ Ошибка сети');
        claimBtn.disabled = false;
        claimBtn.textContent = '🎁 Забрать +10 монет';
    }
}

// Также добавьте вспомогательные функции:
function updateRewardUI(data) {
    const rewardCount = document.getElementById('rewardCount');
    const rewardProgress = document.getElementById('rewardProgress');
    const timerText = document.getElementById('timerText');
    const claimBtn = document.getElementById('claimRewardBtn');
    
    if (rewardCount && data.rewardCount !== undefined) {
        rewardCount.textContent = data.rewardCount;
    }
    
    if (rewardProgress && data.rewardCount !== undefined && data.maxRewards) {
        const progressPercent = (data.rewardCount / data.maxRewards) * 100;
        rewardProgress.style.width = `${progressPercent}%`;
    }
    
    if (timerText) {
        timerText.textContent = data.message || '✅ Готово к получению!';
    }
    
    if (claimBtn) {
        claimBtn.disabled = !data.canClaim;
        claimBtn.textContent = data.canClaim ? '🎁 Забрать +10 монет' : '⏳ Ждите...';
    }
}

function startRewardTimer(seconds, userId) {
    const timerText = document.getElementById('timerText');
    const claimBtn = document.getElementById('claimRewardBtn');
    
    let timeLeft = seconds;
    
    const timer = setInterval(() => {
        if (timerText) {
            timerText.textContent = `⏳ До следующей награды: ${timeLeft}с`;
        }
        timeLeft--;
        
        if (timeLeft < 0) {
            clearInterval(timer);
            if (timerText) timerText.textContent = '✅ Готово к получению!';
            if (claimBtn) {
                claimBtn.disabled = false;
                claimBtn.textContent = '🎁 Забрать +10 монет';
            }
        }
    }, 1000);
}

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

// Загрузка статуса ежедневных наград
async function loadRewardStatus(userId) {
    try {
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/reward-status';
        
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
            updateRewardUI(result);
            
            // Запускаем таймер если нужно
            if (!result.canClaim && result.timeUntilNextReward > 0) {
                startRewardTimer(result.timeUntilNextReward, userId);
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки статуса наград:', error);
    }
}

// Обновление интерфейса наград
function updateRewardUI(data) {
    const rewardCount = document.getElementById('rewardCount');
    const maxRewards = document.getElementById('maxRewards');
    const rewardProgress = document.getElementById('rewardProgress');
    const timerText = document.getElementById('timerText');
    const claimBtn = document.getElementById('claimRewardBtn');
    const coinsElement = document.getElementById('userCoins');
    
    // Обновляем прогресс
    rewardCount.textContent = data.rewardCount;
    maxRewards.textContent = data.maxRewards;
    
    const progressPercent = (data.rewardCount / data.maxRewards) * 100;
    rewardProgress.style.width = `${progressPercent}%`;
    
    // Обновляем баланс монет
    coinsElement.textContent = data.coins;
    
    // Обновляем таймер и кнопку
    if (data.rewardCount >= data.maxRewards) {
        timerText.textContent = '🎉 Все награды получены!';
        claimBtn.disabled = true;
        claimBtn.textContent = '✅ Завершено';
        rewardProgress.classList.add('progress-pulse');
    } else if (data.canClaim) {
        timerText.textContent = '✅ Готово к получению!';
        claimBtn.disabled = false;
        claimBtn.textContent = '🎁 Забрать +10 монет';
        rewardProgress.classList.remove('progress-pulse');
    } else {
        timerText.textContent = `⏳ До следующей награды: ${data.timeUntilNextReward}с`;
        claimBtn.disabled = true;
        claimBtn.textContent = '⏳ Ждите...';
        rewardProgress.classList.remove('progress-pulse');
    }
}

// Запрос ежедневной награды
async function claimDailyRewardTimer() {
    const userId = tg.initDataUnsafe?.user?.id;
    const claimBtn = document.getElementById('claimRewardBtn');
    
    if (!userId) {
        tg.showAlert('❌ Не удалось определить пользователя');
        return;
    }
    
    try {
        claimBtn.disabled = true;
        claimBtn.textContent = '🔄 Получаем...';
        
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/daily-reward-timer';
        
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
            // 🔥 ОБНОВЛЯЕМ ОСНОВНОЙ БАЛАНС МОНЕТ
            const coinsElement = document.getElementById('userCoins');
            coinsElement.textContent = result.coins; // Теперь это общий баланс
            coinsElement.classList.add('coin-animation');
            setTimeout(() => coinsElement.classList.remove('coin-animation'), 600);
            
            // Обновляем прогресс наград
            updateRewardUI(result);
            
            // Показываем сообщение
            tg.showAlert(result.message);
            
            // Запускаем таймер если нужно
            if (!result.canClaim && result.timeUntilNextReward > 0) {
                startRewardTimer(result.timeUntilNextReward, userId);
            }
        } else {
            tg.showAlert(`❌ Ошибка: ${result.error}`);
        }
        
        claimBtn.disabled = false;
        claimBtn.textContent = '🎁 Забрать +10 монет';
        
    } catch (error) {
        console.error('Ошибка получения награды:', error);
        tg.showAlert('❌ Ошибка сети');
        claimBtn.disabled = false;
        claimBtn.textContent = '🎁 Забрать +10 монет';
    }
}

// Таймер обратного отсчета
function startRewardTimer(seconds, userId) {
    const timerText = document.getElementById('timerText');
    const claimBtn = document.getElementById('claimRewardBtn');
    
    let timeLeft = seconds;
    
    const timer = setInterval(() => {
        timerText.textContent = `⏳ До следующей награды: ${timeLeft}с`;
        timeLeft--;
        
        if (timeLeft < 0) {
            clearInterval(timer);
            timerText.textContent = '✅ Готово к получению!';
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Забрать +10 монет';
            
            // Обновляем статус
            loadRewardStatus(userId);
        }
    }, 1000);
}

// В initApp добавляем загрузку статуса наград
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

        // Загружаем баланс и статус наград
        await loadUserBalance(user.id);
        await loadRewardStatus(user.id);

        // Проверяем подписку
        checkRealSubscription(user.id);

    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
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



