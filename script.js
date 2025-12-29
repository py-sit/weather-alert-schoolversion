// 主脚本文件，负责整个应用的初始化和核心功能

// 检查用户是否已登录，未登录则重定向到登录页面
(function checkLoginStatus() {
  const isLoggedIn = sessionStorage.getItem('isLoggedIn');
  
  // 如果用户未登录，重定向到登录页面
  if (isLoggedIn !== 'true') {
    window.location.href = 'login.html';
    return;
  }
})();

// 当DOM内容加载完成后执行初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化所有组件
    initializeSidebar();      // 初始化侧边栏
    initializeTabs();         // 初始化标签页
    populateCustomers();      // 加载客户数据
    populateAlertRules();     // 加载预警规则
    populateTemplates();      // 加载消息模板
    initWeather();            // 初始化天气界面
    populateLogs();          // 加载系统日志
    initializeCharts();       // 初始化图表
    
    // 禁用雨滴动画，将在天气界面重建后重新实现
    // createRainAnimation();

    // 登出功能
    const logoutBtn = document.getElementById('logout-btn');
    
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function() {
        // 清除登录状态
        sessionStorage.removeItem('isLoggedIn');
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('userRole');
        
        // 跳转到登录页面
        window.location.href = 'login.html';
      });
    }
  });
  
  // 创建雨滴动画效果的函数
  function createRainAnimation() {
    const weatherCards = document.getElementById('weather-cards');
    if (!weatherCards) return;
    
    // 创建20个雨滴元素
    for (let i = 0; i < 20; i++) {
      const rain = document.createElement('div');
      rain.classList.add('rain-animation');
      // 随机设置雨滴的位置、大小和动画延迟
      rain.style.left = `${Math.random() * 100}%`;
      rain.style.height = `${Math.random() * 10 + 10}px`;
      rain.style.animationDelay = `${Math.random() * 2}s`;
      
      // 将雨滴添加到第一个天气卡片中
      const firstCard = weatherCards.querySelector('.weather-card');
      if (firstCard) {
        firstCard.appendChild(rain);
      }
    }
  }
  
  // 初始化图表的函数
  function initializeCharts() {
    const alertTypeCtx = document.getElementById('alertTypeChart');
    if (alertTypeCtx) {
      // 从data.json获取数据
      fetch('data.json')
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then(logsData => {
          // 统计各类型预警的数量
          const weatherTypeCountMap = {};
          logsData.forEach(log => {
            const weatherType = log.weather_type;
            if (weatherType) {
              weatherTypeCountMap[weatherType] = (weatherTypeCountMap[weatherType] || 0) + 1;
            }
          });
          
          // 准备图表数据
          const weatherLabels = Object.keys(weatherTypeCountMap);
          const weatherData = weatherLabels.map(type => weatherTypeCountMap[type]);
          
          // 准备颜色数组
          let backgroundColors = [];
          let borderColors = [];
          
          // 使用统一的颜色方案
          if (window.weatherColors) {
            weatherLabels.forEach(type => {
              if (window.weatherColors[type]) {
                backgroundColors.push(window.weatherColors[type].rgb.light);
                borderColors.push(window.weatherColors[type].rgb.dark);
              } else {
                backgroundColors.push('rgba(255, 159, 64, 0.8)');
                borderColors.push('rgba(255, 159, 64, 1)');
              }
            });
          } else {
            // 默认颜色设置
            const defaultColors = {
              '高温': ['rgba(255, 99, 132, 0.8)', 'rgba(255, 99, 132, 1)'],
              '雷电': ['rgba(255, 206, 86, 0.8)', 'rgba(255, 206, 86, 1)'],
              '低温': ['rgba(54, 162, 235, 0.8)', 'rgba(54, 162, 235, 1)'],
              '暴雨': ['rgba(75, 192, 192, 0.8)', 'rgba(75, 192, 192, 1)'],
              '大雾': ['rgba(153, 102, 255, 0.8)', 'rgba(153, 102, 255, 1)'],
              '大风': ['rgba(255, 159, 64, 0.8)', 'rgba(255, 159, 64, 1)'],
              '台风': ['rgba(199, 99, 255, 0.8)', 'rgba(199, 99, 255, 1)']
            };
            
            weatherLabels.forEach(type => {
              if (defaultColors[type]) {
                backgroundColors.push(defaultColors[type][0]);
                borderColors.push(defaultColors[type][1]);
              } else {
                backgroundColors.push('rgba(128, 128, 128, 0.8)');
                borderColors.push('rgba(128, 128, 128, 1)');
              }
            });
          }
          
          // 创建图表
          window.alertTypeChart = new Chart(alertTypeCtx, {
            type: 'doughnut',
            data: {
              labels: weatherLabels,
              datasets: [{
                label: '预警数量',
                data: weatherData,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              plugins: {
                legend: {
                  position: 'right',
                },
                title: {
                  display: true,
                  text: '预警类型分布'
                }
              }
            }
          });

          // 添加对预警类型详情的更新
          updateAlertTypeDetails(logsData);
        })
        .catch(error => {
          console.error('加载预警数据失败:', error);
        });
    }
    
    // 天气趋势图表部分已注释，将在天气界面重建后重新实现
    /*
    // 天气趋势图表（折线图）
    const weatherTrendCtx = document.getElementById('weatherTrendChart');
    if (weatherTrendCtx) {
      new Chart(weatherTrendCtx, {
        type: 'line',
        data: {
          // 时间标签
          labels: ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'],
          datasets: [
            {
              label: '温度 (°C)',  // 温度数据集
              data: [15, 14, 16, 19, 21, 23, 26, 28, 27, 25, 24, 23],
              borderColor: 'rgba(255, 99, 132, 1)',
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              yAxisID: 'y',
              tension: 0.4,
            },
            {
              label: '降水概率 (%)',
              data: [5, 10, 30, 50, 60, 80, 70, 50, 30, 20, 10, 5],
              borderColor: 'rgba(54, 162, 235, 1)',
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              yAxisID: 'y1',
              tension: 0.4,
            }
          ]
        },
        options: {
          responsive: true,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          stacked: false,
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: {
                display: true,
                text: '温度 (°C)'
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              grid: {
                drawOnChartArea: false,
              },
              title: {
                display: true,
                text: '降水概率 (%)'
              },
              min: 0,
              max: 100
            }
          }
        }
      });
    }
    */
  }
  