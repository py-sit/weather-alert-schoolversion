# 气象预警系统 - 本地依赖文件

由于您的服务器环境无法访问CDN，需要手动下载以下文件并放置在对应目录中：

## 目录结构

```
vendor/
├── css/
│   └── tailwind.min.css    # Tailwind CSS样式框架
└── js/
    ├── chart.umd.min.js    # Chart.js图表库
    ├── lucide.min.js       # Lucide图标库
    ├── sweetalert2.all.min.js # SweetAlert2弹窗库
    └── xlsx.full.min.js    # SheetJS库(Excel处理)
```

## 文件下载链接

1. **Tailwind CSS**: https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css
2. **Lucide**: https://unpkg.com/lucide@latest/dist/umd/lucide.min.js
3. **Chart.js**: https://cdn.jsdelivr.net/npm/chart.js/dist/chart.umd.min.js
4. **SweetAlert2**: https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js
5. **SheetJS**: https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js

## 下载方法

方法1：在可正常访问互联网的电脑上，使用浏览器访问上述链接，下载文件后通过传输工具（如U盘）复制到服务器对应目录。

方法2：在服务器上访问我们创建的辅助页面：`download_cdn.html`，该页面提供了所有需要下载的文件链接，以及每个文件的保存位置指导。

## 验证

文件放置完成后，刷新页面，系统应该能够正常加载所有资源。

备注：如果以上链接也无法访问，请尝试通过搜索引擎搜索这些库的官方网站，下载对应版本。 