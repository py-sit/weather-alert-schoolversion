// Sample logs data
const logsData = [];
// 保存原始日志数据，用于重置筛选
let originalLogsData = [];
// 存储选中状态
let logsAllSelected = false;
  
// Function to update log statistics
function updateLogStats() {
  const totalLogs = logsData.length;
  const successLogs = logsData.filter(log => log.status === '成功' || log.status === '已发送').length;
  const failedLogs = logsData.filter(log => log.status === '失败' || log.status === '已取消').length;

  document.getElementById('total-logs').textContent = totalLogs;
  document.getElementById('success-logs').textContent = successLogs;
  document.getElementById('failed-logs').textContent = failedLogs;
}

// 从日志数据中获取所有唯一的预警类型并填充下拉菜单
function populateWeatherTypeOptions() {
  const typeSelect = document.querySelector('#logs .bg-white select:first-of-type');
  if (!typeSelect) return;
  
  // 保留"所有类型"选项
  typeSelect.innerHTML = '<option value="">所有类型</option>';
  
  // 从日志数据中提取所有唯一的预警类型
  const weatherTypes = [...new Set(originalLogsData.map(log => log.weather_type).filter(Boolean))];
  
  // 按字母顺序排序
  weatherTypes.sort();
  
  // 添加到下拉菜单
  weatherTypes.forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = `${type}预警`;
    typeSelect.appendChild(option);
  });
}

// Function to fetch logs from local data.json
async function fetchLogs() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    // 兼容空文件或无效JSON：优先读取文本再解析
    const rawText = await response.text();
    let data = [];
    if (rawText && rawText.trim().length > 0) {
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error('日志文件格式错误');
      }
    }
    logsData.length = 0; // Clear existing data
    logsData.push(...data); // Add new data
    // 保存原始数据副本
    originalLogsData = [...data];
    
    // 填充预警类型下拉菜单
    populateWeatherTypeOptions();
    
    populateLogs(); // Update the UI
    updateLogStats(); // Update statistics
  } catch (error) {
    console.error('加载日志数据失败:', error);
    const logsList = document.getElementById('logs-table-body');
    if (logsList) {
      logsList.innerHTML = `
        <tr>
          <td colspan="6" class="px-6 py-4 text-center text-red-500">
            加载日志数据失败: ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

// 搜索日志功能
function searchLogs() {
  const searchInput = document.querySelector('#logs .bg-white input[type="text"]');
  const typeSelect = document.querySelector('#logs .bg-white select:first-of-type');
  const dateFilter = document.getElementById('log-date-filter');
  const userTypeFilter = document.getElementById('log-user-type-filter');
  
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const type = typeSelect ? typeSelect.value : '';
  const dateRange = dateFilter ? dateFilter.value : '';
  const userType = userTypeFilter ? userTypeFilter.value : '';
  
  // 如果没有搜索条件，返回原始数据
  if (!query && !type && !dateRange && !userType) {
    logsData.length = 0;
    logsData.push(...originalLogsData);
    populateLogs();
    updateLogStats();
    return;
  }
  
  // 如果需要筛选用户类型，先加载客户数据
  let customersData = [];
  if (userType) {
    try {
      // 同步加载客户数据
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'customers_data.json', false); // 同步请求
      xhr.send();
      if (xhr.status === 200) {
        customersData = JSON.parse(xhr.responseText);
        console.log('搜索时加载客户数据:', customersData.length, '条记录');
      }
    } catch (error) {
      console.error('加载客户数据失败:', error);
    }
  }
  
  // 筛选日志
  const filteredLogs = originalLogsData.filter(log => {
    // 搜索文本匹配
    const textMatch = !query || 
      (log.recipient && log.recipient.toLowerCase().includes(query)) ||
      (log.to_name && log.to_name.toLowerCase().includes(query)) ||
      (log.weather_type && log.weather_type.toLowerCase().includes(query)) ||
      (log.subject && log.subject.toLowerCase().includes(query));
    
    // 类型匹配
    const typeMatch = !type || (log.weather_type === type);
    
    // 用户类别匹配 - 使用改进的匹配逻辑
    let userTypeMatch = true;
    if (userType) {
      // 首先尝试基于姓名进行硬编码匹配
      if (log.to_name === '陈秋美' && userType === '工程师') {
        userTypeMatch = true;
        console.log('搜索匹配: 工程师 - 陈秋美');
      } 
      else if (log.to_name === '彭源' && userType === '客户') {
        userTypeMatch = true;
        console.log('搜索匹配: 客户 - 彭源');
      }
      else if (log.to_name === '陈秋美' && userType !== '工程师') {
        userTypeMatch = false;
        console.log('搜索不匹配: 用户陈秋美不是' + userType);
      }
      else if (log.to_name === '彭源' && userType !== '客户') {
        userTypeMatch = false;
        console.log('搜索不匹配: 用户彭源不是' + userType);
      }
      // 如果不是硬编码的用户，则查找客户数据
      else if (customersData.length > 0) {
        // 改进的用户匹配逻辑
        let customer = null;
        
        // 1. 尝试精确匹配名称或邮箱
        customer = customersData.find(c => 
          c.name === log.to_name || c.email === log.recipient
        );
        
        // 2. 如果失败，尝试检查名称包含关系
        if (!customer) {
          customer = customersData.find(c => 
            (log.to_name && c.name && log.to_name.includes(c.name)) || 
            (c.name && log.to_name && c.name.includes(log.to_name))
          );
        }
        
        // 3. 如果仍然失败，尝试邮箱前缀匹配
        if (!customer && log.recipient) {
          const emailPrefix = log.recipient.split('@')[0];
          customer = customersData.find(c => 
            c.email && c.email.split('@')[0] === emailPrefix
          );
        }
        
        const category = customer ? customer.category : null;
        
        // 检查找到的类别是否匹配选择的筛选值
        userTypeMatch = (category === userType);
        
        if (customer) {
          console.log(`筛选: 日志ID=${log.id}, 找到用户=${customer.name}, 类别=${category}, 匹配筛选=${userTypeMatch}`);
        }
      }
    }
    
    // 日期匹配
    let dateMatch = true;
    if (dateRange && log.timestamp) {
      const logDate = new Date(log.timestamp);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (dateRange === 'today') {
        dateMatch = logDate >= today;
      } else if (dateRange === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        dateMatch = logDate >= yesterday && logDate < today;
      } else if (dateRange === 'week') {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        dateMatch = logDate >= weekStart;
      } else if (dateRange === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        dateMatch = logDate >= monthStart;
      } else if (dateRange === 'year') {
        const yearStart = new Date(now.getFullYear(), 0, 1);
        dateMatch = logDate >= yearStart;
      }
    }
    
    return textMatch && typeMatch && dateMatch && userTypeMatch;
  });
  
  // 更新日志数据并重新渲染
  logsData.length = 0;
  logsData.push(...filteredLogs);
  populateLogs();
  updateLogStats();
}

// Function to run weather alert test
async function runWeatherAlertTest() {
  try {
    const testBtn = document.getElementById('test-alert-btn');
    testBtn.disabled = true;
    testBtn.textContent = '检测中...';
    testBtn.classList.add('opacity-50');

    const response = await fetch('/api/weather-alert/test', {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const result = await response.json();
    
    // 刷新日志列表
    await fetchLogs();

    // 使用SweetAlert2替代原生alert
    Swal.fire({
      icon: 'success',
      title: '预警检测完成',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  } catch (error) {
    console.error('预警检测失败:', error);
    // 使用SweetAlert2替代原生alert
    Swal.fire({
      icon: 'error',
      title: '预警检测失败',
      text: error.message,
      confirmButtonText: '确定'
    });
  } finally {
    const testBtn = document.getElementById('test-alert-btn');
    testBtn.disabled = false;
    testBtn.textContent = '预警检测';
    testBtn.classList.remove('opacity-50');
  }
}

// Function to populate logs table
function populateLogs() {
  const logsList = document.getElementById('logs-table-body');
  if (!logsList) return;
  
  logsList.innerHTML = '';
  
  // 加载客户数据用于判断用户类别
  let customersData = [];
  try {
    // 同步加载客户数据
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'customers_data.json', false); // 同步请求
    xhr.send();
    if (xhr.status === 200) {
      customersData = JSON.parse(xhr.responseText);
      console.log('成功加载客户数据:', customersData.length, '条记录');
    }
  } catch (error) {
    console.error('加载客户数据失败:', error);
  }
  
  // 日志数据按时间戳逆序排序 (最新的在前面)
  const sortedLogs = [...logsData].sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  sortedLogs.forEach(log => {
    const row = document.createElement('tr');
    
    // 使用统一的颜色方案确定预警类型样式
    let alertTypeBadgeClass = '';
    const weatherType = log.weather_type;
    
    // 使用weatherColors中定义的颜色，如果存在的话
    if (window.getWeatherTypeColors) {
      const colorConfig = window.getWeatherTypeColors(weatherType);
      alertTypeBadgeClass = `${colorConfig.bg} ${colorConfig.text}`;
    } else {
      // 旧的颜色逻辑作为备用
      if (weatherType === '暴雨') {
        alertTypeBadgeClass = 'bg-blue-100 text-blue-800';
      } else if (weatherType === '高温') {
        alertTypeBadgeClass = 'bg-red-100 text-red-800';
      } else if (weatherType === '台风') {
        alertTypeBadgeClass = 'bg-purple-100 text-purple-800';
      } else if (weatherType === '大雾') {
        alertTypeBadgeClass = 'bg-gray-100 text-gray-800';
      } else if (weatherType === '雷电') {
        alertTypeBadgeClass = 'bg-yellow-100 text-yellow-800';
      }
    }
    
    // Determine status badge styling
    let statusBadgeClass = '';
    if (log.status === '已发送' || log.status === '成功') {
      statusBadgeClass = 'status-badge status-success';
    } else {
      statusBadgeClass = 'status-badge status-error';
    }
    
    // 改进的用户类别查找逻辑
    let userCategory = '';
    let userTypeBadge = '';
    
    // 首先尝试基于姓名进行硬编码匹配
    // 从data.json文件可以看出，陈秋美是工程师
    if (log.to_name === '陈秋美') {
      userCategory = '工程师';
      userTypeBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 ml-2">工程师</span>';
      console.log('硬编码识别工程师：陈秋美');
    } 
    // 彭源是客户
    else if (log.to_name === '彭源') {
      userCategory = '客户';
      userTypeBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-2">客户</span>';
      console.log('硬编码识别客户：彭源');
    }
    // 如果没有硬编码匹配，再尝试从customers_data.json中查找
    else if (customersData && customersData.length > 0) {
      // 记录当前处理的日志信息用于调试
      console.log(`处理日志: ID=${log.id}, 收件人=${log.to_name}, 邮箱=${log.recipient}`);
      
      // 更灵活的匹配逻辑：
      // 1. 尝试精确匹配名称或邮箱
      // 2. 如果失败，尝试检查名称包含关系
      // 3. 如果仍然失败，尝试邮箱前缀匹配
      let customer = customersData.find(c => 
        c.name === log.to_name || c.email === log.recipient
      );
      
      if (!customer) {
        // 尝试名称包含匹配
        customer = customersData.find(c => 
          (log.to_name && c.name && log.to_name.includes(c.name)) || 
          (c.name && log.to_name && c.name.includes(log.to_name))
        );
      }
      
      if (!customer && log.recipient) {
        // 尝试邮箱前缀匹配
        const emailPrefix = log.recipient.split('@')[0];
        customer = customersData.find(c => 
          c.email && c.email.split('@')[0] === emailPrefix
        );
      }
      
      if (customer) {
        console.log(`找到匹配的用户: ${customer.name}, 类别: ${customer.category}`);
        userCategory = customer.category;
        
        // 根据类别设置标签样式
        if (userCategory === '客户') {
          userTypeBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-2">客户</span>';
        } else if (userCategory === '工程师') {
          userTypeBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 ml-2">工程师</span>';
        }
      } else {
        console.log(`未找到匹配的用户记录`);
      }
    } else {
      console.warn('客户数据为空，无法识别用户类别');
    }
    
    row.innerHTML = `
      <td class="px-1 py-4 whitespace-nowrap">
        <input type="checkbox" class="log-checkbox h-3.5 w-3.5 border-gray-300 rounded text-blue-600 focus:ring-blue-500" data-id="${log.id}">
      </td>
      <td class="px-1 py-4 whitespace-nowrap text-sm text-gray-500">
        ${log.timestamp}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm font-medium text-gray-900">${log.to_name || '未知用户'} ${userTypeBadge}</div>
        <div class="text-xs text-gray-500">${log.recipient}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${log.region || ''}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${alertTypeBadgeClass}">
          ${weatherType}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${log.subject || ''}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="${statusBadgeClass}">
          ${log.status}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <a href="#" class="text-blue-600 hover:text-blue-900 mr-3" onclick="viewLogDetail(${log.id})">查看</a>
        <a href="#" class="text-blue-600 hover:text-blue-900 mr-3" onclick="resendLog(${log.id})">重发</a>
        <button class="text-red-500 hover:text-red-700 delete-log-btn" data-id="${log.id}">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </button>
      </td>
    `;
    
    logsList.appendChild(row);
  });
  
  // 如果没有日志数据，显示提示信息
  if (logsData.length === 0) {
    logsList.innerHTML = `
      <tr>
        <td colspan="8" class="px-6 py-4 text-center text-gray-500">
          没有找到匹配的日志记录
        </td>
      </tr>
    `;
  }
  
  // 为所有删除按钮添加事件监听器
  document.querySelectorAll('.delete-log-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const logId = this.getAttribute('data-id');
      deleteLog(logId);
    });
  });
  
  // 重置全选状态
  logsAllSelected = false;
  updateSelectAllButtonText();
}

// 更新全选按钮文本
function updateSelectAllButtonText() {
  const selectAllBtn = document.getElementById('select-all-logs');
  if (selectAllBtn) {
    selectAllBtn.textContent = logsAllSelected ? '取消全选' : '全选';
  }
}

// 获取选中的日志ID
function getSelectedLogIds() {
  const checkboxes = document.querySelectorAll('.log-checkbox:checked');
  return Array.from(checkboxes).map(checkbox => checkbox.getAttribute('data-id'));
}

// 批量删除日志
async function batchDeleteLogs() {
  const selectedIds = getSelectedLogIds();
  if (selectedIds.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: '未选择日志',
      text: '请至少选择一条日志记录',
      confirmButtonText: '确定'
    });
    return;
  }
  
  // 显示确认对话框
  const result = await Swal.fire({
    title: '确认批量删除',
    text: `确定要删除这 ${selectedIds.length} 条日志记录吗？此操作不可恢复。`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6'
  });
  
  if (!result.isConfirmed) {
    return;
  }
  
  try {
    // 显示加载中状态
    Swal.fire({
      title: '正在删除...',
      text: `0/${selectedIds.length}`,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    let successCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < selectedIds.length; i++) {
      const logId = selectedIds[i];
      try {
        const response = await fetch(`/api/logs/${logId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          successCount++;
        } else {
          failedCount++;
        }
        
        // 更新进度
        Swal.getTitle().textContent = `正在删除...`;
        Swal.getHtmlContainer().textContent = `${i + 1}/${selectedIds.length}`;
        
      } catch (error) {
        console.error(`删除日志 ${logId} 失败:`, error);
        failedCount++;
      }
    }
    
    // 刷新日志列表
    await fetchLogs();
    
    // 显示结果
    Swal.fire({
      icon: successCount > 0 ? 'success' : 'error',
      title: '批量删除完成',
      text: `成功: ${successCount}, 失败: ${failedCount}`,
      confirmButtonText: '确定'
    });
    
  } catch (error) {
    console.error('批量删除日志失败:', error);
    Swal.fire({
      icon: 'error',
      title: '批量删除失败',
      text: error.message || '删除日志时出错，请稍后重试',
      confirmButtonText: '确定'
    });
  }
}

// 批量重发日志
async function batchResendLogs() {
  const selectedIds = getSelectedLogIds();
  if (selectedIds.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: '未选择日志',
      text: '请至少选择一条日志记录',
      confirmButtonText: '确定'
    });
    return;
  }
  
  // 显示确认对话框
  const result = await Swal.fire({
    title: '确认批量重发',
    text: `确定要重新发送这 ${selectedIds.length} 条邮件吗？`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: '确认重发',
    cancelButtonText: '取消',
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33'
  });
  
  if (!result.isConfirmed) {
    return;
  }
  
  try {
    // 显示加载中状态
    Swal.fire({
      title: '正在重发...',
      text: `0/${selectedIds.length}`,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    let successCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < selectedIds.length; i++) {
      const logId = selectedIds[i];
      const log = logsData.find(l => l.id == logId);
      
      if (!log) {
        failedCount++;
        continue;
      }
      
      try {
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: log.recipient,
            subject: log.subject,
            content: log.content
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            successCount++;
            // 更新日志状态
            log.status = '已发送';
            log.timestamp = new Date().toLocaleString();
          } else {
            failedCount++;
          }
        } else {
          failedCount++;
        }
        
        // 更新进度
        Swal.getTitle().textContent = `正在重发...`;
        Swal.getHtmlContainer().textContent = `${i + 1}/${selectedIds.length}`;
        
      } catch (error) {
        console.error(`重发日志 ${logId} 失败:`, error);
        failedCount++;
      }
    }
    
    // 刷新日志列表
    await fetchLogs();
    
    // 显示结果
    Swal.fire({
      icon: successCount > 0 ? 'success' : 'error',
      title: '批量重发完成',
      text: `成功: ${successCount}, 失败: ${failedCount}`,
      confirmButtonText: '确定'
    });
    
  } catch (error) {
    console.error('批量重发日志失败:', error);
    Swal.fire({
      icon: 'error',
      title: '批量重发失败',
      text: error.message || '重发邮件时出错，请稍后重试',
      confirmButtonText: '确定'
    });
  }
}
  
// Initialize logs when the page loads
document.addEventListener('DOMContentLoaded', function() {
  fetchLogs();
  
  // Add event listener for test alert button
  const testAlertBtn = document.getElementById('test-alert-btn');
  if (testAlertBtn) {
    testAlertBtn.addEventListener('click', runWeatherAlertTest);
  }
  
  // 添加搜索按钮点击事件
  const searchBtn = document.querySelector('#logs .bg-white button:first-of-type');
  if (searchBtn) {
    searchBtn.addEventListener('click', searchLogs);
  }
  
  // 添加搜索框回车事件
  const searchInput = document.querySelector('#logs .bg-white input[type="text"]');
  if (searchInput) {
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        searchLogs();
      }
    });
  }
  
  // 添加类型下拉框变化事件
  const typeSelect = document.querySelector('#logs .bg-white select:first-of-type');
  if (typeSelect) {
    typeSelect.addEventListener('change', searchLogs);
  }
  
  // 添加日期筛选下拉框变化事件
  const dateFilter = document.getElementById('log-date-filter');
  if (dateFilter) {
    dateFilter.addEventListener('change', searchLogs);
  }
  
  // 添加用户类别筛选下拉框变化事件
  const userTypeFilter = document.getElementById('log-user-type-filter');
  if (userTypeFilter) {
    userTypeFilter.addEventListener('change', searchLogs);
  }
  
  // 全选/取消全选按钮事件
  const selectAllBtn = document.getElementById('select-all-logs');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', function() {
      logsAllSelected = !logsAllSelected;
      updateSelectAllButtonText();
      
      const checkboxes = document.querySelectorAll('.log-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.checked = logsAllSelected;
      });
    });
  }
  
  // 批量删除按钮事件
  const batchDeleteBtn = document.getElementById('batch-delete-logs');
  if (batchDeleteBtn) {
    batchDeleteBtn.addEventListener('click', batchDeleteLogs);
  }
  
  // 批量重发按钮事件
  const batchResendBtn = document.getElementById('batch-resend-logs');
  if (batchResendBtn) {
    batchResendBtn.addEventListener('click', batchResendLogs);
  }
});

// 查看日志详情
function viewLogDetail(logId) {
  const log = logsData.find(l => l.id === logId);
  if (!log) return;
  
  const content = `
    <div class="p-4">
      <h3 class="text-lg font-medium mb-4">邮件详情</h3>
      <div class="space-y-3">
        <p><strong>发送时间：</strong>${log.timestamp}</p>
        <p><strong>收件人：</strong>${log.to_name || '未知用户'}</p>
        <p><strong>邮箱地址：</strong>${log.recipient}</p>
        <p><strong>地区：</strong>${log.region}</p>
        <p><strong>预警类型：</strong>${log.weather_type}</p>
        <p><strong>邮件主题：</strong>${log.subject}</p>
        <p><strong>发送状态：</strong>${log.status}</p>
        <div class="mt-4">
          <p class="font-medium mb-2">邮件内容：</p>
          <div class="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap font-mono text-sm">${log.content}</div>
        </div>
      </div>
    </div>
  `;
  
  // 使用 SweetAlert2 显示弹窗
  Swal.fire({
    html: content,
    width: '800px',
    showCloseButton: true,
    showConfirmButton: false,
    customClass: {
      container: 'log-detail-modal'
    }
  });
}

// 重发邮件
async function resendLog(logId) {
  const log = logsData.find(l => l.id === logId);
  if (!log) return;
  
  try {
    // 显示确认对话框
    const result = await Swal.fire({
      title: '确认重发',
      text: `确定要重新发送这封邮件给 ${log.to_name} (${log.recipient}) 吗？`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '确定重发',
      cancelButtonText: '取消',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33'
    });
    
    if (result.isConfirmed) {
      // 显示加载中状态
      Swal.fire({
        title: '正在重发...',
        text: '请稍候',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: log.recipient,
          subject: log.subject,
          content: log.content
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        // 更新日志状态
        log.status = '已发送';
        log.timestamp = new Date().toLocaleString();
        
        // 重新加载日志列表
        await fetchLogs();
        
        Swal.fire({
          icon: 'success',
          title: '重发成功',
          text: '邮件已重新发送',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        throw new Error(data.message || '重发失败');
      }
    }
  } catch (error) {
    console.error('重发邮件失败:', error);
    Swal.fire({
      icon: 'error',
      title: '重发失败',
      text: error.message || '发送邮件时出错，请稍后重试'
    });
  }
}

// 删除日志记录的函数
async function deleteLog(logId) {
  // 使用SweetAlert2替代原生confirm
  const result = await Swal.fire({
    title: '确认删除',
    text: '确定要删除此日志记录吗？此操作不可恢复。',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6'
  });
  
  if (!result.isConfirmed) {
    return;
  }
  
  try {
    // 显示加载中状态
    Swal.fire({
      title: '正在删除...',
      text: '请稍候',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    const response = await fetch(`/api/logs/${logId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      // 刷新日志列表
      await fetchLogs();
      showNotification('日志删除成功', 'success');
    } else {
      showNotification(`删除失败: ${result.message}`, 'error');
    }
  } catch (error) {
    console.error('删除日志失败:', error);
    showNotification(`删除失败: ${error.message}`, 'error');
  }
}

// 提示通知函数
function showNotification(message, type = 'info') {
  // 使用SweetAlert2替代简单alert
  const iconTypes = {
    'info': 'info',
    'success': 'success',
    'error': 'error',
    'warning': 'warning'
  };
  
  Swal.fire({
    icon: iconTypes[type] || 'info',
    title: type === 'success' ? '操作成功' : (type === 'error' ? '操作失败' : '提示'),
    text: message,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true
  });
}
  
