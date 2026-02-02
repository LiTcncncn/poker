#!/bin/bash

# 腾讯云 COS 部署脚本
# 使用方法：./deploy.sh <bucket-name> <region>

set -e

BUCKET_NAME=$1
REGION=$2

if [ -z "$BUCKET_NAME" ] || [ -z "$REGION" ]; then
    echo "使用方法: ./deploy.sh <bucket-name> <region>"
    echo "示例: ./deploy.sh poker-game ap-beijing"
    exit 1
fi

# 检查是否安装了 coscmd
if ! command -v coscmd &> /dev/null; then
    echo "错误: 未安装 coscmd"
    echo "请先安装: pip install coscmd"
    echo "配置: coscmd config -a <SecretId> -s <SecretKey> -b <bucket-name> -r <region>"
    exit 1
fi

echo "开始部署到腾讯云 COS..."
echo "存储桶: $BUCKET_NAME"
echo "地域: $REGION"

# 上传文件
echo "上传文件..."
coscmd upload -rs dist/ /

echo "部署完成！"
echo "访问地址: https://$BUCKET_NAME.cos.$REGION.myqcloud.com"










