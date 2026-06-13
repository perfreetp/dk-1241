#!/bin/bash

set -e

echo "======================================"
echo "小相册故事化后端服务 - 启动脚本"
echo "======================================"

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker未安装，请先安装Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "错误: Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

# 检查.env文件
if [ ! -f .env ]; then
    echo "创建环境配置文件..."
    cp .env.example .env
    echo "已创建.env文件，请根据需要修改配置"
fi

# 启动服务
echo ""
echo "启动Docker服务..."
docker-compose up -d

# 等待服务启动
echo ""
echo "等待服务启动..."
sleep 10

# 检查服务状态
echo ""
echo "检查服务状态..."
docker-compose ps

# 显示访问信息
echo ""
echo "======================================"
echo "服务启动成功！"
echo "======================================"
echo ""
echo "API地址: http://localhost:3000"
echo "API文档: http://localhost:3000/api/v1"
echo "健康检查: http://localhost:3000/health"
echo "RabbitMQ管理界面: http://localhost:15672"
echo "MinIO控制台: http://localhost:9001"
echo ""
echo "默认账号:"
echo "  - 邮箱: admin@storyservice.com"
echo "  - 密码: password123"
echo ""
echo "查看日志: docker-compose logs -f"
echo "停止服务: docker-compose down"
echo "======================================"
