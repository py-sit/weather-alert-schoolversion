// Empty file for now, will be used for settings functionality
// All settings are currently implemented with static HTML in index.html

document.addEventListener('DOMContentLoaded', function() {
    // 获取所有设置相关的DOM元素
    const emailSender = document.getElementById('email-sender');
    const emailName = document.getElementById('email-name');
    const smtpServer = document.getElementById('smtp-server');
    const smtpPort = document.getElementById('smtp-port');
    const smtpUsername = document.getElementById('smtp-username');
    const smtpPassword = document.getElementById('smtp-password');
    const weatherApiKey = document.getElementById('weather-api-key');
    const firstalertTime = document.getElementById('first-alert');
    const intervalPrediction = document.getElementById('auto-retry');
    const adminNotifications = document.getElementById('admin-notifications');
    const sendSummary = document.getElementById('send-summary');
    const alertAdvanceTime = document.getElementById('alert-advance-time');
    const warningInterval = document.getElementById('warning-interval');
    const autoApproval = document.getElementById('auto-approval');
    const clearQueuesBtn = document.getElementById('clear-queues');
    let autoApprovalLastChecked = false;
    
    // 修改"启用自动重试"勾选框的标签为"启用区间预测"
    const autoRetryLabel = document.querySelector('label[for="auto-retry"]');
    if (autoRetryLabel) {
        autoRetryLabel.textContent = '启用区间预测';
        
        // 添加提示说明
        let helpText = document.createElement('p');
        helpText.className = 'text-xs text-gray-500 mt-1';
        helpText.textContent = '开启后系统会在提前预警天数到当天的整个区间内检测，任何一天满足条件都会触发预警，多天满足时取最近日期';
        autoRetryLabel.parentNode.appendChild(helpText);
    }
    
    // 测试连接按钮 - 使用纯JavaScript查找
    const settingsButtons = document.querySelectorAll('#settings button');
    let testConnectionBtn, saveSettingsBtn, cancelBtn;
    
    // 遍历所有按钮，根据文本内容确定按钮
    settingsButtons.forEach(button => {
        if (button.textContent.trim() === '测试连接') {
            testConnectionBtn = button;
        } else if (button.textContent.trim() === '保存设置') {
            saveSettingsBtn = button;
        } else if (button.textContent.trim() === '取消') {
            cancelBtn = button;
        }
    });
    
    // 测试结果显示区域
    let testResultSpan;
    if (testConnectionBtn && testConnectionBtn.nextElementSibling) {
        testResultSpan = testConnectionBtn.nextElementSibling;
    } else {
        // 如果没有找到，创建一个新的
        testResultSpan = document.createElement('span');
        testResultSpan.className = 'text-sm text-gray-500 ml-3';
        if (testConnectionBtn) {
            testConnectionBtn.parentNode.appendChild(testResultSpan);
        }
    }
    
    // 加载设置数据
    loadSettings();
    
    // 添加事件监听器
    if (testConnectionBtn) {
        testConnectionBtn.addEventListener('click', testEmailConnection);
    } else {
        console.error('未找到测试连接按钮');
    }
    
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    } else {
        console.error('未找到保存设置按钮');
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', loadSettings);
    } else {
        console.error('未找到取消按钮');
    }

    if (clearQueuesBtn) {
        clearQueuesBtn.addEventListener('click', clearQueues);
    } else {
        console.error('未找到清空队列按钮');
    }
    if (autoApproval) {
        autoApproval.addEventListener('change', handleAutoApprovalToggle);
    }
    
    // 更新管理员邮箱显示
    function updateAdminEmail(email) {
        const adminEmailElement = document.querySelector('#sidebar .text-xs.text-gray-500');
        if (adminEmailElement) {
            adminEmailElement.textContent = email;
        }
    }
    
    // 加载设置数据函数
    function loadSettings() {
        // 发起GET请求获取设置
        fetch('/api/settings')
            .then(response => response.json())
            .then(data => {
                // 填充表单字段
                if (data.emailSender) {
                    emailSender.value = data.emailSender;
                    updateAdminEmail(data.emailSender);
                }
                if (data.emailName) emailName.value = data.emailName;
                if (data.smtpServer) smtpServer.value = data.smtpServer;
                if (data.smtpPort) smtpPort.value = data.smtpPort;
                if (data.smtpUsername) smtpUsername.value = data.smtpUsername;
                if (data.smtpPassword && data.smtpPassword !== '********') {
                    smtpPassword.value = data.smtpPassword;
                }
                if (data.weatherApiKey) weatherApiKey.value = data.weatherApiKey;
                // 初次预警时间，优先时:分
                if (data.firstAlertTime) {
                    firstalertTime.value = data.firstAlertTime;
                } else if (data.firstalert !== undefined && data.firstalert !== null) {
                    const hourVal = parseInt(data.firstalert);
                    if (!isNaN(hourVal)) {
                        firstalertTime.value = `${hourVal.toString().padStart(2, '0')}:00`;
                    }
                }
                
                // 处理区间预测设置 - 兼容旧的autoRetry字段
                if (data.hasOwnProperty('intervalPrediction')) {
                    intervalPrediction.checked = data.intervalPrediction;
                } else if (data.hasOwnProperty('autoRetry')) {
                    // 兼容旧版配置，将autoRetry当作intervalPrediction
                    intervalPrediction.checked = data.autoRetry;
                }
                if (data.hasOwnProperty('adminNotifications') && adminNotifications) {
                    adminNotifications.checked = data.adminNotifications;
                }
                if (data.hasOwnProperty('sendSummary') && sendSummary) {
                    sendSummary.checked = data.sendSummary;
                }
                if (data.alertAdvanceTime && alertAdvanceTime) {
                    alertAdvanceTime.value = data.alertAdvanceTime;
                }
                if (data.warningInterval && warningInterval) {
                    warningInterval.value = data.warningInterval;
                }
                if (data.hasOwnProperty('autoApproval') && autoApproval) {
                    autoApproval.checked = data.autoApproval;
                    autoApprovalLastChecked = autoApproval.checked;
                } else {
                    autoApprovalLastChecked = autoApproval ? autoApproval.checked : false;
                }
                
                // 显示最后测试时间
                updateLastTestedInfo(data.lastTested, data.testResult);
                
                console.log('设置数据加载成功');
            })
            .catch(error => {
                console.error('加载设置失败:', error);
                showNotification('加载设置失败，请检查网络连接', 'error');
            });
    }
    
    // 显示最后测试时间信息
    function updateLastTestedInfo(lastTested, testResult) {
        if (lastTested && testResult) {
            // 将ISO时间格式转换为友好的显示格式
            const testedDate = new Date(lastTested);
            const formattedDate = `${testedDate.getFullYear()}-${(testedDate.getMonth() + 1).toString().padStart(2, '0')}-${testedDate.getDate().toString().padStart(2, '0')} ${testedDate.getHours().toString().padStart(2, '0')}:${testedDate.getMinutes().toString().padStart(2, '0')}`;
            testResultSpan.textContent = `上次测试：${testResult} (${formattedDate})`;
        } else {
            testResultSpan.textContent = '未进行过测试';
        }
    }
    
    // 保存设置函数
    function saveSettings() {
        // 收集表单数据
        const timeValue = firstalertTime.value || '';
        const parsedHour = timeValue && timeValue.includes(':') ? parseInt(timeValue.split(':')[0]) : NaN;

        const settingsData = {
            emailSender: emailSender.value,
            emailName: emailName.value,
            smtpServer: smtpServer.value,
            smtpPort: parseInt(smtpPort.value),
            smtpUsername: smtpUsername.value,
            smtpPassword: smtpPassword.value,
            weatherApiKey: weatherApiKey.value,
            firstAlertTime: timeValue || null,
            firstalert: isNaN(parsedHour) ? parseInt(firstalertTime.value) || 6 : parsedHour,
            intervalPrediction: intervalPrediction.checked
        };
        
        // 添加其他可能存在的设置字段
        if (adminNotifications) {
            settingsData.adminNotifications = adminNotifications.checked;
        }
        if (sendSummary) {
            settingsData.sendSummary = sendSummary.checked;
        }
        if (alertAdvanceTime) {
            settingsData.alertAdvanceTime = parseInt(alertAdvanceTime.value);
        }
        if (warningInterval) {
            settingsData.warningInterval = parseInt(warningInterval.value);
        }
        if (autoApproval) {
            settingsData.autoApproval = autoApproval.checked;
        }
        
        // 发起POST请求保存设置
        fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(settingsData)
        })
        .then(response => response.json())
        .then(data => {
            console.log('设置保存成功:', data);
            if (data.success) {
                showNotification('设置保存成功', 'success');
                updateAdminEmail(settingsData.emailSender);
            } else {
                showNotification('保存设置失败: ' + (data.message || '未知错误'), 'error');
            }
        })
        .catch(error => {
            console.error('保存设置失败:', error);
            showNotification('保存设置失败', 'error');
        });
    }

    // 清空发送队列与通知
    function clearQueues() {
        if (!confirm('确定要清空所有待发送队列和通知吗？该操作无法撤销。')) {
            return;
        }
        const originalText = clearQueuesBtn.textContent;
        clearQueuesBtn.disabled = true;
        clearQueuesBtn.classList.add('opacity-70', 'cursor-not-allowed');
        clearQueuesBtn.textContent = '正在清空...';

        fetch('/api/queues/clear', {
            method: 'POST'
        })
        .then(resp => resp.json())
        .then(data => {
            if (data.success) {
                showNotification('已清空所有发送队列和通知', 'success');
            } else {
                showNotification('清空队列失败: ' + (data.message || '未知错误'), 'error');
            }
        })
        .catch(err => {
            console.error('清空队列失败:', err);
            showNotification('清空队列失败，请稍后重试', 'error');
        })
        .finally(() => {
            clearQueuesBtn.disabled = false;
            clearQueuesBtn.classList.remove('opacity-70', 'cursor-not-allowed');
            clearQueuesBtn.textContent = originalText;
        });
    }
    
    // 切换自动审批开关时提醒先清空待发送队列
    function handleAutoApprovalToggle() {
        if (!autoApproval) return;
        const newValue = autoApproval.checked;
        const modeText = newValue ? '自动' : '手动';
        const message = `请您在切换为${modeText}审批前：\n1）点击下方的清空所有待发送队列按钮，避免旧的待发任务被误处理；\n2）确保通知中心无待发送邮件。`;
        const messageHtml = `
            <div style="text-align:left;">
                <p>请您在切换为${modeText}审批前：</p>
                <p>1）点击下方的清空所有待发送队列按钮，避免旧的待发任务被误处理；</p>
                <p>2）确保通知中心无待发送邮件。</p>
            </div>
        `;
        const revertToggle = () => {
            autoApproval.checked = autoApprovalLastChecked;
        };
        
        if (window.Swal && typeof window.Swal.fire === 'function') {
            Swal.fire({
                title: '请先清空待发送队列',
                html: messageHtml,
                icon: 'warning',
                confirmButtonText: '我已知晓',
                showCancelButton: true,
                cancelButtonText: '取消'
            }).then(result => {
                if (result.isConfirmed) {
                    autoApprovalLastChecked = newValue;
                } else {
                    revertToggle();
                }
            });
        } else {
            const confirmed = window.confirm(message);
            if (confirmed) {
                autoApprovalLastChecked = newValue;
            } else {
                revertToggle();
            }
        }
    }
    
    // 测试邮件连接函数
    function testEmailConnection() {
        // 收集邮件服务器设置
        const emailSettings = {
            emailSender: emailSender.value,
            emailName: emailName.value,
            smtpServer: smtpServer.value,
            smtpPort: parseInt(smtpPort.value),
            smtpUsername: smtpUsername.value,
            smtpPassword: smtpPassword.value
        };
        
        // 验证必要字段
        if (!emailSettings.emailSender || !emailSettings.smtpServer || 
            !emailSettings.smtpPort || !emailSettings.smtpUsername || 
            !emailSettings.smtpPassword) {
            showNotification('请填写所有必要的邮件服务器信息', 'warning');
            return;
        }
        
        // 显示测试中提示
        showNotification('正在测试邮件服务器连接...', 'info');
        
        // 更新测试状态为"测试中..."
        testResultSpan.textContent = '测试中...';
        
        // 发起POST请求测试连接
        fetch('/api/settings/test-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailSettings)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('邮件服务器连接测试成功', 'success');
                // 更新显示的最后测试时间
                if (data.lastTested) {
                    testResultSpan.textContent = `上次测试：成功 (${data.lastTested})`;
                } else {
                    // 如果没有返回时间，使用当前时间
                    const now = new Date();
                    const formattedDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                    testResultSpan.textContent = `上次测试：成功 (${formattedDate})`;
                }
            } else {
                showNotification('邮件服务器连接测试失败: ' + data.message, 'error');
                testResultSpan.textContent = `上次测试：失败`;
            }
        })
        .catch(error => {
            console.error('测试连接失败:', error);
            showNotification('测试连接失败，请检查网络连接', 'error');
            testResultSpan.textContent = `上次测试：失败 (网络错误)`;
        });
    }
    
    // 显示通知函数
    function showNotification(message, type = 'info') {
        // 检查是否已经有全局通知函数
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
            return;
        }
        
        // 如果没有，创建一个简单的通知
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '4px';
        notification.style.zIndex = '9999';
        notification.style.color = '#fff';
        
        // 根据通知类型设置背景色
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                notification.style.backgroundColor = '#F44336';
                break;
            case 'warning':
                notification.style.backgroundColor = '#FF9800';
                break;
            default:
                notification.style.backgroundColor = '#2196F3';
        }
        
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }
    
    // 修改提前预警时间的标签，清楚表明单位是天
    const alertAdvanceTimeLabel = document.querySelector('label[for="alert-advance-time"]');
    if (alertAdvanceTimeLabel) {
        alertAdvanceTimeLabel.textContent = '提前预警天数';
    }
    
    // 添加提示说明
    const alertAdvanceTimeInput = document.getElementById('alert-advance-time');
    if (alertAdvanceTimeInput) {
        // 检查是否已有提示文本
        let helpText = alertAdvanceTimeInput.nextElementSibling;
        if (!helpText || !helpText.classList.contains('text-xs')) {
            // 如果没有提示文本，创建一个
            helpText = document.createElement('p');
            helpText.className = 'text-xs text-gray-500 mt-1';
            alertAdvanceTimeInput.parentNode.insertBefore(helpText, alertAdvanceTimeInput.nextSibling);
        }
        helpText.textContent = '设置提前多少天发出预警通知（1-6天）。当设置大于2天时将使用7天预报API。';
    }
});
