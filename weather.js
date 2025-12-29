// 天气数据模块 - 管理和展示各地区的天气信息

// 这里将重建天气数据和展示功能

// 初始化天气模块
function initWeather() {
  // 初始化界面
  setupWeatherSearchUI();
  // 清空天气卡片区域
  document.getElementById('weather-cards').innerHTML = '';

  // 添加搜索按钮事件监听器
  document.getElementById('weather-search-btn').addEventListener('click', function() {
    searchWeather();
  });

  // 添加刷新按钮事件监听器
  document.getElementById('weather-refresh-btn').addEventListener('click', function() {
    refreshWeatherCache();
  });

  // 添加搜索框回车事件监听
  document.getElementById('weather-search-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      searchWeather();
    }
  });

  // 加载收藏的城市天气
  loadFavoriteCities();
}

// 设置天气搜索界面
function setupWeatherSearchUI() {
  const weatherTab = document.getElementById('weather');
  if (!weatherTab) return;

  // 创建搜索界面HTML
  const searchUI = `
    <div class="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div class="flex items-center w-full">
        <div class="relative flex-1 md:w-64">
          <input type="text" id="weather-search-input" placeholder="输入城市名称..." class="w-full pl-10 pr-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <div class="absolute left-3 top-2.5 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
          </div>
        </div>
        <button id="weather-search-btn" class="ml-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
          搜索
        </button>
        <button id="weather-refresh-btn" class="ml-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
          刷新缓存
        </button>
      </div>
    </div>

    <div id="weather-loading" class="hidden flex justify-center items-center py-20">
      <svg class="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span class="text-gray-500 text-lg">加载中...</span>
    </div>

    <div id="weather-error" class="hidden bg-red-50 text-red-800 p-4 rounded-lg mb-6">
      <div class="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span id="weather-error-message">无法获取天气数据，请检查网络连接或城市名称。</span>
      </div>
    </div>

    <div id="weather-cards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- 天气卡片将在这里动态生成 -->
    </div>
  `;

  // 将搜索界面插入到天气标签页中
  weatherTab.innerHTML = searchUI;
}

// 搜索天气函数
function searchWeather() {
  const searchInput = document.getElementById('weather-search-input');
  const city = searchInput.value.trim();
  
  if (!city) {
    showError('请输入城市名称');
    return;
  }
  
  // 显示加载中状态
  showLoading(true);
  hideError();
  
  // 调用API获取天气数据
  fetch(`/api/weather/search?city=${encodeURIComponent(city)}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('网络响应错误');
      }
      return response.json();
    })
    .then(data => {
      if (data.code === '200') {
        // 处理并显示天气数据
        displayWeatherData(data);
        showLoading(false);
      } else {
        showError(`查询失败: ${data.message || '未知错误'}`);
        showLoading(false);
      }
    })
    .catch(error => {
      console.error('获取天气数据错误:', error);
      showError('无法获取天气数据，请检查网络连接或城市名称');
      showLoading(false);
    });
}

// 加载默认天气数据
function loadWeatherData() {
  // 显示加载中状态
  showLoading(true);
  
  // 加载默认城市天气数据
  fetch('/api/weather/default')
    .then(response => {
      if (!response.ok) {
        throw new Error('网络响应错误');
      }
      return response.json();
    })
    .then(data => {
      if (data.code === '200') {
        // 处理并显示天气数据
        displayWeatherData(data);
      } else {
        showError(`加载失败: ${data.message || '未知错误'}`);
      }
      showLoading(false);
    })
    .catch(error => {
      console.error('加载默认天气数据错误:', error);
      showError('无法加载默认天气数据，请检查网络连接');
      showLoading(false);
    });
}

// 加载我的城市
function loadMyCities() {
  showLoading(true);
  hideError();
  
  fetch('/api/weather/my-cities')
    .then(response => response.json())
    .then(data => {
      if (data.code === '200') {
        displayWeatherData(data);
      } else {
        showError(`加载失败: ${data.message || '未知错误'}`);
      }
      showLoading(false);
    })
    .catch(error => {
      console.error('加载我的城市错误:', error);
      showError('无法加载我的城市数据');
      showLoading(false);
    });
}

// 加载常用城市
function loadPopularCities() {
  showLoading(true);
  hideError();
  
  fetch('/api/weather/popular-cities')
    .then(response => response.json())
    .then(data => {
      if (data.code === '200') {
        displayWeatherData(data);
      } else {
        showError(`加载失败: ${data.message || '未知错误'}`);
      }
      showLoading(false);
    })
    .catch(error => {
      console.error('加载常用城市错误:', error);
      showError('无法加载常用城市数据');
      showLoading(false);
    });
}

// 显示天气数据
function displayWeatherData(data) {
  const weatherCardsContainer = document.getElementById('weather-cards');
  
  if (!weatherCardsContainer) return;
  
  // 清空现有内容
  weatherCardsContainer.innerHTML = '';
  
  // 添加缓存提示信息
  if (data.fromCache) {
    const cacheNotice = document.createElement('div');
    cacheNotice.className = 'bg-blue-50 text-blue-700 p-2 rounded-lg mb-4 text-sm';
    cacheNotice.innerHTML = `<div class="flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <span>显示的是缓存数据（更新于${new Date(data.cacheTime).toLocaleString()}）</span>
    </div>`;
    weatherCardsContainer.appendChild(cacheNotice);
  }
  
  // 处理多城市数据（我的城市/常用城市）
  if (data.cities && Array.isArray(data.cities)) {
    // 如果是城市列表，为每个城市创建卡片
    data.cities.forEach(cityData => {
      if (cityData.code === '200') {
        createWeatherCard(cityData, weatherCardsContainer, cityData.is_favorite);
      }
    });
  } else {
    // 单个城市数据
    if (data.code === '200' && data.daily) {
      createWeatherCard(data, weatherCardsContainer);
    } else {
      showError('天气数据格式不正确');
    }
  }
}

// 创建天气卡片
// 页面加载时获取并显示收藏的城市
document.addEventListener('DOMContentLoaded', function() {
  loadFavoriteCities();
});

function loadFavoriteCities() {
  showLoading(true);
  hideError();
  
  fetch('/api/weather/my-cities')
    .then(response => response.json())
    .then(data => {
      if (data.code === '200') {
        // 确保每个城市数据都标记为收藏状态
        if (data.cities && Array.isArray(data.cities)) {
          data.cities = data.cities.map(cityData => {
            return { ...cityData, is_favorite: true };
          });
        }
        displayWeatherData(data);
      } else {
        showError(`加载失败: ${data.message || '未知错误'}`);
      }
      showLoading(false);
    })
    .catch(error => {
      console.error('加载收藏城市错误:', error);
      showError('无法加载收藏城市数据');
      showLoading(false);
    });
}

async function fetchAndDisplayWeather(city, container) {
  try {
    const response = await fetch(`/api/weather/data?city=${encodeURIComponent(city)}`);
    const data = await response.json();
    if (data.success) {
      data.city = city;
      data.is_favorite = true;
      createWeatherCard(data, container, true);
    }
  } catch (error) {
    console.error(`获取${city}天气数据失败:`, error);
  }
}

function createWeatherCard(data, container, isFavorited = false) {
  // 检查数据格式
  if (!data.daily || data.daily.length === 0 || !data.hourly || data.hourly.length === 0) {
    console.error('天气数据格式不正确', data);
    return;
  }

  // 创建24小时天气趋势容器
  const hourlyContainer = document.createElement('div');
  hourlyContainer.className = 'hourly-forecast hidden';
  hourlyContainer.innerHTML = `
    <div class="border-t border-gray-100 pt-4 mt-4">
      <div class="text-xs font-medium text-gray-500 mb-2">24小时天气趋势</div>
      <div class="flex overflow-x-auto pb-2">
        ${data.hourly.map(hour => `
          <div class="flex-shrink-0 text-center px-3">
            <div class="text-xs text-gray-500">${hour.fxTime.slice(11, 16)}</div>
            <div class="my-1">${getWeatherIcon(hour.text).replace(/width="64" height="64"/, 'width="24" height="24"')}</div>
            <div class="text-xs font-medium">${hour.temp}°</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  // 创建天气卡片
  const card = document.createElement('div');
  card.className = 'weather-card bg-white rounded-lg shadow-sm overflow-hidden relative';
  
  // 添加点击事件
  card.addEventListener('click', function(e) {
    // 如果点击的是收藏按钮，不触发卡片选中效果
    if (e.target.closest('.add-to-my-cities')) return;
    
    // 移除其他卡片的选中状态和隐藏24小时天气趋势
    document.querySelectorAll('.weather-card').forEach(c => {
      if (c !== card) {
        c.classList.remove('selected');
        c.querySelector('.hourly-forecast')?.classList.add('hidden');
      }
    });
    
    // 切换当前卡片的选中状态和24小时天气趋势显示
    card.classList.toggle('selected');
    hourlyContainer.classList.toggle('hidden');
  });
  
  // 生成日预报项目的HTML
  const forecastItems = data.daily.slice(0, 3).map(item => {
    return `
      <div class="text-center px-2">
        <div class="text-xs font-medium text-gray-500">${formatDay(item.fxDate)}</div>
        <div class="my-1">${getWeatherIcon(item.textDay).replace(/width="64" height="64"/, 'width="24" height="24"')}</div>
        <div class="text-xs font-medium">${item.tempMax}° <span class="text-gray-500">${item.tempMin}°</span></div>
      </div>
    `;
  }).join('');
  
  // 获取当前时间和当前天气
  const now = new Date();
  const currentHour = data.hourly[0];
  
  // 获取风速数据，优先从daily[0]中获取，如果不存在则尝试从hourly[0]获取
  let windSpeed = "未知";
  if (data.daily && data.daily.length > 0 && data.daily[0].windSpeedDay) {
    windSpeed = data.daily[0].windSpeedDay;
  } else if (data.hourly && data.hourly.length > 0 && data.hourly[0].windSpeed) {
    windSpeed = data.hourly[0].windSpeed;
  }
  
  // 生成天气卡片的HTML结构
  card.innerHTML = `
    <div class="p-4 relative">
      <div class="flex justify-between items-start mb-4">
        <div>
          <h3 class="text-xl font-semibold text-gray-900">${data.city || '未知城市'}</h3>
          <p class="text-sm text-gray-500">今天 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}</p>
        </div>
        <button class="text-gray-400 hover:text-gray-600 add-to-my-cities ${isFavorited ? 'text-yellow-500' : ''}" data-city="${data.city}">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${isFavorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
          </svg>
        </button>
      </div>
      
      <div class="flex items-center mb-6">
        <div class="mr-4">
          ${getWeatherIcon(currentHour.text)}
        </div>
        <div>
          <div class="text-4xl font-bold">${currentHour.temp}°C</div>
          <p class="text-gray-500">${currentHour.text}</p>
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="bg-gray-50 rounded p-2">
          <div class="text-xs text-gray-500">湿度</div>
          <div class="font-medium">${currentHour.humidity}%</div>
        </div>
        <div class="bg-gray-50 rounded p-2">
          <div class="text-xs text-gray-500">风速</div>
          <div class="font-medium">${windSpeed} km/h</div>
        </div>
      </div>
      
      <div class="border-t border-gray-100 pt-4">
        <div class="text-xs font-medium text-gray-500 mb-2">3天预报</div>
        <div class="flex justify-between">
          ${forecastItems}
        </div>
      </div>
    </div>
  `;
  
  // 将24小时天气趋势容器添加到卡片中
  card.appendChild(hourlyContainer);

  // 添加到收藏事件
  const addToMyBtn = card.querySelector('.add-to-my-cities');
  if (addToMyBtn) {
    addToMyBtn.addEventListener('click', function() {
      const city = this.getAttribute('data-city');
      const isFavorite = this.classList.contains('text-yellow-500');
      if (isFavorite) {
        this.classList.remove('text-yellow-500');
        this.querySelector('svg').setAttribute('fill', 'none');
        removeFavoriteCity(city);
      } else {
        this.classList.add('text-yellow-500');
        this.querySelector('svg').setAttribute('fill', 'currentColor');
        addToCityFavorites(city);
      }
    });
  }
  
  // 将生成的卡片添加到容器中
  container.appendChild(card);
}

// 创建小时预报
function createHourlyForecast(data, container) {
  // 检查数据格式
  if (!data.hourly || data.hourly.length === 0) {
    console.error('小时预报数据格式不正确', data);
    return;
  }
  
  // 生成24小时天气预报
  data.hourly.forEach(hour => {
    const hourItem = document.createElement('div');
    hourItem.className = 'text-center min-w-[70px]';
    
    const hourTime = new Date(hour.fxTime);
    const hourDisplay = hourTime.getHours() + ':00';
    
    hourItem.innerHTML = `
      <div class="text-xs font-medium text-gray-500">${hourDisplay}</div>
      <div class="my-2">${getWeatherIcon(hour.text, '32')}</div>
      <div class="text-sm font-medium">${hour.temp}°</div>
      <div class="text-xs text-gray-500">${hour.windDir}</div>
    `;
    
    container.appendChild(hourItem);
  });
}

// 添加城市到收藏
async function addToCityFavorites(city) {
  try {
    const response = await fetch('/api/weather/add-favorite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ city }),
    });
    const data = await response.json();
    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: '添加成功',
        text: '已添加到我的城市',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: '添加失败',
        text: '添加失败: ' + (data.message || '未知错误'),
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    }
  } catch (error) {
    console.error('添加城市到收藏错误:', error);
    Swal.fire({
      icon: 'error',
      title: '添加失败',
      text: '添加失败，请稍后再试',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  }
}

// 从收藏中移除城市
async function removeFavoriteCity(city) {
  try {
    const response = await fetch('/api/weather/remove-favorite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ city }),
    });
    const data = await response.json();
    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: '移除成功',
        text: '已从我的城市移除',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: '移除失败',
        text: '移除失败: ' + (data.message || '未知错误'),
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    }
  } catch (error) {
    console.error('移除城市收藏错误:', error);
    Swal.fire({
      icon: 'error',
      title: '移除失败',
      text: '移除失败，请稍后再试',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  }
}

// 辅助函数：日期格式化
function formatDay(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  
  today.setHours(0, 0, 0, 0);
  
  if (date.getTime() === today.getTime()) {
    return '今天';
  } else if (date.getTime() === today.getTime() + 86400000) {
    return '明天';
  } else if (date.getTime() === today.getTime() + 172800000) {
    return '后天';
  } else {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}

// 显示/隐藏加载状态
function showLoading(show) {
  const loading = document.getElementById('weather-loading');
  if (loading) {
    loading.classList.toggle('hidden', !show);
  }
}

// 显示错误消息
function showError(message) {
  const errorContainer = document.getElementById('weather-error');
  const errorMessage = document.getElementById('weather-error-message');
  
  if (errorContainer && errorMessage) {
    errorMessage.textContent = message;
    errorContainer.classList.remove('hidden');
  }
}

// 隐藏错误消息
function hideError() {
  const errorContainer = document.getElementById('weather-error');
  if (errorContainer) {
    errorContainer.classList.add('hidden');
  }
}

// 获取天气图标
function getWeatherIcon(condition, size = '64') {
  // 简化版天气图标映射
  const iconMap = {
    '晴': '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-yellow-500"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>',
    '多云': '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>',
    '阴': '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>',
    '雨': '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M16 14v6"></path><path d="M8 14v6"></path><path d="M12 16v6"></path></svg>',
    '雪': '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-300"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M8 15h.01"></path><path d="M8 19h.01"></path><path d="M12 17h.01"></path><path d="M12 21h.01"></path><path d="M16 15h.01"></path><path d="M16 19h.01"></path></svg>',
    '雾': '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><path d="M3 7h3"></path><path d="M10 7h3"></path><path d="M17 7h4"></path><path d="M8 12h2"></path><path d="M14 12h2"></path><path d="M20 12h1"></path><path d="M3 12h3"></path><path d="M3 17h4"></path><path d="M11 17h2"></path><path d="M17 17h4"></path></svg>',
    '暴雨': '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M16 14v6"></path><path d="M8 14v6"></path><path d="M12 16v6"></path></svg>',
    '雷阵雨': '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-yellow-600"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M13 12.5V17"></path><path d="m11 15.5 4 1.5-1.5 4"></path></svg>'
  };
  
  // 如果找不到匹配的图标，返回默认图标
  return iconMap[condition] || iconMap['多云'];
}

// 添加一个风速单位转换函数
function convertWindSpeed(speed) {
    // 将公里每小时转换为米每秒
    return (speed * 1000 / 3600).toFixed(1);
}

// 添加刷新缓存的函数
function refreshWeatherCache() {
  showLoading(true);
  hideError();
  
  fetch('/api/weather/refresh-cache')
    .then(response => response.json())
    .then(data => {
      if (data.code === '200') {
        // 刷新成功后重新加载收藏城市
        loadFavoriteCities();
        Swal.fire({
          icon: 'success',
          title: '更新成功',
          text: '天气数据已更新',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      } else {
        showError(`刷新失败: ${data.message || '未知错误'}`);
        showLoading(false);
      }
    })
    .catch(error => {
      console.error('刷新天气缓存错误:', error);
      showError('无法刷新天气数据，请检查网络连接');
      showLoading(false);
    });
}

// 导出函数，使其可以被其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initWeather };
}

// 天气数据示例
const weatherData = [
    {
      id: 1,
      city: '北京',           // 城市名称
      temperature: 28,        // 当前温度
      condition: 'sunny',     // 天气状况
      humidity: 45,          // 湿度
      windSpeed: 3.2,        // 风速
      rainProbability: 10,   // 降雨概率
      forecast: [            // 未来天气预报
        { day: '今天', high: 28, low: 18, condition: 'sunny' },
        { day: '明天', high: 30, low: 20, condition: 'partlyCloudy' },
        { day: '后天', high: 26, low: 17, condition: 'rainy' }
      ]
    },
    {
      id: 2,
      city: '上海',
      temperature: 26,
      condition: 'rainy',
      humidity: 80,
      windSpeed: 5.4,
      rainProbability: 90,
      forecast: [
        { day: '今天', high: 26, low: 20, condition: 'rainy' },
        { day: '明天', high: 27, low: 21, condition: 'rainy' },
        { day: '后天', high: 29, low: 22, condition: 'cloudy' }
      ]
    },
    {
      id: 3,
      city: '广州',
      temperature: 32,
      condition: 'hot',
      humidity: 65,
      windSpeed: 2.1,
      rainProbability: 20,
      forecast: [
        { day: '今天', high: 32, low: 24, condition: 'hot' },
        { day: '明天', high: 33, low: 25, condition: 'hot' },
        { day: '后天', high: 34, low: 25, condition: 'partlyCloudy' }
      ]
    }
  ];
  
  // 填充天气卡片的函数
  function populateWeatherCards() {
    const weatherCardsContainer = document.getElementById('weather-cards');
    if (!weatherCardsContainer) return;
    
    // 清空现有卡片内容
    weatherCardsContainer.innerHTML = '';
    
    // 遍历天气数据，为每个城市创建天气卡片
    weatherData.forEach(data => {
      const card = document.createElement('div');
      // 设置卡片样式
      card.className = 'weather-card bg-white rounded-lg shadow-sm overflow-hidden relative';
      
      // 生成天气预报项目的HTML
      const forecastItems = data.forecast.map(item => {
        return `
          <div class="text-center px-2">
            <div class="text-xs font-medium text-gray-500">${item.day}</div>
            <div class="my-1">${getWeatherIcon(item.condition).replace(/width="64" height="64"/, 'width="24" height="24"')}</div>
            <div class="text-xs font-medium">${item.high}° <span class="text-gray-500">${item.low}°</span></div>
          </div>
        `;
      }).join('');
      
      // 生成天气卡片的HTML结构
      card.innerHTML = `
        <div class="p-4 relative">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="text-xl font-semibold text-gray-900">${data.city}</h3>
              <p class="text-sm text-gray-500">今天 ${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, '0')}</p>
            </div>
            <button class="text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="19" cy="12" r="1"></circle>
                <circle cx="5" cy="12" r="1"></circle>
              </svg>
            </button>
          </div>
          
          <div class="flex items-center mb-6">
            <div class="mr-4">
              ${getWeatherIcon(data.condition)}
            </div>
            <div>
              <div class="text-4xl font-bold">${data.temperature}°C</div>
              <p class="text-gray-500">${getWeatherConditionText(data.condition)}</p>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="bg-gray-50 rounded p-2">
              <div class="text-xs text-gray-500">湿度</div>
              <div class="font-medium">${data.humidity}%</div>
            </div>
            <div class="bg-gray-50 rounded p-2">
              <div class="text-xs text-gray-500">风速</div>
              <div class="font-medium">${data.windSpeed} km/h</div>
            </div>
          </div>
          
          <div class="border-t border-gray-100 pt-4">
            <div class="text-xs font-medium text-gray-500 mb-2">3天预报</div>
            <div class="flex justify-between">
              ${forecastItems}
            </div>
          </div>
        </div>
      `;
      
      // 将生成的卡片添加到容器中
      weatherCardsContainer.appendChild(card);
    });
  }
  
  // Helper function to get text description of weather condition
  function getWeatherConditionText(condition) {
    const conditionMap = {
      sunny: '晴天',
      cloudy: '多云',
      rainy: '降雨',
      thunderstorm: '雷暴',
      snowy: '降雪',
      foggy: '雾',
      windy: '大风',
      typhoon: '台风',
      partlyCloudy: '局部多云',
      hot: '高温'
    };
    
    return conditionMap[condition] || '未知';
  }
  