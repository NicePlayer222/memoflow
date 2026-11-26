# MemoFlow 项目规则

- 严格遵循 `MEMOFLOW_PLAN.md` 的架构、数据契约与验收门槛。仅实现当前获授权的里程碑。
- 所有数据保存在浏览器 IndexedDB。禁止增加后端、服务端数据库或抓取服务，禁止浏览器请求书签目标以抓取内容。
- 每次修改完成后，依次运行 `npm run typecheck`、`npm run test`、`npm run build` 及当前阶段要求的其他验收命令。
- 如实汇报所有报错、修复结果、跳过项与未验证项。
