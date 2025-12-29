// 消息模板模块 - 管理系统中的各类预警消息模板

// 模板数据对象
let templatesData = [];
let currentTemplateId = null;
let currentAttachments = []; // 存储当前模板的附件列表

// 从后端API获取模板数据
async function fetchTemplates() {
  try {
    const response = await fetch('/api/templates');
    if (!response.ok) {
      throw new Error(`获取模板数据失败: ${response.status} ${response.statusText}`);
    }
    
    templatesData = await response.json();
    populateTemplates();
    
    return templatesData;
  } catch (error) {
    console.error('获取模板数据时出错:', error);
    // 显示错误提示
    showToast('获取模板数据失败，请稍后重试', 'error');
    return [];
  }
}

// 上传附件
async function uploadAttachment(file, templateId) {
  try {
    // 创建FormData对象，用于发送文件
    const formData = new FormData();
    formData.append('file', file);
    formData.append('templateId', templateId || currentTemplateId || 'new');
    
    // 发送文件上传请求
    const response = await fetch('/api/templates/upload-attachment', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`上传附件失败: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // 如果上传成功，将附件添加到当前附件列表
    if (result.success) {
      currentAttachments.push(result.filename);
      updateAttachmentsList();
      showToast('附件上传成功', 'success');
    }
    
    return result;
  } catch (error) {
    console.error('上传附件时出错:', error);
    showToast('上传附件失败，请稍后重试', 'error');
    return { success: false, error: error.message };
  }
}

// 删除附件
async function deleteAttachment(filename, templateId) {
  try {
    // 使用SweetAlert2替代原生confirm
    const confirmResult = await Swal.fire({
      title: '确认删除附件',
      text: `确定要删除附件 "${filename}" 吗？`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    });
    
    if (!confirmResult.isConfirmed) {
      return { success: false };
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
    
    const response = await fetch('/api/templates/delete-attachment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: filename,
        templateId: templateId || currentTemplateId
      })
    });
    
    if (!response.ok) {
      throw new Error(`删除附件失败: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    // 如果删除成功，从当前附件列表移除
    if (responseData.success) {
      currentAttachments = currentAttachments.filter(a => a !== filename);
      updateAttachmentsList();
      
      // 显示成功提示
      Swal.fire({
        icon: 'success',
        title: '附件已删除',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    }
    
    return responseData;
  } catch (error) {
    console.error('删除附件时出错:', error);
    
    Swal.fire({
      icon: 'error',
      title: '删除附件失败',
      text: error.message,
      confirmButtonText: '确定'
    });
    
    return { success: false, error: error.message };
  }
}

// 更新附件列表显示
function updateAttachmentsList() {
  const attachmentsList = document.getElementById('attachments-list');
  if (!attachmentsList) return;
  
  // 清空现有列表
  attachmentsList.innerHTML = '';
  
  // 如果没有附件，显示提示
  if (currentAttachments.length === 0) {
    attachmentsList.innerHTML = '<div class="text-sm text-gray-500">暂无附件</div>';
    return;
  }
  
  // 创建附件列表
  const attachmentsUl = document.createElement('ul');
  attachmentsUl.className = 'divide-y divide-gray-200';
  
  // 遍历附件添加到列表
  currentAttachments.forEach(filename => {
    const li = document.createElement('li');
    li.className = 'py-2 flex justify-between items-center';
    
    // 获取文件图标
    let fileIcon = getFileIcon(filename);
    
    li.innerHTML = `
      <div class="flex items-center">
        <span class="mr-2">${fileIcon}</span>
        <span class="text-sm text-gray-700">${filename}</span>
      </div>
      <div class="flex space-x-2">
        <button class="text-gray-400 hover:text-blue-500 preview-attachment" data-filename="${filename}" title="预览附件">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
        <button class="text-gray-400 hover:text-red-500 delete-attachment" data-filename="${filename}" title="删除附件">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            <line x1="10" x2="10" y1="11" y2="17"></line>
            <line x1="14" x2="14" y1="11" y2="17"></line>
          </svg>
        </button>
      </div>
    `;
    
    // 添加删除附件事件
    li.querySelector('.delete-attachment').addEventListener('click', function() {
      const filename = this.getAttribute('data-filename');
      deleteAttachment(filename);
    });
    
    // 添加预览附件事件
    li.querySelector('.preview-attachment').addEventListener('click', function() {
      const filename = this.getAttribute('data-filename');
      previewAttachment(filename);
    });
    
    attachmentsUl.appendChild(li);
  });
  
  attachmentsList.appendChild(attachmentsUl);
}

// 获取文件图标
function getFileIcon(filename) {
  const extension = filename.split('.').pop().toLowerCase();
  
  switch (extension) {
    case 'pdf':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15v-2"></path><path d="M9 13h3"></path><path d="M13 15v-4"></path><path d="M9 19h6"></path></svg>`;
    case 'doc':
    case 'docx':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
    case 'xls':
    case 'xlsx':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><line x1="8" y1="9" x2="10" y2="9"></line></svg>`;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-500"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
  }
}

// 保存模板到后端API
async function saveTemplate(templateData) {
  try {
    const isUpdate = templateData.id !== undefined;
    const url = isUpdate ? `/api/templates/${templateData.id}` : '/api/templates';
    const method = isUpdate ? 'PUT' : 'POST';
    
    // 添加附件信息到模板数据
    if (currentAttachments.length > 0) {
      templateData.attachments = currentAttachments;
    }
    
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templateData)
    });
    
    if (!response.ok) {
      throw new Error(`保存模板失败: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // 显示成功消息
    showToast('模板保存成功', 'success');
    
    // 清空编辑区
    clearTemplateEditor();
    
    // 重新加载模板列表
    fetchTemplates();
    
    // 导出模板数据到JSON文件
    await exportTemplates();
    
    return { success: true, data: result };
  } catch (error) {
    console.error('保存模板时出错:', error);
    showToast('保存模板失败: ' + error.message, 'error');
    
    return { success: false, error: error.message };
  }
}

// 删除模板
async function deleteTemplate(templateId) {
  try {
    // 使用SweetAlert2替代原生confirm
    const confirmResult = await Swal.fire({
      title: '确认删除',
      text: '确定要删除此模板吗？此操作无法撤销。',
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
    
    const response = await fetch(`/api/templates/${templateId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`删除模板失败: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    if (responseData.success) {
      // 更新模板列表
      await fetchTemplates();
      
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
      throw new Error(responseData.message || '删除模板失败');
    }
  } catch (error) {
    console.error('删除模板失败:', error);
    
    Swal.fire({
      icon: 'error',
      title: '删除模板失败',
      text: error.message,
      confirmButtonText: '确定'
    });
  }
}

// 导出模板到JSON文件
async function exportTemplates() {
  try {
    const response = await fetch('/api/templates/export');
    
    if (!response.ok) {
      throw new Error(`导出模板失败: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // 显示成功提示
    showToast('模板数据已成功导出到JSON文件', 'success');
    
    return true;
  } catch (error) {
    console.error('导出模板时出错:', error);
    // 显示错误提示
    showToast('导出模板失败，请稍后重试', 'error');
    return false;
  }
}

// 填充模板列表的函数
function populateTemplates() {
  const templateList = document.getElementById('template-list');
  if (!templateList) return;
  
  // 清空现有列表内容
  templateList.innerHTML = '';
  
  // 如果没有模板数据，显示提示信息
  if (templatesData.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'px-4 py-6 text-center text-gray-500';
    emptyItem.textContent = '暂无模板数据';
    templateList.appendChild(emptyItem);
    return;
  }
  
  console.log("正在填充模板列表，共有模板数据:", templatesData.length);
  
  // 获取筛选值
  const targetFilter = document.getElementById('template-target-filter');
  const selectedFilter = targetFilter ? targetFilter.value : '';
  
  // 筛选模板数据
  let filteredTemplates = templatesData;
  if (selectedFilter) {
    filteredTemplates = templatesData.filter(template => template.targetRole === selectedFilter);
    console.log(`已筛选 ${selectedFilter} 模板，筛选后数量:`, filteredTemplates.length);
  }
  
  // 如果筛选后没有模板数据，显示提示信息
  if (filteredTemplates.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'px-4 py-6 text-center text-gray-500';
    emptyItem.textContent = `没有找到适用于${selectedFilter === 'customer' ? '客户' : (selectedFilter === 'engineer' ? '工程师' : '所有人')}的模板`;
    templateList.appendChild(emptyItem);
    return;
  }
  
  // 遍历模板数据，为每个模板创建列表项
  filteredTemplates.forEach(template => {
    console.log("处理模板:", template.id, template.name);
    
    const listItem = document.createElement('li');
    
    // 根据预警类型设置不同的标签样式
    let templateTypeBadgeClass = '';
    if (template.type === '暴雨') {
      templateTypeBadgeClass = 'bg-blue-100 text-blue-800';      // 暴雨用蓝色
    } else if (template.type === '高温') {
      templateTypeBadgeClass = 'bg-red-100 text-red-800';       // 高温用红色
    } else if (template.type === '台风') {
      templateTypeBadgeClass = 'bg-purple-100 text-purple-800';  // 台风用紫色
    } else if (template.type === '大雾') {
      templateTypeBadgeClass = 'bg-gray-100 text-gray-800';      // 大雾用灰色
    } else if (template.type === '雷电') {
      templateTypeBadgeClass = 'bg-yellow-100 text-yellow-800';  // 雷电用黄色
    } else if (template.type === '大风') {
      templateTypeBadgeClass = 'bg-teal-100 text-teal-800';      // 大风用青色
    } else {
      templateTypeBadgeClass = 'bg-indigo-100 text-indigo-800';  // 其他类型默认使用靛蓝色
    }
    
    // 根据适用对象设置标签样式
    let roleTagClass = '';
    let roleTagText = '';
    
    if (template.targetRole === 'customer') {
      roleTagClass = 'bg-green-100 text-green-800';
      roleTagText = '客户专用';
    } else if (template.targetRole === 'engineer') {
      roleTagClass = 'bg-red-100 text-red-800';
      roleTagText = '工程师专用';
    } else if (template.targetRole === 'all') {
      roleTagClass = 'bg-blue-100 text-blue-800';
      roleTagText = '通用';
    }
    
    // 设置列表项样式和悬停效果
    listItem.className = 'px-4 py-3 hover:bg-gray-50 transition-colors duration-150 cursor-pointer';
    listItem.setAttribute('data-template-id', template.id);
    
    // 生成列表项HTML，包含模板名称、修改时间、类型和操作按钮
    listItem.innerHTML = `
      <div class="flex justify-between items-center">
        <div>
          <div class="text-sm font-medium text-gray-900">${template.name}</div>
          <div class="text-xs text-gray-500">修改于 ${template.lastModified}</div>
          <div class="mt-1">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${templateTypeBadgeClass}">
              ${template.type || '未分类'}
            </span>
            ${!template.isActive ? '<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">已停用</span>' : ''}
            ${roleTagText ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${roleTagClass}">${roleTagText}</span>` : ''}
          </div>
        </div>
        <div class="flex space-x-2">
          <button class="edit-template-btn text-gray-400 hover:text-gray-600" data-template-id="${template.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.82 2.82 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"></path>
            </svg>
          </button>
          <button class="delete-template-btn text-gray-400 hover:text-red-600" data-template-id="${template.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              <line x1="10" x2="10" y1="11" y2="17"></line>
              <line x1="14" x2="14" y1="11" y2="17"></line>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    // 添加点击事件，点击模板项加载该模板到编辑区域
    listItem.addEventListener('click', function(e) {
      // 不触发编辑和删除按钮的点击事件
      if (e.target.closest('.edit-template-btn') || e.target.closest('.delete-template-btn')) {
        return;
      }
      
      const templateId = parseInt(this.getAttribute('data-template-id'), 10);
      console.log("点击了模板，ID:", templateId);
      loadTemplateEditor(templateId);
    });
    
    // 将生成的列表项添加到模板列表中
    templateList.appendChild(listItem);
    
    // 为编辑按钮添加点击事件
    const editBtn = listItem.querySelector('.edit-template-btn');
    editBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const templateId = parseInt(this.getAttribute('data-template-id'), 10);
      console.log("点击了编辑按钮，ID:", templateId);
      loadTemplateEditor(templateId);
    });
    
    // 为删除按钮添加点击事件
    const deleteBtn = listItem.querySelector('.delete-template-btn');
    deleteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const templateId = parseInt(this.getAttribute('data-template-id'), 10);
      
      deleteTemplate(templateId);
    });
  });
}

// 加载模板到编辑区
async function loadTemplateEditor(templateId) {
  currentTemplateId = templateId;
  
  console.log("正在加载模板ID:", templateId);
  
  // 显示模板编辑器
  const templateEditor = document.getElementById('template-editor');
  if (templateEditor) {
    templateEditor.classList.remove('hidden');
  }
  
  // 先尝试获取完整的模板数据
  let template = null;
  
  try {
    console.log("从API获取模板详情:", templateId);
    const response = await fetch(`/api/templates/${templateId}`);
    if (!response.ok) {
      throw new Error(`获取模板失败: ${response.status} ${response.statusText}`);
    }
    template = await response.json();
    console.log("获取的模板数据:", template);
  } catch (error) {
    console.error('获取模板详情时出错:', error);
    
    // 如果API调用失败，尝试从本地数据查找
    template = templatesData.find(t => t.id === templateId);
    console.log("从本地数据查找模板:", template);
    
    if (!template) {
      showToast('无法加载模板数据', 'error');
      return;
    }
  }
  
  if (!template) {
    console.error("未找到模板:", templateId);
    showToast('未找到模板数据', 'error');
    return;
  }
  
  console.log("正在填充模板数据:", template);
  
  // 更新编辑区标题
  document.querySelector('#templates .col-span-2 h3').textContent = `模板编辑 - ${template.name}`;
  
  // 填充表单字段
  document.getElementById('template-name').value = template.name || '';
  document.getElementById('template-subject').value = template.subject || '';
  document.getElementById('template-content').value = template.content || '';
  
  // 获取类型和状态选择器，如果存在的话
  const typeSelect = document.getElementById('template-type');
  const statusSwitch = document.getElementById('template-status');
  const targetRoleSelect = document.getElementById('template-target-role');
  
  // 设置类型
  if (typeSelect) {
    let typeFound = false;
    for (let i = 0; i < typeSelect.options.length; i++) {
      if (typeSelect.options[i].value === template.type) {
        typeSelect.selectedIndex = i;
        typeFound = true;
        break;
      }
    }
    
    if (!typeFound && template.type) {
      // 如果找不到对应的类型选项，添加一个新选项
      const option = document.createElement('option');
      option.value = template.type;
      option.textContent = template.type;
      typeSelect.appendChild(option);
      typeSelect.value = template.type;
    }
  }
  
  // 设置活跃状态
  if (statusSwitch) {
    statusSwitch.checked = template.isActive;
  }
  
  // 设置适用对象
  if (targetRoleSelect && template.targetRole) {
    targetRoleSelect.value = template.targetRole;
  } else if (targetRoleSelect) {
    targetRoleSelect.value = 'all'; // 默认为所有人
  }
  
  // 加载附件数据
  try {
    // 清空当前附件列表
    currentAttachments = [];
    
    // 如果模板有附件数据
    if (template.attachments) {
      // 如果是字符串（JSON格式），解析它
      if (typeof template.attachments === 'string') {
        try {
          currentAttachments = JSON.parse(template.attachments);
        } catch (e) {
          console.error('解析附件数据失败:', e);
        }
      } 
      // 如果已经是数组，直接使用
      else if (Array.isArray(template.attachments)) {
        currentAttachments = template.attachments;
      }
    }
    
    // 更新附件列表显示
    updateAttachmentsList();
    
  } catch (error) {
    console.error('加载附件数据时出错:', error);
  }
  
  // 显示保存和取消按钮
  const saveBtn = document.getElementById('save-template-btn');
  const cancelBtn = document.getElementById('cancel-template-btn');
  
  if (saveBtn) {
    saveBtn.style.display = 'inline-flex';
    saveBtn.onclick = function() {
      saveCurrentTemplate();
    };
  }
  
  if (cancelBtn) {
    cancelBtn.style.display = 'inline-flex';
    cancelBtn.onclick = function() {
      const templateEditor = document.getElementById('template-editor');
      cancelCreateTemplate();
    };
  }
}

// 新建模板
function createNewTemplate() {
  // 清空编辑区域
  clearTemplateEditor();
  
  // 显示模板编辑器
  const templateEditor = document.getElementById('template-editor');
  if (templateEditor) {
    templateEditor.classList.remove('hidden');
  }
  
  // 更新编辑区标题
  document.querySelector('#templates .col-span-2 h3').textContent = '模板编辑 - 新建模板';
  
  // 显示保存和取消按钮
  const saveBtn = document.getElementById('save-template-btn');
  const cancelBtn = document.getElementById('cancel-template-btn');
  
  if (saveBtn) {
    saveBtn.style.display = 'inline-flex';
    saveBtn.onclick = function() {
      saveCurrentTemplate();
    };
  }
  
  if (cancelBtn) {
    cancelBtn.style.display = 'inline-flex';
    cancelBtn.onclick = function() {
      const templateEditor = document.getElementById('template-editor');
      cancelCreateTemplate();
    };
  }
}

// 清空模板编辑区
function clearTemplateEditor() {
  currentTemplateId = null;
  
  // 更新编辑区标题
  document.querySelector('#templates .col-span-2 h3').textContent = '模板编辑';
  
  // 清空表单字段
  document.getElementById('template-name').value = '';
  document.getElementById('template-subject').value = '';
  document.getElementById('template-content').value = '';
  
  // 获取类型和状态选择器，如果存在的话
  const typeSelect = document.getElementById('template-type');
  const statusSwitch = document.getElementById('template-status');
  const targetRoleSelect = document.getElementById('template-target-role');
  
  // 重置类型选择
  if (typeSelect) {
    typeSelect.selectedIndex = 0;
  }
  
  // 重置活跃状态
  if (statusSwitch) {
    statusSwitch.checked = true;
  }
  
  // 重置角色选择
  if (targetRoleSelect) {
    targetRoleSelect.value = 'all';
  }
  
  // 清空附件列表
  currentAttachments = [];
  updateAttachmentsList();
}

// 保存当前编辑的模板
function saveCurrentTemplate() {
  // 获取表单数据
  const name = document.getElementById('template-name').value.trim();
  const subject = document.getElementById('template-subject').value.trim();
  const content = document.getElementById('template-content').value.trim();
  
  // 获取类型和状态选择器，如果存在的话
  const typeSelect = document.getElementById('template-type');
  const statusSwitch = document.getElementById('template-status');
  const targetRoleSelect = document.getElementById('template-target-role');
  
  // 表单验证
  if (!name) {
    showToast('请输入模板名称', 'error');
    return;
  }
  
  if (!subject) {
    showToast('请输入邮件主题', 'error');
    return;
  }
  
  // 检查是否选择了预警类型
  if (typeSelect && typeSelect.selectedIndex === 0) {
    showToast('请选择预警类型', 'error');
    return;
  }
  
  // 准备要保存的数据
  const templateData = {
    name: name,
    subject: subject,
    content: content
  };
  
  // 如果是编辑已有模板，添加ID
  if (currentTemplateId) {
    templateData.id = currentTemplateId;
  }
  
  // 添加类型和状态（如果有）
  if (typeSelect && typeSelect.value && typeSelect.value !== '') {
    templateData.type = typeSelect.value;
    console.log("保存的预警类型:", typeSelect.value);
  } else {
    console.log("没有选择预警类型或预警类型为空");
  }
  
  if (statusSwitch) {
    templateData.isActive = statusSwitch.checked;
  }
  
  // 添加适用对象
  if (targetRoleSelect) {
    templateData.targetRole = targetRoleSelect.value;
    console.log("保存的适用对象:", targetRoleSelect.value);
  }
  
  // 打印要保存的模板数据
  console.log("将保存的模板数据:", JSON.stringify(templateData));
  
  // 保存到API
  saveTemplate(templateData)
    .then(response => {
      if (response && response.success) {
        // 保存成功，隐藏模板编辑器
        const templateEditor = document.getElementById('template-editor');
        if (templateEditor) {
          templateEditor.classList.add('hidden');
        }
        
        // 重新加载模板列表
        fetchTemplates();
      }
    });
}

// 取消创建模板
async function cancelCreateTemplate() {
  // 使用SweetAlert2替代原生confirm
  const confirmResult = await Swal.fire({
    title: '确认取消',
    text: '确定要取消创建吗？未保存的内容将丢失。',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: '确认取消',
    cancelButtonText: '继续编辑',
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33'
  });
  
  if (confirmResult.isConfirmed) {
    resetTemplateForm();
    closeTemplateModal();
  }
}

// 显示提示消息
function showToast(message, type = 'info') {
  // 查找或创建toast容器
  let toastContainer = document.getElementById('toast-container');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed top-4 right-4 z-50';
    document.body.appendChild(toastContainer);
  }
  
  // 创建toast元素
  const toast = document.createElement('div');
  
  // 根据类型设置样式
  let bgColor, textColor, icon;
  
  if (type === 'error') {
    bgColor = 'bg-red-500';
    textColor = 'text-white';
    icon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  } else if (type === 'success') {
    bgColor = 'bg-green-500';
    textColor = 'text-white';
    icon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>`;
  } else {
    bgColor = 'bg-blue-500';
    textColor = 'text-white';
    icon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`;
  }
  
  // 设置toast样式
  toast.className = `mb-2 flex items-center ${bgColor} ${textColor} px-4 py-3 rounded shadow-md transform transition-transform duration-300 ease-in-out`;
  toast.style.minWidth = '300px';
  
  // 设置内容
  toast.innerHTML = `
    <div class="flex items-center">
      ${icon}
      <span>${message}</span>
    </div>
    <button class="ml-auto">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  
  // 添加关闭按钮事件
  toast.querySelector('button').addEventListener('click', function() {
    removeToast(toast);
  });
  
  // 添加到容器
  toastContainer.appendChild(toast);
  
  // 设置自动消失
  setTimeout(() => {
    removeToast(toast);
  }, 3000);
}

// 移除提示消息
function removeToast(toast) {
  toast.classList.add('opacity-0', 'translate-x-full');
  
  // 动画结束后移除DOM元素
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

// 在页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
  // 从后端获取模板数据
  fetchTemplates();
  
  // 加载预警类型列表
  loadAlertTypes();
  
  // 为适用对象筛选器添加事件监听器
  const targetFilter = document.getElementById('template-target-filter');
  if (targetFilter) {
    targetFilter.addEventListener('change', function() {
      populateTemplates();
    });
  }
  
  // 为新建模板按钮添加点击事件
  const newTemplateBtn = document.querySelector('#templates .inline-flex');
  if (newTemplateBtn) {
    newTemplateBtn.addEventListener('click', createNewTemplate);
  }
  
  // 为导出按钮添加点击事件，如果存在
  const exportBtn = document.getElementById('export-templates-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportTemplates);
  }
  
  // 为附件上传按钮添加点击事件
  const uploadBtn = document.getElementById('upload-attachment-btn');
  const fileInput = document.getElementById('template-attachment');
  
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', function() {
      // 检查是否选择了文件
      if (fileInput.files.length === 0) {
        showToast('请先选择要上传的文件', 'error');
        return;
      }
      
      // 遍历所有选择的文件并上传
      Array.from(fileInput.files).forEach(async (file) => {
        // 文件大小限制（5MB）
        if (file.size > 5 * 1024 * 1024) {
          showToast(`文件 ${file.name} 超过5MB限制，请选择更小的文件`, 'error');
          return;
        }
        
        // 上传文件
        await uploadAttachment(file);
      });
      
      // 清空文件输入框
      fileInput.value = '';
    });
  }
});

// 加载预警类型
async function loadAlertTypes() {
  try {
    // 获取预警类型下拉列表
    const typeSelect = document.getElementById('template-type');
    if (!typeSelect) return;
    
    // 清空现有选项，保留第一个空选项
    while (typeSelect.options.length > 1) {
      typeSelect.remove(1);
    }
    
    // 从alert_rules.json获取预警类型
    const response = await fetch('/api/alert-rules');
    if (!response.ok) {
      throw new Error(`获取预警类型失败: ${response.status} ${response.statusText}`);
    }
    
    const alertRules = await response.json();
    
    // 提取不重复的预警类型
    const types = [...new Set(alertRules.map(rule => rule.type))];
    
    // 添加到下拉列表
    types.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      typeSelect.appendChild(option);
    });
    
    console.log("已加载预警类型:", types);
  } catch (error) {
    console.error('加载预警类型时出错:', error);
  }
}

// 预览附件
async function previewAttachment(filename) {
  try {
    // 判断文件类型
    const extension = filename.split('.').pop().toLowerCase();
    const fileType = getFileType(extension);
    
    // 创建预览模态框，如果不存在
    if (!document.getElementById('attachment-preview-modal')) {
      const modalHtml = `
        <div id="attachment-preview-modal" class="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center hidden">
          <div class="bg-white w-full h-full flex flex-col">
            <div class="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-800 text-white">
              <h3 class="text-xl font-medium" id="preview-modal-title">预览附件</h3>
              <button id="close-preview-modal" class="text-white hover:text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="flex-1 overflow-auto p-0" id="preview-content">
              <div class="flex items-center justify-center h-full">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            </div>
            <div class="p-4 border-t border-gray-200 flex justify-end bg-gray-800">
              <a id="download-attachment-btn" href="#" target="_blank" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                下载文件
              </a>
            </div>
          </div>
        </div>
      `;
      
      const modalContainer = document.createElement('div');
      modalContainer.innerHTML = modalHtml;
      document.body.appendChild(modalContainer.firstElementChild);
      
      const previewModal = document.getElementById('attachment-preview-modal');
      const modalContent = previewModal.querySelector('.bg-white');
      
      // 添加关闭模态框事件
      document.getElementById('close-preview-modal').addEventListener('click', function() {
        closePreviewModal();
      });
      
      // 点击模态框外部关闭
      previewModal.addEventListener('click', function(e) {
        if (e.target === previewModal) {
          closePreviewModal();
        }
      });
      
      // 按ESC键关闭
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !previewModal.classList.contains('hidden')) {
          closePreviewModal();
        }
      });
    }
    
    // 更新模态框标题
    const modalTitle = document.getElementById('preview-modal-title');
    modalTitle.textContent = `预览附件: ${filename}`;
    
    // 更新下载链接
    const downloadBtn = document.getElementById('download-attachment-btn');
    downloadBtn.href = `/templates/${filename}`;
    downloadBtn.download = filename;
    
    // 显示模态框
    const previewModal = document.getElementById('attachment-preview-modal');
    previewModal.classList.remove('hidden');
    
    // 获取内容容器
    const previewContent = document.getElementById('preview-content');
    previewContent.innerHTML = '<div class="flex items-center justify-center h-full"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>';
    
    // 根据文件类型，设置不同的预览内容
    switch (fileType) {
      case 'image':
        try {
          // 图片预览
          const img = document.createElement('img');
          img.src = `/templates/${filename}`;
          img.className = 'max-w-full max-h-screen object-contain mx-auto';
          img.alt = filename;
          
          // 图片加载事件
          img.onload = function() {
            previewContent.innerHTML = '<div class="flex items-center justify-center h-full bg-gray-900"></div>';
            previewContent.firstChild.appendChild(img);
          };
          
          img.onerror = function() {
            previewContent.innerHTML = '<div class="text-center text-red-500">无法加载图片</div>';
          };
        } catch (error) {
          previewContent.innerHTML = '<div class="text-center text-red-500">图片加载失败</div>';
        }
        break;
        
      case 'pdf':
        try {
          // PDF预览 - 使用iframe嵌入
          const iframe = document.createElement('iframe');
          iframe.src = `/templates/${filename}`;
          iframe.className = 'w-full h-full border-0';
          previewContent.innerHTML = '';
          previewContent.appendChild(iframe);
        } catch (error) {
          previewContent.innerHTML = '<div class="text-center text-red-500">PDF预览失败</div>';
        }
        break;
        
      case 'text':
        try {
          // 文本预览 - 尝试加载文本内容
          const response = await fetch(`/templates/${filename}`);
          if (response.ok) {
            const text = await response.text();
            previewContent.innerHTML = `<div class="h-full overflow-auto bg-gray-100"><pre class="whitespace-pre-wrap p-8 text-sm">${text}</pre></div>`;
          } else {
            previewContent.innerHTML = '<div class="text-center text-red-500 p-8">无法加载文本内容</div>';
          }
        } catch (error) {
          previewContent.innerHTML = '<div class="text-center text-red-500 p-8">文本加载失败</div>';
        }
        break;
        
      default:
        // 其他文件类型，显示不支持预览
        previewContent.innerHTML = `
          <div class="flex items-center justify-center h-full bg-gray-100">
            <div class="text-center p-8">
              <div class="text-6xl mb-4">${getFileIcon(filename)}</div>
              <div class="text-lg font-medium">${filename}</div>
              <p class="text-gray-500 mt-2">无法预览此类型的文件，请下载后查看</p>
            </div>
          </div>
        `;
    }
  } catch (error) {
    console.error('预览附件时出错:', error);
    showToast('预览附件失败: ' + error.message, 'error');
  }
}

// 关闭预览模态框
function closePreviewModal() {
  const previewModal = document.getElementById('attachment-preview-modal');
  if (previewModal) {
    previewModal.classList.add('hidden');
  }
}

// 根据文件扩展名获取文件类型
function getFileType(extension) {
  const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  const textTypes = ['txt', 'json', 'xml', 'html', 'htm', 'css', 'js', 'md'];
  
  if (imageTypes.includes(extension)) {
    return 'image';
  } else if (extension === 'pdf') {
    return 'pdf';
  } else if (textTypes.includes(extension)) {
    return 'text';
  } else {
    return 'other';
  }
}
  