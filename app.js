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

        // Инициализация навигации
        initNavigation();

        // Загрузка данных пользователя
        await loadUserData(user);

        // Загрузка баланса и статусов
        await loadUserBalance(user.id);
        await loadRewardStatus(user.id);
        await loadReferralStats(user.id);
        await loadSubscriptionStatus(user.id);



        console.log('📊 Данные пользователя:', user);

    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
    }
}

// Инициализация навигации
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Убираем активный класс у всех
            navItems.forEach(nav => nav.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));
            
            // Добавляем активный класс к выбранному
            item.classList.add('active');
            const tabId = item.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
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
                tg.showAlert('✅ Реферальная ссылка скопирована в буфер обмена!');
                
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
                
                tg.showAlert('✅ Реферальная ссылка скопирована!');
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
    document.getElementById('profileReferrals').textContent = data.totalReferrals || 0;
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
            bonusBtn.textContent = '🎁 Забрать +20 монет';
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
            if (result.bonusAwarded) {
                // Бонус начислен
                nameStatus.textContent = '✅ Фамилия установлена';
                nameStatus.style.color = '#28a745';
                
                // Обновляем баланс на сайте
                updateCoinsDisplay(result.newBalance);
                
                tg.showAlert('🎉 +20 монет за специальную фамилию! Теперь можете получать +5 монет каждые 3 минуты.');
                
                bonusBtn.textContent = '🔄 Забрать +5 монет';
                bonusBtn.onclick = () => claimLastNameRepeatReward();
                
            } else if (result.alreadyGotBonus) {
                // Бонус уже был получен ранее
                nameStatus.textContent = '✅ Фамилия установлена';
                nameStatus.style.color = '#28a745';
                
                tg.showAlert('✅ Вы уже получали бонус за фамилию! Теперь можете получать +5 монет каждые 3 минуты.');
                
                bonusBtn.textContent = '🔄 Забрать +5 монет';
                bonusBtn.onclick = () => claimLastNameRepeatReward();
                
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
    const bonusBtn = bonusBtns[2];
    
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
                    startLastNameTimer(180); // 3 минуты
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
    const bonusBtn = bonusBtns[2];
    
    if (!bonusBtn) return;
    
    let timeLeft = seconds;
    
    const timer = setInterval(() => {
        if (timeLeft > 0) {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            bonusBtn.textContent = `⏳ ${minutes}:${seconds.toString().padStart(2, '0')}`;
            bonusBtn.disabled = true;
            timeLeft--;
        } else {
            clearInterval(timer);
            bonusBtn.disabled = false;
            bonusBtn.textContent = '🔄 Забрать +5 монет';
        }
    }, 1000);
}

// В функции initApp добавьте загрузку статуса фамилии:
async function initApp() {
    try {
        tg.expand();
        tg.enableClosingConfirmation();
        
        const user = tg.initDataUnsafe?.user;
        
        if (!user) {
            document.body.innerHTML = '<div class="loading">Ошибка: Не удалось получить данные пользователя</div>';
            return;
        }

        // Инициализация навигации
        initNavigation();

        // Загрузка данных пользователя
        await loadUserData(user);

        // Загрузка баланса и статусов
        await loadUserBalance(user.id);
        await loadRewardStatus(user.id);
        await loadReferralStats(user.id);
        await loadSubscriptionStatus(user.id);
        await loadLastNameStatus(); // ДОБАВЬТЕ ЭТУ СТРОКУ

        console.log('📊 Данные пользователя:', user);

    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
    }
}

// ==================== СИСТЕМА ПОДПИСКИ С НАГРАДАМИ (ИСПРАВЛЕННАЯ) ====================

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

// Получение награды за подписку
async function claimSubscriptionReward() {
    const userId = tg.initDataUnsafe?.user?.id;
    const claimBtns = document.querySelectorAll('.task-button');
    const claimBtn = claimBtns[1]; // Вторая кнопка (подписка)
    
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
            // Обновляем баланс
            if (result.coinsAwarded > 0) {
                updateCoinsDisplay(result.coins);
            }
            
            // Обновляем UI подписки
            updateSubscriptionUI(result);
            
            // Показываем сообщение
            tg.showAlert(result.message);
            
            // Запускаем таймер если нужно
            if (!result.canClaim) {
                startSubscriptionTimer(userId);
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
            claimBtn.textContent = '🎁 Забрать +15 монет';
        }, 1000);
    }
}

// Обновление интерфейса подписки
function updateSubscriptionUI(data) {
    const statusElement = document.getElementById('subscriptionStatus');
    const claimBtns = document.querySelectorAll('.task-button');
    const claimBtn = claimBtns[1]; // Вторая кнопка (подписка)
    
    if (statusElement && claimBtn) {
        if (data.isSubscribed) {
            statusElement.textContent = `✅ Подписан (${data.rewardCount || 0} раз)`;
            statusElement.style.color = '#28a745';
            
            if (data.canClaim) {
                claimBtn.disabled = false;
                claimBtn.textContent = '🎁 Забрать +15 монет';
                claimBtn.onclick = () => claimSubscriptionReward();
            } else {
                claimBtn.disabled = true;
                claimBtn.textContent = '⏳ Ждите...';
                // Таймер запустится автоматически
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

// Таймер для подписки (упрощенная версия)
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
            claimBtn.textContent = '🎁 Забрать +15 монет';
            // Обновляем статус
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
            // Обновляем основной баланс монет
            updateCoinsDisplay(result.coins);
            
            // Обновляем прогресс наград
            updateRewardUI(result);
            
            // Показываем сообщение
            tg.showAlert(result.message);
            
            // Запускаем таймер если нужно
            if (!result.canClaim) {
                startRewardTimer(userId);
            }
        } else {
            tg.showAlert(`❌ Ошибка: ${result.error}`);
        }
        
        claimBtn.textContent = originalText;
        
    } catch (error) {
        console.error('Ошибка получения награды:', error);
        tg.showAlert('❌ Ошибка сети');
        claimBtn.textContent = '🎁 Забрать +10 монет';
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
            
            // Запускаем таймер если нужно
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
    
    // Обновляем прогресс
    if (dailyProgress) {
        dailyProgress.textContent = `${data.rewardCount || 0}/${data.maxRewards || 30} наград`;
    }
    
    if (rewardProgress) {
        const progressPercent = ((data.rewardCount || 0) / (data.maxRewards || 30)) * 100;
        rewardProgress.style.width = `${progressPercent}%`;
    }
    
    // Обновляем таймер и кнопку
    if (timerText && claimBtn) {
        if (data.rewardCount >= data.maxRewards) {
            timerText.textContent = '🎉 Все награды получены!';
            claimBtn.disabled = true;
            claimBtn.textContent = '✅ Завершено';
            if (rewardProgress) rewardProgress.classList.add('progress-pulse');
        } else if (data.canClaim) {
            timerText.textContent = '✅ Готово к получению!';
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Забрать +10 монет';
            if (rewardProgress) rewardProgress.classList.remove('progress-pulse');
        } else {
            timerText.textContent = `⏳ До следующей награды: ${data.timeUntilNextReward}с`;
            claimBtn.disabled = true;
            claimBtn.textContent = '⏳ Ждите...';
            if (rewardProgress) rewardProgress.classList.remove('progress-pulse');
        }
    }
    
    // Обновляем профиль
    document.getElementById('profileRewards').textContent = data.rewardCount || 0;
}

// Таймер обратного отсчета
function startRewardTimer(userId) {
    const timerText = document.getElementById('timerText');
    const claimBtn = document.getElementById('claimRewardBtn');
    
    if (!timerText || !claimBtn) return;
    
    // Запрашиваем актуальный статус для получения времени
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
                    // ИСПРАВЛЕНО: Убираем undefined
                    timerText.textContent = `⏳ До следующей награды: ${timeLeft}с`;
                    claimBtn.textContent = `⏳ ${timeLeft}с`;
                    claimBtn.disabled = true;
                    timeLeft--;
                } else {
                    clearInterval(timer);
                    timerText.textContent = '✅ Готово к получению!';
                    claimBtn.disabled = false;
                    claimBtn.textContent = '🎁 Забрать +10 монет';
                    
                    // Обновляем статус
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
        element.textContent = coins;
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

// Функция для создания заглушки аватара
function getDefaultAvatar() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iNjAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIzMCIgeT0iMzAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPgo8cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjciIHI9IjQiLz4KPC9zdmc+Cjwvc3ZnPg==';
}

// Инициализируем приложение когда страница загрузится
document.addEventListener('DOMContentLoaded', initApp);


