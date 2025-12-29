# 数据库相关 JSON 文件索引

依据当前工作区的代码扫描（`rg --files -g'*.json'` 并核对 `app.py`、`weather_alert_main.py`、`maintenance_utils.py`、`send_email_api.py`、`send_emails.py` 等文件），下面是与数据库读写、同步或作为数据库数据兜底/备份相关的 JSON 文件清单。

| 文件路径 | 作用 | 与数据库的关系 | 关键引用 |
| --- | --- | --- | --- |
| `customers_data.json` | 保存人员（客户/工程师）列表 | `Personnel` 表 CRUD 后会写回此文件；天气预警任务读取它获取收件人及地区 | `app.py:335`, `app.py:342`, `weather_alert_main.py:20`, `weather_alert_main.py:410` |
| `templates_data.json` | 预警邮件模板（含适用角色、附件） | 模板表导出到此文件；启动时若表为空会从该文件导入；预警发送时按天气类型/角色读取 | `app.py:734`, `app.py:1869`, `weather_alert_main.py:590` |
| `settings.json` | 系统邮件与天气接口配置 | `Setting` 表的读写会同步到此文件并可用于初始化；邮件发送和预警任务直接读取它获取 SMTP/和风天气配置 | `app.py:1154`, `app.py:1945`, `send_email_api.py:16`, `weather_alert_main.py:19` |
| `alert_rules.json` | 预警规则列表 | 规则的增删改查目前直接写这个文件（对应的 `AlertRule` 模型未实际使用）；预警判断时读取 | `app.py:910`, `app.py:981`, `weather_alert_main.py:393` |
| `data.json` | 邮件发送与预警日志 | 代替 `log` 表的主要日志存储；日志接口、重复预警检测以及邮件任务处理都会读写 | `app.py:1124`, `app.py:2552`, `weather_alert_main.py:604` |
| `re-Emile.json` | 待发送邮件队列（旧流程兜底） | 与 `mail_task` 表并行的任务缓存；预警任务写入并备份，邮件发送流程可从中回放 | `weather_alert_main.py:720`, `app.py:2551`, `send_emails.py:8` |
| `logs/json_backups/re_emile_*.json` | `re-Emile.json` 的自动备份 | 由 `backup_if_has_data/trim_json_file` 在写入队列或清理时生成，用于防止队列丢失 | `maintenance_utils.py:18`, `weather_alert_main.py:758`, `app.py:2684` |

> 说明：其他 JSON（如 `config.json`、`weather.json`、`favorite_cities.json`、`engineer_templates_data.json`、`engineers_data.json`、`success_cities.json`、`user.json`、`health_status.json` 等）仅作为前端静态数据、配置或状态缓存使用，未与数据库表同步。
