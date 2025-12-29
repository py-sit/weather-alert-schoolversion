// 天气图标模块 - 提供各种天气状况的SVG图标

// 根据天气状况返回对应的SVG图标
function getWeatherIcon(condition) {
  const icons = {
    // 晴天图标
    sunny: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>`,
    
    // 多云图标
    cloudy: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
    </svg>`,
    
    // 局部多云图标
    partlyCloudy: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" stroke="#9ca3af"></path>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#f59e0b"></path>
    </svg>`,
    
    // 降雨图标
    rainy: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
      <path d="M16 14v6"></path>
      <path d="M8 14v6"></path>
      <path d="M12 16v6"></path>
    </svg>`,
    
    // 雷暴图标
    thunderstorm: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" stroke="#9ca3af"></path>
      <path d="M12 13l-3 5h4l-1 3" stroke="#eab308" fill="none"></path>
    </svg>`,
    
    // 降雪图标
    snowy: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
      <path d="M8 15h.01"></path>
      <path d="M8 19h.01"></path>
      <path d="M12 17h.01"></path>
      <path d="M12 21h.01"></path>
      <path d="M16 15h.01"></path>
      <path d="M16 19h.01"></path>
    </svg>`,
    
    // 大雾图标
    foggy: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 10h18"></path>
      <path d="M3 14h18"></path>
      <path d="M3 18h18"></path>
      <path d="M3 6h18"></path>
    </svg>`,
    
    // 大风图标
    windy: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"></path>
      <path d="M9.6 4.6A2 2 0 1 1 11 8H2"></path>
      <path d="M12.6 19.4A2 2 0 1 0 14 16H2"></path>
    </svg>`,
    
    // 台风图标
    typhoon: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
      <path d="M21 3v5h-5"></path>
      <path d="M17 12a5 5 0 1 0-5 5"></path>
    </svg>`,
    
    // 高温图标
    hot: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"></path>
      <path d="M12 3v2"></path>
      <path d="M6.6 18.4l-1.4 1.4"></path>
      <path d="M20 12h-2"></path>
      <path d="M6.6 5.6l-1.4-1.4"></path>
      <path d="M20 12h-2"></path>
      <path d="M12 19v2"></path>
    </svg>`
  };
  
  // 返回对应的图标，如果没有找到则返回默认图标
  return icons[condition] || icons.cloudy;
}

// 导出函数，使其可以被其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getWeatherIcon };
}