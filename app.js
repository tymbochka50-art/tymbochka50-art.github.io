// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

// Базовый URL вашего backend на Vercel
const API_BASE_URL = 'https://telegram-backend-nine.vercel.app';

// Основная функция инициализации
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

        // Инициализация навигации
        initNavigation();
        initModals();

        // Загрузка данных пользователя
        await loadUserData(user);

        // Инициализируем пользователя локально
        await initLocalUser(user.id);

        // Загрузка баланса и статусов
        await loadUserBalance(user.id);
        await loadRewardStatus(user.id);
        await loadReferralStats(user.id);
        await loadSubscriptionStatus(user.id);
        await loadLastNameStatus(user);
        await loadDarenCs2Status(user.id);

        // Загрузка кейсов и инвентаря
        loadCases();
        loadInventory();
        loadProfileInventory();

        // Обновляем статистику инвентаря
        updateInventoryStats();

        console.log('✅ Приложение инициализировано');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        showSafeAlert('❌ Ошибка загрузки приложения. Пожалуйста, перезагрузите.');
    }
}

// Универсальная функция для API запросов
async function callAPI(endpoint, data) {
    try {
        console.log(`📡 Отправляем запрос на ${API_BASE_URL}/api${endpoint}`, data);
        
        const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(data)
        });
        
        console.log(`📡 Ответ от сервера:`, response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log(`📡 Результат API ${endpoint}:`, result);
        return result;
        
    } catch (error) {
        console.error(`❌ Ошибка API ${endpoint}:`, error);
        throw error;
    }
}

// Инициализация пользователя в локальном хранилище
async function initLocalUser(userId) {
    try {
        const userInitialized = localStorage.getItem(`user_initialized_${userId}`);
        
        if (!userInitialized) {
            console.log('👤 Инициализируем нового пользователя локально');
            
            localStorage.setItem(`coins_${userId}`, '0');
            localStorage.setItem(`reward_count_${userId}`, '0');
            localStorage.setItem(`subscription_count_${userId}`, '0');
            localStorage.setItem(`darencs2_count_${userId}`, '0');
            localStorage.setItem(`name_reward_count_${userId}`, '0');
            
            const referralCode = generateLocalReferralCode(userId);
            localStorage.setItem(`referral_code_${userId}`, referralCode);
            
            localStorage.setItem(`daily_reward_${userId}`, '0');
            localStorage.setItem(`last_name_reward_${userId}`, '0');
            
            localStorage.setItem(`user_initialized_${userId}`, 'true');
            
            console.log('✅ Пользователь инициализирован локально');
        }
        
    } catch (error) {
        console.error('Ошибка инициализации пользователя:', error);
    }
}

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

// ==================== ОБНОВЛЕНИЕ СТАТИСТИКИ ИНВЕНТАРЯ ====================

function updateInventoryStats() {
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) return;
    
    let inventory = JSON.parse(localStorage.getItem(`inventory_${userId}`) || '[]');
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

// ==================== РЕФЕРАЛЬНАЯ СИСТЕМА ====================

async function generateAndCopyReferralLink() {
    const userId = tg.initDataUnsafe?.user?.id;
    const generateBtn = document.querySelector('.task-button.primary');
    
    if (!userId) {
        showSafeAlert('❌ Не удалось определить пользователя');
        return;
    }
    
    try {
        const originalText = generateBtn.textContent;
        generateBtn.disabled = true;
        generateBtn.textContent = '🔄 Генерируем...';
        
        const result = await callAPI('/generate-referral', { userId: userId });
        
        if (result.success) {
            const referralLink = result.referralLink;
            
            try {
                await navigator.clipboard.writeText(referralLink);
                
                showSafeAlert(
                    `✅ Реферальная ссылка скопирована!\n\n` +
                    `Приглашайте друзей и получайте +500 монет за каждого!\n\n` +
                    `Ссылка: ${referralLink}`
                );
                
                updateReferralStats(result);
                
                generateBtn.textContent = '✅ Скопировано!';
                setTimeout(() => {
                    generateBtn.textContent = originalText;
                }, 2000);
                
            } catch (error) {
                const tempInput = document.createElement('input');
                tempInput.value = referralLink;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                
                showSafeAlert(
                    `✅ Реферальная ссылка скопирована!\n\n` +
                    `Приглашайте друзей и получайте +500 монет за каждого!`
                );
                
                updateReferralStats(result);
                
                generateBtn.textContent = '✅ Скопировано!';
                setTimeout(() => {
                    generateBtn.textContent = originalText;
                }, 2000);
            }
        } else {
            showSafeAlert('❌ Ошибка генерации ссылки: ' + (result.error || 'Неизвестная ошибка'));
        }
        
    } catch (error) {
        console.error('Ошибка генерации ссылки:', error);
        showSafeAlert('❌ Ошибка при копировании ссылки');
    } finally {
        setTimeout(() => {
            generateBtn.disabled = false;
        }, 2000);
    }
}

function generateLocalReferralCode(userId) {
    return `ref_${userId}_${Date.now().toString(36).substr(2, 8)}`;
}

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
    
    console.log('📊 Updated referral stats:', {
        totalReferrals: data.totalReferrals,
        referralEarnings: data.referralEarnings
    });
}

async function loadReferralStats(userId) {
    try {
        const result = await callAPI('/referral-stats', { userId: userId });
        updateReferralStats(result);
    } catch (error) {
        console.error('Ошибка загрузки реферальной статистики:', error);
        updateReferralStats({
            totalReferrals: 0,
            referralEarnings: 0,
            referralCode: 'Ошибка загрузки'
        });
    }
}

// ==================== СИСТЕМА ФАМИЛИИ ====================

async function loadLastNameStatus(user) {
    const userId = user?.id;
    
    if (!userId || !user) {
        updateLastNameUI({
            hasCorrectLastName: false,
            canClaim: false,
            timeUntilNextReward: 0
        });
        return;
    }
    
    try {
        const result = await callAPI('/special-lastname-status', {
            userId: userId,
            lastName: user.last_name
        });
        
        updateLastNameUI(result);
        
    } catch (error) {
        console.error('Ошибка загрузки статуса фамилии:', error);
        updateLastNameUI({
            hasCorrectLastName: false,
            canClaim: false,
            timeUntilNextReward: 0
        });
    }
}

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
        
        const result = await callAPI('/check-special-lastname', {
            userId: userId,
            lastName: user.last_name,
            firstName: user.first_name,
            username: user.username
        });
        
        if (result.success) {
            if (result.coinsAwarded > 0) {
                addCoins(result.coinsAwarded);
                showSafeAlert(`✅ ${result.message || 'Награда получена!'}`);
                
                updateLastNameUI({
                    hasCorrectLastName: true,
                    canClaim: false,
                    timeUntilNextReward: 5 * 60 * 60,
                    timeFormatted: '05:00:00'
                });
                
                startLastNameTimer(5 * 60 * 60);
                
                // Обновляем баланс
                loadUserBalance(userId);
                
            } else {
                showSafeAlert(result.message || '❌ Фамилия не соответствует требованиям');
            }
        } else {
            showSafeAlert(result.error || '❌ Ошибка при проверке фамилии');
        }
        
    } catch (error) {
        console.error('Ошибка проверки фамилии:', error);
        showSafeAlert('❌ Ошибка при проверке фамилии');
    } finally {
        setTimeout(() => {
            bonusBtn.disabled = false;
            bonusBtn.textContent = originalText;
        }, 1000);
    }
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

// ==================== СИСТЕМА ЕЖЕДНЕВНЫХ НАГРАД ====================

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
        
        const result = await callAPI('/daily-reward-timer', { userId: userId });
        
        if (result.success) {
            if (result.coinsAwarded > 0) {
                addCoins(result.coinsAwarded);
                showSafeAlert(`✅ Ежедневная награда получена! +${result.coinsAwarded} монет\n\nВсего наград: ${result.rewardCount}`);
                
                updateRewardUI({
                    canClaim: false,
                    rewardCount: result.rewardCount,
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

async function loadRewardStatus(userId) {
    try {
        const result = await callAPI('/reward-status', { userId: userId });
        updateRewardUI(result);
    } catch (error) {
        console.error('Ошибка загрузки статуса наград:', error);
        const rewardCount = parseInt(localStorage.getItem(`reward_count_${userId}`) || '0');
        updateRewardUI({
            canClaim: false,
            rewardCount: rewardCount,
            timeUntilNextReward: 0,
            timeFormatted: '00:00:00',
            timeFormattedHM: '0ч 0м'
        });
    }
}

// ==================== СИСТЕМА ПОДПИСКИ ====================

async function loadSubscriptionStatus(userId) {
    try {
        const result = await callAPI('/subscription-status', { userId: userId });
        updateSubscriptionUI(result);
    } catch (error) {
        console.error('Ошибка загрузки статуса подписки:', error);
        updateSubscriptionUI({
            isSubscribed: false,
            canClaim: false,
            rewardCount: 0,
            timeUntilNextReward: 0,
            timeFormatted: '00:00:00'
        });
    }
}

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
        
        const result = await callAPI('/subscription-reward', { userId: userId });
        
        if (result.success) {
            if (result.coinsAwarded > 0) {
                addCoins(result.coinsAwarded);
                showSafeAlert(`✅ Награда получена! +${result.coinsAwarded} монет за подписку!`);
                
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
                updateSubscriptionUI({
                    isSubscribed: true,
                    canClaim: false,
                    rewardCount: result.rewardCount || 0,
                    timeUntilNextReward: result.timeUntilNextReward || 0,
                    timeFormatted: result.timeFormatted || '00:00:00'
                });
            }
        } else {
            showSafeAlert(result.error || '❌ Ошибка при получении награды');
        }
        
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

function openTelegramChannel() {
    window.open('https://t.me/CS2DropZone', '_blank');
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

async function checkSubscriptionOnly() {
    const userId = tg.initDataUnsafe?.user?.id;
    
    try {
        const result = await callAPI('/subscription-status', { userId: userId });
        
        if (result.isSubscribed) {
            showSafeAlert('✅ Вы подписаны на @CS2DropZone! Теперь вы можете получать награды.');
        } else {
            showSafeAlert('📢 Подпишитесь на канал @CS2DropZone чтобы получать награды!');
            showSubscriptionModal();
        }
        
    } catch (error) {
        console.error('Ошибка проверки подписки:', error);
        showSafeAlert('❌ Ошибка при проверке подписки');
    }
}

// ==================== ЗАДАНИЕ ДЛЯ КАНАЛА @DarenCs2 ====================

async function loadDarenCs2Status(userId) {
  try {
    const result = await callAPI('/darencs2-status', { userId: userId });
    updateDarenCs2UI(result);
  } catch (error) {
    console.error('Ошибка загрузки статуса @DarenCs2:', error);
    updateDarenCs2UI({
      isSubscribed: false,
      canClaim: false,
      rewardCount: 0,
      timeUntilNextReward: 0,
      timeFormatted: '00:00:00'
    });
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
    
    const result = await callAPI('/darencs2-reward', { userId: userId });
    
    if (result.success) {
      if (result.coinsAwarded > 0) {
        addCoins(result.coinsAwarded);
        showSafeAlert(`✅ Награда получена! +${result.coinsAwarded} монет за подписку на @DarenCs2!`);
        
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
        updateDarenCs2UI({
          isSubscribed: true,
          canClaim: false,
          rewardCount: result.rewardCount || 0,
          timeUntilNextReward: result.timeUntilNextReward || 0,
          timeFormatted: result.timeFormatted || '00:00:00'
        });
      }
    } else {
      showSafeAlert(result.error || '❌ Ошибка при получении награды');
    }
    
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

async function checkDarenCs2Only() {
  const userId = tg.initDataUnsafe?.user?.id;
  
  try {
    const result = await callAPI('/darencs2-status', { userId: userId });
    
    if (result.isSubscribed) {
      showSafeAlert('✅ Вы подписаны на @DarenCs2! Теперь вы можете получать награды.');
    } else {
      showSafeAlert('🎮 Подпишитесь на канал @DarenCs2 чтобы получать награды!');
      showDarenCs2Modal();
    }
    
  } catch (error) {
    console.error('Ошибка проверки подписки @DarenCs2:', error);
    showSafeAlert('❌ Ошибка при проверке подписки');
  }
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

function openDarenCs2Channel() {
  window.open('https://t.me/DarenCs2', '_blank');
}

// ==================== СИСТЕМА МОНЕТ ====================

function updateCoinsDisplay(coins) {
    const coinsElements = document.querySelectorAll('#userCoins, #profileCoins');
    coinsElements.forEach(element => {
        if (element) {
            element.textContent = coins.toLocaleString();
            element.classList.add('coin-animation');
            setTimeout(() => element.classList.remove('coin-animation'), 600);
        }
    });
    
    const userId = tg.initDataUnsafe?.user?.id;
    if (userId) {
        localStorage.setItem(`coins_${userId}`, coins.toString());
    }
}

async function loadUserBalance(userId) {
    try {
        const result = await callAPI('/get-balance', { userId: userId });
        
        if (result.success) {
            updateCoinsDisplay(result.coins);
        } else {
            let localCoins = localStorage.getItem(`coins_${userId}`);
            if (!localCoins) {
                localCoins = '0';
                localStorage.setItem(`coins_${userId}`, localCoins);
            }
            updateCoinsDisplay(parseInt(localCoins));
        }
    } catch (error) {
        console.error('Ошибка загрузки баланса:', error);
        let localCoins = localStorage.getItem(`coins_${userId}`);
        if (!localCoins) localCoins = '0';
        updateCoinsDisplay(parseInt(localCoins));
    }
}

function deductCoins(amount) {
    const userCoins = document.getElementById('userCoins');
    if (!userCoins) return;
    
    const currentCoins = parseInt(userCoins.textContent.replace(/,/g, '')) || 0;
    const newCoins = Math.max(0, currentCoins - amount);
    updateCoinsDisplay(newCoins);
}

function addCoins(amount) {
    const userCoins = document.getElementById('userCoins');
    if (!userCoins) return;
    
    const currentCoins = parseInt(userCoins.textContent.replace(/,/g, '')) || 0;
    const newCoins = currentCoins + amount;
    updateCoinsDisplay(newCoins);
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
    
    // Создаем копию предметов для бесконечной анимации
    const itemsForAnimation = [];
    
    // Добавляем много копий для эффекта бесконечного вращения
    for (let i = 0; i < 30; i++) {
        caseData.items.forEach(item => {
            itemsForAnimation.push(item);
        });
    }
    
    // Добавляем предметы в рулетку
    itemsForAnimation.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'roulette-item';
        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="roulette-item-name">${item.name}</div>
        `;
        rouletteItems.appendChild(itemElement);
    });
    
    // Сохраняем данные для использования после анимации
    modal.dataset.wonItem = JSON.stringify(wonItem);
    modal.dataset.caseData = JSON.stringify(caseData);
    
    modal.style.display = 'block';
    
    // Запускаем анимацию
    startRouletteAnimation(modal, wonItem);
}

function startRouletteAnimation(modal, wonItem) {
    const rouletteItems = document.getElementById('rouletteItems');
    const rouletteSpinning = document.getElementById('rouletteSpinning');
    
    if (!rouletteItems || !rouletteSpinning) return;
    
    const itemWidth = 90;
    const containerWidth = 400;
    const centerPosition = containerWidth / 2 - itemWidth / 2;
    
    let startTime = Date.now();
    let currentPosition = 0;
    let animationFrame;
    let speed = 100;
    const totalTime = 7000;
    const slowStartTime = 5000;
    
    // Находим позицию выигрышного предмета
    let targetIndex = -1;
    for (let i = 0; i < rouletteItems.children.length; i++) {
        const itemName = rouletteItems.children[i].querySelector('.roulette-item-name').textContent;
        if (itemName === wonItem.name && i > 20) {
            targetIndex = i;
            break;
        }
    }
    
    // Если не нашли, берем случайный индекс после 20-го элемента
    if (targetIndex === -1) {
        targetIndex = Math.floor(Math.random() * 20) + 30;
    }
    
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
    document.getElementById('resultSkinChance').textContent = `${item.chance}`;
    
    document.getElementById('goToInventoryBtn').onclick = () => {
        modal.style.display = 'none';
        switchToTab('inventory');
    };
    
    document.getElementById('openAnotherCaseBtn').onclick = () => {
        modal.style.display = 'none';
        openCaseModal(caseData);
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
        let inventory = JSON.parse(localStorage.getItem(`inventory_${userId}`) || '[]');
        
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
        localStorage.setItem(`inventory_${userId}`, JSON.stringify(inventory));
        
        console.log('✅ Скин сохранен в инвентарь:', newSkin);
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
        let inventory = JSON.parse(localStorage.getItem(`inventory_${userId}`) || '[]');
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
    
    let inventory = JSON.parse(localStorage.getItem(`inventory_${userId}`) || '[]');
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
            let inventory = JSON.parse(localStorage.getItem(`inventory_${userId}`) || '[]');
            const skinIndex = inventory.findIndex(s => s.id === skin.id);
            
            if (skinIndex !== -1) {
                // Помечаем скин как проданный
                inventory[skinIndex].status = 'sold';
                inventory[skinIndex].soldDate = new Date().toISOString();
                inventory[skinIndex].soldPrice = skin.value || 10;
                localStorage.setItem(`inventory_${userId}`, JSON.stringify(inventory));
                
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
        
        const result = await callAPI('/withdraw-request', {
            userId: userId,
            userName: user?.first_name || 'Неизвестно',
            userUsername: user?.username || 'Неизвестно',
            skinName: skin.name,
            skinImage: skin.image,
            skinValue: skin.value || 10,
            skinRarity: skin.rarity || 'common',
            tradeLink: tradeLink
        });
        
        if (result.success) {
            // Помечаем скин как ожидающий вывода в локальном хранилище
            let inventory = JSON.parse(localStorage.getItem(`inventory_${userId}`) || '[]');
            const skinIndex = inventory.findIndex(s => s.id === skin.id);
            if (skinIndex !== -1) {
                inventory[skinIndex].status = 'withdraw_pending';
                inventory[skinIndex].tradeLink = tradeLink;
                inventory[skinIndex].withdrawDate = new Date().toISOString();
                inventory[skinIndex].withdrawStatus = 'pending';
                localStorage.setItem(`inventory_${userId}`, JSON.stringify(inventory));
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

function getDefaultAvatar() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iNjAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIzMCIgeT0iMzAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPgo8cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQgNEg4YTQgNCAwIDAgMC00IDR2MiIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjciIHI9IjQiLz4KPC9zdmc+Cjwvc3ZnPg==';
}

// Инициализируем приложение когда страница загрузится
document.addEventListener('DOMContentLoaded', initApp);
