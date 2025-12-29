# 气象预警邮件通知系统（学校版）

面向学校场景的天气预警通知系统，提供天气数据拉取、预警规则触发、邮件模板发送与审批日志等一体化能力，降低人工筛查与通知成本。

## 功能特性
- 天气查询与预警判断，支持多城市与提前预警
- 人员与关注天气类型管理
- 邮件模板与附件管理（支持变量替换）
- 预警规则配置（参数型与文本型）
- 通知中心审批与日志追溯
- 系统设置统一管理（SMTP、API Key、时间策略）

## 技术栈
- 后端：Python 3.8+、Flask、SQLAlchemy、SQLite
- 前端：HTML/CSS/JavaScript
- 外部依赖：天气 API（如和风天气）、SMTP 邮箱服务

## 运行环境
- 操作系统：Windows 10/11 或 Linux
- Python：3.8+（推荐 3.10）
- 默认端口：8000
- 网络：可访问天气 API 与 SMTP 服务

## 快速开始
1. 安装依赖：
```bash
pip install -r requirements.txt
```
2. 启动服务：
```bash
python app.py
```
3. 访问系统：
```
http://localhost:8000/login.html
```

## Windows 快速启动
双击运行 `start_skyalert.bat` 或 `start_skyalert.exe`，自动启动服务并打开浏览器。

## 配置说明
- `settings.json`：SMTP、预警时间、天气 API Key 等核心配置
- 环境变量 `WEATHER_API_KEY`：天气 API Key（优先级高于 `settings.json`）
- `customers_data.json`：人员数据
- `templates_data.json`：模板数据
- `alert_rules.json`：预警规则数据

## 关键文件与目录
- `app.py`：主服务入口与 API 路由
- `weather_alert_main.py`：天气拉取与预警逻辑
- `skyalert.db`：SQLite 数据库
- `index.html`：业务后台
- `admin.html`：管理员后台
- `login.html`：登录页面
- `README_import_db.md`：数据库导入工具说明

## 数据与维护
- 数据库备份与恢复：参考 `部署文档.md`
- 数据导入：使用 `import_db.py`，详见 `README_import_db.md`
- 日志与通知可按需清理，避免长期堆积

## 相关文档
- `需求分析文档.md`
- `部署文档.md`
- `操作文档.md`
- `测试文档.md`

## 开源协议建议
推荐使用 **MIT License**：条款简洁、商业友好、便于二次集成；如需明确专利授权保护，可考虑 **Apache-2.0**。
