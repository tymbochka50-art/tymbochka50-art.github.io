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

        // Инициализируем пользователя локально
        await initLocalUser(user.id);

        // Загрузка баланса и статусов (локально)
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

// Инициализация пользователя в локальном хранилище
async function initLocalUser(userId) {
    try {
        // Проверяем, инициализирован ли уже пользователь
        const userInitialized = localStorage.getItem(`user_initialized_${userId}`);
        
        if (!userInitialized) {
            console.log('👤 Инициализируем нового пользователя локально');
            
            // Устанавливаем начальный баланс 0
            localStorage.setItem(`coins_${userId}`, '0');
            
            // Инициализируем счетчики
            localStorage.setItem(`reward_count_${userId}`, '0');
            localStorage.setItem(`subscription_count_${userId}`, '0');
            localStorage.setItem(`darencs2_count_${userId}`, '0');
            localStorage.setItem(`name_reward_count_${userId}`, '0');
            
            // Генерируем реферальный код
            const referralCode = generateLocalReferralCode(userId);
            localStorage.setItem(`referral_code_${userId}`, referralCode);
            
            // Инициализируем временные метки с будущей датой, чтобы можно было сразу получить награды
            localStorage.setItem(`daily_reward_${userId}`, '0');
            localStorage.setItem(`last_name_reward_${userId}`, '0');
            
            // Отмечаем как инициализированного
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
    const debugUserId = document.getElementById('debugUserId');
    if (debugUserId) {
        debugUserId.textContent = user.id || 'Не доступен';
    }
    
    // Аватар
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
        avatar.src = user.photo_url || getDefaultAvatar();
    }

    // Имя пользователя
    const userName = document.getElementById('userName');
    if (userName) {
        userName.textContent = user.first_name || 'Пользователь';
    }

    // Данные профиля
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
        
        // Генерируем реферальную ссылку локально
        const referralCode = localStorage.getItem(`referral_code_${userId}`) || generateLocalReferralCode(userId);
        const referralLink = `https://t.me/CS2DropsGiveawayBot?start=${referralCode}`;
        
        // Сохраняем код локально если еще не сохранен
        if (!localStorage.getItem(`referral_code_${userId}`)) {
            localStorage.setItem(`referral_code_${userId}`, referralCode);
        }
        
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
    return `ref_${userId}_${Date.now().toString(36).substr(2, 8)}`;
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
        // Локальная реализация
        const referralCode = localStorage.getItem(`referral_code_${userId}`) || 'Не сгенерирован';
        const totalReferrals = parseInt(localStorage.getItem(`referrals_count_${userId}`) || '0');
        const referralEarnings = totalReferrals * 500; // 500 монет за каждого реферала
        
        updateReferralStats({
            totalReferrals: totalReferrals,
            referralEarnings: referralEarnings,
            referralCode: referralCode
        });
        
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
        // Локальная проверка фамилии
        const hasLastName = !!(user.last_name && user.last_name.trim() !== '');
        const lastClaimTime = localStorage.getItem(`last_name_reward_${userId}`);
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        let canClaim = false;
        let timeUntilNextReward = 0;
        
        if (hasLastName) {
            const lastTime = lastClaimTime === '0' ? 0 : parseInt(lastClaimTime || '0');
            if (lastTime === 0) {
                canClaim = true;
            } else {
                const timeSinceLastClaim = now - lastTime;
                if (timeSinceLastClaim > twentyFourHours) {
                    canClaim = true;
                } else {
                    timeUntilNextReward = Math.floor((twentyFourHours - timeSinceLastClaim) / 1000);
                }
            }
        }
        
        updateLastNameUI({
            hasCorrectLastName: hasLastName,
            canClaim: canClaim,
            timeUntilNextReward: timeUntilNextReward,
            timeFormatted: formatTime(timeUntilNextReward)
        });
        
    } catch (error) {
        console.error('Ошибка загрузки статуса фамилии:', error);
        updateLastNameUI({
            hasCorrectLastName: false,
            canClaim: false,
            timeUntilNextReward: 0
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
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        const lastTime = lastClaimTime === '0' ? 0 : parseInt(lastClaimTime || '0');
        const canClaim = hasLastName && (lastTime === 0 || (now - lastTime) > twentyFourHours);
        
        if (hasLastName && canClaim) {
            // Начисляем награду локально
            addCoins(50);
            localStorage.setItem(`last_name_reward_${userId}`, now.toString());
            
            // Увеличиваем счетчик
            const currentCount = parseInt(localStorage.getItem(`name_reward_count_${userId}`) || '0');
            localStorage.setItem(`name_reward_count_${userId}`, (currentCount + 1).toString());
            
            showSafeAlert('✅ Награда получена! +50 монет за установленную фамилию');
            
            // Обновляем UI
            updateLastNameUI({
                hasCorrectLastName: true,
                canClaim: false,
                timeUntilNextReward: 24 * 60 * 60,
                timeFormatted: '24:00:00'
            });
            
            // Запускаем таймер
            startLastNameTimer(24 * 60 * 60);
            
        } else if (hasLastName && !canClaim) {
            const timeLeft = twentyFourHours - (now - lastTime);
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

// Универсальная функция таймера с форматированием времени
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
            
            // Планируем следующее обновление
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
        
        // Проверяем, получал ли пользователь награду когда-либо
        const lastTime = lastRewardTime === '0' ? 0 : parseInt(lastRewardTime || '0');
        const canClaim = lastTime === 0 || (now - lastTime) > twentyFourHours;
        
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
            const timeLeft = twentyFourHours - (now - lastTime);
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
        // Локальная реализация
        const lastRewardTime = localStorage.getItem(`daily_reward_${userId}`);
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        const lastTime = lastRewardTime === '0' ? 0 : parseInt(lastRewardTime || '0');
        const canClaim = lastTime === 0 || (now - lastTime) > twentyFourHours;
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
            const timeLeft = twentyFourHours - (now - lastTime);
            const secondsLeft = Math.floor(timeLeft / 1000);
            updateRewardUI({
                canClaim: false,
                rewardCount: rewardCount,
                timeUntilNextReward: secondsLeft,
                timeFormatted: formatTime(secondsLeft),
                timeFormattedHM: formatTimeHM(secondsLeft)
            });
        }
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

// Загрузка статуса подписки
async function loadSubscriptionStatus(userId) {
    try {
        // Локальная реализация - всегда показываем как не подписан
        updateSubscriptionUI({
            isSubscribed: false,
            canClaim: false,
            rewardCount: parseInt(localStorage.getItem(`subscription_count_${userId}`) || '0'),
            timeUntilNextReward: 0,
            timeFormatted: '00:00:00'
        });
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
    // Локальная реализация - всегда показываем как не подписан
    updateDarenCs2UI({
      isSubscribed: false,
      canClaim: false,
      rewardCount: parseInt(localStorage.getItem(`darencs2_count_${userId}`) || '0'),
      timeUntilNextReward: 0,
      timeFormatted: '00:00:00'
    });
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
        // Локальная реализация
        let localCoins = localStorage.getItem(`coins_${userId}`);
        
        // Если баланса нет, устанавливаем 0
        if (!localCoins) {
            localCoins = '0';
            localStorage.setItem(`coins_${userId}`, localCoins);
        }
        
        const coins = parseInt(localCoins);
        updateCoinsDisplay(coins);
        
    } catch (error) {
        console.error('Ошибка загрузки баланса:', error);
        updateCoinsDisplay(0);
    }
}

// Списание монет
function deductCoins(amount) {
    const userCoins = document.getElementById('userCoins');
    if (!userCoins) return;
    
    const currentCoins = parseInt(userCoins.textContent.replace(/,/g, ''));
    const newCoins = Math.max(0, currentCoins - amount);
    updateCoinsDisplay(newCoins);
}

// Добавление монет
function addCoins(amount) {
    const userCoins = document.getElementById('userCoins');
    if (!userCoins) return;
    
    const currentCoins = parseInt(userCoins.textContent.replace(/,/g, ''));
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

// ==================== СИСТЕМА КЕЙСОВ И ИНВЕНТАРЯ ====================

// Обновленные данные кейсов с новыми скинами
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

// Загрузка кейсов
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

// Открытие модального окна кейса
function openCaseModal(caseData) {
    const modal = document.getElementById('caseModal');
    const caseItemsList = document.getElementById('caseItemsList');
    
    if (!modal || !caseItemsList) return;
    
    document.getElementById('caseModalTitle').textContent = `Кейс ${caseData.name}`;
    document.getElementById('caseModalImage').src = caseData.image;
    document.getElementById('caseModalName').textContent = caseData.name;
    document.getElementById('caseModalPrice').textContent = caseData.price.toLocaleString();
    
    // Заполняем сетку предметов
    caseItemsList.innerHTML = '';
    caseData.items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'item-preview';
        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-chance">Шанс: ${item.chance}%</div>
                <div class="item-rarity ${item.rarity}">${getRarityText(item.rarity)}</div>
            </div>
        `;
        caseItemsList.appendChild(itemElement);
    });
    
    // Настройка кнопки открытия
    const openBtn = document.getElementById('openCaseBtn');
    if (openBtn) {
        openBtn.onclick = () => startCaseOpening(caseData);
    }
    
    modal.style.display = 'block';
}

// Начало открытия кейса
function startCaseOpening(caseData) {
    const userId = tg.initDataUnsafe?.user?.id;
    const currentCoins = parseInt(document.getElementById('userCoins').textContent.replace(/,/g, ''));
    
    if (currentCoins < caseData.price) {
        showSafeAlert('❌ Недостаточно монет для открытия кейса!');
        return;
    }
    
    // Закрываем модалку кейса
    document.getElementById('caseModal').style.display = 'none';
    
    // Списываем монеты сразу
    deductCoins(caseData.price);
    
    // Показываем рулетку
    showRoulette(caseData);
}

// Показ рулетки
function showRoulette(caseData) {
    const modal = document.getElementById('rouletteModal');
    const rouletteItems = document.getElementById('rouletteItems');
    
    if (!modal || !rouletteItems) return;
    
    // Заполняем рулетку предметами (повторяем для эффекта)
    rouletteItems.innerHTML = '';
    for (let i = 0; i < 30; i++) {
        caseData.items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'roulette-item';
            itemElement.innerHTML = `
                <img src="${item.image}" alt="${item.name}">
                <div class="roulette-item-name">${item.name}</div>
            `;
            rouletteItems.appendChild(itemElement);
        });
    }
    
    modal.style.display = 'block';
    
    // Запускаем анимацию
    startRouletteAnimation(caseData);
}

// Анимация рулетки
function startRouletteAnimation(caseData) {
    const rouletteItems = document.getElementById('rouletteItems');
    
    if (!rouletteItems) return;
    
    let startTime = Date.now();
    let animationFrame;
    let currentPosition = 0;
    let speed = 50;
    
    function animate() {
        const elapsed = Date.now() - startTime;
        
        if (elapsed < 7000) {
            if (elapsed > 5000) {
                speed = Math.max(2, speed * 0.95);
            } else if (elapsed > 3000) {
                speed = Math.max(5, speed * 0.98);
            }
            
            currentPosition -= speed;
            rouletteItems.style.transform = `translateX(${currentPosition}px)`;
            animationFrame = requestAnimationFrame(animate);
        } else {
            cancelAnimationFrame(animationFrame);
            finishCaseOpening(caseData);
        }
    }
    
    animationFrame = requestAnimationFrame(animate);
}

// Завершение открытия кейса
function finishCaseOpening(caseData) {
    const wonItem = getRandomItem(caseData.items);
    
    document.getElementById('rouletteModal').style.display = 'none';
    showResult(wonItem, caseData);
    saveSkinToInventory(wonItem);
}

// Выбор случайного предмета с учетом шансов
function getRandomItem(items) {
    const random = Math.random() * 100;
    let currentChance = 0;
    
    for (const item of items) {
        currentChance += item.chance;
        if (random <= currentChance) {
            return item;
        }
    }
    
    return items[items.length - 1];
}

// Показ результата
function showResult(item, caseData) {
    const modal = document.getElementById('resultModal');
    
    if (!modal) return;
    
    document.getElementById('resultSkinImage').src = item.image;
    document.getElementById('resultSkinName').textContent = item.name;
    document.getElementById('resultSkinRarity').textContent = getRarityText(item.rarity);
    document.getElementById('resultSkinRarity').className = `result-rarity skin-rarity ${item.rarity}`;
    document.getElementById('resultSkinChance').textContent = `${item.chance}%`;
    
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

// Сохранение скина в инвентарь
function saveSkinToInventory(skin) {
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) return;
    
    let inventory = JSON.parse(localStorage.getItem(`inventory_${userId}`) || '[]');
    
    inventory.push({
        id: Date.now().toString(),
        name: skin.name,
        image: skin.image,
        rarity: skin.rarity,
        value: skin.value,
        obtainedAt: new Date().toISOString(),
        status: 'in_inventory'
    });
    
    localStorage.setItem(`inventory_${userId}`, JSON.stringify(inventory));
    
    // Обновляем все разделы
    updateInventoryStats();
    loadInventory();
    loadProfileInventory();
}

// Загрузка инвентаря
function loadInventory() {
    const userId = tg.initDataUnsafe?.user?.id;
    const inventoryGrid = document.getElementById('inventoryGrid');
    const emptyInventory = document.getElementById('emptyInventory');
    
    if (!userId || !inventoryGrid || !emptyInventory) return;
    
    let inventory = JSON.parse(localStorage.getItem(`inventory_${userId}`) || '[]');
    const activeInventory = inventory.filter(skin => skin.status === 'in_inventory');
    
    if (activeInventory.length === 0) {
        inventoryGrid.style.display = 'none';
        emptyInventory.style.display = 'block';
    } else {
        inventoryGrid.style.display = 'grid';
        emptyInventory.style.display = 'none';
        
        inventoryGrid.innerHTML = '';
        activeInventory.forEach(skin => {
            const skinElement = document.createElement('div');
            skinElement.className = 'skin-item';
            skinElement.innerHTML = `
                <img src="${skin.image}" alt="${skin.name}" class="skin-image">
                <div class="skin-name">${skin.name}</div>
                <div class="skin-rarity ${skin.rarity}">${getRarityText(skin.rarity)}</div>
            `;
            
            skinElement.addEventListener('click', () => openSkinModal(skin));
            inventoryGrid.appendChild(skinElement);
        });
    }
}

// Загрузка инвентаря в профиле
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
                <img src="${skin.image}" alt="${skin.name}" class="profile-skin-image">
                <div class="profile-skin-name">${skin.name}</div>
            `;
            
            skinElement.addEventListener('click', () => openSkinModal(skin));
            profileInventoryGrid.appendChild(skinElement);
        });
    }
}

// Открытие модального окна скина
function openSkinModal(skin) {
    const modal = document.getElementById('skinModal');
    
    if (!modal) return;
    
    document.getElementById('skinModalTitle').textContent = skin.name;
    document.getElementById('skinModalImage').src = skin.image;
    document.getElementById('skinModalName').textContent = skin.name;
    document.getElementById('skinModalRarity').textContent = getRarityText(skin.rarity);
    document.getElementById('skinModalRarity').className = `skin-rarity ${skin.rarity}`;
    document.getElementById('skinModalValue').textContent = skin.value.toLocaleString();
    
    document.getElementById('sellSkinBtn').onclick = () => sellSkin(skin);
    document.getElementById('withdrawSkinBtn').onclick = () => openWithdrawModal(skin);
    
    modal.style.display = 'block';
}

// Продажа скина
function sellSkin(skin) {
    const userId = tg.initDataUnsafe?.user?.id;
    
    if (confirm(`Вы уверены, что хотите продать "${skin.name}" за ${skin.value.toLocaleString()} монет?`)) {
        let inventory = JSON.parse(localStorage.getItem(`inventory_${userId}`) || '[]');
        const skinIndex = inventory.findIndex(s => s.id === skin.id);
        if (skinIndex !== -1) {
            inventory[skinIndex].status = 'sold';
            localStorage.setItem(`inventory_${userId}`, JSON.stringify(inventory));
        }
        
        addCoins(skin.value);
        
        document.getElementById('skinModal').style.display = 'none';
        
        // Обновляем статистику
        updateInventoryStats();
        loadInventory();
        loadProfileInventory();
        
        showSafeAlert(`✅ Скин продан за ${skin.value.toLocaleString()} монет!`);
    }
}

// Открытие модального окна вывода
function openWithdrawModal(skin) {
    const modal = document.getElementById('withdrawModal');
    
    if (!modal) return;
    
    document.getElementById('withdrawSkinImage').src = skin.image;
    document.getElementById('withdrawSkinName').textContent = skin.name;
    document.getElementById('withdrawSkinValue').textContent = skin.value.toLocaleString();
    
    document.getElementById('confirmWithdrawBtn').onclick = () => confirmWithdraw(skin);
    document.getElementById('cancelWithdrawBtn').onclick = () => modal.style.display = 'none';
    
    document.getElementById('tradeLink').value = '';
    
    modal.style.display = 'block';
}

// Подтверждение вывода
async function confirmWithdraw(skin) {
    const tradeLink = document.getElementById('tradeLink').value.trim();
    const tradeLinkRegex = /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[a-zA-Z0-9]+$/;
    
    if (!tradeLink) {
        showSafeAlert('❌ Введите trade ссылку!');
        return;
    }
    
    if (!tradeLinkRegex.test(tradeLink)) {
        showSafeAlert('❌ Неверный формат trade ссылки!');
        return;
    }
    
    const userId = tg.initDataUnsafe?.user?.id;
    
    try {
        // В локальной версии просто помечаем скин как выведенный
        let inventory = JSON.parse(localStorage.getItem(`inventory_${userId}`) || '[]');
        const skinIndex = inventory.findIndex(s => s.id === skin.id);
        if (skinIndex !== -1) {
            inventory[skinIndex].status = 'withdraw_pending';
            inventory[skinIndex].tradeLink = tradeLink;
            inventory[skinIndex].withdrawDate = new Date().toISOString();
            localStorage.setItem(`inventory_${userId}`, JSON.stringify(inventory));
        }
        
        document.getElementById('withdrawModal').style.display = 'none';
        document.getElementById('skinModal').style.display = 'none';
        
        // Обновляем статистику
        updateInventoryStats();
        loadInventory();
        loadProfileInventory();
        
        showSafeAlert('✅ Запрос на вывод отправлен! В локальной версии скин помечен как выводимый.');
        
    } catch (error) {
        console.error('Ошибка вывода:', error);
        showSafeAlert('❌ Ошибка при отправке запроса на вывод');
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
