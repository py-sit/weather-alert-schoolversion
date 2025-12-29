// 天气数据工具函数
function getWeatherData() {
  return fetch('weather.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    });
}

// 获取特定地区的天气预报
function getRegionForecast(region) {
  return getWeatherData()
    .then(data => {
      if (data[region]) {
        return data[region];
      }
      throw new Error(`未找到地区 ${region} 的天气数据`);
    });
}

// 检查是否需要发送预警
function checkWeatherAlerts(weatherData, alertRules) {
  const alerts = [];
  
  Object.keys(weatherData).forEach(region => {
    const regionData = weatherData[region];
    const forecasts = regionData.forecasts;
    
    // 遍历预警规则
    alertRules.forEach(rule => {
      if (rule.status !== '活跃') return;
      
      // 检查参数型预警
      if (rule.alertType === 'parameter') {
        forecasts.forEach(forecast => {
          let shouldAlert = false;
          
          // 根据不同类型的预警检查天气数据
          if (rule.type === '高温' && parseInt(forecast.tempMax) > 30) {
            shouldAlert = true;
          } else if (rule.type === '低温' && parseInt(forecast.tempMin) < 0) {
            shouldAlert = true;
          } else if (rule.type === '大风' && parseInt(forecast.windSpeed) > 20) {
            shouldAlert = true;
          } else if (rule.type === '大雾' && parseInt(forecast.vis) < 10) {
            shouldAlert = true;
          } else if (rule.type === '暴雨' && parseFloat(forecast.precip) > 30) {
            shouldAlert = true;
          }
          
          if (shouldAlert) {
            alerts.push({
              region: region,
              date: forecast.date,
              type: rule.type,
              ruleId: rule.id,
              forecast: forecast
            });
          }
        });
      } 
      // 检查文本型预警
      else if (rule.alertType === 'text') {
        forecasts.forEach(forecast => {
          let shouldAlert = false;
          
          // 检查文本中是否包含预警关键词
          if (rule.type === '雷电' && (forecast.textDay.includes('雷') || forecast.textNight.includes('雷'))) {
            shouldAlert = true;
          } else if (rule.type === '台风' && (forecast.textDay.includes('台风') || forecast.textNight.includes('台风'))) {
            shouldAlert = true;
          } 
          // 其他文本型预警规则...
          
          if (shouldAlert) {
            alerts.push({
              region: region,
              date: forecast.date,
              type: rule.type,
              ruleId: rule.id,
              forecast: forecast
            });
          }
        });
      }
    });
  });
  
  return alerts;
} 