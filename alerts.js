// 预警规则模块 - 管理系统中的各类天气预警规则

// 预警条件数据存储
let alertRulesData = [];

// 填充预警规则列表的函数
function populateAlertRules() {
  const alertRulesList = document.getElementById('alert-rules-list');
  if (!alertRulesList) return;
  
  // 清空现有列表内容
  alertRulesList.innerHTML = '';
  
  // 遍历预警规则数据，为每条规则创建表格行
  alertRulesData.forEach(rule => {
    const row = document.createElement('tr');
    
    // 根据规则状态设置状态标签样式
    let statusBadgeClass = '';
    if (rule.status === '活跃') {
      statusBadgeClass = 'bg-green-100 text-green-800';  // 活跃状态使用绿色
    } else {
      statusBadgeClass = 'bg-gray-100 text-gray-800';   // 不活跃状态使用灰色
    }
    
    // 根据预警类型设置不同的标签样式，使用统一的颜色方案
    let alertTypeBadgeClass = '';
    
    // 使用weatherColors中定义的颜色，如果存在的话
    if (window.getWeatherTypeColors) {
      const colorConfig = window.getWeatherTypeColors(rule.type);
      alertTypeBadgeClass = `${colorConfig.bg} ${colorConfig.text}`;
    } else {
      // 旧的颜色逻辑作为备用
      if (rule.type === '暴雨') {
        alertTypeBadgeClass = 'bg-blue-100 text-blue-800';      // 暴雨用蓝色
      } else if (rule.type === '高温') {
        alertTypeBadgeClass = 'bg-red-100 text-red-800';       // 高温用红色
      } else if (rule.type === '台风') {
        alertTypeBadgeClass = 'bg-purple-100 text-purple-800';  // 台风用紫色
      } else if (rule.type === '大雾') {
        alertTypeBadgeClass = 'bg-gray-100 text-gray-800';      // 大雾用灰色
      } else if (rule.type === '雷电') {
        alertTypeBadgeClass = 'bg-yellow-100 text-yellow-800';  // 雷电用黄色
      } else {
        alertTypeBadgeClass = 'bg-indigo-100 text-indigo-800';  // 其他类型用靛蓝色
      }
    }
    
    // 生成表格行HTML，包含预警类型、条件、时间和操作按钮
    row.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${alertTypeBadgeClass}">
          ${rule.type}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm text-gray-900 font-medium">${rule.condition}</div>
        <div class="text-xs text-gray-500">创建于 ${rule.createdAt}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass}">
          ${rule.status}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <a href="#" class="text-blue-600 hover:text-blue-900 mr-3 edit-alert-rule" data-id="${rule.id}">编辑</a>
        <a href="#" class="text-red-600 hover:text-red-900 delete-alert-rule" data-id="${rule.id}">删除</a>
      </td>
    `;
    
    // 将生成的行添加到表格中
    alertRulesList.appendChild(row);
    
    // 为编辑和删除按钮添加事件监听器
    const editBtn = row.querySelector('.edit-alert-rule');
    if (editBtn) {
      editBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const ruleId = parseInt(this.getAttribute('data-id'));
        openEditAlertRuleModal(ruleId);
      });
    }
    
    const deleteBtn = row.querySelector('.delete-alert-rule');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const ruleId = parseInt(this.getAttribute('data-id'));
        deleteAlertRule(ruleId);
      });
    }
  });
}

// 加载预警条件数据
function loadAlertRulesData() {
  console.log('开始加载预警条件数据...');
  
  fetch('api/alert-rules')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('成功获取预警条件数据:', data);
      alertRulesData = data;
      
      // 立即显示预警规则
      populateAlertRules();
      updateAlertStats();
    })
    .catch(error => {
      console.error('加载预警条件数据失败:', error);
      // 显示错误信息在界面上
      const alertRulesList = document.getElementById('alert-rules-list');
      if (alertRulesList) {
        alertRulesList.innerHTML = `
          <tr>
            <td colspan="5" class="px-6 py-4 text-center text-red-500">
              加载预警条件数据失败: ${error.message}
            </td>
          </tr>
        `;
      }
    });
}

// 添加一个函数检查Chart.js是否已加载
function isChartJsLoaded() {
  return typeof Chart !== 'undefined';
}

// 更新统计信息
function updateAlertStats() {
  try {
    fetch('data.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(logsData => {
        // 统计各类型的预警数量
        let totalAlerts = logsData.length;
        let activeAlerts = logsData.filter(log => log.status === '成功' || log.status === '已发送').length;
        let rainyAlerts = logsData.filter(log => log.weather_type === '暴雨').length;
        let coldAlerts = logsData.filter(log => log.weather_type === '低温').length;
        
        // 更新DOM元素
        const totalAlertsElement = document.getElementById('total-alerts');
        const activeAlertsElement = document.getElementById('active-alerts');
        const rainyAlertsElement = document.getElementById('rainy-alerts');
        const coldAlertsElement = document.getElementById('cold-alerts');
        
        if (totalAlertsElement && activeAlertsElement && rainyAlertsElement && coldAlertsElement) {
          totalAlertsElement.textContent = totalAlerts;
          activeAlertsElement.textContent = activeAlerts;
          rainyAlertsElement.textContent = rainyAlerts;
          coldAlertsElement.textContent = coldAlerts;
        } else {
          console.warn('找不到统计元素，无法更新统计信息');
        }
        
        // 仅在 Chart.js 已加载的情况下尝试更新图表
        if (isChartJsLoaded()) {
          try {
            updateAlertTypeChart(logsData);
            updateAlertTypeDetails(logsData);
          } catch (chartError) {
            console.error('更新图表失败，但不影响其他功能:', chartError);
          }
        } else {
          console.warn('Chart.js 未加载，跳过图表更新');
        }
      })
      .catch(error => {
        console.error('加载日志数据失败:', error);
      });
  } catch (error) {
    console.error('更新统计信息时出错:', error);
  }
}

// 更新预警类型分布图表
function updateAlertTypeChart(logsData) {
  const canvas = document.getElementById('alertTypeChart');
  if (!canvas) return;
  
  // 计算各类预警的数量
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
  if (window.getWeatherTypeColors) {
    weatherLabels.forEach(type => {
      const colorConfig = window.getWeatherTypeColors(type);
      // 使用rgb颜色值而不是CSS类名
      backgroundColors.push(colorConfig.rgb.light);
      borderColors.push(colorConfig.rgb.dark);
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
  
  // 检查是否已有图表实例
  if (window.alertTypeChart) {
    window.alertTypeChart.destroy();
  }
  
  // 创建新图表
  window.alertTypeChart = new Chart(canvas, {
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
}

// 更新预警类型详情列表
function updateAlertTypeDetails(logsData) {
  const detailsContainer = document.getElementById('alert-type-details');
  if (!detailsContainer) return;
  
  // 清空现有内容
  detailsContainer.innerHTML = '';
  
  // 计算各类预警的数量和最近日期
  const weatherTypeInfo = {};
  logsData.forEach(log => {
    const weatherType = log.weather_type;
    if (weatherType) {
      if (!weatherTypeInfo[weatherType]) {
        weatherTypeInfo[weatherType] = {
          count: 0,
          regions: new Set(),
          latestDate: null
        };
      }
      
      weatherTypeInfo[weatherType].count++;
      weatherTypeInfo[weatherType].regions.add(log.region);
      
      const logDate = new Date(log.timestamp);
      if (!weatherTypeInfo[weatherType].latestDate || 
          logDate > new Date(weatherTypeInfo[weatherType].latestDate)) {
        weatherTypeInfo[weatherType].latestDate = log.timestamp;
      }
    }
  });
  
  // 预警类型说明
  const typeDescriptions = {
    '高温': '持续高温可能对人体健康、电力供应和农作物生长造成不利影响',
    '低温': '极端低温可能导致农作物受损、水管结冰和交通受阻',
    '暴雨': '强降雨可能引发洪涝灾害、山体滑坡和道路积水',
    '雷电': '强雷暴可能对户外活动和电子设备造成威胁',
    '大风': '强风可能导致树木倒伏、建筑物受损和户外广告牌脱落',
    '大雾': '能见度低可能影响交通出行安全和航班起降',
    '台风': '台风可能带来强降雨、大风和风暴潮等多种灾害'
  };
  
  // 获取预警类型的颜色
  function getTypeColor(type) {
    if (window.getWeatherTypeColors) {
      return window.getWeatherTypeColors(type).bg + ' ' + window.getWeatherTypeColors(type).text;
    }
    
    // 备用颜色方案
    const colorMap = {
      '高温': 'bg-red-100 text-red-800',
      '低温': 'bg-blue-100 text-blue-800',
      '暴雨': 'bg-indigo-100 text-indigo-800',
      '雷电': 'bg-yellow-100 text-yellow-800',
      '大风': 'bg-orange-100 text-orange-800',
      '大雾': 'bg-gray-100 text-gray-800',
      '台风': 'bg-purple-100 text-purple-800'
    };
    
    return colorMap[type] || 'bg-gray-100 text-gray-800';
  }
  
  // 按预警数量排序
  const sortedTypes = Object.keys(weatherTypeInfo).sort((a, b) => 
    weatherTypeInfo[b].count - weatherTypeInfo[a].count
  );
  
  // 为每种预警类型创建详情卡片
  sortedTypes.forEach(type => {
    const info = weatherTypeInfo[type];
    const formattedDate = info.latestDate ? new Date(info.latestDate).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }) : '无记录';
    
    const card = document.createElement('div');
    card.className = 'bg-white border border-gray-200 rounded-md p-3 shadow-sm hover:shadow transition-shadow';
    card.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(type)}">
          ${type}
        </span>
        <span class="text-sm font-semibold">${info.count}次</span>
      </div>
      <div class="flex justify-between text-xs text-gray-500">
        <span>影响地区: ${Array.from(info.regions).slice(0, 3).join(', ')}${info.regions.size > 3 ? '等' : ''}</span>
        <span>最近: ${formattedDate}</span>
      </div>
    `;
    
    detailsContainer.appendChild(card);
  });
}

// 显示预警条件列表
function displayAlertRules() {
  // 调用 populateAlertRules 函数来显示预警规则
  populateAlertRules();
}

// 初始化预警条件模态框
function initializeAlertRuleModal() {
  const addAlertRuleBtn = document.getElementById('add-alert-rule-btn');
  const modal = document.getElementById('add-alert-rule-modal');
  const closeBtn = document.getElementById('close-alert-rule-modal');
  const cancelBtn = document.getElementById('cancel-add-alert-rule');
  const form = document.getElementById('add-alert-rule-form');
  const alertTypeSelect = document.getElementById('alert-type-select');
  const parameterConditionContainer = document.getElementById('parameter-condition-container');
  const textConditionContainer = document.getElementById('text-condition-container');
  
  // 预警类型选择变化处理
  if (alertTypeSelect) {
    alertTypeSelect.addEventListener('change', function() {
      const selectedType = this.value;
      
      // 隐藏所有条件参数输入区域
      document.querySelectorAll('.condition-params').forEach(el => {
        el.classList.add('hidden');
      });
      
      // 根据选择的预警类型显示对应的输入界面
      if (['高温', '低温', '极端低温', '大风', '大雾', '暴雨'].includes(selectedType)) {
        // 参数型预警
        parameterConditionContainer.classList.remove('hidden');
        textConditionContainer.classList.add('hidden');
        
        // 显示对应的参数输入界面
        if (selectedType === '高温') {
          document.getElementById('high-temp-params').classList.remove('hidden');
        } else if (selectedType === '低温') {
          document.getElementById('low-temp-params').classList.remove('hidden');
        } else if (selectedType === '极端低温') {
          document.getElementById('extreme-low-temp-params').classList.remove('hidden');
        } else if (selectedType === '大风') {
          document.getElementById('wind-params').classList.remove('hidden');
        } else if (selectedType === '大雾') {
          document.getElementById('fog-params').classList.remove('hidden');
        } else if (selectedType === '暴雨') {
          document.getElementById('rain-params').classList.remove('hidden');
        }
      } else if (selectedType) {
        // 文本型预警
        parameterConditionContainer.classList.add('hidden');
        textConditionContainer.classList.remove('hidden');
      } else {
        // 未选择预警类型
        parameterConditionContainer.classList.add('hidden');
        textConditionContainer.classList.add('hidden');
      }
    });
  }
  
  // 打开模态框
  if (addAlertRuleBtn) {
    addAlertRuleBtn.addEventListener('click', function() {
      modal.classList.remove('hidden');
    });
  }
  
  // 关闭模态框
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      modal.classList.add('hidden');
      form.reset();
      // 重置条件输入区域
      parameterConditionContainer.classList.add('hidden');
      textConditionContainer.classList.add('hidden');
      document.querySelectorAll('.condition-params').forEach(el => {
        el.classList.add('hidden');
      });
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      modal.classList.add('hidden');
      form.reset();
      // 重置条件输入区域
      parameterConditionContainer.classList.add('hidden');
      textConditionContainer.classList.add('hidden');
      document.querySelectorAll('.condition-params').forEach(el => {
        el.classList.add('hidden');
      });
    });
  }
  
  // 提交表单
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // 获取表单数据
      const formData = new FormData(form);
      const type = formData.get('type');
      let condition = '';
      
      // 根据预警类型构建条件字符串
      if (['高温', '低温', '极端低温', '大风', '大雾', '暴雨'].includes(type)) {
        // 参数型预警
        if (type === '高温') {
          const highTempValue = formData.get('high_temp_value');
          condition = `最高温度 >= ${highTempValue} 度`;
        } else if (type === '低温') {
          const lowTempValue = formData.get('low_temp_value');
          condition = `最低温度 <= ${lowTempValue} 度`;
        } else if (type === '极端低温') {
          const extremeLowTempValue = formData.get('extreme_low_temp_value');
          condition = `最低温度 <= ${extremeLowTempValue} 度`;
        } else if (type === '大风') {
          const windSpeedValue = formData.get('wind_speed_value');
          condition = `风速 >= ${windSpeedValue} km/h`;
        } else if (type === '大雾') {
          const visibilityValue = formData.get('visibility_value');
          if (!visibilityValue) {
            Swal.fire({
              icon: 'warning',
              title: '输入错误',
              text: '请输入能见度阈值',
              confirmButtonText: '确定'
            });
            return;
          }
          condition = `能见度 <= ${visibilityValue} km`;
        } else if (type === '暴雨') {
          const rainfallValue = formData.get('rainfall_value');
          const rainfallPeriod = formData.get('rainfall_period');
          condition = `24h降雨量 >= ${rainfallValue} mm`;
        }
      } else {
        // 文本型预警
        condition = formData.get('text_condition');
      }
      
      // 创建新预警条件数据
      const newRule = {
        type,
        condition,
        status: '活跃', // 默认状态设为活跃
        createdAt: getCurrentDate(),
        alertType: ['高温', '低温', '大风', '大雾', '暴雨'].includes(type) ? 'parameter' : 'text'
      };
      
      try {
        // 先关闭模态框并重置表单，确保用户体验流畅
        modal.classList.add('hidden');
        form.reset();
        // 重置条件输入区域
        parameterConditionContainer.classList.add('hidden');
        textConditionContainer.classList.add('hidden');
        document.querySelectorAll('.condition-params').forEach(el => {
          el.classList.add('hidden');
        });
        
        // 发送到服务器
        fetch('api/alert-rules', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newRule)
        })
        .then(response => response.json())
        .then(data => {
          // 添加成功后刷新预警条件列表
          loadAlertRulesData();
        })
        .catch(error => {
          console.error('添加预警条件失败:', error);
        });
      } catch (error) {
        console.error('处理添加预警条件时出错:', error);
        // 确保即使出错，模态框也会关闭
        modal.classList.add('hidden');
        form.reset();
        parameterConditionContainer.classList.add('hidden');
        textConditionContainer.classList.add('hidden');
        document.querySelectorAll('.condition-params').forEach(el => {
          el.classList.add('hidden');
        });
      }
    });
  }
  
  // 初始化编辑预警条件模态框
  initializeEditAlertRuleModal();
}

// 初始化编辑预警条件模态框
function initializeEditAlertRuleModal() {
  const editModal = document.getElementById('edit-alert-rule-modal');
  const closeBtn = document.getElementById('close-edit-alert-rule-modal');
  const cancelBtn = document.getElementById('cancel-edit-alert-rule');
  const form = document.getElementById('edit-alert-rule-form');
  const editRuleType = document.getElementById('edit-rule-type');
  const editParameterConditionContainer = document.getElementById('edit-parameter-condition-container');
  const editTextConditionContainer = document.getElementById('edit-text-condition-container');
  const editAlertTypeInput = document.getElementById('edit-alert-type');
  
  // 预警类型选择变化处理
  if (editRuleType) {
    editRuleType.addEventListener('change', function() {
      const selectedType = this.value;
      console.log('预警类型变更为:', selectedType);
      
      // 隐藏所有条件参数输入区域
      document.querySelectorAll('.edit-condition-params').forEach(el => {
        el.classList.add('hidden');
      });
      
      // 根据选择的预警类型显示对应的输入界面
      if (['高温', '低温', '极端低温', '大风', '大雾', '暴雨'].includes(selectedType)) {
        // 参数型预警
        editParameterConditionContainer.classList.remove('hidden');
        editTextConditionContainer.classList.add('hidden');
        
        // 确保alertType字段有值
        if (editAlertTypeInput) {
          editAlertTypeInput.value = 'parameter';
          console.log('设置alertType为parameter');
        }
        
        // 显示对应的参数输入界面
        if (selectedType === '高温') {
          document.getElementById('edit-high-temp-params').classList.remove('hidden');
        } else if (selectedType === '低温') {
          document.getElementById('edit-low-temp-params').classList.remove('hidden');
        } else if (selectedType === '极端低温') {
          document.getElementById('edit-extreme-low-temp-params').classList.remove('hidden');
        } else if (selectedType === '大风') {
          document.getElementById('edit-wind-params').classList.remove('hidden');
        } else if (selectedType === '大雾') {
          document.getElementById('edit-fog-params').classList.remove('hidden');
        } else if (selectedType === '暴雨') {
          document.getElementById('edit-rain-params').classList.remove('hidden');
        }
      } else if (selectedType) {
        // 文本型预警
        editParameterConditionContainer.classList.add('hidden');
        editTextConditionContainer.classList.remove('hidden');
        
        // 确保alertType字段有值
        if (editAlertTypeInput) {
          editAlertTypeInput.value = 'text';
          console.log('设置alertType为text');
        }
      } else {
        // 未选择预警类型
        editParameterConditionContainer.classList.add('hidden');
        editTextConditionContainer.classList.add('hidden');
        
        // 确保alertType字段有值
        if (editAlertTypeInput) {
          editAlertTypeInput.value = 'parameter'; // 默认设置为parameter
          console.log('未选择预警类型，默认设置alertType为parameter');
        }
      }
    });
  }
  
  // 关闭模态框
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      editModal.classList.add('hidden');
      form.reset();
      // 重置条件输入区域
      editParameterConditionContainer.classList.add('hidden');
      editTextConditionContainer.classList.add('hidden');
      document.querySelectorAll('.edit-condition-params').forEach(el => {
        el.classList.add('hidden');
      });
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      editModal.classList.add('hidden');
      form.reset();
      // 重置条件输入区域
      editParameterConditionContainer.classList.add('hidden');
      editTextConditionContainer.classList.add('hidden');
      document.querySelectorAll('.edit-condition-params').forEach(el => {
        el.classList.add('hidden');
      });
    });
  }
  
  // 提交表单
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // 获取表单数据
      const formData = new FormData(form);
      const ruleId = parseInt(formData.get('ruleId'));
      const type = formData.get('type');
      const alertType = formData.get('alertType');
      let condition = '';
      
      console.log('表单提交数据:', {
        ruleId,
        type,
        alertType
      });
      
      // 获取原有规则数据
      const originalRule = alertRulesData.find(r => r.id === ruleId);
      if (!originalRule) {
        console.error('找不到原始规则数据，ID:', ruleId);
        return;
      }
      
      // 验证预警类型是否有效
      if (!type || type.trim() === '') {
        console.error('预警类型为空');
        // 使用原始规则类型而不是弹出警告
        type = originalRule.type || '';
      }
      
      // 根据预警类型构建条件字符串
      if (alertType === 'parameter') {
        // 参数型预警
        if (type === '高温') {
          const highTempValue = formData.get('edit_high_temp_value');
          if (!highTempValue) {
            Swal.fire({
              icon: 'warning',
              title: '输入错误',
              text: '请输入高温阈值',
              confirmButtonText: '确定'
            });
            return;
          }
          condition = `最高温度 >= ${highTempValue} 度`;
        } else if (type === '低温') {
          const lowTempValue = formData.get('edit_low_temp_value');
          if (!lowTempValue) {
            Swal.fire({
              icon: 'warning',
              title: '输入错误',
              text: '请输入低温阈值',
              confirmButtonText: '确定'
            });
            return;
          }
          condition = `最低温度 <= ${lowTempValue} 度`;
        } else if (type === '极端低温') {
          const extremeLowTempValue = formData.get('edit_extreme_low_temp_value');
          if (!extremeLowTempValue) {
            Swal.fire({
              icon: 'warning',
              title: '输入错误',
              text: '请输入极端低温阈值',
              confirmButtonText: '确定'
            });
            return;
          }
          condition = `最低温度 <= ${extremeLowTempValue} 度`;
        } else if (type === '大风') {
          const windSpeedValue = formData.get('edit_wind_speed_value');
          if (!windSpeedValue) {
            Swal.fire({
              icon: 'warning',
              title: '输入错误',
              text: '请输入风速阈值',
              confirmButtonText: '确定'
            });
            return;
          }
          condition = `风速 >= ${windSpeedValue} km/h`;
        } else if (type === '大雾') {
          const visibilityValue = formData.get('edit_visibility_value');
          if (!visibilityValue) {
            Swal.fire({
              icon: 'warning',
              title: '输入错误',
              text: '请输入能见度阈值',
              confirmButtonText: '确定'
            });
            return;
          }
          condition = `能见度 <= ${visibilityValue} km`;
        } else if (type === '暴雨') {
          const rainfallValue = formData.get('edit_rainfall_value');
          const rainfallPeriod = formData.get('edit_rainfall_period');
          if (!rainfallValue || !rainfallPeriod) {
            Swal.fire({
              icon: 'warning',
              title: '输入错误',
              text: '请输入降雨量和时间段',
              confirmButtonText: '确定'
            });
            return;
          }
          condition = `24h降雨量 >= ${rainfallValue} mm`;
        }
      } else if (alertType === 'text') {
        // 文本型预警
        condition = formData.get('edit_text_condition');
        if (!condition) {
          Swal.fire({
            icon: 'warning',
            title: '输入错误',
            text: '请输入预警条件',
            confirmButtonText: '确定'
          });
          return;
        }
      } else {
        // 如果alertType既不是parameter也不是text，则设置为parameter
        console.warn('alertType无效，设置为默认值parameter');
        alertType = 'parameter';
      }
      
      // 更新预警条件数据
      const updatedRule = {
        id: ruleId,
        type,
        condition,
        status: originalRule.status || '活跃', // 保留原有状态，如果没有则设为默认值
        alertType: alertType || 'parameter', // 确保alertType有值
        createdAt: originalRule.createdAt || getCurrentDate()
      };
      
      console.log('提交更新的预警规则:', updatedRule);
      
      try {
        // 先关闭模态框并重置表单，确保用户体验流畅
        editModal.classList.add('hidden');
        form.reset();
        // 重置条件输入区域
        editParameterConditionContainer.classList.add('hidden');
        editTextConditionContainer.classList.add('hidden');
        document.querySelectorAll('.edit-condition-params').forEach(el => {
          el.classList.add('hidden');
        });
        
        // 发送到服务器
        fetch(`api/alert-rules/${ruleId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updatedRule)
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          // 更新成功后刷新预警条件列表
          loadAlertRulesData();
        })
        .catch(error => {
          console.error('更新预警条件失败:', error);
          Swal.fire({
            icon: 'error',
            title: '更新失败',
            text: '更新预警条件失败: ' + error.message,
            confirmButtonText: '确定'
          });
        });
      } catch (error) {
        console.error('处理更新预警条件时出错:', error);
        Swal.fire({
          icon: 'error',
          title: '更新失败',
          text: '处理更新预警条件时出错: ' + error.message,
          confirmButtonText: '确定'
        });
        // 确保即使出错，模态框也会关闭
        editModal.classList.add('hidden');
        form.reset();
        editParameterConditionContainer.classList.add('hidden');
        editTextConditionContainer.classList.add('hidden');
        document.querySelectorAll('.edit-condition-params').forEach(el => {
          el.classList.add('hidden');
        });
      }
    });
  }
}

// 打开编辑预警条件模态框
function openEditAlertRuleModal(ruleId) {
  const rule = alertRulesData.find(r => r.id === ruleId);
  if (!rule) {
    console.error('找不到ID为', ruleId, '的预警规则');
    Swal.fire({
      icon: 'error',
      title: '查找失败',
      text: '找不到指定的预警规则',
      confirmButtonText: '确定'
    });
    return;
  }
  
  console.log('打开编辑模态框，规则数据:', rule);
  
  // 重置表单
  const form = document.getElementById('edit-alert-rule-form');
  if (form) {
    form.reset();
  }
  
  // 重置所有条件输入区域
  document.getElementById('edit-parameter-condition-container').classList.add('hidden');
  document.getElementById('edit-text-condition-container').classList.add('hidden');
  document.querySelectorAll('.edit-condition-params').forEach(el => {
    el.classList.add('hidden');
  });
  
  // 填充表单数据
  document.getElementById('edit-rule-id').value = rule.id;
  
  // 确保类型字段有值
  const ruleType = rule.type || '';
  document.getElementById('edit-rule-type').value = ruleType;
  
  // 设置预警类型
  let alertType = rule.alertType;
  if (!alertType) {
    alertType = ['高温', '低温', '极端低温', '大风', '大雾', '暴雨'].includes(ruleType) ? 'parameter' : 'text';
  }
  
  // 确保alertType字段有值
  if (!alertType || (alertType !== 'parameter' && alertType !== 'text')) {
    alertType = 'parameter';
  }
  
  document.getElementById('edit-alert-type').value = alertType;
  console.log('设置预警类型:', alertType);
  
  // 根据预警类型显示对应的输入界面
  if (alertType === 'parameter') {
    // 参数型预警
    document.getElementById('edit-parameter-condition-container').classList.remove('hidden');
    document.getElementById('edit-text-condition-container').classList.add('hidden');
    
    // 解析条件字符串，填充参数值
    if (ruleType === '高温') {
      document.getElementById('edit-high-temp-params').classList.remove('hidden');
      const match = rule.condition.match(/最高温度\s*>=\s*(\d+)/);
      if (match) {
        document.getElementById('edit-high-temp-value').value = match[1];
      } else {
        document.getElementById('edit-high-temp-value').value = '';
      }
    } else if (ruleType === '低温') {
      document.getElementById('edit-low-temp-params').classList.remove('hidden');
      const match = rule.condition.match(/最低温度\s*<=\s*(-?\d+)/);
      if (match) {
        document.getElementById('edit-low-temp-value').value = match[1];
      } else {
        document.getElementById('edit-low-temp-value').value = '';
      }
    } else if (ruleType === '极端低温') {
      document.getElementById('edit-extreme-low-temp-params').classList.remove('hidden');
      const match = rule.condition.match(/最低温度\s*<=\s*(-?\d+)/);
      if (match) {
        document.getElementById('edit-extreme-low-temp-value').value = match[1];
      } else {
        document.getElementById('edit-extreme-low-temp-value').value = '';
      }
    } else if (ruleType === '大风') {
      document.getElementById('edit-wind-params').classList.remove('hidden');
      const match = rule.condition.match(/风速\s*>=\s*(\d+)/);
      if (match) {
        document.getElementById('edit-wind-speed-value').value = match[1];
      } else {
        document.getElementById('edit-wind-speed-value').value = '';
      }
    } else if (ruleType === '大雾') {
      document.getElementById('edit-fog-params').classList.remove('hidden');
      const match = rule.condition.match(/能见度\s*<=\s*(\d+(\.\d+)?)/);
      if (match) {
        document.getElementById('edit-visibility-value').value = match[1];
      } else {
        document.getElementById('edit-visibility-value').value = '';
      }
    } else if (ruleType === '暴雨') {
      document.getElementById('edit-rain-params').classList.remove('hidden');
      const periodMatch = rule.condition.match(/(\d+小时)内降雨量/);
      const valueMatch = rule.condition.match(/降雨量\s*>=\s*(\d+)/);
      
      // 新增：检查新格式的24h降雨量条件
      const new24hMatch = rule.condition.match(/24h降雨量\s*>=\s*(\d+)/);
      
      if (periodMatch) {
        document.getElementById('edit-rainfall-period').value = periodMatch[1];
      } else {
        document.getElementById('edit-rainfall-period').value = '24小时';
      }
      
      if (valueMatch) {
        document.getElementById('edit-rainfall-value').value = valueMatch[1];
      } else if (new24hMatch) {
        // 如果匹配到新格式的24h降雨量条件
        document.getElementById('edit-rainfall-value').value = new24hMatch[1];
      } else {
        document.getElementById('edit-rainfall-value').value = '';
      }
    }
  } else {
    // 文本型预警
    document.getElementById('edit-parameter-condition-container').classList.add('hidden');
    document.getElementById('edit-text-condition-container').classList.remove('hidden');
    document.getElementById('edit-text-condition-input').value = rule.condition;
  }
  
  // 显示模态框
  document.getElementById('edit-alert-rule-modal').classList.remove('hidden');
  
  // 手动触发一次类型选择事件，确保界面正确显示
  const typeSelect = document.getElementById('edit-rule-type');
  if (typeSelect) {
    const event = new Event('change');
    typeSelect.dispatchEvent(event);
  }
}

// 删除预警条件
function deleteAlertRule(ruleId) {
  // 使用SweetAlert2替代原生confirm
  Swal.fire({
    title: '确认删除',
    text: '确定要删除此预警条件吗？此操作不可恢复。',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6'
  }).then((result) => {
    if (result.isConfirmed) {
      // 显示加载中状态
      Swal.fire({
        title: '正在删除...',
        text: '请稍候',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      
      // 发送到服务器
      fetch(`api/alert-rules/${ruleId}`, {
        method: 'DELETE'
      })
      .then(response => {
        if (response.ok) {
          // 删除成功后刷新预警条件列表
          loadAlertRulesData();
          
          // 显示成功消息
          Swal.fire({
            icon: 'success',
            title: '删除成功',
            text: '预警条件已成功删除',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
          });
        } else {
          throw new Error('删除预警条件失败');
        }
      })
      .catch(error => {
        console.error('删除预警条件失败:', error);
        
        // 显示错误消息
        Swal.fire({
          icon: 'error',
          title: '删除失败',
          text: error.message || '删除预警条件时出错',
          confirmButtonText: '确定'
        });
      });
    }
  });
}

// 获取当前日期
function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// ==================== 关注城市预警信息集成功能 ====================

// 获取人员管理中的地区列表
async function getPersonnelRegions() {
  try {
    const response = await fetch('/api/personnel');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    
    // 从人员数据中提取所有不重复的地区
    const regions = new Set();
    if (Array.isArray(data)) {
      data.forEach(person => {
        if (person.region && person.region.trim()) {
          regions.add(person.region.trim());
        }
      });
    }
    
    console.log('从人员管理获取到的地区:', Array.from(regions));
    return Array.from(regions);
  } catch (error) {
    console.error('获取人员地区列表失败:', error);
    return [];
  }
}

// 保持向后兼容的函数名
async function getFavoriteCities() {
  return await getPersonnelRegions();
}

// 获取城市的LocationID（扩展版，支持更多城市）
function getCityLocationId(cityName) {
  // 城市名称到LocationID的映射表
  const cityIdMap = {
    // 直辖市
    '北京': '101010100',
    '上海': '101020100',
    '天津': '101030100',
    '重庆': '101040100',
    
    // 省会城市
    '广州': '101280101',
    '成都': '101270101',
    '杭州': '101210101',
    '南京': '101190101',
    '武汉': '101200101',
    '西安': '101110101',
    '郑州': '101180101',
    '济南': '101120101',
    '沈阳': '101070101',
    '长春': '101060101',
    '哈尔滨': '101050101',
    '昆明': '101290101',
    '南宁': '101300101',
    '银川': '101170101',
    '太原': '101100101',
    '石家庄': '101090101',
    '呼和浩特': '101080101',
    '乌鲁木齐': '101130101',
    '兰州': '101160101',
    '西宁': '101150101',
    '拉萨': '101140101',
    '海口': '101310101',
    '福州': '101230101',
    '南昌': '101240101',
    '长沙': '101250101',
    '贵阳': '101260101',
    '合肥': '101220101',
    
    // 其他重要城市
    '深圳': '101280601',
    '苏州': '101190401',
    '无锡': '101190201',
    '宁波': '101210401',
    '温州': '101210701',
    '佛山': '101280800',
    '东莞': '101281601',
    '珠海': '101280701',
    '厦门': '101230201',
    '青岛': '101120201',
    '大连': '101070201',
    '烟台': '101120501',
    '桂林': '101300501',
    '三亚': '101310201',
    '洛阳': '101180901',
    '唐山': '101090501',
    '包头': '101080201',
    '台州': '101210601',
    '嘉兴': '101210301',
    '湖州': '101210201',
    '金华': '101210901',
    '衢州': '101211001',
    '丽水': '101210801',
    '舟山': '101211101',
    '泰州': '101191201',
    '扬州': '101190601',
    '盐城': '101190701',
    '淮安': '101190901',
    '连云港': '101191001',
    '宿迁': '101191301',
    '镇江': '101190301',
    '常州': '101191101',
    '徐州': '101190801',
    '南通': '101190501',
    '芜湖': '101220301',
    '蚌埠': '101220201',
    '淮南': '101220401',
    '马鞍山': '101220501',
    '淮北': '101221201',
    '铜陵': '101221301',
    '安庆': '101220601',
    '黄山': '101221001',
    '滁州': '101221101',
    '阜阳': '101220801',
    '宿州': '101220701',
    '六安': '101221501',
    '亳州': '101220901',
    '池州': '101221701',
    '宣城': '101221401',
    '莆田': '101230401',
    '三明': '101230801',
    '泉州': '101230501',
    '漳州': '101230601',
    '南平': '101230901',
    '龙岩': '101230701',
    '宁德': '101230301',
    '景德镇': '101240801',
    '萍乡': '101240901',
    '九江': '101240201',
    '新余': '101241001',
    '鹰潭': '101241101',
    '赣州': '101240701',
    '吉安': '101240601',
    '宜春': '101240501',
    '抚州': '101240401',
    '上饶': '101240301'
  };

  // 省份到省会城市的映射表（用于备选方案）
  const provinceToCapitalMap = {
    // 省份名称到省会城市的映射
    '广东': '广州',
    '广东省': '广州',
    '四川': '成都',
    '四川省': '成都',
    '浙江': '杭州',
    '浙江省': '杭州',
    '江苏': '南京',
    '江苏省': '南京',
    '湖北': '武汉',
    '湖北省': '武汉',
    '陕西': '西安',
    '陕西省': '西安',
    '河南': '郑州',
    '河南省': '郑州',
    '山东': '济南',
    '山东省': '济南',
    '辽宁': '沈阳',
    '辽宁省': '沈阳',
    '吉林': '长春',
    '吉林省': '长春',
    '黑龙江': '哈尔滨',
    '黑龙江省': '哈尔滨',
    '云南': '昆明',
    '云南省': '昆明',
    '广西': '南宁',
    '广西壮族自治区': '南宁',
    '宁夏': '银川',
    '宁夏回族自治区': '银川',
    '山西': '太原',
    '山西省': '太原',
    '河北': '石家庄',
    '河北省': '石家庄',
    '内蒙古': '呼和浩特',
    '内蒙古自治区': '呼和浩特',
    '新疆': '乌鲁木齐',
    '新疆维吾尔自治区': '乌鲁木齐',
    '甘肃': '兰州',
    '甘肃省': '兰州',
    '青海': '西宁',
    '青海省': '西宁',
    '西藏': '拉萨',
    '西藏自治区': '拉萨',
    '海南': '海口',
    '海南省': '海口',
    '福建': '福州',
    '福建省': '福州',
    '江西': '南昌',
    '江西省': '南昌',
    '湖南': '长沙',
    '湖南省': '长沙',
    '贵州': '贵阳',
    '贵州省': '贵阳',
    '安徽': '合肥',
    '安徽省': '合肥'
  };
  
  // 先尝试直接匹配
  if (cityIdMap[cityName]) {
    return cityIdMap[cityName];
  }
  
  // 如果没有直接匹配，尝试模糊匹配（去掉"市"字）
  const cityNameWithoutSuffix = cityName.replace(/市$/, '');
  if (cityIdMap[cityNameWithoutSuffix]) {
    return cityIdMap[cityNameWithoutSuffix];
  }
  
  // 如果仍然没有找到，尝试使用省会城市作为备选
  // 检查输入是否为省份名称
  if (provinceToCapitalMap[cityName]) {
    const capitalCity = provinceToCapitalMap[cityName];
    console.log(`未找到城市 "${cityName}" 的LocationID，使用省会城市 "${capitalCity}" 作为备选`);
    return cityIdMap[capitalCity];
  }
  
  // 尝试从城市名称推断省份（适用于"XX省XX市"格式）
  const provinceMatch = cityName.match(/^(.+?省)/);
  if (provinceMatch) {
    const provinceName = provinceMatch[1];
    if (provinceToCapitalMap[provinceName]) {
      const capitalCity = provinceToCapitalMap[provinceName];
      console.log(`未找到城市 "${cityName}" 的LocationID，根据省份 "${provinceName}" 使用省会城市 "${capitalCity}" 作为备选`);
      return cityIdMap[capitalCity];
    }
  }
  
  console.warn(`未找到城市 "${cityName}" 的LocationID，也无法确定对应的省会城市`);
  return null;
}

// 调用和风天气预警API获取预警信息
async function getWeatherWarnings(locationId) {
  try {
    // 从配置文件获取API密钥
    let apiKey = '';
    
    // 尝试从settings.json获取API密钥
    try {
      const settingsResponse = await fetch('settings.json');
      if (settingsResponse.ok) {
        const settings = await settingsResponse.json();
        apiKey = settings.weatherApiKey || '';
        console.log('🔑 从settings.json获取API密钥:', apiKey ? '已获取' : '未找到');
      }
    } catch (configError) {
      console.warn('无法读取settings.json文件，尝试从config.json获取');
      // 备用方案：从config.json获取
      try {
        const configResponse = await fetch('config.json');
        if (configResponse.ok) {
          const config = await configResponse.json();
          apiKey = config.qweather_api_key || '';
        }
      } catch (backupError) {
        console.warn('无法读取任何配置文件');
      }
    }
    
    // 如果没有配置API密钥，返回模拟数据用于演示
    if (!apiKey || apiKey === 'your_qweather_api_key') {
      console.warn('未配置和风天气API密钥，返回模拟数据');
      return {
        code: '200',
        updateTime: new Date().toISOString(),
        fxLink: '',
        warning: [] // 返回空预警数组
      };
    }
    
    console.log('🌐 准备调用和风天气API，LocationID:', locationId);
    
    const apiUrl = `https://devapi.qweather.com/v7/warning/now?location=${locationId}&key=${apiKey}`;
    console.log('🌐 API请求URL:', apiUrl);
    
    const response = await fetch(apiUrl);
    console.log('📡 API响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📊 API响应数据:', data);
    
    // 检查API响应状态
    if (data.code !== '200') {
      console.log('⚠️ API返回非200状态码:', data.code, data);
      throw new Error(`API返回错误: ${data.code}`);
    }
    
    console.log('✅ API调用成功，预警数量:', data.warning?.length || 0);
    return data;
  } catch (error) {
    console.error('❌ 获取预警信息失败:', error);
    console.error('❌ 错误详情:', {
      message: error.message,
      stack: error.stack,
      locationId: locationId
    });
    // 返回模拟数据结构，避免程序崩溃
    return {
      code: 'error',
      updateTime: new Date().toISOString(),
      fxLink: '',
      warning: [],
      error: error.message
    };
  }
}

// 格式化预警时间
function formatWarningTime(timeStr) {
  if (!timeStr) return '未知时间';
  try {
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return timeStr;
  }
}

// 获取预警等级颜色
function getWarningLevelColor(severity) {
  const colorMap = {
    'Minor': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Moderate': 'bg-orange-100 text-orange-800 border-orange-200', 
    'Severe': 'bg-red-100 text-red-800 border-red-200',
    'Extreme': 'bg-purple-100 text-purple-800 border-purple-200'
  };
  return colorMap[severity] || 'bg-gray-100 text-gray-800 border-gray-200';
}

// 获取预警状态颜色
function getWarningStatusColor(status) {
  const colorMap = {
    'Active': 'bg-green-100 text-green-800',
    'Update': 'bg-blue-100 text-blue-800', 
    'Cancel': 'bg-gray-100 text-gray-800'
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
}

// 创建预警信息弹窗
async function showCityWarningsPopup() {
  try {
    console.log('🌤️ 开始显示人员地区预警信息弹窗');
    // 显示加载状态
    Swal.fire({
      title: '正在获取预警信息...',
      text: '请稍候',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // 获取关注城市列表
    console.log('📋 正在获取关注城市列表...');
    const cities = await getFavoriteCities();
    console.log('📋 获取到的城市列表:', cities);
    
    if (cities.length === 0) {
      console.log('⚠️ 暂无关注城市');
      Swal.fire({
        icon: 'info',
        title: '暂无关注城市',
        text: '请先在天气界面添加关注的城市',
        confirmButtonText: '确定'
      });
      return;
    }
    
    console.log(`📊 开始为 ${cities.length} 个城市获取预警信息`);

    // 获取所有城市的预警信息
    const warningPromises = cities.map(async (city) => {
      const locationId = getCityLocationId(city);
      if (!locationId) {
        return {
          city: city,
          error: '未找到城市ID',
          warnings: []
        };
      }
      
      const warningData = await getWeatherWarnings(locationId);
      return {
        city: city,
        locationId: locationId,
        data: warningData,
        warnings: warningData?.warning || []
      };
    });

    const results = await Promise.all(warningPromises);
    
    // 统计预警信息
    let totalWarnings = 0;
    let activeWarnings = 0;
    
    results.forEach(result => {
      if (result.warnings && Array.isArray(result.warnings)) {
        totalWarnings += result.warnings.length;
        activeWarnings += result.warnings.filter(w => w.status === 'Active').length;
      }
    });

    // 构建弹窗内容
    let popupContent = `
      <div class="text-left">
        <div class="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h4 class="font-semibold text-blue-800 mb-2">📊 预警统计</h4>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-600">${totalWarnings}</div>
              <div class="text-gray-600">总预警数</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-red-600">${activeWarnings}</div>
              <div class="text-gray-600">活跃预警</div>
            </div>
          </div>
        </div>
    `;

    // 为每个城市添加预警信息
    results.forEach(result => {
      popupContent += `
        <div class="mb-4 border border-gray-200 rounded-lg overflow-hidden">
          <div class="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <h4 class="font-semibold text-gray-800">🏙️ ${result.city}</h4>
          </div>
          <div class="p-3">
      `;
      
      if (result.error) {
        popupContent += `
          <div class="text-red-500 text-sm">
            ❌ ${result.error}
          </div>
        `;
      } else if (!result.warnings || result.warnings.length === 0) {
        popupContent += `
          <div class="text-green-600 text-sm flex items-center">
            ✅ <span class="ml-1">暂无预警信息</span>
          </div>
        `;
      } else {
        result.warnings.forEach(warning => {
          const levelColor = getWarningLevelColor(warning.severity);
          const statusColor = getWarningStatusColor(warning.status);
          
          popupContent += `
            <div class="mb-3 p-3 border rounded-lg ${levelColor}">
              <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                  <h5 class="font-medium text-sm">${warning.title || warning.typeName || '预警信息'}</h5>
                  <div class="flex gap-2 mt-1">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor}">
                      ${warning.status || '未知'}
                    </span>
                    ${warning.severity ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white bg-opacity-50">${warning.severity}</span>` : ''}
                  </div>
                </div>
              </div>
              
              ${warning.text ? `<p class="text-xs text-gray-700 mb-2">${warning.text}</p>` : ''}
              
              <div class="text-xs text-gray-600 space-y-1">
                ${warning.pubTime ? `<div>🕐 发布时间: ${formatWarningTime(warning.pubTime)}</div>` : ''}
                ${warning.startTime ? `<div>⏰ 开始时间: ${formatWarningTime(warning.startTime)}</div>` : ''}
                ${warning.endTime ? `<div>⏰ 结束时间: ${formatWarningTime(warning.endTime)}</div>` : ''}
                ${warning.sender ? `<div>📢 发布单位: ${warning.sender}</div>` : ''}
              </div>
            </div>
          `;
        });
      }
      
      popupContent += `
          </div>
        </div>
      `;
    });

    popupContent += `
        <div class="mt-4 text-xs text-gray-500 text-center">
          数据更新时间: ${new Date().toLocaleString('zh-CN')}
        </div>
      </div>
    `;

    // 显示预警信息弹窗
    Swal.fire({
      title: '🌤️ 人员地区预警信息',
      html: popupContent,
      width: '600px',
      confirmButtonText: '确定',
      confirmButtonColor: '#3b82f6',
      customClass: {
        popup: 'text-left',
        htmlContainer: 'max-h-96 overflow-y-auto'
      }
    });

  } catch (error) {
    console.error('❌ 显示预警信息时出错:', error);
    Swal.fire({
      icon: 'error',
      title: '获取预警信息失败',
      text: error.message || '请检查网络连接或稍后重试',
      confirmButtonText: '确定'
    });
  }
}

// 添加刷新按钮到页面
function addRefreshButton() {
  console.log('🔍 查找添加预警规则按钮...');
  // 查找合适的位置添加刷新按钮
  const addAlertRuleBtn = document.getElementById('add-alert-rule-btn');
  if (addAlertRuleBtn && addAlertRuleBtn.parentNode) {
    console.log('✅ 找到添加预警规则按钮，正在创建刷新按钮...');
    // 创建刷新按钮
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'refresh-city-warnings-btn';
    refreshBtn.className = 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2';
    refreshBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
      </svg>
      人员地区预警
    `;
    
    // 添加点击事件
    refreshBtn.addEventListener('click', showCityWarningsPopup);
    
    // 插入到添加预警规则按钮之前
    addAlertRuleBtn.parentNode.insertBefore(refreshBtn, addAlertRuleBtn);
    console.log('✅ 刷新按钮已成功添加到页面');
  } else {
    console.error('❌ 未找到添加预警规则按钮，无法添加刷新按钮');
  }
}

// 测试函数 - 可以在浏览器控制台手动调用
window.testCityWarnings = function() {
  console.log('🧪 手动测试城市预警功能');
  showCityWarningsPopup();
};

// 当DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 alerts.js DOMContentLoaded 事件触发');
  console.log('🌐 当前页面URL:', window.location.href);
  console.log('📄 当前页面标题:', document.title);
  
  // 初始化预警条件模态框
  initializeAlertRuleModal();
  
  // 初始化编辑预警条件模态框
  initializeEditAlertRuleModal();
  
  // 添加刷新按钮
  console.log('📝 正在添加刷新按钮...');
  addRefreshButton();
  
  // 确保 Chart.js 已加载
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js 尚未加载，等待加载完成...');
    
    // 创建一个脚本加载检查
    const checkChartLoaded = setInterval(function() {
      if (typeof Chart !== 'undefined') {
        clearInterval(checkChartLoaded);
        console.log('Chart.js 已加载，开始初始化图表');
        loadAlertRulesData();
      }
    }, 100);
    
    // 设置超时，避免无限等待
    setTimeout(function() {
      clearInterval(checkChartLoaded);
      console.error('Chart.js 加载超时，使用备用初始化');
      loadAlertRulesData();
    }, 5000);
  } else {
    // Chart.js 已加载，直接初始化
    console.log('Chart.js 已加载，直接初始化预警规则');
    loadAlertRulesData();
  }
  
  // 页面加载时自动显示人员地区预警信息
  console.log('⏰ 设置延迟显示人员地区预警信息...');
  setTimeout(() => {
    console.log('🌤️ 开始显示人员地区预警信息');
    showCityWarningsPopup();
  }, 1000); // 延迟1秒显示，确保页面完全加载
});
  