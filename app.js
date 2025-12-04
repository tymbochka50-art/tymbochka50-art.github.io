// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

// Базовый URL вашего backend на Vercel
const API_BASE_URL = 'https://telegram-backend-nine.vercel.app';

// ==================== СИСТЕМА КУКИ ====================

// Функции для работы с куки
function setCookie(name, value, days = 30) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + JSON.stringify(value) + ";" + expires + ";path=/;SameSite=Strict";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1);
        if (c.indexOf(nameEQ) === 0) {
            const cookieValue = c.substring(nameEQ.length);
            try {
                return JSON.parse(cookieValue);
            } catch (e) {
                return cookieValue;
            }
        }
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999; path=/';
}

// Получить все данные пользователя из куки
function getUserCookies(userId) {
    if (!userId) return null;
    const cookieData = getCookie(`user_${userId}`);
    if (!cookieData) {
        // Создаем начальные данные
        const initialData = {
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
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        setCookie(`user_${userId}`, initialData, 365);
        return initialData;
    }
    return cookieData;
}

// Сохранить данные пользователя в куки
function saveUserToCookies(userId, userData) {
    if (!userId) return;
    
    const existingData = getUserCookies(userId) || {};
    const updatedData = { ...existingData, ...userData, updated_at: new Date().toISOString() };
    setCookie(`user_${userId}`, updatedData, 365);
    
    // Также сохраняем отдельные поля для быстрого доступа
    if (userData.coins !== undefined) {
        setCookie(`coins_${userId}`, userData.coins, 365);
    }
}

// Обновить конкретное поле пользователя в куки
function updateUserCookie(userId, updates) {
    const userData = getUserCookies(userId) || {};
    const updatedData = { ...userData, ...updates, updated_at: new Date().toISOString() };
    saveUserToCookies(userId, updatedData);
}

// Получить баланс из куки
function getCoinsFromCookie(userId) {
    const userData = getUserCookies(userId);
    return userData?.coins || 0;
}

// Добавить монеты в куки
function addCoinsToCookie(userId, amount) {
    const currentCoins = getCoinsFromCookie(userId);
    const newCoins = currentCoins + amount;
    updateUserCookie(userId, { 
        coins: newCoins,
        total_earned: (getUserCookies(userId)?.total_earned || 0) + amount
    });
    return newCoins;
}

// ==================== УНИВЕРСАЛЬНАЯ ФУНКЦИЯ API С КУКИ ====================

// Универсальная функция для API запросов с fallback на куки
async function callAPIWithCookieFallback(endpoint, data, successCallback, errorCallback) {
    const userId = tg.initDataUnsafe?.user?.id;
    const endpointName = endpoint.split('/').pop() || 'unknown';
    
    console.log(`📡 API запрос: ${endpoint}`, data);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(data)
        });
        
        console.log(`📡 Ответ сервера ${endpoint}:`, response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log(`📡 Результат API ${endpoint}:`, result);
        
        // Сохраняем данные в куки при успешном ответе
        if (result.success && userId) {
            if (endpoint === '/create-or-get-user') {
                saveUserToCookies(userId, {
                    coins: result.coins || 0,
                    reward_count: result.reward_count || 0,
                    referral_code: result.referral_code,
                    created: result.created
                });
            }
            else if (endpoint === '/daily-reward-timer' && result.coinsAwarded > 0) {
                const newCoins = addCoinsToCookie(userId, result.coinsAwarded);
                updateUserCookie(userId, {
                    reward_count: result.rewardCount || 0,
                    last_reward_time: result.nextRewardTime || new Date().toISOString()
                });
            }
            else if (endpoint === '/subscription-reward' && result.coinsAwarded > 0) {
                const newCoins = addCoinsToCookie(userId, result.coinsAwarded);
                updateUserCookie(userId, {
                    subscription_reward_count: result.rewardCount || 0,
                    last_subscription_reward_time: result.nextRewardTime || new Date().toISOString()
                });
            }
            else if (endpoint === '/darencs2-reward' && result.coinsAwarded > 0) {
                const newCoins = addCoinsToCookie(userId, result.coinsAwarded);
                updateUserCookie(userId, {
                    darencs2_reward_count: result.rewardCount || 0,
                    last_darencs2_reward_time: result.nextRewardTime || new Date().toISOString()
                });
            }
            else if (endpoint === '/check-special-lastname' && result.coinsAwarded > 0) {
                const newCoins = addCoinsToCookie(userId, result.coinsAwarded);
                updateUserCookie(userId, {
                    last_name_reward_count: result.rewardCount || 0,
                    last_name_reward_time: result.lastRewardTime || new Date().toISOString()
                });
            }
            else if (endpoint === '/generate-referral' && result.referralCode) {
                updateUserCookie(userId, {
                    referral_code: result.referralCode,
                    total_referrals: result.totalReferrals || 0,
                    referral_earnings: result.referralEarnings || 0
                });
            }
        }
        
        if (successCallback) successCallback(result);
        return result;
        
    } catch (error) {
        console.error(`❌ Ошибка API ${endpoint}:`, error);
        
        // Используем данные из куки как fallback
        const fallbackResult = getFallbackResponse(endpoint, data, userId);
        
        if (errorCallback) errorCallback(fallbackResult);
        return fallbackResult;
    }
}

// Получить fallback ответ из куки
function getFallbackResponse(endpoint, data, userId) {
    const userData = getUserCookies(userId);
    
    switch(endpoint) {
        case '/create-or-get-user':
            return {
                success: true,
                fallback: true,
                user_id: userId,
                coins: userData?.coins || 0,
                reward_count: userData?.reward_count || 0,
                referral_code: userData?.referral_code || generateLocalReferralCode(userId),
                created: true,
                message: 'Используются данные из локального хранилища'
            };
            
        case '/daily-reward-timer':
            return dailyRewardFallback(userId, userData);
            
        case '/subscription-reward':
            return subscriptionRewardFallback(userId, userData);
            
        case '/darencs2-reward':
            return darencs2RewardFallback(userId, userData);
            
        case '/check-special-lastname':
            return lastNameRewardFallback(userId, userData, data?.lastName);
            
        case '/generate-referral':
            return {
                success: true,
                fallback: true,
                referralCode: userData?.referral_code || generateLocalReferralCode(userId),
                referralLink: `https://t.me/Cs2DropSkinBot?start=ref_${userData?.referral_code || generateLocalReferralCode(userId)}`,
                totalReferrals: userData?.total_referrals || 0,
                referralEarnings: userData?.referral_earnings || 0,
                message: 'Используются данные из локального хранилища'
            };
            
        default:
            return {
                success: false,
                fallback: true,
                error: 'Ошибка соединения с сервером',
                message: 'Используются данные из локального хранилища'
            };
    }
}

// Fallback для ежедневной награды
function dailyRewardFallback(userId, userData) {
    const now = new Date();
    const lastRewardTime = userData?.last_reward_time;
    let coinsAwarded = 0;
    let message = '';
    
    if (lastRewardTime) {
        const timeDiff = now - new Date(lastRewardTime);
        const hoursPassed = Math.floor(timeDiff / (1000 * 60 * 60));
        
        if (hoursPassed < 24) {
            const hoursLeft = 24 - hoursPassed;
            const minutesLeft = 60 - Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            message = `⏳ До следующей награды: ${hoursLeft}ч ${minutesLeft}м (оффлайн)`;
        } else {
            coinsAwarded = 50;
            const newRewardCount = (userData?.reward_count || 0) + 1;
            addCoinsToCookie(userId, coinsAwarded);
            updateUserCookie(userId, {
                reward_count: newRewardCount,
                last_reward_time: now.toISOString()
            });
            message = `🎉 +${coinsAwarded} монет! (оффлайн)`;
        }
    } else {
        coinsAwarded = 50;
        addCoinsToCookie(userId, coinsAwarded);
        updateUserCookie(userId, {
            reward_count: 1,
            last_reward_time: now.toISOString()
        });
        message = `🎉 +${coinsAwarded} монет! (оффлайн)`;
    }
    
    return {
        success: true,
        fallback: true,
        coinsAwarded: coinsAwarded,
        coins: getCoinsFromCookie(userId),
        rewardCount: userData?.reward_count || 0,
        maxRewards: 30,
        message: message,
        canClaim: coinsAwarded > 0,
        nextRewardTime: userData?.last_reward_time || now.toISOString()
    };
}

// Fallback для награды за подписку
function subscriptionRewardFallback(userId, userData) {
    const now = new Date();
    const lastRewardTime = userData?.last_subscription_reward_time;
    let coinsAwarded = 0;
    let message = '';
    
    // В оффлайн режиме считаем что пользователь подписан
    if (lastRewardTime) {
        const timeDiff = now - new Date(lastRewardTime);
        const hoursPassed = Math.floor(timeDiff / (1000 * 60 * 60));
        
        if (hoursPassed < 24) {
            const hoursLeft = 24 - hoursPassed;
            const minutesLeft = 60 - Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            message = `⏳ До следующей награды: ${hoursLeft}ч ${minutesLeft}м (оффлайн)`;
        } else {
            coinsAwarded = 250;
            const newRewardCount = (userData?.subscription_reward_count || 0) + 1;
            addCoinsToCookie(userId, coinsAwarded);
            updateUserCookie(userId, {
                subscription_reward_count: newRewardCount,
                last_subscription_reward_time: now.toISOString()
            });
            message = `🎉 +${coinsAwarded} монет за подписку! (оффлайн)`;
        }
    } else {
        coinsAwarded = 250;
        addCoinsToCookie(userId, coinsAwarded);
        updateUserCookie(userId, {
            subscription_reward_count: 1,
            last_subscription_reward_time: now.toISOString()
        });
        message = `🎉 +${coinsAwarded} монет за подписку! (оффлайн)`;
    }
    
    return {
        success: true,
        fallback: true,
        coinsAwarded: coinsAwarded,
        coins: getCoinsFromCookie(userId),
        isSubscribed: true,
        message: message,
        canClaim: coinsAwarded > 0,
        rewardCount: userData?.subscription_reward_count || 0
    };
}

// Fallback для награды @DarenCs2
function darencs2RewardFallback(userId, userData) {
    const now = new Date();
    const lastRewardTime = userData?.last_darencs2_reward_time;
    let coinsAwarded = 0;
    let message = '';
    
    // В оффлайн режиме считаем что пользователь подписан
    if (lastRewardTime) {
        const timeDiff = now - new Date(lastRewardTime);
        const hoursPassed = Math.floor(timeDiff / (1000 * 60 * 60));
        
        if (hoursPassed < 12) {
            const hoursLeft = 12 - hoursPassed;
            const minutesLeft = 60 - Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            message = `⏳ До следующей награды: ${hoursLeft}ч ${minutesLeft}м (оффлайн)`;
        } else {
            coinsAwarded = 200;
            const newRewardCount = (userData?.darencs2_reward_count || 0) + 1;
            addCoinsToCookie(userId, coinsAwarded);
            updateUserCookie(userId, {
                darencs2_reward_count: newRewardCount,
                last_darencs2_reward_time: now.toISOString()
            });
            message = `🎮 +${coinsAwarded} монет за подписку на @DarenCs2! (оффлайн)`;
        }
    } else {
        coinsAwarded = 200;
        addCoinsToCookie(userId, coinsAwarded);
        updateUserCookie(userId, {
            darencs2_reward_count: 1,
            last_darencs2_reward_time: now.toISOString()
        });
        message = `🎮 +${coinsAwarded} монет за подписку на @DarenCs2! (оффлайн)`;
    }
    
    return {
        success: true,
        fallback: true,
        coinsAwarded: coinsAwarded,
        coins: getCoinsFromCookie(userId),
        isSubscribed: true,
        message: message,
        canClaim: coinsAwarded > 0,
        rewardCount: userData?.darencs2_reward_count || 0
    };
}

// Fallback для награды за фамилию
function lastNameRewardFallback(userId, userData, lastName) {
    const now = new Date();
    const lastRewardTime = userData?.last_name_reward_time;
    const specialLastName = '@Cs2DropSkinBot';
    const hasCorrectLastName = lastName === specialLastName;
    
    let coinsAwarded = 0;
    let message = '';
    
    if (hasCorrectLastName) {
        if (lastRewardTime) {
            const timeDiff = now - new Date(lastRewardTime);
            const hoursPassed = Math.floor(timeDiff / (1000 * 60 * 60));
            
            if (hoursPassed < 5) {
                const hoursLeft = 5 - hoursPassed;
                const minutesLeft = 60 - Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                message = `⏳ До следующей награды: ${hoursLeft}ч ${minutesLeft}м (оффлайн)`;
            } else {
                coinsAwarded = 50;
                const newRewardCount = (userData?.last_name_reward_count || 0) + 1;
                addCoinsToCookie(userId, coinsAwarded);
                updateUserCookie(userId, {
                    last_name_reward_count: newRewardCount,
                    last_name_reward_time: now.toISOString()
                });
                message = `🎉 +${coinsAwarded} монет за установку фамилии! (оффлайн)`;
            }
        } else {
            coinsAwarded = 50;
            addCoinsToCookie(userId, coinsAwarded);
            updateUserCookie(userId, {
                last_name_reward_count: 1,
                last_name_reward_time: now.toISOString()
            });
            message = `🎉 +${coinsAwarded} монет за установку фамилии! (оффлайн)`;
        }
    } else {
        message = `❌ Установите фамилию: ${specialLastName} (оффлайн)`;
    }
    
    return {
        success: true,
        fallback: true,
        hasCorrectLastName: hasCorrectLastName,
        coinsAwarded: coinsAwarded,
        coins: getCoinsFromCookie(userId),
        message: message,
        canClaim: coinsAwarded > 0,
        rewardCount: userData?.last_name_reward_count || 0
    };
}

// ==================== ОСНОВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ====================

async function initApp() {
    try {
        tg.expand();
        tg.enableClosingConfirmation();
        
        const user = tg.initDataUnsafe?.user;
        
        if (!user) {
            document.body.innerHTML = '<div class="loading">Ошибка: Не удалось получить данные пользователя</div>';
            return;
        }

        console.log('📊 Данные пользователя:', user);
        console.log('🍪 Куки пользователя:', getUserCookies(user.id));

        // ПЕРВОЕ: Проверяем куки пользователя
        const userCookies = getUserCookies(user.id);
        
        // ВТОРОЕ: Пытаемся синхронизировать с сервером
        try {
            const serverResult = await callAPIWithCookieFallback('/create-or-get-user', { userId: user.id },
                (result) => {
                    console.log('✅ Серверный ответ:', result);
                    // Обновляем куки данными с сервера
                    if (result.success && !result.fallback) {
                        saveUserToCookies(user.id, {
                            coins: result.coins || 0,
                            reward_count: result.reward_count || 0,
                            referral_code: result.referral_code,
                            created: result.created
                        });
                    }
                },
                (errorResult) => {
                    console.log('⚠️ Используем куки:', errorResult);
                }
            );
        } catch (error) {
            console.log('⚠️ Ошибка синхронизации, используем куки');
        }

        // Инициализация навигации
        initNavigation();
        initModals();

        // Загрузка данных пользователя
        await loadUserData(user);

        // Загрузка баланса и статусов ИЗ КУКИ
        await loadUserBalanceFromCookie(user.id);
        await loadRewardStatusFromCookie(user.id);
        await loadReferralStatsFromCookie(user.id);
        await loadSubscriptionStatusFromCookie(user.id);
        await loadLastNameStatusFromCookie(user);
        await loadDarenCs2StatusFromCookie(user.id);

        // Загрузка кейсов и инвентаря
        loadCases();
        loadInventory();
        loadProfileInventory();

        // Обновляем статистику инвентаря
        updateInventoryStats();

        console.log('✅ Приложение инициализировано с куки системой');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        showSafeAlert('❌ Ошибка загрузки приложения. Пожалуйста, перезагрузите.');
    }
}

// ==================== ФУНКЦИИ ЗАГРУЗКИ ИЗ КУКИ ====================

// Загрузка баланса из куки
async function loadUserBalanceFromCookie(userId) {
    const coins = getCoinsFromCookie(userId);
    updateCoinsDisplay(coins);
}

// Загрузка статуса наград из куки
async function loadRewardStatusFromCookie(userId) {
    const userData = getUserCookies(userId);
    const now = new Date();
    
    let timeUntilNextReward = 0;
    let canClaim = true;
    let timeFormatted = '00:00:00';
    let timeFormattedHM = '0ч 0м';

    if (userData?.last_reward_time) {
        const timeDiff = now - new Date(userData.last_reward_time);
        const secondsPassed = Math.floor(timeDiff / 1000);
        
        if (secondsPassed < 86400) {
            timeUntilNextReward = 86400 - secondsPassed;
            canClaim = false;
            
            const timeInfo = formatTimeRemaining(timeUntilNextReward);
            timeFormatted = timeInfo.formatted;
            timeFormattedHM = timeInfo.formattedHM;
        }
    }

    updateRewardUI({
        canClaim: canClaim,
        rewardCount: userData?.reward_count || 0,
        timeUntilNextReward: timeUntilNextReward,
        timeFormatted: timeFormatted,
        timeFormattedHM: timeFormattedHM
    });
}

// Обновление UI наград
function updateRewardUI(data) {
    const dailyProgress = document.getElementById('dailyProgress');
    const rewardProgress = document.getElementById('rewardProgress');
    const timerText = document.getElementById('timerText');
    const claimBtn = document.getElementById('claimRewardBtn');
    
    if (dailyProgress) {
        dailyProgress.textContent = `${data.rewardCount || 0} наград получено`;
    }
    
    if (rewardProgress) {
        const progressPercent = 100;
        rewardProgress.style.width = `${progressPercent}%`;
    }
    
    if (timerText && claimBtn) {
        if (data.canClaim) {
            timerText.textContent = '✅ Готово к получению!';
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Забрать +50 монет';
            if (rewardProgress) rewardProgress.classList.remove('progress-pulse');
        } else {
            const timeDisplay = data.timeFormattedHM || formatTimeHM(data.timeUntilNextReward);
            timerText.textContent = `⏳ До следующей награды: ${timeDisplay}`;
            claimBtn.disabled = true;
            claimBtn.textContent = `⏳ ${data.timeFormatted || formatTime(data.timeUntilNextReward)}`;
            if (rewardProgress) rewardProgress.classList.remove('progress-pulse');
            
            if (data.timeUntilNextReward > 0) {
                startRewardTimer(data.timeUntilNextReward);
            }
        }
    }
    
    const profileRewards = document.getElementById('profileRewards');
    if (profileRewards) {
        profileRewards.textContent = data.rewardCount || 0;
    }
}

// Загрузка реферальной статистики из куки
async function loadReferralStatsFromCookie(userId) {
    const userData = getUserCookies(userId);
    updateReferralStats({
        totalReferrals: userData?.total_referrals || 0,
        referralEarnings: userData?.referral_earnings || 0,
        referralCode: userData?.referral_code || generateLocalReferralCode(userId)
    });
}

// Обновление реферальной статистики
function updateReferralStats(data) {
    const totalReferrals = document.getElementById('totalReferrals');
    const referralEarnings = document.getElementById('referralEarnings');
    const referralProgress = document.getElementById('referralProgress');
    
    if (totalReferrals) {
        totalReferrals.textContent = data.totalReferrals || 0;
    }
    
    if (referralEarnings) {
        referralEarnings.textContent = data.referralEarnings || 0;
    }
    
    if (referralProgress) {
        referralProgress.textContent = `${data.totalReferrals || 0} приглашено`;
    }
    
    const profileReferrals = document.getElementById('profileReferrals');
    if (profileReferrals) {
        profileReferrals.textContent = data.totalReferrals || 0;
    }
}

// Загрузка статуса подписки из куки
async function loadSubscriptionStatusFromCookie(userId) {
    const userData = getUserCookies(userId);
    const now = new Date();
    
    let timeUntilNextReward = 0;
    let canClaim = true;
    let timeFormatted = '00:00:00';
    let timeFormattedHM = '0ч 0м';

    if (userData?.last_subscription_reward_time) {
        const timeDiff = now - new Date(userData.last_subscription_reward_time);
        const secondsPassed = Math.floor(timeDiff / 1000);
        
        if (secondsPassed < 86400) {
            timeUntilNextReward = 86400 - secondsPassed;
            canClaim = false;
            
            const timeInfo = formatTimeRemaining(timeUntilNextReward);
            timeFormatted = timeInfo.formatted;
            timeFormattedHM = timeInfo.formattedHM;
        }
    }

    // В оффлайн режиме считаем что пользователь не подписан
    updateSubscriptionUI({
        isSubscribed: false,
        canClaim: canClaim,
        rewardCount: userData?.subscription_reward_count || 0,
        timeUntilNextReward: timeUntilNextReward,
        timeFormatted: timeFormatted,
        timeFormattedHM: timeFormattedHM
    });
}

// Обновление UI подписки
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
                claimBtn.onclick = () => claimSubscriptionReward();
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
            claimBtn.onclick = () => checkSubscriptionOnly();
        }
    }
}

// Загрузка статуса фамилии из куки
async function loadLastNameStatusFromCookie(user) {
    const userId = user?.id;
    const userData = getUserCookies(userId);
    const now = new Date();
    
    let timeUntilNextReward = 0;
    let canClaim = true;
    let timeFormatted = '00:00:00';
    let timeFormattedHM = '0ч 0м';

    if (userData?.last_name_reward_time) {
        const timeDiff = now - new Date(userData.last_name_reward_time);
        const secondsPassed = Math.floor(timeDiff / 1000);
        
        if (secondsPassed < 18000) { // 5 часов
            timeUntilNextReward = 18000 - secondsPassed;
            canClaim = false;
            
            const timeInfo = formatTimeRemaining(timeUntilNextReward);
            timeFormatted = timeInfo.formatted;
            timeFormattedHM = timeInfo.formattedHM;
        }
    }

    // Проверяем фамилию
    const specialLastName = '@Cs2DropSkinBot';
    const hasCorrectLastName = user?.last_name === specialLastName;

    updateLastNameUI({
        hasCorrectLastName: hasCorrectLastName,
        canClaim: canClaim && hasCorrectLastName,
        timeUntilNextReward: timeUntilNextReward,
        timeFormatted: timeFormatted,
        timeFormattedHM: timeFormattedHM,
        rewardCount: userData?.last_name_reward_count || 0
    });
}

// Обновление UI фамилии
function updateLastNameUI(data) {
    const nameStatus = document.getElementById('nameStatus');
    const bonusBtns = document.querySelectorAll('.task-button');
    const bonusBtn = bonusBtns[2];
    
    if (nameStatus && bonusBtn) {
        if (data.hasCorrectLastName) {
            nameStatus.textContent = '✅ Фамилия установлена';
            nameStatus.style.color = '#28a745';
            
            if (data.canClaim) {
                bonusBtn.disabled = false;
                bonusBtn.textContent = '🎁 Забрать +50 монет';
                bonusBtn.onclick = () => checkSpecialLastName();
            } else {
                bonusBtn.disabled = true;
                bonusBtn.textContent = `⏳ ${data.timeFormatted || formatTime(data.timeUntilNextReward)}`;
                if (data.timeUntilNextReward > 0) {
                    startLastNameTimer(data.timeUntilNextReward);
                }
            }
        } else {
            nameStatus.textContent = '❌ Не выполнено';
            nameStatus.style.color = '#dc3545';
            bonusBtn.disabled = false;
            bonusBtn.textContent = '🔍 Проверить фамилию';
            bonusBtn.onclick = () => checkSpecialLastName();
        }
    }
}

// Загрузка статуса @DarenCs2 из куки
async function loadDarenCs2StatusFromCookie(userId) {
    const userData = getUserCookies(userId);
    const now = new Date();
    
    let timeUntilNextReward = 0;
    let canClaim = true;
    let timeFormatted = '00:00:00';
    let timeFormattedHM = '0ч 0м';

    if (userData?.last_darencs2_reward_time) {
        const timeDiff = now - new Date(userData.last_darencs2_reward_time);
        const secondsPassed = Math.floor(timeDiff / 1000);
        
        if (secondsPassed < 43200) { // 12 часов
            timeUntilNextReward = 43200 - secondsPassed;
            canClaim = false;
            
            const timeInfo = formatTimeRemaining(timeUntilNextReward);
            timeFormatted = timeInfo.formatted;
            timeFormattedHM = timeInfo.formattedHM;
        }
    }

    // В оффлайн режиме считаем что пользователь не подписан
    updateDarenCs2UI({
        isSubscribed: false,
        canClaim: canClaim,
        rewardCount: userData?.darencs2_reward_count || 0,
        timeUntilNextReward: timeUntilNextReward,
        timeFormatted: timeFormatted,
        timeFormattedHM: timeFormattedHM
    });
}

// Обновление UI @DarenCs2
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
        claimBtn.onclick = () => claimDarenCs2Reward();
      } else {
        claimBtn.disabled = true;
        claimBtn.textContent = `⏳ ${data.timeFormatted || '00:00:00'}`;
        if (data.timeUntilNextReward > 0) {
          startDarenCs2Timer(data.timeUntilNextReward);
        }
      }
    } else {
      statusElement.textContent = '❌ Не подписан';
      statusElement.style.color = '#dc3545';
      claimBtn.disabled = false;
      claimBtn.textContent = '🔍 Проверить подписку';
      claimBtn.onclick = () => checkDarenCs2Only();
    }
  }
}

// ==================== ОСНОВНЫЕ ФУНКЦИИ С КУКИ ====================

// Ежедневная награда с куки
async function claimDailyRewardTimer() {
    const userId = tg.initDataUnsafe?.user?.id;
    const claimBtn = document.getElementById('claimRewardBtn');
    
    if (!userId) {
        showSafeAlert('❌ Не удалось определить пользователя');
        return;
    }
    
    try {
        const originalText = claimBtn.textContent;
        claimBtn.disabled = true;
        claimBtn.textContent = '🔄 Получаем...';
        
        // Пытаемся отправить на сервер, fallback на куки
        await callAPIWithCookieFallback('/daily-reward-timer', { userId: userId },
            (result) => {
                if (result.success) {
                    if (result.coinsAwarded > 0) {
                        addCoins(result.coinsAwarded);
                        showSafeAlert(`✅ ${result.message || 'Ежедневная награда получена!'}`);
                        
                        updateRewardUI({
                            canClaim: false,
                            rewardCount: result.rewardCount || 0,
                            timeUntilNextReward: 24 * 60 * 60,
                            timeFormatted: '24:00:00',
                            timeFormattedHM: '24ч 0м'
                        });
                        
                        startRewardTimer(24 * 60 * 60);
                        
                    } else {
                        showSafeAlert(result.message || '⏳ Вы уже получали награду сегодня');
                    }
                } else {
                    showSafeAlert(result.error || '❌ Ошибка при получении награды');
                }
            },
            (fallbackResult) => {
                // Используем fallback результат
                if (fallbackResult.coinsAwarded > 0) {
                    addCoins(fallbackResult.coinsAwarded);
                    showSafeAlert(`✅ ${fallbackResult.message}`);
                    
                    updateRewardUI({
                        canClaim: false,
                        rewardCount: fallbackResult.rewardCount || 0,
                        timeUntilNextReward: 24 * 60 * 60,
                        timeFormatted: '24:00:00',
                        timeFormattedHM: '24ч 0м'
                    });
                    
                    startRewardTimer(24 * 60 * 60);
                } else {
                    showSafeAlert(fallbackResult.message || '⏳ Вы уже получали награду сегодня');
                }
            }
        );
        
    } catch (error) {
        console.error('Ошибка получения награды:', error);
        showSafeAlert('❌ Ошибка при получении награды');
    } finally {
        setTimeout(() => {
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Забрать +50 монет';
        }, 1000);
    }
}

// Награда за подписку с куки
async function claimSubscriptionReward() {
    const userId = tg.initDataUnsafe?.user?.id;
    const claimBtns = document.querySelectorAll('.task-button');
    const claimBtn = claimBtns[1];
    
    if (!userId) {
        showSafeAlert('❌ Не удалось определить пользователя');
        return;
    }
    
    try {
        const originalText = claimBtn.textContent;
        claimBtn.disabled = true;
        claimBtn.textContent = '🔄 Проверяем...';
        
        await callAPIWithCookieFallback('/subscription-reward', { userId: userId },
            (result) => {
                if (result.success) {
                    if (result.coinsAwarded > 0) {
                        addCoins(result.coinsAwarded);
                        showSafeAlert(`✅ ${result.message || 'Награда получена!'}`);
                        
                        updateSubscriptionUI({
                            isSubscribed: true,
                            canClaim: false,
                            rewardCount: result.rewardCount || 0,
                            timeUntilNextReward: 24 * 60 * 60,
                            timeFormatted: '24:00:00'
                        });
                        
                        startSubscriptionTimer(24 * 60 * 60);
                        
                    } else if (!result.isSubscribed) {
                        showSafeAlert('📢 Для получения награды нужно подписаться на канал @CS2DropZone');
                        showSubscriptionModal();
                    } else {
                        showSafeAlert(result.message || '⏳ Вы уже получали награду сегодня');
                    }
                } else {
                    showSafeAlert(result.error || '❌ Ошибка при получении награды');
                }
            },
            (fallbackResult) => {
                if (fallbackResult.coinsAwarded > 0) {
                    addCoins(fallbackResult.coinsAwarded);
                    showSafeAlert(`✅ ${fallbackResult.message}`);
                    
                    updateSubscriptionUI({
                        isSubscribed: true,
                        canClaim: false,
                        rewardCount: fallbackResult.rewardCount || 0,
                        timeUntilNextReward: 24 * 60 * 60,
                        timeFormatted: '24:00:00'
                    });
                    
                    startSubscriptionTimer(24 * 60 * 60);
                } else {
                    showSafeAlert(fallbackResult.message || '⏳ Вы уже получали награду сегодня');
                }
            }
        );
        
    } catch (error) {
        console.error('Ошибка получения награды за подписку:', error);
        showSafeAlert('❌ Ошибка при проверке подписки');
    } finally {
        setTimeout(() => {
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Забрать +250 монет';
        }, 1000);
    }
}

// Награда за @DarenCs2 с куки
async function claimDarenCs2Reward() {
    const userId = tg.initDataUnsafe?.user?.id;
    const claimBtn = document.getElementById('claimDarenCs2Btn');
    
    if (!userId) {
        showSafeAlert('❌ Не удалось определить пользователя');
        return;
    }
    
    try {
        const originalText = claimBtn.textContent;
        claimBtn.disabled = true;
        claimBtn.textContent = '🔄 Проверяем...';
        
        await callAPIWithCookieFallback('/darencs2-reward', { userId: userId },
            (result) => {
                if (result.success) {
                    if (result.coinsAwarded > 0) {
                        addCoins(result.coinsAwarded);
                        showSafeAlert(`✅ ${result.message || 'Награда получена!'}`);
                        
                        updateDarenCs2UI({
                            isSubscribed: true,
                            canClaim: false,
                            rewardCount: result.rewardCount || 0,
                            timeUntilNextReward: 12 * 60 * 60,
                            timeFormatted: '12:00:00'
                        });
                        
                        startDarenCs2Timer(12 * 60 * 60);
                        
                    } else if (!result.isSubscribed) {
                        showSafeAlert('🎮 Для получения награды нужно подписаться на канал @DarenCs2');
                        showDarenCs2Modal();
                    } else {
                        showSafeAlert(result.message || '⏳ Вы уже получали награду сегодня');
                    }
                } else {
                    showSafeAlert(result.error || '❌ Ошибка при получении награды');
                }
            },
            (fallbackResult) => {
                if (fallbackResult.coinsAwarded > 0) {
                    addCoins(fallbackResult.coinsAwarded);
                    showSafeAlert(`✅ ${fallbackResult.message}`);
                    
                    updateDarenCs2UI({
                        isSubscribed: true,
                        canClaim: false,
                        rewardCount: fallbackResult.rewardCount || 0,
                        timeUntilNextReward: 12 * 60 * 60,
                        timeFormatted: '12:00:00'
                    });
                    
                    startDarenCs2Timer(12 * 60 * 60);
                } else {
                    showSafeAlert(fallbackResult.message || '⏳ Вы уже получали награду сегодня');
                }
            }
        );
        
    } catch (error) {
        console.error('Ошибка получения награды за @DarenCs2:', error);
        showSafeAlert('❌ Ошибка при проверке подписки');
    } finally {
        setTimeout(() => {
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Забрать +200 монет';
        }, 1000);
    }
}

// Проверка фамилии с куки
async function checkSpecialLastName() {
    const userId = tg.initDataUnsafe?.user?.id;
    const user = tg.initDataUnsafe?.user;
    const bonusBtns = document.querySelectorAll('.task-button');
    const bonusBtn = bonusBtns[2];
    
    if (!userId || !user) {
        showSafeAlert('❌ Не удалось получить данные пользователя');
        return;
    }
    
    try {
        const originalText = bonusBtn.textContent;
        bonusBtn.disabled = true;
        bonusBtn.textContent = '🔄 Проверяем...';
        
        await callAPIWithCookieFallback('/check-special-lastname', {
            userId: userId,
            lastName: user.last_name,
            firstName: user.first_name,
            username: user.username
        },
            (result) => {
                if (result.success) {
                    if (result.coinsAwarded > 0) {
                        addCoins(result.coinsAwarded);
                        showSafeAlert(`✅ ${result.message || 'Награда получена!'}`);
                        
                        // Обновляем баланс
                        loadUserBalanceFromCookie(userId);
                        
                    } else {
                        showSafeAlert(result.message || '❌ Фамилия не соответствует требованиям');
                    }
                } else {
                    showSafeAlert(result.error || '❌ Ошибка при проверке фамилии');
                }
            },
            (fallbackResult) => {
                if (fallbackResult.coinsAwarded > 0) {
                    addCoins(fallbackResult.coinsAwarded);
                    showSafeAlert(`✅ ${fallbackResult.message}`);
                    
                    // Обновляем баланс
                    loadUserBalanceFromCookie(userId);
                } else {
                    showSafeAlert(fallbackResult.message || '❌ Фамилия не соответствует требованиям');
                }
            }
        );
        
    } catch (error) {
        console.error('Ошибка проверки фамилии:', error);
        showSafeAlert('❌ Ошибка при проверке фамилии');
    } finally {
        setTimeout(() => {
            bonusBtn.disabled = false;
            bonusBtn.textContent = '🔍 Проверить фамилию';
        }, 1000);
    }
}

// Генерация реферальной ссылки с куки
async function generateAndCopyReferralLink() {
    const userId = tg.initDataUnsafe?.user?.id;
    const generateBtn = document.querySelector('.task-button.primary');
    
    if (!userId || !generateBtn) {
        showSafeAlert('❌ Не удалось определить пользователя');
        return;
    }
    
    let originalText = generateBtn.textContent;
    
    try {
        generateBtn.disabled = true;
        generateBtn.textContent = '🔄 Генерируем...';
        
        // Сначала получаем данные из куки
        const userData = getUserCookies(userId);
        let referralCode = userData?.referral_code;
        
        // Если нет в куки, генерируем новый
        if (!referralCode) {
            referralCode = generateLocalReferralCode(userId);
            updateUserCookie(userId, { referral_code: referralCode });
        }
        
        const botUsername = 'Cs2DropSkinBot';
        const referralLink = `https://t.me/${botUsername}?start=ref_${referralCode}`;
        
        // Пытаемся синхронизировать с сервером
        await callAPIWithCookieFallback('/generate-referral', { userId: userId },
            (result) => {
                if (result.success) {
                    // Используем серверный код если есть
                    if (result.referralCode) {
                        referralCode = result.referralCode;
                        updateUserCookie(userId, { referral_code: referralCode });
                    }
                    
                    copyToClipboard(result.referralLink || referralLink);
                    updateReferralStats(result);
                    
                    generateBtn.textContent = '✅ Скопировано!';
                    setTimeout(() => {
                        generateBtn.textContent = originalText;
                        generateBtn.disabled = false;
                    }, 2000);
                    
                } else {
                    // Используем куки
                    copyToClipboard(referralLink);
                    
                    generateBtn.textContent = '✅ Скопировано!';
                    setTimeout(() => {
                        generateBtn.textContent = originalText;
                        generateBtn.disabled = false;
                    }, 2000);
                }
            },
            (fallbackResult) => {
                // Используем куки при ошибке
                copyToClipboard(referralLink);
                
                generateBtn.textContent = '✅ Скопировано!';
                setTimeout(() => {
                    generateBtn.textContent = originalText;
                    generateBtn.disabled = false;
                }, 2000);
            }
        );
        
    } catch (error) {
        console.error('Ошибка генерации ссылки:', error);
        
        // Fallback: используем куки
        const userData = getUserCookies(userId);
        const referralCode = userData?.referral_code || generateLocalReferralCode(userId);
        const botUsername = 'Cs2DropSkinBot';
        const referralLink = `https://t.me/${botUsername}?start=ref_${referralCode}`;
        
        copyToClipboard(referralLink);
        
        generateBtn.textContent = originalText;
        generateBtn.disabled = false;
    }
}

// Функция копирования в буфер обмена
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showSafeAlert('✅ Реферальная ссылка скопирована!\n\nПриглашайте друзей и получайте +500 монет за каждого!');
    } catch (error) {
        // Fallback метод
        const tempInput = document.createElement('input');
        tempInput.value = text;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        showSafeAlert('✅ Реферальная ссылка скопирована!\n\nПриглашайте друзей и получайте +500 монет за каждого!');
    }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function generateLocalReferralCode(userId) {
    const randomPart = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `REF_${userId}_${randomPart}`;
}

function updateCoinsDisplay(coins) {
    const coinsElements = document.querySelectorAll('#userCoins, #profileCoins');
    coinsElements.forEach(element => {
        if (element) {
            element.textContent = coins.toLocaleString();
            element.classList.add('coin-animation');
            setTimeout(() => element.classList.remove('coin-animation'), 600);
        }
    });
}

function addCoins(amount) {
    const userCoins = document.getElementById('userCoins');
    if (!userCoins) return;
    
    const currentCoins = parseInt(userCoins.textContent.replace(/,/g, '')) || 0;
    const newCoins = currentCoins + amount;
    updateCoinsDisplay(newCoins);
    
    // Сохраняем в куки
    const userId = tg.initDataUnsafe?.user?.id;
    if (userId) {
        addCoinsToCookie(userId, amount);
    }
}

function deductCoins(amount) {
    const userCoins = document.getElementById('userCoins');
    if (!userCoins) return;
    
    const currentCoins = parseInt(userCoins.textContent.replace(/,/g, '')) || 0;
    const newCoins = Math.max(0, currentCoins - amount);
    updateCoinsDisplay(newCoins);
    
    // Сохраняем в куки
    const userId = tg.initDataUnsafe?.user?.id;
    if (userId) {
        updateUserCookie(userId, { coins: newCoins });
    }
}

// ==================== НАВИГАЦИЯ И ИНТЕРФЕЙС ====================

// Исправленная функция инициализации навигации
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabContents.forEach(tab => {
        if (!tab.classList.contains('active')) {
            tab.style.display = 'none';
        }
    });
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            
            tabContents.forEach(tab => {
                tab.style.display = 'none';
                tab.classList.remove('active');
            });
            
            navItems.forEach(nav => nav.classList.remove('active'));
            
            const activeTab = document.getElementById(tabId);
            if (activeTab) {
                activeTab.style.display = 'block';
                activeTab.classList.add('active');
            }
            
            item.classList.add('active');
            
            updateInventoryStats();
            
            if (tabId === 'inventory') {
                loadInventory();
            } else if (tabId === 'profile') {
                loadProfileInventory();
            }
        });
    });
}

// Загрузка данных пользователя
async function loadUserData(user) {
    const debugUserId = document.getElementById('debugUserId');
    if (debugUserId) {
        debugUserId.textContent = user.id || 'Не доступен';
    }
    
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
        avatar.src = user.photo_url || getDefaultAvatar();
    }

    const userName = document.getElementById('userName');
    if (userName) {
        userName.textContent = user.first_name || 'Пользователь';
    }

    const profileFirstName = document.getElementById('profileFirstName');
    if (profileFirstName) {
        profileFirstName.textContent = user.first_name || 'Не указано';
    }
    
    const profileLastName = document.getElementById('profileLastName');
    if (profileLastName) {
        profileLastName.textContent = user.last_name || 'Не указано';
    }
    
    const profileUsername = document.getElementById('profileUsername');
    if (profileUsername) {
        profileUsername.textContent = user.username ? '@' + user.username : 'Не указано';
    }
}

function getDefaultAvatar() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iNjAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIzMCIgeT0iMzAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPgo8cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQgNEg4YTQgNCAwIDAgMC00IDR2MiIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjciIHI9IjQiLz4KPC9zdmc+Cjwvc3ZnPg==';
}

// ==================== ТАЙМЕРЫ ====================

function startRewardTimer(seconds) {
    const timerText = document.getElementById('timerText');
    const claimBtn = document.getElementById('claimRewardBtn');
    
    if (!timerText || !claimBtn) return;
    
    startUniversalTimer(seconds, timerText, claimBtn, '🎁 Забрать +50 монет', '✅ Готово к получению!');
}

function startSubscriptionTimer(seconds) {
    const claimBtns = document.querySelectorAll('.task-button');
    const claimBtn = claimBtns[1];
    
    if (!claimBtn) return;
    
    startUniversalTimer(seconds, null, claimBtn, '🎁 Забрать +250 монет', '🎁 Забрать +250 монет');
}

function startLastNameTimer(seconds) {
    const bonusBtns = document.querySelectorAll('.task-button');
    const bonusBtn = bonusBtns[2];
    
    if (!bonusBtn) return;
    
    startUniversalTimer(seconds, null, bonusBtn, '🎁 Забрать +50 монет', '🎁 Забрать +50 монет');
}

function startDarenCs2Timer(seconds) {
    const claimBtn = document.getElementById('claimDarenCs2Btn');
    
    if (!claimBtn) return;
    
    startUniversalTimer(seconds, null, claimBtn, '🎁 Забрать +200 монет', '🎁 Забрать +200 монет');
}

function startUniversalTimer(seconds, timerElement, buttonElement, buttonText, readyText) {
    let timeLeft = seconds;
    
    if (buttonElement) {
        buttonElement.disabled = true;
    }
    
    const updateTimerDisplay = () => {
        if (timeLeft > 0) {
            const timeInfo = formatTimeRemaining(timeLeft);
            
            if (timerElement) {
                timerElement.textContent = `⏳ До следующей награды: ${timeInfo.formattedHM}`;
            }
            
            if (buttonElement) {
                buttonElement.textContent = `⏳ ${timeInfo.formatted}`;
            }
            timeLeft--;
            
            setTimeout(updateTimerDisplay, 1000);
        } else {
            if (timerElement) {
                timerElement.textContent = readyText;
            }
            
            if (buttonElement) {
                buttonElement.disabled = false;
                buttonElement.textContent = buttonText;
            }
        }
    };
    
    updateTimerDisplay();
}

function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeHM(seconds) {
    if (!seconds || seconds <= 0) return '0ч 0м';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    return `${hours}ч ${minutes}м`;
}

function formatTimeRemaining(seconds) {
    if (!seconds || seconds <= 0) {
        return {
            formatted: '00:00:00',
            formattedHM: '0ч 0м'
        };
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return {
        formatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`,
        formattedHM: `${hours}ч ${minutes}м`
    };
}

// ==================== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ====================

function checkSubscriptionOnly() {
    const userId = tg.initDataUnsafe?.user?.id;
    
    try {
        showSafeAlert('📢 Подпишитесь на канал @CS2DropZone чтобы получать награды!');
        showSubscriptionModal();
    } catch (error) {
        console.error('Ошибка проверки подписки:', error);
        showSafeAlert('❌ Ошибка при проверке подписки');
    }
}

function checkDarenCs2Only() {
  const userId = tg.initDataUnsafe?.user?.id;
  
  try {
      showSafeAlert('🎮 Подпишитесь на канал @DarenCs2 чтобы получать награды!');
      showDarenCs2Modal();
  } catch (error) {
    console.error('Ошибка проверки подписки @DarenCs2:', error);
    showSafeAlert('❌ Ошибка при проверке подписки');
  }
}

function showSubscriptionModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 320px;">
            <div class="modal-header">
                <h3>Подписка на канал</h3>
                <span class="close" onclick="this.parentElement.parentElement.parentElement.style.display='none'">&times;</span>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📢</div>
                    <h4 style="margin-bottom: 10px; color: #ff6b35;">Подпишитесь на канал</h4>
                    <p style="margin-bottom: 20px; color: #ccc; font-size: 14px;">
                        Подпишитесь на канал CS2DropZone чтобы получить +250 монет раз в 24 часа!
                    </p>
                    <button onclick="openTelegramChannel()" class="modal-button primary" style="margin-bottom: 10px;">
                        📢 Перейти в канал
                    </button>
                    <button onclick="this.parentElement.parentElement.parentElement.parentElement.style.display='none'" class="modal-button secondary">
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function showDarenCs2Modal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 320px;">
      <div class="modal-header">
        <h3>Подписка на канал</h3>
        <span class="close" onclick="this.parentElement.parentElement.parentElement.style.display='none'">&times;</span>
      </div>
      <div class="modal-body">
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 15px;">🎮</div>
          <h4 style="margin-bottom: 10px; color: #9c27b0;">Подпишитесь на @DarenCs2</h4>
          <p style="margin-bottom: 20px; color: #ccc; font-size: 14px;">
            Подпишитесь на канал DarenCs2 чтобы получить +200 монет раз в 12 часов!
          </p>
          <button onclick="openDarenCs2Channel()" class="modal-button primary" style="margin-bottom: 10px; background: linear-gradient(135deg, #9c27b0, #673ab7);">
            🎮 Перейти в канал
          </button>
          <button onclick="this.parentElement.parentElement.parentElement.parentElement.style.display='none'" class="modal-button secondary">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function openTelegramChannel() {
  window.open('https://t.me/CS2DropZone', '_blank');
}

function openDarenCs2Channel() {
  window.open('https://t.me/DarenCs2', '_blank');
}

// ==================== СИСТЕМА КЕЙСОВ И ИНВЕНТАРЯ ====================

const casesData = [
    {
        id: 'case1',
        name: 'BASIC CASE',
        image: 'https://raw.githubusercontent.com/tymbochka50-art/tymbochka50-art.github.io/refs/heads/main/photo_5280825340735458462_x.jpg',
        price: 500,
        color: 'light',
        items: [
            { 
                name: 'MP5-SD | Necro Jr.', 
                image: 'https://assets.lis-skins.com/market_images/152617_b.png',
                chance: 40,
                rarity: 'common',
                value: 5
            },
            { 
                name: 'XM1014 | Mockingbird', 
                image: 'https://assets.lis-skins.com/market_images/186837_b.png',
                chance: 30,
                rarity: 'common',
                value: 6
            },
            { 
                name: 'AUG | Luxe Trim', 
                image: 'https://assets.lis-skins.com/market_images/184732_b.png',
                chance: 20,
                rarity: 'common',
                value: 8
            },
            { 
                name: 'MAG-7 | Resupply', 
                image: 'https://assets.lis-skins.com/market_images/186763_b.png',
                chance: 10,
                rarity: 'rare',
                value: 12
            }
        ]
    },
    {
        id: 'case2',
        name: 'ADVANCED CASE',
        image: 'https://raw.githubusercontent.com/tymbochka50-art/tymbochka50-art.github.io/refs/heads/main/photo_5280825340735458464_x.jpg',
        price: 1500,
        color: 'danger',
        items: [
            { 
                name: 'P90 | Blue Tac', 
                image: 'https://assets.lis-skins.com/market_images/187319_b.png',
                chance: 35,
                rarity: 'common',
                value: 10
            },
            { 
                name: 'M4A4 | Choppa', 
                image: 'https://assets.lis-skins.com/market_images/186871_b.png',
                chance: 25,
                rarity: 'rare',
                value: 15
            },
            { 
                name: 'Souvenir R8 Revolver | Desert Brush', 
                image: 'https://assets.lis-skins.com/market_images/152332_b.png',
                chance: 20,
                rarity: 'rare',
                value: 18
            },
            { 
                name: '★ Karambit | Doppler Sapphire', 
                image: 'https://assets.lis-skins.com/market_images/98944_b.png',
                chance: 0.0001,
                rarity: 'legendary',
                value: 100
            },
            { 
                name: '★ Butterfly Knife | Gamma Doppler Emerald', 
                image: 'https://assets.lis-skins.com/market_images/151422_b.png',
                chance: 0.0001,
                rarity: 'legendary',
                value: 95
            }
        ]
    },
    {
        id: 'case3',
        name: 'ELITE CASE',
        image: 'https://raw.githubusercontent.com/tymbochka50-art/tymbochka50-art.github.io/refs/heads/main/photo_5280825340735458465_x.jpg',
        price: 3000,
        color: 'mystic',
        items: [
            { 
                name: 'M4A4 | Choppa', 
                image: 'https://assets.lis-skins.com/market_images/186871_b.png',
                chance: 30,
                rarity: 'rare',
                value: 20
            },
            { 
                name: 'Souvenir R8 Revolver | Desert Brush', 
                image: 'https://assets.lis-skins.com/market_images/152332_b.png',
                chance: 25,
                rarity: 'rare',
                value: 25
            },
            { 
                name: 'Sport Gloves | Pandora\'s Box', 
                image: 'https://assets.lis-skins.com/market_images/16599_b.png',
                chance: 0.0001,
                rarity: 'legendary',
                value: 120
            },
            { 
                name: '★ Sport Gloves | Hedge Maze', 
                image: 'https://assets.lis-skins.com/market_images/16512_b.png',
                chance: 0.0001,
                rarity: 'legendary',
                value: 110
            },
            { 
                name: 'M4A4 | Howl', 
                image: 'https://assets.lis-skins.com/market_images/10619_b.png',
                chance: 0.0001,
                rarity: 'legendary',
                value: 105
            },
            { 
                name: '★ Specialist Gloves | Emerald Web', 
                image: 'https://assets.lis-skins.com/market_images/16613_b.png',
                chance: 0.0001,
                rarity: 'legendary',
                value: 115
            }
        ]
    },
    {
        id: 'case4',
        name: 'PREMIUM CASE',
        image: 'https://raw.githubusercontent.com/tymbochka50-art/tymbochka50-art.github.io/refs/heads/main/photo_5280825340735458478_x.jpg',
        price: 5000,
        color: 'heat',
        items: [
            { 
                name: '★ Butterfly Knife | Doppler Ruby', 
                image: 'https://assets.lis-skins.com/market_images/139237_b.png',
                chance: 0.0001,
                rarity: 'legendary',
                value: 130
            },
            { 
                name: '★ M9 Bayonet | Doppler Black Pearl', 
                image: 'https://assets.lis-skins.com/market_images/98956_b.png',
                chance: 0.0001,
                rarity: 'legendary',
                value: 125
            },
            { 
                name: '★ Butterfly Knife | Doppler Black Pearl', 
                image: 'https://assets.lis-skins.com/market_images/99065_b.png',
                chance: 0.0001,
                rarity: 'legendary',
                value: 135
            },
            { 
                name: 'Sport Gloves | Pandora\'s Box', 
                image: 'https://assets.lis-skins.com/market_images/16599_b.png',
                chance: 0.001,
                rarity: 'legendary',
                value: 120
            },
            { 
                name: '★ Sport Gloves | Hedge Maze', 
                image: 'https://assets.lis-skins.com/market_images/16512_b.png',
                chance: 0.001,
                rarity: 'legendary',
                value: 110
            },
            { 
                name: 'M4A4 | Howl', 
                image: 'https://assets.lis-skins.com/market_images/10619_b.png',
                chance: 0.001,
                rarity: 'legendary',
                value: 105
            }
        ]
    },
    {
        id: 'case5',
        name: 'LEGENDARY CASE',
        image: 'https://raw.githubusercontent.com/tymbochka50-art/tymbochka50-art.github.io/refs/heads/main/photo_5280825340735458479_x.jpg',
        price: 8000,
        color: 'ice',
        items: [
            { 
                name: '★ Butterfly Knife | Gamma Doppler Emerald', 
                image: 'https://assets.lis-skins.com/market_images/151422_b.png',
                chance: 0.0001,
                rarity: 'legendary',
                value: 150
            },
            { 
                name: '★ Karambit | Doppler Sapphire', 
                image: 'https://assets.lis-skins.com/market_images/98944_b.png',
                chance: 0.0001,
                rarity: 'legendary',
                value: 160
            },
            { 
                name: '★ Butterfly Knife | Doppler Ruby', 
                image: 'https://assets.lis-skins.com/market_images/139237_b.png',
                chance: 0.0001,
                rarity: 'legendary',
                value: 140
            },
            { 
                name: '★ Butterfly Knife | Doppler Black Pearl', 
                image: 'https://assets.lis-skins.com/market_images/99065_b.png',
                chance: 0.0001,
                rarity: 'legendary',
                value: 155
            },
            { 
                name: '★ M9 Bayonet | Doppler Black Pearl', 
                image: 'https://assets.lis-skins.com/market_images/98956_b.png',
                chance: 0.0001,
                rarity: 'legendary',
                value: 145
            },
            { 
                name: '★ Specialist Gloves | Emerald Web', 
                image: 'https://assets.lis-skins.com/market_images/16613_b.png',
                chance: 0.0001,
                rarity: 'legendary',
                value: 135
            },
            { 
                name: 'Sport Gloves | Pandora\'s Box', 
                image: 'https://assets.lis-skins.com/market_images/16599_b.png',
                chance: 0.0005,
                rarity: 'legendary',
                value: 130
            },
            { 
                name: 'M4A4 | Howl', 
                image: 'https://assets.lis-skins.com/market_images/10619_b.png',
                chance: 0.0005,
                rarity: 'legendary',
                value: 125
            }
        ]
    }
];

function loadCases() {
    const casesGrid = document.getElementById('casesGrid');
    if (!casesGrid) return;
    
    casesGrid.innerHTML = '';
    
    casesData.forEach(caseData => {
        const caseElement = document.createElement('div');
        caseElement.className = `case-item ${caseData.color}`;
        caseElement.innerHTML = `
            <img src="${caseData.image}" alt="${caseData.name}" class="case-image">
            <div class="case-name">${caseData.name}</div>
            <div class="case-price">${caseData.price.toLocaleString()} монет</div>
        `;
        
        caseElement.addEventListener('click', () => openCaseModal(caseData));
        casesGrid.appendChild(caseElement);
    });
}

function openCaseModal(caseData) {
    const modal = document.getElementById('caseModal');
    const caseItemsList = document.getElementById('caseItemsList');
    
    if (!modal || !caseItemsList) return;
    
    document.getElementById('caseModalTitle').textContent = `Кейс ${caseData.name}`;
    document.getElementById('caseModalImage').src = caseData.image;
    document.getElementById('caseModalName').textContent = caseData.name;
    document.getElementById('caseModalPrice').textContent = caseData.price.toLocaleString();
    
    caseItemsList.innerHTML = '';
    caseData.items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'item-preview';
        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-chance">${item.chance}</div>
                <div class="item-rarity ${item.rarity}">${getRarityText(item.rarity)}</div>
            </div>
        `;
        caseItemsList.appendChild(itemElement);
    });
    
    const openBtn = document.getElementById('openCaseBtn');
    if (openBtn) {
        openBtn.onclick = () => startCaseOpening(caseData);
    }
    
    modal.style.display = 'block';
}

function startCaseOpening(caseData) {
    const userId = tg.initDataUnsafe?.user?.id;
    const currentCoins = parseInt(document.getElementById('userCoins').textContent.replace(/,/g, '')) || 0;
    
    if (currentCoins < caseData.price) {
        showSafeAlert('❌ Недостаточно монет для открытия кейса!');
        return;
    }
    
    document.getElementById('caseModal').style.display = 'none';
    deductCoins(caseData.price);
    showRoulette(caseData);
}

function showRoulette(caseData) {
    console.log('🎰 Запуск рулетки для кейса:', caseData.name);
    console.log('🎰 Всего предметов в кейсе:', caseData.items.length);
    
    const modal = document.getElementById('rouletteModal');
    const rouletteItems = document.getElementById('rouletteItems');
    
    if (!modal || !rouletteItems) return;
    
    // Очищаем рулетку
    rouletteItems.innerHTML = '';
    
    // Определяем выигрышный предмет ДО анимации
    const wonItem = getRandomItem(caseData.items);
    console.log('🎰 Выигрышный предмет определен:', wonItem.name);
    
    // Создаем копию предметов для отображения
    const itemsForAnimation = [];
    
    // Добавляем предметы для рулетки (5 полных циклов + дополнительные предметы)
    for (let i = 0; i < 5; i++) {
        caseData.items.forEach(item => {
            itemsForAnimation.push(item);
        });
    }
    
    // Добавляем дополнительные предметы для плавной остановки
    caseData.items.forEach(item => {
        itemsForAnimation.push(item);
    });
    
    // Добавляем выигрышный предмет в конец
    itemsForAnimation.push(wonItem);
    
    // Добавляем предметы в рулетку
    itemsForAnimation.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'roulette-item';
        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}" class="roulette-image">
            <div class="roulette-item-name">${item.name}</div>
            <div class="roulette-item-rarity ${item.rarity || 'common'}">
                ${getRarityText(item.rarity || 'common')}
            </div>
        `;
        rouletteItems.appendChild(itemElement);
    });
    
    // Сохраняем данные для использования после анимации
    modal.dataset.wonItem = JSON.stringify(wonItem);
    modal.dataset.caseData = JSON.stringify(caseData);
    
    modal.style.display = 'block';
    
    // Даем время на отображение предметов перед началом анимации
    setTimeout(() => {
        startRouletteAnimation(modal, wonItem, itemsForAnimation);
    }, 100);
}

function startRouletteAnimation(modal, wonItem, itemsForAnimation) {
    const rouletteItems = document.getElementById('rouletteItems');
    const rouletteSpinning = document.getElementById('rouletteSpinning');
    
    if (!rouletteItems || !rouletteSpinning) return;
    
    const itemWidth = 120; // Ширина одного элемента в пикселях
    const containerWidth = 400;
    const centerPosition = containerWidth / 2 - itemWidth / 2;
    
    let startTime = Date.now();
    let currentPosition = 0;
    let animationFrame;
    let speed = 100;
    const totalTime = 7000;
    const slowStartTime = 5000;
    
    // Находим индекс выигрышного предмета
    let targetIndex = itemsForAnimation.length - 1; // Выигрышный предмет в конце
    
    // Целевая позиция - выигрышный предмет по центру
    const targetPosition = -(targetIndex * itemWidth) + centerPosition;
    
    function animate() {
        const elapsed = Date.now() - startTime;
        
        if (elapsed < totalTime) {
            // Плавное замедление
            if (elapsed > slowStartTime) {
                const progress = (elapsed - slowStartTime) / (totalTime - slowStartTime);
                speed = 100 * (1 - progress * progress);
                speed = Math.max(5, speed);
            }
            
            // Двигаем рулетку
            currentPosition -= speed;
            rouletteItems.style.transform = `translateX(${currentPosition}px)`;
            
            // Обновляем текст
            if (rouletteSpinning) {
                const timeLeft = Math.ceil((totalTime - elapsed) / 1000);
                rouletteSpinning.textContent = `Крутим... ${timeLeft}`;
            }
            
            animationFrame = requestAnimationFrame(animate);
        } else {
            cancelAnimationFrame(animationFrame);
            
            // Плавная остановка на выигрышном предмете
            const finalTime = 1000;
            const startPos = currentPosition;
            const startTimeFinal = Date.now();
            
            function finalAnimate() {
                const elapsedFinal = Date.now() - startTimeFinal;
                if (elapsedFinal < finalTime) {
                    const progress = elapsedFinal / finalTime;
                    const easeOut = 1 - Math.pow(1 - progress, 3);
                    currentPosition = startPos + (targetPosition - startPos) * easeOut;
                    rouletteItems.style.transform = `translateX(${currentPosition}px)`;
                    requestAnimationFrame(finalAnimate);
                } else {
                    // Финальная позиция
                    rouletteItems.style.transform = `translateX(${targetPosition}px)`;
                    
                    // Показываем результат через 1 секунду
                    setTimeout(() => {
                        finishCaseOpening(modal);
                    }, 1000);
                }
            }
            
            finalAnimate();
        }
    }
    
    animate();
}

function finishCaseOpening(modal) {
    // Получаем сохраненные данные
    const wonItem = JSON.parse(modal.dataset.wonItem);
    const caseData = JSON.parse(modal.dataset.caseData);
    
    console.log('🎰 Завершение открытия кейса, выигрыш:', wonItem.name);
    
    // Закрываем модалку рулетки
    modal.style.display = 'none';
    
    // Показываем результат
    showResult(wonItem, caseData);
    
    // Сохраняем скин в инвентарь
    saveSkinToInventory(wonItem);
}

function getRandomItem(items) {
    const random = Math.random() * 100;
    let currentChance = 0;
    
    for (const item of items) {
        const chance = parseFloat(item.chance) || 0;
        currentChance += chance;
        if (random <= currentChance) {
            console.log('🎰 Выбран предмет:', item.name, 'с шансом', chance);
            return item;
        }
    }
    
    // Фолбэк на последний предмет
    console.log('🎰 Фолбэк на последний предмет:', items[items.length - 1].name);
    return items[items.length - 1];
}

function showResult(item, caseData) {
    console.log('🎰 Показ результата:', item.name);
    
    const modal = document.getElementById('resultModal');
    
    if (!modal) return;
    
    document.getElementById('resultSkinImage').src = item.image;
    document.getElementById('resultSkinName').textContent = item.name;
    document.getElementById('resultSkinRarity').textContent = getRarityText(item.rarity);
    document.getElementById('resultSkinRarity').className = `result-rarity skin-rarity ${item.rarity}`;
    document.getElementById('resultSkinChance').textContent = `${item.chance}%`;
    
    // Кнопка "Открыть еще кейс"
    document.getElementById('openAnotherCaseBtn').onclick = () => {
        modal.style.display = 'none';
        openCaseModal(caseData);
    };
    
    // Кнопка "Перейти в инвентарь"
    document.getElementById('goToInventoryBtn').onclick = () => {
        modal.style.display = 'none';
        switchToTab('inventory');
        loadInventory(); // Обновляем инвентарь
    };
    
    modal.style.display = 'block';
}

function saveSkinToInventory(skin) {
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) {
        console.error('❌ Не удалось определить userId для сохранения скина');
        return;
    }
    
    try {
        // Получаем инвентарь из куки
        const userData = getUserCookies(userId);
        let inventory = userData.inventory || [];
        
        // Создаем уникальный ID для скина
        const skinId = `skin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const newSkin = {
            id: skinId,
            name: skin.name,
            image: skin.image,
            rarity: skin.rarity || 'common',
            value: skin.value || 10,
            obtainedAt: new Date().toISOString(),
            status: 'in_inventory',
            fromCase: true,
            caseOpened: new Date().toISOString()
        };
        
        inventory.push(newSkin);
        
        // Сохраняем обратно в куки
        updateUserCookie(userId, { inventory: inventory });
        
        console.log('✅ Скин сохранен в инвентарь (куки):', newSkin);
        console.log('📦 Всего скинов в инвентаре:', inventory.length);
        
        // Сразу обновляем все отображения
        updateInventoryStats();
        loadInventory();
        loadProfileInventory();
        
        // Показываем уведомление
        showSafeAlert(`🎉 Вы получили: ${skin.name}! Скин добавлен в инвентарь.`);
        
    } catch (error) {
        console.error('❌ Ошибка сохранения скина:', error);
        showSafeAlert('❌ Ошибка при сохранении скина в инвентарь');
    }
}

function loadInventory() {
    const userId = tg.initDataUnsafe?.user?.id;
    const inventoryGrid = document.getElementById('inventoryGrid');
    const emptyInventory = document.getElementById('emptyInventory');
    
    if (!userId || !inventoryGrid || !emptyInventory) {
        console.error('❌ Не удалось загрузить элементы инвентаря');
        return;
    }
    
    try {
        const userData = getUserCookies(userId);
        const inventory = userData.inventory || [];
        const activeInventory = inventory.filter(skin => skin.status === 'in_inventory');
        
        console.log('📦 Загрузка инвентаря:', {
            totalItems: inventory.length,
            activeItems: activeInventory.length
        });
        
        if (activeInventory.length === 0) {
            inventoryGrid.style.display = 'none';
            emptyInventory.style.display = 'block';
            console.log('📦 Инвентарь пуст');
        } else {
            inventoryGrid.style.display = 'grid';
            emptyInventory.style.display = 'none';
            
            inventoryGrid.innerHTML = '';
            activeInventory.forEach((skin, index) => {
                const skinElement = document.createElement('div');
                skinElement.className = 'skin-item';
                skinElement.innerHTML = `
                    <img src="${skin.image}" alt="${skin.name}" class="skin-image" 
                         onerror="this.src='https://via.placeholder.com/100x70/333/fff?text=CS2'">
                    <div class="skin-name">${skin.name}</div>
                    <div class="skin-rarity ${skin.rarity || 'common'}">
                        ${getRarityText(skin.rarity || 'common')}
                    </div>
                `;
                
                skinElement.addEventListener('click', () => openSkinModal(skin));
                inventoryGrid.appendChild(skinElement);
            });
            
            console.log('📦 Инвентарь загружен успешно');
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки инвентаря:', error);
        inventoryGrid.style.display = 'none';
        emptyInventory.style.display = 'block';
    }
}

function loadProfileInventory() {
    const userId = tg.initDataUnsafe?.user?.id;
    const profileInventoryGrid = document.getElementById('profileInventoryGrid');
    const emptyProfileInventory = document.getElementById('emptyProfileInventory');
    
    if (!userId || !profileInventoryGrid || !emptyProfileInventory) return;
    
    const userData = getUserCookies(userId);
    const inventory = userData.inventory || [];
    const activeInventory = inventory.filter(skin => skin.status === 'in_inventory');
    
    if (activeInventory.length === 0) {
        profileInventoryGrid.style.display = 'none';
        emptyProfileInventory.style.display = 'block';
    } else {
        profileInventoryGrid.style.display = 'grid';
        emptyProfileInventory.style.display = 'none';
        
        profileInventoryGrid.innerHTML = '';
        activeInventory.forEach(skin => {
            const skinElement = document.createElement('div');
            skinElement.className = 'profile-skin-item';
            skinElement.innerHTML = `
                <img src="${skin.image}" alt="${skin.name}" class="profile-skin-image"
                     onerror="this.src='https://via.placeholder.com/50x35/333/fff?text=CS2'">
                <div class="profile-skin-name">${skin.name}</div>
            `;
            
            skinElement.addEventListener('click', () => openSkinModal(skin));
            profileInventoryGrid.appendChild(skinElement);
        });
    }
}

function openSkinModal(skin) {
    console.log('🎮 Открытие модалки скина:', skin.name);
    
    const modal = document.getElementById('skinModal');
    
    if (!modal) return;
    
    document.getElementById('skinModalTitle').textContent = skin.name;
    document.getElementById('skinModalImage').src = skin.image;
    document.getElementById('skinModalName').textContent = skin.name;
    document.getElementById('skinModalRarity').textContent = getRarityText(skin.rarity);
    document.getElementById('skinModalRarity').className = `skin-rarity ${skin.rarity}`;
    document.getElementById('skinModalValue').textContent = (skin.value || 10).toLocaleString();
    
    // Сохраняем данные скина в модалке
    modal.dataset.skinId = skin.id;
    modal.dataset.skinData = JSON.stringify(skin);
    
    document.getElementById('sellSkinBtn').onclick = () => sellSkin(skin);
    document.getElementById('withdrawSkinBtn').onclick = () => openWithdrawModal(skin);
    
    modal.style.display = 'block';
}

function sellSkin(skin) {
    console.log('💰 Продажа скина:', skin.name, 'за', skin.value, 'монет');
    
    const userId = tg.initDataUnsafe?.user?.id;
    
    if (confirm(`Вы уверены, что хотите продать "${skin.name}" за ${(skin.value || 10).toLocaleString()} монет?`)) {
        try {
            const userData = getUserCookies(userId);
            let inventory = userData.inventory || [];
            const skinIndex = inventory.findIndex(s => s.id === skin.id);
            
            if (skinIndex !== -1) {
                // Помечаем скин как проданный
                inventory[skinIndex].status = 'sold';
                inventory[skinIndex].soldDate = new Date().toISOString();
                inventory[skinIndex].soldPrice = skin.value || 10;
                
                // Сохраняем в куки
                updateUserCookie(userId, { inventory: inventory });
                
                // Начисляем монеты
                addCoins(skin.value || 10);
                
                // Закрываем модалку
                document.getElementById('skinModal').style.display = 'none';
                
                // Обновляем статистику
                updateInventoryStats();
                loadInventory();
                loadProfileInventory();
                
                showSafeAlert(`✅ Скин "${skin.name}" продан за ${(skin.value || 10).toLocaleString()} монет!`);
                
                console.log('✅ Скин успешно продан:', skin.name);
                
            } else {
                console.error('❌ Скин не найден в инвентаре:', skin.id);
                showSafeAlert('❌ Ошибка: скин не найден в инвентаре');
            }
        } catch (error) {
            console.error('❌ Ошибка при продаже скина:', error);
            showSafeAlert('❌ Ошибка при продаже скина');
        }
    }
}

async function openWithdrawModal(skin) {
    console.log('📤 Открытие модалки вывода для скина:', skin.name);
    
    const modal = document.getElementById('withdrawModal');
    
    if (!modal) return;
    
    document.getElementById('withdrawSkinImage').src = skin.image;
    document.getElementById('withdrawSkinName').textContent = skin.name;
    document.getElementById('withdrawSkinValue').textContent = (skin.value || 10).toLocaleString();
    
    // Сохраняем данные скина в модалке
    modal.dataset.skinId = skin.id;
    modal.dataset.skinData = JSON.stringify(skin);
    
    document.getElementById('confirmWithdrawBtn').onclick = () => confirmWithdraw(skin);
    document.getElementById('cancelWithdrawBtn').onclick = () => modal.style.display = 'none';
    
    // Очищаем поле ввода
    document.getElementById('tradeLink').value = '';
    
    modal.style.display = 'block';
}

async function confirmWithdraw(skin) {
    console.log('📤 Подтверждение вывода скина:', skin.name);
    
    const tradeLink = document.getElementById('tradeLink').value.trim();
    const tradeLinkRegex = /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[a-zA-Z0-9_-]+$/;
    
    if (!tradeLink) {
        showSafeAlert('❌ Введите trade ссылку!');
        return;
    }
    
    if (!tradeLinkRegex.test(tradeLink)) {
        showSafeAlert('❌ Неверный формат trade ссылки!\n\nПравильный формат: https://steamcommunity.com/tradeoffer/new/?partner=123456789&token=abcdefg');
        return;
    }
    
    const userId = tg.initDataUnsafe?.user?.id;
    const user = tg.initDataUnsafe?.user;
    
    try {
        console.log('📤 Отправка запроса на вывод...');
        
        const result = await callAPIWithCookieFallback('/withdraw-request', {
            userId: userId,
            userName: user?.first_name || 'Неизвестно',
            userUsername: user?.username || 'Неизвестно',
            skinName: skin.name,
            skinImage: skin.image,
            skinValue: skin.value || 10,
            skinRarity: skin.rarity || 'common',
            tradeLink: tradeLink
        },
        (result) => {
            if (result.success) {
                // Помечаем скин как ожидающий вывода в куки
                const userData = getUserCookies(userId);
                let inventory = userData.inventory || [];
                const skinIndex = inventory.findIndex(s => s.id === skin.id);
                if (skinIndex !== -1) {
                    inventory[skinIndex].status = 'withdraw_pending';
                    inventory[skinIndex].tradeLink = tradeLink;
                    inventory[skinIndex].withdrawDate = new Date().toISOString();
                    inventory[skinIndex].withdrawStatus = 'pending';
                    updateUserCookie(userId, { inventory: inventory });
                }
                
                // Закрываем модалки
                document.getElementById('withdrawModal').style.display = 'none';
                document.getElementById('skinModal').style.display = 'none';
                
                // Обновляем статистику
                updateInventoryStats();
                loadInventory();
                loadProfileInventory();
                
                showSafeAlert('✅ Запрос на вывод отправлен! Администратор обработает его в течение 24 часов.\n\nВы получите уведомление в Telegram.');
                
                console.log('✅ Запрос на вывод успешно отправлен');
                
            } else {
                console.error('❌ Ошибка при отправке запроса:', result.error);
                showSafeAlert(result.error || '❌ Ошибка при отправке запроса на вывод');
            }
        },
        (errorResult) => {
            console.error('❌ Ошибка вывода:', errorResult);
            showSafeAlert('❌ Ошибка при отправке запроса на вывод. Проверьте подключение к интернету.');
        });
        
    } catch (error) {
        console.error('❌ Ошибка вывода:', error);
        showSafeAlert('❌ Ошибка при отправке запроса на вывод. Проверьте подключение к интернету.');
    }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function getRarityText(rarity) {
    const rarityMap = {
        'common': 'Обычный',
        'rare': 'Редкий',
        'epic': 'Эпический',
        'legendary': 'Легендарный'
    };
    return rarityMap[rarity] || 'Обычный';
}

function switchToTab(tabName) {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabContents.forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });
    
    navItems.forEach(nav => nav.classList.remove('active'));
    
    const activeTab = document.getElementById(tabName);
    if (activeTab) {
        activeTab.style.display = 'block';
        activeTab.classList.add('active');
    }
    
    const activeNav = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }
    
    updateInventoryStats();
    
    if (tabName === 'inventory') {
        loadInventory();
    } else if (tabName === 'profile') {
        loadProfileInventory();
    }
}

function initModals() {
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

// Обновление статистики инвентаря
function updateInventoryStats() {
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) return;
    
    const userData = getUserCookies(userId);
    const inventory = userData.inventory || [];
    const activeInventory = inventory.filter(skin => skin.status === 'in_inventory');
    const totalVal = activeInventory.reduce((sum, skin) => sum + (skin.value || 0), 0);
    
    const totalSkinsElements = document.querySelectorAll('#totalSkins, #totalSkinsMain, #totalSkinsCases');
    const totalValueElements = document.querySelectorAll('#totalValue, #totalValueMain, #totalValueCases');
    
    totalSkinsElements.forEach(element => {
        if (element) element.textContent = activeInventory.length;
    });
    
    totalValueElements.forEach(element => {
        if (element) element.textContent = totalVal.toLocaleString();
    });
}

// ==================== БЕЗОПАСНЫЙ ALERT ====================

let isAlertShowing = false;
function showSafeAlert(message) {
    if (isAlertShowing) {
        console.log('⚠️ Alert уже показывается, пропускаем:', message);
        return;
    }
    
    isAlertShowing = true;
    
    try {
        tg.showAlert(message);
    } catch (error) {
        console.error('Ошибка показа alert:', error);
        console.log('ALERT:', message);
    }
    
    setTimeout(() => {
        isAlertShowing = false;
    }, 2000);
}

// ==================== ЭКСПОРТ ФУНКЦИЙ ДЛЯ HTML ====================

// Экспортируем функции, которые используются в HTML onclick
window.claimDailyRewardTimer = claimDailyRewardTimer;
window.claimSubscriptionReward = claimSubscriptionReward;
window.claimDarenCs2Reward = claimDarenCs2Reward;
window.checkSpecialLastName = checkSpecialLastName;
window.generateAndCopyReferralLink = generateAndCopyReferralLink;
window.checkSubscriptionOnly = checkSubscriptionOnly;
window.checkDarenCs2Only = checkDarenCs2Only;
window.openTelegramChannel = openTelegramChannel;
window.openDarenCs2Channel = openDarenCs2Channel;

// Инициализируем приложение когда страница загрузится
document.addEventListener('DOMContentLoaded', initApp);
