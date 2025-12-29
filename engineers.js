/**
 * 工程师管理
 */

// 初始化工程师管理页面
function initializeEngineers() {
  loadEngineers();
  setupEngineerEventListeners();
}

// 加载工程师列表
function loadEngineers(searchTerm = '', region = '') {
  fetch('/api/engineers' + 
    (searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '') + 
    (region ? `${searchTerm ? '&' : '?'}region=${encodeURIComponent(region)}` : ''))
    .then(response => response.json())
    .then(data => {
      renderEngineers(data);
    })
    .catch(error => {
      console.error('加载工程师数据失败:', error);
      // 从本地JSON文件加载
      fetch('/static/data/engineers_data.json')
        .then(response => response.json())
        .then(data => {
          renderEngineers(data);
        })
        .catch(fallbackError => {
          console.error('无法加载工程师数据:', fallbackError);
          renderEngineers([]);
        });
    });
}

// 渲染工程师列表
function renderEngineers(engineers) {
  const tableBody = document.querySelector('#engineers-table tbody');
  if (!tableBody) return;
  
  tableBody.innerHTML = '';
  
  if (engineers.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="5" class="py-4 text-center text-gray-500">
        没有找到匹配的工程师
      </td>
    `;
    tableBody.appendChild(emptyRow);
    return;
  }
  
  engineers.forEach(engineer => {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';
    
    const weatherTypesDisplay = engineer.weatherTypes ? engineer.weatherTypes.join(', ') : '';
    const lastUpdated = engineer.updatedAt ? new Date(engineer.updatedAt).toLocaleString('zh-CN') : '';
    
    row.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="font-medium text-gray-900">${engineer.name}</div>
        <div class="text-gray-500 text-sm">${engineer.email}</div>
        ${engineer.phone ? `<div class="text-gray-500 text-sm">${engineer.phone}</div>` : ''}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          ${engineer.region}
        </span>
      </td>
      <td class="px-6 py-4">
        <div class="text-sm text-gray-900 max-w-xs truncate">${weatherTypesDisplay}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${lastUpdated}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button data-engineer-id="${engineer.id}" class="edit-engineer-btn text-blue-600 hover:text-blue-900 mr-3">编辑</button>
        <button data-engineer-id="${engineer.id}" class="delete-engineer-btn text-red-600 hover:text-red-900">删除</button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
  
  // 更新工程师计数
  updateEngineerCount(engineers.length);
}

// 更新工程师计数
function updateEngineerCount(count) {
  const engineerCountElement = document.getElementById('engineer-count');
  if (engineerCountElement) {
    engineerCountElement.textContent = count;
  }
}

// 设置工程师相关的事件监听器
function setupEngineerEventListeners() {
  // 搜索工程师
  const engineerSearchForm = document.getElementById('engineer-search-form');
  const engineerSearchInput = document.getElementById('engineer-search');
  
  if (engineerSearchForm) {
    engineerSearchForm.addEventListener('submit', function(e) {
      e.preventDefault();
      loadEngineers(engineerSearchInput.value, getSelectedEngineerRegion());
    });
  }
  
  // 地区筛选
  const engineerRegionDropdown = document.getElementById('engineer-region-dropdown');
  if (engineerRegionDropdown) {
    engineerRegionDropdown.addEventListener('change', function() {
      loadEngineers(engineerSearchInput.value, this.value);
    });
  }
  
  // 点击添加工程师按钮
  const addEngineerBtn = document.getElementById('add-engineer-btn');
  if (addEngineerBtn) {
    addEngineerBtn.addEventListener('click', showAddEngineerModal);
  }
  
  // 新增地区按钮
  const addNewEngineerRegionBtn = document.getElementById('add-new-engineer-region-btn');
  if (addNewEngineerRegionBtn) {
    addNewEngineerRegionBtn.addEventListener('click', function() {
      document.getElementById('new-engineer-region-input').classList.remove('hidden');
    });
  }
  
  // 保存新地区按钮
  const saveNewEngineerRegionBtn = document.getElementById('save-new-engineer-region-btn');
  if (saveNewEngineerRegionBtn) {
    saveNewEngineerRegionBtn.addEventListener('click', function() {
      const newRegionInput = document.getElementById('new-engineer-region');
      const newRegion = newRegionInput.value.trim();
      
      if (newRegion) {
        // 添加新地区到下拉列表
        const regionSelect = document.getElementById('engineer-region-select');
        const option = document.createElement('option');
        option.value = newRegion;
        option.textContent = newRegion;
        regionSelect.appendChild(option);
        regionSelect.value = newRegion;
        
        // 添加到地区筛选下拉列表
        const regionDropdown = document.getElementById('engineer-region-dropdown');
        if (regionDropdown) {
          const filterOption = document.createElement('option');
          filterOption.value = newRegion;
          filterOption.textContent = newRegion;
          regionDropdown.appendChild(filterOption);
        }
        
        // 隐藏输入框
        document.getElementById('new-engineer-region-input').classList.add('hidden');
        newRegionInput.value = '';
      }
    });
  }
  
  // 取消添加工程师
  const cancelAddEngineerBtn = document.getElementById('cancel-add-engineer');
  if (cancelAddEngineerBtn) {
    cancelAddEngineerBtn.addEventListener('click', closeAddEngineerModal);
  }
  
  // 关闭添加工程师模态框
  const closeEngineerModalBtn = document.getElementById('close-engineer-modal');
  if (closeEngineerModalBtn) {
    closeEngineerModalBtn.addEventListener('click', closeAddEngineerModal);
  }
  
  // 提交添加工程师表单
  const addEngineerForm = document.getElementById('add-engineer-form');
  if (addEngineerForm) {
    addEngineerForm.addEventListener('submit', handleAddEngineer);
  }
  
  // 点击编辑按钮
  document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('edit-engineer-btn')) {
      const engineerId = e.target.getAttribute('data-engineer-id');
      editEngineer(engineerId);
    }
  });
  
  // 取消编辑工程师
  const cancelEditEngineerBtn = document.getElementById('cancel-edit-engineer');
  if (cancelEditEngineerBtn) {
    cancelEditEngineerBtn.addEventListener('click', closeEditEngineerModal);
  }
  
  // 关闭编辑工程师模态框
  const closeEditEngineerModalBtn = document.getElementById('close-edit-engineer-modal');
  if (closeEditEngineerModalBtn) {
    closeEditEngineerModalBtn.addEventListener('click', closeEditEngineerModal);
  }
  
  // 提交编辑工程师表单
  const editEngineerForm = document.getElementById('edit-engineer-form');
  if (editEngineerForm) {
    editEngineerForm.addEventListener('submit', handleEditEngineer);
  }
  
  // 点击删除按钮
  document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('delete-engineer-btn')) {
      const engineerId = e.target.getAttribute('data-engineer-id');
      deleteEngineer(engineerId);
    }
  });
  
  // 加载地区和天气类型选项
  loadRegionsAndWeatherTypes();
}

// 获取选中的工程师地区
function getSelectedEngineerRegion() {
  const regionDropdown = document.getElementById('engineer-region-dropdown');
  return regionDropdown ? regionDropdown.value : '';
}

// 显示添加工程师模态框
function showAddEngineerModal() {
  // 清空表单
  document.getElementById('add-engineer-form').reset();
  
  // 清空天气类型选择
  const weatherTypeOptions = document.getElementById('engineer-weather-type-options');
  const checkboxes = weatherTypeOptions.querySelectorAll('input[type="checkbox"]:checked');
  checkboxes.forEach(checkbox => checkbox.checked = false);
  
  // 显示模态框
  document.getElementById('add-engineer-modal').classList.remove('hidden');
}

// 关闭添加工程师模态框
function closeAddEngineerModal() {
  document.getElementById('add-engineer-modal').classList.add('hidden');
}

// 处理添加工程师
function handleAddEngineer(e) {
  e.preventDefault();
  
  const form = e.currentTarget;
  const formData = new FormData(form);
  
  // 获取选中的天气类型
  const weatherTypes = [];
  const weatherTypeCheckboxes = document.querySelectorAll('#engineer-weather-type-options input[type="checkbox"]:checked');
  weatherTypeCheckboxes.forEach(checkbox => {
    weatherTypes.push(checkbox.value);
  });
  
  // 创建工程师对象
  const engineer = {
    id: Date.now().toString(), // 临时ID
    name: formData.get('name'),
    phone: formData.get('phone') || '',
    email: formData.get('email'),
    region: formData.get('region'),
    weatherTypes: weatherTypes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // 保存工程师数据
  saveEngineer(engineer)
    .then(() => {
      closeAddEngineerModal();
      loadEngineers();
    })
    .catch(() => {
      Swal.fire({
        icon: 'error',
        title: '保存失败',
        text: '保存工程师数据失败，请重试',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    });
}

// 保存工程师数据
function saveEngineer(engineer) {
  return new Promise((resolve, reject) => {
    // 尝试调用API保存
    fetch('/api/engineers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(engineer)
    })
    .then(response => {
      if (response.ok) {
        resolve();
      } else {
        // 如果API调用失败，尝试本地保存
        saveEngineerLocally(engineer)
          .then(resolve)
          .catch(reject);
      }
    })
    .catch(error => {
      console.error('API保存失败，尝试本地保存:', error);
      saveEngineerLocally(engineer)
        .then(resolve)
        .catch(reject);
    });
  });
}

// 本地保存工程师数据
function saveEngineerLocally(engineer) {
  return new Promise((resolve, reject) => {
    fetch('/static/data/engineers_data.json')
      .then(response => response.json())
      .then(engineers => {
        // 检查是否是更新现有工程师
        const existingIndex = engineers.findIndex(e => e.id === engineer.id);
        
        if (existingIndex !== -1) {
          engineers[existingIndex] = engineer;
        } else {
          engineers.push(engineer);
        }
        
        // 这里仅模拟保存成功
        // 实际中可能需要使用后端API来保存数据
        console.log('本地保存工程师数据:', engineers);
        localStorage.setItem('engineers_data', JSON.stringify(engineers));
        resolve();
      })
      .catch(error => {
        console.error('无法加载或保存工程师数据:', error);
        reject(error);
      });
  });
}

// 编辑工程师
function editEngineer(engineerId) {
  fetch('/api/engineers/' + engineerId)
    .then(response => response.json())
    .then(engineer => {
      populateEditEngineerForm(engineer);
    })
    .catch(() => {
      Swal.fire({
        icon: 'error',
        title: '获取失败',
        text: '无法获取工程师数据，请重试',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    });
}

// 填充编辑工程师表单
function populateEditEngineerForm(engineer) {
  // 设置ID
  document.getElementById('edit-engineer-id').value = engineer.id;
  
  // 填充基本信息
  document.getElementById('edit-engineer-name').value = engineer.name;
  document.getElementById('edit-engineer-phone').value = engineer.phone || '';
  document.getElementById('edit-engineer-email').value = engineer.email;
  
  // 设置地区
  const regionSelect = document.getElementById('edit-engineer-region');
  
  // 如果地区不在列表中，添加它
  let regionExists = false;
  for (let i = 0; i < regionSelect.options.length; i++) {
    if (regionSelect.options[i].value === engineer.region) {
      regionExists = true;
      break;
    }
  }
  
  if (!regionExists && engineer.region) {
    const option = document.createElement('option');
    option.value = engineer.region;
    option.textContent = engineer.region;
    regionSelect.appendChild(option);
  }
  
  regionSelect.value = engineer.region;
  
  // 设置天气类型
  const weatherTypeOptions = document.getElementById('edit-engineer-weather-type-options');
  const checkboxes = weatherTypeOptions.querySelectorAll('input[type="checkbox"]');
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = engineer.weatherTypes && engineer.weatherTypes.includes(checkbox.value);
  });
  
  // 显示模态框
  document.getElementById('edit-engineer-modal').classList.remove('hidden');
}

// 关闭编辑工程师模态框
function closeEditEngineerModal() {
  document.getElementById('edit-engineer-modal').classList.add('hidden');
}

// 处理编辑工程师
function handleEditEngineer(e) {
  e.preventDefault();
  
  const form = e.currentTarget;
  const formData = new FormData(form);
  
  // 获取选中的天气类型
  const weatherTypes = [];
  const weatherTypeCheckboxes = document.querySelectorAll('#edit-engineer-weather-type-options input[type="checkbox"]:checked');
  weatherTypeCheckboxes.forEach(checkbox => {
    weatherTypes.push(checkbox.value);
  });
  
  // 创建工程师对象
  const engineer = {
    id: formData.get('engineerId'),
    name: formData.get('name'),
    phone: formData.get('phone') || '',
    email: formData.get('email'),
    region: formData.get('region'),
    weatherTypes: weatherTypes,
    updatedAt: new Date().toISOString()
  };
  
  // 更新工程师数据
  updateEngineer(engineer)
    .then(() => {
      closeEditEngineerModal();
      loadEngineers();
    })
    .catch(() => {
      Swal.fire({
        icon: 'error',
        title: '更新失败',
        text: '更新工程师数据失败，请重试',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    });
}

// 更新工程师数据
function updateEngineer(engineer) {
  return new Promise((resolve, reject) => {
    // 尝试调用API更新
    fetch('/api/engineers/' + engineer.id, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(engineer)
    })
    .then(response => {
      if (response.ok) {
        resolve();
      } else {
        // 如果API调用失败，尝试本地更新
        saveEngineerLocally(engineer)
          .then(resolve)
          .catch(reject);
      }
    })
    .catch(error => {
      console.error('API更新失败，尝试本地更新:', error);
      saveEngineerLocally(engineer)
        .then(resolve)
        .catch(reject);
    });
  });
}

// 删除工程师
async function deleteEngineer(engineerId) {
  try {
    // 使用SweetAlert2替代原生confirm
    const confirmResult = await Swal.fire({
      title: '确认删除',
      text: '确定要删除这个工程师吗？此操作无法撤销。',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    });
    
    if (!confirmResult.isConfirmed) {
      return;
    }
    
    // 显示加载中状态
    Swal.fire({
      title: '正在删除...',
      text: '请稍候',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    // 尝试调用API删除
    fetch(`/api/engineers/${engineerId}`, {
      method: 'DELETE'
    })
    .then(response => {
      if (response.ok) {
        // 刷新工程师列表
        loadEngineers();
        
        // 显示成功提示
        Swal.fire({
          icon: 'success',
          title: '工程师已删除',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      } else {
        // 如果API调用失败，尝试本地删除
        deleteEngineerLocally(engineerId)
          .then(() => {
            loadEngineers();
            
            // 显示成功提示
            Swal.fire({
              icon: 'success',
              title: '工程师已删除',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true
            });
          })
          .catch(error => {
            throw new Error(error.message || '删除失败');
          });
      }
    })
    .catch(error => {
      console.error('删除失败:', error);
      
      // 显示错误提示
      Swal.fire({
        icon: 'error',
        title: '删除失败',
        text: '删除工程师失败，请重试',
        confirmButtonText: '确定'
      });
    });
  } catch (error) {
    console.error('删除工程师失败:', error);
    
    // 显示错误提示
    Swal.fire({
      icon: 'error',
      title: '删除失败',
      text: '删除工程师失败，请重试',
      confirmButtonText: '确定'
    });
  }
}

// 本地删除工程师
function deleteEngineerLocally(engineerId) {
  fetch('/static/data/engineers_data.json')
    .then(response => response.json())
    .then(engineers => {
      const filteredEngineers = engineers.filter(e => e.id !== engineerId);
      
      // 这里仅模拟删除成功
      // 实际中可能需要使用后端API来保存数据
      console.log('本地删除工程师数据:', filteredEngineers);
      localStorage.setItem('engineers_data', JSON.stringify(filteredEngineers));
      
      loadEngineers();
    })
    .catch(error => {
      console.error('无法加载或删除工程师数据:', error);
      Swal.fire({
        icon: 'error',
        title: '删除失败',
        text: '删除工程师失败，请重试',
        confirmButtonText: '确定'
      });
    });
}

// 加载地区和天气类型选项
function loadRegionsAndWeatherTypes() {
  // 加载地区
  fetch('/api/regions')
    .then(response => response.json())
    .then(regions => {
      populateRegionOptions(regions);
    })
    .catch(error => {
      console.error('无法加载地区数据:', error);
      // 使用默认地区
      const defaultRegions = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安'];
      populateRegionOptions(defaultRegions);
    });
  
  // 加载天气类型
  const weatherTypes = [
    '高温', '低温', '极端低温', '大风', '大雾', '暴雨', 
    '暴雪', '冻雨', '台风', '沙尘暴', '冰雹', '雷电', '其他'
  ];
  
  populateWeatherTypeOptions(weatherTypes);
}

// 填充地区选项
function populateRegionOptions(regions) {
  const regionSelect = document.getElementById('engineer-region-select');
  const editRegionSelect = document.getElementById('edit-engineer-region');
  const regionDropdown = document.getElementById('engineer-region-dropdown');
  
  const fillSelect = (select, includeEmpty = true) => {
    if (!select) return;
    
    select.innerHTML = includeEmpty ? '<option value="">请选择地区</option>' : '';
    
    regions.forEach(region => {
      const option = document.createElement('option');
      option.value = region;
      option.textContent = region;
      select.appendChild(option);
    });
  };
  
  fillSelect(regionSelect);
  fillSelect(editRegionSelect);
  
  if (regionDropdown) {
    fillSelect(regionDropdown, false);
    regionDropdown.insertAdjacentHTML('afterbegin', '<option value="">所有地区</option>');
  }
}

// 填充天气类型选项
function populateWeatherTypeOptions(weatherTypes) {
  const addContainer = document.getElementById('engineer-weather-type-options');
  const editContainer = document.getElementById('edit-engineer-weather-type-options');
  
  const createOptions = (container) => {
    if (!container) return;
    
    container.innerHTML = '';
    
    weatherTypes.forEach(type => {
      const label = document.createElement('label');
      label.className = 'inline-flex items-center border rounded px-2 py-1 bg-gray-50';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = type;
      checkbox.className = 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded';
      
      const span = document.createElement('span');
      span.className = 'ml-2 text-sm text-gray-900';
      span.textContent = type;
      
      label.appendChild(checkbox);
      label.appendChild(span);
      container.appendChild(label);
    });
  };
  
  createOptions(addContainer);
  createOptions(editContainer);
}

// 导出函数
window.initializeEngineers = initializeEngineers; 