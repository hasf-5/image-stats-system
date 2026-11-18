# 部署到 GitHub Pages（在线演示）

这份文档把系统以**演示模式**发布成一个公开链接，别人打开就能用：
登录、拍照/选图上传、作废、统计看板、用户/分类/报表管理全部可用。

## 先理解一件事

GitHub Pages 只能托管**静态文件**（HTML/JS/CSS），跑不了 NestJS 和 MySQL。
所以演示版把「后端」搬进了浏览器：

| 真实部署 | 演示部署（Pages） |
| --- | --- |
| NestJS + Prisma + MySQL | `web/src/demo/` 里的 axios adapter |
| 数据存 MySQL | 数据存浏览器 IndexedDB |
| 图片存 `/uploads` 磁盘 | 图片存 IndexedDB（base64） |
| JWT + Redis 黑名单 | 同样结构的 token，黑名单存内存状态 |

业务代码（页面、`api/*.ts`）**一行都没改**：演示模式只是把 axios 的 adapter 换掉，
接口路径、返回结构、错误码、分页规则与真后端完全一致。
所以你看到的操作体验，就是接上真后端后的体验。

局限：数据只存在**访问者自己的浏览器**里，换个设备/浏览器就是一份新数据；
可以随时在登录页点「重置演示数据」恢复初始状态。

## 一、创建仓库并推送

1. 打开 https://github.com/new
2. **Repository name** 填 `image-stats-system`（名字随意，后面路径会跟着变）
3. 选 **Public**（Private 仓库的 Pages 需要付费计划；演示站要公开访问）
4. **不要**勾选 "Add a README file" / ".gitignore" / "license"
5. 点 **Create repository**

然后在项目根目录（`image-stats-system/`）打开 Git Bash 执行：

```bash
git remote add origin https://github.com/hasf-5/image-stats-system.git
git branch -M main
git push -u origin main
```

推送时会要求登录。密码那一栏**不能填账号密码**，要填 Personal Access Token：

1. 打开 https://github.com/settings/tokens → **Generate new token (classic)**
2. Note 随便写，Expiration 选 30 days，勾选 **repo** 权限
3. 生成后复制 `ghp_...`，粘贴到 Git Bash 弹出的 password 处

> 如果本机 SSH key 已经加到 GitHub（`ssh -T git@github.com` 能看到 `Hi 用户名!`），
> 用 SSH 更省事，不用管 token。本机 22 端口不通时改走 443：
> ```bash
> git remote set-url origin ssh://git@ssh.github.com:443/hasf-5/image-stats-system.git
> ```

> 想免密：装 [GitHub CLI](https://cli.github.com/) 后执行 `gh auth login` 走浏览器授权，
> 之后 `git push` 不再要求输入。

## 二、开启 Pages

仓库页 → **Settings** → 左侧 **Pages**：

- **Source** 选 **GitHub Actions**（不要选 "Deploy from a branch"）

不需要填任何构建命令，仓库里的 `.github/workflows/deploy-pages.yml` 已经写好了。

> **这一步必须手动点。** `GITHUB_TOKEN` 没有创建 Pages 站点的权限，
> 所以工作流里的 `configure-pages` 无法代劳。如果跳过这步直接跑 Actions，
> build 阶段会报 `Get Pages site failed. Error: Not Found` +
> `Resource not accessible by integration` —— 看到这两句就是这个原因，不是代码问题。
> 点完 Source 后，去 Actions 里 **Re-run all jobs**（或重新 push 一次）即可。

## 三、等自动部署

仓库页 → **Actions** 标签 → 看到 `Deploy demo to GitHub Pages` 正在跑：

1. `build` 阶段：装依赖 → `npm run build:demo` → 上传产物（约 1~2 分钟）
2. `deploy` 阶段：发布到 Pages（约 20 秒）

两个都变绿后，地址是：

```
https://hasf-5.github.io/image-stats-system/
```

（在 Actions 的 deploy 步骤里也能直接点到 `page_url`）

## 四、演示账号

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 管理员 | `admin` | `Admin@123456` |
| 普通用户 | `zhangwei` | `User@123456` |
| 普通用户 | `lina` / `wangqiang` | `User@123456` |

登录页底部有「在线演示」卡片，点账号可以一键填入，不用手打。
初始数据是 60 天、约 2300 条记录，看板的趋势/占比/同比都有内容。

## 五、后续更新

改完代码直接推送即可，Actions 会自动重新构建并发布：

```bash
git add -A
git commit -m "feat: xxx"
git push
```

## 常见问题

**Q：打开是 404？**
A：确认 Settings → Pages 的 Source 是 **GitHub Actions**，且 Actions 里最近一次运行是绿色。
刚开启时第一次部署可能还没跑，去 Actions 手动点 **Run workflow**。

**Q：页面空白 / 资源 404？**
A：本项目演示构建用的是**相对路径 + hash 路由**，放在任何子路径下都能跑。
如果出现空白，先按 Ctrl+F5 强刷；仍不行就看浏览器 Console 的报错。

**Q：数据能持久吗？**
A：存在浏览器的 IndexedDB 里，刷新、关浏览器再开都还在；清站点数据会重置。
不同人访问互不影响。

**Q：能不能接真后端？**
A：可以。演示模式只在 `--mode demo` 构建时生效，正常 `npm run build` 出来的就是调
`/api` 的真实前端。真后端部署见根目录 `README.md`（Docker Compose + Nginx + HTTPS）。

**Q：手机上用相机拍照？**
A：Pages 是 HTTPS，属于安全上下文，`capture="environment"` 能直接调后置相机；
本机用 http://局域网IP 调试时部分浏览器会限制相机。
