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

        // ПЕРВОЕ: Проверяем реферальный переход
        await checkReferralOnStart(user.id);

        // Инициализация навигации
        initNavigation();
        initModals();

        // Загрузка данных пользователя
        await loadUserData(user);

        // Загрузка баланса и статусов
        await loadUserBalance(user.id);
        await loadRewardStatus(user.id);
        await loadReferralStats(user.id);
        await loadSubscriptionStatus(user.id);
        await loadLastNameStatus();

        // Загрузка кейсов и инвентаря
        loadCases();
        loadInventory();
        loadProfileInventory();

        // Обновляем статистику инвентаря
        updateInventoryStats();

        console.log('📊 Данные пользователя:', user);

        // Обновляем таймеры
        await updateAllTimers();
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
    }
}

// Функция для обновления всех таймеров
async function updateAllTimers() {
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) return;

    try {
        // Обновляем статусы для корректного отображения таймеров
        await loadRewardStatus(userId);
        await loadSubscriptionStatus(userId);
        await loadLastNameStatus();
        
        console.log('✅ Таймеры обновлены');

    } catch (error) {
        console.error('❌ Error updating timers:', error);
    }
}

// Добавьте функцию проверки реферала при старте
async function checkReferralOnStart(userId) {
    try {
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/check-referral-on-start';
        
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
        
        console.log('🔍 Referral check on start result:', result);
        
        if (result.success && result.referralProcessed) {
            // Показываем уведомление о успешном реферале
            tg.showAlert(`🎉 Вы были приглашены другом! Владелец ссылки получил +${result.reward} монет.`);
            
            // Обновляем статистику если это владелец ссылки
            if (result.referrerId === userId.toString()) {
                await loadReferralStats(userId);
                await loadUserBalance(userId);
            }
        }
        
    } catch (error) {
        console.error('Ошибка проверки реферала при старте:', error);
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
        tg.showAlert('❌ Не удалось определить пользователя');
        return;
    }
    
    try {
        const originalText = generateBtn.textContent;
        generateBtn.disabled = true;
        generateBtn.textContent = '🔄 Генерируем...';
        
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/generate-referral';
        
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
        
        console.log('🔗 Referral generation result:', result);
        
        if (result.success) {
            // Копируем ссылку в буфер обмена
            try {
                await navigator.clipboard.writeText(result.referralLink);
                
                tg.showAlert(
                    `✅ Реферальная ссылка скопирована!\n\n` +
                    `Приглашайте друзей и получайте +500 монет за каждого!`
                );
                
                // Обновляем статистику
                updateReferralStats(result);
                
                // Визуальная обратная связь
                generateBtn.textContent = '✅ Скопировано!';
                setTimeout(() => {
                    generateBtn.textContent = originalText;
                }, 2000);
                
            } catch (error) {
                // Fallback для старых браузеров
                const tempInput = document.createElement('input');
                tempInput.value = result.referralLink;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                
                tg.showAlert(
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
            tg.showAlert(`❌ Ошибка: ${result.error}`);
            generateBtn.textContent = originalText;
        }
        
    } catch (error) {
        console.error('Ошибка генерации ссылки:', error);
        tg.showAlert('❌ Ошибка сети');
    } finally {
        setTimeout(() => {
            generateBtn.disabled = false;
        }, 2000);
    }
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
        
        if (result.success) {
            updateReferralStats(result);
        }
    } catch (error) {
        console.error('Ошибка загрузки реферальной статистики:', error);
    }
}

// ==================== СИСТЕМА ФАМИЛИИ С ПОВТОРНЫМИ НАГРАДАМИ ====================

// Загрузка статуса фамилии
async function loadLastNameStatus() {
    const userId = tg.initDataUnsafe?.user?.id;
    const user = tg.initDataUnsafe?.user;
    
    if (!userId || !user) return;
    
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
        
        if (result.success) {
            updateLastNameUI(result);
        }
    } catch (error) {
        console.error('Ошибка загрузки статуса фамилии:', error);
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
                // Используем отформатированное время из бэкенда
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

// Обновленная функция для фамилии (убрана повторная награда)
async function checkSpecialLastName() {
    const userId = tg.initDataUnsafe?.user?.id;
    const user = tg.initDataUnsafe?.user;
    const bonusBtns = document.querySelectorAll('.task-button');
    const bonusBtn = bonusBtns[2];
    const nameStatus = document.getElementById('nameStatus');
    
    if (!userId || !user) {
        tg.showAlert('❌ Не удалось получить данные пользователя');
        return;
    }
    
    try {
        const originalText = bonusBtn.textContent;
        bonusBtn.disabled = true;
        bonusBtn.textContent = '🔄 Проверяем...';
        
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/check-special-lastname';
        
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                lastName: user.last_name || '',
                firstName: user.first_name || '',
                username: user.username || ''
            })
        });

        const result = await response.json();
        
        console.log('🔍 Special lastname check result:', result);
        
        if (result.success) {
            if (result.coinsAwarded > 0) {
                updateCoinsDisplay(result.newBalance);
                tg.showAlert(result.message);
            } else {
                tg.showAlert(result.message);
            }
            
            // Обновляем UI и запускаем таймер
            await loadLastNameStatus();
            
        } else {
            tg.showAlert(`❌ Ошибка: ${result.error}`);
        }
        
    } catch (error) {
        console.error('Ошибка проверки фамилии:', error);
        tg.showAlert('❌ Ошибка сети');
    } finally {
        setTimeout(() => {
            bonusBtn.disabled = false;
        }, 1000);
    }
}

// Обновленная функция обновления UI фамилии
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
                // Используем отформатированное время из бэкенда
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
    
    document.getElementById('profileRewards').textContent = data.rewardCount || 0;
}

// Функция форматирования времени
function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ==================== СИСТЕМА КЕЙСОВ И ИНВЕНТАРЯ ====================

// Данные кейсов с обновленными названиями
const casesData = [
    {
        id: 'case1',
        name: 'BASIC CASE',
        image: 'https://raw.githubusercontent.com/tymbochka50-art/tymbochka50-art.github.io/refs/heads/main/photo_5280825340735458462_x.jpg',
        price: 500,
        color: 'light',
        items: [
            { 
                name: 'AK-47 | Redline', 
                image: 'https://assets.lis-skins.com/market_images/639_b.png',
                chance: 15,
                rarity: 'common',
                value: 8
            },
            { 
                name: 'AWP | Asiimov', 
                image: 'https://assets.lis-skins.com/market_images/13260_b.png',
                chance: 10,
                rarity: 'rare',
                value: 12
            },
            { 
                name: 'M4A1-S | Hyper Beast', 
                image: 'https://assets.lis-skins.com/market_images/30942_b.png',
                chance: 5,
                rarity: 'epic',
                value: 15
            },
            { 
                name: 'Glock-18 | Water Elemental', 
                image: 'https://assets.lis-skins.com/market_images/187408_b.png',
                chance: 30,
                rarity: 'common',
                value: 6
            },
            { 
                name: 'USP-S | Orion', 
                image: 'https://assets.lis-skins.com/market_images/187150_b.png',
                chance: 25,
                rarity: 'common',
                value: 7
            },
            { 
                name: 'Desert Eagle | Conspiracy', 
                image: 'https://assets.lis-skins.com/market_images/640_b.png',
                chance: 15,
                rarity: 'rare',
                value: 10
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
                name: 'Karambit | Doppler', 
                image: 'https://assets.lis-skins.com/market_images/99097_b.png',
                chance: 2,
                rarity: 'legendary',
                value: 25
            },
            { 
                name: 'M9 Bayonet | Tiger Tooth', 
                image: 'https://assets.lis-skins.com/market_images/99099_b.png',
                chance: 3,
                rarity: 'epic',
                value: 20
            },
            { 
                name: 'Butterfly Knife | Crimson Web', 
                image: 'https://assets.lis-skins.com/market_images/99098_b.png',
                chance: 1,
                rarity: 'legendary',
                value: 30
            },
            { 
                name: 'AK-47 | Fire Serpent', 
                image: 'https://assets.lis-skins.com/market_images/639_b.png',
                chance: 8,
                rarity: 'epic',
                value: 18
            },
            { 
                name: 'AWP | Dragon Lore', 
                image: 'https://assets.lis-skins.com/market_images/13260_b.png',
                chance: 1,
                rarity: 'legendary',
                value: 35
            },
            { 
                name: 'M4A4 | Howl', 
                image: 'https://assets.lis-skins.com/market_images/30942_b.png',
                chance: 2,
                rarity: 'legendary',
                value: 28
            },
            { 
                name: 'Sport Gloves | Hedge Maze', 
                image: 'https://assets.lis-skins.com/market_images/16512_b.png',
                chance: 3,
                rarity: 'epic',
                value: 22
            },
            { 
                name: 'Driver Gloves | Snow Leopard', 
                image: 'https://assets.lis-skins.com/market_images/16514_b.png',
                chance: 10,
                rarity: 'rare',
                value: 15
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
                name: 'StatTrak™ Karambit | Emerald', 
                image: 'https://assets.lis-skins.com/market_images/99101_b.png',
                chance: 1,
                rarity: 'legendary',
                value: 50
            },
            { 
                name: 'Souvenir AWP | Medusa', 
                image: 'https://assets.lis-skins.com/market_images/30944_b.png',
                chance: 2,
                rarity: 'legendary',
                value: 45
            },
            { 
                name: 'Sport Gloves | Pandora\'s Box', 
                image: 'https://assets.lis-skins.com/market_images/16515_b.png',
                chance: 3,
                rarity: 'epic',
                value: 35
            },
            { 
                name: 'Talon Knife | Doppler', 
                image: 'https://assets.lis-skins.com/market_images/99102_b.png',
                chance: 4,
                rarity: 'epic',
                value: 30
            },
            { 
                name: 'AWP | Gungnir', 
                image: 'https://assets.lis-skins.com/market_images/30946_b.png',
                chance: 5,
                rarity: 'epic',
                value: 28
            },
            { 
                name: 'Specialist Gloves | Emerald Web', 
                image: 'https://assets.lis-skins.com/market_images/16516_b.png',
                chance: 10,
                rarity: 'rare',
                value: 25
            },
            { 
                name: 'Bayonet | Marble Fade', 
                image: 'https://assets.lis-skins.com/market_images/99100_b.png',
                chance: 15,
                rarity: 'rare',
                value: 22
            },
            { 
                name: 'M4A1-S | Knight', 
                image: 'https://assets.lis-skins.com/market_images/30945_b.png',
                chance: 20,
                rarity: 'rare',
                value: 20
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
                name: '★ StatTrak™ Karambit | Crimson Web', 
                image: 'https://assets.lis-skins.com/market_images/99097_b.png',
                chance: 0.5,
                rarity: 'legendary',
                value: 80
            },
            { 
                name: '★ Souvenir M9 Bayonet | Gamma Doppler', 
                image: 'https://assets.lis-skins.com/market_images/99099_b.png',
                chance: 1,
                rarity: 'legendary',
                value: 70
            },
            { 
                name: '★ Sport Gloves | Vice', 
                image: 'https://assets.lis-skins.com/market_images/16512_b.png',
                chance: 2,
                rarity: 'epic',
                value: 60
            },
            { 
                name: '★ Driver Gloves | Crimson Weave', 
                image: 'https://assets.lis-skins.com/market_images/16514_b.png',
                chance: 3,
                rarity: 'epic',
                value: 55
            },
            { 
                name: '★ Specialist Gloves | Foundation', 
                image: 'https://assets.lis-skins.com/market_images/16516_b.png',
                chance: 5,
                rarity: 'epic',
                value: 50
            },
            { 
                name: '★ Butterfly Knife | Fade', 
                image: 'https://assets.lis-skins.com/market_images/99098_b.png',
                chance: 8,
                rarity: 'rare',
                value: 45
            },
            { 
                name: '★ Talon Knife | Case Hardened', 
                image: 'https://assets.lis-skins.com/market_images/99102_b.png',
                chance: 10,
                rarity: 'rare',
                value: 40
            },
            { 
                name: '★ Karambit | Ultraviolet', 
                image: 'https://assets.lis-skins.com/market_images/99101_b.png',
                chance: 15,
                rarity: 'rare',
                value: 35
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
                name: '★★ StatTrak™ Karambit | Emerald', 
                image: 'https://assets.lis-skins.com/market_images/99101_b.png',
                chance: 0.1,
                rarity: 'legendary',
                value: 100
            },
            { 
                name: '★★ Souvenir AWP | Dragon Lore', 
                image: 'https://assets.lis-skins.com/market_images/13260_b.png',
                chance: 0.2,
                rarity: 'legendary',
                value: 95
            },
            { 
                name: '★★ M4A4 | Howl (Factory New)', 
                image: 'https://assets.lis-skins.com/market_images/30942_b.png',
                chance: 0.5,
                rarity: 'legendary',
                value: 90
            },
            { 
                name: '★★ Sport Gloves | Pandora\'s Box (FN)', 
                image: 'https://assets.lis-skins.com/market_images/16515_b.png',
                chance: 1,
                rarity: 'legendary',
                value: 85
            },
            { 
                name: '★★ Butterfly Knife | Sapphire', 
                image: 'https://assets.lis-skins.com/market_images/99098_b.png',
                chance: 2,
                rarity: 'epic',
                value: 80
            },
            { 
                name: '★★ Karambit | Ruby', 
                image: 'https://assets.lis-skins.com/market_images/99097_b.png',
                chance: 3,
                rarity: 'epic',
                value: 75
            },
            { 
                name: '★★ M9 Bayonet | Black Pearl', 
                image: 'https://assets.lis-skins.com/market_images/99099_b.png',
                chance: 5,
                rarity: 'epic',
                value: 70
            },
            { 
                name: '★★ Talon Knife | Gamma Doppler', 
                image: 'https://assets.lis-skins.com/market_images/99102_b.png',
                chance: 8,
                rarity: 'rare',
                value: 65
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
    openBtn.onclick = () => startCaseOpening(caseData);
    
    modal.style.display = 'block';
}

// Начало открытия кейса
function startCaseOpening(caseData) {
    const userId = tg.initDataUnsafe?.user?.id;
    const currentCoins = parseInt(document.getElementById('userCoins').textContent.replace(/,/g, ''));
    
    if (currentCoins < caseData.price) {
        tg.showAlert('❌ Недостаточно монет для открытия кейса!');
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
    const spinningText = document.getElementById('rouletteSpinning');
    
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

// Обновленная функция сохранения скина в инвентарь
async function saveSkinToInventory(skin) {
  const userId = tg.initDataUnsafe?.user?.id;
  if (!userId) return;
  
  try {
    const response = await fetch('https://telegram-backend-nine.vercel.app/api/add-skin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        skin: {
          name: skin.name,
          image: skin.image,
          rarity: skin.rarity,
          value: skin.value
        }
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Обновляем все разделы
      updateInventoryStats();
      loadInventory();
      loadProfileInventory();
    }
  } catch (error) {
    console.error('Ошибка сохранения скина:', error);
  }
}

async function loadInventory() {
  const userId = tg.initDataUnsafe?.user?.id;
  const inventoryGrid = document.getElementById('inventoryGrid');
  const emptyInventory = document.getElementById('emptyInventory');
  
  if (!userId || !inventoryGrid) return;
  
  try {
    const response = await fetch('https://telegram-backend-nine.vercel.app/api/get-inventory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: userId })
    });
    
    const result = await response.json();
    
    if (result.success) {
      const inventory = result.inventory || [];
      
      if (inventory.length === 0) {
        inventoryGrid.style.display = 'none';
        emptyInventory.style.display = 'block';
      } else {
        inventoryGrid.style.display = 'grid';
        emptyInventory.style.display = 'none';
        
        inventoryGrid.innerHTML = '';
        inventory.forEach(skin => {
          const skinElement = document.createElement('div');
          skinElement.className = 'skin-item';
          skinElement.innerHTML = `
            <img src="${skin.skin_image}" alt="${skin.skin_name}" class="skin-image">
            <div class="skin-name">${skin.skin_name}</div>
            <div class="skin-rarity ${skin.rarity}">${getRarityText(skin.rarity)}</div>
          `;
          
          skinElement.addEventListener('click', () => openSkinModal(skin));
          inventoryGrid.appendChild(skinElement);
        });
        
        // Обновляем статистику
        updateInventoryStatsFromAPI(result.stats);
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки инвентаря:', error);
  }
}

function updateInventoryStatsFromAPI(stats) {
  const totalSkinsElements = document.querySelectorAll('#totalSkins, #totalSkinsMain');
  const totalValueElements = document.querySelectorAll('#totalValue, #totalValueMain');
  
  totalSkinsElements.forEach(element => {
    if (element) element.textContent = stats.totalSkins || 0;
  });
  
  totalValueElements.forEach(element => {
    if (element) element.textContent = (stats.totalValue || 0).toLocaleString();
  });
}

// Загрузка инвентаря в профиле
function loadProfileInventory() {
    const userId = tg.initDataUnsafe?.user?.id;
    const profileInventoryGrid = document.getElementById('profileInventoryGrid');
    const emptyProfileInventory = document.getElementById('emptyProfileInventory');
    
    if (!userId || !profileInventoryGrid) return;
    
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

async function sellSkin(skin) {
  const userId = tg.initDataUnsafe?.user?.id;
  
  if (confirm(`Вы уверены, что хотите продать "${skin.skin_name}" за ${skin.value.toLocaleString()} монет?`)) {
    try {
      const response = await fetch('https://telegram-backend-nine.vercel.app/api/sell-skin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          skinId: skin.id
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        document.getElementById('skinModal').style.display = 'none';
        
        // Обновляем баланс
        await loadUserBalance(userId);
        
        // Обновляем инвентарь
        loadInventory();
        loadProfileInventory();
        
        tg.showAlert(`✅ Скин продан за ${skin.value.toLocaleString()} монет!`);
      } else {
        tg.showAlert(`❌ Ошибка: ${result.error}`);
      }
    } catch (error) {
      console.error('Ошибка продажи скина:', error);
      tg.showAlert('❌ Ошибка сети');
    }
  }
}

// Открытие модального окна вывода
function openWithdrawModal(skin) {
    const modal = document.getElementById('withdrawModal');
    
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
        tg.showAlert('❌ Введите trade ссылку!');
        return;
    }
    
    if (!tradeLinkRegex.test(tradeLink)) {
        tg.showAlert('❌ Неверный формат trade ссылки!');
        return;
    }
    
    const userId = tg.initDataUnsafe?.user?.id;
    const user = tg.initDataUnsafe?.user;
    
    try {
        const response = await sendWithdrawRequest(user, skin, tradeLink);
        
        if (response.success) {
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
            
            tg.showAlert('✅ Запрос на вывод отправлен! Скин будет отправлен в ближайшее время.');
        } else {
            tg.showAlert(`❌ Ошибка: ${response.error}`);
        }
    } catch (error) {
        console.error('Ошибка вывода:', error);
        tg.showAlert('❌ Ошибка при отправке запроса на вывод');
    }
}

// Отправка запроса на вывод
async function sendWithdrawRequest(user, skin, tradeLink) {
    const requestData = {
        userId: user.id,
        userName: user.first_name || 'Неизвестно',
        userUsername: user.username || 'Неизвестно',
        userLanguage: user.language_code || 'ru',
        skinName: skin.name,
        skinImage: skin.image,
        skinValue: skin.value,
        skinRarity: skin.rarity,
        tradeLink: tradeLink,
        timestamp: new Date().toISOString()
    };
    
    try {
        const response = await fetch('https://telegram-backend-nine.vercel.app/api/withdraw-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        return await response.json();
    } catch (error) {
        console.error('Ошибка отправки запроса:', error);
        return { success: false, error: 'Ошибка сети' };
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
        
        if (result.success) {
            updateSubscriptionUI(result);
        }
    } catch (error) {
        console.error('Ошибка загрузки статуса подписки:', error);
    }
}

// Обновленная функция для подписки
async function claimSubscriptionReward() {
    const userId = tg.initDataUnsafe?.user?.id;
    const claimBtns = document.querySelectorAll('.task-button');
    const claimBtn = claimBtns[1];
    
    if (!userId) {
        tg.showAlert('❌ Не удалось определить пользователя');
        return;
    }
    
    try {
        const originalText = claimBtn.textContent;
        claimBtn.disabled = true;
        claimBtn.textContent = '🔄 Проверяем...';
        
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/subscription-reward';
        
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
        
        console.log('📢 Subscription reward result:', result);
        
        if (result.success) {
            if (result.coinsAwarded > 0) {
                updateCoinsDisplay(result.coins);
                tg.showAlert(result.message);
            } else {
                tg.showAlert(result.message);
            }
            
            // Обновляем UI и запускаем таймер
            await loadSubscriptionStatus(userId);
            
            if (!result.isSubscribed) {
                showSubscriptionModal();
            }
            
        } else {
            tg.showAlert(`❌ Ошибка: ${result.error}`);
        }
        
    } catch (error) {
        console.error('Ошибка получения награды за подписку:', error);
        tg.showAlert('❌ Ошибка сети');
    } finally {
        setTimeout(() => {
            claimBtn.disabled = false;
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
                    <h4 style="margin-bottom: 10px; color: #ff6b35;">Вы не подписаны на канал</h4>
                    <p style="margin-bottom: 20px; color: #ccc; font-size: 14px;">
                        Подпишитесь на канал CS2DropZone чтобы получить +250 монет!
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
                // Используем отформатированное время из бэкенда
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

// Таймер для подписки
function startSubscriptionTimer(seconds) {
    const claimBtns = document.querySelectorAll('.task-button');
    const claimBtn = claimBtns[1];
    const statusElement = document.getElementById('subscriptionStatus');
    
    if (!claimBtn || !statusElement) return;
    
    let timeLeft = seconds;
    
    const timer = setInterval(() => {
        if (timeLeft > 0) {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            claimBtn.textContent = `⏳ ${minutes}:${seconds.toString().padStart(2, '0')}`;
            timeLeft--;
        } else {
            clearInterval(timer);
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Забрать +250 монет';
            loadSubscriptionStatus(tg.initDataUnsafe?.user?.id);
        }
    }, 1000);
}

// Проверка только подписки (без награды)
async function checkSubscriptionOnly() {
    const userId = tg.initDataUnsafe?.user?.id;
    
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
        
        if (result.success) {
            updateSubscriptionUI(result);
            if (result.isSubscribed) {
                tg.showAlert('✅ Вы подписаны на канал! Теперь можете получать награды.');
            } else {
                tg.showAlert('❌ Вы не подписаны на канал @CS2DropZone');
            }
        }
    } catch (error) {
        console.error('Ошибка проверки подписки:', error);
        tg.showAlert('❌ Ошибка сети');
    }
}

// ==================== СИСТЕМА ЕЖЕДНЕВНЫХ НАГРАД ====================

async function claimDailyRewardTimer() {
    const userId = tg.initDataUnsafe?.user?.id;
    const claimBtn = document.getElementById('claimRewardBtn');
    
    if (!userId) {
        tg.showAlert('❌ Не удалось определить пользователя');
        return;
    }
    
    try {
        const originalText = claimBtn.textContent;
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
        
        console.log('🎁 Daily reward result:', result);
        
        if (result.success) {
            if (result.coinsAwarded > 0) {
                updateCoinsDisplay(result.coins);
                tg.showAlert(result.message);
            } else {
                tg.showAlert(result.message);
            }
            
            // Обновляем UI и запускаем таймер
            await loadRewardStatus(userId);
            
        } else {
            tg.showAlert(`❌ Ошибка: ${result.error}`);
        }
        
    } catch (error) {
        console.error('Ошибка получения награды:', error);
        tg.showAlert('❌ Ошибка сети');
    } finally {
        setTimeout(() => {
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Забрать +50 монет';
        }, 1000);
    }
}

// Обновленная функция для подписки
async function claimSubscriptionReward() {
    const userId = tg.initDataUnsafe?.user?.id;
    const claimBtns = document.querySelectorAll('.task-button');
    const claimBtn = claimBtns[1];
    
    if (!userId) {
        tg.showAlert('❌ Не удалось определить пользователя');
        return;
    }
    
    try {
        const originalText = claimBtn.textContent;
        claimBtn.disabled = true;
        claimBtn.textContent = '🔄 Проверяем...';
        
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/subscription-reward';
        
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
        
        console.log('📢 Subscription reward result:', result);
        
        if (result.success) {
            if (result.coinsAwarded > 0) {
                updateCoinsDisplay(result.coins);
                tg.showAlert(result.message);
            } else {
                tg.showAlert(result.message);
            }
            
            // Обновляем UI и запускаем таймер
            await loadSubscriptionStatus(userId);
            
            if (!result.isSubscribed) {
                showSubscriptionModal();
            }
            
        } else {
            tg.showAlert(`❌ Ошибка: ${result.error}`);
        }
        
    } catch (error) {
        console.error('Ошибка получения награды за подписку:', error);
        tg.showAlert('❌ Ошибка сети');
    } finally {
        setTimeout(() => {
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Забрать +250 монет';
        }, 1000);
    }
}

// Обновленная функция для фамилии
async function checkSpecialLastName() {
    const userId = tg.initDataUnsafe?.user?.id;
    const user = tg.initDataUnsafe?.user;
    const bonusBtns = document.querySelectorAll('.task-button');
    const bonusBtn = bonusBtns[2];
    
    if (!userId || !user) {
        tg.showAlert('❌ Не удалось получить данные пользователя');
        return;
    }
    
    try {
        const originalText = bonusBtn.textContent;
        bonusBtn.disabled = true;
        bonusBtn.textContent = '🔄 Проверяем...';
        
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/check-special-lastname';
        
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                lastName: user.last_name || '',
                firstName: user.first_name || '',
                username: user.username || ''
            })
        });

        const result = await response.json();
        
        console.log('🔍 Special lastname check result:', result);
        
        if (result.success) {
            if (result.coinsAwarded > 0) {
                updateCoinsDisplay(result.newBalance);
                tg.showAlert(result.message);
            } else {
                tg.showAlert(result.message);
            }
            
            // Обновляем UI и запускаем таймер
            await loadLastNameStatus();
            
        } else {
            tg.showAlert(`❌ Ошибка: ${result.error}`);
        }
        
    } catch (error) {
        console.error('Ошибка проверки фамилии:', error);
        tg.showAlert('❌ Ошибка сети');
    } finally {
        setTimeout(() => {
            bonusBtn.disabled = false;
            bonusBtn.textContent = '🎁 Забрать +50 монет';
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
        
        if (result.success) {
            updateRewardUI(result);
            
            if (!result.canClaim && result.timeUntilNextReward > 0) {
                startRewardTimer(userId);
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки статуса наград:', error);
    }
}

// Обновление интерфейса наград
function updateRewardUI(data) {
    const rewardCount = document.getElementById('rewardCount');
    const dailyProgress = document.getElementById('dailyProgress');
    const rewardProgress = document.getElementById('rewardProgress');
    const timerText = document.getElementById('timerText');
    const claimBtn = document.getElementById('claimRewardBtn');
    
    if (dailyProgress) {
        dailyProgress.textContent = `${data.rewardCount || 0}/${data.maxRewards || 30} наград`;
    }
    
    if (rewardProgress) {
        const progressPercent = ((data.rewardCount || 0) / (data.maxRewards || 30)) * 100;
        rewardProgress.style.width = `${progressPercent}%`;
    }
    
    if (timerText && claimBtn) {
        if (data.rewardCount >= data.maxRewards) {
            timerText.textContent = '🎉 Все награды получены!';
            claimBtn.disabled = true;
            claimBtn.textContent = '✅ Завершено';
            if (rewardProgress) rewardProgress.classList.add('progress-pulse');
        } else if (data.canClaim) {
            timerText.textContent = '✅ Готово к получению!';
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Забрать +50 монет';
            if (rewardProgress) rewardProgress.classList.remove('progress-pulse');
        } else {
            timerText.textContent = `⏳ До следующей награды: ${data.timeUntilNextReward}с`;
            claimBtn.disabled = true;
            claimBtn.textContent = '⏳ Ждите...';
            if (rewardProgress) rewardProgress.classList.remove('progress-pulse');
        }
    }
    
    document.getElementById('profileRewards').textContent = data.rewardCount || 0;
}

// Таймер обратного отсчета
function startRewardTimer(userId) {
    const timerText = document.getElementById('timerText');
    const claimBtn = document.getElementById('claimRewardBtn');
    
    if (!timerText || !claimBtn) return;
    
    fetch('https://telegram-backend-nine.vercel.app/api/reward-status', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            userId: userId
        })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success && !result.canClaim && result.timeUntilNextReward > 0) {
            let timeLeft = result.timeUntilNextReward;
            
            const timer = setInterval(() => {
                if (timeLeft > 0) {
                    timerText.textContent = `⏳ До следующей награды: ${timeLeft}с`;
                    claimBtn.textContent = `⏳ ${timeLeft}с`;
                    claimBtn.disabled = true;
                    timeLeft--;
                } else {
                    clearInterval(timer);
                    timerText.textContent = '✅ Готово к получению!';
                    claimBtn.disabled = false;
                    claimBtn.textContent = '🎁 Забрать +50 монет';
                    loadRewardStatus(userId);
                }
            }, 1000);
        }
    })
    .catch(error => {
        console.error('Ошибка запуска таймера:', error);
    });
}

// ==================== СИСТЕМА МОНЕТ ====================

// Обновление отображения монет
function updateCoinsDisplay(coins) {
    const coinsElements = document.querySelectorAll('#userCoins, #profileCoins');
    coinsElements.forEach(element => {
        element.textContent = coins.toLocaleString();
        element.classList.add('coin-animation');
        setTimeout(() => element.classList.remove('coin-animation'), 600);
    });
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
            updateCoinsDisplay(result.coins);
        }
    } catch (error) {
        console.error('Ошибка загрузки баланса:', error);
    }
}

// Списание монет
function deductCoins(amount) {
    const currentCoins = parseInt(document.getElementById('userCoins').textContent.replace(/,/g, ''));
    const newCoins = currentCoins - amount;
    updateCoinsDisplay(newCoins);
}

// Добавление монет
function addCoins(amount) {
    const currentCoins = parseInt(document.getElementById('userCoins').textContent.replace(/,/g, ''));
    const newCoins = currentCoins + amount;
    updateCoinsDisplay(newCoins);
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

// Обновите функцию switchToTab
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
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iNjAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIzMCIgeT0iMzAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPgo8cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjciIHI9IjQiLz4KPC9zdmc+Cjwvc3ZnPg==';
}

// Инициализируем приложение когда страница загрузится
document.addEventListener('DOMContentLoaded', initApp);





