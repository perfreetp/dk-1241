#!/bin/bash

echo "======================================"
echo "停止小相册故事化后端服务"
echo "======================================"

# 停止并删除容器
echo "停止Docker服务..."
docker-compose down

# 删除数据卷（可选）
read -p "是否删除数据卷？（这将删除所有数据）[y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "删除数据卷..."
    docker-compose down -v
    echo "数据卷已删除"
fi

echo ""
echo "服务已停止"
echo "======================================"
