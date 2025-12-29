# 天气预警系统部署与数据迁移指南

## 环境要求
- Python 3.8+，建议使用虚拟环境
- 依赖：`pip install -r requirements.txt`
- 需要对项目目录和 `instance/` 具有读写权限
- 默认监听 `0.0.0.0:8000`

## 部署步骤
1) **获取代码**  
   将项目放到目标服务器，进入项目根目录。

2) **创建虚拟环境并安装依赖**
   ```bash
   python -m venv .venv
   source .venv/bin/activate      # Windows: .\.venv\Scripts\activate
   pip install -r requirements.txt
   ```

3) **配置业务参数**  
   在根目录编辑 `settings.json`（SMTP、和风天气 API Key、预警/刷新间隔等），必要时调整 `user.json`（账户）、`alert_rules.json`、`templates_data.json` 等业务文件。

4) **准备数据库**
   - 直接覆盖：将已有 `skyalert.db` 放到 `instance/skyalert.db`。  
   - 或先跑一次迁移脚本以确保表结构完整：
     ```bash
     python migrate_db.py
     ```

5) **启动服务**
   - 开发/小规模：`python app.py`
   - 生产示例（Gunicorn）：`gunicorn -w 4 -k gthread -b 0.0.0.0:8000 app:app`
   - 可用 `daemon_runner.py`/systemd/supervisor 做守护。

6) **访问**  
   浏览器打开 `http://<服务器IP>:8000/index.html`（根路径亦可访问静态页）。

## 数据迁移方案
### 1. 直接复制数据库
- 从旧服务器拷贝 `skyalert.db`（可选 `instance/weather_cache.db`）到新服务器的 `instance/` 目录。
- 覆盖后启动服务即可沿用原数据。

### 2. 使用数据库导入工具（合并而非覆盖）
`import_db.py` 支持备份、预览、按表合并/去重。
```bash
# 预览差异
python import_db.py /path/to/source/skyalert.db --preview

# 合并到现有库（默认 instance/skyalert.db）
python import_db.py /path/to/source/skyalert.db --auto-update
# 若目标库不在默认路径：
python import_db.py /path/to/source/skyalert.db --target-db instance/skyalert.db --auto-skip
```
- 导入前自动备份到 `instance/backups/`，失败可回滚。
- 可用 `--tables` 选择表，`--auto-skip`/`--auto-update` 控制重复策略。

### 3. 仅有 JSON 数据的迁移（旧版本文件存储）
1) 将对方的 `customers_data.json`、`templates_data.json`、`settings.json`、`alert_rules.json` 等放到项目根目录。  
2) 运行一次 `python app.py`，会创建表并写入模板/设置。  
3) 如需把客户数据写入数据库，可执行（一次性脚本）：
   ```bash
   python - <<'PY'
   import json
   from app import app, db, Personnel, WeatherType
   with app.app_context():
       data = json.load(open('customers_data.json','r',encoding='utf-8'))
       for row in data:
           p = Personnel(name=row.get('name'), title=row.get('title'),
                         company=row.get('company'), region=row.get('region'),
                         email=row.get('email'), phone=row.get('phone'),
                         category=row.get('category','客户'))
           for wt_name in row.get('weatherTypes', []):
               wt = WeatherType.query.filter_by(name=wt_name).first() or WeatherType(name=wt_name)
               if wt.id is None:
                   db.session.add(wt)
               p.weather_types.append(wt)
           db.session.add(p)
       db.session.commit()
   PY
   ```

## 迁移后检查
- 结构/数据量检查：`python check_db_structure.py`
- 运行健康性：启动应用后确认前端能正常加载数据、发送邮件配置无误。

## 目录要点
- `app.py`：Flask API + 后台预警线程，主入口
- `weather_alert_main.py`：预警核心逻辑，可单独运行做一次性检测
- `import_db.py`：SQLite 数据合并/备份/回滚工具
- `migrate_db.py`：表结构补丁
- `instance/`：数据库与缓存存放目录
