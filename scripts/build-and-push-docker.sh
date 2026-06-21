#!/bin/sh

REGISTRY_NAME="${AZURE_CONTAINER_REGISTRY_NAME}"
REGISTRY_ENDPOINT="${AZURE_CONTAINER_REGISTRY_ENDPOINT}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

if [ -z "$REGISTRY_NAME" ]; then
  echo "Error: AZURE_CONTAINER_REGISTRY_NAME environment variable not set"
  exit 1
fi

if [ -z "$REGISTRY_ENDPOINT" ]; then
  echo "Error: AZURE_CONTAINER_REGISTRY_ENDPOINT environment variable not set"
  exit 1
fi

IMAGE_NAME="web"
FULL_IMAGE_NAME="$REGISTRY_ENDPOINT/$IMAGE_NAME:$IMAGE_TAG"

echo "Building Docker image: $FULL_IMAGE_NAME"
docker build -t "$FULL_IMAGE_NAME" -f ./web/Dockerfile ./web

if [ $? -ne 0 ]; then
  echo "Error: Docker build failed"
  exit 1
fi

echo "Logging in to Azure Container Registry: $REGISTRY_NAME"
az acr login --name "$REGISTRY_NAME"

if [ $? -ne 0 ]; then
  echo "Error: Azure Container Registry login failed"
  exit 1
fi

echo "Pushing image to registry: $FULL_IMAGE_NAME"
docker push "$FULL_IMAGE_NAME"

if [ $? -ne 0 ]; then
  echo "Error: Docker push failed"
  exit 1
fi

echo "Successfully pushed image: $FULL_IMAGE_NAME"
