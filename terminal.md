报错原因：`import_db.py` 需要必填的位置参数 `source_db`（源数据库路径），你直接运行 `python import_db.py` 未提供该参数，argparse 便提示 “the following arguments are required: source_db” 并打印用法说明。

正确用法示例：
- 预览：`python import_db.py path/to/source.db --preview`
- 全量导入：`python import_db.py path/to/source.db`
- 只导入部分表：`python import_db.py path/to/source.db --tables personnel template`

默认目标库是 `instance/skyalert.db`，可用 `--target-db` 指定其他路径；更多示例见 `README_import_db.md`。

关于人员 JSON 导入：
- 若只用 JSON：把新的 `customers_data.json` 放到项目根目录替换旧文件，前端/告警读取的就是这个文件。
- 若要写入数据库：先在项目根目录跑 `python app.py`（确保表已创建后停止），再执行一次性脚本：
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
  在 WSL 用 `python3` 替换 `python`，必要时可加 `--target-db` 指向自定义库。

人员 JSON 覆盖回旧数据的原因说明：
- 启动 `app.py` 只会在表为空时导入模板/设置，不会自动把新的 `customers_data.json` 灌入 `Personnel` 表；数据库仍保留旧人员数据。
- 当有删除等操作触发 `save_customers_to_json`（如删除人员接口），会把数据库里的旧人员导出回 `customers_data.json`，把你替换的新文件覆盖掉。
- 解决：先备份，停掉正在运行的服务，按上面的“一次性脚本”把新的 `customers_data.json` 写入数据库，再启动应用；之后数据库和 JSON 才会一致，不会被旧数据回写。若只想用文件而不依赖数据库，确保没有 API 操作触发回写。

使用工作区根目录的 `skyalert.db` 时的命令：
- `app.py` 默认已配置 `SQLALCHEMY_DATABASE_URI = sqlite:///<项目根>/skyalert.db`，无需额外参数。
- 步骤：先在项目根目录运行一次 `python app.py`（或 WSL 下 `python3 app.py`），确认表存在后停掉；再运行一次性导入脚本：
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
- 如果数据库文件路径仍指向别处，需要启动 `app.py` 前修改配置或参数，使 `SQLALCHEMY_DATABASE_URI` 指向目标 `skyalert.db`，再执行脚本。

新增行为（自动导入人员 JSON 到数据库）：
- `app.py` 启动时会调用 `import_personnel_from_json`，从项目根目录的 `customers_data.json` 读取并覆盖人员表（先清空人员和关联表，再按 JSON 重建）。
- 如果 `customers_data.json` 缺失或格式错误，会跳过导入并打印提示。
- 因为是覆盖模式，启动前请确认 `customers_data.json` 已是最新人员数据，否则会用旧文件覆盖数据库中的人员。

新增行为（自动同步设置到数据库）：
- 启动 `app.py` 时会调用 `import_settings_from_json`，从项目根目录的 `settings.json` 同步到 `Setting` 表，覆盖已存在的设置。
- 如果 `settings.json` 缺失或解析失败，将保留原有数据库数据；若表为空且同步失败，会写入一份默认设置以防缺项。
- 仍可在前端保存设置，保存时会写入数据库并回写 `settings.json`。
