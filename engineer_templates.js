/**
 * 工程师模板管理
 */

// 初始化工程师模板管理页面
function initializeEngineerTemplates() {
  loadEngineerTemplates();
  setupEngineerTemplateEventListeners();
}

// 加载工程师模板列表
function loadEngineerTemplates(searchTerm = '', type = '') {
  fetch('/api/engineer-templates' + 
    (searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '') + 
    (type ? `${searchTerm ? '&' : '?'}type=${encodeURIComponent(type)}` : ''))
    .then(response => response.json())
    .then(data => {
      renderEngineerTemplates(data);
    })
    .catch(error => {
      console.error('加载工程师模板数据失败:', error);
      // 从本地JSON文件加载
      fetch('/static/data/engineer_templates_data.json')
        .then(response => response.json())
        .then(data => {
          renderEngineerTemplates(data);
        })
        .catch(fallbackError => {
          console.error('无法加载工程师模板数据:', fallbackError);
          renderEngineerTemplates([]);
        });
    });
}

// 渲染工程师模板列表
function renderEngineerTemplates(templates) {
  const tableBody = document.querySelector('#engineer-templates-table tbody');
  if (!tableBody) return;
  
  tableBody.innerHTML = '';
  
  if (templates.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="5" class="py-4 text-center text-gray-500">
        没有找到匹配的工程师模板
      </td>
    `;
    tableBody.appendChild(emptyRow);
    return;
  }
  
  templates.forEach(template => {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';
    
    const lastUpdated = template.updatedAt ? new Date(template.updatedAt).toLocaleString('zh-CN') : '';
    const statusClass = template.status === '启用' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
    
    row.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="font-medium text-gray-900">${template.name}</div>
        <div class="text-gray-500 text-sm">主题: ${template.subject}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          ${template.type}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
          ${template.status}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${lastUpdated}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button data-template-id="${template.id}" class="edit-engineer-template-btn text-blue-600 hover:text-blue-900 mr-3">编辑</button>
        <button data-template-id="${template.id}" class="delete-engineer-template-btn text-red-600 hover:text-red-900">删除</button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
  
  // 更新模板计数
  updateEngineerTemplateCount(templates.length);
}

// 更新模板计数
function updateEngineerTemplateCount(count) {
  const templateCountElement = document.getElementById('engineer-template-count');
  if (templateCountElement) {
    templateCountElement.textContent = count;
  }
}

// 设置工程师模板相关的事件监听器
function setupEngineerTemplateEventListeners() {
  // 搜索模板
  const templateSearchForm = document.getElementById('engineer-template-search-form');
  const templateSearchInput = document.getElementById('engineer-template-search');
  
  if (templateSearchForm) {
    templateSearchForm.addEventListener('submit', function(e) {
      e.preventDefault();
      loadEngineerTemplates(templateSearchInput.value, getSelectedTemplateType());
    });
  }
  
  // 预警类型筛选
  const templateTypeDropdown = document.getElementById('engineer-template-type-dropdown');
  if (templateTypeDropdown) {
    templateTypeDropdown.addEventListener('change', function() {
      loadEngineerTemplates(templateSearchInput.value, this.value);
    });
  }
  
  // 点击添加模板按钮
  const addTemplateBtn = document.getElementById('add-engineer-template-btn');
  if (addTemplateBtn) {
    addTemplateBtn.addEventListener('click', showAddEngineerTemplateModal);
  }
  
  // 变量插入按钮
  document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('insert-variable')) {
      const variable = e.target.getAttribute('data-variable');
      
      // 找到当前活动的模板编辑区域
      let activeTextarea = null;
      
      if (!document.getElementById('edit-engineer-template-modal').classList.contains('hidden')) {
        activeTextarea = document.getElementById('edit-engineer-template-content');
      } else {
        activeTextarea = document.getElementById('engineer-template-content');
      }
      
      if (activeTextarea) {
        // 获取当前光标位置
        const start = activeTextarea.selectionStart;
        const end = activeTextarea.selectionEnd;
        
        // 在光标位置插入变量
        activeTextarea.value = 
          activeTextarea.value.substring(0, start) + 
          variable + 
          activeTextarea.value.substring(end);
        
        // 将光标位置移动到插入内容之后
        activeTextarea.selectionStart = activeTextarea.selectionEnd = start + variable.length;
        
        // 聚焦回文本区域
        activeTextarea.focus();
      }
    }
  });
  
  // 取消添加模板
  const cancelAddTemplateBtn = document.getElementById('cancel-add-engineer-template');
  if (cancelAddTemplateBtn) {
    cancelAddTemplateBtn.addEventListener('click', closeAddEngineerTemplateModal);
  }
  
  // 关闭添加模板模态框
  const closeTemplateModalBtn = document.getElementById('close-engineer-template-modal');
  if (closeTemplateModalBtn) {
    closeTemplateModalBtn.addEventListener('click', closeAddEngineerTemplateModal);
  }
  
  // 提交添加模板表单
  const addTemplateForm = document.getElementById('add-engineer-template-form');
  if (addTemplateForm) {
    addTemplateForm.addEventListener('submit', handleAddEngineerTemplate);
  }
  
  // 点击编辑按钮
  document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('edit-engineer-template-btn')) {
      const templateId = e.target.getAttribute('data-template-id');
      editEngineerTemplate(templateId);
    }
  });
  
  // 取消编辑模板
  const cancelEditTemplateBtn = document.getElementById('cancel-edit-engineer-template');
  if (cancelEditTemplateBtn) {
    cancelEditTemplateBtn.addEventListener('click', closeEditEngineerTemplateModal);
  }
  
  // 关闭编辑模板模态框
  const closeEditTemplateModalBtn = document.getElementById('close-edit-engineer-template-modal');
  if (closeEditTemplateModalBtn) {
    closeEditTemplateModalBtn.addEventListener('click', closeEditEngineerTemplateModal);
  }
  
  // 提交编辑模板表单
  const editTemplateForm = document.getElementById('edit-engineer-template-form');
  if (editTemplateForm) {
    editTemplateForm.addEventListener('submit', handleEditEngineerTemplate);
  }
  
  // 点击删除按钮
  document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('delete-engineer-template-btn')) {
      const templateId = e.target.getAttribute('data-template-id');
      deleteEngineerTemplate(templateId);
    }
  });
  
  // 文件上传处理
  setupFileUploadHandlers();
}

// 设置文件上传处理器
function setupFileUploadHandlers() {
  const addFileUpload = document.getElementById('engineer-template-file-upload');
  const editFileUpload = document.getElementById('edit-engineer-template-file-upload');
  const addFileList = document.getElementById('engineer-template-file-list');
  const editFileList = document.getElementById('edit-engineer-template-file-list');
  
  if (addFileUpload) {
    addFileUpload.addEventListener('change', function() {
      displaySelectedFiles(this.files, addFileList);
    });
  }
  
  if (editFileUpload) {
    editFileUpload.addEventListener('change', function() {
      displaySelectedFiles(this.files, editFileList, true);
    });
  }
}

// 显示选择的文件
function displaySelectedFiles(files, containerElement, isEdit = false) {
  if (!containerElement) return;
  
  // 如果是编辑模式，保留原有的文件列表
  if (!isEdit) {
    containerElement.innerHTML = '';
  }
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileSize = formatFileSize(file.size);
    
    const fileItem = document.createElement('div');
    fileItem.className = 'flex items-center justify-between py-2 border-b';
    
    fileItem.innerHTML = `
      <div class="flex items-center">
        <svg class="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
        </svg>
        <div>
          <span class="text-sm font-medium text-gray-900">${file.name}</span>
          <span class="block text-xs text-gray-500">${fileSize}</span>
        </div>
      </div>
      <button type="button" class="remove-file-btn text-red-500 hover:text-red-700">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    `;
    
    fileItem.querySelector('.remove-file-btn').addEventListener('click', function() {
      fileItem.remove();
    });
    
    containerElement.appendChild(fileItem);
  }
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 获取选中的模板类型
function getSelectedTemplateType() {
  const typeDropdown = document.getElementById('engineer-template-type-dropdown');
  return typeDropdown ? typeDropdown.value : '';
}

// 显示添加模板模态框
function showAddEngineerTemplateModal() {
  // 清空表单
  document.getElementById('add-engineer-template-form').reset();
  
  // 清空文件列表
  const fileList = document.getElementById('engineer-template-file-list');
  if (fileList) {
    fileList.innerHTML = '';
  }
  
  // 显示模态框
  document.getElementById('add-engineer-template-modal').classList.remove('hidden');
}

// 关闭添加模板模态框
function closeAddEngineerTemplateModal() {
  document.getElementById('add-engineer-template-modal').classList.add('hidden');
}

// 处理添加工程师模板
function handleAddEngineerTemplate(e) {
  e.preventDefault();
  
  const form = e.currentTarget;
  const formData = new FormData(form);
  
  // 获取文件列表
  const fileUpload = document.getElementById('engineer-template-file-upload');
  const files = fileUpload.files;
  
  // 创建模板对象
  const template = {
    id: Date.now().toString(), // 临时ID
    name: formData.get('name'),
    subject: formData.get('subject'),
    type: formData.get('type'),
    status: formData.get('status') || '启用',
    content: formData.get('content'),
    attachments: Array.from(files).map(file => file.name),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // 保存模板数据
  saveEngineerTemplate(template)
    .then(() => {
      closeAddEngineerTemplateModal();
      loadEngineerTemplates();
    })
    .catch(() => {
      Swal.fire({
        icon: 'error',
        title: '保存失败',
        text: '保存工程师模板失败，请重试',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    });
}

// 保存工程师模板数据
function saveEngineerTemplate(template) {
  return new Promise((resolve, reject) => {
    // 尝试调用API保存
    fetch('/api/engineer-templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(template)
    })
    .then(response => {
      if (response.ok) {
        resolve();
      } else {
        // 如果API调用失败，尝试本地保存
        saveEngineerTemplateLocally(template)
          .then(resolve)
          .catch(reject);
      }
    })
    .catch(error => {
      console.error('API保存失败，尝试本地保存:', error);
      saveEngineerTemplateLocally(template)
        .then(resolve)
        .catch(reject);
    });
  });
}

// 本地保存工程师模板数据
function saveEngineerTemplateLocally(template) {
  return new Promise((resolve, reject) => {
    fetch('/static/data/engineer_templates_data.json')
      .then(response => response.json())
      .then(templates => {
        // 检查是否是更新现有模板
        const existingIndex = templates.findIndex(t => t.id === template.id);
        
        if (existingIndex !== -1) {
          templates[existingIndex] = template;
        } else {
          templates.push(template);
        }
        
        // 这里仅模拟保存成功
        // 实际中可能需要使用后端API来保存数据
        console.log('本地保存工程师模板数据:', templates);
        localStorage.setItem('engineer_templates_data', JSON.stringify(templates));
        resolve();
      })
      .catch(error => {
        console.error('无法加载或保存工程师模板数据:', error);
        reject(error);
      });
  });
}

// 编辑工程师模板
function editEngineerTemplate(templateId) {
  fetch('/api/engineer-templates/' + templateId)
    .then(response => response.json())
    .then(template => {
      populateEditEngineerTemplateForm(template);
    })
    .catch(() => {
      Swal.fire({
        icon: 'error',
        title: '获取失败',
        text: '无法获取工程师模板数据，请重试',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    });
}

// 填充编辑工程师模板表单
function populateEditEngineerTemplateForm(template) {
  // 设置ID
  document.getElementById('edit-engineer-template-id').value = template.id;
  
  // 填充基本信息
  document.getElementById('edit-engineer-template-name').value = template.name;
  document.getElementById('edit-engineer-template-subject').value = template.subject;
  document.getElementById('edit-engineer-template-type').value = template.type;
  document.getElementById('edit-engineer-template-status').value = template.status || '启用';
  document.getElementById('edit-engineer-template-content').value = template.content;
  
  // 显示现有附件
  const fileList = document.getElementById('edit-engineer-template-file-list');
  fileList.innerHTML = '';
  
  if (template.attachments && template.attachments.length > 0) {
    template.attachments.forEach(attachment => {
      const fileItem = document.createElement('div');
      fileItem.className = 'flex items-center justify-between py-2 border-b';
      
      fileItem.innerHTML = `
        <div class="flex items-center">
          <svg class="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
          </svg>
          <div>
            <span class="text-sm font-medium text-gray-900">${attachment}</span>
            <span class="block text-xs text-gray-500">已上传</span>
          </div>
        </div>
        <button type="button" class="remove-file-btn text-red-500 hover:text-red-700" data-filename="${attachment}">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      `;
      
      fileItem.querySelector('.remove-file-btn').addEventListener('click', function() {
        fileItem.remove();
      });
      
      fileList.appendChild(fileItem);
    });
  }
  
  // 显示模态框
  document.getElementById('edit-engineer-template-modal').classList.remove('hidden');
}

// 关闭编辑工程师模板模态框
function closeEditEngineerTemplateModal() {
  document.getElementById('edit-engineer-template-modal').classList.add('hidden');
}

// 处理编辑工程师模板
function handleEditEngineerTemplate(e) {
  e.preventDefault();
  
  const form = e.currentTarget;
  const formData = new FormData(form);
  
  // 获取文件列表
  const fileUpload = document.getElementById('edit-engineer-template-file-upload');
  const files = fileUpload.files;
  
  // 收集现有附件
  const existingAttachments = [];
  const fileItems = document.querySelectorAll('#edit-engineer-template-file-list .flex');
  fileItems.forEach(item => {
    const filenameSpan = item.querySelector('.text-sm.font-medium');
    if (filenameSpan) {
      existingAttachments.push(filenameSpan.textContent);
    }
  });
  
  // 创建模板对象
  const template = {
    id: formData.get('templateId'),
    name: formData.get('name'),
    subject: formData.get('subject'),
    type: formData.get('type'),
    status: formData.get('status') || '启用',
    content: formData.get('content'),
    attachments: existingAttachments.concat(Array.from(files).map(file => file.name)),
    updatedAt: new Date().toISOString()
  };
  
  // 更新模板数据
  updateEngineerTemplate(template)
    .then(() => {
      closeEditEngineerTemplateModal();
      loadEngineerTemplates();
    })
    .catch(() => {
      Swal.fire({
        icon: 'error',
        title: '更新失败',
        text: '更新工程师模板失败，请重试',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    });
}

// 更新工程师模板数据
function updateEngineerTemplate(template) {
  return new Promise((resolve, reject) => {
    // 尝试调用API更新
    fetch('/api/engineer-templates/' + template.id, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(template)
    })
    .then(response => {
      if (response.ok) {
        resolve();
      } else {
        // 如果API调用失败，尝试本地更新
        saveEngineerTemplateLocally(template)
          .then(resolve)
          .catch(reject);
      }
    })
    .catch(error => {
      console.error('API更新失败，尝试本地更新:', error);
      saveEngineerTemplateLocally(template)
        .then(resolve)
        .catch(reject);
    });
  });
}

// 删除工程师模板
async function deleteEngineerTemplate(templateId) {
  try {
    // 使用SweetAlert2替代原生confirm
    const confirmResult = await Swal.fire({
      title: '确认删除',
      text: '确定要删除这个模板吗？此操作无法撤销。',
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
    fetch(`/api/engineer-templates/${templateId}`, {
      method: 'DELETE'
    })
    .then(response => {
      if (response.ok) {
        // 刷新模板列表
        loadEngineerTemplates();
        
        // 显示成功提示
        Swal.fire({
          icon: 'success',
          title: '模板已删除',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      } else {
        // 如果API调用失败，尝试本地删除
        deleteEngineerTemplateLocally(templateId)
          .then(() => {
            loadEngineerTemplates();
            
            // 显示成功提示
            Swal.fire({
              icon: 'success',
              title: '模板已删除',
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
        text: '删除工程师模板失败，请重试',
        confirmButtonText: '确定'
      });
    });
  } catch (error) {
    console.error('删除工程师模板失败:', error);
    
    // 显示错误提示
    Swal.fire({
      icon: 'error',
      title: '删除失败',
      text: '删除工程师模板失败，请重试',
      confirmButtonText: '确定'
    });
  }
}

// 本地删除工程师模板
function deleteEngineerTemplateLocally(templateId) {
  fetch('/static/data/engineer_templates_data.json')
    .then(response => response.json())
    .then(templates => {
      const filteredTemplates = templates.filter(t => t.id !== templateId);
      
      // 这里仅模拟删除成功
      // 实际中可能需要使用后端API来保存数据
      console.log('本地删除工程师模板数据:', filteredTemplates);
      localStorage.setItem('engineer_templates_data', JSON.stringify(filteredTemplates));
      
      loadEngineerTemplates();
    })
    .catch(error => {
      console.error('无法加载或删除工程师模板数据:', error);
      Swal.fire({
        icon: 'error',
        title: '删除失败',
        text: '删除工程师模板失败，请重试',
        confirmButtonText: '确定'
      });
    });
}

// 导出函数
window.initializeEngineerTemplates = initializeEngineerTemplates; 