#!/bin/bash

# ChromaDB启动脚本
echo "启动ChromaDB服务..."

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "错误：Docker未安装，请先安装Docker"
    exit 1
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "错误：Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

# 创建数据目录
mkdir -p data/vectors

# 启动ChromaDB
if docker compose version &> /dev/null; then
    docker compose up -d chromadb
else
    docker-compose up -d chromadb
fi

# 等待服务启动
echo "等待ChromaDB服务启动..."
sleep 5

# 检查服务状态
if curl -f http://localhost:8000/api/v1/heartbeat &> /dev/null; then
    echo "✅ ChromaDB服务启动成功！"
    echo "服务地址：http://localhost:8000"
else
    echo "⚠️ ChromaDB服务可能还在启动中，请稍后再试"
    echo "可以使用以下命令查看日志："
    echo "docker logs inknowing_chromadb"
fi