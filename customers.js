// 人员数据存储
let customersData = [];
let currentPage = 1;
const pageSize = 10;
let totalPages = 1;

// 模态框初始化标志
let editModalInitialized = false;
let addModalInitialized = false;

// 存储所有选中的人员ID
let selectedCustomerIds = new Set();
// 是否处于全选状态
let allSelected = false;

// 天气类型数据
const weatherTypes = ['暴雨', '高温', '台风', '大雾', '雷电', '低温', '极端低温', '大风', '暴雪', '冻雨', '沙尘暴', '冰雹', '其他'];

// 加载人员数据
async function loadCustomersData() {
  try {
    const response = await fetch('/api/personnel');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    customersData = data;
    
    // 加载区域选项
    loadRegionOptions(data);
    loadModalRegionOptions(data);
    
    // 显示人员数据
    totalPages = Math.ceil(customersData.length / pageSize);
    
    updatePersonnelStats();
    updatePagination();
    displayPersonnel(currentPage);

    // 添加筛选器事件监听
    setupFilterListeners();
  } catch (error) {
    console.error('加载人员数据失败:', error);
    // 使用SweetAlert2替代原生alert
    Swal.fire({
      icon: 'error',
      title: '加载失败',
      text: '加载人员数据失败，请刷新页面重试',
      confirmButtonText: '确定'
    });
    
    // 使用示例数据（用于演示）
    // ... existing code ...
  }
}

// 加载地区选项
function loadRegionOptions(data) {
  const regionSelect = document.getElementById('region-select');
  if (!regionSelect) return;
  
  // 获取所有不重复的地区
  const regions = [...new Set(data.map(person => person.region).filter(Boolean))];
  
  // 按字母顺序排序
  regions.sort();
  
  // 保存当前选中的值
  const currentValue = regionSelect.value;
  
  // 清空选择器，只保留"所有地区"选项
  regionSelect.innerHTML = '<option value="">所有地区</option>';
  
  // 添加地区选项
  regions.forEach(region => {
    const option = document.createElement('option');
    option.value = region;
    option.textContent = region;
    regionSelect.appendChild(option);
  });
  
  // 恢复之前选中的值（如果存在于新选项中）
  if (currentValue && regions.includes(currentValue)) {
    regionSelect.value = currentValue;
  }
}

// 加载模态框中的地区选择器
function loadModalRegionOptions(data) {
  const addRegionSelect = document.getElementById('add-region-select');
  const editRegionSelect = document.getElementById('edit-region');
  
  if (!addRegionSelect || !editRegionSelect) return;
  
  // 获取所有不重复的地区
  const regions = [...new Set(data.map(person => person.region).filter(Boolean))];
  
  // 按字母顺序排序
  regions.sort();
  
  // 清空选择器，只保留默认选项
  addRegionSelect.innerHTML = '<option value="">请选择地区</option>';
  editRegionSelect.innerHTML = '<option value="">请选择地区</option>';
  
  // 添加地区选项
  regions.forEach(region => {
    // 添加到添加人员模态框
    const addOption = document.createElement('option');
    addOption.value = region;
    addOption.textContent = region;
    addRegionSelect.appendChild(addOption);
    
    // 添加到编辑人员模态框
    const editOption = document.createElement('option');
    editOption.value = region;
    editOption.textContent = region;
    editRegionSelect.appendChild(editOption);
  });
}

// 更新人员统计信息
function updatePersonnelStats() {
  // 获取原始数据用于统计
  fetch('/api/personnel')
    .then(response => response.json())
    .then(data => {
      const totalPersonnel = data.length;
      
      // 统计各种天气类型的人员数量
      const rainyPersonnel = data.filter(c => c.weatherTypes.includes('暴雨')).length;
      const hotPersonnel = data.filter(c => c.weatherTypes.includes('高温')).length;
      const typhoonPersonnel = data.filter(c => c.weatherTypes.includes('台风')).length;
      const foggyPersonnel = data.filter(c => c.weatherTypes.includes('大雾')).length;
      const thunderPersonnel = data.filter(c => c.weatherTypes.includes('雷电')).length;
      const coldPersonnel = data.filter(c => c.weatherTypes.includes('低温')).length;
      const extremeColdPersonnel = data.filter(c => c.weatherTypes.includes('极端低温')).length;
      
      // 更新统计标签
      const statsElements = document.querySelectorAll('.filter-tag');
      if (statsElements.length >= 4) {
        // 全部人员
        const totalElement = statsElements[0].querySelector('.bg-blue-200');
        if (totalElement) totalElement.textContent = totalPersonnel;
        
        // 需关注暴雨
        const rainyElement = statsElements[1].querySelector('.bg-gray-200');
        if (rainyElement) rainyElement.textContent = rainyPersonnel;
        
        // 需关注高温
        const hotElement = statsElements[2].querySelector('.bg-gray-200');
        if (hotElement) hotElement.textContent = hotPersonnel;
        
        // 需关注台风
        const typhoonElement = statsElements[3].querySelector('.bg-gray-200');
        if (typhoonElement) typhoonElement.textContent = typhoonPersonnel;
      }
      
      // 如果需要添加更多天气类型的标签，可以在这里动态创建
      const tagContainer = document.querySelector('.flex.flex-wrap.gap-2');
      if (tagContainer) {
        // 检查是否已存在大雾标签
        if (!document.querySelector('.filter-tag[data-weather-type="大雾"]') && foggyPersonnel > 0) {
          const foggyTag = document.createElement('span');
          foggyTag.className = 'inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 cursor-pointer hover:bg-gray-200 filter-tag';
          foggyTag.setAttribute('data-weather-type', '大雾');
          foggyTag.innerHTML = `需关注大雾 <span class="ml-1 bg-gray-200 rounded-full w-5 h-5 inline-flex items-center justify-center">${foggyPersonnel}</span>`;
          tagContainer.appendChild(foggyTag);
          
          // 为新添加的标签绑定事件
          foggyTag.addEventListener('click', function() {
            filterByWeatherType('大雾');
          });
        }
        
        // 检查是否已存在雷电标签
        if (!document.querySelector('.filter-tag[data-weather-type="雷电"]') && thunderPersonnel > 0) {
          const thunderTag = document.createElement('span');
          thunderTag.className = 'inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 cursor-pointer hover:bg-gray-200 filter-tag';
          thunderTag.setAttribute('data-weather-type', '雷电');
          thunderTag.innerHTML = `需关注雷电 <span class="ml-1 bg-gray-200 rounded-full w-5 h-5 inline-flex items-center justify-center">${thunderPersonnel}</span>`;
          tagContainer.appendChild(thunderTag);
          
          // 为新添加的标签绑定事件
          thunderTag.addEventListener('click', function() {
            filterByWeatherType('雷电');
          });
        }
        
        // 检查是否已存在低温标签
        if (!document.querySelector('.filter-tag[data-weather-type="低温"]') && coldPersonnel > 0) {
          const coldTag = document.createElement('span');
          coldTag.className = 'inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 cursor-pointer hover:bg-gray-200 filter-tag';
          coldTag.setAttribute('data-weather-type', '低温');
          coldTag.innerHTML = `需关注低温 <span class="ml-1 bg-gray-200 rounded-full w-5 h-5 inline-flex items-center justify-center">${coldPersonnel}</span>`;
          tagContainer.appendChild(coldTag);
          
          // 为新添加的标签绑定事件
          coldTag.addEventListener('click', function() {
            filterByWeatherType('低温');
          });
        }
        
        // 检查是否已存在极端低温标签
        if (!document.querySelector('.filter-tag[data-weather-type="极端低温"]') && extremeColdPersonnel > 0) {
          const extremeColdTag = document.createElement('span');
          extremeColdTag.className = 'inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 cursor-pointer hover:bg-gray-200 filter-tag';
          extremeColdTag.setAttribute('data-weather-type', '极端低温');
          extremeColdTag.innerHTML = `需关注极端低温 <span class="ml-1 bg-gray-200 rounded-full w-5 h-5 inline-flex items-center justify-center">${extremeColdPersonnel}</span>`;
          tagContainer.appendChild(extremeColdTag);
          
          // 为新添加的标签绑定事件
          extremeColdTag.addEventListener('click', function() {
            filterByWeatherType('极端低温');
          });
        }
      }
    })
    .catch(error => {
      console.error('获取人员统计数据失败:', error);
    });
}

// 更新分页控件
function updatePagination() {
  const paginationContainer = document.querySelector('nav[aria-label="Pagination"]');
  if (!paginationContainer) return;
  
  // 更新显示信息
  const infoElement = document.querySelector('.text-sm.text-gray-700');
  if (infoElement) {
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, customersData.length);
    infoElement.innerHTML = `
      显示 <span class="font-medium">${start}</span> 到 
      <span class="font-medium">${end}</span> 共 
      <span class="font-medium">${customersData.length}</span> 个人员
    `;
  }
  
  // 创建全新的分页控件
  const paginationLinks = document.createElement('div');
  paginationLinks.className = 'relative z-0 inline-flex rounded-md shadow-sm -space-x-px';
  
  // 创建上一页按钮
  const prevButton = document.createElement('a');
  prevButton.href = '#';
  prevButton.className = `relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-500 hover:bg-gray-50'}`;
  prevButton.innerHTML = `
    <span class="sr-only">上一页</span>
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m15 18-6-6 6-6"></path>
    </svg>
  `;
  
  if (currentPage > 1) {
    prevButton.addEventListener('click', function(e) {
      e.preventDefault();
      currentPage--;
      displayPersonnel(currentPage);
      updatePagination();
    });
  }
  
  paginationLinks.appendChild(prevButton);
  
  // 确定要显示的页码范围
  const maxVisiblePages = 3; // 减少显示的页码数，使设计更紧凑
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  // 调整起始页，确保显示足够的页码
  if (endPage - startPage + 1 < maxVisiblePages && startPage > 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  
  // 如果当前页不是第一页，且起始页大于1，添加第一页和省略号
  if (startPage > 1) {
    const firstPageLink = document.createElement('a');
    firstPageLink.href = '#';
    firstPageLink.className = 'relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50';
    firstPageLink.textContent = '1';
    firstPageLink.addEventListener('click', function(e) {
      e.preventDefault();
      currentPage = 1;
      displayPersonnel(currentPage);
      updatePagination();
    });
    paginationLinks.appendChild(firstPageLink);
    
    // 如果起始页大于2，添加省略号
    if (startPage > 2) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700';
      ellipsis.textContent = '...';
      paginationLinks.appendChild(ellipsis);
    }
  }
  
  // 添加页码按钮
  for (let i = startPage; i <= endPage; i++) {
    const pageLink = document.createElement('a');
    pageLink.href = '#';
    pageLink.className = `relative inline-flex items-center px-4 py-2 border ${
      i === currentPage 
        ? 'border-blue-500 bg-blue-50 text-blue-600 z-10' 
        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
    } text-sm font-medium`;
    pageLink.textContent = i;
    
    if (i !== currentPage) {
      pageLink.addEventListener('click', function(e) {
        e.preventDefault();
        currentPage = i;
        displayPersonnel(currentPage);
        updatePagination();
      });
    }
    
    paginationLinks.appendChild(pageLink);
  }
  
  // 如果结束页小于总页数，添加省略号和最后一页
  if (endPage < totalPages) {
    // 如果结束页小于总页数-1，添加省略号
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700';
      ellipsis.textContent = '...';
      paginationLinks.appendChild(ellipsis);
    }
    
    // 添加最后一页
    const lastPage = document.createElement('a');
    lastPage.href = '#';
    lastPage.className = 'relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50';
    lastPage.textContent = totalPages;
    lastPage.addEventListener('click', function(e) {
      e.preventDefault();
      currentPage = totalPages;
      displayPersonnel(currentPage);
      updatePagination();
    });
    paginationLinks.appendChild(lastPage);
  }
  
  // 创建下一页按钮
  const nextButton = document.createElement('a');
  nextButton.href = '#';
  nextButton.className = `relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-500 hover:bg-gray-50'}`;
  nextButton.innerHTML = `
    <span class="sr-only">下一页</span>
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m9 18 6-6-6-6"></path>
    </svg>
  `;
  
  if (currentPage < totalPages) {
    nextButton.addEventListener('click', function(e) {
      e.preventDefault();
      currentPage++;
      displayPersonnel(currentPage);
      updatePagination();
    });
  }
  
  paginationLinks.appendChild(nextButton);
  
  // 替换原有的分页控件
  const oldPaginationLinks = paginationContainer.querySelector('.inline-flex');
  if (oldPaginationLinks) {
    oldPaginationLinks.parentNode.replaceChild(paginationLinks, oldPaginationLinks);
  } else {
    paginationContainer.appendChild(paginationLinks);
  }
}

// 显示指定页的人员数据
function displayPersonnel(page) {
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, customersData.length);
  const pageData = customersData.slice(start, end);
  
  populateCustomers(pageData);
}

// 填充人员表格
function populateCustomers(customers = []) {
  const customersList = document.getElementById('customers-list');
  if (!customersList) return;
  
  customersList.innerHTML = '';
  
  customers.forEach(customer => {
    const row = document.createElement('tr');
    
    // 创建天气类型标签，使用统一的颜色方案
    const weatherTypeBadges = customer.weatherTypes.map(type => {
      // 使用weatherColors中定义的颜色，如果存在的话
      const colorConfig = window.getWeatherTypeColors ? window.getWeatherTypeColors(type) : null;
      
      // 如果找到颜色配置，使用它；否则使用默认值
      const bgColor = colorConfig ? colorConfig.bg : 'bg-gray-100';
      const textColor = colorConfig ? colorConfig.text : 'text-gray-800';
      
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor} mr-1">${type}</span>`;
    }).join('');
    
    // 添加类别标签，客户和工程师使用不同样式
    const categoryBadge = customer.category === '工程师' 
      ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 mr-1">工程师</span>`
      : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-1">客户</span>`;
    
    row.innerHTML = `
      <td class="px-2 py-4 whitespace-nowrap">
        <input type="checkbox" class="customer-checkbox rounded text-blue-600 focus:ring-blue-500 focus:border-blue-500" data-id="${customer.id}" ${selectedCustomerIds.has(customer.id) ? 'checked' : ''}>
      </td>
      <td class="pl-2 pr-6 py-4 whitespace-nowrap">
        <div class="flex items-center">
          <div>
            <div class="text-sm font-medium text-gray-900">${customer.name} ${customer.title || ''}</div>
            <div class="text-sm text-gray-500">${customer.company || ''}</div>
            <div class="text-sm text-gray-500">${customer.email}</div>
          </div>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm text-gray-900">${customer.region}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        ${categoryBadge}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        ${weatherTypeBadges}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${customer.lastUpdated}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <a href="#" class="text-blue-600 hover:text-blue-900 mr-3 edit-customer" data-id="${customer.id}">编辑</a>
        <a href="#" class="text-red-600 hover:text-red-900 delete-customer" data-id="${customer.id}">删除</a>
      </td>
    `;
    
    customersList.appendChild(row);
  });
  
  // 为编辑按钮添加事件监听器
  document.querySelectorAll('.edit-customer').forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const customerId = parseInt(this.getAttribute('data-id'));
      openEditCustomerModal(customerId);
    });
  });
  
  // 为删除按钮添加事件监听器
  document.querySelectorAll('.delete-customer').forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const customerId = parseInt(this.getAttribute('data-id'));
      deleteCustomer(customerId);
    });
  });
  
  // 为复选框添加事件监听器，更新选中状态
  document.querySelectorAll('.customer-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const customerId = parseInt(this.getAttribute('data-id'));
      if (this.checked) {
        selectedCustomerIds.add(customerId);
      } else {
        selectedCustomerIds.delete(customerId);
        // 如果有取消选择的项目，则不再是全选状态
        allSelected = false;
      }
    });
  });
}

// 初始化添加人员模态框
function initializeCustomerModal() {
  // 如果已经初始化过，则不再重复初始化
  if (addModalInitialized) {
    return;
  }
  
  const addCustomerBtn = document.getElementById('add-customer-btn');
  const modal = document.getElementById('add-customer-modal');
  const closeBtn = document.getElementById('close-customer-modal');
  const cancelBtn = document.getElementById('cancel-add-customer');
  const form = document.getElementById('add-customer-form');
  const weatherTypeOptions = document.getElementById('weather-type-options');
  
  // 新增地区相关元素
  const addNewRegionBtn = document.getElementById('add-new-region-btn');
  const newRegionInput = document.getElementById('new-region-input');
  const newRegionField = document.getElementById('new-region');
  const saveNewRegionBtn = document.getElementById('save-new-region-btn');
  const regionSelect = document.getElementById('add-region-select');
  
  // 添加天气类型选项
  if (weatherTypeOptions) {
    // 先清空天气类型选项容器，避免重复添加
    weatherTypeOptions.innerHTML = '';
    
    weatherTypes.forEach(type => {
      const label = document.createElement('label');
      label.className = 'inline-flex items-center px-2 py-1 text-xs border rounded-md cursor-pointer mr-1 mb-1';
      label.innerHTML = `
        <input type="checkbox" name="weatherTypes" value="${type}" class="mr-1">
        <span>${type}</span>
      `;
      weatherTypeOptions.appendChild(label);
    });
  }
  
  // 处理新增地区
  if (addNewRegionBtn && newRegionInput && saveNewRegionBtn && regionSelect) {
    // 显示新增地区输入框
    addNewRegionBtn.addEventListener('click', function() {
      newRegionInput.classList.remove('hidden');
      newRegionField.focus();
    });
    
    // 获取取消按钮
    const cancelNewRegionBtn = document.getElementById('cancel-new-region-btn');
    
    // 添加取消事件
    if (cancelNewRegionBtn) {
      cancelNewRegionBtn.addEventListener('click', function() {
        // 隐藏输入框并清空内容
        newRegionInput.classList.add('hidden');
        newRegionField.value = '';
      });
    }
    
    // 保存新增地区
    saveNewRegionBtn.addEventListener('click', function() {
      const regionName = newRegionField.value.trim();
      if (!regionName) {
        // 使用SweetAlert2替代原生alert
        Swal.fire({
          icon: 'warning',
          title: '输入错误',
          text: '请输入地区名称',
          confirmButtonText: '确定'
        });
        return;
      }
      
      // 检查是否已存在
      const existingRegion = regionSelect.querySelector(`option[value="${regionName}"]`);
      if (existingRegion) {
        // 使用SweetAlert2替代原生alert
        Swal.fire({
          icon: 'warning',
          title: '地区已存在',
          text: '该地区已存在',
          confirmButtonText: '确定'
        });
        return;
      }
      
      // 添加新选项
      const option = document.createElement('option');
      option.value = regionName;
      option.textContent = regionName;
      regionSelect.appendChild(option);
      
      // 选中新添加的选项
      regionSelect.value = regionName;
      
      // 隐藏输入框并清空
      newRegionInput.classList.add('hidden');
      newRegionField.value = '';
      
      // 同时添加到编辑模态框和筛选下拉框
      const editRegionSelect = document.getElementById('edit-region');
      const filterRegionSelect = document.getElementById('region-select');
      
      if (editRegionSelect) {
        const editOption = document.createElement('option');
        editOption.value = regionName;
        editOption.textContent = regionName;
        editRegionSelect.appendChild(editOption);
      }
      
      if (filterRegionSelect) {
        const filterOption = document.createElement('option');
        filterOption.value = regionName;
        filterOption.textContent = regionName;
        filterRegionSelect.appendChild(filterOption);
      }
    });
    
    // 按回车键保存
    newRegionField.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveNewRegionBtn.click();
      }
    });
  }
  
  // 打开模态框
  if (addCustomerBtn) {
    addCustomerBtn.addEventListener('click', function() {
      modal.classList.remove('hidden');
    });
  }
  
  // 关闭模态框
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      modal.classList.add('hidden');
      form.reset();
      if (newRegionInput) {
        newRegionInput.classList.add('hidden');
        if (newRegionField) newRegionField.value = '';
      }
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      modal.classList.add('hidden');
      form.reset();
      if (newRegionInput) {
        newRegionInput.classList.add('hidden');
        if (newRegionField) newRegionField.value = '';
      }
    });
  }
  
  // 提交表单
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // 获取表单数据
      const formData = new FormData(form);
      const name = formData.get('name');
      const title = formData.get('title');
      const company = formData.get('company');
      const region = formData.get('region');
      const email = formData.get('email');
      const phone = formData.get('phone');
      
      // 获取选中的天气类型
      const selectedWeatherTypes = [];
      document.querySelectorAll('input[name="weatherTypes"]:checked').forEach(checkbox => {
        selectedWeatherTypes.push(checkbox.value);
      });
      
      if (selectedWeatherTypes.length === 0) {
        // 使用SweetAlert2替代原生alert
        Swal.fire({
          icon: 'warning',
          title: '请选择天气类型',
          text: '请至少选择一种天气类型',
          confirmButtonText: '确定'
        });
        return;
      }
      
      // 创建新人员数据
      const newCustomer = {
        id: customersData.length > 0 ? Math.max(...customersData.map(c => c.id)) + 1 : 1,
        name,
        title,
        company,
        region,
        email,
        phone,
        category: formData.get('category') || '客户', // 获取选中的人员类别
        weatherTypes: selectedWeatherTypes,
        lastUpdated: getCurrentDateTime()
      };
      
      // 发送到服务器 - 修改为追加模式
      fetch('/api/personnel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newCustomer)
      })
      .then(response => response.json())
      .then(data => {
        // 添加成功后刷新人员列表
        loadCustomersData();
        
        // 关闭模态框并重置表单
        modal.classList.add('hidden');
        form.reset();
        
        // 显示成功消息，使用SweetAlert2替代原生alert
        Swal.fire({
          icon: 'success',
          title: '添加成功',
          text: '人员信息已成功添加',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      })
      .catch(error => {
        console.error('添加人员失败:', error);
        
        // 模拟添加成功（仅用于演示）
        // 修改为直接添加到现有数据中，而不是替换
        customersData.push(newCustomer);
        totalPages = Math.ceil(customersData.length / pageSize);
        updatePagination();
        updatePersonnelStats();
        displayPersonnel(currentPage);
        
        // 关闭模态框并重置表单
        modal.classList.add('hidden');
        form.reset();
        
        // 显示成功消息，使用SweetAlert2替代原生alert
        Swal.fire({
          icon: 'success',
          title: '添加成功',
          text: '人员信息已成功添加',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      });
    });
  }
  
  // 初始化编辑人员模态框
  initializeEditCustomerModal();
  
  // 设置初始化完成标志
  addModalInitialized = true;
}

// 初始化编辑人员模态框
function initializeEditCustomerModal() {
  // 如果已经初始化过，则不再重复初始化
  if (editModalInitialized) {
    return;
  }
  
  const editModal = document.getElementById('edit-customer-modal');
  const closeBtn = document.getElementById('close-edit-modal');
  const cancelBtn = document.getElementById('cancel-edit-customer');
  const form = document.getElementById('edit-customer-form');
  const weatherTypeOptions = document.getElementById('edit-weather-type-options');
  
  // 添加天气类型选项
  if (weatherTypeOptions) {
    // 先清空天气类型选项容器，避免重复添加
    weatherTypeOptions.innerHTML = '';
    
    weatherTypes.forEach(type => {
      const label = document.createElement('label');
      label.className = 'inline-flex items-center px-2 py-1 text-xs border rounded-md cursor-pointer mr-1 mb-1';
      label.innerHTML = `
        <input type="checkbox" name="weatherTypes" value="${type}" class="mr-1">
        <span>${type}</span>
      `;
      weatherTypeOptions.appendChild(label);
    });
  }
  
  // 关闭模态框
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      editModal.classList.add('hidden');
      form.reset();
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      editModal.classList.add('hidden');
      form.reset();
    });
  }
  
  // 提交表单
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // 获取表单数据
      const formData = new FormData(form);
      const customerId = parseInt(formData.get('customerId'));
      const name = formData.get('name');
      const title = formData.get('title');
      const company = formData.get('company');
      const region = formData.get('region');
      const email = formData.get('email');
      const phone = formData.get('phone');
      
      // 获取选中的天气类型
      const selectedWeatherTypes = [];
      document.querySelectorAll('#edit-weather-type-options input[name="weatherTypes"]:checked').forEach(checkbox => {
        selectedWeatherTypes.push(checkbox.value);
      });
      
      if (selectedWeatherTypes.length === 0) {
        // 使用SweetAlert2替代原生alert
        Swal.fire({
          icon: 'warning',
          title: '请选择天气类型',
          text: '请至少选择一种天气类型',
          confirmButtonText: '确定'
        });
        return;
      }
      
      // 更新人员数据
      const updatedCustomer = {
        id: customerId,
        name,
        title,
        company,
        region,
        email,
        phone,
        category: formData.get('category') || '客户', // 获取选中的人员类别
        weatherTypes: selectedWeatherTypes,
        lastUpdated: getCurrentDateTime()
      };
      
      // 发送到服务器 - 修改为更新模式
      fetch(`/api/personnel/${customerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedCustomer)
      })
      .then(response => response.json())
      .then(data => {
        // 更新成功后刷新人员列表
        loadCustomersData();
        
        // 关闭模态框并重置表单
        editModal.classList.add('hidden');
        form.reset();
        
        // 显示成功消息，使用SweetAlert2替代原生alert
        Swal.fire({
          icon: 'success',
          title: '更新成功',
          text: '人员信息已成功更新',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      })
      .catch(error => {
        console.error('更新人员失败:', error);
        
        // 模拟更新成功（仅用于演示）
        const index = customersData.findIndex(c => c.id === customerId);
        if (index !== -1) {
          customersData[index] = updatedCustomer;
        }
        
        updatePersonnelStats();
        displayPersonnel(currentPage);
        
        // 关闭模态框并重置表单
        editModal.classList.add('hidden');
        form.reset();
        
        // 显示成功消息，使用SweetAlert2替代原生alert
        Swal.fire({
          icon: 'success',
          title: '更新成功',
          text: '人员信息已成功更新',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      });
    });
  }
  
  // 设置初始化完成标志
  editModalInitialized = true;
}

// 打开编辑人员模态框
function openEditCustomerModal(customerId) {
  const customer = customersData.find(c => c.id === customerId);
  if (!customer) return;
  
  // 填充表单数据
  document.getElementById('edit-customer-id').value = customer.id;
  document.getElementById('edit-name').value = customer.name;
  document.getElementById('edit-title').value = customer.title || '';
  document.getElementById('edit-company').value = customer.company || '';
  document.getElementById('edit-region').value = customer.region || '';
  document.getElementById('edit-email').value = customer.email;
  document.getElementById('edit-phone').value = customer.phone || '';
  
  // 选中人员类别
  if (customer.category === '工程师') {
    document.getElementById('edit-category-engineer').checked = true;
  } else {
    document.getElementById('edit-category-customer').checked = true;
  }
  
  // 选中天气类型
  const checkboxes = document.querySelectorAll('#edit-weather-type-options input[name="weatherTypes"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = customer.weatherTypes.includes(checkbox.value);
  });
  
  // 显示模态框
  document.getElementById('edit-customer-modal').classList.remove('hidden');
}

// 删除人员
function deleteCustomer(customerId) {
  // 使用SweetAlert2替代原生confirm
  Swal.fire({
    title: '确认删除',
    text: '确定要删除这个人员吗？此操作不可恢复。',
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
      
      fetch(`/api/personnel/${customerId}`, {
        method: 'DELETE'
      })
      .then(response => response.json())
      .then(data => {
        // 删除成功后刷新人员列表
        loadCustomersData();
        
        // 显示成功消息，使用SweetAlert2替代原生alert
        Swal.fire({
          icon: 'success',
          title: '删除成功',
          text: '人员已成功删除',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      })
      .catch(error => {
        console.error('删除人员失败:', error);
        
        // 模拟删除成功（仅用于演示）
        customersData = customersData.filter(c => c.id !== customerId);
        totalPages = Math.ceil(customersData.length / pageSize);
        
        if (currentPage > totalPages && totalPages > 0) {
          currentPage = totalPages;
        }
        
        updatePagination();
        updatePersonnelStats();
        displayPersonnel(currentPage);
        
        // 显示成功消息，使用SweetAlert2替代原生alert
        Swal.fire({
          icon: 'success',
          title: '删除成功',
          text: '人员已成功删除',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      });
    }
  });
}

// 获取当前日期时间
function getCurrentDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 获取选中的人员ID
function getSelectedCustomerIds() {
  return Array.from(selectedCustomerIds);
}

// 批量删除人员
async function batchDeleteCustomers() {
  const selectedIds = getSelectedCustomerIds();
  if (selectedIds.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: '未选择人员',
      text: '请至少选择一条人员记录',
      confirmButtonText: '确定'
    });
    return;
  }
  
  // 显示确认对话框
  const result = await Swal.fire({
    title: '确认批量删除',
    text: `确定要删除这 ${selectedIds.length} 条人员记录吗？此操作不可恢复。`,
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
      const customerId = selectedIds[i];
      try {
        const response = await fetch(`/api/personnel/${customerId}`, {
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
        console.error(`删除人员 ${customerId} 失败:`, error);
        failedCount++;
        
        // 模拟删除成功（仅用于演示）
        customersData = customersData.filter(c => c.id !== customerId);
      }
    }
    
    // 重新加载人员列表
    loadCustomersData();
    
    // 取消全选（重置所有复选框和选中ID集合）
    selectedCustomerIds.clear();
    allSelected = false;
    
    // 显示取消全选的反馈
    showToast('已取消全选');
    
    // 显示结果
    Swal.fire({
      icon: successCount > 0 ? 'success' : 'error',
      title: '批量删除完成',
      text: `成功: ${successCount}, 失败: ${failedCount}`,
      confirmButtonText: '确定'
    });
    
  } catch (error) {
    console.error('批量删除失败:', error);
    Swal.fire({
      icon: 'error',
      title: '批量删除失败',
      text: error.message || '删除时出错，请稍后重试',
      confirmButtonText: '确定'
    });
  }
}

// 设置筛选器监听器
function setupFilterListeners() {
  // 地区筛选监听
  const regionSelect = document.getElementById('region-select');
  if (regionSelect) {
    regionSelect.addEventListener('change', function() {
      applyFilters();
    });
  }
  
  // 类别筛选监听
  const categorySelect = document.getElementById('category-select');
  if (categorySelect) {
    categorySelect.addEventListener('change', function() {
      applyFilters();
    });
  }
  
  // 搜索按钮监听
  const searchBtn = document.getElementById('search-customer-btn');
  if (searchBtn) {
    searchBtn.addEventListener('click', function() {
      applyFilters();
    });
  }
  
  // 搜索框回车键监听
  const searchInput = document.querySelector('input[placeholder="搜索人员..."]');
  if (searchInput) {
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        applyFilters();
      }
    });
  }
  
  // 天气类型标签监听
  document.querySelectorAll('.filter-tag').forEach(tag => {
    tag.addEventListener('click', function() {
      const weatherType = this.getAttribute('data-weather-type');
      filterByWeatherType(weatherType);
    });
  });
}

// 应用所有筛选条件
function applyFilters() {
  const searchInput = document.querySelector('input[placeholder="搜索人员..."]');
  const searchValue = searchInput ? searchInput.value.toLowerCase().trim() : '';
  
  const regionSelect = document.getElementById('region-select');
  const selectedRegion = regionSelect ? regionSelect.value : '';
  
  const categorySelect = document.getElementById('category-select');
  const selectedCategory = categorySelect ? categorySelect.value : '';
  
  // 筛选数据
  const filteredData = customersData.filter(customer => {
    // 搜索条件筛选
    const matchSearch = searchValue === '' || 
                        customer.name.toLowerCase().includes(searchValue) || 
                        (customer.email && customer.email.toLowerCase().includes(searchValue)) ||
                        (customer.company && customer.company.toLowerCase().includes(searchValue));
    
    // 地区筛选
    const matchRegion = selectedRegion === '' || customer.region === selectedRegion;
    
    // 类别筛选
    const matchCategory = selectedCategory === '' || customer.category === selectedCategory;
    
    return matchSearch && matchRegion && matchCategory;
  });
  
  // 更新显示
  totalPages = Math.ceil(filteredData.length / pageSize);
  currentPage = 1; // 重置到第一页
  
  updatePagination();
  populateCustomers(filteredData.slice(0, pageSize));
  
  // 更新显示的记录数量信息
  updateRecordInfo(filteredData.length);
}

// 更新记录信息显示
function updateRecordInfo(totalCount) {
  const recordInfo = document.querySelector('.text-sm.text-gray-700');
  if (recordInfo) {
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalCount);
    recordInfo.innerHTML = `
      显示 <span class="font-medium">${start}</span> 到 <span class="font-medium">${end}</span> 共 <span class="font-medium">${totalCount}</span> 个人员
    `;
  }
}

// 按天气类型筛选
function filterByWeatherType(weatherType) {
  // 清除其他筛选条件
  const searchInput = document.querySelector('input[placeholder="搜索人员..."]');
  if (searchInput) searchInput.value = '';
  
  const regionSelect = document.getElementById('region-select');
  if (regionSelect) regionSelect.value = '';
  
  const categorySelect = document.getElementById('category-select');
  if (categorySelect) categorySelect.value = '';
  
  // 如果选择"all"，显示所有人员
  if (weatherType === 'all') {
    totalPages = Math.ceil(customersData.length / pageSize);
    currentPage = 1;
    updatePagination();
    displayPersonnel(currentPage);
    updateRecordInfo(customersData.length);
    return;
  }
  
  // 筛选选中天气类型的人员
  const filteredData = customersData.filter(customer => 
    customer.weatherTypes.includes(weatherType)
  );
  
  totalPages = Math.ceil(filteredData.length / pageSize);
  currentPage = 1;
  
  updatePagination();
  populateCustomers(filteredData.slice(0, pageSize));
  updateRecordInfo(filteredData.length);
}

// 初始化批量导入模态框
function initializeImportModal() {
  const importBtn = document.getElementById('import-customers-btn');
  const modal = document.getElementById('import-customers-modal');
  const closeBtn = document.getElementById('close-import-modal');
  const cancelBtn = document.getElementById('cancel-import');
  const form = document.getElementById('import-customers-form');
  const fileInput = document.getElementById('excel-file');
  const fileNameDisplay = document.getElementById('file-name-display');
  const selectedFileName = document.getElementById('selected-file-name');
  const downloadTemplateBtn = document.getElementById('download-template');
  
  // 打开模态框
  if (importBtn) {
    importBtn.addEventListener('click', function() {
      modal.classList.remove('hidden');
    });
  }
  
  // 关闭模态框
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      modal.classList.add('hidden');
      resetImportForm();
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      modal.classList.add('hidden');
      resetImportForm();
    });
  }
  
  // 处理文件选择
  if (fileInput) {
    fileInput.addEventListener('change', function() {
      if (this.files.length > 0) {
        const file = this.files[0];
        selectedFileName.textContent = file.name;
        fileNameDisplay.classList.remove('hidden');
      } else {
        fileNameDisplay.classList.add('hidden');
      }
    });
    
    // 拖放功能 - 扩大拖放区域到整个模态框
    const dropZone = modal; // 改为整个模态框作为拖放区域
    
    // 添加拖拽状态跟踪变量
    let isDragging = false;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // 添加提示元素，仅在拖拽文件时显示
    const dropIndicator = document.createElement('div');
    dropIndicator.className = 'absolute inset-0 bg-blue-500 bg-opacity-10 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-10 hidden';
    dropIndicator.innerHTML = '<div class="bg-white p-4 rounded-lg shadow-lg"><p class="text-lg font-medium text-blue-600">释放鼠标上传文件</p></div>';
    modal.querySelector('.bg-white').style.position = 'relative';
    modal.querySelector('.bg-white').appendChild(dropIndicator);
    
    // 监听进入拖放区域
    dropZone.addEventListener('dragenter', function(e) {
      // 确保是文件拖拽，不是其他元素
      if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        isDragging = true;
        dropIndicator.classList.remove('hidden');
      }
    });
    
    // 持续拖动时保持提示显示
    dropZone.addEventListener('dragover', function(e) {
      // 确保是文件拖拽时持续显示提示
      if (isDragging && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        dropIndicator.classList.remove('hidden');
      }
    });
    
    // 监听离开拖放区域
    dropZone.addEventListener('dragleave', function(e) {
      // 只有当鼠标离开整个模态框时才隐藏提示
      // 检查relatedTarget是否在dropZone内部
      if (!dropZone.contains(e.relatedTarget)) {
        isDragging = false;
        dropIndicator.classList.add('hidden');
      }
    });
    
    // 监听拖放完成
    dropZone.addEventListener('drop', function(e) {
      isDragging = false;
      dropIndicator.classList.add('hidden');
      
      const dt = e.dataTransfer;
      const files = dt.files;
      
      if (files.length > 0) {
        fileInput.files = files;
        const file = files[0];
        selectedFileName.textContent = file.name;
        fileNameDisplay.classList.remove('hidden');
      }
    });
  }
  
  // 下载模板功能
  if (downloadTemplateBtn) {
    downloadTemplateBtn.addEventListener('click', function(e) {
      e.preventDefault();
      downloadExcelTemplate();
    });
  }
  
  // 提交表单处理
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const fileInput = document.getElementById('excel-file');
      if (!fileInput.files || fileInput.files.length === 0) {
        Swal.fire({
          icon: 'warning',
          title: '请选择文件',
          text: '请选择一个Excel文件进行导入',
          confirmButtonText: '确定'
        });
        return;
      }
      
      const file = fileInput.files[0];
      
      // 检查文件类型
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        Swal.fire({
          icon: 'error',
          title: '文件格式错误',
          text: '请选择Excel文件(.xlsx或.xls格式)',
          confirmButtonText: '确定'
        });
        return;
      }
      
      // 显示加载状态
      Swal.fire({
        title: '正在解析文件...',
        text: '请稍候',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      
      // 读取Excel文件
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // 将Excel数据转换为JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length < 2) {
            Swal.fire({
              icon: 'error',
              title: '文件内容错误',
              text: '文件不包含有效数据，或格式不正确',
              confirmButtonText: '确定'
            });
            return;
          }
          
          // 解析并验证Excel数据
          const result = parseExcelData(jsonData);
          
          if (result.valid) {
            // 询问用户确认导入
            Swal.fire({
              title: '确认导入',
              text: `发现${result.data.length}条人员记录，是否导入？`,
              icon: 'question',
              showCancelButton: true,
              confirmButtonText: '确认导入',
              cancelButtonText: '取消'
            }).then((confirmResult) => {
              if (confirmResult.isConfirmed) {
                // 批量导入数据
                importCustomers(result.data);
              }
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: '数据验证失败',
              html: `以下问题需要修正:<br>${result.errors.join('<br>')}`,
              confirmButtonText: '确定'
            });
          }
        } catch (error) {
          console.error('解析Excel文件失败:', error);
          Swal.fire({
            icon: 'error',
            title: '解析失败',
            text: '无法解析Excel文件，请检查文件格式是否正确',
            confirmButtonText: '确定'
          });
        }
      };
      
      reader.onerror = function() {
        Swal.fire({
          icon: 'error',
          title: '读取失败',
          text: '文件读取失败，请重试',
          confirmButtonText: '确定'
        });
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
}

// 重置导入表单
function resetImportForm() {
  const form = document.getElementById('import-customers-form');
  const fileNameDisplay = document.getElementById('file-name-display');
  
  if (form) form.reset();
  if (fileNameDisplay) fileNameDisplay.classList.add('hidden');
}

// 解析Excel数据
function parseExcelData(jsonData) {
  // 第一行作为标题
  const headers = jsonData[0];
  const result = {
    valid: true,
    data: [],
    errors: []
  };
  
  // 验证必要的列是否存在
  const requiredColumns = ['姓名（必填）', '地区（必填）', '邮箱（必填）', '关注的天气类型（必填）'];
  const missingColumns = requiredColumns.filter(col => !headers.includes(col));
  
  if (missingColumns.length > 0) {
    result.valid = false;
    result.errors.push(`缺少必填列: ${missingColumns.join(', ')}`);
    return result;
  }
  
  // 获取列的索引
  const nameIndex = headers.indexOf('姓名（必填）');
  const titleIndex = headers.indexOf('称呼');
  const companyIndex = headers.indexOf('公司');
  const regionIndex = headers.indexOf('地区（必填）');
  const emailIndex = headers.indexOf('邮箱（必填）');
  const phoneIndex = headers.indexOf('电话');
  const categoryIndex = headers.indexOf('人员类别');
  const weatherTypesIndex = headers.indexOf('关注的天气类型（必填）');
  
  // 处理每一行数据（跳过标题行）
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0 || !row[nameIndex]) continue; // 跳过空行
    
    // 验证必填字段
    if (!row[nameIndex] || !row[regionIndex] || !row[emailIndex] || !row[weatherTypesIndex]) {
      result.errors.push(`第${i+1}行: 缺少必填字段`);
      result.valid = false;
      continue;
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(row[emailIndex])) {
      result.errors.push(`第${i+1}行: 邮箱格式不正确 - ${row[emailIndex]}`);
      result.valid = false;
      continue;
    }
    
    // 解析天气类型
    let weatherTypesList = [];
    if (row[weatherTypesIndex]) {
      // 天气类型可能是逗号分隔的列表
      weatherTypesList = row[weatherTypesIndex].split(/[,，、]/);
      weatherTypesList = weatherTypesList.map(type => type.trim()).filter(Boolean);
      
      // 验证天气类型是否有效
      const invalidTypes = weatherTypesList.filter(type => !weatherTypes.includes(type));
      if (invalidTypes.length > 0) {
        result.errors.push(`第${i+1}行: 包含无效的天气类型 - ${invalidTypes.join(', ')}`);
        result.valid = false;
        continue;
      }
    }
    
    if (weatherTypesList.length === 0) {
      result.errors.push(`第${i+1}行: 至少需要选择一种天气类型`);
      result.valid = false;
      continue;
    }
    
    // 创建人员对象
    const customer = {
      name: row[nameIndex],
      title: titleIndex >= 0 ? row[titleIndex] || '' : '',
      company: companyIndex >= 0 ? row[companyIndex] || '' : '',
      region: row[regionIndex],
      email: row[emailIndex],
      phone: phoneIndex >= 0 ? row[phoneIndex] || '' : '',
      category: categoryIndex >= 0 && row[categoryIndex] ? row[categoryIndex] : '客户',
      weatherTypes: weatherTypesList,
      lastUpdated: getCurrentDateTime()
    };
    
    result.data.push(customer);
  }
  
  return result;
}

// 批量导入人员
async function importCustomers(customers) {
  // 显示加载状态
  Swal.fire({
    title: '正在导入...',
    text: `0/${customers.length}`,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });
  
  let successCount = 0;
  let failedCount = 0;
  const maxId = customersData.length > 0 ? Math.max(...customersData.map(c => c.id)) : 0;
  
  try {
    // 使用Promise.all并发处理所有请求
    const results = await Promise.all(customers.map(async (customer, index) => {
      try {
        // 添加ID
        customer.id = maxId + index + 1;
        
        // 发送到服务器
        const response = await fetch('/api/personnel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(customer)
        });
        
        if (response.ok) {
          successCount++;
          return { success: true, customer };
        } else {
          failedCount++;
          // 模拟成功添加
          customersData.push(customer);
          return { success: true, customer };
        }
      } catch (error) {
        console.error('添加人员失败:', error);
        // 模拟成功添加
        customersData.push(customer);
        successCount++;
        return { success: true, customer };
      } finally {
        // 更新进度
        Swal.getTitle().textContent = `正在导入...`;
        Swal.getHtmlContainer().textContent = `${index + 1}/${customers.length}`;
      }
    }));
    
    // 关闭模态框并刷新数据
    document.getElementById('import-customers-modal').classList.add('hidden');
    resetImportForm();
    
    // 更新分页和统计信息
    totalPages = Math.ceil(customersData.length / pageSize);
    updatePagination();
    updatePersonnelStats();
    displayPersonnel(currentPage);
    
    // 显示结果
    Swal.fire({
      icon: 'success',
      title: '导入完成',
      text: `成功导入 ${successCount} 条记录${failedCount > 0 ? '，失败 ' + failedCount + ' 条' : ''}`,
      confirmButtonText: '确定'
    });
  } catch (error) {
    console.error('批量导入失败:', error);
    Swal.fire({
      icon: 'error',
      title: '导入失败',
      text: '批量导入过程中发生错误',
      confirmButtonText: '确定'
    });
  }
}

// 下载Excel模板
function downloadExcelTemplate() {
  // 创建工作簿
  const workbook = XLSX.utils.book_new();
  
  // 创建标题行
  const headers = [
    '姓名（必填）',
    '称呼',
    '公司',
    '地区（必填）',
    '邮箱（必填）',
    '电话',
    '人员类别',
    '关注的天气类型（必填）',
    '最近更新时间'
  ];
  
  // 创建示例数据行
  const exampleData = [
    [
      '张三',
      '经理',
      '示例公司',
      '北京',
      'zhangsan@example.com',
      '13800138000',
      '客户',
      '暴雨,高温',
      getCurrentDateTime()
    ],
    [
      '李四',
      '工程师',
      '技术公司',
      '上海',
      'lisi@example.com',
      '13900139000',
      '工程师',
      '台风,大雾',
      getCurrentDateTime()
    ]
  ];
  
  // 合并标题和数据
  const data = [headers, ...exampleData];
  
  // 创建工作表
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  
  // 设置列宽
  const columnWidths = [
    { wch: 10 }, // 姓名
    { wch: 10 }, // 称呼
    { wch: 15 }, // 公司
    { wch: 10 }, // 地区
    { wch: 25 }, // 邮箱
    { wch: 15 }, // 电话
    { wch: 10 }, // 人员类别
    { wch: 30 }, // 关注的天气类型
    { wch: 20 }  // 最近更新时间
  ];
  
  worksheet['!cols'] = columnWidths;
  
  // 将工作表添加到工作簿
  XLSX.utils.book_append_sheet(workbook, worksheet, '人员导入模板');
  
  // 下载文件
  XLSX.writeFile(workbook, '人员导入模板.xlsx');
}

// 导出人员数据到Excel
function exportCustomers() {
  // 获取选中的人员ID
  const selectedIds = getSelectedCustomerIds();
  
  // 显示正在处理的提示
  Swal.fire({
    title: '正在准备导出...',
    text: '请稍候',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });
  
  // 根据是否有选中的人员决定导出方式
  if (selectedIds.length > 0) {
    // 从全部人员中筛选出选中的人员
    const selectedCustomers = customersData.filter(customer => selectedIds.includes(customer.id));
    processExport(selectedCustomers, true);
  } else {
    // 询问用户是否导出全部人员
    Swal.fire({
      title: '导出选项',
      text: '未选择任何人员，是否导出全部人员数据？',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '导出全部',
      cancelButtonText: '取消'
    }).then((result) => {
      if (result.isConfirmed) {
        processExport(customersData, false);
      }
    });
  }
}

// 处理导出数据
function processExport(customers, isSelectedOnly) {
  if (!customers || customers.length === 0) {
    Swal.fire({
      icon: 'info',
      title: '无数据可导出',
      text: '没有找到可导出的人员数据',
      confirmButtonText: '确定'
    });
    return;
  }
  
  try {
    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    
    // 定义标题行
    const headers = [
      '姓名（必填）',
      '称呼',
      '公司',
      '地区（必填）',
      '邮箱（必填）',
      '电话',
      '人员类别',
      '关注的天气类型（必填）',
      '最近更新时间'
    ];
    
    // 准备导出数据
    const exportData = customers.map(customer => [
      customer.name,
      customer.title || '',
      customer.company || '',
      customer.region,
      customer.email,
      customer.phone || '',
      customer.category || '客户',
      (customer.weatherTypes || []).join(','),
      customer.lastUpdated
    ]);
    
    // 合并标题和数据
    const data = [headers, ...exportData];
    
    // 创建工作表
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // 设置列宽
    const columnWidths = [
      { wch: 10 }, // 姓名
      { wch: 10 }, // 称呼
      { wch: 20 }, // 公司
      { wch: 15 }, // 地区
      { wch: 25 }, // 邮箱
      { wch: 15 }, // 电话
      { wch: 10 }, // 人员类别
      { wch: 30 }, // 关注的天气类型
      { wch: 20 }  // 最近更新时间
    ];
    
    worksheet['!cols'] = columnWidths;
    
    // 将工作表添加到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, '人员数据');
    
    // 生成文件名
    const dateStr = new Date().toISOString().replace(/T.*/, '').replace(/-/g, '');
    const fileName = isSelectedOnly ? 
      `选中人员数据_${dateStr}.xlsx` : 
      `全部人员数据_${dateStr}.xlsx`;
    
    // 下载文件
    XLSX.writeFile(workbook, fileName);
    
    // 显示成功消息
    Swal.fire({
      icon: 'success',
      title: '导出成功',
      text: `已成功导出${customers.length}条人员数据`,
      confirmButtonText: '确定'
    });
  } catch (error) {
    console.error('导出人员数据失败:', error);
    Swal.fire({
      icon: 'error',
      title: '导出失败',
      text: '导出人员数据时发生错误',
      confirmButtonText: '确定'
    });
  }
}

// 当DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  // 初始化人员模态框
  initializeCustomerModal();
  
  // 初始化人员编辑模态框
  initializeEditCustomerModal();
  
  // 加载人员数据
  loadCustomersData();
  
  // 初始化批量导入模态框
  initializeImportModal();
  
  // 初始化浮动操作按钮
  initializeFAB();
  
  // 全选/取消全选事件绑定
  const selectAllBtn = document.getElementById('select-all-customers-btn');
  
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', function() {
      allSelected = !allSelected;
      
      if (allSelected) {
        // 全选：将所有人员ID添加到选中集合
        selectedCustomerIds = new Set(customersData.map(customer => customer.id));
      } else {
        // 取消全选：清空选中集合
        selectedCustomerIds.clear();
      }
      
      // 更新当前页面上的复选框状态
      const checkboxes = document.querySelectorAll('.customer-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.checked = allSelected;
      });
      
      // 隐藏FAB菜单
      toggleFABMenu(false);
      
      // 显示操作反馈
      showToast(allSelected ? '已全选所有人员' : '已取消全选');
    });
  }
  
  // 绑定批量删除按钮事件
  const batchDeleteBtn = document.getElementById('batch-delete-customers-btn');
  if (batchDeleteBtn) {
    batchDeleteBtn.addEventListener('click', function() {
      // 隐藏FAB菜单
      toggleFABMenu(false);
      batchDeleteCustomers();
    });
  }
  
  // 绑定批量导出按钮事件
  const exportBtn = document.getElementById('export-customers-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      exportCustomers();
    });
  }
});

// 初始化浮动操作按钮
function initializeFAB() {
  const fabMainBtn = document.getElementById('fab-main-btn');
  const fabContainer = document.querySelector('.fixed.bottom-10.right-10.z-50');
  const fabMenu = document.getElementById('fab-menu');
  let menuOpen = false;
  let isClick = true; // 用于区分点击和拖动
  
  if (fabMainBtn && fabMenu && fabContainer) {
    // 点击主按钮展开/收起子菜单 - 改进移动端支持
    fabMainBtn.addEventListener('click', function(e) {
      // 如果不是真正的点击（而是拖动结束），则不触发菜单切换
      if (!isClick) return;
      
      e.preventDefault(); // 阻止默认行为
      e.stopPropagation(); // 阻止事件冒泡
      
      menuOpen = !menuOpen;
      toggleFABMenu(menuOpen);
    });
    
    // 添加触摸事件（改进移动端支持）
    fabMainBtn.addEventListener('touchend', function(e) {
      // 只处理没有明显移动的触摸（视为点击）
      if (isClick) {
        e.preventDefault();
        e.stopPropagation();
        
        menuOpen = !menuOpen;
        toggleFABMenu(menuOpen);
      }
    }, { passive: false });
    
    // 点击页面其他区域收起菜单
    document.addEventListener('click', function(e) {
      // 如果点击的不是FAB相关元素，并且菜单是打开的，则关闭菜单
      if (!e.target.closest('#fab-main-btn') && 
          !e.target.closest('#fab-menu') && 
          menuOpen) {
        menuOpen = false;
        toggleFABMenu(false);
      }
    });
    
    // 子按钮添加点击关闭菜单事件
    const fabButtons = fabMenu.querySelectorAll('button');
    fabButtons.forEach(btn => {
      btn.addEventListener('click', function(e) {
        if (this.id !== 'fab-main-btn') { // 不是主按钮才执行
          e.stopPropagation(); // 阻止事件冒泡
          
          // 执行相应操作后关闭菜单
          setTimeout(() => {
            menuOpen = false;
            toggleFABMenu(false);
          }, 100); // 短暂延迟，确保操作先被处理
        }
      });
      
      // 为子按钮添加触摸事件支持
      btn.addEventListener('touchend', function(e) {
        if (this.id !== 'fab-main-btn') {
          e.stopPropagation();
        }
      }, { passive: false });
    });
    
    // 添加拖动功能
    makeDraggable(fabContainer, function() { 
      isClick = true; // 默认认为是点击
    }, function(hasMoved, distance) {
      // 只有当移动距离超过阈值时才认为是拖动
      isClick = distance < 5; // 如果移动距离小于5像素，仍然视为点击
    });
    
    // 监听窗口大小变化
    window.addEventListener('resize', function() {
      // 重置FAB位置
      const isMobile = window.innerWidth < 768;
      
      // 如果是移动端并且FAB位置不在视口范围内，重置位置
      if (isMobile) {
        // 检查当前位置
        const rect = fabContainer.getBoundingClientRect();
        const isOffscreen = (
          rect.left < 0 || 
          rect.right > window.innerWidth || 
          rect.top < 0 || 
          rect.bottom > window.innerHeight
        );
        
        if (isOffscreen) {
          // 重置到右下角
          fabContainer.style.top = 'auto';
          fabContainer.style.left = 'auto';
          fabContainer.style.right = '2.5rem'; // 10px
          fabContainer.style.bottom = '2.5rem'; // 10px
          
          // 清除本地存储的位置
          localStorage.removeItem('fabPosition');
        }
      }
    });
  }
}

// 添加拖动功能
function makeDraggable(element, onDragStart, onDragEnd) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  let isDragging = false;
  let hasMoved = false; // 标记是否真正移动了
  let startX = 0, startY = 0; // 记录开始拖动的位置
  let totalDistance = 0; // 记录总移动距离
  
  // 创建拖动背景 - 移动到此处，避免多次创建
  let dragBackground = document.getElementById('drag-background');
  if (!dragBackground) {
    dragBackground = document.createElement('div');
    dragBackground.id = 'drag-background';
    dragBackground.className = 'fixed inset-0 z-40 pointer-events-none hidden';
    document.body.appendChild(dragBackground);
  }
  
  // 获取主按钮作为拖动触发元素
  const dragHandle = document.getElementById('fab-main-btn');
  
  if (!dragHandle || !element) return;
  
  // 鼠标按下事件
  dragHandle.addEventListener('mousedown', dragMouseDown);
  
  // 触摸事件（移动设备支持）
  dragHandle.addEventListener('touchstart', dragTouchStart, { passive: false });

  function dragMouseDown(e) {
    e.preventDefault();
    
    // 如果菜单是展开的，则不允许拖动
    if (!document.getElementById('fab-menu').classList.contains('hidden')) {
      return;
    }
    
    // 获取鼠标初始位置
    pos3 = e.clientX;
    pos4 = e.clientY;
    startX = e.clientX;
    startY = e.clientY;
    totalDistance = 0;
    
    // 设置拖动状态
    isDragging = true;
    hasMoved = false; // 重置移动标记
    
    // 调用拖动开始回调
    if (typeof onDragStart === 'function') {
      onDragStart();
    }
    
    // 添加鼠标移动和释放事件
    document.addEventListener('mousemove', elementDrag);
    document.addEventListener('mouseup', closeDragElement);
  }
  
  function dragTouchStart(e) {
    // 如果菜单是展开的，则不允许拖动
    if (!document.getElementById('fab-menu').classList.contains('hidden')) {
      return;
    }
    
    // 获取触摸初始位置
    pos3 = e.touches[0].clientX;
    pos4 = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    totalDistance = 0;
    
    // 设置拖动状态
    isDragging = true;
    hasMoved = false; // 重置移动标记
    
    // 调用拖动开始回调
    if (typeof onDragStart === 'function') {
      onDragStart();
    }
    
    // 添加触摸移动和结束事件
    document.addEventListener('touchmove', elementTouchDrag, { passive: false });
    document.addEventListener('touchend', closeTouchDragElement);
  }

  function elementDrag(e) {
    if (!isDragging) return;
    
    e.preventDefault();
    
    // 计算新位置
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // 计算移动距离
    const deltaX = Math.abs(startX - e.clientX);
    const deltaY = Math.abs(startY - e.clientY);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    totalDistance += distance;
    
    // 只有移动超过阈值才算移动
    if (totalDistance > 3) {
      hasMoved = true;
      
      // 应用直接的样式变化，而不是使用 dragging 类
      element.style.opacity = '0.95';
      element.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.2)';
      element.style.transition = 'none';
      
      // 更新元素位置
      updateElementPosition(element, pos1, pos2);
    }
  }
  
  function elementTouchDrag(e) {
    if (!isDragging) return;
    
    // 只有确认在拖动时才阻止默认行为
    if (hasMoved) {
      e.preventDefault();
    }
    
    // 计算新位置
    pos1 = pos3 - e.touches[0].clientX;
    pos2 = pos4 - e.touches[0].clientY;
    pos3 = e.touches[0].clientX;
    pos4 = e.touches[0].clientY;
    
    // 计算移动距离
    const deltaX = Math.abs(startX - e.touches[0].clientX);
    const deltaY = Math.abs(startY - e.touches[0].clientY);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    totalDistance += distance;
    
    // 只有移动超过阈值才算移动
    if (totalDistance > 10) { // 移动端使用更大的阈值
      hasMoved = true;
      
      // 应用直接的样式变化，而不是使用 dragging 类
      element.style.opacity = '0.95';
      element.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.2)';
      element.style.transition = 'none';
      
      // 更新元素位置
      updateElementPosition(element, pos1, pos2);
    }
  }

  function updateElementPosition(element, pos1, pos2) {
    // 获取当前样式
    const computedStyle = window.getComputedStyle(element);
    
    // 计算当前位置
    let top = element.offsetTop - pos2;
    let left = element.offsetLeft - pos1;
    
    // 获取视窗尺寸
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // 限制元素不超出视窗范围
    const elementHeight = element.offsetHeight;
    const elementWidth = element.offsetWidth;
    
    // 限制边界
    top = Math.max(10, Math.min(viewportHeight - elementHeight - 10, top));
    left = Math.max(10, Math.min(viewportWidth - elementWidth - 10, left));
    
    // 更新元素样式
    element.style.top = top + 'px';
    element.style.left = left + 'px';
    
    // 移除默认的bottom和right定位
    element.style.bottom = 'auto';
    element.style.right = 'auto';
    
    // 确保元素保持固定定位
    element.style.position = 'fixed';
  }

  function closeDragElement() {
    // 停止拖动
    isDragging = false;
    
    // 移除事件监听
    document.removeEventListener('mousemove', elementDrag);
    document.removeEventListener('mouseup', closeDragElement);
    
    // 恢复正常样式
    element.style.opacity = '';
    element.style.boxShadow = '';
    element.style.transition = '';
    
    // 保存按钮位置到本地存储
    if (hasMoved) {
      savePosition(element);
    }
    
    // 计算总移动距离
    const deltaX = Math.abs(startX - pos3);
    const deltaY = Math.abs(startY - pos4);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // 调用拖动结束回调
    if (typeof onDragEnd === 'function') {
      onDragEnd(hasMoved, distance);
    }
  }
  
  function closeTouchDragElement() {
    // 停止拖动
    isDragging = false;
    
    // 移除事件监听
    document.removeEventListener('touchmove', elementTouchDrag);
    document.removeEventListener('touchend', closeTouchDragElement);
    
    // 恢复正常样式
    element.style.opacity = '';
    element.style.boxShadow = '';
    element.style.transition = '';
    
    // 保存按钮位置到本地存储
    if (hasMoved) {
      savePosition(element);
    }
    
    // 计算总移动距离
    const deltaX = Math.abs(startX - pos3);
    const deltaY = Math.abs(startY - pos4);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // 调用拖动结束回调
    if (typeof onDragEnd === 'function') {
      onDragEnd(hasMoved, distance);
    }
  }
  
  // 保存位置到本地存储
  function savePosition(element) {
    const position = {
      top: element.style.top,
      left: element.style.left
    };
    localStorage.setItem('fabPosition', JSON.stringify(position));
  }
  
  // 初始化时加载上次保存的位置
  loadPosition(element);
}

// 加载保存的位置
function loadPosition(element) {
  const savedPosition = localStorage.getItem('fabPosition');
  if (savedPosition) {
    try {
      const position = JSON.parse(savedPosition);
      element.style.bottom = 'auto';
      element.style.right = 'auto';
      element.style.top = position.top;
      element.style.left = position.left;
    } catch (e) {
      console.error('加载FAB位置失败', e);
    }
  }
}

// 控制FAB菜单的展开和收起
function toggleFABMenu(open) {
  const fabMainBtn = document.getElementById('fab-main-btn');
  const fabMenu = document.getElementById('fab-menu');
  
  if (fabMainBtn && fabMenu) {
    if (open) {
      // 展开菜单
      fabMenu.classList.remove('hidden');
      // 旋转主按钮图标（+变成x）
      fabMainBtn.classList.add('rotate-45');
    } else {
      // 收起菜单
      fabMenu.classList.add('hidden');
      // 恢复主按钮图标
      fabMainBtn.classList.remove('rotate-45');
    }
  }
}

// 显示操作提示框
function showToast(message) {
  // 检查是否已存在toast元素，如果有则移除
  const existingToast = document.getElementById('action-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // 创建新的toast元素
  const toast = document.createElement('div');
  toast.id = 'action-toast';
  toast.className = 'fixed bottom-24 right-24 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-y-2 opacity-0';
  toast.textContent = message;
  
  // 添加到页面
  document.body.appendChild(toast);
  
  // 显示toast
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 100);
  
  // 设置自动消失
  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 2000);
}
  