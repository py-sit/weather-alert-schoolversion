// 天气颜色定义模块 - 提供统一的天气类型颜色定义

// 天气类型颜色映射对象
const weatherColors = {
  // 暴雨相关
  '暴雨': {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    rgb: {
      light: 'rgba(54, 162, 235, 0.6)',
      dark: 'rgba(54, 162, 235, 1)'
    }
  },
  '雨': {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    rgb: {
      light: 'rgba(54, 162, 235, 0.6)',
      dark: 'rgba(54, 162, 235, 1)'
    }
  },
  
  // 高温相关
  '高温': {
    bg: 'bg-red-100',
    text: 'text-red-800',
    rgb: {
      light: 'rgba(255, 99, 132, 0.6)',
      dark: 'rgba(255, 99, 132, 1)'
    }
  },
  
  // 台风相关
  '台风': {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    rgb: {
      light: 'rgba(153, 102, 255, 0.6)',
      dark: 'rgba(153, 102, 255, 1)'
    }
  },
  
  // 大雾相关
  '大雾': {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    rgb: {
      light: 'rgba(75, 192, 192, 0.6)',
      dark: 'rgba(75, 192, 192, 1)'
    }
  },
  '雾': {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    rgb: {
      light: 'rgba(75, 192, 192, 0.6)',
      dark: 'rgba(75, 192, 192, 1)'
    }
  },
  
  // 雷电相关
  '雷电': {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    rgb: {
      light: 'rgba(255, 206, 86, 0.6)',
      dark: 'rgba(255, 206, 86, 1)'
    }
  },
  '雷阵雨': {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    rgb: {
      light: 'rgba(255, 206, 86, 0.6)',
      dark: 'rgba(255, 206, 86, 1)'
    }
  },
  
  // 低温相关
  '低温': {
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    rgb: {
      light: 'rgba(102, 126, 234, 0.6)',
      dark: 'rgba(102, 126, 234, 1)'
    }
  },
  
  // 极端低温相关
  '极端低温': {
    bg: 'bg-blue-200',
    text: 'text-blue-900',
    rgb: {
      light: 'rgba(30, 64, 175, 0.6)',
      dark: 'rgba(30, 64, 175, 1)'
    }
  },
  
  // 大风相关
  '大风': {
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    rgb: {
      light: 'rgba(113, 125, 179, 0.6)',
      dark: 'rgb(65, 79, 143)'
    }
  },
  
  // 暴雪相关
  '暴雪': {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    rgb: {
      light: 'rgba(96, 165, 250, 0.6)',
      dark: 'rgba(96, 165, 250, 1)'
    }
  },
  '雪': {
    bg: 'bg-sky-100',
    text: 'text-sky-800',
    rgb: {
      light: 'rgba(14, 165, 233, 0.6)',
      dark: 'rgba(14, 165, 233, 1)'
    }
  },
  
  // 冻雨相关
  '冻雨': {
    bg: 'bg-purple-200',
    text: 'text-purple-700',
    rgb: {
      light: 'rgba(147, 51, 234, 0.6)',
      dark: 'rgba(147, 51, 234, 1)'
    }
  },
  
  // 沙尘暴相关
  '沙尘暴': {
    bg: 'bg-yellow-300',
    text: 'text-yellow-800',
    rgb: {
      light: 'rgba(148, 105, 6, 0.6)',
      dark: 'rgba(255, 206, 86, 1)'
    }
  },
  
  // 冰雹相关
  '冰雹': {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    rgb: {
      light: 'rgba(7, 45, 92, 0.6)',
      dark: 'rgb(11, 68, 138)'
    }
  },
  
  // 其他天气类型
  '其他': {
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    rgb: {
      light: 'rgba(255, 159, 64, 0.6)',
      dark: 'rgba(255, 159, 64, 1)'
    }
  }
};

// 获取天气类型的颜色类
function getWeatherTypeColors(type) {
  // 如果找到对应类型，则返回它的颜色定义
  if (weatherColors[type]) {
    return weatherColors[type];
  }
  
  // 否则返回默认的"其他"类型颜色
  return weatherColors['其他'];
}

// 导出函数和常量
window.weatherColors = weatherColors;
window.getWeatherTypeColors = getWeatherTypeColors; 