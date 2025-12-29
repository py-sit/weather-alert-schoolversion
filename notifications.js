// 通知面板交互处理
document.addEventListener('DOMContentLoaded', () => {
    const notificationBtn = document.getElementById('notification-btn');
    const notificationPanel = document.getElementById('notification-panel');
    const selectAllBtn = document.getElementById('select-all-notifications');
    // 更新选择器以匹配新的HTML结构
    const notificationList = notificationPanel.querySelector('.flex-1 .space-y-4');
    
    // 批量操作按钮
    const approveSelectedBtn = document.getElementById('approve-selected-notifications');
    const rejectSelectedBtn = document.getElementById('reject-selected-notifications');
    
    // 筛选器元素
    const customerFilter = document.getElementById('notification-customer-filter');
    const regionFilter = document.getElementById('notification-region-filter');
    const duplicateFilter = document.getElementById('notification-duplicate-filter');
    const userTypeFilter = document.getElementById('notification-user-type-filter');

    // 存储选中状态
    let allSelected = false;

    // 存储通知数据
    let notifications = [];
    // 存储筛选后的通知数据
    let filteredNotifications = [];
    // 存储唯一的客户和地区列表
    let uniqueCustomers = [];
    let uniqueRegions = [];
    // 存储客户数据
    let customersData = [];

    // 获取通知类型对应的图标
    function getNotificationIcon(type) {
        const icons = {
            warning: '<svg class="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>',
            info: '<svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
            success: '<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
        };
        return icons[type] || icons.info;
    }

    // 加载客户数据
    async function loadCustomersData() {
        try {
            const response = await fetch('customers_data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            customersData = await response.json();
            console.log('客户数据加载成功:', customersData.length);
        } catch (error) {
            console.error('加载客户数据失败:', error);
            customersData = [];
        }
    }

    // 根据姓名查找客户类别
    function getCustomerCategory(name) {
        if (!name) return null;
        
        // 从收件人中提取姓名（去除邮箱和括号内容）
        const cleanName = name.replace(/\s*\(.+\)/, '').trim();
        
        // 尝试在客户数据中查找
        const customer = customersData.find(c => cleanName.includes(c.name));
        return customer ? customer.category : null;
    }

    // 从后端获取通知
    async function fetchNotifications() {
        try {
            // 确保客户数据已加载
            if (customersData.length === 0) {
                await loadCustomersData();
            }
            
            const response = await fetch('/api/notifications');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            notifications = data;
            updateFilters();
            applyFilters();
        } catch (error) {
            console.error('获取通知失败:', error);
        }
    }
    
    // 更新筛选器选项
    function updateFilters() {
        // 提取唯一的客户名称
        uniqueCustomers = [...new Set(notifications.map(n => {
            const recipientMatch = n.recipient.match(/^([^(]+)/);
            return recipientMatch ? recipientMatch[1].trim() : n.recipient;
        }))];
        
        // 提取唯一的地区
        uniqueRegions = [...new Set(notifications.map(n => {
            const titleMatch = n.title.match(/- ([^-]+)$/);
            return titleMatch ? titleMatch[1].trim() : '';
        }).filter(Boolean))];
        
        // 更新客户筛选器
        customerFilter.innerHTML = '<option value="">全部客户</option>';
        uniqueCustomers.sort().forEach(customer => {
            const option = document.createElement('option');
            option.value = customer;
            option.textContent = customer;
            customerFilter.appendChild(option);
        });
        
        // 更新地区筛选器
        regionFilter.innerHTML = '<option value="">全部地区</option>';
        uniqueRegions.sort().forEach(region => {
            const option = document.createElement('option');
            option.value = region;
            option.textContent = region;
            regionFilter.appendChild(option);
        });
    }
    
    // 应用筛选条件
    function applyFilters() {
        const selectedCustomer = customerFilter.value;
        const selectedRegion = regionFilter.value;
        const selectedDuplicateStatus = duplicateFilter.value;
        const selectedUserType = userTypeFilter.value;
        
        filteredNotifications = notifications.filter(notification => {
            // 客户筛选
            const customerMatch = selectedCustomer ? notification.recipient.includes(selectedCustomer) : true;
            
            // 地区筛选
            const regionMatch = selectedRegion ? notification.title.includes(`- ${selectedRegion}`) : true;
            
            // 重复邮件筛选
            let duplicateMatch = true;
            if (selectedDuplicateStatus === 'duplicate') {
                duplicateMatch = notification.title.includes('【已重复】');
            } else if (selectedDuplicateStatus === 'non-duplicate') {
                duplicateMatch = !notification.title.includes('【已重复】');
            }
            
            // 获取该通知收件人的类别
            const recipientName = notification.recipient.match(/^([^(]+)/);
            const cleanName = recipientName ? recipientName[1].trim() : notification.recipient;
            const category = getCustomerCategory(cleanName);
            
            // 用户类别筛选
            let userTypeMatch = true;
            if (selectedUserType === '客户') {
                userTypeMatch = category === '客户';
            } else if (selectedUserType === '工程师') {
                userTypeMatch = category === '工程师';
            }
            
            return customerMatch && regionMatch && duplicateMatch && userTypeMatch;
        });
        
        renderNotifications();
    }

    // 渲染通知列表
    function renderNotifications() {
        notificationList.innerHTML = filteredNotifications
            .map(notification => {
                // 从收件人中提取姓名
                const recipientName = notification.recipient.match(/^([^(]+)/);
                const cleanName = recipientName ? recipientName[1].trim() : notification.recipient;
                
                // 获取该收件人的类别
                const category = getCustomerCategory(cleanName);
                
                // 根据类别显示不同的标签
                let userTypeBadge = '';
                if (category === '客户') {
                    userTypeBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-2">客户</span>';
                } else if (category === '工程师') {
                    userTypeBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 ml-2">工程师</span>';
                }
                
                return `
                    <div class="p-6 bg-blue-50 border-l-4 border-blue-500 notification-item" data-id="${notification.notification_id}">
                        <div class="flex items-start space-x-4">
                            <div class="flex-shrink-0">
                                <input type="checkbox" class="notification-checkbox h-4 w-4 border-gray-300 rounded text-blue-600 focus:ring-blue-500">
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between">
                                    <h4 class="text-base font-semibold text-gray-900 truncate">${notification.title}</h4>
                                    <span class="text-xs text-gray-500">${notification.timestamp || '刚刚'}</span>
                                </div>
                                <p class="mt-2 text-sm text-gray-600">${notification.content}</p>
                                <p class="mt-1 text-sm text-gray-500">收件人: ${notification.recipient} ${userTypeBadge}</p>
                            </div>
                            <div class="flex-shrink-0 space-x-2">
                                <button 
                                    class="px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 approve-btn"
                                    data-id="${notification.notification_id}"
                                >
                                    确认发送
                                </button>
                                <button 
                                    class="px-3 py-1.5 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 reject-btn"
                                    data-id="${notification.notification_id}"
                                >
                                    取消发送
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            })
            .join('');

        // 添加确认和拒绝按钮的点击事件
        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                // 防止重复点击
                if (this.disabled) return;
                
                const notificationId = this.getAttribute('data-id');
                const originalText = this.textContent.trim();
                
                // 禁用按钮并显示加载状态
                disableButton(this, '处理中...');
                
                // 同时禁用该通知的另一个按钮
                const rejectBtn = this.closest('.notification-item').querySelector('.reject-btn');
                if (rejectBtn) disableButton(rejectBtn);
                
                approveNotification(notificationId).finally(() => {
                    // 无论成功失败，最终都要恢复按钮状态
                    enableButton(this, originalText);
                    if (rejectBtn) enableButton(rejectBtn, '取消发送');
                });
            });
        });

        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                // 防止重复点击
                if (this.disabled) return;
                
                const notificationId = this.getAttribute('data-id');
                const originalText = this.textContent.trim();
                
                // 禁用按钮并显示加载状态
                disableButton(this, '处理中...');
                
                // 同时禁用该通知的另一个按钮
                const approveBtn = this.closest('.notification-item').querySelector('.approve-btn');
                if (approveBtn) disableButton(approveBtn);
                
                rejectNotification(notificationId).finally(() => {
                    // 无论成功失败，最终都要恢复按钮状态
                    enableButton(this, originalText);
                    if (approveBtn) enableButton(approveBtn, '确认发送');
                });
            });
        });

        // 重置全选状态
        allSelected = false;
        updateSelectAllButtonText();

        // 更新未读数量
        const unreadCount = notifications.length;
        const badge = notificationBtn.querySelector('span');
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
    }
    
    // 禁用按钮并显示加载状态
    function disableButton(button, loadingText) {
        button.disabled = true;
        button.classList.add('opacity-70', 'cursor-not-allowed');
        if (loadingText) {
            button.dataset.originalText = button.textContent;
            button.textContent = loadingText;
        }
    }
    
    // 恢复按钮状态
    function enableButton(button, text) {
        button.disabled = false;
        button.classList.remove('opacity-70', 'cursor-not-allowed');
        if (text) {
            button.textContent = text;
        } else if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }

    // 更新全选按钮文本
    function updateSelectAllButtonText() {
        selectAllBtn.textContent = allSelected ? '取消全选' : '全选';
    }

    // 确认发送通知
    async function approveNotification(notificationId) {
        try {
            const response = await fetch(`/api/notifications/${notificationId}/approve`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                // 从列表中移除已确认的通知
                notifications = notifications.filter(n => n.notification_id !== notificationId);
                applyFilters();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: '操作失败',
                    text: '操作失败: ' + result.message,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true
                });
            }
        } catch (error) {
            console.error('确认通知失败:', error);
            Swal.fire({
                icon: 'error',
                title: '确认失败',
                text: '确认通知失败，请重试',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
        }
    }

    // 拒绝发送通知
    async function rejectNotification(notificationId) {
        try {
            const response = await fetch(`/api/notifications/${notificationId}/reject`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                // 从列表中移除已拒绝的通知
                notifications = notifications.filter(n => n.notification_id !== notificationId);
                applyFilters();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: '拒绝失败',
                    text: '拒绝通知失败，请重试',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true
                });
            }
        } catch (error) {
            console.error('拒绝通知失败:', error);
            Swal.fire({
                icon: 'error',
                title: '拒绝失败',
                text: '拒绝通知失败，请重试',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
        }
    }
    
    // 批量确认发送
    approveSelectedBtn.addEventListener('click', async () => {
        const selectedIds = getSelectedNotificationIds();
        if (selectedIds.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: '请选择通知',
                text: '请至少选择一个通知',
                confirmButtonText: '确定'
            });
            return;
        }

        // 显示确认对话框
        const result = await Swal.fire({
            title: '确认批量发送',
            text: `确定要批量确认发送这 ${selectedIds.length} 条通知吗？`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '确认发送',
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
                title: '正在处理...',
                text: `0/${selectedIds.length}`,
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            let successCount = 0;
            let failedCount = 0;
            
            for (let i = 0; i < selectedIds.length; i++) {
                const id = selectedIds[i];
                try {
                    const response = await fetch(`/api/notifications/${id}/approve`, {
                        method: 'POST'
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success) {
                            successCount++;
                        } else {
                            failedCount++;
                        }
                    } else {
                        failedCount++;
                    }
                    
                    // 更新进度
                    Swal.getTitle().textContent = `正在处理...`;
                    Swal.getHtmlContainer().textContent = `${i + 1}/${selectedIds.length}`;
                    
                } catch (error) {
                    console.error(`确认发送通知 ${id} 失败:`, error);
                    failedCount++;
                }
            }
            
            // 从列表中移除已确认的通知
            await fetchNotifications();
            
            // 显示结果
            Swal.fire({
                icon: successCount > 0 ? 'success' : 'error',
                title: '批量确认完成',
                text: `成功: ${successCount}, 失败: ${failedCount}`,
                confirmButtonText: '确定'
            });
            
        } catch (error) {
            console.error('批量确认失败:', error);
            Swal.fire({
                icon: 'error',
                title: '批量确认失败',
                text: error.message || '确认发送时出错，请稍后重试',
                confirmButtonText: '确定'
            });
        }
    });
    
    // 批量拒绝发送
    rejectSelectedBtn.addEventListener('click', async () => {
        const selectedIds = getSelectedNotificationIds();
        if (selectedIds.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: '请选择通知',
                text: '请至少选择一个通知',
                confirmButtonText: '确定'
            });
            return;
        }
        
        // 显示确认对话框
        const result = await Swal.fire({
            title: '确认批量取消',
            text: `确定要批量取消发送这 ${selectedIds.length} 条通知吗？`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '确认取消',
            cancelButtonText: '返回',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6'
        });
        
        if (!result.isConfirmed) {
            return;
        }
        
        try {
            // 显示加载中状态
            Swal.fire({
                title: '正在处理...',
                text: `0/${selectedIds.length}`,
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            let successCount = 0;
            let failedCount = 0;
            
            for (let i = 0; i < selectedIds.length; i++) {
                const id = selectedIds[i];
                try {
                    const response = await fetch(`/api/notifications/${id}/reject`, {
                        method: 'POST'
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success) {
                            successCount++;
                        } else {
                            failedCount++;
                        }
                    } else {
                        failedCount++;
                    }
                    
                    // 更新进度
                    Swal.getTitle().textContent = `正在处理...`;
                    Swal.getHtmlContainer().textContent = `${i + 1}/${selectedIds.length}`;
                    
                } catch (error) {
                    console.error(`拒绝发送通知 ${id} 失败:`, error);
                    failedCount++;
                }
            }
            
            // 从列表中移除已拒绝的通知
            await fetchNotifications();
            
            // 显示结果
            Swal.fire({
                icon: successCount > 0 ? 'success' : 'error',
                title: '批量取消完成',
                text: `成功: ${successCount}, 失败: ${failedCount}`,
                confirmButtonText: '确定'
            });
            
        } catch (error) {
            console.error('批量拒绝失败:', error);
            Swal.fire({
                icon: 'error',
                title: '批量取消失败',
                text: error.message || '取消发送时出错，请稍后重试',
                confirmButtonText: '确定'
            });
        }
    });
    
    // 获取选中的通知ID
    function getSelectedNotificationIds() {
        const checkboxes = document.querySelectorAll('.notification-checkbox:checked');
        return Array.from(checkboxes).map(checkbox => 
            checkbox.closest('.notification-item').getAttribute('data-id')
        );
    }
    
    // 添加筛选器事件监听
    if (customerFilter) {
        customerFilter.addEventListener('change', applyFilters);
    }
    
    if (regionFilter) {
        regionFilter.addEventListener('change', applyFilters);
    }
    
    if (duplicateFilter) {
        duplicateFilter.addEventListener('change', applyFilters);
    }
    
    if (userTypeFilter) {
        userTypeFilter.addEventListener('change', applyFilters);
    }

    // 切换通知面板显示/隐藏
    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationPanel.classList.remove('hidden');
        fetchNotifications(); // 每次打开面板时刷新通知
    });

    // 关闭通知面板
    document.getElementById('close-notification-panel').addEventListener('click', () => {
        notificationPanel.classList.add('hidden');
    });

    // 点击面板外部时关闭面板
    document.addEventListener('click', (e) => {
        if (notificationPanel && 
            !notificationPanel.classList.contains('hidden') && 
            !notificationPanel.querySelector('.bg-white').contains(e.target) && 
            e.target !== notificationBtn) {
            notificationPanel.classList.add('hidden');
        }
    });
    
    // 全选/取消全选
    selectAllBtn.addEventListener('click', () => {
        allSelected = !allSelected;
        updateSelectAllButtonText();
        
        const checkboxes = document.querySelectorAll('.notification-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = allSelected;
        });
    });

    // 暴露全局函数
    window.approveNotification = approveNotification;
    window.rejectNotification = rejectNotification;

    // 初始获取通知
    fetchNotifications();
});