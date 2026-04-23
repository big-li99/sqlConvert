# 🔄 SQL Convert: MySQL → Oracle

![GitHub](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)
![License](https://img.shields.io/badge/License-MIT-green)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)

> 🌊 专注于将 MySQL 语法转换为 Oracle 语法，特别适用于 **OceanBase MySQL 模式** 向 **OceanBase Oracle 模式** 的迁移与适配场景。

## 📖 项目概述

本项目是一个基于现代化前端技术栈的 SQL 转换工具，提供直观的编辑器界面、可配置的转换选项、详细的转换日志与统计信息，帮助用户高效完成数据库迁移任务。

## 🎯 核心目标

将 MySQL 语法转换为兼容 Oracle 的 SQL，支持常见 DDL/DML 语句及数据类型映射，并提供可扩展的自定义规则机制。

## ✨ 主要特性

| 特性 | 说明 |
|------|------|
| 🔀 **多语句处理** | 支持多语句拆分与逐条转换 |
| 🔄 **数据类型映射** | 自动转换 MySQL 到 Oracle 数据类型 |
| 💬 **注释转换** | 智能转换 SQL 注释语法 |
| 🔢 **自增列替代** | 支持 IDENTITY 或 SEQUENCE+TRIGGER 方案 |
| 📝 **DML 语法适配** | 处理 LIMIT、函数替换等语法差异 |
| 🎛️ **可视化设置** | 提供设置面板与实时日志统计 |
| 📁 **文件操作** | 支持导入导出与快捷操作 |
| 🔌 **可扩展架构** | 支持自定义转换规则 |

## 🏗️ 技术架构

```
React 19 + TypeScript + Vite + Monaco Editor
```

- **UI 交互** 与 **转换逻辑** 清晰分离，便于维护与扩展
- 使用 **Monaco Editor** 提供专业的代码编辑体验
- **TypeScript** 保证类型安全与开发效率
