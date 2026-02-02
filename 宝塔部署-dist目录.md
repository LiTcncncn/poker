# 宝塔面板部署 - dist 目录版本

## ✅ 构建完成

项目已重新构建，现在支持访问 `http://你的域名/dist/index.html`

### 构建信息
- **构建时间**：已生成最新版本
- **资源路径**：所有资源路径已自动添加 `/dist/` 前缀
- **文件位置**：`dist/` 目录

---

## 📦 部署步骤

### 1. 上传 dist 文件夹

1. **登录宝塔面板**
   - 进入"文件"管理

2. **找到网站根目录**
   - 通常是：`/www/wwwroot/你的域名/`

3. **上传 dist 文件夹**
   - 将整个 `dist` 文件夹上传到网站根目录
   - 最终结构：
     ```
     /www/wwwroot/你的域名/
     └── dist/
         ├── index.html
         ├── assets/
         │   ├── index-0c7QtiHj.css
         │   └── index-LcudWmPN.js
         └── pokers/
             └── (所有图片文件)
     ```

### 2. 配置 Nginx（重要！）

1. **进入网站设置**
   - 宝塔面板 → 网站 → 你的网站 → 设置

2. **点击"配置文件"**

3. **添加或修改 location 配置**
   
   找到或添加以下配置：
   ```nginx
   location /dist/ {
       alias /www/wwwroot/你的域名/dist/;
       index index.html;
       try_files $uri $uri/ /dist/index.html;
   }
   ```

   或者，如果你想直接访问 `/dist/` 时自动跳转到 `index.html`：
   ```nginx
   location /dist/ {
       alias /www/wwwroot/你的域名/dist/;
       index index.html;
       try_files $uri $uri/ /dist/index.html;
   }
   
   location = /dist {
       return 301 /dist/;
   }
   ```

4. **保存并重启 Nginx**
   - 点击"保存"
   - 点击"重载配置"或重启 Nginx

### 3. 访问网站

- **访问地址**：`http://你的域名/dist/index.html`
- **或者**：`http://你的域名/dist/`（如果配置了自动跳转）

---

## 🔍 验证步骤

1. **检查文件结构**
   - 确认 `dist` 文件夹在网站根目录
   - 确认 `dist` 文件夹内有：
     - `index.html`
     - `assets/` 文件夹
     - `pokers/` 文件夹

2. **检查 Nginx 配置**
   - 确认已添加 `/dist/` 的 location 配置
   - 确认已重启 Nginx

3. **测试访问**
   - 浏览器访问：`http://你的域名/dist/index.html`
   - 打开开发者工具（F12）
   - 检查 Console 是否有错误
   - 检查 Network 是否所有资源都加载成功

---

## ⚠️ 常见问题

### Q1: 访问后还是空白？
**A:** 检查：
1. Nginx 配置是否正确
2. 文件路径是否正确
3. 浏览器控制台（F12）的错误信息

### Q2: 资源 404 错误？
**A:** 检查：
1. `assets/` 和 `pokers/` 文件夹是否在 `dist/` 目录内
2. Nginx 配置中的路径是否正确
3. 文件权限是否正确（应该是 644）

### Q3: 刷新页面 404？
**A:** 确保 Nginx 配置中有：
```nginx
try_files $uri $uri/ /dist/index.html;
```

### Q4: 图片不显示？
**A:** 检查：
1. `pokers/` 文件夹是否完整上传
2. 图片文件权限是否正确
3. Nginx 配置是否正确

---

## 📝 Nginx 完整配置示例

```nginx
server {
    listen 80;
    server_name 你的域名;
    
    root /www/wwwroot/你的域名;
    index index.html;
    
    # dist 目录配置
    location /dist/ {
        alias /www/wwwroot/你的域名/dist/;
        index index.html;
        try_files $uri $uri/ /dist/index.html;
    }
    
    # 访问 /dist 时自动跳转到 /dist/
    location = /dist {
        return 301 /dist/;
    }
    
    # 其他配置...
}
```

---

## 🎯 快速检查清单

部署完成后，确认：

- [ ] `dist` 文件夹已上传到网站根目录
- [ ] `dist` 文件夹内有 `index.html`、`assets/`、`pokers/`
- [ ] Nginx 已配置 `/dist/` location
- [ ] Nginx 已重启
- [ ] 访问 `http://你的域名/dist/index.html` 能正常显示
- [ ] 浏览器控制台无错误
- [ ] 所有资源正常加载

---

## 🔄 后续更新

每次代码更新后：

1. 本地执行 `npm run build` 重新构建
2. 将新的 `dist` 文件夹上传到服务器（覆盖旧的）
3. 无需修改 Nginx 配置

---

**部署完成后，访问 `http://你的域名/dist/index.html` 即可体验游戏！**










