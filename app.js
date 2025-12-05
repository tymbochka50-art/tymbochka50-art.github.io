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
        await loadDarenSubscriptionStatus(user.id);
        await loadLastNameStatus();

        // Загрузка кейсов и инвентаря
        loadCases();
        loadInventory();
        loadProfileInventory();

        // Обновляем статистику инвентаря
        updateInventoryStats();

        // Обновляем все таймеры
        await updateAllTimers();

        console.log('📊 Данные пользователя:', user);

    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
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

// ==================== ФУНКЦИИ ДЛЯ ОБНОВЛЕНИЯ ТАЙМЕРОВ ====================

// Функция для обновления всех таймеров
async function updateAllTimers() {
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) return;

    try {
        // Таймер для ежедневного бонуса
        const dailyResponse = await fetch('https://telegram-backend-nine.vercel.app/api/next-reward-time', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                rewardType: 'daily'
            })
        });
        
        const dailyResult = await dailyResponse.json();
        if (dailyResult.success) {
            updateDailyTimer(dailyResult.timeUntilNextReward);
        }

        // Таймер для подписки на CS2DropZone
        const subResponse = await fetch('https://telegram-backend-nine.vercel.app/api/next-reward-time', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                rewardType: 'subscription'
            })
        });
        
        const subResult = await subResponse.json();
        if (subResult.success) {
            updateSubscriptionTimer(subResult.timeUntilNextReward);
        }

        // Таймер для подписки на DarenCs2
        const darenResponse = await fetch('https://telegram-backend-nine.vercel.app/api/next-reward-time', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                rewardType: 'daren_subscription'
            })
        });
        
        const darenResult = await darenResponse.json();
        if (darenResult.success) {
            updateDarenSubscriptionTimer(darenResult.timeUntilNextReward);
        }

        // Таймер для фамилии
        const nameResponse = await fetch('https://telegram-backend-nine.vercel.app/api/next-reward-time', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                rewardType: 'lastname'
            })
        });
        
        const nameResult = await nameResponse.json();
        if (nameResult.success) {
            updateLastNameTimer(nameResult.timeUntilNextReward);
        }

    } catch (error) {
        console.error('❌ Error updating timers:', error);
    }
}

// Функции для обновления таймеров
function updateDailyTimer(seconds) {
    const timerText = document.getElementById('timerText');
    const claimBtn = document.getElementById('claimRewardBtn');
    
    if (seconds > 0) {
        startTimer(seconds, timerText, claimBtn, '🎁 Забрать +50 монет');
    } else {
        timerText.textContent = '✅ Готово к получению!';
        claimBtn.disabled = false;
        claimBtn.textContent = '🎁 Забрать +50 монет';
    }
}

function updateSubscriptionTimer(seconds) {
    const claimBtns = document.querySelectorAll('.task-button');
    const claimBtn = claimBtns[1]; // Первая кнопка подписки (CS2DropZone)
    
    if (seconds > 0) {
        startTimer(seconds, null, claimBtn, '🎁 Забрать +250 монет');
    } else {
        claimBtn.disabled = false;
        claimBtn.textContent = '🎁 Забрать +250 монет';
    }
}

function updateDarenSubscriptionTimer(seconds) {
    const claimBtns = document.querySelectorAll('.task-button');
    const claimBtn = claimBtns[2]; // Вторая кнопка подписки (DarenCs2)
    
    if (seconds > 0) {
        startTimer(seconds, null, claimBtn, '🎁 Забрать +150 монет');
    } else {
        claimBtn.disabled = false;
        claimBtn.textContent = '🎁 Забрать +150 монет';
    }
}

function updateLastNameTimer(seconds) {
    const bonusBtns = document.querySelectorAll('.task-button');
    const bonusBtn = bonusBtns[3]; // Кнопка фамилии (после двух подписок)
    
    if (seconds > 0) {
        startTimer(seconds, null, bonusBtn, '🎁 Забрать +50 монет');
    } else {
        bonusBtn.disabled = false;
        bonusBtn.textContent = '🎁 Забрать +50 монет';
    }
}

// Универсальная функция таймера
function startTimer(seconds, timerElement, buttonElement, buttonText) {
    let timeLeft = seconds;
    
    buttonElement.disabled = true;
    
    const timer = setInterval(() => {
        if (timeLeft > 0) {
            const hours = Math.floor(timeLeft / 3600);
            const minutes = Math.floor((timeLeft % 3600) / 60);
            const secs = timeLeft % 60;
            
            const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            if (timerElement) {
                timerElement.textContent = `⏳ До следующей награды: ${timeString}`;
            }
            
            buttonElement.textContent = `⏳ ${timeString}`;
            timeLeft--;
        } else {
            clearInterval(timer);
            
            if (timerElement) {
                timerElement.textContent = '✅ Готово к получению!';
            }
            
            buttonElement.disabled = false;
            buttonElement.textContent = buttonText;
        }
    }, 1000);
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
    const bonusBtn = bonusBtns[3]; // Теперь 4-я кнопка (после двух подписок)
    
    if (nameStatus && bonusBtn) {
        if (data.gotInitialBonus) {
            // Первоначальный бонус уже получен
            nameStatus.textContent = '✅ Фамилия установлена';
            nameStatus.style.color = '#28a745';
            bonusBtn.textContent = '🔄 Забрать +5 монет';
            bonusBtn.onclick = () => claimLastNameRepeatReward();
            
            if (data.canClaim) {
                bonusBtn.disabled = false;
            } else {
                bonusBtn.disabled = true;
                bonusBtn.textContent = '⏳ Ждите...';
                if (data.timeUntilNextReward > 0) {
                    startLastNameTimer(data.timeUntilNextReward);
                }
            }
        } else if (data.hasCorrectLastName) {
            // Фамилия правильная, но бонус еще не получен
            nameStatus.textContent = '✅ Готово к получению';
            nameStatus.style.color = '#28a745';
            bonusBtn.disabled = false;
            bonusBtn.textContent = '🎁 Забрать +50 монет';
            bonusBtn.onclick = () => checkSpecialLastName();
        } else {
            // Неправильная фамилия
            nameStatus.textContent = '❌ Не выполнено';
            nameStatus.style.color = '#dc3545';
            bonusBtn.disabled = false;
            bonusBtn.textContent = '🔍 Проверить фамилию';
            bonusBtn.onclick = () => checkSpecialLastName();
        }
    }
}

// Проверка специальной фамилии (первоначальный бонус)
async function checkSpecialLastName() {
    const userId = tg.initDataUnsafe?.user?.id;
    const user = tg.initDataUnsafe?.user;
    const bonusBtns = document.querySelectorAll('.task-button');
    const bonusBtn = bonusBtns[3]; // Теперь 4-я кнопка
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
            if (result.bonusAwarded) {
                // Бонус начислен
                nameStatus.textContent = '✅ Фамилия установлена';
                nameStatus.style.color = '#28a745';
                
                // Обновляем баланс на сайте
                updateCoinsDisplay(result.newBalance);
                
                tg.showAlert('🎉 +50 монет за специальную фамилию!');
                
                bonusBtn.textContent = '✅ Получено';
                setTimeout(() => {
                    bonusBtn.textContent = '🎁 Забрать +50 монет';
                }, 2000);
                
            } else if (result.alreadyGotBonus) {
                // Бонус уже был получен ранее
                nameStatus.textContent = '✅ Фамилия установлена';
                nameStatus.style.color = '#28a745';
                
                tg.showAlert('✅ Вы уже получали бонус за фамилию!');
                
                bonusBtn.textContent = '✅ Получено';
                
            } else {
                // Фамилия не подходит
                nameStatus.textContent = '❌ Не выполнено';
                nameStatus.style.color = '#dc3545';
                
                let alertMessage = '❌ Фамилия не соответствует требованиям.\n\n';
                alertMessage += `Ваша фамилия: "${result.userLastName}"\n`;
                alertMessage += `Требуется: "${result.requiredName}"\n\n`;
                alertMessage += `Убедитесь, что фамилия точно совпадает, включая все символы!`;
                
                tg.showAlert(alertMessage);
                bonusBtn.textContent = originalText;
            }
        } else {
            tg.showAlert(`❌ Ошибка: ${result.error}`);
            bonusBtn.textContent = originalText;
        }
        
    } catch (error) {
        console.error('Ошибка проверки фамилии:', error);
        tg.showAlert('❌ Ошибка сети');
        bonusBtn.textContent = '🔍 Проверить фамилию';
    } finally {
        setTimeout(() => {
            bonusBtn.disabled = false;
        }, 2000);
    }
}

// Получение повторной награды за фамилию
async function claimLastNameRepeatReward() {
    const userId = tg.initDataUnsafe?.user?.id;
    const user = tg.initDataUnsafe?.user;
    const bonusBtns = document.querySelectorAll('.task-button');
    const bonusBtn = bonusBtns[3]; // Теперь 4-я кнопка
    
    if (!userId || !user) {
        tg.showAlert('❌ Не удалось определить пользователя');
        return;
    }
    
    try {
        const originalText = bonusBtn.textContent;
        bonusBtn.disabled = true;
        bonusBtn.textContent = '🔄 Получаем...';
        
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/special-lastname-reward';
        
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
        
        console.log('🔄 Lastname repeat reward result:', result);
        
        if (result.success) {
            if (result.coinsAwarded > 0) {
                // Награда начислена
                updateCoinsDisplay(result.coins);
                tg.showAlert(result.message);
                
                bonusBtn.textContent = '✅ Получено!';
                setTimeout(() => {
                    bonusBtn.textContent = '🔄 Забрать +5 монет';
                }, 2000);
                
                // Запускаем таймер
                if (!result.canClaim) {
                    startLastNameTimer(86400); // 24 часа
                }
            } else {
                // Нельзя получить награду сейчас
                tg.showAlert(result.message);
                bonusBtn.textContent = originalText;
                
                if (result.timeUntilNextReward > 0) {
                    startLastNameTimer(result.timeUntilNextReward);
                }
            }
        } else {
            tg.showAlert(`❌ Ошибка: ${result.error}`);
            bonusBtn.textContent = originalText;
        }
        
    } catch (error) {
        console.error('Ошибка получения повторной награды:', error);
        tg.showAlert('❌ Ошибка сети');
        bonusBtn.textContent = '🔄 Забрать +5 монет';
    } finally {
        setTimeout(() => {
            bonusBtn.disabled = false;
        }, 2000);
    }
}

// Таймер для повторной награды за фамилию
function startLastNameTimer(seconds) {
    const bonusBtns = document.querySelectorAll('.task-button');
    const bonusBtn = bonusBtns[3]; // Теперь 4-я кнопка
    
    if (!bonusBtn) return;
    
    let timeLeft = seconds;
    
    const timer = setInterval(() => {
        if (timeLeft > 0) {
            const hours = Math.floor(timeLeft / 3600);
            const minutes = Math.floor((timeLeft % 3600) / 60);
            const secs = timeLeft % 60;
            bonusBtn.textContent = `⏳ ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            bonusBtn.disabled = true;
            timeLeft--;
        } else {
            clearInterval(timer);
            bonusBtn.disabled = false;
            bonusBtn.textContent = '🔄 Забрать +5 монет';
        }
    }, 1000);
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

// Начало открытия кейса с проверкой баланса на сервере
async function startCaseOpening(caseData) {
    const userId = tg.initDataUnsafe?.user?.id;
    
    if (!userId) {
        tg.showAlert('❌ Не удалось определить пользователя');
        return;
    }
    
    try {
        // 1. Сначала проверяем баланс на сервере
        const checkResponse = await fetch('https://telegram-backend-nine.vercel.app/api/check-coins', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                amount: caseData.price
            })
        });
        
        const checkResult = await checkResponse.json();
        
        if (!checkResult.success) {
            tg.showAlert(`❌ Ошибка: ${checkResult.error}`);
            return;
        }
        
        if (!checkResult.hasEnough) {
            tg.showAlert(`❌ Недостаточно монет! Нужно: ${caseData.price}, у вас: ${checkResult.coins}`);
            return;
        }
        
        // 2. Списываем монеты на сервере
        const deductResponse = await fetch('https://telegram-backend-nine.vercel.app/api/deduct-coins', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                amount: caseData.price
            })
        });
        
        const deductResult = await deductResponse.json();
        
        if (!deductResult.success) {
            tg.showAlert(`❌ Ошибка при списании монет: ${deductResult.error}`);
            return;
        }
        
        // 3. Обновляем баланс на сайте
        updateCoinsDisplay(deductResult.coins);
        
        // 4. Закрываем модалку кейса
        document.getElementById('caseModal').style.display = 'none';
        
        // 5. Показываем рулетку
        showRoulette(caseData);
        
    } catch (error) {
        console.error('❌ Ошибка при открытии кейса:', error);
        tg.showAlert('❌ Ошибка сети при обработке платежа');
    }
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
    
    if (!userId || !inventoryGrid) return;
    
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

// Продажа скина
async function sellSkin(skin) {
    const userId = tg.initDataUnsafe?.user?.id;
    
    if (!confirm(`Вы уверены, что хотите продать "${skin.name}" за ${skin.value.toLocaleString()} монет?`)) {
        return;
    }
    
    try {
        // 1. Добавляем монеты на сервер
        const addResponse = await fetch('https://telegram-backend-nine.vercel.app/api/add-coins', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                amount: skin.value,
                reason: 'skin_sale'
            })
        });
        
        const addResult = await addResponse.json();
        
        if (!addResult.success) {
            tg.showAlert(`❌ Ошибка при продаже: ${addResult.error}`);
            return;
        }
        
        // 2. Обновляем инвентарь
        let inventory = JSON.parse(localStorage.getItem(`inventory_${userId}`) || '[]');
        const skinIndex = inventory.findIndex(s => s.id === skin.id);
        if (skinIndex !== -1) {
            inventory[skinIndex].status = 'sold';
            localStorage.setItem(`inventory_${userId}`, JSON.stringify(inventory));
        }
        
        // 3. Обновляем локальный баланс
        updateCoinsDisplay(addResult.coins);
        
        // 4. Закрываем модалку
        document.getElementById('skinModal').style.display = 'none';
        
        // 5. Обновляем статистику
        updateInventoryStats();
        loadInventory();
        loadProfileInventory();
        
        tg.showAlert(`✅ Скин продан за ${skin.value.toLocaleString()} монет!`);
        
    } catch (error) {
        console.error('Ошибка при продаже скина:', error);
        tg.showAlert('❌ Ошибка при продаже скина');
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

// ==================== СИСТЕМА ПОДПИСКИ НА CS2DROPSKINBOT ====================

// Загрузка статуса подписки на CS2DropZone
async function loadSubscriptionStatus(userId) {
    try {
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/subscription-status';
        
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                channel: '@CS2DropZone'
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

// Получение награды за подписку на CS2DropZone
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
                userId: userId,
                channel: '@CS2DropZone',
                rewardAmount: 250
            })
        });

        const result = await response.json();
        
        console.log('📢 Subscription reward result:', result);
        
        if (result.success) {
            if (result.coinsAwarded > 0) {
                updateCoinsDisplay(result.coins);
                tg.showAlert('🎉 +250 монет за подписку на канал!');
            }
            
            updateSubscriptionUI(result);
            
            if (!result.isSubscribed) {
                // Показываем окошко с предложением подписаться
                showSubscriptionModal('CS2DropZone');
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

// ==================== СИСТЕМА ПОДПИСКИ НА DARENCS2 ====================

// Загрузка статуса подписки на DarenCs2
async function loadDarenSubscriptionStatus(userId) {
    try {
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/subscription-status';
        
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                channel: '@DarenCs2'
            })
        });

        const result = await response.json();
        
        if (result.success) {
            updateDarenSubscriptionUI(result);
        }
    } catch (error) {
        console.error('Ошибка загрузки статуса подписки на DarenCs2:', error);
    }
}

// Получение награды за подписку на DarenCs2
async function claimDarenSubscriptionReward() {
    const userId = tg.initDataUnsafe?.user?.id;
    const claimBtns = document.querySelectorAll('.task-button');
    const claimBtn = claimBtns[2];
    
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
                userId: userId,
                channel: '@DarenCs2',
                rewardAmount: 150
            })
        });

        const result = await response.json();
        
        console.log('📢 DarenCs2 subscription reward result:', result);
        
        if (result.success) {
            if (result.coinsAwarded > 0) {
                updateCoinsDisplay(result.coins);
                tg.showAlert('🎉 +150 монет за подписку на канал DarenCs2!');
            }
            
            updateDarenSubscriptionUI(result);
            
            if (!result.isSubscribed) {
                // Показываем окошко с предложением подписаться
                showSubscriptionModal('DarenCs2');
            }
            
        } else {
            tg.showAlert(`❌ Ошибка: ${result.error}`);
        }
        
    } catch (error) {
        console.error('Ошибка получения награды за подписку на DarenCs2:', error);
        tg.showAlert('❌ Ошибка сети');
    } finally {
        setTimeout(() => {
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Забрать +150 монет';
        }, 1000);
    }
}

// Функция показа модального окна подписки
function showSubscriptionModal(channelName) {
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
                        Подпишитесь на канал ${channelName} чтобы получить ${channelName === '@CS2DropZone' ? '+250' : '+150'} монет!
                    </p>
                    <button onclick="openTelegramChannel('${channelName}')" class="modal-button primary" style="margin-bottom: 10px;">
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
function openTelegramChannel(channelName) {
    window.open(`https://t.me/${channelName.replace('@', '')}`, '_blank');
}

// Обновление интерфейса подписки на CS2DropZone
function updateSubscriptionUI(data) {
    const statusElement = document.getElementById('subscriptionStatus');
    const claimBtns = document.querySelectorAll('.task-button');
    const claimBtn = claimBtns[1];
    
    if (statusElement && claimBtn) {
        if (data.isSubscribed) {
            statusElement.textContent = `✅ Подписан на CS2DropZone (${data.rewardCount || 0} раз)`;
            statusElement.style.color = '#28a745';
            
            if (data.canClaim) {
                claimBtn.disabled = false;
                claimBtn.textContent = '🎁 Забрать +250 монет';
                claimBtn.onclick = () => claimSubscriptionReward();
            } else {
                claimBtn.disabled = true;
                claimBtn.textContent = '⏳ Ждите...';
                if (data.timeUntilNextReward > 0) {
                    startSubscriptionTimer(data.timeUntilNextReward, claimBtn);
                }
            }
        } else {
            statusElement.textContent = '❌ Не подписан на CS2DropZone';
            statusElement.style.color = '#dc3545';
            claimBtn.disabled = false;
            claimBtn.textContent = '🔍 Проверить подписку';
            claimBtn.onclick = () => checkSubscriptionOnly('@CS2DropZone');
        }
    }
}

// Обновление интерфейса подписки на DarenCs2
function updateDarenSubscriptionUI(data) {
    const statusElement = document.getElementById('darenSubscriptionStatus');
    const claimBtns = document.querySelectorAll('.task-button');
    const claimBtn = claimBtns[2];
    
    if (statusElement && claimBtn) {
        if (data.isSubscribed) {
            statusElement.textContent = `✅ Подписан на DarenCs2 (${data.rewardCount || 0} раз)`;
            statusElement.style.color = '#28a745';
            
            if (data.canClaim) {
                claimBtn.disabled = false;
                claimBtn.textContent = '🎁 Забрать +150 монет';
                claimBtn.onclick = () => claimDarenSubscriptionReward();
            } else {
                claimBtn.disabled = true;
                claimBtn.textContent = '⏳ Ждите...';
                if (data.timeUntilNextReward > 0) {
                    startSubscriptionTimer(data.timeUntilNextReward, claimBtn);
                }
            }
        } else {
            statusElement.textContent = '❌ Не подписан на DarenCs2';
            statusElement.style.color = '#dc3545';
            claimBtn.disabled = false;
            claimBtn.textContent = '🔍 Проверить подписку';
            claimBtn.onclick = () => checkSubscriptionOnly('@DarenCs2');
        }
    }
}

// Таймер для подписки
function startSubscriptionTimer(seconds, claimBtn) {
    if (!claimBtn) return;
    
    let timeLeft = seconds;
    
    const timer = setInterval(() => {
        if (timeLeft > 0) {
            const hours = Math.floor(timeLeft / 3600);
            const minutes = Math.floor((timeLeft % 3600) / 60);
            const secs = timeLeft % 60;
            claimBtn.textContent = `⏳ ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            timeLeft--;
        } else {
            clearInterval(timer);
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Забрать награду';
            if (claimBtn.onclick.toString().includes('claimSubscriptionReward')) {
                claimBtn.textContent = '🎁 Забрать +250 монет';
            } else if (claimBtn.onclick.toString().includes('claimDarenSubscriptionReward')) {
                claimBtn.textContent = '🎁 Забрать +150 монет';
            }
        }
    }, 1000);
}

// Проверка только подписки (без награды)
async function checkSubscriptionOnly(channel) {
    const userId = tg.initDataUnsafe?.user?.id;
    
    try {
        const backendUrl = 'https://telegram-backend-nine.vercel.app/api/subscription-status';
        
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                channel: channel
            })
        });

        const result = await response.json();
        
        if (result.success) {
            if (channel === '@CS2DropZone') {
                updateSubscriptionUI(result);
            } else if (channel === '@DarenCs2') {
                updateDarenSubscriptionUI(result);
            }
            
            if (result.isSubscribed) {
                tg.showAlert(`✅ Вы подписаны на канал ${channel}! Теперь можете получать награды.`);
            } else {
                tg.showAlert(`❌ Вы не подписаны на канал ${channel}`);
            }
        }
    } catch (error) {
        console.error('Ошибка проверки подписки:', error);
        tg.showAlert('❌ Ошибка сети');
    }
}

// ==================== СИСТЕМА ЕЖЕДНЕВНЫХ НАГРАД ====================

// Запрос ежедневной награды
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
                tg.showAlert('🎉 +50 монет за ежедневный бонус!');
            }
            
            updateRewardUI(result);
            
            if (!result.canClaim && result.timeUntilNextReward > 0) {
                startRewardTimer(userId);
            }
        } else {
            tg.showAlert(`❌ Ошибка: ${result.error}`);
        }
        
        claimBtn.textContent = originalText;
        
    } catch (error) {
        console.error('Ошибка получения награды:', error);
        tg.showAlert('❌ Ошибка сети');
        claimBtn.textContent = '🎁 Забрать +50 монет';
    } finally {
        setTimeout(() => {
            claimBtn.disabled = false;
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
                    const hours = Math.floor(timeLeft / 3600);
                    const minutes = Math.floor((timeLeft % 3600) / 60);
                    const seconds = timeLeft % 60;
                    timerText.textContent = `⏳ До следующей награды: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    claimBtn.textContent = `⏳ ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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

// Списание монет (только локальное обновление)
function deductCoins(amount) {
    const currentCoins = parseInt(document.getElementById('userCoins').textContent.replace(/,/g, ''));
    const newCoins = currentCoins - amount;
    updateCoinsDisplay(newCoins);
}

// Добавление монет (только локальное обновление)
function addCoins(amount) {
    const currentCoins = parseInt(document.getElementById('userCoins').textContent.replace(/,/g, ''));
    const newCoins = currentCoins + amount;
    updateCoinsDisplay(newCoins);
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

