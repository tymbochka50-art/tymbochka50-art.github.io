// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

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

        // Загрузка баланса и статусов с локальным кешированием
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

        // Обновляем таймеры
        await updateAllTimers();
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        showSafeAlert('❌ Ошибка загрузки приложения. Пожалуйста, перезагрузите.');
    }
}

// Функция для обновления всех таймеров
async function updateAllTimers() {
    const userId = tg.initDataUnsafe?.user?.id;
    const user = tg.initDataUnsafe?.user;
    
    if (!userId) return;

    try {
        // Обновляем статусы для корректного отображения таймеров
        await loadRewardStatus(userId);
        await loadSubscriptionStatus(userId);
        await loadLastNameStatus(user);
        await loadDarenCs2Status(userId);
        
        console.log('✅ Таймеры обновлены');

    } catch (error) {
        console.error('❌ Error updating timers:', error);
    }
}

// Исправленная функция инициализации навигации
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Сначала скрываем все вкладки кроме активной
    tabContents.forEach(tab => {
        if (!tab.classList.contains('active')) {
            tab.style.display = 'none';
        }
    });
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            
            // Скрываем все вкладки
            tabContents.forEach(tab => {
                tab.style.display = 'none';
                tab.classList.remove('active');
            });
            
            // Убираем активный класс у всех кнопок
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Показываем выбранную вкладку
            const activeTab = document.getElementById(tabId);
            if (activeTab) {
                activeTab.style.display = 'block';
                activeTab.classList.add('active');
            }
            
            // Добавляем активный класс к выбранной кнопке
            item.classList.add('active');
            
            // Обновляем статистику при переключении
            updateInventoryStats();
            
            // При переключении на инвентарь или профиль обновляем их
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
    // Основные данные
    document.getElementById('debugUserId').textContent = user.id || 'Не доступен';
    
    // Аватар
    const avatar = document.getElementById('userAvatar');
    avatar.src = user.photo_url || getDefaultAvatar();

    // Имя пользователя
    const userName = document.getElementById('userName');
    userName.textContent = user.first_name || 'Пользователь';

    // Данные профиля
    document.getElementById('profileFirstName').textContent = user.first_name || 'Не указано';
    document.getElementById('profileLastName').textContent = user.last_name || 'Не указано';
    document.getElementById('profileUsername').textContent = user.username ? '@' + user.username : 'Не указано';
}

// ==================== ОБНОВЛЕНИЕ СТАТИСТИКИ ИНВЕНТАРЯ ====================

// Обновление статистики инвентаря для всех разделов
function updateInventoryStats() {
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) return;
    
    let inventory = JSON.parse(localStorage.getItem(`inventory_${userId}`) || '[]');
    const activeInventory = inventory.filter(skin => skin.status === 'in_inventory');
    const totalVal = activeInventory.reduce((sum, skin) => sum + skin.value, 0);
    
    // Обновляем все разделы
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

// Генерация и копирование реферальной ссылки одной кнопкой
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
        
        // Генерируем реферальную ссылку локально если бэкенд недоступен
        const referralCode = generateLocalReferralCode(userId);
        const referralLink = `https://t.me/CS2DropsGiveawayBot?start=${referralCode}`;
        
        // Сохраняем код локально
        localStorage.setItem(`referral_code_${userId}`, referralCode);
        
        // Копируем ссылку в буфер обмена
        try {
            await navigator.clipboard.writeText(referralLink);
            
            showSafeAlert(
                `✅ Реферальная ссылка скопирована!\n\n` +
                `Приглашайте друзей и получайте +500 монет за каждого!\n\n` +
                `Ссылка: ${referralLink}`
            );
            
            // Обновляем статистику
            updateReferralStats({
                totalReferrals: 0,
                referralEarnings: 0,
                referralCode: referralCode
            });
            
            // Визуальная обратная связь
            generateBtn.textContent = '✅ Скопировано!';
            setTimeout(() => {
                generateBtn.textContent = originalText;
            }, 2000);
            
        } catch (error) {
            // Fallback для старых браузеров
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
            
            updateReferralStats({
                totalReferrals: 0,
                referralEarnings: 0,
                referralCode: referralCode
            });
            
            generateBtn.textContent = '✅ Скопировано!';
            setTimeout(() => {
                generateBtn.textContent = originalText;
            }, 2000);
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

// Генерация реферального кода локально
function generateLocalReferralCode(userId) {
    return `ref_${userId}_${Date.now().toString(36)}`;
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
    
    // Обновляем профиль
    const profileReferrals = document.getElementById('profileReferrals');
    if (profileReferrals) {
        profileReferrals.textContent = data.totalReferrals || 0;
    }
    
    console.log('📊 Updated referral stats:', {
        totalReferrals: data.totalReferrals,
        referralEarnings: data.referralEarnings
    });
}

// Загрузка реферальной статистики
async function loadReferralStats(userId) {
    try {
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/referral-stats';
        
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
        
        console.log('👥 Результат загрузки реферальной статистики:', result);
        
        if (result.success) {
            updateReferralStats(result);
        } else {
            console.warn('⚠️ Бэкенд недоступен, используем локальные данные');
            // Используем локальные данные
            const localCode = localStorage.getItem(`referral_code_${userId}`) || 'Не сгенерирован';
            updateReferralStats({
                totalReferrals: 0,
                referralEarnings: 0,
                referralCode: localCode
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки реферальной статистики:', error);
        // Используем локальные данные при ошибке сети
        const localCode = localStorage.getItem(`referral_code_${userId}`) || 'Не сгенерирован';
        updateReferralStats({
            totalReferrals: 0,
            referralEarnings: 0,
            referralCode: localCode
        });
    }
}

// ==================== СИСТЕМА ФАМИЛИИ С ПОВТОРНЫМИ НАГРАДАМИ ====================

// Загрузка статуса фамилии
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
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/special-lastname-status';
        
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                lastName: user.last_name || ''
            })
        });

        const result = await response.json();
        
        console.log('📛 Результат загрузки статуса фамилии:', result);
        
        if (result.success) {
            updateLastNameUI(result);
        } else {
            console.warn('⚠️ Бэкенд недоступен, проверяем фамилию локально');
            // Проверяем локально
            const hasLastName = !!(user.last_name && user.last_name.trim() !== '');
            updateLastNameUI({
                hasCorrectLastName: hasLastName,
                canClaim: hasLastName, // Можно получить награду если есть фамилия
                timeUntilNextReward: 0,
                timeFormatted: '00:00:00'
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки статуса фамилии:', error);
        // Проверяем локально при ошибке сети
        const hasLastName = !!(user.last_name && user.last_name.trim() !== '');
        updateLastNameUI({
            hasCorrectLastName: hasLastName,
            canClaim: hasLastName,
            timeUntilNextReward: 0,
            timeFormatted: '00:00:00'
        });
    }
}

// Обновление интерфейса фамилии
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

// Проверка фамилии с локальной наградой
async function checkSpecialLastName() {
    const userId = tg.initDataUnsafe?.user?.id;
    const user = tg.initDataUnsafe?.user;
    const bonusBtns = document.querySelectorAll('.task-button');
    const bonusBtn = bonusBtns[2];
    const nameStatus = document.getElementById('nameStatus');
    
    if (!userId || !user) {
        showSafeAlert('❌ Не удалось получить данные пользователя');
        return;
    }
    
    try {
        const originalText = bonusBtn.textContent;
        bonusBtn.disabled = true;
        bonusBtn.textContent = '🔄 Проверяем...';
        
        // Проверяем локально
        const hasLastName = !!(user.last_name && user.last_name.trim() !== '');
        const lastClaimTime = localStorage.getItem(`last_name_reward_${userId}`);
        const now = Date.now();
        const canClaim = !lastClaimTime || (now - parseInt(lastClaimTime)) > 24 * 60 * 60 * 1000;
        
        if (hasLastName && canClaim) {
            // Начисляем награду локально
            addCoins(50);
            localStorage.setItem(`last_name_reward_${userId}`, now.toString());
            
            showSafeAlert('✅ Награда получена! +50 монет за установленную фамилию');
            
            // Обновляем UI
            updateLastNameUI({
                hasCorrectLastName: true,
                canClaim: false,
                timeUntilNextReward: 24 * 60 * 60, // 24 часа
                timeFormatted: '24:00:00'
            });
            
            // Запускаем таймер
            startLastNameTimer(24 * 60 * 60);
            
        } else if (hasLastName && !canClaim) {
            const timeLeft = 24 * 60 * 60 * 1000 - (now - parseInt(lastClaimTime));
            const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            
            showSafeAlert(`⏳ Вы уже получали награду сегодня. Следующая награда через ${hoursLeft}ч ${minutesLeft}м`);
            
            updateLastNameUI({
                hasCorrectLastName: true,
                canClaim: false,
                timeUntilNextReward: Math.floor(timeLeft / 1000),
                timeFormatted: `${hoursLeft.toString().padStart(2, '0')}:${minutesLeft.toString().padStart(2, '0')}:00`
            });
            
        } else {
            showSafeAlert('❌ У вас не установлена фамилия в Telegram. Установите фамилию в настройках профиля.');
            updateLastNameUI({
                hasCorrectLastName: false,
                canClaim: false,
                timeUntilNextReward: 0
            });
        }
        
    } catch (error) {
        console.error('Ошибка проверки фамилии:', error);
        showSafeAlert('❌ Ошибка при проверке фамилии');
    } finally {
        setTimeout(() => {
            bonusBtn.disabled = false;
        }, 1000);
    }
}

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

// Универсальная функция таймера с форматированием времени
function startUniversalTimer(seconds, timerElement, buttonElement, buttonText, readyText) {
    let timeLeft = seconds;
    
    buttonElement.disabled = true;
    
    const updateTimerDisplay = () => {
        if (timeLeft > 0) {
            const timeInfo = formatTimeRemaining(timeLeft);
            
            if (timerElement) {
                timerElement.textContent = `⏳ До следующей награды: ${timeInfo.formattedHM}`;
            }
            
            buttonElement.textContent = `⏳ ${timeInfo.formatted}`;
            timeLeft--;
            
            // Планируем следующее обновление
            setTimeout(updateTimerDisplay, 1000);
        } else {
            if (timerElement) {
                timerElement.textContent = readyText;
            }
            
            buttonElement.disabled = false;
            buttonElement.textContent = buttonText;
        }
    };
    
    // Начинаем обновление
    updateTimerDisplay();
}

// Функция форматирования времени в HH:MM:SS
function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Функция форматирования времени в Xч Yм
function formatTimeHM(seconds) {
    if (!seconds || seconds <= 0) return '0ч 0м';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    return `${hours}ч ${minutes}м`;
}

// Функция форматирования времени с полной информацией
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

// Обновленная функция обновления UI наград
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
            // Используем отформатированное время из бэкенда
            const timeDisplay = data.timeFormattedHM || formatTimeHM(data.timeUntilNextReward);
            timerText.textContent = `⏳ До следующей награды: ${timeDisplay}`;
            claimBtn.disabled = true;
            claimBtn.textContent = `⏳ ${data.timeFormatted || formatTime(data.timeUntilNextReward)}`;
            if (rewardProgress) rewardProgress.classList.remove('progress-pulse');
            
            // Запускаем таймер с обновлением каждую секунду
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
        
        // Локальная реализация ежедневной награды
        const lastRewardTime = localStorage.getItem(`daily_reward_${userId}`);
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        const canClaim = !lastRewardTime || (now - parseInt(lastRewardTime)) > twentyFourHours;
        
        if (canClaim) {
            // Начисляем награду локально
            addCoins(50);
            localStorage.setItem(`daily_reward_${userId}`, now.toString());
            
            // Обновляем счетчик наград
            const rewardCount = parseInt(localStorage.getItem(`reward_count_${userId}`) || '0') + 1;
            localStorage.setItem(`reward_count_${userId}`, rewardCount.toString());
            
            showSafeAlert(`✅ Ежедневная награда получена! +50 монет\n\nВсего наград: ${rewardCount}`);
            
            // Обновляем UI
            updateRewardUI({
                canClaim: false,
                rewardCount: rewardCount,
                timeUntilNextReward: 24 * 60 * 60,
                timeFormatted: '24:00:00',
                timeFormattedHM: '24ч 0м'
            });
            
            // Запускаем таймер
            startRewardTimer(24 * 60 * 60);
            
        } else {
            const timeLeft = twentyFourHours - (now - parseInt(lastRewardTime));
            const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            
            showSafeAlert(`⏳ Вы уже получали награду сегодня. Следующая награда через ${hoursLeft}ч ${minutesLeft}м`);
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
        
        console.log('🎁 Результат загрузки статуса наград:', result);
        
        if (result.success) {
            updateRewardUI(result);
            
            if (!result.canClaim && result.timeUntilNextReward > 0) {
                startRewardTimer(userId);
            }
        } else {
            console.warn('⚠️ Бэкенд недоступен, используем локальные данные');
            // Используем локальные данные
            const lastRewardTime = localStorage.getItem(`daily_reward_${userId}`);
            const now = Date.now();
            const twentyFourHours = 24 * 60 * 60 * 1000;
            const canClaim = !lastRewardTime || (now - parseInt(lastRewardTime)) > twentyFourHours;
            const rewardCount = parseInt(localStorage.getItem(`reward_count_${userId}`) || '0');
            
            if (canClaim) {
                updateRewardUI({
                    canClaim: true,
                    rewardCount: rewardCount,
                    timeUntilNextReward: 0,
                    timeFormatted: '00:00:00',
                    timeFormattedHM: '0ч 0м'
                });
            } else {
                const timeLeft = twentyFourHours - (now - parseInt(lastRewardTime));
                const secondsLeft = Math.floor(timeLeft / 1000);
                updateRewardUI({
                    canClaim: false,
                    rewardCount: rewardCount,
                    timeUntilNextReward: secondsLeft,
                    timeFormatted: formatTime(secondsLeft),
                    timeFormattedHM: formatTimeHM(secondsLeft)
                });
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки статуса наград:', error);
        // Используем локальные данные при ошибке сети
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

// ==================== СИСТЕМА ПОДПИСКИ С НАГРАДАМИ ====================

// Загрузка статуса подписки
async function loadSubscriptionStatus(userId) {
    try {
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/subscription-status';
        
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
        
        console.log('📢 Результат загрузки статуса подписки:', result);
        
        if (result.success) {
            updateSubscriptionUI(result);
        } else {
            console.warn('⚠️ Бэкенд недоступен, используем локальные данные');
            // Используем локальные данные - предполагаем что пользователь не подписан
            updateSubscriptionUI({
                isSubscribed: false,
                canClaim: false,
                rewardCount: 0,
                timeUntilNextReward: 0,
                timeFormatted: '00:00:00'
            });
        }
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

// Обновленная функция для подписки
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
        
        showSafeAlert('📢 Для получения награды нужно подписаться на канал @CS2DropZone');
        showSubscriptionModal();
        
    } catch (error) {
        console.error('Ошибка получения награды за подписку:', error);
        showSafeAlert('❌ Ошибка при проверке подписки');
    } finally {
        setTimeout(() => {
            claimBtn.disabled = false;
            claimBtn.textContent = '🔍 Проверить подписку';
        }, 1000);
    }
}

// Функция показа модального окна подписки
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

// Функция открытия канала Telegram
function openTelegramChannel() {
    window.open('https://t.me/CS2DropZone', '_blank');
}

// Обновление интерфейса подписки
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

// Проверка только подписки (без награды)
async function checkSubscriptionOnly() {
    const userId = tg.initDataUnsafe?.user?.id;
    
    try {
        showSafeAlert('📢 Подпишитесь на канал @CS2DropZone чтобы получать награды!');
        showSubscriptionModal();
        
    } catch (error) {
        console.error('Ошибка проверки подписки:', error);
        showSafeAlert('❌ Ошибка при проверке подписки');
    }
}

// ==================== ЗАДАНИЕ ДЛЯ КАНАЛА @DarenCs2 ====================

// Статус подписки на @DarenCs2
async function loadDarenCs2Status(userId) {
  try {
    const backendUrl = 'https://telegram-backend-nine.vercel.app/api/darencs2-status';
    
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
    
    console.log('🎮 Результат загрузки статуса @DarenCs2:', result);
    
    if (result.success) {
      updateDarenCs2UI(result);
    } else {
      console.warn('⚠️ Бэкенд недоступен, используем локальные данные');
      // Используем локальные данные
      updateDarenCs2UI({
        isSubscribed: false,
        canClaim: false,
        rewardCount: 0,
        timeUntilNextReward: 0,
        timeFormatted: '00:00:00'
      });
    }
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

// Обновление UI для @DarenCs2
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

// Получение награды за @DarenCs2
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
    
    showSafeAlert('🎮 Для получения награды нужно подписаться на канал @DarenCs2');
    showDarenCs2Modal();
    
  } catch (error) {
    console.error('Ошибка получения награды за @DarenCs2:', error);
    showSafeAlert('❌ Ошибка при проверке подписки');
  } finally {
    setTimeout(() => {
      claimBtn.disabled = false;
      claimBtn.textContent = '🔍 Проверить подписку';
    }, 1000);
  }
}

// Проверка только подписки (без награды)
async function checkDarenCs2Only() {
  const userId = tg.initDataUnsafe?.user?.id;
  
  try {
    showSafeAlert('🎮 Подпишитесь на канал @DarenCs2 чтобы получать награды!');
    showDarenCs2Modal();
    
  } catch (error) {
    console.error('Ошибка проверки подписки @DarenCs2:', error);
    showSafeAlert('❌ Ошибка при проверке подписки');
  }
}

// Модальное окно для @DarenCs2
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

// Функция открытия канала @DarenCs2
function openDarenCs2Channel() {
  window.open('https://t.me/DarenCs2', '_blank');
}

// ==================== СИСТЕМА МОНЕТ ====================

// Обновление отображения монет
function updateCoinsDisplay(coins) {
    const coinsElements = document.querySelectorAll('#userCoins, #profileCoins');
    coinsElements.forEach(element => {
        if (element) {
            element.textContent = coins.toLocaleString();
            element.classList.add('coin-animation');
            setTimeout(() => element.classList.remove('coin-animation'), 600);
        }
    });
    
    // Сохраняем баланс локально
    const userId = tg.initDataUnsafe?.user?.id;
    if (userId) {
        localStorage.setItem(`coins_${userId}`, coins.toString());
    }
}

// Загружаем баланс
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
        
        console.log('💰 Результат загрузки баланса:', result);
        
        if (result.success) {
            updateCoinsDisplay(result.coins);
        } else {
            console.warn('⚠️ Бэкенд недоступен, используем локальный баланс');
            // Используем локальный баланс
            const localCoins = parseInt(localStorage.getItem(`coins_${userId}`) || '1000');
            updateCoinsDisplay(localCoins);
        }
    } catch (error) {
        console.error('Ошибка загрузки баланса:', error);
        // Используем локальный баланс при ошибке сети
        const localCoins = parseInt(localStorage.getItem(`coins_${userId}`) || '1000');
        updateCoinsDisplay(localCoins);
    }
}

// Списание монет
function deductCoins(amount) {
    const currentCoins = parseInt(document.getElementById('userCoins').textContent.replace(/,/g, ''));
    const newCoins = Math.max(0, currentCoins - amount);
    updateCoinsDisplay(newCoins);
}

// Добавление монет
function addCoins(amount) {
    const currentCoins = parseInt(document.getElementById('userCoins').textContent.replace(/,/g, ''));
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
        // Fallback: показываем в консоли
        console.log('ALERT:', message);
    }
    
    // Сбрасываем флаг через 2 секунды
    setTimeout(() => {
        isAlertShowing = false;
    }, 2000);
}

// ==================== СИСТЕМА КЕЙСОВ (остается без изменений) ====================
// [Добавьте здесь код системы кейсов из предыдущего ответа без изменений]

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
    
    // Скрываем все вкладки
    tabContents.forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });
    
    // Убираем активный класс у всех кнопок
    navItems.forEach(nav => nav.classList.remove('active'));
    
    // Показываем выбранную вкладку
    const activeTab = document.getElementById(tabName);
    if (activeTab) {
        activeTab.style.display = 'block';
        activeTab.classList.add('active');
    }
    
    // Активируем соответствующую кнопку навигации
    const activeNav = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }
    
    // Обновляем статистику
    updateInventoryStats();
    
    if (tabName === 'inventory') {
        loadInventory();
    } else if (tabName === 'profile') {
        loadProfileInventory();
    }
}

// Инициализация модальных окон
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
