# Cloudflare DNS & SaaS Manager

一个轻量级、边缘原生的 Cloudflare 管理面板。完全运行在 Cloudflare Pages 和 Functions 之上，用于高效管理 DNS 记录与 SSL for SaaS (自定义主机名)。

[![Cloudflare](https://img.shields.io/badge/Powered%20By-Cloudflare-F38020?logo=cloudflare)](https://pages.cloudflare.com/)

---

## ✨ 核心特性

- 🚀 **边缘渲染**：基于 Cloudflare Pages Functions，极速响应。
- 🌐 **全能 DNS**：完整的 DNS 记录增删改查，支持批量操作。
- 🔒 **SSL for SaaS**：轻松管理自定义主机名 (Custom Hostnames) 与回退源 (Fallback Origin)。
- 📁 **导入导出**：支持 DNS 记录的备份与快速迁移。
- 👥 **多账户支持**：支持配置多个 Cloudflare API Token。
- �️ **双模式登录**：
  - **托管模式 (Server Mode)**：使用管理员密码登录，后端安全管理 Token。
  - **本地模式 (Client Mode)**：前端透明代理，不存储任何 Token。

## 📋 快速部署

### 1. 准备工作
- Fork 本仓库。
- 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。

### 2. 在 Cloudflare Pages 部署
1. 进入 `Workers 和 Pages` 控制台，点击 **创建应用** -> **Pages** -> **连接到 Git**。
2. 选择你的 Fork 仓库。
3. **构建设置**：
   - 框架预设：`Vite`
   - 构建命令：`npm run build`
   - 输出目录：`dist`
4. 点击 **保存并部署**。

### 3. 配置环境变量 (可选 - 开启托管模式)
若要开启托管模式，请在 Pages 设置中添加以下环境变量：

| 变量名          | 必填 | 描述                                               |
| :-------------- | :--- | :------------------------------------------------- |
| `APP_PASSWORD`  | 是   | 管理面板登录密码 (请使用复杂密码)                  |
| `CF_API_TOKEN`  | 是   | Cloudflare API 令牌 (需 DNS:Edit 和 SSL:Edit 权限) |
| `CF_API_TOKEN1` | 否   | 备用账户 1 的 API 令牌                             |
| `CF_API_TOKEN2` | 否   | 备用账户 2 的 API 令牌                             |

---

## 🏗️ 项目架构

- **Frontend**: React 18 + Vite + Lucide Icons (SPA 架构)
- **Backend**: Cloudflare Pages Functions (Serverless API)
- **Security**: 
    - 托管模式：后端校验 `APP_PASSWORD` 并颁发 `jose` 签名的 JWT。
    - 本地模式：直接根据前端输入的 Token 进行代理请求。

---

## 🛠️ 本地开发

1. **安装依赖**：
   ```bash
   npm install
   ```
2. **启动开发环境** (推荐代理模式)：
   ```bash
   # 终端 1：启动 Vite (前端热更新)
   npm run dev
   
   # 终端 2：启动 Wrangler 代理 (绑定后端功能)
   npm run dev:wrangler -- --binding APP_PASSWORD="your_password" --binding CF_API_TOKEN="your_token"
   ```
   访问地址：`http://localhost:8788`

---

## 📜 许可证

本项目采用 [MIT License](./LICENSE) 开源。

## ⚠️ 免责声明

1. 本项目仅供学习和个人管理之用，请勿用于非法用途。
2. 请妥善保管您的 `APP_PASSWORD` 和 `CF_API_TOKEN`。由于泄露导致的账户安全问题由使用者自行承担。
3. 建议开启 Cloudflare Access 进行二次防护。

---
*Created with ❤️ by [sushen339](https://github.com/sushen339) | Powered by [Antigravity](https://github.com/google-deepmind)*
