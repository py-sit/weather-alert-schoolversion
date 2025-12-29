// 邮件发送功能模块

document.addEventListener('DOMContentLoaded', function() {
    // 获取邮件按钮元素
    const emailBtn = document.getElementById('email-btn');
    
    // 添加点击事件监听器
    if (emailBtn) {
        emailBtn.addEventListener('click', showEmailForm);
    } else {
        console.error('未找到邮件按钮元素');
    }
    
    // 显示邮件发送表单
    function showEmailForm() {
        // 检查是否已存在邮件表单模态框
        let emailModal = document.getElementById('email-modal');
        
        if (emailModal) {
            // 如果已存在，则显示它
            emailModal.classList.remove('hidden');
            return;
        }
        
        // 创建邮件表单模态框
        emailModal = document.createElement('div');
        emailModal.id = 'email-modal';
        emailModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50';
        
        // 创建模态框内容
        const modalContent = `
            <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">发送邮件</h3>
                    <button id="close-email-modal" class="text-gray-400 hover:text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                
                <form id="email-form" class="space-y-4">
                    <div>
                        <label for="email-to" class="block text-sm font-medium text-gray-700">收件人</label>
                        <input type="email" id="email-to" name="to" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                    </div>
                    
                    <div>
                        <label for="email-subject" class="block text-sm font-medium text-gray-700">主题</label>
                        <input type="text" id="email-subject" name="subject" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                    </div>
                    
                    <div>
                        <label for="email-content" class="block text-sm font-medium text-gray-700">内容</label>
                        <textarea id="email-content" name="content" rows="6" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"></textarea>
                    </div>
                    
                    <div class="flex items-center justify-between pt-2">
                        <span id="email-status" class="text-sm"></span>
                        <div class="flex space-x-2">
                            <button type="button" id="cancel-email" class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                取消
                            </button>
                            <button type="submit" id="send-email" class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                发送
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        `;
        
        emailModal.innerHTML = modalContent;
        document.body.appendChild(emailModal);
        
        // 添加关闭模态框的事件监听器
        document.getElementById('close-email-modal').addEventListener('click', closeEmailModal);
        document.getElementById('cancel-email').addEventListener('click', closeEmailModal);
        
        // 添加表单提交事件监听器
        document.getElementById('email-form').addEventListener('submit', sendEmail);
    }
    
    // 关闭邮件表单模态框
    function closeEmailModal() {
        const emailModal = document.getElementById('email-modal');
        if (emailModal) {
            emailModal.classList.add('hidden');
        }
    }
    
    // 发送邮件
    function sendEmail(event) {
        event.preventDefault();
        
        const to = document.getElementById('email-to').value;
        const subject = document.getElementById('email-subject').value;
        const content = document.getElementById('email-content').value;
        const statusElement = document.getElementById('email-status');
        
        // 验证表单
        if (!to || !subject || !content) {
            statusElement.textContent = '请填写所有必填字段';
            statusElement.className = 'text-sm text-red-500';
            return;
        }
        
        // 显示发送中状态
        statusElement.textContent = '发送中...';
        statusElement.className = 'text-sm text-blue-500';
        
        // 准备发送数据
        const emailData = {
            to: to,
            subject: subject,
            content: content
        };
        
        // 发送请求到后端API
        fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(emailData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                statusElement.textContent = '邮件发送成功！';
                statusElement.className = 'text-sm text-green-500';
                
                // 3秒后关闭模态框
                setTimeout(() => {
                    closeEmailModal();
                }, 3000);
            } else {
                statusElement.textContent = `发送失败: ${data.message}`;
                statusElement.className = 'text-sm text-red-500';
            }
        })
        .catch(error => {
            console.error('发送邮件时出错:', error);
            statusElement.textContent = '发送失败，请稍后重试';
            statusElement.className = 'text-sm text-red-500';
        });
    }
});