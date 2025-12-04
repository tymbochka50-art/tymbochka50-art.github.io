// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

// Базовый URL вашего backend на Vercel
const API_BASE_URL = 'https://telegram-backend-nine.vercel.app';

// ==================== СИСТЕМА LOCAL STORAGE ====================

// Улучшенные функции для работы с Local Storage
function setStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        console.log(`💾 Сохранено: ${key}`, value);
        return true;
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        return false;
    }
}

function getStorage(key) {
    try {
        const value = localStorage.getItem(key);
        if (value) {
            return JSON.parse(value);
        }
    } catch (error) {
        console.error('❌ Ошибка чтения:', error);
    }
    return null;
}

// Получить все данные пользователя
function getUserData(userId) {
    if (!userId) return null;
    
    const key = `cs2_user_${userId}`;
    let userData = getStorage(key);
    
    if (!userData) {
        console.log(`🆕 Создаем нового пользователя: ${userId}`);
        userData = {
            coins: 0,
            total_earned: 0,
            reward_count: 0,
            max_rewards: 30,
            referral_code: generateLocalReferralCode(userId),
            total_referrals: 0,
            referral_earnings: 0,
            subscription_reward_count: 0,
            last_name_reward_count: 0,
            darencs2_reward_count: 0,
            rewards_history: [],
            referrals: [],
            last_reward_time: null,
            last_subscription_reward_time: null,
            last_darencs2_reward_time: null,
            last_name_reward_time: null,
            inventory: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        setStorage(key, userData);
    }
    
    return userData;
}

// Сохранить данные пользователя
function saveUserData(userId, data) {
    if (!userId) return false;
    
    const key = `cs2_user_${userId}`;
    const existingData = getUserData(userId) || {};
    const updatedData = { ...existingData, ...data, updated_at: new Date().toISOString() };
    
    return setStorage(key, updatedData);
}

// Получить баланс
function getCoins(userId) {
    const userData = getUserData(userId);
    return userData?.coins || 0;
}

// Добавить монеты
function addCoins(userId, amount) {
    const userData = getUserData(userId);
    const currentCoins = userData?.coins || 0;
    const newCoins = currentCoins + amount;
    const currentTotal = userData?.total_earned || 0;
    
    saveUserData(userId, {
        coins: newCoins,
        total_earned: currentTotal + amount
    });
    
    console.log(`💰 +${amount} монет для ${userId}, всего: ${newCoins}`);
    return newCoins;
}

// Вычесть монеты
function deductCoins(userId, amount) {
    const userData = getUserData(userId);
    const currentCoins = userData?.coins || 0;
    const newCoins = Math.max(0, currentCoins - amount);
    
    saveUserData(userId, { coins: newCoins });
    return newCoins;
}

// ==================== API ФУНКЦИИ ====================

// Улучшенная функция API с таймаутом
async function callAPI(endpoint, data, timeout = 5000) {
    const userId = tg.initDataUnsafe?.user?.id;
    
    console.log(`📡 API запрос: ${endpoint}`, { ...data, userId });
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ ...data, userId: userId || data.userId }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        console.log(`✅ Ответ API ${endpoint}:`, result);
        
        return result;
        
    } catch (error) {
        console.error(`❌ Ошибка API ${endpoint}:`, error.message);
        throw error;
    }
}

// ==================== ОСНОВНЫЕ ФУНКЦИИ ====================

// Инициализация приложения
async function initApp() {
    try {
        console.log('🚀 Инициализация приложения...');
        
        tg.expand();
        tg.enableClosingConfirmation();
        
        const user = tg.initDataUnsafe?.user;
        
        if (!user) {
            document.body.innerHTML = '<div class="loading">❌ Ошибка: Не удалось получить данные пользователя</div>';
            return;
        }

        console.log('👤 Пользователь:', user);
        
        // Загружаем данные пользователя
        const userData = getUserData(user.id);
        console.log('💾 Данные пользователя:', userData);
        
        // Синхронизируем с сервером (если есть интернет)
        try {
            const serverResult = await callAPI('/create-or-get-user', { 
                userId: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                username: user.username
            });
            
            if (serverResult.success && !serverResult.fallback) {
                // Обновляем локальные данные серверными
                saveUserData(user.id, {
                    coins: serverResult.coins || userData.coins,
                    reward_count: serverResult.reward_count || userData.reward_count,
                    referral_code: serverResult.referral_code || userData.referral_code
                });
                console.log('✅ Синхронизировано с сервером');
            }
        } catch (error) {
            console.log('⚠️ Используем локальные данные');
        }
        
        // Инициализация интерфейса
        initNavigation();
        initModals();
        loadUserData(user);
        
        // Загружаем баланс
        const coins = getCoins(user.id);
        updateCoinsDisplay(coins);
        
        // Загружаем статусы
        loadAllStatuses(user);
        
        // Загружаем кейсы и инвентарь
        loadCases();
        loadInventory();
        loadProfileInventory();
        
        console.log('✅ Приложение инициализировано');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        showSafeAlert('❌ Ошибка загрузки приложения');
    }
}

// Загрузка всех статусов
async function loadAllStatuses(user) {
    const userId = user.id;
    
    // Баланс
    const coins = getCoins(userId);
    updateCoinsDisplay(coins);
    
    // Ежедневная награда
    loadRewardStatus(userId);
    
    // Рефералы
    loadReferralStats(userId);
    
    // Подписка на CS2DropZone (асинхронно)
    loadSubscriptionStatus(userId);
    
    // Подписка на DarenCs2 (асинхронно)
    loadDarenCs2Status(userId);
    
    // Фамилия
    loadLastNameStatus(user);
}

// ==================== СТАТУСЫ И ТАЙМЕРЫ ====================

// Загрузка статуса ежедневной награды
function loadRewardStatus(userId) {
    const userData = getUserData(userId);
    const now = new Date();
    let canClaim = true;
    let timeLeft = 0;
    
    if (userData?.last_reward_time) {
        const lastTime = new Date(userData.last_reward_time);
        const diffMs = now - lastTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        
        if (diffHours < 24) {
            canClaim = false;
            timeLeft = 24 * 60 * 60 - (diffMs / 1000);
        }
    }
    
    updateRewardUI({
        canClaim: canClaim,
        rewardCount: userData?.reward_count || 0,
        timeUntilNextReward: Math.floor(timeLeft),
        timeFormatted: formatTime(Math.floor(timeLeft)),
        timeFormattedHM: formatTimeHM(Math.floor(timeLeft))
    });
}

// Загрузка статуса подписки
async function loadSubscriptionStatus(userId) {
    try {
        const result = await callAPI('/check-subscription', { userId: userId });
        
        if (result.success && result.isSubscribed) {
            // Пользователь подписан, проверяем таймер
            const userData = getUserData(userId);
            const now = new Date();
            let canClaim = true;
            let timeLeft = 0;
            
            if (userData?.last_subscription_reward_time) {
                const lastTime = new Date(userData.last_subscription_reward_time);
                const diffMs = now - lastTime;
                const diffHours = diffMs / (1000 * 60 * 60);
                
                if (diffHours < 24) {
                    canClaim = false;
                    timeLeft = 24 * 60 * 60 - (diffMs / 1000);
                }
            }
            
            updateSubscriptionUI({
                isSubscribed: true,
                canClaim: canClaim,
                rewardCount: userData?.subscription_reward_count || 0,
                timeUntilNextReward: Math.floor(timeLeft),
                timeFormatted: formatTime(Math.floor(timeLeft))
            });
        } else {
            // Не подписан
            updateSubscriptionUI({
                isSubscribed: false,
                canClaim: false,
                rewardCount: 0
            });
        }
    } catch (error) {
        console.log('⚠️ Ошибка проверки подписки, показываем кнопку подписки');
        updateSubscriptionUI({
            isSubscribed: false,
            canClaim: false,
            rewardCount: 0
        });
    }
}

// Загрузка статуса DarenCs2
async function loadDarenCs2Status(userId) {
    try {
        const result = await callAPI('/check-darencs2-subscription', { userId: userId });
        
        if (result.success && result.isSubscribed) {
            // Пользователь подписан, проверяем таймер
            const userData = getUserData(userId);
            const now = new Date();
            let canClaim = true;
            let timeLeft = 0;
            
            if (userData?.last_darencs2_reward_time) {
                const lastTime = new Date(userData.last_darencs2_reward_time);
                const diffMs = now - lastTime;
                const diffHours = diffMs / (1000 * 60 * 60);
                
                if (diffHours < 12) {
                    canClaim = false;
                    timeLeft = 12 * 60 * 60 - (diffMs / 1000);
                }
            }
            
            updateDarenCs2UI({
                isSubscribed: true,
                canClaim: canClaim,
                rewardCount: userData?.darencs2_reward_count || 0,
                timeUntilNextReward: Math.floor(timeLeft),
                timeFormatted: formatTime(Math.floor(timeLeft))
            });
        } else {
            // Не подписан
            updateDarenCs2UI({
                isSubscribed: false,
                canClaim: false,
                rewardCount: 0
            });
        }
    } catch (error) {
        console.log('⚠️ Ошибка проверки подписки DarenCs2');
        updateDarenCs2UI({
            isSubscribed: false,
            canClaim: false,
            rewardCount: 0
        });
    }
}

// ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================

// Ежедневная награда
async function claimDailyReward() {
    const userId = tg.initDataUnsafe?.user?.id;
    const claimBtn = document.getElementById('claimRewardBtn');
    
    if (!userId || !claimBtn) return;
    
    try {
        claimBtn.disabled = true;
        claimBtn.textContent = '🔄 Получаем...';
        
        const userData = getUserData(userId);
        const now = new Date();
        let canClaim = true;
        
        // Проверяем таймер локально
        if (userData?.last_reward_time) {
            const lastTime = new Date(userData.last_reward_time);
            const diffHours = (now - lastTime) / (1000 * 60 * 60);
            
            if (diffHours < 24) {
                canClaim = false;
                const hoursLeft = 24 - Math.floor(diffHours);
                const minutesLeft = 60 - Math.floor((diffHours * 60) % 60);
                showSafeAlert(`⏳ До следующей награды: ${hoursLeft}ч ${minutesLeft}м`);
                claimBtn.disabled = false;
                claimBtn.textContent = '🎁 Забрать +50 монет';
                return;
            }
        }
        
        if (canClaim) {
            // Начисляем локально
            const coinsAwarded = 50;
            const newCoins = addCoins(userId, coinsAwarded);
            const newRewardCount = (userData?.reward_count || 0) + 1;
            
            saveUserData(userId, {
                reward_count: newRewardCount,
                last_reward_time: now.toISOString()
            });
            
            // Обновляем UI
            updateCoinsDisplay(newCoins);
            updateRewardUI({
                canClaim: false,
                rewardCount: newRewardCount,
                timeUntilNextReward: 24 * 60 * 60,
                timeFormatted: '24:00:00',
                timeFormattedHM: '24ч 0м'
            });
            
            startRewardTimer(24 * 60 * 60);
            showSafeAlert(`🎉 +${coinsAwarded} монет!`);
            
            // Пытаемся синхронизировать с сервером
            try {
                await callAPI('/daily-reward-timer', { userId: userId });
            } catch (error) {
                console.log('⚠️ Награда сохранена локально');
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка получения награды:', error);
        showSafeAlert('❌ Ошибка при получении награды');
    } finally {
        setTimeout(() => {
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Забрать +50 монет';
        }, 1000);
    }
}

// Награда за подписку
async function claimSubscriptionReward() {
    const userId = tg.initDataUnsafe?.user?.id;
    const claimBtns = document.querySelectorAll('.task-button');
    const claimBtn = claimBtns[1];
    
    if (!userId || !claimBtn) return;
    
    try {
        claimBtn.disabled = true;
        claimBtn.textContent = '🔄 Проверяем...';
        
        // 1. Проверяем подписку
        let isSubscribed = false;
        try {
            const result = await callAPI('/check-subscription', { userId: userId });
            isSubscribed = result.success && result.isSubscribed;
        } catch (error) {
            showSafeAlert('❌ Ошибка проверки подписки');
            claimBtn.disabled = false;
            claimBtn.textContent = '🔍 Проверить подписку';
            return;
        }
        
        if (!isSubscribed) {
            showSafeAlert('📢 Подпишитесь на канал @CS2DropZone');
            showSubscriptionModal();
            claimBtn.disabled = false;
            claimBtn.textContent = '🔍 Проверить подписку';
            return;
        }
        
        // 2. Проверяем таймер
        const userData = getUserData(userId);
        const now = new Date();
        let canClaim = true;
        
        if (userData?.last_subscription_reward_time) {
            const lastTime = new Date(userData.last_subscription_reward_time);
            const diffHours = (now - lastTime) / (1000 * 60 * 60);
            
            if (diffHours < 24) {
                canClaim = false;
                const hoursLeft = 24 - Math.floor(diffHours);
                const minutesLeft = 60 - Math.floor((diffHours * 60) % 60);
                showSafeAlert(`⏳ До следующей награды: ${hoursLeft}ч ${minutesLeft}м`);
                claimBtn.disabled = false;
                claimBtn.textContent = '🎁 Забрать +250 монет';
                return;
            }
        }
        
        if (canClaim) {
            // Начисляем награду
            const coinsAwarded = 250;
            const newCoins = addCoins(userId, coinsAwarded);
            const newRewardCount = (userData?.subscription_reward_count || 0) + 1;
            
            saveUserData(userId, {
                subscription_reward_count: newRewardCount,
                last_subscription_reward_time: now.toISOString()
            });
            
            // Обновляем UI
            updateCoinsDisplay(newCoins);
            updateSubscriptionUI({
                isSubscribed: true,
                canClaim: false,
                rewardCount: newRewardCount,
                timeUntilNextReward: 24 * 60 * 60,
                timeFormatted: '24:00:00'
            });
            
            startSubscriptionTimer(24 * 60 * 60);
            showSafeAlert(`🎉 +${coinsAwarded} монет за подписку!`);
            
            // Синхронизируем с сервером
            try {
                await callAPI('/subscription-reward', { userId: userId });
            } catch (error) {
                console.log('⚠️ Награда сохранена локально');
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка получения награды:', error);
        showSafeAlert('❌ Ошибка при получении награды');
    } finally {
        setTimeout(() => {
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Забрать +250 монет';
        }, 1000);
    }
}

// Награда за DarenCs2
async function claimDarenCs2Reward() {
    const userId = tg.initDataUnsafe?.user?.id;
    const claimBtn = document.getElementById('claimDarenCs2Btn');
    
    if (!userId || !claimBtn) return;
    
    try {
        claimBtn.disabled = true;
        claimBtn.textContent = '🔄 Проверяем...';
        
        // 1. Проверяем подписку
        let isSubscribed = false;
        try {
            const result = await callAPI('/check-darencs2-subscription', { userId: userId });
            isSubscribed = result.success && result.isSubscribed;
        } catch (error) {
            showSafeAlert('❌ Ошибка проверки подписки');
            claimBtn.disabled = false;
            claimBtn.textContent = '🔍 Проверить подписку';
            return;
        }
        
        if (!isSubscribed) {
            showSafeAlert('🎮 Подпишитесь на канал @DarenCs2');
            showDarenCs2Modal();
            claimBtn.disabled = false;
            claimBtn.textContent = '🔍 Проверить подписку';
            return;
        }
        
        // 2. Проверяем таймер
        const userData = getUserData(userId);
        const now = new Date();
        let canClaim = true;
        
        if (userData?.last_darencs2_reward_time) {
            const lastTime = new Date(userData.last_darencs2_reward_time);
            const diffHours = (now - lastTime) / (1000 * 60 * 60);
            
            if (diffHours < 12) {
                canClaim = false;
                const hoursLeft = 12 - Math.floor(diffHours);
                const minutesLeft = 60 - Math.floor((diffHours * 60) % 60);
                showSafeAlert(`⏳ До следующей награды: ${hoursLeft}ч ${minutesLeft}м`);
                claimBtn.disabled = false;
                claimBtn.textContent = '🎁 Забрать +200 монет';
                return;
            }
        }
        
        if (canClaim) {
            // Начисляем награду
            const coinsAwarded = 200;
            const newCoins = addCoins(userId, coinsAwarded);
            const newRewardCount = (userData?.darencs2_reward_count || 0) + 1;
            
            saveUserData(userId, {
                darencs2_reward_count: newRewardCount,
                last_darencs2_reward_time: now.toISOString()
            });
            
            // Обновляем UI
            updateCoinsDisplay(newCoins);
            updateDarenCs2UI({
                isSubscribed: true,
                canClaim: false,
                rewardCount: newRewardCount,
                timeUntilNextReward: 12 * 60 * 60,
                timeFormatted: '12:00:00'
            });
            
            startDarenCs2Timer(12 * 60 * 60);
            showSafeAlert(`🎮 +${coinsAwarded} монет за подписку на @DarenCs2!`);
            
            // Синхронизируем с сервером
            try {
                await callAPI('/darencs2-reward', { userId: userId });
            } catch (error) {
                console.log('⚠️ Награда сохранена локально');
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка получения награды:', error);
        showSafeAlert('❌ Ошибка при получении награды');
    } finally {
        setTimeout(() => {
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Забрать +200 монет';
        }, 1000);
    }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function generateLocalReferralCode(userId) {
    return `REF${userId.toString().slice(-4)}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

function updateCoinsDisplay(coins) {
    const coinsElements = document.querySelectorAll('#userCoins, #profileCoins');
    coinsElements.forEach(element => {
        if (element) {
            const formatted = parseInt(coins).toLocaleString('ru-RU');
            element.textContent = formatted;
            element.classList.add('coin-animation');
            setTimeout(() => element.classList.remove('coin-animation'), 600);
        }
    });
}

function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeHM(seconds) {
    if (!seconds || seconds <= 0) return '0ч 0м';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    return `${hours}ч ${minutes}м`;
}

function showSafeAlert(message) {
    console.log('💬 Alert:', message);
    
    try {
        tg.showAlert(message);
    } catch (error) {
        alert(message);
    }
}

// ==================== UI ФУНКЦИИ ====================

function updateRewardUI(data) {
    const timerText = document.getElementById('timerText');
    const claimBtn = document.getElementById('claimRewardBtn');
    const dailyProgress = document.getElementById('dailyProgress');
    
    if (dailyProgress) {
        dailyProgress.textContent = `${data.rewardCount || 0} наград получено`;
    }
    
    if (timerText && claimBtn) {
        if (data.canClaim) {
            timerText.textContent = '✅ Готово к получению!';
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Забрать +50 монет';
            claimBtn.onclick = claimDailyReward;
        } else {
            const timeDisplay = data.timeFormattedHM || formatTimeHM(data.timeUntilNextReward);
            timerText.textContent = `⏳ До следующей награды: ${timeDisplay}`;
            claimBtn.disabled = true;
            claimBtn.textContent = `⏳ ${data.timeFormatted || formatTime(data.timeUntilNextReward)}`;
            
            if (data.timeUntilNextReward > 0) {
                startRewardTimer(data.timeUntilNextReward);
            }
        }
    }
}

function updateSubscriptionUI(data) {
    const statusElement = document.getElementById('subscriptionStatus');
    const claimBtns = document.querySelectorAll('.task-button');
    const claimBtn = claimBtns[1];
    
    if (statusElement && claimBtn) {
        if (data.isSubscribed) {
            statusElement.textContent = `✅ Подписан (${data.rewardCount || 0} раз)`;
            statusElement.style.color = '#28a745';
            
            if (data.canClaim) {
                claimBtn.disabled = false;
                claimBtn.textContent = '🎁 Забрать +250 монет';
                claimBtn.onclick = claimSubscriptionReward;
            } else {
                claimBtn.disabled = true;
                claimBtn.textContent = `⏳ ${data.timeFormatted || formatTime(data.timeUntilNextReward)}`;
                if (data.timeUntilNextReward > 0) {
                    startSubscriptionTimer(data.timeUntilNextReward);
                }
            }
        } else {
            statusElement.textContent = '❌ Не подписан';
            statusElement.style.color = '#dc3545';
            claimBtn.disabled = false;
            claimBtn.textContent = '🔍 Проверить подписку';
            claimBtn.onclick = checkSubscriptionOnly;
        }
    }
}

function updateDarenCs2UI(data) {
    const statusElement = document.getElementById('darenCs2Status');
    const claimBtn = document.getElementById('claimDarenCs2Btn');
    
    if (statusElement && claimBtn) {
        if (data.isSubscribed) {
            statusElement.textContent = `✅ Подписан (${data.rewardCount || 0} раз)`;
            statusElement.style.color = '#28a745';
            
            if (data.canClaim) {
                claimBtn.disabled = false;
                claimBtn.textContent = '🎁 Забрать +200 монет';
                claimBtn.onclick = claimDarenCs2Reward;
            } else {
                claimBtn.disabled = true;
                claimBtn.textContent = `⏳ ${data.timeFormatted || formatTime(data.timeUntilNextReward)}`;
                if (data.timeUntilNextReward > 0) {
                    startDarenCs2Timer(data.timeUntilNextReward);
                }
            }
        } else {
            statusElement.textContent = '❌ Не подписан';
            statusElement.style.color = '#dc3545';
            claimBtn.disabled = false;
            claimBtn.textContent = '🔍 Проверить подписку';
            claimBtn.onclick = checkDarenCs2Only;
        }
    }
}

// ==================== ПРОВЕРКИ БЕЗ НАГРАД ====================

async function checkSubscriptionOnly() {
    const userId = tg.initDataUnsafe?.user?.id;
    
    try {
        const result = await callAPI('/check-subscription', { userId: userId });
        
        if (result.success && result.isSubscribed) {
            showSafeAlert('✅ Вы подписаны на канал @CS2DropZone!');
            
            // Обновляем статус
            const statusElement = document.getElementById('subscriptionStatus');
            if (statusElement) {
                statusElement.textContent = '✅ Подписан';
                statusElement.style.color = '#28a745';
            }
            
            // Обновляем кнопку
            const claimBtns = document.querySelectorAll('.task-button');
            const claimBtn = claimBtns[1];
            if (claimBtn) {
                claimBtn.textContent = '🎁 Забрать +250 монет';
                claimBtn.onclick = claimSubscriptionReward;
            }
        } else {
            showSafeAlert('📢 Подпишитесь на канал @CS2DropZone');
            showSubscriptionModal();
        }
    } catch (error) {
        showSafeAlert('📢 Подпишитесь на канал @CS2DropZone');
        showSubscriptionModal();
    }
}

async function checkDarenCs2Only() {
    const userId = tg.initDataUnsafe?.user?.id;
    
    try {
        const result = await callAPI('/check-darencs2-subscription', { userId: userId });
        
        if (result.success && result.isSubscribed) {
            showSafeAlert('✅ Вы подписаны на канал @DarenCs2!');
            
            // Обновляем статус
            const statusElement = document.getElementById('darenCs2Status');
            if (statusElement) {
                statusElement.textContent = '✅ Подписан';
                statusElement.style.color = '#28a745';
            }
            
            // Обновляем кнопку
            const claimBtn = document.getElementById('claimDarenCs2Btn');
            if (claimBtn) {
                claimBtn.textContent = '🎁 Забрать +200 монет';
                claimBtn.onclick = claimDarenCs2Reward;
            }
        } else {
            showSafeAlert('🎮 Подпишитесь на канал @DarenCs2');
            showDarenCs2Modal();
        }
    } catch (error) {
        showSafeAlert('🎮 Подпишитесь на канал @DarenCs2');
        showDarenCs2Modal();
    }
}

// ==================== ОТКРЫТИЕ КЕЙСОВ ====================

function startCaseOpening(caseData) {
    const userId = tg.initDataUnsafe?.user?.id;
    
    if (!userId) {
        showSafeAlert('❌ Ошибка: пользователь не определен');
        return;
    }
    
    const currentCoins = getCoins(userId);
    
    if (currentCoins < caseData.price) {
        showSafeAlert(`❌ Недостаточно монет! Нужно: ${caseData.price}, у вас: ${currentCoins}`);
        return;
    }
    
    // Сразу списываем монеты
    const newCoins = deductCoins(userId, caseData.price);
    updateCoinsDisplay(newCoins);
    
    document.getElementById('caseModal').style.display = 'none';
    showRoulette(caseData);
}

// ==================== ЭКСПОРТ ФУНКЦИЙ ====================

window.claimDailyRewardTimer = claimDailyReward;
window.claimSubscriptionReward = claimSubscriptionReward;
window.claimDarenCs2Reward = claimDarenCs2Reward;
window.checkSubscriptionOnly = checkSubscriptionOnly;
window.checkDarenCs2Only = checkDarenCs2Only;
window.openTelegramChannel = openTelegramChannel;
window.openDarenCs2Channel = openDarenCs2Channel;

// Запуск приложения
document.addEventListener('DOMContentLoaded', initApp);
