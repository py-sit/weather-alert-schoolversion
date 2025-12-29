// Function to initialize sidebar toggle functionality
function initializeSidebar() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebarToggle && sidebar) {
      // 修复移动端点击按钮无法打开侧边栏的问题
      sidebarToggle.addEventListener('click', function(e) {
        e.stopPropagation(); // 阻止事件冒泡，防止立即触发document的点击事件
        sidebar.classList.toggle('open');
      });
      
      // 处理移动端侧边栏外区域点击关闭侧边栏的逻辑
      document.addEventListener('click', function(e) {
        // 检查是否为移动端尺寸
        const isSmallScreen = window.innerWidth < 768;
        
        // 确保点击的不是侧边栏本身和侧边栏切换按钮
        const clickedOutsideSidebar = !sidebar.contains(e.target) && !sidebarToggle.contains(e.target);
        
        // 只有在移动端、侧边栏打开且点击在侧边栏外部时关闭侧边栏
        if (isSmallScreen && clickedOutsideSidebar && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
        }
      });
      
      // 添加滑动手势支持
      let touchStartX = 0;
      let touchEndX = 0;
      
      // 监听触摸开始事件
      document.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });
      
      // 监听触摸结束事件
      document.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
      }, { passive: true });
      
      // 处理滑动手势
      function handleSwipeGesture() {
        const swipeDistance = touchEndX - touchStartX;
        const isSmallScreen = window.innerWidth < 768;
        
        // 只在移动端处理滑动手势
        if (isSmallScreen) {
          // 从左向右滑动，打开侧边栏（滑动距离大于50像素）
          if (swipeDistance > 50 && !sidebar.classList.contains('open')) {
            sidebar.classList.add('open');
          }
          
          // 从右向左滑动，关闭侧边栏（滑动距离小于-50像素）
          else if (swipeDistance < -50 && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
          }
        }
      }
      
      // 监听窗口大小变化
      window.addEventListener('resize', function() {
        // 当从移动端尺寸变为桌面尺寸时，移除open类
        if (window.innerWidth >= 768 && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
        }
      });
    }
  }
  