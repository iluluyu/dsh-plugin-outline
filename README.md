# dsh-plugin-outline

ChatGPT 式的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）web 端右侧快速导航插件。

- 对话列右缘一列小横条，**每轮用户消息一条**，当前阅读位置高亮（跟随滚动实时更新）
- 悬停或点击展开为大纲面板（消息序号 + 截断摘要）
- 点击条目平滑跳转到对应消息
- 深浅色主题自适应；`Esc` / 点击外部 / `✕` 关闭；双击横条固定

## 安装

```sh
dsh plugin --profile web add github:iluluyu/dsh-plugin-outline
```

重启 `dsh web` 并刷新浏览器即可。卸载：`dsh plugin --profile web remove dsh-plugin-outline`。

## 结构

零构建（zero-build）包：`lib/` 下的两个文件既是源码也是发布产物。

| 文件 | 角色 |
|---|---|
| `cordis.yml` | bundle patch：向 Web profile 插入一行 loader 条目 |
| `lib/index.js` | node 半边（宿主加载入口，无行为） |
| `lib/client.js` | 浏览器半边（`__ModuleLoader__` 手写 bundle）：向 `shell.overlay` 插槽注册导航组件 |

轮次发现基于对话流的稳定 data 属性（`[data-conversation-scroll]`、`[data-chat-flow-kind="user"]`），不依赖快照 API。

## License

MIT
