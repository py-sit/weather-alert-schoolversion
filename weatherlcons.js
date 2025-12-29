// Weather icons mapping based on weather condition
const weatherIcons = {
    sunny: `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#FF9500" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"></circle>
        <path d="M12 2v2"></path>
        <path d="M12 20v2"></path>
        <path d="m4.93 4.93 1.41 1.41"></path>
        <path d="m17.66 17.66 1.41 1.41"></path>
        <path d="M2 12h2"></path>
        <path d="M20 12h2"></path>
        <path d="m6.34 17.66-1.41 1.41"></path>
        <path d="m19.07 4.93-1.41 1.41"></path>
      </svg>
    `,
    
    cloudy: `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#8AACC8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
      </svg>
    `,
    
    rainy: `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
        <path d="M16 14v6"></path>
        <path d="M8 14v6"></path>
        <path d="M12 16v6"></path>
      </svg>
    `,
    
    thunderstorm: `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#5856D6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"></path>
        <path d="m13 12-3 5h4l-3 5"></path>
      </svg>
    `,
    
    snowy: `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#B0BEC5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
        <path d="M8 15h.01"></path>
        <path d="M8 19h.01"></path>
        <path d="M12 17h.01"></path>
        <path d="M12 21h.01"></path>
        <path d="M16 15h.01"></path>
        <path d="M16 19h.01"></path>
      </svg>
    `,
    
    foggy: `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9E9E9E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
        <path d="M16 17H7"></path>
        <path d="M17 21H9"></path>
      </svg>
    `,
    
    windy: `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#90A4AE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 14.09A1.09 1.09, 0 1 0 7.9 13h9.98a1.09 1.09 0 1 1-.07 2.18h-7.96"></path>
        <path d="M9 17.09A1.09 1.09, 0 1 0 7.9 16h9.98a1.09 1.09 0 1 1-.07 2.18h-7.96"></path>
        <path d="M9 10.09A1.09 1.09, 0 1 0 7.9 9h9.98a1.09 1.09 0 1 1-.07 2.18h-7.96"></path>
        <path d="M13 6.09A1.09 1.09, 0 1 0 11.9 5H16.5c1 0 1.5 1 1.5 2"></path>
      </svg>
    `,
    
    typhoon: `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#E53935" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 4H3"></path>
        <path d="M18 8H6"></path>
        <path d="M19 12H9"></path>
        <path d="M16 16h-6"></path>
        <path d="M11 20H9"></path>
      </svg>
    `,
    
    partlyCloudy: `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#FF9500" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 2a6 6 0 1 0 6 10"></path>
        <path d="M8 16v-2"></path>
        <path d="M8.4 10.5 5.7 7.8"></path>
        <path d="M2 8h2"></path>
        <path d="M14.06 8.5a4.28 4.28 0 0 0-3.36 1.68c-.88.97-1.15 2.25-1.2 3.3-.09 1.53.49 3.04 1.64 4.14a5.5 5.5 0 0 0 7.72 0c1.14-1.1 1.73-2.61 1.64-4.15-.06-1.04-.32-2.32-1.2-3.29a4.28 4.28 0 0 0-5.24-1.68Z"></path>
      </svg>
    `,
    
    hot: `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a7 7 0 0 0-7 7c0 2.1.9 4.2 2.3 5.7L12 19l4.7-4.3a7.9 7.9 0 0 0 2.3-5.7 7 7 0 0 0-7-7Z"></path>
      </svg>
    `
  };
  
  // Function to get weather icon based on weather condition
  function getWeatherIcon(condition) {
    return weatherIcons[condition] || weatherIcons.sunny;
  }
  